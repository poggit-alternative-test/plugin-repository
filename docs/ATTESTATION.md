# GitHub Artifact Attestations — Architecture

**Version:** 1.0.0
**Status:** Implemented
**Last Updated:** 2026-08-02

---

## Table of Contents

1. [Overview](#overview)
2. [Why Attestation Belongs to Infrastructure](#why-attestation-belongs-to-infrastructure)
3. [Why Build Domain Remains Unchanged](#why-build-domain-remains-unchanged)
4. [Registry Minimal Metadata Design](#registry-minimal-metadata-design)
5. [How Users Verify Artifacts](#how-users-verify-artifacts)
6. [Attestation Workflow Integration](#attestation-workflow-integration)
7. [Security Considerations](#security-considerations)

---

## Overview

GitHub Artifact Attestations provide cryptographic provenance for build artifacts. This document explains how attestations are integrated into the Axolotl Plugin Repository architecture.

### What Attestations Provide

```
Attestation proves:
├── Source repository (upstream)
├── Source commit (exact SHA)
├── Build repository (axolotl-pm/axolotl-plugin-repository)
├── Workflow identity (build-trusted.yml)
├── Workflow run ID
└── Artifact digest (SHA-256)
```

### What Attestations Do NOT Prove

```
Attestation does NOT prove:
├── That the plugin is secure
├── That the plugin is benign
├── Absence of vulnerabilities
└── Absence of malicious code
```

Attestations establish **provenance**, not **safety**.

---

## Why Attestation Belongs to Infrastructure

### Architectural Principle

Artifact Attestations are a concern of **Infrastructure**, not **Build domain**.

### Reasoning

1. **Attestation is about artifact identity, not build process**
   - Attestations prove "where did this artifact come from"
   - Build produces the artifact; attestation labels it
   - These are separate concerns

2. **GitHub is the authoritative provenance provider**
   - GitHub generates and stores the attestation
   - GitHub guarantees attestation integrity
   - We defer to GitHub's security model

3. **Build should remain platform-independent**
   - Build produces: PHAR, checksums.txt, metadata.json
   - Attestations are GitHub-specific
   - Platform independence is preserved by keeping attestations outside Build

4. **Clear separation of concerns**
   - Build: transforms source to artifact
   - Infrastructure: provides provenance guarantees
   - Publication: distributes artifact with provenance

### Why Not Build Domain

```
Build Domain Responsibilities:
├── PHAR construction
├── Checksum computation
├── Metadata generation
└── Security verification

NOT Build Domain Responsibilities:
├── Attestation generation
├── Provenance storage
└── GitHub-specific integration
```

---

## Why Build Domain Remains Unchanged

### Design Constraint

The **Backend Architecture is frozen**. No changes to:
- `src/build/`
- Build runners
- Composer Runner
- Pharynx Runner

### Why This Constraint Exists

1. **Stability**: Build domain is proven and tested
2. **Separation**: Attestation is orthogonal to build logic
3. **GitHub Actions integration**: Attestations happen in the workflow, not the CLI

### Implementation Strategy

Attestations are generated **after** the Build CLI completes:

```yaml
jobs:
  build:
    steps:
      # 1. Build runs - Build domain is unchanged
      - name: Run Build Trusted CLI
        run: npx tsx src/cli/build-trusted.ts ...

      # 2. Attestation generated - Infrastructure concern
      - name: Generate GitHub Artifact Attestation
        uses: actions/attest-build-provenance@v1
        with:
          subject-path: ${{ steps.run-build.outputs.phar_path }}
```

The Build CLI:
- Produces the PHAR
- Computes checksums
- Does NOT know about attestations
- Does NOT receive `--attest` flag

---

## Registry Minimal Metadata Design

### Design Principle

Registry is an **index**, not a provenance database.

### Registry Representation

```yaml
artifact:
  release_tag: v2.1.0
  file: TopStats.phar
  sha256: a1b2c3d4e5f6...
  published_at: 2026-08-05T10:00:00Z
  provenance:
    type: github-attestation
```

### Vendor-Neutral Design

The `provenance.type` field uses a vendor-neutral string value:
- `github-attestation` - GitHub Artifact Attestations
- Future values (without schema redesign):
  - `gitlab-attestation` - GitLab attestations
  - `self-attestation` - Manual attestation
  - `reproducible-build` - Reproducible build verification

### What Registry Does NOT Store

```yaml
# DO NOT store these in registry:
artifact:
  # attestation_blob: <full attestation JSON>    # ❌ GitHub stores this
  # provenance_url: https://...                   # ❌ No URLs, only mechanism
  # provider_metadata: {...}                    # ❌ No provider-specific data
```

### Why This Design

| Approach | Pros | Cons |
|----------|------|------|
| Store provenance type only | Vendor-neutral, extensible | Requires provider for verification |
| Store attestation blob | Complete local record | Duplicates GitHub, maintenance burden |
| Store attestation ID | Links to GitHub | More coupling, ID stability concerns |

### Future Website Usage

```typescript
// Future website can display trust indicator:
function renderPluginCard(plugin: Plugin) {
  const hasAttestation = plugin.versions.some(
    v => v.status === 'published' && v.artifact?.githubAttestation
  );

  return (
    <div>
      {hasAttestation && <TrustBadge label="Verified Build" />}
      {/* Other plugin info */}
    </div>
  );
}
```

The website knows an attestation exists, but verification requires GitHub.

---

## How Users Verify Artifacts

### Verification Flow

```
User downloads PHAR
    |
    v
Verify SHA-256 against checksums.txt
    |
    v
(Optional) Verify attestation via GitHub CLI
    |
    v
Confirm provenance chain
```

### Using GitHub CLI

```bash
# Verify attestation exists for a release
gh attestation verify path/to/TopStats.phar \
  --repo axolotl-pm-pl/TopStats \
  --predicate-type https://actions.github.io/attestation/spec/v1.0.0

# Example output:
# ✓ Verified attestation for TopStats.phar
# ✓ Subject: sha256:a1b2c3d4e5f6...
# ✓ Repository: axolotl-pm-pl/TopStats
# ✓ Workflow: build-trusted.yml
# ✓ Commit: b93f1e987654321abcdef123456789abcdef1234
```

### Verification Does NOT Mean

- The plugin is safe to run
- The plugin contains no vulnerabilities
- The plugin is benign

Attestation proves **origin**, not **quality** or **safety**.

---

## Attestation Workflow Integration

### When Attestations Are Generated

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'registry/plugins/*.yaml'
```

Attestations are generated **only** for push events (automatic builds), not for manual workflow dispatch.

### Permission Requirements

```yaml
permissions:
  contents: read      # Read source code
  actions: write       # Write build logs
  attestations: write  # Generate attestations
```

Minimum required permissions for attestation generation.

### Attestation Lifecycle

```
Build completes
    |
    v
PHAR uploaded to artifact store
    |
    v
Attestation generated by GitHub
    |
    v
Attestation stored by GitHub (not in registry)
    |
    v
Attestation ID captured for output
    |
    v
Build summary reports attestation status
```

### Attestation Output

```yaml
jobs:
  build:
    outputs:
      attestation_id: ${{ steps.attest.outputs.attestation-id || '' }}
```

The attestation ID can be used by downstream processes, but is primarily for logging and verification.

---

## Security Considerations

### Attestation Security Properties

| Property | Guarantee |
|----------|-----------|
| **Integrity** | Attestation cannot be tampered with after creation |
| **Authenticity** | GitHub signs attestations cryptographically |
| **Non-repudiation** | Attestation proves workflow ran and produced artifact |

### Attestation Limitations

| Limitation | Impact |
|------------|--------|
| GitHub-dependent | Attestations require GitHub Actions |
| Public repo only | Attestations may require public repository |
| Builder trust | Attestation proves workflow ran, not that workflow is secure |

### Trust Model Implications

```
Attestation proves:
✓ This PHAR was built by workflow X
✓ From commit Y in repository Z
✓ At time T

Attestation does NOT prove:
✗ The workflow is secure
✗ The plugin is safe
✗ No tampering occurred after download
```

### Verification is User Responsibility

Users must:
1. Verify PHAR checksum
2. Optionally verify attestation via GitHub CLI
3. Make informed decision about plugin trust

The system provides provenance; humans provide trust.

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-08-02 | 1.0.0 | Initial implementation |

---

**Related Documents**:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [SECURITY.md](./SECURITY.md) - Security model
- [REGISTRY.md](./REGISTRY.md) - Registry format
