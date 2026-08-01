# Publication Domain Recovery

## Scope and evidence

No publication workflow or source module exists in the repository. `.github/CODEOWNERS` names `.github/workflows/publish-release.yml`, but that file is absent. This reconstruction therefore uses the existing registry lifecycle/schema, README, submission template, and the documented publication architecture. The result is an intended domain model, not an implemented publisher.

## Responsibility

The Publication domain is intended to receive verified Build-domain artifacts, verify their integrity and provenance without executing plugin code, create a GitHub Release in the storage organization, and record the artifact provenance in the canonical registry by transitioning the version to `published`.

It is a privileged domain separated from Build. The documentation describes it as having publication credentials and release-write capability while being prohibited from plugin-code execution and build operations.

## Existing lifecycle contract

Publication is the only existing domain with a concrete persisted output contract: the registry's `published` version record.

```text
approved -> materialized -> published -> deprecated -> revoked -> removed
```

The transition table in `src/registry/types.ts` permits only `materialized -> published` for the publication step. A published record is a strict, schema-version-1 document requiring:

```yaml
schema_version: 1
version: <semver>
source:
  upstream_commit: <40 lowercase hex SHA>
review:
  pull_request: <positive integer>
  reviewer: <non-empty string>
  approved_at: <timestamp>
storage:
  repository: <non-empty repository>
  commit: <40 lowercase hex SHA>
artifact:
  release_tag: v<semver>
  file: <non-empty PHAR filename>
  sha256: <64 lowercase hex SHA-256>
  published_at: <timestamp>
status: published
```

`schemas/version.schema.json` and `src/registry/schema.ts` enforce this structure. The registry validator also checks the filename/version match, release-tag format, checksum shape, and timestamps. It does not create a release, fetch an artifact, or verify an external GitHub release.

## Intended workflow model

`docs/ARCHITECTURE.md` names the intended workflow `publish-release.yml`; no such executable file is present. The documented sequence is:

1. Receive Build-domain PHAR, checksum manifest, metadata, and provenance input from GitHub Actions artifacts.
2. Verify the PHAR SHA-256 against the checksum, parse metadata as valid JSON, and require complete provenance information.
3. Create a draft GitHub Release with tag `v{version}`, name `{Plugin} v{version}`, and generated release notes.
4. Upload the PHAR, `checksums.txt`, and `metadata.json` as release assets.
5. Create a GitHub artifact attestation when supported, using source, commit, build/workflow, and artifact digest provenance.
6. Publish the release as immutable where supported and verify it is final.
7. Update `versions/{version}.yaml` with the artifact fields and `status: published`.

None of these steps exists as a checked-in workflow command, TypeScript operation, GitHub adapter call, or test.

## Intended domain model

| Item | Reconstructed meaning | Repository evidence |
|---|---|---|
| Publication request | Plugin ID/name and SemVer identifying a materialized registry version | Documented workflow dispatch model and registry version identity. |
| Verified artifact set | PHAR, SHA-256/checksum manifest, metadata JSON, and source/build provenance | Build/Publication documentation; current Build workflow emits only PHAR/checksum artifact paths. |
| Release identity | `v{version}` tag, `{Plugin} v{version}` release name, release notes | Documentation and registry `artifact.release_tag` validation. |
| Release assets | PHAR, `checksums.txt`, `metadata.json` | Documentation. |
| Artifact provenance | exact upstream commit, storage commit/repository, build workflow/run identity, artifact digest | Materialization provenance model and documented attestation example. |
| Published registry version | Existing materialized record enriched with artifact reference and changed to `published` | Strict registry schema and `VALID_TRANSITIONS`. |
| Later lifecycle records | `deprecated`, `revoked`, and `removed` preserve artifact provenance | Registry types/schema. |

The only concrete data shapes are `ArtifactRef` and `PublishedVersion`; no publication request, release asset, checksum manifest, metadata, or attestation TypeScript interface is implemented.

## Inputs and outputs

### Intended inputs

- a `materialized` registry version record, including exact upstream source, review, and storage provenance;
- Build-domain PHAR and SHA-256 checksum manifest;
- documented build metadata JSON and provenance/attestation material;
- repository/release identity and short-lived GitHub App publication credentials.

The input transfer is intended to use GitHub Actions artifacts. The Build workflow names PHAR and checksum artifacts, but it does not produce metadata/provenance artifacts and no publisher downloads any artifacts.

