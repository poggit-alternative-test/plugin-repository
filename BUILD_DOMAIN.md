# Build Domain Recovery

## Scope and evidence

This document reconstructs the Build domain from the checked-in implementation. Its executable artifact is [`.github/workflows/build-trusted.yml`](.github/workflows/build-trusted.yml). The domain's intended boundaries and missing stages are described in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SECURITY.md`](docs/SECURITY.md), and [`docs/SUBMISSION.md`](docs/SUBMISSION.md). No Build-domain TypeScript service, schema, CLI, or tests were found.

The workflow is incomplete. “Intended” below means documented or expressed as a workflow TODO; it does not describe a completed operation.

## Responsibility

The Build domain is intended to turn a materialized, exact approved source revision into a PHAR and a verified build-artifact set. It sits after storage materialization and before privileged publication.

Its security boundary is unprivileged but hostile processing: the documented model permits plugin code to be processed/built in an isolated runner, while withholding publication credentials and storage-write capability. The output is an artifact handoff, not a GitHub Release and not a registry mutation.

## Implemented workflow model

`Build Trusted PHAR` triggers on:

- a push to `main` that changes `registry/plugins/*.yaml`; or
- manual dispatch with `plugin_name` and `version` inputs.

It declares `contents: read`, `actions: read/write`, and `attestations: write`, and serializes executions with `build-${{ github.event.inputs.plugin_name || 'manual' }}`. It sets `ACTIONS_ALLOW_UNSECURE_COMMANDS=false`.

The implemented job dependency graph is:

```text
read-registry
  -> checkout-approved-sha
  -> validate-source
  -> build-phar
  -> checksums
  -> build-summary
```

### `read-registry`

This job declares outputs for plugin name, version, approved SHA, and repository. Its checkout is implemented. Extraction and validation are currently shell `echo` TODOs, so no output is actually assigned through `$GITHUB_OUTPUT` and no registry record is parsed.

The comments express the intended input as an approved SHA and repository read from a changed registry entry. The current registry schema represents the relevant persisted lifecycle data as:

```text
Materialized version
  version
  source.upstream_commit
  review
  storage.repository
  storage.commit
  status: materialized
```

The workflow’s placeholder refers to `approved_sha` and repository fields rather than this currently implemented `storage.commit` representation. The exact mapping cannot be determined from executable implementation.

### `checkout-approved-sha`

This job checks out `needs.read-registry.outputs.approved_sha` at depth one. It runs `git rev-parse HEAD` and fails if the actual checkout SHA differs from the expected SHA. On success it exposes `actual_sha` as a job output.

This exact-equality comparison is implemented, but it presently depends on the unset upstream job output described above.

### `validate-source`

The job checks out the same `approved_sha`. Its revalidation of `plugin.yml` and security rescan are TODO commands. The existing submission inspection library can parse `plugin.yml` and produce review signals, but the workflow does not invoke it here.

### `build-phar`

The job checks out the same `approved_sha`, installs PHP 8.2 with `actions/setup-php@v4`, and contains placeholder commands for:

- Composer dependency installation without arbitrary plugin scripts;
- PHAR construction using an Axolotl-controlled builder rather than developer-controlled scripts;
- PHAR contents verification.

The implemented upload step uploads `build/*.phar` as a GitHub Actions artifact named `phar-{plugin_name}-{version}`, retained for 30 days. No workflow step creates `build/*.phar`, so this upload has no produced PHAR under the current workflow.

### `checksums`

This job downloads the named Actions artifact, runs `sha256sum *.phar > checksums.txt`, exports the first checksum to its step output, and uploads `checksums.txt` as `checksums-{plugin_name}-{version}` for 30 days. This checksum operation is implemented, subject to a PHAR artifact and naming outputs actually existing.

### `build-summary`

Runs regardless of earlier results and reports the workflow input-derived plugin/version, expected approved SHA, actual checkout SHA, and a shell equality result. It does not persist any result.

## Intended domain model

The architecture documents identify the following entities and value data. They are not implemented as Build-domain classes or schemas.

| Item | Reconstructed meaning | Source relationship |
|---|---|---|
| Build request | Plugin identifier/name, version, exact approved/storage SHA, and source repository | Workflow dispatch inputs and `read-registry` outputs. |
| Build source | Materialized source in `axolotl-pm-pl/{plugin}` at an exact preserved commit | Materialization service produces immutable source and provenance; docs specify storage as build source. |
| Source provenance | Upstream approved SHA, storage repository/commit, review linkage, materialization integrity | `ProvenanceRecord` in `src/materialization/materialization-types.ts`. |
| PHAR | The built plugin archive; must be an Actions artifact before publication, not a Git-tree file | Workflow upload and docs. |
| Checksum manifest | `checksums.txt` containing SHA-256 for the PHAR | Implemented `checksums` job. |
| Build metadata | Intended JSON record containing version, API, checksums, and provenance | Documentation only; no format/schema or generation exists. |
| Attestation/provenance handoff | Intended provenance for an artifact attestation | Workflow has `attestations: write`; no attestation step is implemented. |

