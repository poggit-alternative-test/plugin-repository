# Axolotl Plugin Repository: Implementation Architecture Recovery

**Basis and scope.** This document reconstructs the repository as it exists in source, configuration, workflows, schemas, fixtures, and tests. Statements about behavior describe executable implementation unless labelled as documentation. Where the implementation supplies no answer, the conclusion is **Unable to determine from implementation.**

## 1. Repository map

| Top-level path | Implemented purpose |
|---|---|
| `.github/` | GitHub ownership policy, a submission-check workflow, a legacy/stub validation workflow, and a stub trusted-build workflow. |
| `.claude/` | Local tool metadata; no application source was recovered here. |
| `.test-fixtures/`, `.test-m4-materialization/`, `.test-materialization/`, `.tmp/`, `test-audit-reviews/`, `test-cli-fixtures/` | Local test and test-run data. `test-cli-fixtures/` contains a persisted review-candidate fixture. |
| `config/` | Trusted reviewer allowlist configuration (`reviewers.yaml`), keyed by GitHub numeric ID. |
| `docs/` | Design, policy, M5 handoff, and operating documents. They are not executed by the application. |
| `registry/` | Runtime registry root. It currently contains only `plugins/.gitkeep`; no live plugin or version record exists. |
| `schemas/` | JSON Schema representations of developer submissions, registry identities, and version records. |
| `src/` | Main TypeScript application source: submission, review, registry, materialization, and CLI entry points. |
| `submissions/` | Developer-controlled YAML proposal location; currently contains `example-plugin.yaml`. |
| `tests/` | Vitest unit and component tests grouped by domain, plus registry fixtures. |
| `tools/validator/` | Separate npm workspace containing a legacy validator module; its YAML parser is an explicit placeholder that always throws. It is not imported by the main application. |
| `node_modules/` | Installed dependencies; not repository-authored architecture. |
| `plugin-repository.zip` | Ignored archive artifact. Its role is unable to determine from implementation. |

Root tooling is Node 18+ / TypeScript ESM. The root package exposes `tsx` CLIs and Vitest tests; `tsc --noEmit` is both `typecheck` and `lint`. There is intentionally no main build output (`build` prints that code runs through `tsx`). `generate` prints that a registry generator is not implemented. The `tools/*` workspace has its own TypeScript configuration and Jest-oriented package scripts.

## 2. Bounded contexts and ownership

### Submission inspection (`src/submission`)

**Responsibility:** turn one developer submission YAML file into an inspection result for human review without executing upstream code.

**Public API:** `inspectSubmission`, submission schema/filename helpers, `GitHubClient` and real/fake implementations, acquisition helpers, plugin/composer parsers, static review signals, diagnostics, and report serializers. `src/submission/index.ts` is the barrel export.

**Internal components:**

- `schema.ts`: validates a flat `.yaml`/`.yml` filename, parses the minimal `{schema_version, upstream}` proposal, and rejects fields owned by later stages through the strict Zod submission schema.
- `github.ts`: read-only GitHub REST adapter, with `FakeGitHubClient` for tests. It resolves repository, branch, commit, files, and archive URLs.
- `acquisition.ts`: GitHub-only archive URL validation, manual redirect validation (five redirects), ZIP extraction, path/symlink checks, filesystem analysis, safe reads, and cleanup.
- `plugin-yml.ts` and `composer.ts`: bounded static parsing; neither invokes Composer or plugin code.
- `signals.ts`: regex-based PHP and repository-file review signals. Signals are not automatic acceptance or rejection decisions.
- `result.ts` and `diagnostics.ts`: structured outcome/diagnostic model and human/JSON reporting.

**Dependencies:** Registry schema and validators; Node filesystem/path/OS; `yaml`, `zod`, `adm-zip`; GitHub REST/archive endpoints. It owns no persisted canonical state; a CLI may pass its output into Review registration.

**Lifecycle:** proposal file -> schema and repository validation -> branch head resolves to a SHA -> source archive is acquired at that SHA -> metadata and signals are computed -> `READY_FOR_REVIEW`, `SUBMISSION_ERROR`, or `INFRASTRUCTURE_ERROR`.

