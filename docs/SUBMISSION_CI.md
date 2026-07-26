# Submission CI Documentation

This document describes Milestone 3: Submission CI for the Axolotl Plugin Repository.

## Purpose

The Submission CI pipeline validates plugin submissions from developers before human review. It:

1. **Validates submission files** against the frozen PluginSubmissionSchema
2. **Resolves GitHub repositories** and branch references to exact commit SHAs
3. **Acquires source code** safely with bounded resources
4. **Inspects plugin metadata** from plugin.yml
5. **Analyzes Composer metadata** if present
6. **Generates review signals** for human prioritization
7. **Produces structured reports** for downstream processing

## Trust Boundary

**Everything from the submitting developer is UNTRUSTED:**

- Submission YAML file
- Repository contents
- plugin.yml metadata
- composer.json
- Source code
- Branch names
- Tags
- Release metadata
- Symlinks
- Filenames

**What M3 does NOT do:**

- Does NOT execute plugin code
- Does NOT approve plugins
- Does NOT create canonical registry records
- Does NOT build PHARs
- Does NOT expose secrets

## Submission Lifecycle

```
Developer
    |
    v
submissions/{submission}.yaml
    |
    v
LOCAL SUBMISSION VALIDATION
    |
    v
GitHub Repository Resolution
    |
    v
Branch / reference resolution
    |
    v
EXACT COMMIT SHA
    |
    v
Safe source acquisition
    |
    v
Static plugin inspection
    |
    v
Metadata extraction
    |
    v
Submission report
    |
    v
READY FOR HUMAN REVIEW
```

## Submission Filesystem Boundary

Developer submissions live only under:

```
submissions/
```

Canonical registry state remains under:

```
registry/
```

**M3 MUST NOT treat a submission as canonical state.**

## Submission Format

Submissions use the frozen `PluginSubmissionSchema`:

```yaml
schema_version: 1

upstream:
  repository: owner/repository
  branch: main  # default is 'main'
```

**Forbidden fields** (system-controlled):
- `id`
- `status`
- `storage`
- `artifact`
- `approved_at`
- `reviewer`
- `pull_request`
- And others

## PR Scope Policy

For new submission PRs:

**Allowed:** Exactly ONE new file under `submissions/`

**Rejected:** Any modification to:
- `registry/`
- `src/`
- `.github/`
- `schemas/`
- `package.json`
- `package-lock.json`
- `docs/`

This prevents combining submission with workflow modifications.

## GitHub Resolution

The pipeline resolves:

1. **Repository existence** - verifies the GitHub repo exists and is accessible
2. **Repository state** - checks for archived/disabled status
3. **Branch reference** - verifies the branch exists
4. **Exact SHA** - resolves branch to a specific commit SHA

**All subsequent inspection uses this exact SHA.**

## Exact-SHA Resolution

Once resolved, the exact SHA becomes the review candidate:

```
branch: main
        |
        v
SHA: b93f1e987654321abcdef123456789abcdef1234
        |
        v
All inspection targets this SHA
```

If the branch moves during CI, the current run still inspects the original SHA.

## Source Acquisition

Source is acquired through GitHub's archive endpoint for the exact SHA.

**Security requirements:**
- Bounded download size (100 MB max)
- Bounded extracted size (200 MB max)
- Bounded file count (10,000 max)
- Path traversal protection
- Symlinks not followed
- No device files
- Cleanup after run

## Resource Limits

| Limit | Value |
|-------|-------|
| Archive download | 100 MB |
| Extracted size | 200 MB |
| File count | 10,000 |
| File size | 10 MB |
| Tree depth | 20 levels |
| plugin.yml size | 64 KB |
| composer.json size | 64 KB |

## Symlink Policy

For M3 static inspection:
- Symlinks are **detected but not followed**
- Symlinks in metadata files are **rejected**
- A warning is generated for symlinks found

## Plugin Metadata

### plugin.yml Parsing

PocketMine plugin metadata is expected at the repository root.