### Intended inputs

The combined workflow, registry, materialization, and documentation evidence identifies:

- plugin name or ID and a semantic version;
- an exact expected source/storage commit SHA, never a branch head;
- storage repository identity;
- preserved source tree and materialization provenance;
- trusted Axolotl build tooling and PHP 8.2;
- plugin metadata (`plugin.yml`) and, when present, Composer dependency metadata.

Only workflow-dispatch plugin name/version, path-trigger metadata, and checkout action inputs are concrete workflow inputs today. No concrete parser connects a materialized registry record or `ProvenanceRecord` to this workflow.

### Intended outputs

- one PHAR in `build/*.phar`;
- `checksums.txt`, containing a SHA-256 checksum;
- an Actions artifact for the PHAR and a separate Actions artifact for checksums, each with 30-day retention;
- documented but unimplemented `metadata.json` and provenance/attestation input;
- a handoff to the Publication domain.

The intended model explicitly excludes GitHub Release creation from Build.

## Invariants and constraints

### Implemented constraints

- The checkout job fails when `git rev-parse HEAD` differs from the workflow’s expected SHA.
- All downstream build jobs use the same `approved_sha` output as their checkout ref.
- Build runs for a single manual plugin-name group at a time; new runs cancel in-progress runs in the same group.
- Actions artifacts are named with the plugin and version output and retained for 30 days.
- Build does not call a release-creation action and contains no executable registry-write step.

### Intended/documented constraints not yet implemented

- Build source is the Axolotl storage repository, never upstream or a moving branch.
- Build must have no publication credentials, organization secrets, PAT, release-write capability, or storage mutation capability.
- Composer is intended to run with `--no-dev --no-scripts --no-plugins`; developer-controlled scripts and plugins are not intended to run.
- PHAR construction is intended to use an Axolotl-controlled builder script, exclude `.git`, `.github`, `vendor`, and CI files, and include `src/`, `resources/`, and `plugin.yml`.
- Verification is intended to reject PHARs containing Git data, symlinks, path traversal, secrets/credentials, or unexpected files.
- The Build domain must calculate a SHA-256 after construction and must not upload directly to a GitHub Release.
- The exact source SHA is intended to be revalidated even if earlier validation passed.

The workflow header says it “Has publication secrets,” which conflicts with its declared permissions and the documentation’s separation rule. No `secrets:` mapping exists in the workflow. Whether any repository/organization secret is actually exposed cannot be determined from the repository.

## Integration points

```text
Registry (materialized version record)          [intended source selection]
  -> Build Trusted PHAR workflow
       -> Git checkout at exact SHA             [implemented comparison]
       -> PHP 8.2                               [implemented setup]
       -> Composer / controlled PHAR builder    [TODO]
       -> PHAR verification                     [TODO]
       -> GitHub Actions artifact store         [implemented upload/download]
       -> SHA-256 checksums                     [implemented command]
       -> Publication domain                    [intended; no workflow link]

Materialization service
  -> private storage repository + provenance    [implemented independently]
  -> Build source/provenance input              [intended; no direct adapter]
```

The materialization service is capable of preserving an exact source tree and canonical provenance in private storage, but no Build code consumes `MaterializationPlan` or `ProvenanceRecord`. The registry validator recognizes `materialized` and `published` records but does not trigger workflows or verify a built artifact.

## Test and implementation status

No build-specific tests, build fixture, PHAR builder implementation, Composer invocation, artifact metadata generator, or published-release test was found. `tests/materialization` verifies preservation and provenance up to the build boundary; `tests/registry` verifies shapes that Build/Publication would later consume.

**Status: Partial.** The workflow topology, SHA checkout comparison, Actions artifact transfer, and checksum command exist. The domain’s source selection, validation, dependency installation, PHAR construction, content verification, metadata/provenance emission, and publication handoff are not implemented.

## Unable to determine from implementation

- the exact registry-to-workflow selection algorithm for changed nested version records;
- whether source should be checked out from a storage repository or another repository under the current workflow’s `actions/checkout` defaults;
- the canonical PHAR filename and metadata JSON schema;
- the actual controlled PHAR-builder script, its input layout, and build reproducibility guarantees;
- whether a GitHub attestation is emitted or how it is transferred to publication;
- deployed GitHub secret availability or runner isolation configuration.