### Review (`src/review`)

**Responsibility:** persist and derive human decisions for an exact candidate `(plugin slug, upstream repository, SHA)`.

**Public API:** candidate identity helpers, reviewer authorization, review records/states, approval-precondition checker, `ReviewStorageManager`, and `ReviewManager` through `src/review/index.ts`.

**Internal components and ownership:**

- `candidate-identity.ts` owns canonical identity: `slug@owner/repo#40-hex-sha`; its 12-hex SHA-256 prefix selects the storage directory.
- `review-record.ts` owns version-1 `CandidateInfo` and `ReviewRecord` shapes, decision IDs, timestamps, and the three decision values.
- `reviewer-auth.ts` owns numeric GitHub-ID authorization. A login is an informational snapshot only.
- `review-storage.ts` owns YAML filesystem persistence under `reviews/{slug}/{shortId}/`, with `candidate.yaml` and append-only decision files.
- `review-state.ts` owns deterministic ordering and latest-decision-wins state derivation.
- `approval-preconditions.ts` owns the fail-closed programmatic approval gate, requiring registered candidate, inspection evidence, ready status, matching SHA/identity, an authorized reviewer, plugin metadata/source evidence, and no errors.

**Dependencies:** Submission result types, registry diagnostic type import, Node filesystem/path/crypto, and `yaml`. It is consumed by the inspection-registration CLI and by materialization's file-backed M4 approval store.

**Lifecycle:** inspection registration writes/overwrites candidate information; authorized callers append unique decision records; canonical timestamp/ID ordering selects `PENDING`, `APPROVED`, `REJECTED`, or `CHANGES_REQUESTED`. Historical decision files are retained.

### Registry (`src/registry`)

**Responsibility:** parse and validate canonical plugin identity and version YAML records from the filesystem.

**Public API:** branded identifiers, lifecycle union/types and guards, Zod schemas, YAML parser/loaders, validators, diagnostics, and `validateRegistry` via the barrel module.

**Internal components:**

- `types.ts` owns the version-record state model and the `VALID_TRANSITIONS` table.
- `schema.ts` owns strict persisted schemas. A plugin is `registry/plugins/{id}/plugin.yaml`; version records are `versions/{version}.yaml`.
- `parser.ts` owns 1 MiB YAML parsing and tree loading, with core schema, merge disabled, and no custom tags.
- `validator.ts` adds filename/directory and cross-record checks.
- `validators.ts` owns checks for IDs, SHAs, checksums, versions, branches, timestamps, release tags, and repository identity.

**Dependencies:** Node filesystem/path, `yaml`, and `zod`. This context does not call GitHub or write registry records. Its actual live registry is empty.

### Trusted source materialization (`src/materialization`)

**Responsibility:** plan and, at service level, execute preservation of exact M4-approved source into a private storage GitHub repository plus canonical provenance.

**Public API:** materialization types, `MaterializationService`, M4 approval/source-acquisition ports and adapters, GitHub client interface/fake/real adapter, GitHub App auth, repository naming, and tester transport configuration through `src/materialization/index.ts`.

**Internal components and ownership:**

- `materialization-types.ts` owns plan/provenance/result records, validation helpers, and error/warning vocabulary.
- `materialization-service.ts` owns authorization revalidation, archive canonicalization/digests, plan generation, reconciliation, commits, and provenance record construction.
- `FileM4ApprovalStore` reads review filesystem data and only resolves an authorized latest `APPROVED` record for the exact candidate. `GitHubExactSourceAcquirer` first confirms the exact GitHub commit, then downloads its archive. `ArchiveDirectorySourceAcquirer` is test-only.
- `github-client.ts` owns the transport port and in-memory fake. `real-github-client.ts` implements GitHub REST access; `github-app-auth.ts` creates GitHub App JWTs and installation tokens.
- `tester-transport-config.ts` owns test-organization allowlisting and production-organization blocklisting.

**Dependencies:** Review context, M3 acquisition limits, `adm-zip`, YAML, Node crypto/filesystem/path, GitHub REST and optional GitHub App credentials. It does not depend on Registry records.

