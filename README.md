# Axolotl Plugin Repository

A GitHub-native plugin repository and build system for the PocketMine-MP ecosystem.

> **Note:** This project is in the architecture design phase.

---

## What is This?

The Axolotl Plugin Repository provides:

- **Trusted Plugin Distribution**: Developers submit plugins, we preserve and build trusted PHARs
- **Human Security Review**: Every version reviewed by humans before publication
- **GitHub-Native**: Uses PRs, Actions, and Releases - no custom backend
- **Provenance**: Clear source-to-artifact chain

## Key Architecture

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
APPROVED SOURCE SHA
    |
    v
STORAGE MATERIALIZATION
(axolotl-pm-pl/<plugin>)
    |
    | exact reviewed source
    v
UNPRIVILEGED BUILD (NO publication credentials)
    |
    +--> PHAR
    +--> SHA-256
    +--> provenance
    |
    v
PRIVILEGED PUBLISHER (no plugin code execution)
    |
    v
IMMUTABLE GITHUB RELEASE
(axolotl-pm-pl/<plugin>)
    |
    v
STATIC SITE GENERATION
    |
    v
GITHHub PAGES
```

## Organizations

| Organization | Purpose |
|--------------|---------|
| `axolotl-pm` | Main infrastructure, registry, tooling |
| `axolotl-pm-pl` | Approved plugin storage and releases |

## Trust Model

| Level | Description |
|-------|-------------|
| Untrusted | Developer upstream repository |
| Reviewed | Passed validation and human review |
| Approved | Recorded as eligible for storage |
| Stored | Preserved in axolotl-pm-pl |
| Verified | Built PHAR with provenance |

**Important**: Human review reduces risk. It does not prove safety.

## Security Principles

1. **No Implicit Trust**: CI success != Approval
2. **Exact SHA**: Only reviewed commits become eligible
3. **Hard Separation**: Build and publish are separate domains
4. **No Secrets in Build**: Builder has no publication credentials
5. **Immutable Releases**: Published artifacts cannot be silently replaced

## Registry Structure

```
registry/
└── plugins/
    └── {plugin-id}/
        ├── plugin.yaml        # Plugin identity
        └── versions/
            ├── 1.0.0.yaml    # Version record
            └── 2.0.0.yaml
```

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, lifecycle, storage strategy |
| [SECURITY.md](docs/SECURITY.md) | Trust model, threat analysis, controls |
| [REVIEW_POLICY.md](docs/REVIEW_POLICY.md) | Human review requirements |
| [SUBMISSION.md](docs/SUBMISSION.md) | Developer submission guide |

## Plugin Lifecycle

```
SUBMITTED -> VALIDATING -> READY_FOR_REVIEW
                                    |
                +-------------------+-------------------+
                |                   |                   |
                v                   v                   v
           CHANGES            APPROVED              REJECTED
           REQUESTED               |
                                  v
                         STORAGE_MATERIALIZING
                                  |
                                  v
                         STORAGE_MATERIALIZED
                                  |
                                  v
                         BUILDING (unprivileged)
                                  |
                                  v
                         BUILD_COMPLETE
                                  |
                                  v
                         PUBLISHING (privileged)
                                  |
                                  v
                         PUBLISHED
```

## Current Status

| Milestone | Status |
|-----------|--------|
| 1. Architecture | In Review |
| 2. Registry + Schema | Pending |
| 3. Submission CI | Pending |
| 4. Storage Materialization | Pending |
| 5. Build Pipeline | Pending |
| 6. Publication Pipeline | Pending |
| 7. Static Website | Pending |
| 8. Security Hardening | Pending |

## For Plugin Developers

See [SUBMISSION.md](docs/SUBMISSION.md) for how to submit your plugin.

## For Reviewers

See [REVIEW_POLICY.md](docs/REVIEW_POLICY.md) for review requirements.

## Contributing

This project is in early development. See the GitHub Issues for planned work.

## License

To be determined.
