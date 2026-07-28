# M5 Trusted Source Materialization - Engineering Handoff

**Document Version:** 1.0  
**Created:** 2026-07-26  
**Author:** Claude Code Security Audit  
**Status:** NOT READY FOR TESTER E2E  

---

## Executive Summary

M5 (Trusted Source Materialization) is **NOT READY** for tester end-to-end testing. Critical architectural deficiencies exist in trust boundary enforcement, SHA binding, and plan integrity. The module accepts untrusted input from callers and cannot establish provenance chain continuity from M4.

This document preserves all audit findings for the next engineering agent.

---

## 1. Current M5 Architecture

### Implemented Components

```
src/materialization/
├── index.ts                    # Module exports
├── materialization-types.ts    # Domain types, interfaces, type guards
├── materialization-service.ts  # Core service (generatePlan, executePlan)
├── github-client.ts            # GitHub API abstraction
└── repository-naming.ts       # Storage naming conventions
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Layer                                 │
│                   src/cli/materialize.ts                         │
│  Commands: plan | execute | provenance | status                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MaterializationService                         │
│  generatePlan(candidate: ApprovedCandidateInfo)                   │
│  executePlan(plan: MaterializationPlan, githubClient)             │
│  saveProvenanceRecord(record: ProvenanceRecord)                  │
│  loadProvenanceRecord(pluginId, version)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ FakeGitHubClient│   │ RealGitHubClient  │   │ Local Filesystem  │
│ (for testing)  │   │ (STUB - throws)   │   │ (provenance)      │
└───────────────┘   └───────────────────┘   └───────────────────┘
```

### Key Types

```typescript
// ApprovedCandidateInfo - INPUT (untrusted from caller perspective)
interface ApprovedCandidateInfo {
  pluginId: PluginId;
  version: SemVer;
  upstreamRepository: RepositoryIdentity;
  upstreamBranch: string;
  upstreamCommit: GitSha;
  reviewerId: string;
  reviewApprovedAt: string;
  inspectionCompletedAt: string;
  archivePath: string;
  fileCount: number;
  totalSizeBytes: number;
}

// MaterializationPlan - GENERATED (includes untrusted fields)
interface MaterializationPlan {
  pluginId: PluginId;
  version: SemVer;
  source: SourceRef;       // { repository, branch, commitSha }
  storageRepository: string;
  storageBranch: string;
  actions: MaterializationAction[];
  dryRun: boolean;
  generatedAt: string;
}

// ProvenanceRecord - OUTPUT
interface ProvenanceRecord {
  schemaVersion: 1;
  pluginId: PluginId;
  version: SemVer;
  upstreamRepository: RepositoryIdentity;
  upstreamBranch: string;
  upstreamCommit: GitSha;
  storageRepository: RepositoryIdentity;
  storageBranch: string;
  storageCommit?: GitSha;
  materializedAt: string;
  materializedBy: string;
  materializerVersion: string;
  reviewApprovedAt: string;
  inspectionCompletedAt: string;
  sourceIntegrity: {
    fileCount: number;
    checksumVerified: boolean;
    archivedAt: string;
  };
}
```

---

## 2. M1-M4 Frozen Status

### M1: Submission Ingestion
- **Status:** IMPLEMENTED
- **Location:** `src/submission/`
- **Files:** `acquisition.ts`, `index.ts`

### M2: Source Acquisition
- **Status:** IMPLEMENTED
- **Location:** `src/submission/`
- **Evidence:** `acquisition.ts` handles Git clone/archive

### M3: Inspection & Analysis
- **Status:** IMPLEMENTED
- **Location:** `src/submission/result.ts`
- **Evidence:** `SubmissionInspectionResult` with status enum

### M4: Human Review
- **Status:** IMPLEMENTED
- **Location:** `src/review/`
- **Files:**
  - `review-state.ts` - Effective state derivation
  - `approval-preconditions.ts` - Pre-approval validation
  - `review-record.ts` - Decision schema
  - `reviewer-auth.ts` - Authorization
  - `candidate-identity.ts` - Identity validation
  - `diagnostics.ts` - Error codes

### M5: Trusted Source Materialization
- **Status:** NOT READY FOR E2E
- **Location:** `src/materialization/`
- **See:** Section 4 (Issues) for critical deficiencies

---