**Lifecycle:** validated candidate hint -> trusted M4 lookup -> exact archive acquisition -> deterministic plan (dry run by default) -> execution-time full revalidation -> repository reconciliation/creation -> immutable source commit -> separate provenance commit -> repeat invocation either recognizes the exact provenance/source pair or reports a conflict.

### CLI (`src/cli`)

There are four executable `tsx` command modules:

- `inspect-submission.ts`: inspect a local submission; optional `--register` writes review candidate data after `READY_FOR_REVIEW`.
- `review.ts`: inspect, validate a record, approve, reject, state, and list filesystem review data. `request-changes` is advertised but exits as not fully implemented.
- `validate-registry.ts`: validate a registry path as text or JSON.
- `materialize.ts`: produces only an M5 plan. The `execute` command explicitly fails; its transport is configured read-only.

## 3. Dependency graph and direction

```text
CLI / GitHub Actions
  -> Submission service -> submission GitHub port -> GitHub REST/archive + local temp filesystem
  -> Review service     -> review filesystem store + reviewer YAML
  -> Registry validator -> registry filesystem/YAML
  -> Materialization service
       -> trusted M4 approval-store port -> review filesystem/YAML + reviewer IDs
       -> exact-source-acquirer port     -> materialization GitHub port -> GitHub REST/archive
       -> materialization GitHub port    -> private storage repositories

Submission -> Registry (submission schema and semantic validators)
Review -> Submission (approval preconditions use inspection result types)
Materialization -> Review (M4 decision reconstruction)
Materialization -> Submission (archive resource-limit constants)
```

The direction is inward from adapter/CLI/workflow to domain service to explicit ports and then filesystem/GitHub. Registry is reused by Submission, while Materialization separately defines equivalent branded primitive types rather than importing registry types. No source-level circular module dependency was recovered.

## 4. Implemented workflows

### Local/CI submission inspection

1. A filename is checked for basename-only YAML format and a valid slug.
2. Minimal submission YAML is parsed through `PluginSubmissionSchema`; the only accepted input is schema version and `upstream.repository`/`branch`.
3. Repository identity is split into owner/name; GitHub repository and branch are read.
4. The branch head becomes the resolved exact SHA; canonical GitHub name differences are a warning.
5. A ZIP archive URL for that SHA is restricted to GitHub hosts, redirects are rechecked, and the archive is extracted under temporary storage.
6. Extraction and subsequent walking limit archive/extracted/file sizes, count, depth, and unsafe paths; plugin code is never run.
7. Root `plugin.yml` and optional `composer.json` are statically parsed; up to 100 PHP files (512 KiB each) receive heuristic signal analysis; committed PHARs are signalled.
8. Temporary extraction is removed; diagnostics determine the final inspection status.
9. The inspect CLI can register a ready candidate in the review filesystem.

`submission-check.yml` is the CI realization. It checks out the base branch, installs its locked dependencies with `--ignore-scripts`, limits a PR to exactly one added submission YAML, and runs the trusted-base inspector. It has read-only token permissions. The fetch command sets `PR_HEAD_SHA`, but the `gh api .../contents/$SUBMISSION_FILE` call contains no `ref` parameter; therefore implementation does not establish that the fetched bytes are at the stored PR head SHA.

### Review workflow

1. Candidate registration constructs the canonical exact identity and writes `candidate.yaml`.
2. The reviewer CLI loads `config/reviewers.yaml`, authorizing numeric GitHub ID.
3. Decisions are serialized to separate YAML files through temporary-file then rename semantics; an existing decision filename is rejected.
4. Records sort by timestamp, then lexicographic decision ID. The latest valid stored decision determines state.
5. `APPROVED` normally requires `checkApprovalPreconditions`; the precondition API requires inspection evidence. The current CLI supplies `inspectionResult: null`, so its `approve` command fails that gate in this implementation.
6. `reject` records an authorized rejection without calling approval preconditions. The CLI's `request-changes` branch reports it is unimplemented.

### Registry validation