**Required fields:**
- `name` - Plugin display name
- `version` - SemVer format
- `main` - Main class namespace
- `api` - API version(s)

**Optional fields:**
- `author` / `authors`
- `description`
- `website`
- `prefix`
- `load`
- And others per PocketMine conventions

### Version Validation

Versions must match the frozen Registry Schema v1 SemVer contract:
- Format: `1.0.0` or `1.0.0-beta`
- No normalization of invalid versions

### Plugin ID Derivation

Plugin display name → suggested registry ID:

```
TopStats → topstats
My Plugin → my-plugin
```

The suggested ID is validated against registry ID rules.

## Composer Inspection

### What M3 Inspects

**Allowed (read-only):**
- Parse JSON
- Report dependencies
- Report autoload declarations
- Flag Composer plugins
- Flag scripts
- Flag unusual repositories

**Forbidden:**
- `composer install`
- `composer update`
- Executing Composer plugins
- Executing scripts

### Composer Signals

The presence of scripts or plugins generates a review signal.

## Review Signals

Static analysis generates prioritization signals.

**Signal categories:**

| Category | Severity | Description |
|----------|----------|-------------|
| `network` | Medium | Network API usage (curl, file_get_contents with URLs) |
| `process_execution` | High | exec(), system(), shell_exec(), etc. |
| `code_execution` | High | eval(), assert(), preg_replace with /e |
| `filesystem_sensitive` | Medium | chmod 777, operations on /etc |
| `obfuscation` | Medium | Large base64, eval with variables |
| `binary` | Medium | Bundled binaries, native libraries |
| `archive` | Low | Archive files in repository |

**IMPORTANT:** Signals are prioritization aids, NOT malware verdicts.

## Infrastructure Errors

Distinguished from submission errors:

**Submission Error:**
- Invalid plugin.yml
- Missing required fields
- Invalid version format
- Repository format errors

**Infrastructure Error:**
- GitHub API 5xx errors
- Rate limiting
- Network timeouts
- Source too large

## GitHub Actions Security

### Workflow Trigger

Uses `pull_request` (not `pull_request_target`).

### Permissions

```yaml
permissions:
  contents: read
  pull-requests: write
  statuses: write
```

### Secrets

No privileged secrets are exposed:
- No organization PAT
- No GitHub App private key
- No storage credentials
- Uses only `GITHUB_TOKEN` for read operations

### Action Pinning

Actions are pinned to full commit SHAs:
- `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`
- `actions/setup-node@0a44ba7841725637e19ef6efaadb6f5f3ad9b18`
- `actions/github-script@7a5c598405927d774a95c935eb28a1293c2865db`

## Local CLI

```bash
# Inspect a submission
npm run submission:inspect -- submissions/topstats.yaml

# JSON output
npm run submission:inspect -- submissions/topstats.yaml --json

# With token
GITHUB_TOKEN=xxx npm run submission:inspect -- submissions/topstats.yaml
```

## Test Coverage

Tests cover:

- Submission schema validation
- PR scope validation
- GitHub resolution (mocked)
- Source acquisition
- plugin.yml parsing
- Composer parsing
- Review signals
- Infrastructure error handling

**Tests are offline** - they use mocks, not live GitHub.

## What M3 Explicitly Does NOT Do

1. **Execute plugin code** - No PHP execution, no Composer scripts
2. **Approve plugins** - Only reports for human review
3. **Create canonical records** - No registry writes
4. **Build PHARs** - Static inspection only
5. **Fetch arbitrary URLs** - Only GitHub API/archive
6. **Expose secrets** - No privileged credentials
7. **Modify repositories** - Read-only operations

## Security Assumptions

1. GitHub Actions `pull_request` event runs untrusted code in sandbox
2. `GITHUB_TOKEN` has minimal permissions
3. Trusted tooling comes from base branch
4. Only submission file comes from PR
5. No arbitrary code execution during inspection

## Future Considerations

- Update submissions (different model than new submissions)
- Batch submission processing
- Integration with external security scanning
- Automated compatibility checks with PocketMine versions
