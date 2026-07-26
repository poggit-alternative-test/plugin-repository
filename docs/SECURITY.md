# Axolotl Plugin Repository — Security Model

**Version:** 3.0.0
**Status:** Draft for Review
**Last Updated:** 2026-07-25

---

## Table of Contents

1. [Security Philosophy](#security-philosophy)
2. [Trust Model](#trust-model)
3. [Trust Boundaries](#trust-boundaries)
4. [Threat Model](#threat-model)
5. [Security Controls](#security-controls)
6. [GitHub Actions Security](#github-actions-security)
7. [Supply Chain Security](#supply-chain-security)
8. [Incident Response](#incident-response)

---

## Security Philosophy

### Core Principles

1. **No Implicit Trust**: CI success never implies publication approval
2. **Exact SHA Accountability**: Only explicitly reviewed commits become eligible
3. **Hostile Processing**: All plugin source is processed as potentially hostile
4. **Hard Separation**: Build and publication are separate security domains
5. **Minimal Credentials**: No long-lived credentials with broad access
6. **Immutable Records**: Approved commits are preserved, not deleted
7. **Explicit Provenance**: Artifacts prove source and process, not safety

### The Critical Security Rule

```
CI PASSED ≠ APPROVED ≠ SAFE ≠ TRUSTED EXECUTABLE

Only the combination of:
• CI PASSED
• HUMAN REVIEW PASSED
• EXACT SHA APPROVED
• STORAGE MATERIALIZED
• ARTIFACT VERIFIED
• IMMUTABLE RELEASE PUBLISHED
────────────────────────────────────
= DISTRIBUTABLE WITH PROVENANCE
```

**What this does NOT mean**:
- The plugin is mathematically proven safe
- The plugin contains no vulnerabilities
- The plugin will not cause harm
- Human review guarantees security

**What this DOES mean**:
- The exact source has been reviewed
- The artifact was built from reviewed source
- Provenance chain is established
- Risk has been reduced (not eliminated)

---

## Trust Model

### Trust Level Definitions

#### UNTRUSTED SOURCE

**Definition**: Developer-controlled upstream repository.

**Treatment**:
- Never executed directly
- Never used as build source
- Validated but not trusted
- Subject to compromise

#### REVIEWED / APPROVED SOURCE

**Definition**: Exact upstream commit that passed automated validation and human review.

**Treatment**:
- Eligible for storage materialization
- Still processed with hostility during build
- Not proven safe, just reviewed

**What approval means**:
- Reviewer found no known policy-blocking issues
- Reviewer found no obvious malicious behavior
- Code meets baseline quality standards

**What approval does NOT mean**:
- Plugin is secure
- Plugin contains no vulnerabilities
- Plugin is benign
- Plugin is mathematically safe

#### AXOLOTL-CONTROLLED STORAGE

**Definition**: Repository in `axolotl-pm-pl` containing preserved approved commits.

**Treatment**:
- Axolotl controls mutation
- Only approved commits present
- Does NOT auto-sync from upstream
- Code inside still processed with hostility

**Important**: Repository control != Code safety

#### VERIFIED ARTIFACT

**Definition**: PHAR produced by Axolotl build from approved source.

**Treatment**:
- Provenance chain established
- Can be reproduced from source
- Immutable after publication

**Important**: Provenance != Safety

---

## Trust Boundaries

### Security Domains

```
+-------------------------------------------------------------------+
|                    UNTRUSTED DOMAIN                               |
|                                                                    |
|  Developer Upstream Repository                                     |
|  • Can push anytime                                               |
|  • Subject to compromise                                           |
|  • NOT built from directly                                        |
|                                                                    |
+-------------------------------------------------------------------+
                                |
                                | Submission PR
                                v
+-------------------------------------------------------------------+
|                    VALIDATION DOMAIN                              |
|                                                                    |
|  • Read-only access                                               |
|  • No secrets                                                     |
|  • No writes                                                      |
|  • Does NOT execute plugin code                                    |
|                                                                    |
+-------------------------------------------------------------------+
                                |
                                | Approval
                                v
+-------------------------------------------------------------------+
|                    APPROVAL DOMAIN                                |
|                                                                    |
|  • Human review of exact SHA                                      |
|  • SHA recorded as "eligible"                                     |
|  • NOT yet materialized                                          |
|                                                                    |
+-------------------------------------------------------------------+
                                |
                                | Storage creation
                                v
+-------------------------------------------------------------------+
|                STORAGE DOMAIN (axolotl-pm-pl)                     |
|                                                                    |
|  • Axolotl-controlled                                            |
|  • Approved commits only                                          |
|  • No auto-sync                                                  |
|  • Read-only for builds                                           |
|                                                                    |
+-------------------------------------------------------------------+
                                |
                                | Build artifacts
                                v
+-------------------------------------------------------------------+
|                   BUILD DOMAIN (UNPRIVILEGED)                      |
|                                                                    |
|  • NO publication credentials                                     |
|  • NO organization secrets                                       |
|  • NO PAT                                                         |
|  • Executes plugin code (with hostility)                         |
|  • Produces artifacts only                                        |
|                                                                    |
+-------------------------------------------------------------------+
                                |
                                | Verified artifacts
                                v
+-------------------------------------------------------------------+
|               PUBLICATION DOMAIN (PRIVILEGED)                       |
|                                                                    |
|  • Has publication credentials                                    |
|  • NO plugin code execution                                       |
|  • NO build operations                                            |
|  • Creates releases only                                          |
|                                                                    |
+-------------------------------------------------------------------+
                                |
                                | Immutable release
                                v
+-------------------------------------------------------------------+
|                     PUBLISHED DOMAIN                               |
|                                                                    |
|  • Immutable releases                                             |
|  • Provenance verified                                           |
|  • Code inside still untrusted                                    |
|                                                                    |
+-------------------------------------------------------------------+
```

### Workflow Permission Matrix

| Workflow | Executes Plugin Code | Has Secrets | Can Publish | Can Write Storage |
|----------|--------------------|-------------|-------------|-------------------|
| validate-submission.yml | No | None | No | No |
| build-trusted.yml | Yes (isolated) | None | No | No |
| publish-release.yml | No | App credentials | Yes | No |
| materialize-storage.yml | No | App credentials | No | Yes |

---

## Threat Model

### Threat Actors

#### 1. Malicious Plugin Developer

**Goal**: Publish malicious plugin as trusted

**Attack Vectors**:
- Submit seemingly benign plugin
- Add malicious code after approval
- Exploit build process vulnerabilities
- Provide malicious PHAR (not used)

**Mitigations**:
- Human review of code
- SHA pinning prevents post-approval mutation
- Fork architecture separates trust
- Source-only submission (no PHAR from developer)
- Isolated build with hostile processing

#### 2. Post-Approval Push Attack (CRITICAL)

**Goal**: Push malicious code after approval, before build

**Attack Scenario**:
```
1. Human reviews SHA AAA, approves
2. Developer pushes SHA BBB (malicious)
3. Build uses latest = BBB
4. Malicious PHAR published
```

**Mitigations**:
1. **Fork-based architecture**: Build from axolotl-pm-pl, not upstream
2. **SHA verification**: Build verifies storage SHA matches approved SHA
3. **No auto-sync**: Fork does NOT track upstream
4. **Stale detection**: Workflow detects if upstream changed after approval

**Correct Timeline**:
```
1. Review approves SHA AAA
2. Fork created, SHA AAA synced
3. Developer pushes SHA BBB
4. Fork still has AAA
5. Build uses fork at AAA
6. Trusted PHAR = safe
```

#### 3. Fork PR Attack

**Goal**: Access secrets or inject code via fork PR

**Mitigations**:
- PR workflows run with NO secrets
- Validation is read-only
- Forks cannot access organization secrets

#### 4. Build Environment Compromise

**Goal**: Tamper with build process

**Mitigations**:
- Fresh runner per build
- No secrets in build environment
- Build output verified before publication
- Minimal dependencies

#### 5. Dependency Attacks

**Goal**: Compromise build via dependencies

**Mitigations**:
- Composer scripts disabled: `--no-scripts --no-plugins`
- No developer-controlled build steps
- Lockfile required for reproducibility
- Security audit on dependencies

#### 6. Workflow Injection

**Goal**: Inject malicious commands via workflow

**Mitigations**:
- Never pass untrusted input to shell
- Environment variable isolation
- No eval of user-controlled data
- Input validation

---

## Security Controls

### Pre-Submission Validation

```yaml
# Repository validation
- name: Verify repository accessible
  run: |
    # Only accept GitHub public repos
    # Validate URL format
    # Check branch exists

# NO secrets, read-only only
permissions:
  contents: read
```

### Source Code Validation

```typescript
// Pattern detection (flags for review, not automatic rejection)
const DANGEROUS_PATTERNS = [
  { pattern: /eval\s*\(/, severity: 'critical' },
  { pattern: /base64_decode\s*\(/, severity: 'high' },
  { pattern: /system\s*\(/, severity: 'critical' },
  { pattern: /shell_exec\s*\(/, severity: 'critical' },
];

// CRITICAL: Pattern match ≠ rejection
// All matches flag for HUMAN review
```

### Build Security Controls

#### Source Verification

```yaml
# Verify SHA before build
- name: Verify storage SHA
  run: |
    ACTUAL=$(git rev-parse HEAD)
    EXPECTED="${{ env.APPROVED_SHA }}"
    if [ "$ACTUAL" != "$EXPECTED" ]; then
      echo "SHA mismatch! Abort."
      exit 1
    fi
```

#### Isolation Requirements

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read  # Read only
      actions: write  # Logs only
    # NO secrets
    env:
      ACTIONS_ALLOW_UNSECURE_COMMANDS: false
```

#### Composer Restrictions

```yaml
# NEVER execute developer scripts
- name: Install dependencies
  run: |
    composer install \
      --no-dev \
      --no-scripts \
      --no-plugins \
      --prefer-dist
```

#### PHAR Build

```yaml
# Use Axolotl-controlled builder
- name: Build PHAR
  run: |
    php tools/builder/build-phar.php
    # NOT developer scripts

- name: Verify PHAR contents
  run: |
    # Check no .git, no symlinks, no path traversal
```

### Publisher Security Controls

```yaml
# Publisher does NOT execute plugin code
jobs:
  publish:
    permissions:
      contents: write
      releases: write
    # Has credentials, but NO plugin execution
```

### Artifact Verification

```yaml
# Verify before publication
- name: Verify artifacts
  run: |
    # SHA-256 matches
    # Metadata is valid
    # Provenance is complete
```

---

## GitHub Actions Security

### Permission Principles

```yaml
# Every workflow declares exact permissions
# NO broad permissions

# Validation - read only
permissions:
  contents: read
  pull-requests: write

# Build - read only, no secrets
permissions:
  contents: read
  actions: write

# Publisher - write only for releases
permissions:
  contents: write
  releases: write
```

### Security Checklist

#### Validation Workflow
- [ ] No secrets
- [ ] Read-only operations only
- [ ] No code execution
- [ ] Permissions minimal

#### Build Workflow
- [ ] No publication credentials
- [ ] No organization secrets
- [ ] Fresh runner
- [ ] No auto-sync from upstream
- [ ] Composer scripts disabled
- [ ] PHAR contents verified

#### Publisher Workflow
- [ ] No plugin code execution
- [ ] No build operations
- [ ] Short-lived credentials
- [ ] Artifacts verified before release
- [ ] Immutable release created

### Action Pinning

```yaml
# Pin to exact SHA, not version tag
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

# Verify actions before adding
# Review third-party actions
```

### Secrets Management

#### Production: GitHub App
- Short-lived installation tokens
- Minimal permissions
- Repository-scoped

#### Development: PAT (limited)
- For local testing only
- Not for production workflows
- Scoped to specific repos

---

## Supply Chain Security

### Dependency Security

```yaml
# Install without scripts/plugins
composer install \
  --no-dev \
  --no-scripts \
  --no-plugins \
  --prefer-dist

# Audit dependencies
composer audit --no-interaction
```

### Build Reproducibility

For future enhancement:
- Deterministic builds
- Reproducible PHAR archives
- Build attestation

### Action Security

- Pin actions to SHA
- Review actions before adding
- Minimize third-party dependencies

---

## Incident Response

### Version States

| State | Meaning |
|-------|---------|
| published | Available, recommended |
| deprecated | Available, not recommended |
| revoked | Security concern, not recommended |
| removed | Not in registry |

### Revocation Process

```
Security issue discovered
    |
    v
Severity assessment
    |
    +--> Critical (malware, RCE)
    |     |
    |     v
    |     - Remove from discovery
    |     - Mark revoked
    |     - Preserve for investigation
    |     - Do NOT delete release
    |
    v
Medium/Low
    |
    v
- Deprecate version
- Recommend newer version
- Preserve release
```

### Release Deletion Policy

**Do NOT delete releases** except:
- Legal requirements
- Actual malware requiring removal

**Instead**:
- Mark revoked in registry
- Remove from discovery
- Preserve for audit
- Add warning if accessed

---

## Security Review Checklist

### For Submissions

- [ ] Repository is public
- [ ] plugin.yml valid
- [ ] No suspicious code patterns
- [ ] No embedded secrets
- [ ] No path traversal risks
- [ ] Build feasible

### For Human Review

- [ ] Code manually reviewed
- [ ] No obfuscated code
- [ ] No unexpected network behavior
- [ ] Dependencies appropriate
- [ ] No credential theft patterns
- [ ] No backdoors
- [ ] Code quality acceptable

### For Storage Materialization

- [ ] Fork created in axolotl-pm-pl
- [ ] Approved SHA synced
- [ ] SHA verified
- [ ] No auto-sync enabled

### For Builds

- [ ] Exact SHA verified
- [ ] Build environment clean
- [ ] No developer scripts executed
- [ ] Composer scripts/plugins disabled
- [ ] PHAR contents verified
- [ ] Checksums generated

### For Publication

- [ ] Artifacts verified
- [ ] Provenance complete
- [ ] Immutable release created
- [ ] Registry updated

---

## Trust Terminology Reference

| Term | Meaning |
|------|---------|
| Untrusted source | Developer-controlled, not built from |
| Reviewed source | Passed validation and human review |
| Approved source | Recorded as eligible for storage |
| Stored source | Preserved in axolotl-pm-pl |
| Verified artifact | PHAR with proven provenance |
| Immutable release | Cannot be changed after creation |

**Remember**: Review reduces risk, it does not eliminate it. Provenance proves origin, it does not prove safety.

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-07-25 | 1.0.0 | Initial security model |
| 2026-07-25 | 2.0.0 | Added fork architecture |
| 2026-07-25 | 3.0.0 | Complete revision: separated build/publish, clarified trust model, added incident policy |
| 2026-07-25 | 3.1.0 | Fixed exact-SHA approval semantics, clarified workflow permission descriptions |

---

**Next Step**: Proceed to Milestone 2 implementation.