1. Load each plugin directory and `plugin.yaml`.
2. Parse bounded hardened YAML and validate strict identity schema.
3. Load YAML version files, validate discriminated lifecycle schemas and filename/version equivalence.
4. Apply cross-record checks: duplicate plugin IDs, duplicate upstreams (warning), duplicate versions, storage consistency, and published/deprecated/revoked provenance presence.
5. Aggregate diagnostics and produce text or JSON. Missing `registry/plugins` is treated as an empty valid registry; the present tree is empty.

### Materialization service workflow

1. Validate plugin ID, version, upstream repository, and exact SHA hint.
2. Reconstruct trusted approval from candidate/decision YAML, requiring every stored decision to match the candidate and its reviewer ID to be allowlisted; require the latest decision to be `APPROVED`.
3. Verify that GitHub resolves the approval's exact commit and download its archive at that SHA.
4. Reject unsafe ZIP paths/symlinks; normalize paths, optionally strip one common archive root, sort bytewise, reject duplicate normalized paths, and calculate archive/tree SHA-256 integrity.
5. Generate a schema-2 plan. Plans default to dry-run and are explicitly not authorization credentials.
6. For execution, require a service-issued opaque execution context, write-enabled client, fresh M4 authorization, exact re-acquisition, and exact equality with a rebuilt trusted plan.
7. Reconcile storage repository ownership/archive status and existing provenance/source. Create the private repository when absent; conditionally commit source using expected branch head; then commit canonical provenance in a separate conditional commit.
8. A matching provenance and matching source tree yields `alreadyMaterialized`; malformed or differing state is a conflict. Source-only recovery may add provenance but never change source bytes.

The shipped materialization CLI intentionally performs only steps 1-5. It creates a read-only real client and rejects `execute`, so no source-tree command enables live writes.

### GitHub Actions build workflows

- `build-trusted.yml` defines a multi-job outline: read registry, exact-SHA checkout/compare, source validation, PHAR build, checksum, and summary. Registry extraction, revalidation, scanning, Composer installation, PHAR build, and PHAR-content verification are explicit `TODO` commands. Only checkout comparison and checksum shell logic are implemented.
- `validate-submission.yml` is a separate legacy/stub workflow for paths matching `registry/plugins/*.yaml`. All substantive repository/plugin/security/build checks are explicit `TODO`/`STUB` echo steps.
- No website deployment, registry generation, publication, or release workflow exists in `.github/workflows`.

## 5. Entities, value objects, and state transitions

| Model | Implemented state/identity | Allowed transitions / terminal states |
|---|---|---|
| Submission inspection | `READY_FOR_REVIEW`, `SUBMISSION_ERROR`, `INFRASTRUCTURE_ERROR` result status | It is a result, not a persisted transition machine. No transition API exists. |
| Review candidate | canonical `slug@owner/repo#sha`, short SHA-256-based directory ID | Candidate info plus append-only decisions. Effective state is `PENDING`, `APPROVED`, `REJECTED`, `CHANGES_REQUESTED`; every new nonduplicate decision type may supersede the prior effective state. `APPROVED`/`REJECTED` are called terminal decision values, but later records remain allowed by state logic. |
| Registry version | strict discriminated record: `approved`, `materialized`, `published`, `deprecated`, `revoked`, `removed` | `approved -> materialized -> published -> deprecated|revoked`; `deprecated -> revoked|removed`; `revoked -> removed`; `removed` has no outbound transition. `canTransition` only reports these transitions; no service persists them. |
| Materialization | plan/result/provenance records, schema version 2; materialization ID is SHA-256 of candidate identity | No dedicated state enum. Execution resolves to failure, success, or `alreadyMaterialized`; source and canonical provenance are checked as immutable pairs. `ProvenanceStatus` enum exists but is not used by the service. |

Registry value objects are branded Git SHA, SHA-256, SemVer, PluginId, and repository identity. Materialization declares parallel branded types. Review identity, reviewer numeric ID, exact SHA, artifact reference, source/storage/review references, and integrity tuple are the principal value objects. There is no aggregate root class; registry `Plugin` (identity + version list), review candidate directory, and materialization plan/provenance are the closest aggregate boundaries.

## 6. Interfaces and adapters