### Intended outputs

- a draft then final GitHub Release on the storage/plugin repository;
- release assets: PHAR, checksums, and metadata;
- optional GitHub artifact attestation;
- a strict `published` registry version record with `artifact.release_tag`, `artifact.file`, `artifact.sha256`, and `artifact.published_at`;
- externally discoverable artifact provenance for downstream registry/website consumers.

No source code implements an output write. The current `registry/` directory has no live version record.

## Invariants and constraints

### Persisted invariants implemented by the registry

- Only a `materialized` version may transition to `published` according to `canTransition`.
- Published, deprecated, revoked, and removed records require source, storage, review, and artifact provenance.
- `release_tag` must begin with `v` and contain a supported registry SemVer form.
- `artifact.sha256` must be exactly 64 lowercase hexadecimal characters.
- The published version filename must equal its `version` field.
- Revoked/removed records preserve complete artifact provenance and add their timestamp; `removed` has no successor state.

These are shape and transition-table invariants. No existing code enforces a GitHub release's immutability, confirms release assets, prevents registry-file rewrites across Git history, or verifies that a checksum corresponds to an uploaded PHAR.

### Intended/documented invariants not implemented

- Publisher must not execute plugin code or perform build operations.
- Artifact checksum must match before release creation/publication.
- Metadata and provenance must be valid/complete before publication.
- Build and Publication must remain distinct privilege domains: Build cannot publish; Publisher has only publication capability.
- The release is intended to begin as draft, receive assets, be verified, then become immutable/final.
- Once published, provenance fields must not be silently replaced; a correction is documented as a new release rather than modification of the existing release.
- Published artifacts belong in GitHub Releases, not the storage repository Git tree; PHAR files must not be committed to that Git tree.

## Trust and privilege boundary

```text
Build-domain Actions artifacts
  (PHAR + checksum + intended metadata/provenance)
      -> privileged Publication boundary
           -> verify bytes and provenance without plugin execution
           -> GitHub Release and optional attestation
           -> canonical published registry record
```

The documentation names publisher credentials as a GitHub App ID/private key and a short-lived installation token, with release-write, package-write, and optional attestation-write permissions. It also names `publish-release.yml` as security-team owned in CODEOWNERS. There is no checked-in GitHub App composition for publication and no source-level secret handling.

The `build-trusted.yml` header says it has publication secrets, but the intended boundary elsewhere says the opposite and the workflow contains no secret mapping. This conflict is present in repository sources; deployed permissions cannot be determined from implementation.

## Integration points

| Boundary | Intended interaction | Current implementation |
|---|---|---|
| Build domain | Download verified Actions artifacts | No publisher workflow or downloader. |
| GitHub Releases | Create draft/final release and upload assets | No release API/client/workflow call. |
| GitHub attestation service | Attest artifact provenance when supported | No attestation action; Build workflow only declares an attestations permission. |
| Registry | Persist artifact reference and status transition to `published` | Schemas/validators enforce the resulting shape; no writer or transition service exists. |
| Storage repository | Release host and source provenance reference | Materialization can create/preserve source; no publication adapter consumes it. |
| Website/discovery | Intended to expose published/revoked state | No website directory/deployment/integration exists. |

## Test and implementation status

No publication tests or fixtures were found. Registry schema/type/validator tests exercise `published`, `deprecated`, `revoked`, and `removed` record shapes and transition predicates. Materialization tests exercise source/provenance preservation before the publication boundary. They do not create releases, upload assets, calculate/verify PHAR checksums, emit attestations, or write published registry records.

**Status: Missing as an executable domain.** Publication's registry representation and lifecycle preconditions are implemented, but the publisher workflow, release adapter, artifact validation, attestation, registry writer, and integration tests do not exist.

## Unable to determine from implementation

- the actual release repository selection and whether it is always the materialization storage repository;
- concrete credentials, GitHub App installation permissions, or environment variable names used in deployment;
- the exact publisher trigger and how it receives a build identity or artifact names;
- the atomicity/ordering between a final GitHub Release and a registry `published` record;
- the canonical metadata JSON and attestation schema, or whether attestations are enabled for private releases;
- release-note content, asset naming rules beyond the documented examples, retention policy, and website-consumption mechanism.
