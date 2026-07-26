# Axolotl Plugin Registry — Registry Format

**Version:** 1.0.0
**Status:** Draft for Review
**Last Updated:** 2026-07-25

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Layout](#directory-layout)
3. [Plugin Identity](#plugin-identity)
4. [Version Records](#version-records)
5. [Lifecycle States](#lifecycle-states)
6. [Exact SHA Semantics](#exact-sha-semantics)
7. [Plugin ID Stability](#plugin-id-stability)
8. [Repository Identity](#repository-identity)
9. [Immutable Provenance Principle](#immutable-provenance-principle)
10. [Schema Versioning](#schema-versioning)
11. [Examples](#examples)
12. [Validation](#validation)

---

## Overview

The Axolotl Plugin Registry is a Git-backed declarative registry. It stores plugin identity and immutable version records. No database is used. All state lives in Git.

### Design Principles

1. **Declarative**: Describes intent, not CI runtime state
2. **Immutable records**: Version history does not change
3. **Minimal conflicts**: No concurrent modification of same data
4. **Static-site friendly**: Easy to generate website data
5. **Auditable**: Clear history of decisions

---

## Directory Layout

```
registry/
└── plugins/
    └── {plugin-id}/
        ├── plugin.yaml           # Plugin identity
        └── versions/
            ├── 1.0.0.yaml     # Version record
            └── 2.0.0.yaml
```

### Rules

- One directory per plugin, named by plugin ID
- `plugin.yaml` contains plugin identity
- `versions/` directory contains version records
- Version files named exactly as `{version}.yaml`

---

## Plugin Identity

### File: `plugin.yaml`

```yaml
schema_version: 1

id: topstats
# Stable identifier for this plugin

upstream:
  repository: nicholass003/TopStats
  branch: main

# Populated after materialization
storage:
  repository: axolotl-pm-pl/TopStats
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `schema_version` | No | Schema version (default: 1) |
| `id` | Yes | Stable plugin identifier |
| `upstream.repository` | Yes | GitHub repository (owner/name) |
| `upstream.branch` | No | Target branch (default: main) |
| `storage.repository` | After materialization | Storage repository location |

---

## Version Records

### File: `versions/{version}.yaml`

```yaml
schema_version: 1

version: 2.1.0

source:
  upstream_commit: b93f1e987654321abcdef123456789abcdef1234

storage:
  repository: axolotl-pm-pl/TopStats
  commit: b93f1e987654321abcdef123456789abcdef1234

review:
  pull_request: 58
  reviewer: axolotl-reviewer
  approved_at: 2026-08-05T09:15:00Z

artifact:
  release_tag: v2.1.0
  file: TopStats.phar
  sha256: a1b2c3d4e5f6...
  published_at: 2026-08-05T10:00:00Z

status: published
```

---

## Lifecycle States

### State Transition Diagram

```
approved
    |
    v
materialized
    |
    v
published
    |
    v
deprecated / revoked
    |
    v
removed
```

### Status Definitions

| Status | Description | Required Fields |
|--------|-------------|----------------|
| `approved` | Reviewed, awaiting materialization | version, source, review |
| `materialized` | Source preserved in storage | + storage |
| `published` | Release created | + artifact |
| `deprecated` | No longer recommended | artifact |
| `revoked` | Security concern | artifact + revoked_at |
| `removed` | Removed from discovery | + removed_at |

### Invariants

**approved** MUST have:
- `version`
- `source.upstream_commit`
- `review`

**approved** MUST NOT have:
- `storage.commit` (not yet materialized)
- `artifact` (not yet published)

**published** MUST have:
- Everything from approved
- `storage.commit`
- `artifact.sha256`
- `artifact.published_at`

---

## Exact SHA Semantics

### What SHA Approval Means

Approval is tied to the **exact commit SHA**, not the branch.

```
main branch:
AAA ---- BBB ---- CCC
|
+---- reviewed and approved for AAA

SHA AAA remains approved.
SHA BBB is NOT approved.
SHA CCC is NOT approved.
```

### When Approval Becomes Invalid

| Event | Approval valid? |
|-------|-----------------|
| Developer pushes new commits | YES |
| Branch moves forward | YES |
| Developer force-pushes | NO (AAA may not exist) |
| Branch deleted | NO (AAA may be gc'd) |

### Branch vs Commit

```
upstream.branch = where we initially find the source
upstream.commit = what we actually review and approve
```

Branch is a discovery reference. Commit is a trust anchor.

---

## Plugin ID Stability

### Rules

- Plugin ID is **permanent**
- Does NOT change if:
  - Plugin display name changes
  - Upstream repository is renamed
  - Upstream repository is transferred

### ID Format

- Lowercase alphanumeric
- Hyphens allowed in middle
- Must start and end with alphanumeric
- No consecutive hyphens
- Maximum 64 characters

### Examples

**Valid:**
- `topstats`
- `economy-api`
- `worldedit`

**Invalid:**
- `TopStats` (uppercase)
- `top_stats` (underscore)
- `top stats` (space)
- `-topstats` (starts with hyphen)

---

## Repository Identity

### Format

GitHub repository in `owner/name` format.

```
nicholass003/TopStats
```

### Not This

```
https://github.com/nicholass003/TopStats
git@github.com:nicholass003/TopStats
github.com/nicholass003/TopStats
```

### Storage Repository

Format: `axolotl-pm-pl/{identifier}`

```
axolotl-pm-pl/TopStats
axolotl-pm-pl/devfund-EconomyAPI
```

---

## Immutable Provenance Principle

### What Must Remain Immutable

Once a version reaches `published` status, these fields MUST NOT change:

- `source.upstream_commit`
- `review.*`
- `storage.commit`
- `artifact.sha256`
- `artifact.release_tag`
- `artifact.published_at`

### Allowed Transitions

```
published -> deprecated
published -> revoked
deprecated -> revoked
revoked -> removed
```

### What Changes

- `status` may transition forward
- `revoked_at` / `removed_at` / `reason` may be added

---

## Schema Versioning

### Current: Schema Version 1

```yaml
schema_version: 1
```

### Future Migrations

If a schema version 2 is introduced:

1. Migration tooling provided
2. Version 1 records remain valid
3. New fields have defaults
4. Old fields preserved

### Unsupported Versions

Records with `schema_version` greater than supported version are rejected.

---

## Examples

### Submitted Plugin (Minimal)

```yaml
# Developer submits
schema_version: 1
id: new-plugin
upstream:
  repository: developer/NewPlugin
  branch: main
```

### Approved Version

```yaml
schema_version: 1
version: 1.0.0
source:
  upstream_commit: a82f0e123456789abcdef123456789abcdef1234
review:
  pull_request: 42
  reviewer: axolotl-reviewer
  approved_at: 2026-07-20T15:30:00Z
status: approved
```

### Published Version

```yaml
schema_version: 1
version: 1.0.0
source:
  upstream_commit: a82f0e123456789abcdef123456789abcdef1234
storage:
  repository: axolotl-pm-pl/NewPlugin
  commit: a82f0e123456789abcdef123456789abcdef1234
review:
  pull_request: 42
  reviewer: axolotl-reviewer
  approved_at: 2026-07-20T15:30:00Z
artifact:
  release_tag: v1.0.0
  file: NewPlugin.phar
  sha256: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
  published_at: 2026-07-20T16:00:00Z
status: published
```

### Deprecated Version

```yaml
# Same as published, plus:
status: deprecated
```

### Revoked Version

```yaml
# Same as published, plus:
revoked_at: 2026-08-01T10:00:00Z
reason: Security vulnerability discovered
status: revoked
```

---

## Validation

### CLI Command

```bash
npm run registry:validate
```

### Output Examples

**Valid:**
```
Registry valid.
Plugins: 2
Versions: 5
```

**Invalid:**
```
Registry validation failed.

ERROR [INVALID_PLUGIN_ID]
registry/plugins/TopStats/plugin.yaml
id: Plugin ID must be lowercase.

ERROR [VERSION_FILENAME_MISMATCH]
registry/plugins/topstats/versions/2.1.0.yaml
version: expected 2.0.0, got 2.1.0

2 error(s), 0 warning(s)
```

### JSON Output

```bash
npm run registry:validate -- --json
```

```json
{
  "valid": false,
  "registryPath": "/path/to/registry",
  "plugins": 2,
  "versions": 5,
  "diagnostics": [...],
  "summary": {
    "errors": 2,
    "warnings": 0,
    "info": 0
  }
}
```

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-07-25 | 1.0.0 | Initial registry documentation |

---

**Related Documents**:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [SECURITY.md](./SECURITY.md) - Security model
- [REVIEW_POLICY.md](./REVIEW_POLICY.md) - Human review requirements