| Owner | Contract | Implementations / consumers |
|---|---|---|
| Submission | `GitHubClient` | `RealGitHubClient`, `FakeGitHubClient`; consumed by inspection/acquisition. |
| Materialization | `GitHubClient` | in-memory `FakeGitHubClient`, `RealGitHubClientImpl`; consumed by source acquirer and service. |
| Materialization | `TrustedM4ApprovalStore` | `FileM4ApprovalStore`; service consumes it. |
| Materialization | `ExactSourceAcquirer` | `GitHubExactSourceAcquirer` and test-only `ArchiveDirectorySourceAcquirer`; service consumes it. |
| Materialization | `TrustedExecutionContext` | private `ExecutionContext`, issued only by `MaterializationService`; required by `executePlan`. |
| Review | reviewer authorization model | `ReviewerAuthorizer` consumes declarative reviewer config; no remote authorization adapter exists. |

Registry has parser/validator functions rather than repository/service interfaces. Review persistence is directly owned by `ReviewStorageManager`, not abstracted behind a port.

## 7. Trust model recovered from code

**Trusted inputs/components:** root/source code checked out from the base branch in `submission-check.yml`; npm lockfile/dependencies there; reviewer YAML supplied to the review CLI or M5 CLI; service-issued execution context; M4 review filesystem only when every record validates and comes from allowlisted numeric reviewer IDs; configured storage owner allowlist; GitHub App credentials when configured.

**Untrusted inputs:** submission YAML, upstream repository metadata/source/archive/plugin.yml/composer.json/PHP files, archive names/content, review evidence passed at runtime, serialized materialization plans, and test transport environment configuration until validation.

**Validation boundaries:** submission strict schema before GitHub use; GitHub-only archive URL/redirect checks; ZIP path/symlink/size/count/depth checks; bounded YAML/JSON/plugin parsing; review identity/record/config checks; registry strict schemas; M5 plan equality against live trusted state and fresh exact archive.

**Verification implemented:** branch resolves to an exact SHA before M3 source acquisition; M5 verifies that exact commit exists and archives it by SHA; M5 records archive SHA-256 and canonical-tree SHA-256; M5 conditional commits use expected parent SHA; M5 recognizes repeat materialization only when provenance and every source file match. Registry verifies record formatting/provenance fields but does not query external GitHub, storage, or artifacts. Artifact checksum generation exists only as a workflow outline step.

**Immutability implemented:** registry types make post-publication provenance required; validators enforce record shape but cannot detect Git history mutation. Review decisions are non-overwriting per decision ID; candidate metadata itself is written with ordinary `writeFileSync` and may be overwritten. Materialization refuses differing canonical provenance/source, uses immutable source paths keyed by materialization ID, and refuses to overwrite local provenance cache records with different bytes. GitHub release immutability is not implemented.

## 8. Implemented invariants

- A persisted registry identity/version record must declare schema version 1 and match its strict status-specific schema.
- A submission proposal cannot include registry/review/storage/artifact/status fields because its Zod schema is strict.
- Review identity always includes exact 40-hex SHA; M4 approval resolution rejects records whose identity fields or reviewer authorization do not agree.
- The latest decision under timestamp/decision-ID ordering determines effective review state; duplicate same-decision/same-reviewer writes are refused by `ReviewManager`.
- M5 plans cannot authorize mutation; only a matching fresh plan plus opaque service-issued context and write-enabled client permits `executePlan`.
- M5 source acquisition accepts only the approved exact SHA, not branch/release fallback.
- M5 archive processing rejects unsafe paths, symlinks, limit violations, and duplicate normalized paths; it derives integrity from deterministic byte ordering.
- Existing materialized source bytes are never changed during reconciliation; provenance mismatch is a conflict.
- Tester transport rejects named production organizations before checking its allowlist.

## 9. Integration points