## 3. M5 Current Status

### VERDICT: NOT READY FOR TESTER E2E

**Blocking Issues:**
1. M4 → M5 Trust Boundary Not Enforced
2. No SHA Binding to M4 Approval
3. No Plan Tampering Resistance
4. No Immutable Preservation Model
5. Provenance Local-Only (Won't Survive Runner Destruction)

**All issues are documented in Section 4 with severity, evidence, and recommended fixes.**

---

## 4. Discovered Issues

### CRITICAL Issues

#### Issue 1: M4 → M5 Trust Boundary Not Enforced
- **Severity:** CRITICAL
- **Location:** `src/materialization/materialization-service.ts:186-322`
- **Function:** `generatePlan(candidate: ApprovedCandidateInfo, options?)`
- **Evidence:**
  ```typescript
  // Line 186-193: Candidate accepted from caller, NOT from M4
  async generatePlan(
    candidate: ApprovedCandidateInfo,  // ← UNTRUSTED INPUT
    options: { ... }
  ): Promise<...>
  ```
- **Problem:** `ApprovedCandidateInfo` is constructed by the caller with no verification against M4 storage. Any caller can fabricate "approved" state.
- **Recommended Fix:**
  1. Add M4 storage interface to `MaterializationService`
  2. `generatePlan()` must query M4 for candidate state
  3. Validate effective state is `APPROVED`
  4. Require `m4ApprovalRecordId` in candidate input

#### Issue 2: No Exact SHA Binding to M4 Approval
- **Severity:** CRITICAL
- **Location:** `src/materialization/materialization-service.ts:305-308`
- **Evidence:**
  ```typescript
  source: {
    repository: candidate.upstreamRepository,
    branch: candidate.upstreamBranch,
    commitSha: candidate.upstreamCommit,  // ← PASSED THROUGH UNVERIFIED
  },
  ```
- **Problem:** SHA is passed through from caller without verifying it matches M4's approved SHA. Chain of trust is broken.
- **Recommended Fix:**
  1. Add `M4ApprovalProof` interface containing `approvalRecordId`, `approvedSha`, `approvalTimestamp`, `reviewerId`
  2. Require this proof in `ApprovedCandidateInfo`
  3. Verify `candidate.upstreamCommit === m4ApprovalProof.approvedSha`

#### Issue 3: No Plan Tampering Resistance
- **Severity:** CRITICAL
- **Location:** `src/cli/materialize.ts:402-415`
- **Evidence:**
  ```typescript
  if (planFile) {
    const content = readFileSync(planFile, 'utf-8');
    plan = JSON.parse(content);  // ← NO INTEGRITY CHECK
    log(`Loaded plan from: ${planFile}`);
  }
  ```
- **Problem:** Loaded plans can be modified after generation. An attacker can generate a valid plan for SHA-AAA, then modify the SHA to SHA-BBB, and execute the modified plan.
- **Recommended Fix:**
  1. Add `planId` and `planHash` fields to `MaterializationPlan`
  2. Compute SHA-256 of canonical plan content at generation time
  3. Verify hash before execution in `executePlan()`
  4. (See Section 5 for important clarification on plan signing)

### MAJOR Issues

#### Issue 4: No Immutable Preservation Model
- **Severity:** MAJOR
- **Location:** `src/materialization/materialization-service.ts:363-388`
- **Evidence:**
  ```typescript
  private extractArchiveFiles(archivePath: string): CommittedFile[] {
    const tempDir = path.join(process.cwd(), '.tmp', `extract-${Date.now()}`);
    // ... extracts to ephemeral temp directory
  }
  ```
- **Problem:** No Git-based immutable preservation. Archives stored in local filesystem. AAA and BBB independence not guaranteed.
- **Recommended Fix:**
  1. Define Git-based preservation layout: `materialized/<sha>/`
  2. Ensure each SHA gets immutable directory
  3. M6 should be able to request deterministic materialization

#### Issue 5: Provenance Local-Only
- **Severity:** MAJOR
- **Location:** `src/materialization/materialization-service.ts:625-643`
- **Evidence:**
  ```typescript
  async saveProvenanceRecord(record: ProvenanceRecord): Promise<void> {
    const dir = path.join(this.config.provenanceDir, record.pluginId);
    // ← Writes to local filesystem only
  }
  ```
- **Problem:** Provenance written to local filesystem (`./provenance/`). Will NOT survive runner destruction. No canonical trusted store.
- **Recommended Fix:**
  1. Define canonical provenance store (GitHub repo or cloud storage)
  2. Implement cross-run persistence
  3. Add provenance replication/backup

#### Issue 6: No Idempotency/Conflict Detection
- **Severity:** MAJOR
- **Location:** `src/materialization/materialization-service.ts:491-495`
- **Evidence:**
  ```typescript
  if (failedActions === 0 && executedActions > 0) {
    provenance = this.generateProvenanceRecord(plan, finalCommitSha);
  }
  // ← Will OVERWRITE existing provenance without warning
  ```
- **Problem:** No ALREADY_MATERIALIZED detection. No CONFLICT detection. Re-running materialization silently replaces provenance.
- **Recommended Fix:**
  ```typescript
  // Check before materialization:
  const existing = await this.loadProvenanceRecord(plan.pluginId, plan.version);
  if (existing) {
    if (existing.upstreamCommit === plan.source.commitSha) {
      return { success: true, alreadyMaterialized: true };
    } else {
      return { success: false, conflict: true };
    }
  }
  ```

#### Issue 7: No Source Integrity Verification
- **Severity:** MAJOR
- **Location:** `src/materialization/materialization-service.ts:614-617`
- **Evidence:**
  ```typescript
  sourceIntegrity: {
    fileCount: 0,              // ← HARDCODED ZEROS
    checksumVerified: false,   // ← ALWAYS FALSE
    archivedAt: new Date().toISOString(),
  },
  ```
- **Problem:** No SHA-256 digest computation. No normalized source tree. M6 cannot verify integrity.
- **Recommended Fix:**
  1. Compute SHA-256 of source archive
  2. Compute SHA-256 of normalized source tree
  3. Set `checksumVerified: true` when computed

### MINOR Issues

#### Issue 8: Production Hardcoded Values
- **Severity:** MINOR
- **Location:** Multiple files
- **Evidence:**
  ```
  src/cli/materialize.ts:99: const MAT_STORAGE_OWNER = ... || 'axolotl-pm-plugins';
  src/materialization/repository-naming.ts:14: export const DEFAULT_STORAGE_OWNER = 'axolotl-pm-plugins';
  src/materialization/materialization-service.ts:233: ... ?? 'axolotl-pm-plugins';
  ```
- **Problem:** Production GitHub org `axolotl-pm-plugins` hardcoded throughout. Risk of accidental writes.
- **Recommended Fix:** All references via environment variables with validation.

#### Issue 9: No Explicit materialization_id
- **Severity:** MINOR
- **Location:** `src/materialization/materialization-types.ts:125-159`
- **Evidence:** Identity implied by `pluginId + version + upstreamRepository + upstreamCommit`
- **Problem:** No explicit collision handling or shortened hash protection
- **Recommended Fix:** Add explicit `materialization_id` field with collision handling

---

## 5. Important Architectural Clarification

### Plan Hash vs. Authentication

**CRITICAL WARNING:** A plain SHA-256 `planHash` does **NOT** authenticate a `MaterializationPlan` because:

1. A caller who can modify the plan can also recompute an unkeyed hash
2. An attacker can:
   - Generate valid plan for SHA-AAA
   - Modify SHA to SHA-BBB
   - Recompute SHA-256 of modified plan
   - Execute modified plan with valid hash

### Preferred Trust Model

The correct trust model is:

1. **MaterializationPlan is NOT an authorization credential**
   - It describes intended actions, not grants permission

2. **executePlan() must fail closed**
   - Before any mutation, revalidate ALL security-critical fields against M4 state
   - Do NOT trust plan content for authorization decisions

3. **Required M4 validations (independently verified):**
   - Candidate identity exists in M4
   - Effective state is APPROVED
   - Upstream repository matches M4 record
   - Exact approved SHA matches plan's SHA

4. **Plan signing (if ever introduced):**
   - Must use HMAC with trusted secret key, OR
   - Must use asymmetric signing with private key held by M4, OR
   - Plain hash alone is insufficient for authentication

### Why M4 State Must Be Rechecked

```
Attacker flow (without M4 revalidation):
  1. Get valid plan for SHA-AAA
  2. Modify plan SHA to SHA-BBB
  3. Recompute hash
  4. executePlan() accepts plan → BAD

Defender flow (with M4 revalidation):
  1. Load plan (possibly tampered)
  2. Query M4: what SHA was approved for this candidate?
  3. Compare plan SHA to M4 approved SHA
  4. If mismatch → FAIL CLOSED
  5. Only proceed if SHA matches M4 approval
```

---

## 6. Required Invariants

These invariants **MUST** hold after M5 corrections:

### APPROVED SHA Invariant
```
APPROVED SHA
==
ACQUIRED SHA
==
MATERIALIZED SHA
==
PROVENANCE UPSTREAM SHA
```

### Materialization Identity Invariants
```
same approved candidate
→ deterministic materialization identity

same valid materialization
→ ALREADY_MATERIALIZED

conflicting trusted state
→ fail closed

AAA and BBB
→ independent immutable materializations
```

### Provenance Invariant
```
Canonical provenance must survive runner destruction
```

---

## 7. Exact Affected Files and Functions

| File | Functions/Classes | Issues |
|------|------------------|--------|
| `src/materialization/materialization-service.ts` | `generatePlan()`, `executePlan()`, `generateProvenanceRecord()` | Trust boundary, SHA binding, idempotency, source integrity |
| `src/cli/materialize.ts` | `handlePlan()`, `handleExecute()`, `findCandidateArchive()` | Plan tampering, hardcoded values |
| `src/materialization/materialization-types.ts` | `MaterializationPlan`, `ApprovedCandidateInfo`, `ProvenanceRecord` | Missing fields for trust |
| `src/materialization/github-client.ts` | `RealGitHubClient` | STUB - not implemented |
| `src/materialization/repository-naming.ts` | Constants | Hardcoded `axolotl-pm-plugins` |

---

## 8. Recommended Corrections

### Phase 1: Trust Boundary (M4 → M5)

```typescript
// Add to MaterializationService constructor
interface M4StorageAdapter {
  getCandidate(pluginId: PluginId, sha: GitSha): Promise<CandidateInfo | null>;
  getApprovalRecord(pluginId: PluginId, sha: GitSha): Promise<ReviewRecord | null>;
  getEffectiveState(pluginId: PluginId, sha: GitSha): Promise<EffectiveReviewState>;
}

// Add to ApprovedCandidateInfo
interface ApprovedCandidateInfo {
  // ... existing fields ...
  m4ApprovalRecordId: string;  // REQUIRED
}

// Add to generatePlan()
const m4State = await this.m4Storage.getEffectiveState(
  candidate.pluginId,
  candidate.upstreamCommit
);
if (m4State !== EffectiveReviewState.APPROVED) {
  errors.push({ code: 'CANDIDATE_NOT_APPROVED_IN_M4', ... });
}
```

### Phase 2: SHA Binding

```typescript
// Add M4ApprovalProof
interface M4ApprovalProof {
  approvalRecordId: string;
  approvedSha: GitSha;
  approvalTimestamp: string;
  reviewerId: number;
}

// Verify in generatePlan()
if (candidate.m4ApprovalProof.approvedSha !== candidate.upstreamCommit) {
  errors.push({ code: 'SHA_MISMATCH_APPROVAL_PROOF', ... });
}
```

### Phase 3: Plan Integrity

```typescript
// Add to MaterializationPlan
interface MaterializationPlan {
  // ... existing fields ...
  planId: string;
  planHash: string;  // HMAC-SHA256 with trusted key, NOT plain hash
}

// Verify in executePlan()
if (!verifyPlanSignature(plan, trustedKey)) {
  return { success: false, error: 'PLAN_INVALID' };
}
```

### Phase 4: Idempotency

```typescript
// Check at start of executePlan()
const existing = await this.loadProvenanceRecord(plan.pluginId, plan.version);
if (existing) {
  if (existing.upstreamCommit === plan.source.commitSha) {
    return { success: true, alreadyMaterialized: true };
  }
  return { success: false, conflict: true };
}
```

---

## 9. Tests Currently Missing

### Critical Missing Tests

| Test | Purpose | Priority |
|------|---------|----------|
| Trust boundary test | Verify M4 validation in `generatePlan()` | CRITICAL |
| SHA binding test | Verify SHA matches M4 approval | CRITICAL |
| Plan tampering test | Verify tamper detection | CRITICAL |
| Idempotency test | ALREADY_MATERIALIZED detection | MAJOR |
| Conflict test | SHA mismatch handling | MAJOR |
| Source integrity test | Checksum computation | MAJOR |

### Current Test Coverage

| Test File | Coverage |
|-----------|----------|
| `materialization-types.test.ts` | ✅ Type validation |
| `materialization-service.test.ts` | ⚠️ Partial - plan generation, provenance |
| `github-client.test.ts` | ⚠️ Client operations |
| `repository-naming.test.ts` | ✅ Naming logic |

---

## 10. Changes Made During Audit

**No code changes were made during the audit.**

The audit was read-only, examining existing implementation without modifications.

---

## 11. Current Working-Tree State

```
M .github/workflows/submission-check.yml
M package.json
M src/submission/acquisition.ts
M src/submission/index.ts
?? config/
?? src/cli/materialize.ts
?? src/cli/review.ts
?? src/materialization/
?? src/review/
?? test-cli-fixtures/
?? tests/materialization/
?? tests/review/
?? tests/submission/acquisition.test.ts
?? tests/submission/fixtures.ts
```

### Git Diff Summary (Modified Files)
```
.github/workflows/submission-check.yml | 366 ++++++++++-------------
package.json                           |  12 +-
src/submission/acquisition.ts          | 438 +++++++++++++++++++++++++++-----
src/submission/index.ts                |   2 +
4 files changed, 572 insertions(+), 246 deletions(-)
```

### Untracked Directories
- `config/` - Configuration files
- `src/materialization/` - M5 implementation (NEW)
- `src/review/` - M4 implementation (NEW)
- `test-cli-fixtures/` - CLI test fixtures
- `tests/materialization/` - M5 tests (NEW)
- `tests/review/` - M4 tests (NEW)
- `tests/submission/` - M1-M3 tests (NEW)

---

## 12. Verification Status

### Commands Actually Run

```bash
# File listing
ls -la /d/DevPocketMine/PluginRepository/tests/materialization/
# Result: 4 test files found

# Type tests
cat /d/DevPocketMine/PluginRepository/tests/materialization/materialization-types.test.ts
# Result: Reviewed successfully

# Service tests (Read tool - no output visible)
# Source files: Read successfully

# Git status
git status --short
# Result: See Section 11

# Git diff
git diff --stat
# Result: See Section 11
```

### NOT Run (Per Instructions)
- `npm test` or any test execution
- Live GitHub API calls
- Any write operations to GitHub
- Any operations affecting `axolotl-pm` or `axolotl-pm-pl`

---

## 13. Scope Boundary

### DO NOT

1. **Do not begin M6** - PHAR building is out of scope until M5 corrections complete

2. **Do not perform live GitHub writes** - RealGitHubClient may remain unimplemented

3. **Do not touch axolotl-pm or axolotl-pm-pl** - Production organizations must not be affected

4. **Do not claim M5 is complete** - Current status is NOT READY FOR E2E

### Future E2E Authorization

Real end-to-end testing is restricted to:
- Repository: `poggit-alternative-test`
- Requires explicit authorization before execution

### RealGitHubClient Status

The `RealGitHubClient` class is a STUB that throws `"not implemented"` for write operations. It may remain unimplemented until:
1. M5 domain corrections are complete
2. Trust boundary is established
3. SHA binding is verified
4. Plan integrity is implemented

---

## 14. Handoff Checklist

Before beginning M5 corrections, verify:

- [ ] M4 storage interface designed
- [ ] M4ApprovalProof type defined
- [ ] Trust boundary tests designed
- [ ] Plan signing mechanism chosen (HMAC vs asymmetric)
- [ ] Provenance store location decided
- [ ] Preservation model designed
- [ ] Idempotency/conflict semantics defined
- [ ] Source integrity computation specified

---

## Summary

M5 requires significant architectural changes to establish trust boundaries with M4 before it can be considered ready for end-to-end testing. The critical path is:

1. **Trust Boundary** (M4 validation)
2. **SHA Binding** (exact SHA verification)
3. **Plan Integrity** (tamper resistance)
4. **Idempotency** (conflict detection)

These corrections establish the foundation for reliable, auditable source materialization.

---

**END OF HANDOFF DOCUMENT**
