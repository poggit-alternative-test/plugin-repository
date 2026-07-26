# Axolotl Plugin Repository — Architecture

**Version:** 3.2.0
**Status:** Draft for Review
**Last Updated:** 2026-07-25

---

## Table of Contents

1. [Overview](#overview)
2. [Organizations](#organizations)
3. [Trust Model](#trust-model)
4. [Final Architecture Diagram](#final-architecture-diagram)
5. [Registry Structure](#registry-structure)
6. [Plugin Lifecycle](#plugin-lifecycle)
7. [Submission Flow](#submission-flow)
8. [Storage Strategy](#storage-strategy)
9. [Build Pipeline](#build-pipeline)
10. [Publication Pipeline](#publication-pipeline)
11. [Artifact Attestations](#artifact-attestations)
12. [Incident Policy](#incident-policy)
13. [Organization Security](#organization-security)
14. [Workflow Permissions](#workflow-permissions)
15. [Technology Choices](#technology-choices)
16. [Unresolved Decisions](#unresolved-decisions)

---

## Overview

The Axolotl Plugin Repository is a GitHub-native plugin distribution system for the PocketMine-MP ecosystem. It provides:

- **Submission**: Developer-driven plugin submission via Pull Requests
- **Validation**: Automated security and quality checks via GitHub Actions
- **Review**: Mandatory human review of exact upstream commits
- **Storage**: Axolotl-controlled preservation of approved commits
- **Build**: Isolated PHAR construction without publication credentials
- **Publication**: Privileged release creation with immutable artifacts
- **Discovery**: Static website generated from declarative registry

**Key Principle**: Trust must be explicit, traceable, and minimal. Human review reduces risk; it does not eliminate it.

---

## Organizations

### axolotl-pm (Main Organization)

**Purpose**: Core infrastructure, tooling, and coordination.

**Contains**:
- Plugin registry (`axolotl-pm/axolotl-plugin-repository`)
- Validation tooling
- Trusted builder tooling
- Website source
- Documentation
- CI/CD infrastructure

**Access Model**:
- Project maintainers and reviewers
- GitHub App for automation
- No routine access to plugin storage

### axolotl-pm-pl (Plugin Storage Organization)

**Purpose**: Trusted storage and distribution of approved plugins.

**Contains**:
- Approved plugin storage repositories
- Preserved reviewed source commits
- Trusted GitHub Releases
- Trusted PHAR artifacts

**Access Model**:
- **NOT** granted to plugin developers merely because their plugin is stored
- Automation via GitHub App with minimal permissions
- Strict organization settings (see [Organization Security](#organization-security))

### Organization Responsibilities Matrix

| Responsibility | axolotl-pm | axolotl-pm-pl |
|---------------|-------------|----------------|
| Registry | Primary owner | None |
| Validation | Primary owner | None |
| Build tooling | Primary owner | None |
| Plugin storage | None | Primary owner |
| Releases | None | Primary owner |
| Website | Primary owner | None |
| Reviewers | Assigned | None |
| Publishers | None | Automation only |

---

## Trust Model

### Trust Level Definitions

#### UNTRUSTED SOURCE

**Definition**: Developer-controlled upstream repository.

**Characteristics**:
- Owned and controlled by plugin developer
- Can be modified at any time by developer
- Subject to compromise without Axolotl knowledge
- Must never be used as direct build source

#### REVIEWED / APPROVED SOURCE

**Definition**: Exact upstream commit that passed automated validation and human review.

**Characteristics**:
- Reviewed at a specific point in time
- Approved for distribution eligibility
- Still processed with hostility during build (no execution trust)
- Recorded as immutable trust record

**Important**: Human review reduces risk. It does NOT make the code mathematically safe to execute. Reviewers find policy-blocking or malicious behavior; they cannot prove absence.

#### AXOLOTL-CONTROLLED STORAGE

**Definition**: Repository in `axolotl-pm-pl` containing preserved approved commits.

**Characteristics**:
- Axolotl controls mutation (not developer)
- Contains only explicitly imported approved commits
- Does NOT auto-sync from upstream
- Provides preservation guarantees

**Important**: The repository itself is controlled, but plugin source code inside is NOT automatically safe to execute. It is processed with the same hostility as any plugin.

#### VERIFIED ARTIFACT

**Definition**: PHAR produced by Axolotl-controlled build from exact approved source commit.

**Characteristics**:
- Provenance is verified (source, commit, build process)
- Binary is reproducible from source
- Immutable after publication

**Important**: Provenance verification proves where the artifact came from. It does NOT prove the plugin is secure or benign.

### Trust Terminology Comparison

| Old Terminology | New Terminology | Meaning |
|----------------|-----------------|---------|
| Trusted source | Reviewed/Approved source | Eligible for distribution, not proven safe |
| Trusted build | Verified artifact | Provenance established, safety not proven |
| Trusted fork | Axolotl-controlled storage | Repository controlled, code still hostile |

---

## Final Architecture Diagram

```
DEVELOPER
    |
    v
UPSTREAM REPOSITORY (UNTRUSTED)
    |
    | submission
    v
REGISTRY PR
    |
    v
AUTOMATED VALIDATION (no secrets)
    |
    v
HUMAN REVIEW (exact SHA)
    |
    v
APPROVED SOURCE SHA (eligible for storage)
    |
    v
STORAGE MATERIALIZATION
axolotl-pm-pl/<plugin>
    |
    | preserve exact reviewed source
    v
UNPRIVILEGED BUILD (NO publication credentials)
    |
    +--> PHAR
    +--> SHA-256
    +--> metadata
    +--> provenance/attestation
    |
    v
TRUST BOUNDARY
    |
    v
PRIVILEGED PUBLISHER (no plugin code execution)
    |
    v
IMMUTABLE GITHUB RELEASE
axolotl-pm-pl/<plugin>
    |
    v
VERSION REGISTRY RECORD
    |
    v
STATIC SITE GENERATION
    |
    v
GITHUB PAGES
```

### Security Domain Separation

```
+-------------------------------------------------------------------+
|                     UNTRUSTED DOMAIN                              |
|                                                                   |
|  Developer Upstream Repository                                    |
|  - Can push anytime                                             |
|  - Subject to compromise                                        |
|  - Never directly built from                                   |
|                                                                   |
+-------------------------------------------------------------------+
                                |
                                | Submission PR
                                v
+-------------------------------------------------------------------+
|                    VALIDATION DOMAIN                              |
|                                                                   |
|  validate-submission.yml                                        |
|  - Read-only access                                             |
|  - No secrets                                                   |
|  - Cannot write anywhere                                        |
|                                                                   |
+-------------------------------------------------------------------+
                                |
                                | Approval
                                v
+-------------------------------------------------------------------+
|                   APPROVAL DOMAIN                                 |
|                                                                   |
|  Human review of exact SHA                                      |
|  - SHA recorded as "eligible"                                   |
|  - NOT yet materialized                                         |
|                                                                   |
+-------------------------------------------------------------------+
                                |
                                | Storage materialization
                                v
+-------------------------------------------------------------------+
|                  STORAGE DOMAIN (axolotl-pm-pl)                  |
|                                                                   |
|  Preserved approved commits                                      |
|  - Axolotl-controlled                                          |
|  - No auto-sync from upstream                                   |
|  - Read-only for build                                         |
|                                                                   |
+-------------------------------------------------------------------+
                                |
                                | Build artifacts
                                v
+-------------------------------------------------------------------+
|                   BUILD DOMAIN (UNPRIVILEGED)                     |
|                                                                   |
|  build-trusted.yml                                              |
|  - NO publication credentials                                   |
|  - NO organization secrets                                      |
|  - NO PAT                                                       |
|  - Produces artifacts only                                      |
|                                                                   |
+-------------------------------------------------------------------+
                                |
                                | Verified artifacts
                                v
+-------------------------------------------------------------------+
|                PUBLICATION DOMAIN (PRIVILEGED)                     |
|                                                                   |
|  publish-release.yml                                            |
|  - Has publication credentials                                   |
|  - NO plugin code execution                                     |
|  - NO build operations                                         |
|  - Creates releases only                                       |
|                                                                   |
+-------------------------------------------------------------------+
                                |
                                | Immutable release
                                v
+-------------------------------------------------------------------+
|                    PUBLISHED DOMAIN                               |
|                                                                   |
|  GitHub Releases (axolotl-pm-pl)                                |
|  - Immutable where supported                                    |
|  - Provenance verified                                          |
|  - User downloads                                               |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## Registry Structure

### Design Goals

The registry must be:

1. **Declarative**: Describes intent, not CI runtime state
2. **Immutable provenance**: Approved source and review records do not change
3. **Minimal merge conflicts**: No concurrent modification of same data
4. **Static-site friendly**: Easy to generate website data
5. **Auditable**: Clear history of decisions
6. **Schema-evolvable**: Support future schema changes

### Structure

```
registry/
└── plugins/
    └── {plugin-id}/
        ├── plugin.yaml           # Plugin identity
        └── versions/
            ├── 2.0.0.yaml       # Version record
            └── 2.1.0.yaml
```

### Plugin Identity (`plugin.yaml`)

```yaml
schema_version: 1

id: topstats
# Stable identifier for this plugin

upstream:
  repository: nicholass003/TopStats
  branch: main
  # May also include explicit reference for precise versioning

storage:
  repository: axolotl-pm-pl/TopStats
  # Computed name following naming strategy
```

### Version Record (`versions/{version}.yaml`)

```yaml
schema_version: 1

version: 2.1.0
# Semantic version being recorded

source:
  upstream_commit: b93f1e987654321abcdef123456789abcdef1234
  # Exact SHA reviewed by human

storage:
  commit: b93f1e987654321abcdef123456789abcdef1234
  # SHA as preserved in axolotl-pm-pl storage
  # Recorded AFTER successful storage materialization

review:
  pull_request: 58
  reviewer: axolotl-reviewer
  approved_at: 2026-08-05T09:15:00Z
  # When human review approved this exact SHA

artifact:
  release_tag: v2.1.0
  file: TopStats.phar
  sha256: a1b2c3d4e5f6...
  published_at: 2026-08-05T10:00:00Z
  # Populated AFTER successful publication

status: published
# published | deprecated | revoked | removed
```

### State Transitions

```
pending_submission
    |
    v
pending_validation --> [fails] --> validation_failed
    |
    v
pending_review --> [fails] --> review_failed
    |
    v
approved (eligible for storage)
    |
    v
storage_materializing
    |
    v
storage_materialized (commit recorded)
    |
    v
build_pending
    |
    v
build_complete
    |
    v
publish_pending
    |
    v
published --> deprecated --> revoked --> removed
```

### What Belongs in Registry vs GitHub State

| Data | Registry | GitHub |
|------|----------|--------|
| Plugin identity | Yes | No |
| Version records | Yes | No |
| Review decisions | Yes | Reference |
| Approval SHA | Yes | No |
| Storage commit | Yes | No |
| Publication artifacts | Yes | Reference |
| CI validation status | No | Yes |
| PR state | No | Yes |
| Workflow runs | No | Yes |
| Labels | No | Yes |

**Principle**: Registry stores immutable provenance records. GitHub state stores transient operational data.

---

## Plugin Lifecycle

### Detailed Lifecycle with State Separation

```
DEVELOPER UPSTREAM
    |
    | Developer creates submission PR
    v
SUBMITTED
    |
    | Automated validation runs
    v
VALIDATING
    |
    +--> FAIL --> BLOCKED (fix needed, new validation required)
    |
    v
READY_FOR_REVIEW
    |
    | Human reviews exact upstream SHA
    v
REVIEW_IN_PROGRESS
    |
    +--> CHANGES_REQUESTED --> Developer updates --> VALIDATING (again)
    |
    +--> REJECTED (final)
    |
    v
APPROVED
    |
    | SHA now eligible for storage materialization
    | (Fork/commit may not exist yet)
    v
APPROVAL_RECORDED
    |
    | Storage repository created/updated
    v
STORAGE_MATERIALIZING
    |
    | Approved SHA imported to axolotl-pm-pl
    | SHA verification
    v
STORAGE_MATERIALIZED
    |
    | Build job runs (no publication credentials)
    v
BUILDING
    |
    | Artifacts produced: PHAR, SHA-256, metadata
    v
BUILD_COMPLETE
    |
    | Publisher receives verified artifacts
    v
PUBLISHING
    |
    | Immutable release created
    v
PUBLISHED
    |
    | Version record finalized
    v
AVAILABLE
```

### Version Independence

Each version is independent:

```
TopStats v1.0.0
- SHA AAA reviewed
- published

TopStats v2.0.0
- NEW SHA BBB reviewed
- published

TopStats v2.1.0
- NEW SHA CCC reviewed
- published
```

**Critical**: New upstream versions do NOT automatically become trusted. Each requires:
1. New submission/update request
2. Automated validation
3. Human review of exact SHA
4. Approval
5. Storage materialization
6. Build
7. Publication

### Exact-SHA Approval Semantics

**Critical**: Approval of SHA AAA is independent from future commits on the branch.

```
main branch timeline:
AAA ---- BBB ---- CCC
|
+---- reviewed and approved for AAA

SHA AAA remains approved.
SHA BBB is NOT approved.
SHA CCC is NOT approved.

Approval is tied to the exact SHA, not the branch.
```

**What this means**:
- Developer pushes new commits after approval = fine
- Branch moves forward = fine
- Approval of AAA remains valid
- Only AAA can be built and published

**When does approval become invalid**:
- The submission itself changes its target source
- The reviewed source can no longer be verified/materialized
- Human reviewer explicitly revokes approval

**When does approval NOT become invalid**:
- Upstream receives new commits
- Branch advances
- Other developers push to the same repository

**Build verification**: System verifies it is building EXACTLY the approved SHA from Axolotl-controlled storage, not "the latest" or "HEAD". Upstream branch position is irrelevant after materialization.

### Progressive Provenance Immutability

Version records have **progressive** provenance immutability. Fields become immutable at specific lifecycle stages:

#### At `approved` (immutable from this point):
```
source provenance      → immutable
review provenance      → immutable
```

#### At `materialized` (additionally immutable):
```
storage provenance     → immutable
```

#### At `published` (additionally immutable):
```
artifact provenance     → immutable
```

#### After publication, lifecycle metadata may be appended:
```
status transitions:    published → deprecated → revoked → removed
lifecycle fields:      reason, revoked_at, removed_at
```

**Important**: Lifecycle metadata (reason, revoked_at, etc.) may be added after publication. This is different from modifying provenance. Provenance fields (source.upstream_commit, storage.commit, artifact.sha256, etc.) can NEVER change once their respective stage is reached.

### Approval Validity Rules

| Event | Before Materialization | After Materialization |
|-------|----------------------|----------------------|
| Developer pushes SHA BBB | YES (approval valid) | YES (approval valid) |
| Branch fast-forwards | YES (approval valid) | YES (approval valid) |
| Developer force-pushes | NO (AAA cannot be fetched) | YES (AAA preserved in storage) |
| Developer deletes branch | NO (AAA may be gc'd) | YES (AAA preserved in storage) |
| Submission PR modified | Evaluated case-by-case | Evaluated case-by-case |

**Critical**: Before materialization, force-pushes or branch deletion can remove the approved SHA from upstream. The version cannot proceed until the source can be materialized. This does NOT mean BBB becomes trusted - the version simply cannot advance until AAA is materialized or a new SHA is reviewed.

**After materialization**: The approved SHA exists in Axolotl-controlled storage. Upstream may advance, force-push, rename, delete the branch, or even disappear entirely. The preserved version remains buildable from storage.

---

## Submission Flow

### Developer Workflow

```
1. Fork axolotl-pm/axolotl-plugin-repository

2. Create registry entry:
   registry/plugins/{plugin-id}/plugin.yaml
   # Only contains identity info

3. Open Pull Request

4. CI determines exact source SHA from PR

5. Wait for validation

6. Wait for human review

7. If approved:
   - Approval recorded
   - Storage materialized
   - Build triggered
   - Release published

8. If changes requested:
   - Update upstream repository
   - Push to same branch
   - New validation + review cycle
```

### Submission Entry (Developer Provides)

```yaml
# registry/plugins/topstats/plugin.yaml
# Only identity - system derives everything else

upstream:
  repository: nicholass003/TopStats
  branch: main
```

**What is NOT required from developer**:
- Version number (derived from plugin.yml at reviewed SHA)
- API version (derived from plugin.yml)
- Author (derived from plugin.yml)
- Description (derived from plugin.yml)
- Commit SHA (determined by system)

### Validation Extracts

During validation, the system extracts and records:

```yaml
# Temporarily extracted, not stored in registry
- plugin name
- version
- API version
- main class
- author
- description
- exact commit SHA
```

---

## Storage Strategy

### Naming Strategy

**Preferred**: Direct plugin name if available.

```
developerA/TopStats  -->  axolotl-pm-pl/TopStats
```

**Fallback**: Owner-qualified name if collision.

```
developerB/TopStats  -->  axolotl-pm-pl/developerB-TopStats
```

**Naming Algorithm**:

```
1. Attempt: {plugin-name-from-plugin-yml}
2. If exists: {owner}-{plugin-name}
3. If exists: {owner}-{repo-id} (GitHub node ID hash)
```

**Stability Requirements**:
- Once published, storage name does NOT change
- If upstream renamed, storage keeps original name
- If upstream transferred, storage keeps original name
- Collision resolution uses first-come-first-served

### Native Fork vs Independent Mirror

**Current Preference**: Native GitHub fork where practical.

**Rationale**:
- Preserves "forked from" relationship
- Familiar GitHub semantics
- Easier provenance understanding
- Simpler initial implementation

**Potential Issues with Native Fork**:

| Issue | Impact | Mitigation |
|-------|--------|------------|
| Upstream deleted | Fork remains but orphaned | Acceptable, continue serving |
| Upstream made private | Fork may be affected | Monitor, consider mirror fallback |
| Fork network restrictions | GitHub limits fork depth | Monitor, mirror fallback |
| Cannot detach cleanly | May affect migration | Plan migration path |

**Fallback**: Independent mirror.

```
If native fork problematic:
1. Create NEW repository in axolotl-pm-pl (not fork)
2. Import approved commits as regular history
3. Store "upstream" reference explicitly
4. Maintain provenance records
```

**Decision**: Use native fork initially. Document mirror as fallback.

### Storage Repository Contents

The storage repository contains **Git source history**, not PHAR binaries.

```
axolotl-pm-pl/TopStats/
├── .git/                    # Source commit history
├── README.md                # Minimal, points to axolotl-pm registry
└── (source files at approved commits)
```

**GitHub Releases** contain the artifacts:

```
GitHub Release v2.0.0
├── TopStats.phar
├── checksums.txt
└── metadata.json

GitHub Release v2.1.0
├── TopStats.phar
├── checksums.txt
└── metadata.json
```

**Key distinction**:
- Git tree = preserved source commits
- GitHub Releases = PHAR artifacts

PHAR binaries MUST NOT be committed into the repository Git tree.

---

## Build Pipeline

### Unprivileged Build Job

**Critical Rule**: Build job has NO publication credentials.

```
build-trusted.yml
```

**Permissions**:
```yaml
permissions:
  contents: read  # Read from storage repository
  actions: write # Write build logs
  # NO contents: write
  # NO secrets
```

**Environment**:
- Fresh runner each time
- No cached dependencies with secrets
- No access to organization secrets
- No GitHub App token with write access

**Steps**:

```yaml
1. Checkout from axolotl-pm-pl storage
   - repository: axolotl-pm-pl/{plugin}
   - ref: {approved storage SHA}
   - fetch-depth: 1

2. Verify SHA matches expected

3. Validate plugin.yml

4. Install dependencies
   - composer install --no-dev --no-scripts --no-plugins
   - NO developer-controlled scripts

5. Build PHAR
   - Uses Axolotl-controlled builder script
   - Excludes: .git, .github, vendor, CI files
   - Includes: src/, resources/, plugin.yml

6. Verify PHAR contents
   - No .git directory
   - No symlinks
   - No path traversal

7. Generate checksums
   - SHA-256 of PHAR

8. Generate metadata
   - version, api, checksums, provenance

9. Upload artifacts
   - PHAR
   - checksums.txt
   - metadata.json
   - Do NOT upload to GitHub Release yet
```

### Composer Security

**Critical**: Composer must not execute developer scripts.

```bash
composer install \
  --no-dev \
  --no-scripts \
  --no-plugins \
  --prefer-dist \
  --optimize-autoloader
```

**Blocked Composer Features**:
- `composer scripts` (pre-install, post-install, etc.)
- `composer plugins`
- Custom scripts from plugin's composer.json
- Post-install/update hooks

**If plugin requires special build steps**:
- This is a future reviewed capability
- NOT enabled globally
- Requires explicit security review
- Disabled by default

---

## Publication Pipeline

### Privileged Publisher Job

**Critical Rule**: Publisher does NOT execute plugin code.

```
publish-release.yml
```

**Permissions**:
```yaml
permissions:
  contents: write       # Create release
  packages: write       # Upload packages
  attestations: write  # Create attestations (future)
```

**Secrets**:
- `PUBLISHER_APP_ID`: GitHub App ID
- `PUBLISHER_APP_PRIVATE_KEY`: GitHub App private key
- Repository installation token (short-lived, derived from App)

**Steps**:

```yaml
1. Receive verified artifacts from build
   - Download PHAR
   - Download checksums
   - Download metadata

2. Verify artifacts
   - SHA-256 matches checksum
   - Metadata is valid JSON
   - Provenance information complete

3. Create draft GitHub Release
   - tag: v{version}
   - name: {Plugin} v{version}
   - body: Auto-generated release notes

4. Upload release assets
   - {Plugin}.phar
   - checksums.txt
   - metadata.json

5. Create artifact attestation (if supported)
   - Provenance: source, commit, build, artifact

6. Publish immutable release
   - Enable immutable where supported
   - Verify release is final

7. Record to version registry
   - Update versions/{version}.yaml
   - Set status: published
```

### Trust Boundary

```
Build Output                    Publisher Input
+------------------------+    +------------------------+
| PHAR                   | -> | PHAR (verified)        |
| SHA-256                | -> | SHA-256 (verified)    |
| metadata.json          | -> | metadata.json          |
| provenance.json        | -> | (attestation created) |
+------------------------+    +------------------------+
      UNPRIVILEGED                   PRIVILEGED
```

**Enforcement**:
- Build cannot write to GitHub
- Publisher cannot run plugin code
- Artifacts verified before publication
- No man-in-middle possible (same runner/secure transfer)

---

## Artifact Attestations

### Purpose

Artifact attestations provide cryptographic provenance:

- Source repository
- Approved source commit
- Build repository
- Workflow identity
- Workflow run
- Artifact digest

### GitHub Artifact Attestations

If supported by GitHub:

```yaml
- name: Create attestation
  uses: actions/attest-build-provenance@v1
  with:
    subject-path: '{plugin}.phar'
    provenance-path: provenance.json
```

### Attestation Contents

```json
{
  "schema_version": 1,
  "type": "artifact-attestation",
  "source": {
    "repository": "nicholass003/TopStats",
    "commit": "b93f1e987654321..."
  },
  "storage": {
    "repository": "axolotl-pm-pl/TopStats",
    "commit": "b93f1e987654321..."
  },
  "build": {
    "repository": "axolotl-pm/axolotl-plugin-repository",
    "workflow": "build-trusted.yml",
    "run_id": "1234567890"
  },
  "artifact": {
    "digest": "sha256:a1b2c3d4..."
  }
}
```

### Attestation Limitations

**Attestation proves**:
- Where the binary came from
- That it was built by the claimed workflow
- That the commit existed at build time

**Attestation does NOT prove**:
- That the plugin is secure
- That the plugin is benign
- Absence of vulnerabilities
- Absence of malicious code

---

## Incident Policy

### Version States

```
published --> deprecated --> revoked --> removed
```

### State Definitions

| State | Description |
|-------|-------------|
| published | Available for download, recommended |
| deprecated | Available but not recommended, see newer version |
| revoked | Security concern identified, not recommended |
| removed | No longer available from registry |

### Revocation Process

```
1. Security issue discovered
   |
   v
2. Assess severity
   |
   +--> Critical (malware, RCE, etc.)
   |     |
   |     v
   |     - Remove from website discovery
   |     - Mark as revoked
   |     - Preserve release for investigation
   |     - Do NOT delete release (audit trail)
   |     - Consider whether binary should be accessible
   |
   v
3. Medium/Low severity
   |
   v
   - Deprecate version
   - Recommend newer version if available
   - Preserve release
```

### Release Deletion Policy

**Do NOT delete GitHub Releases** except:
- Legal requirements
- Contain actual malware requiring immediate removal

**Instead**:
- Mark as revoked in registry
- Remove from website discovery
- Preserve for audit/investigation
- Add prominent warning if accessed directly

**Rationale**:
- Deletion destroys audit trail
- May conflict with immutable release policies
- Users may have downloaded and need to verify
- Incident investigation requires preserved evidence

---

## Organization Security

### axolotl-pm-pl Security Baseline

```yaml
base_permissions: none
repository_creation: disabled
repository_deletion: restricted
visibility_changes: restricted
```

**Required Settings**:
- Base permissions: None
- Repository creation by members: Disabled
- Repository deletion: Requires owner approval
- Default branch protection: Enabled
- Immutable Releases: Enabled where supported

### Access Model

| Role | Access | Purpose |
|------|--------|---------|
| Publisher GitHub App | Repository write | Publication automation |
| Reviewers | None to storage | Review in main repo only |
| Builders | None to storage | Build reads from storage |
| Developers | None | Fork, submit, no storage access |

**Developers do NOT receive write access to axolotl-pm-pl merely because their plugin is stored there.**

### GitHub App Requirements

**Axolotl Publisher GitHub App**:

Permissions:
- Contents: Read (for builds)
- Releases: Write (for publication)
- Repository creation: Write (for storage materialization)
- Repository administration: Read

Installation:
- Installed on axolotl-pm (for workflow access)
- Installed on axolotl-pm-pl (for publication)

Token type:
- Short-lived installation access tokens
- NOT long-lived PATs in production

### PAT Usage (Development Only)

PATs may be used for:
- Local development testing
- Bootstrap scenarios

PATs should NOT be used for:
- Production workflows
- Publication automation
- Storage materialization

---

## Workflow Permissions

**Note**: The YAML examples below describe capability requirements. Actual GitHub Actions and GitHub App permissions MUST be verified against current GitHub documentation during implementation. Syntax may differ from shown examples.

### Capability Matrix

| Workflow | Execute Plugin Code | Can Publish | Can Mutate Storage | Has Secrets |
|----------|--------------------|-------------|-------------------|-------------|
| validate-submission.yml | No | No | No | None |
| build-trusted.yml | Yes (isolated) | No | No | None |
| materialize-storage.yml | No | No | Yes | App credentials |
| publish-release.yml | No | Yes | No | App credentials |

### Implementation Verification Required

During the milestone that implements each workflow, verify:

1. **validate-submission.yml**
   - Confirm `pull-requests: write` syntax
   - Verify no `secrets` needed
   - Confirm `statuses` permission if used

2. **build-trusted.yml**
   - Confirm minimum `contents: read`
   - Verify NO write permissions to any repo
   - Confirm no secrets required

3. **materialize-storage.yml**
   - Verify GitHub App permissions for repository creation
   - Confirm token scopes for fork operations

4. **publish-release.yml**
   - Verify GitHub App permissions for releases
   - Confirm attestation permissions if implemented

### Builder Principles (Remainder)

Builder MUST NOT have:
- Publication credentials
- Storage mutation access
- Broad organization permissions

Publisher MUST NOT have:
- Plugin code execution
- Build operation access

---

```yaml
name: Validate Plugin Submission
on:
  pull_request:
    paths:
      - 'registry/plugins/**'

permissions:
  contents: read
  pull-requests: write
  statuses: write

secrets: NONE

trusted: false
executes_plugin_code: false
```

### build-trusted.yml (Build)

```yaml
name: Build Trusted PHAR
on:
  workflow_dispatch:
    inputs:
      plugin_id: required
      version: required
      storage_sha: required

permissions:
  contents: read
  actions: write

secrets: NONE

trusted: false  # Executes plugin source
executes_plugin_code: true  # But isolated
```

### publish-release.yml (Publisher)

```yaml
name: Publish Release
on:
  workflow_dispatch:
    inputs:
      plugin_id: required
      version: required

permissions:
  contents: write
  releases: write
  attestations: write

secrets:
  PUBLISHER_APP_ID: required
  PUBLISHER_APP_PRIVATE_KEY: required

trusted: true  # Does NOT execute plugin code
executes_plugin_code: false
```

### Workflow Comparison

| Workflow | Plugin Code Exec | Secrets | Can Publish |
|----------|------------------|---------|-------------|
| validate-submission.yml | No | None | No |
| build-trusted.yml | Yes (isolated) | None | No |
| publish-release.yml | No | App credentials | Yes |

---

## Technology Choices

### TypeScript

- Type-safe tooling
- Shared validation logic
- Easy testing
- Familiar ecosystem

### Astro

- Zero-JS static output
- TypeScript support
- Markdown support
- GitHub Pages compatible

### YAML

- Human-readable registry
- Git-native
- Merge conflicts resolvable
- Schema evolvable

### GitHub Actions + GitHub App

- Native CI/CD
- Minimal custom infrastructure
- GitHub-native security model
- Short-lived tokens via GitHub App

---

## Unresolved Decisions

### 1. Immutable Releases Implementation

**Decision**: GitHub Immutable Releases is part of intended production architecture.

**Target configuration**:
- axolotl-pm-pl organization: Immutable Releases enabled
- Once a release is published, it cannot be silently replaced

**Verification required**: Confirm GitHub API supports immutable releases for the target organization type.

**Publication model**:
```
draft release
    |
    | upload assets
    v
verify assets
    |
    | publish
    v
immutable release (cannot be replaced)
```

**If correction needed**: Create new release with corrected content. Do NOT modify existing release.

### 2. Artifact Attestations

**Decision**: GitHub Artifact Attestations is planned provenance mechanism.

**Implementation**: Available for public repositories. Blocked if private repos supported later.

**Attestation contents**:
- Source repository
- Approved commit
- Build repository
- Workflow identity
- Artifact digest

**Do not require for MVP**. Architecture must support addition without redesign.

### 3. Fork vs Mirror Decision

**Decision**: Use native fork initially, mirror as fallback.

**When to consider fallback**:
- Fork network restrictions encountered
- Upstream visibility changes
- Repository detach limitations

### 4. Storage Repository Contents

**Decision**: Full source history in fork. PHARs in GitHub Releases only.

**Verification required**: Ensure GitHub API supports the intended fork model for organization repositories.

### 5. Registry Generation

**Question**: How to efficiently generate website data from declarative registry?

**Status**: Pipeline approach with caching.

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-07-25 | 1.0.0 | Initial architecture draft |
| 2026-07-25 | 2.0.0 | Added axolotl-pl fork architecture |
| 2026-07-25 | 3.0.0 | Complete revision: separated storage/org, fixed trust model, hard-separated build/publish, declarative registry, incident policy |
| 2026-07-25 | 3.1.0 | Fixed exact-SHA approval semantics, corrected storage model (PHARs in Releases, not Git tree), closed immutable releases decision |
| 2026-07-25 | 3.2.0 | Fixed approval validity table for pre/post materialization, added progressive provenance immutability section, fixed immutability terminology |

---

**Next Step**: Proceed to Milestone 3 implementation.