| Boundary | Interaction |
|---|---|
| GitHub REST (submission) | repository, branch, commit, tree, file-content and ZIP archive URL/read operations. |
| GitHub REST (materialization) | read commits/archives/trees and create/reconcile private storage repositories and conditional commits through the real client. |
| GitHub App | JWT signed with a private key; installation access tokens and installation discovery in `github-app-auth.ts`. |
| GitHub Actions | pull-request submission check; two incomplete validation/build workflows. |
| Filesystem | temporary M3 extraction; review YAML store; registry YAML tree; optional materialization provenance cache. |
| YAML/JSON | `yaml` parses submission/review/registry data; JSON parses composer and provenance. |
| Registry/storage/artifacts/site | Registry filesystem validation exists. Storage mutation exists in the service but is disabled by CLI. Artifact publication, registry generation, and website integration are absent. |

## 10. Testing architecture and verification results

Tests are grouped by `tests/submission`, `tests/review`, `tests/registry`, and `tests/materialization`; fixtures cover valid/invalid registry trees, archive attacks, mock GitHub behavior, and review-store data. Materialization tests use the in-memory GitHub adapter and fault injection to cover conditional-commit and reconciliation behavior. Submission tests use fake GitHub clients and generated archive fixtures. The test suite has no declared coverage script or coverage threshold, and no external live-GitHub integration suite was recovered.

Verification run during this recovery (with a host context that permits Node child processes): **23 test files, 529 tests passed**; `npm run typecheck` passed; `npm run registry:validate -- --json` passed and reported **0 plugins / 0 versions**. The sandbox-only initial test attempt failed before collecting tests with `spawn EPERM`; this was environmental, not a test assertion failure.

## 11. Implementation status

| Domain | Status | Evidence |
|---|---|---|
| Submission inspection library | 🟨 Mostly Complete | Complete orchestration, GitHub adapter, acquisition, static parsing/signals, tests; limits/diagnostic classification have visible gaps described below. |
| Submission CI workflow | 🟨 Mostly Complete | Implemented base-branch/least-privilege scope and inspection workflow; content request lacks the intended ref parameter. |
| Review core/storage | 🟨 Mostly Complete | Identities, authorization, append-only decisions, state derivation and precondition API are implemented and tested; CLI cannot supply persisted inspection evidence. |
| Registry model/validation | ✅ Complete | Strict schemas, parser, diagnostics, cross-record validation, CLI, fixtures and tests exist. It has no authoring/transition/materialization integration. |
| Materialization domain service | 🟨 Mostly Complete | Trust revalidation, exact archive integrity, reconciliation and ports are implemented/tested; repository CLI deliberately disables execute. |
| Real materialization transport/auth | 🟨 Mostly Complete | REST/GitHub App code exists and transport tests pass; no live external test configuration is present, and CLI write mode is disabled. |
| Trusted build, PHAR, publication | 🟥 Missing | Only `build-trusted.yml` scaffold and checksum command exist; all operational build/publish work is TODO. |
| Registry generation | 🟥 Missing | Root `generate` script explicitly says it is not implemented. |
| Website deployment/static site | 🟥 Missing | No website directory or deploy workflow exists. |
| Legacy `tools/validator` | 🟥 Missing | YAML parsing is an intentional placeholder that throws; no main code imports it. |

## 12. Unfinished work, stubs, and objectively visible technical debt

This section records observed implementation conditions, not proposed remedies.

