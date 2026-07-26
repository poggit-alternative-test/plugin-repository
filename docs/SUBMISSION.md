# Axolotl Plugin Repository — Submission Guide

**Version:** 2.2.0
**Status:** Draft for Review
**Last Updated:** 2026-07-25

---

## Table of Contents

1. [Overview](#overview)
2. [How Trust Works](#how-trust-works)
3. [Prerequisites](#prerequisites)
4. [Submission Process](#submission-process)
5. [Registry Entry Format](#registry-entry-format)
6. [After Submission](#after-submission)
7. [Update Process](#update-process)
8. [Common Questions](#common-questions)
9. [Support](#support)

---

## Overview

This guide explains how to submit your PocketMine-MP plugin to the Axolotl Plugin Repository.

### What is the Axolotl Plugin Repository?

A trusted distribution channel for PocketMine-MP plugins.

When you submit:
1. Your code is automatically validated
2. Human reviewers verify security and quality
3. Your approved commit is preserved
4. Axolotl builds the trusted PHAR
5. Your plugin is published

### Key Principles

- **You provide source code, we build the PHAR**
- **Every version requires human review**
- **Only reviewed commits become eligible**
- **Your code stays in your repository**
- **We create preservation storage in axolotl-pm-pl**
- **Builds come from preservation storage, not your repo**

---

## How Trust Works

### Trust Flow

```
Your Repository (UNTRUSTED)
      |
      | You submit PR with exact SHA
      v
Automated Validation
      |
      v
Human Review of exact SHA
      |
      v
SHA Approved (eligible for storage)
      |
      v
Storage Materialization
axolotl-pm-pl/<plugin>
      |
      v
Approved SHA Preserved
      |
      v
Build from Storage (UNPRIVILEGED)
      |
      v
Verified PHAR Created
      |
      v
Publisher (PRIVILEGED, no code execution)
      |
      v
Immutable Release on axolotl-pm-pl
```

### What This Means

- **Your upstream changes are NOT automatically trusted**
- **Only the reviewed commit SHA becomes eligible**
- **We create a preservation copy, you don't control it**
- **Builds come from our storage, not your repository**

### What Review Means

Human review found no known policy-blocking issues at time of review. Review:
- Reduces risk
- Does not eliminate it
- Does not prove the plugin is safe
- Does not guarantee security

---

## Prerequisites

### Repository Requirements

Your plugin repository must:
- [ ] Be publicly accessible on GitHub
- [ ] Contain a valid `plugin.yml` file
- [ ] Have a standard plugin structure
- [ ] Target a supported PocketMine API version

### Plugin Requirements

Your plugin must:
- [ ] Have a unique, valid name
- [ ] Follow semantic versioning
- [ ] Have a descriptive README
- [ ] Be your original work (or properly licensed)
- [ ] Comply with review policy

### Account Requirements

- [ ] GitHub account
- [ ] Basic Git knowledge

---

## Submission Process

### Step 1: Fork the Registry

Fork `axolotl-pm/axolotl-plugin-repository` to your GitHub account.

### Step 2: Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/axolotl-plugin-repository.git
cd axolotl-plugin-repository
```

### Step 3: Create Registry Entry

Create directory structure:

```
registry/plugins/{plugin-id}/
registry/plugins/{plugin-id}/plugin.yaml
```

Use your plugin's name in lowercase.

### Step 4: Fill Registry Entry

Only provide identity information:

```yaml
upstream:
  repository: nicholass003/TopStats
  branch: main
```

**Do NOT provide**:
- Version number (extracted from your plugin.yml)
- API version (extracted from your plugin.yml)
- Author (extracted from your plugin.yml)
- Description (extracted from your plugin.yml)

### Step 5: Commit and Push

```bash
git add registry/plugins/topstats/
git commit -m "Add TopStats to registry"
git push origin main
```

### Step 6: Create Pull Request

Open PR on `axolotl-pm/axolotl-plugin-repository`.

### Step 7: Complete PR Template

```markdown
## Plugin Submission

### Plugin Name
TopStats

### Short Description
Advanced player statistics tracking

### Repository
https://github.com/nicholass003/TopStats

### Branch
main

### Checklist
- [ ] I have read the Review Policy
- [ ] I understand human review is required
- [ ] Only the reviewed commit will be used
- [ ] CI passing does NOT mean approved
```

---

## Registry Entry Format

### Plugin Identity (`plugin.yaml`)

```yaml
# Only identity information - system derives everything else

upstream:
  repository: nicholass003/TopStats
  branch: main
```

### Version Records (Created by System)

After approval, system creates:

```yaml
# registry/plugins/topstats/versions/2.1.0.yaml
schema_version: 1

version: 2.1.0

source:
  upstream_commit: b93f1e...

review:
  pull_request: 58
  reviewer: axolotl-reviewer
  approved_at: 2026-08-05T09:15:00Z

storage:
  commit: b93f1e...
  repository: axolotl-pm-pl/TopStats

artifact:
  release_tag: v2.1.0
  file: TopStats.phar
  sha256: abc123...
  published_at: 2026-08-05T10:00:00Z

status: published  # Top-level lifecycle discriminant
```

---

## After Submission

### What Happens Next

1. **Automated Validation** (minutes)
   - Repository accessibility check
   - plugin.yml validation
   - Security pattern scan
   - Build feasibility check

2. **Human Review** (days to weeks)
   - Assigned to reviewer
   - Code review
   - Security assessment
   - Possible changes requested

3. **Approval** (if successful)
   - Exact SHA recorded
   - PR approved by reviewer
   - PR merged

4. **Storage Materialization** (automatic)
   - Fork created in axolotl-pm-pl
   - Approved SHA imported
   - SHA verified

5. **Build** (automatic)
   - PHAR built from storage
   - No publication credentials
   - SHA-256 calculated

6. **Publication** (automatic)
   - Immutable release created
   - PHAR attached
   - Website updated

### Checking Status

Watch your PR for updates:
- Labels applied
- CI status
- Reviewer comments

### If Changes Requested

1. Make changes in your upstream repository
2. Push to the same branch
3. PR updates automatically
4. New validation + review cycle

---

## Update Process

### Every Version Requires Review

```
v1.0.0 - reviewed - published
v2.0.0 - reviewed - published
v2.1.0 - NEW review required
```

New upstream releases do NOT automatically become trusted.

### Update Steps

1. Release new version in your repository
2. Create new PR (or update existing)
3. Point to new version/commit
4. Wait for validation
5. Wait for review
6. New approval required

---

## Common Questions

### Q: Why do you create a fork?

A: We create a preservation copy in `axolotl-pm-pl`. Your repository is untrusted and can change anytime. Our storage is controlled by us.

### Q: Can I push to your fork?

A: No. The fork is controlled by Axolotl. You cannot push to it.

### Q: What if I push code after approval?

A: Approval is invalidated. New code requires new review.

### Q: What does human review guarantee?

A: Review reduces risk. It does not prove the plugin is safe or secure.

### Q: Where are releases published?

A: On your plugin's fork in `axolotl-pm-pl`:
`https://github.com/axolotl-pm-pl/TopStats/releases`

### Q: Can I delete my upstream repository?

A: Your approved versions remain available in our storage. Your fork in axolotl-pm-pl is preserved.

### Q: What if my plugin has vulnerabilities discovered later?

A: Version may be deprecated or revoked. Releases are not deleted but marked accordingly.

---

## Support

### Documentation
- ARCHITECTURE.md - System design
- SECURITY.md - Security model
- REVIEW_POLICY.md - Review requirements

### Getting Help
- GitHub Discussions for questions
- GitHub Issues for bugs

### Contributing
- Review pending submissions
- Improve documentation
- Report issues

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-07-25 | 1.0.0 | Initial submission guide |
| 2026-07-25 | 2.0.0 | Updated for axolotl-pm-pl storage, clarified trust model |
| 2026-07-25 | 2.1.0 | Clarified exact-SHA approval: your new commits do not affect approved versions |
| 2026-07-25 | 2.2.0 | Fixed version record example: status is top-level, not nested in review/artifact |

---

**Next Step**: Proceed to Milestone 3 implementation.
