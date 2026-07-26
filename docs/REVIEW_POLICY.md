# Axolotl Plugin Repository — Review Policy

**Version:** 2.2.0
**Status:** Draft for Review
**Last Updated:** 2026-07-25

---

## Table of Contents

1. [Introduction](#introduction)
2. [What Review Means](#what-review-means)
3. [Review Requirements](#review-requirements)
4. [Reviewer Selection](#reviewer-selection)
5. [Review Process](#review-process)
6. [Review Checklist](#review-checklist)
7. [Approval Recording](#approval-recording)
8. [Post-Approval Process](#post-approval-process)
9. [Stale Approval Handling](#stale-approval-handling)
10. [Version Updates](#version-updates)
11. [Conflict of Interest](#conflict-of-interest)
12. [Appeals Process](#appeals-process)
13. [Incident Response](#incident-response)

---

## Introduction

### Purpose

This document defines human review requirements for the Axolotl Plugin Repository. Human review is a **mandatory risk reduction control**.

### What Human Review Cannot Do

Human review **cannot**:
- Mathematically prove absence of malicious code
- Guarantee absence of vulnerabilities
- Predict future security issues
- Detect sophisticated obfuscation
- Guarantee code quality

Human review **can**:
- Find known policy-blocking issues
- Detect obvious malicious patterns
- Assess code quality at point of review
- Provide human judgment on intent
- Reduce (not eliminate) risk

---

## What Review Means

### Accurate Statement

> "The reviewer found no known policy-blocking or malicious behavior during review of the exact submitted source commit."

### What This Guarantees

- Reviewer personally examined the code
- No obvious issues found at time of review
- Code meets baseline standards
- Approved for distribution eligibility

### What This Does NOT Guarantee

- Plugin is secure
- Plugin has no vulnerabilities
- Plugin is benign
- Plugin will not cause harm
- Plugin is mathematically safe

---

## Review Requirements

### Mandatory Requirements for Approval

A plugin version can only be approved if ALL are true:

1. **Automated Validation Passed**
   - All CI checks completed
   - No validation errors
   - Build feasibility confirmed

2. **Human Security Review Complete**
   - Designated reviewer examined code
   - Security checklist completed
   - No critical issues found

3. **Human Quality Review Complete**
   - Code reviewed for quality
   - No severe quality issues
   - Documentation adequate

4. **Exact Commit SHA Reviewed**
   - Reviewer examined specific SHA
   - SHA recorded in registry
   - SHA will be preserved in storage

### What Reviewers Must NOT Do

- **Approve based on branch name** (must be specific SHA)
- **Approve based on "latest"** (must be specific commit)
- **Assume automation handled security**
- **Skip manual code review**
- **Approve changes they didn't review**

---

## Reviewer Selection

### CODEOWNERS Assignment

```github
# Syntax: path @username

# All plugin submissions require plugin-review team
/registry/plugins/ @axolotl/plugin-review-team
```

### Reviewer Responsibilities

By approving a plugin, reviewer attests:

1. They personally reviewed the exact code at the approved SHA
2. They found no policy-blocking issues during review
3. Automated checks found no critical problems
4. Code meets baseline quality standards
5. They accept responsibility for their approval decision

### Reviewer Requirements

1. GitHub account in good standing
2. Basic PHP/code review capability
3. PocketMine plugin structure knowledge
4. No conflicts with submitted plugin

---

## Review Process

### Step 1: Review Assignment

- CODEOWNERS assigns reviewer
- Reviewer notified via GitHub
- Review claim optional but appreciated

### Step 2: Identify Exact SHA

```
Plugin: TopStats
Version: 2.1.0
Upstream: nicholass003/TopStats
Branch: main
Review commit: b93f1e987654321abcdef123456789abcdef1234
```

**Critical**: Reviewer must identify and record the EXACT SHA.

### Step 3: Manual Code Review

1. Clone/fetch from upstream at approved SHA
2. Review all code files
3. Complete security checklist
4. Complete quality checklist
5. Note any concerns or justifications

### Step 4: Decision

#### APPROVED

All checks passed, no blockers found.

**Required**:
- SHA recorded
- Review documented
- Reviewer approval recorded in PR

#### CHANGES REQUESTED

Issues found that should be fixed.

**Required**:
- Specific issues documented
- Clear explanation of required changes
- Developer must fix and resubmit

#### REJECTED

Critical issues that cannot be approved.

**Required**:
- Clear rejection reason
- Policy reference if applicable
- Appeal process explained

### Step 5: Record Approval

After approval decision:

```yaml
# In versions/{version}.yaml (created by automation)
review:
  pull_request: 58
  reviewer: axolotl-reviewer
  approved_at: 2026-08-05T09:15:00Z
  commit: b93f1e987654321abcdef123456789abcdef1234
```

---

## Review Checklist

### Security Assessment

#### Critical Issues (Automatic Rejection)

- [ ] Obfuscated code hiding functionality
- [ ] Base64-encoded strings without clear purpose
- [ ] eval() or dynamic code execution
- [ ] System command execution (system, exec, shell_exec)
- [ ] Credential theft mechanisms
- [ ] Data exfiltration without consent
- [ ] Hidden backdoors
- [ ] Deliberate vulnerabilities
- [ ] Embedded malware

#### High Priority (Require Justification)

- [ ] External network requests to unknown servers
- [ ] File operations outside plugin directory
- [ ] SQL without parameterization
- [ ] Insufficient input validation
- [ ] Potential RCE vulnerabilities

#### Medium Priority (Should Be Fixed)

- [ ] Missing permission checks
- [ ] Inadequate error handling
- [ ] Hardcoded credentials
- [ ] Debug code in production

#### Low Priority (Nice to Have)

- [ ] Code formatting
- [ ] Missing documentation
- [ ] Performance improvements

### Quality Assessment

- [ ] Code readable and understandable
- [ ] No obviously broken code
- [ ] Proper namespace usage
- [ ] Appropriate class structure
- [ ] README exists and explains plugin
- [ ] Commands documented
- [ ] Permissions documented

### Functional Assessment

- [ ] Plugin does what description claims
- [ ] No misleading functionality
- [ ] No hidden premium features
- [ ] No deceptive behavior

### Policy Compliance

- [ ] Code is original or properly licensed
- [ ] No stolen code
- [ ] No trademark violations
- [ ] Appropriate for platform

---

## Approval Recording

### Registry Entry Created

```yaml
# registry/plugins/topstats/versions/2.1.0.yaml
schema_version: 1

version: 2.1.0

source:
  upstream_commit: b93f1e987654321abcdef123456789abcdef1234

review:
  pull_request: 58
  reviewer: axolotl-reviewer
  approved_at: 2026-08-05T09:15:00Z
  status: approved

# storage, artifact fields added later
```

### PR Review Recorded

GitHub PR approval:
- Review type: APPROVED
- Body: Review summary and checklist completion

### What Happens After Approval

1. Approval becomes "eligible for storage"
2. Storage materialization workflow triggered
3. Fork created/updated in axolotl-pm-pl
4. Approved SHA imported
5. Storage commit recorded
6. Build triggered
7. Publication triggered

---

## Post-Approval Process

### After Approval Recorded

```
Approval SHA recorded
    |
    v
STORAGE_MATERIALIZING
    |
    | Create/update fork in axolotl-pm-pl
    | Import approved SHA
    | Verify SHA
    v
STORAGE_MATERIALIZED
    |
    | storage_commit recorded
    v
BUILD_TRIGGERED
    |
    | Unprivileged build
    | No publication credentials
    v
BUILD_COMPLETE
    |
    | Artifacts: PHAR, SHA-256, metadata
    v
PUBLISH_TRIGGERED
    |
    | Privileged publisher
    | No plugin code execution
    v
PUBLISHED
    |
    | Immutable release
    | Registry updated
    v
AVAILABLE
```

### Reviewer Involvement

After approval, reviewer is NOT involved in:
- Storage materialization
- Build process
- Publication

Reviewer's job is complete when:
- Approval recorded
- SHA recorded
- PR approved

---

## Stale Approval Handling

### Common Misunderstanding

Developer pushes new commits after approval. This does NOT invalidate the existing approval.

### Correct Model

```
main branch:
AAA ---- BBB ---- CCC
|
+---- SHA AAA approved

SHA AAA remains approved.
SHA BBB is NOT approved.
SHA CCC is NOT approved.
```

**Approval is tied to the exact SHA, not the branch.**

### When Approval Becomes Invalid

| Event | Before Materialization | After Materialization |
|-------|----------------------|----------------------|
| Developer pushes SHA BBB | Still VALID | Still VALID |
| Branch moves forward | Still VALID | Still VALID |
| Developer force-pushes removing AAA | INVALID (AAA cannot be materialized) | Still VALID |
| Developer deletes branch | INVALID (AAA may be gc'd) | Still VALID |
| Reviewer explicitly revokes | INVALID | INVALID |

**Before materialization**: The approved SHA must be fetchable from upstream. If a force-push or branch deletion removes the approved SHA, materialization fails and a new submission is required.

**After materialization**: The SHA exists in Axolotl-controlled storage. Upstream changes (force-push, deletion, etc.) are irrelevant.

### Build Verification

The system builds EXACTLY the approved SHA:
- Approved SHA = AAA
- System fetches AAA from storage
- System builds AAA
- Branch position is IRRELEVANT

### What This Means

- You can continue developing after approval
- Your new commits do not affect the approved version
- Only the exact approved SHA will be built
- New versions require new submissions and reviews

### If Approved SHA No Longer Exists

If a force-push or branch deletion removes the approved SHA:
1. The system cannot build the version
2. A new submission is required
3. The old approval is void

---

### Implementation

The build workflow verifies the SHA from Axolotl-controlled storage, NOT upstream HEAD:

```yaml
# Build verification step (CORRECT)
- name: Verify storage SHA
  run: |
    # Fetch from Axolotl storage at recorded commit
    STORAGE_COMMIT="${{ env.STORAGE_COMMIT }}"

    # Verify we're at the correct commit
    ACTUAL=$(git rev-parse HEAD)
    EXPECTED="$STORAGE_COMMIT"

    if [ "$ACTUAL" != "$EXPECTED" ]; then
      echo "Storage SHA mismatch!"
      echo "Expected: $EXPECTED"
      echo "Actual: $ACTUAL"
      exit 1
    fi

    # Note: UPSTREAM HEAD IS IRRELEVANT after materialization
```

**What the build MUST NOT do:**

```yaml
# WRONG - Do NOT check upstream HEAD
- name: Verify upstream hasn't changed
  run: |
    UPSTREAM_HEAD=$(git ls-remote origin HEAD | cut -f1)
    APPROVED_SHA="${{ env.APPROVED_SHA }}"
    if [ "$UPSTREAM_HEAD" != "$APPROVED_SHA" ]; then
      echo "Upstream has changed!"
      exit 1  # This is INCORRECT behavior
    fi
```

After materialization, upstream changes are irrelevant. The system builds from Axolotl storage at the preserved commit.

---

## Version Updates

### Every Version Requires Review

```
v1.0.0 - SHA AAA - reviewed - published
v2.0.0 - SHA BBB - reviewed - published
v2.1.0 - SHA CCC - reviewed - published
```

**New upstream version does NOT automatically become trusted.**

### Update Process

```
Developer releases v2.2.0
    |
    | New commit SHA DDD
    v
New submission PR
    |
    | Points to new SHA
    v
Automated validation
    |
    v
Human review of SHA DDD
    |
    v
Approval
    |
    v
Storage materialization
    |
    v
Build
    |
    v
Publication
```

### Previous Versions

Approved versions remain available unless:
- Revoked due to security issue
- Removed by incident policy

---

## Conflict of Interest

### Disclosure Required

Reviewers must disclose:
- Plugin authorship or co-authorship
- Financial interest in plugin
- Personal relationship with developer
- Employment conflict

### Handling

If conflict exists:
- Another reviewer assigned
- Conflicted reviewer does not review
- Decision documented

---

## Appeals Process

### Grounds for Appeal

- Rejection based on incorrect information
- Misunderstanding of plugin functionality
- Issue can be addressed differently
- Policy misapplied

### Process

1. Developer opens appeal issue
2. Original rejection documented
3. Appeal evaluated by senior reviewer
4. Decision: upheld, reversed, or remanded

### Outcomes

| Outcome | Description |
|---------|-------------|
| Upheld | Original rejection stands |
| Reversed | Approval granted |
| Remanded | Returned for re-review |

---

## Incident Response

### Post-Publication Monitoring

After publication:
- Monitor user reports
- Track vulnerability disclosures
- Review plugin updates
- Watch for policy violations

### If Issue Discovered

```
Security issue reported
    |
    v
Assess severity
    |
    +--> Critical
    |     |
    |     v
    |     Mark revoked
    |     Remove from discovery
    |     Preserve release for audit
    |
    +--> Medium/Low
          |
          v
          Deprecate version
          Recommend update
```

### Removal vs Revocation

**Revocation preferred over deletion** because:
- Preserves audit trail
- Allows investigation
- Users can still verify downloaded versions
- Incident evidence preserved

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-07-25 | 1.0.0 | Initial review policy |
| 2026-07-25 | 2.0.0 | Clarified review meaning, separated storage, added stale handling |
| 2026-07-25 | 2.1.0 | Fixed exact-SHA approval semantics: approval remains valid even if upstream advances |
| 2026-07-25 | 2.2.0 | Fixed approval validity table for pre/post materialization, fixed build verification example (no UPSTREAM_HEAD check) |

---

**Next Step**: Proceed to Milestone 3 implementation.