- `package.json` has `generate: "echo \"registry-generator not yet implemented\""`; no registry-generation implementation exists.
- `tools/validator/src/index.ts` ends with a placeholder YAML parser that throws `YAML parser not implemented`; all `validatePluginYml` calls through that workspace fail at parsing.
- `src/cli/review.ts` prints that `request-changes` is not fully implemented; unlike its `ReviewManager` API, the CLI cannot write `CHANGES_REQUESTED`.
- The same review CLI makes `approve` unavailable in normal use: it passes `inspectionResult: null` to the fail-closed precondition checker, which requires an inspection result/evidence.
- `src/cli/materialize.ts` creates the transport with `writeEnabled: false` and deliberately rejects `execute`; only plan generation is reachable from that CLI.
- `.github/workflows/validate-submission.yml` and substantive jobs in `build-trusted.yml` are explicit TODO/STUB scripts. There are no build, release, publication, registry-generation, or website workflows.
- `submission-check.yml` records a PR head SHA but does not include it in its `gh api contents` request; the stated head-SHA-content relation is therefore not expressed by the command.
- `boundedDownload` reads the whole response through `response.arrayBuffer()` before assigning `bytesRead`; no byte-stream or `Content-Length` rejection compares the downloaded archive to `MAX_ARCHIVE_SIZE`. The configured limit is enforced later for extraction and M5 archives, but this M3 download path is not bounded during transfer as its name/comments imply.
- Submission inspection's early builder returns can leave required result subobjects unset at runtime (for example invalid submission file returns only status/diagnostics). The type assertion in `build()` masks this in TypeScript.
- `ReviewStorageManager.saveCandidateInfo` is not append-only and can overwrite candidate metadata, unlike decision persistence.
- Registry immutability is structural only: validation requires provenance fields for relevant status records but has no history comparison, Git signature verification, external commit verification, artifact download/checksum verification, or registry-signature verification.
- M5's source and provenance are committed in two separate conditional commits. The service handles source-only recovery, but the operation is not a single atomic Git mutation; this is visible in `executePlan`'s separate source/provenance commit branches.

## 13. Architectural assumptions supported by implementation

- GitHub is the only accepted M3 archive source (`api.github.com`, `codeload.github.com`, `github.com`) and the GitHub API is available to resolve repositories/branches/commits.
- A branch can be resolved once into a stable 40-character SHA for inspection; review/materialization identities use that SHA.
- Review storage and trusted reviewer configuration are available as local filesystem paths to the administrator/materializer process.
- Numeric GitHub reviewer IDs are stable and the reviewer configuration is trusted; login names are not authoritative.
- Registry state is a local YAML directory tree with exact conventional filenames and case-sensitive logical identifiers.
- A configured storage owner is both nonempty and present in the materializer allowlist; no production default owner exists.
- GitHub storage supports private repositories and optimistic conditional commits represented by `expectedParent`.
- A GitHub archive contains either a common top-level directory or paths suitable for canonical processing after the one-root stripping rule.
- Tester transport is only intended for `poggit-alternative-test`, and the named production organizations must never be targeted from it.
- No implementation evidence establishes assumptions for website hosting, external artifact consumers, release policy enforcement, or publisher credentials.

## 14. Repository knowledge graph

```text
Developer submission YAML (untrusted)
  -> Submission Inspector
       -> Submission GitHub adapter -> GitHub repository/branch/commit/archive (untrusted)
       -> safe ZIP/temp filesystem -> plugin.yml, composer.json, PHP signals
       -> SubmissionInspectionResult
            -> optional inspect CLI registration
                 -> Review candidate YAML + decisions/ (filesystem)
                      -> ReviewerAuthorizer <- config/reviewers.yaml
                      -> effective latest decision
                           -> FileM4ApprovalStore
                                -> MaterializationService
                                     -> exact GitHub archive + canonical tree hashes
                                     -> MaterializationPlan (preview)
                                     -> [service execution only] Materialization GitHub adapter
                                          -> private storage repository
                                               -> immutable materialized source
                                               -> canonical provenance JSON

Registry filesystem YAML
  -> Registry parser/validator -> diagnostics -> registry validation CLI

GitHub PR
  -> submission-check.yml -> trusted-base submission inspector
```

## 15. Completion report

**Already implemented:** source-faithful submission inspection, review data model and append-only decision persistence, registry schema/parser/validator, a tested materialization service with explicit ports, GitHub adapters/auth code, CLI interfaces, and a submission-check CI workflow. The present test suite and type check pass.

**Partially implemented:** live review operation (registration exists but CLI approval lacks evidence injection), CI exact-head submission fetch, materialization operational use (service supports writes but shipped CLI intentionally does not), and GitHub Actions trusted build definition.

**Missing:** registry generation, an executable PHAR build pipeline, artifact publication/release management, artifact and registry verification, website/static-site deployment, and a functional legacy workspace validator YAML parser.

**Unable to determine from implementation:** actual GitHub organization/repository configuration, whether GitHub App credentials/installation permissions are deployed, production storage contents, deployed CI results, release retention/immutability settings, website hosting, and any external consumer API.
