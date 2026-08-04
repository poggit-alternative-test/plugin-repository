/**
 * Schema Definitions
 *
 * Zod schemas for registry YAML validation.
 * Provides runtime validation with detailed error messages.
 *
 * IMPORTANT: These schemas validate PERSISTED canonical registry files.
 * All persisted files MUST have explicit schema_version declarations.
 * Internal migration helpers may provide defaults if needed.
 */
import { z } from 'zod';
export declare const SCHEMA_VERSION = 1;
/**
 * Plugin Submission Schema
 *
 * Minimal input from developers. Only contains upstream reference.
 * This is NOT canonical registry state - it's developer-controlled intent.
 *
 * Rejects: approvals, storage, artifact, status, and other system-controlled fields.
 */
export declare const PluginSubmissionSchema: z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    upstream: z.ZodObject<{
        repository: z.ZodString;
        branch: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        branch: string;
    }, {
        repository: string;
        branch?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    schema_version: 1;
    upstream: {
        repository: string;
        branch: string;
    };
}, {
    schema_version: number;
    upstream: {
        repository: string;
        branch?: string | undefined;
    };
}>;
/**
 * Plugin identity schema (canonical registry state)
 *
 * Contains all required fields for a canonical registry entry:
 * - id: stable plugin identifier (required)
 * - upstream: developer repository reference (required)
 * - storage: (optional) populated after materialization
 *
 * schema_version is REQUIRED for persisted files.
 */
export declare const PluginIdentitySchema: z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    id: z.ZodString;
    upstream: z.ZodObject<{
        repository: z.ZodString;
        branch: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        branch: string;
    }, {
        repository: string;
        branch?: string | undefined;
    }>;
    storage: z.ZodOptional<z.ZodObject<{
        repository: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
    }, {
        repository: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    schema_version: 1;
    upstream: {
        repository: string;
        branch: string;
    };
    id: string;
    storage?: {
        repository: string;
    } | undefined;
}, {
    schema_version: number;
    upstream: {
        repository: string;
        branch?: string | undefined;
    };
    id: string;
    storage?: {
        repository: string;
    } | undefined;
}>;
/**
 * Canonical version record schemas with strict lifecycle invariants.
 *
 * Lifecycle status is always at the TOP LEVEL.
 * Status is the canonical discriminant for version state.
 */
/**
 * Approved version - minimum viable canonical record
 * MUST have: version, source, review
 * MUST NOT have: storage, artifact
 */
export declare const ApprovedVersionSchema: z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    status: z.ZodLiteral<"approved">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "approved";
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
}, {
    schema_version: number;
    status: "approved";
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
}>;
/**
 * Materialized version - source preserved in storage
 * MUST have: version, source, review, storage
 * MUST NOT have: artifact
 */
export declare const MaterializedVersionSchema: z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    storage: z.ZodObject<{
        repository: z.ZodString;
        commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        commit: string;
    }, {
        repository: string;
        commit: string;
    }>;
    status: z.ZodLiteral<"materialized">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "materialized";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
}, {
    schema_version: number;
    status: "materialized";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
}>;
/**
 * Published version - release created
 * MUST have: version, source, review, storage, artifact
 */
export declare const PublishedVersionSchema: z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    storage: z.ZodObject<{
        repository: z.ZodString;
        commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        commit: string;
    }, {
        repository: string;
        commit: string;
    }>;
    artifact: z.ZodObject<{
        release_tag: z.ZodString;
        file: z.ZodString;
        sha256: z.ZodString;
        published_at: z.ZodString;
        provenance: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["github-attestation"]>;
        }, "strip", z.ZodTypeAny, {
            type: "github-attestation";
        }, {
            type: "github-attestation";
        }>>;
    }, "strip", z.ZodTypeAny, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }>;
    status: z.ZodLiteral<"published">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "published";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
}, {
    schema_version: number;
    status: "published";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
}>;
/**
 * Deprecated version - no longer recommended
 * MUST have: everything from published
 */
export declare const DeprecatedVersionSchema: z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    storage: z.ZodObject<{
        repository: z.ZodString;
        commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        commit: string;
    }, {
        repository: string;
        commit: string;
    }>;
    artifact: z.ZodObject<{
        release_tag: z.ZodString;
        file: z.ZodString;
        sha256: z.ZodString;
        published_at: z.ZodString;
        provenance: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["github-attestation"]>;
        }, "strip", z.ZodTypeAny, {
            type: "github-attestation";
        }, {
            type: "github-attestation";
        }>>;
    }, "strip", z.ZodTypeAny, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }>;
    status: z.ZodLiteral<"deprecated">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "deprecated";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
}, {
    schema_version: number;
    status: "deprecated";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
}>;
/**
 * Revoked version - security concern identified
 * MUST have: everything from published + revoked_at
 */
export declare const RevokedVersionSchema: z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    storage: z.ZodObject<{
        repository: z.ZodString;
        commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        commit: string;
    }, {
        repository: string;
        commit: string;
    }>;
    artifact: z.ZodObject<{
        release_tag: z.ZodString;
        file: z.ZodString;
        sha256: z.ZodString;
        published_at: z.ZodString;
        provenance: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["github-attestation"]>;
        }, "strip", z.ZodTypeAny, {
            type: "github-attestation";
        }, {
            type: "github-attestation";
        }>>;
    }, "strip", z.ZodTypeAny, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }>;
    revoked_at: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    status: z.ZodLiteral<"revoked">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "revoked";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
    revoked_at: string;
    reason?: string | undefined;
}, {
    schema_version: number;
    status: "revoked";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
    revoked_at: string;
    reason?: string | undefined;
}>;
/**
 * Removed version - removed from public discovery
 * MUST preserve full provenance for audit
 * MUST have: everything from published + removed_at
 */
export declare const RemovedVersionSchema: z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    storage: z.ZodObject<{
        repository: z.ZodString;
        commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        commit: string;
    }, {
        repository: string;
        commit: string;
    }>;
    artifact: z.ZodObject<{
        release_tag: z.ZodString;
        file: z.ZodString;
        sha256: z.ZodString;
        published_at: z.ZodString;
        provenance: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["github-attestation"]>;
        }, "strip", z.ZodTypeAny, {
            type: "github-attestation";
        }, {
            type: "github-attestation";
        }>>;
    }, "strip", z.ZodTypeAny, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }>;
    removed_at: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    status: z.ZodLiteral<"removed">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "removed";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
    removed_at: string;
    reason?: string | undefined;
}, {
    schema_version: number;
    status: "removed";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
    removed_at: string;
    reason?: string | undefined;
}>;
/**
 * Union of all canonical version schemas
 */
export declare const VersionRecordSchema: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    status: z.ZodLiteral<"approved">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "approved";
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
}, {
    schema_version: number;
    status: "approved";
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
}>, z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    storage: z.ZodObject<{
        repository: z.ZodString;
        commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        commit: string;
    }, {
        repository: string;
        commit: string;
    }>;
    status: z.ZodLiteral<"materialized">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "materialized";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
}, {
    schema_version: number;
    status: "materialized";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
}>, z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    storage: z.ZodObject<{
        repository: z.ZodString;
        commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        commit: string;
    }, {
        repository: string;
        commit: string;
    }>;
    artifact: z.ZodObject<{
        release_tag: z.ZodString;
        file: z.ZodString;
        sha256: z.ZodString;
        published_at: z.ZodString;
        provenance: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["github-attestation"]>;
        }, "strip", z.ZodTypeAny, {
            type: "github-attestation";
        }, {
            type: "github-attestation";
        }>>;
    }, "strip", z.ZodTypeAny, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }>;
    status: z.ZodLiteral<"published">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "published";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
}, {
    schema_version: number;
    status: "published";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
}>, z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    storage: z.ZodObject<{
        repository: z.ZodString;
        commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        commit: string;
    }, {
        repository: string;
        commit: string;
    }>;
    artifact: z.ZodObject<{
        release_tag: z.ZodString;
        file: z.ZodString;
        sha256: z.ZodString;
        published_at: z.ZodString;
        provenance: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["github-attestation"]>;
        }, "strip", z.ZodTypeAny, {
            type: "github-attestation";
        }, {
            type: "github-attestation";
        }>>;
    }, "strip", z.ZodTypeAny, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }>;
    status: z.ZodLiteral<"deprecated">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "deprecated";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
}, {
    schema_version: number;
    status: "deprecated";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
}>, z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    storage: z.ZodObject<{
        repository: z.ZodString;
        commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        commit: string;
    }, {
        repository: string;
        commit: string;
    }>;
    artifact: z.ZodObject<{
        release_tag: z.ZodString;
        file: z.ZodString;
        sha256: z.ZodString;
        published_at: z.ZodString;
        provenance: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["github-attestation"]>;
        }, "strip", z.ZodTypeAny, {
            type: "github-attestation";
        }, {
            type: "github-attestation";
        }>>;
    }, "strip", z.ZodTypeAny, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }>;
    revoked_at: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    status: z.ZodLiteral<"revoked">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "revoked";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
    revoked_at: string;
    reason?: string | undefined;
}, {
    schema_version: number;
    status: "revoked";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
    revoked_at: string;
    reason?: string | undefined;
}>, z.ZodObject<{
    schema_version: z.ZodEffects<z.ZodNumber, 1, number>;
    version: z.ZodString;
    source: z.ZodObject<{
        upstream_commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        upstream_commit: string;
    }, {
        upstream_commit: string;
    }>;
    review: z.ZodObject<{
        pull_request: z.ZodNumber;
        reviewer: z.ZodString;
        approved_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }, {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    }>;
    storage: z.ZodObject<{
        repository: z.ZodString;
        commit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        repository: string;
        commit: string;
    }, {
        repository: string;
        commit: string;
    }>;
    artifact: z.ZodObject<{
        release_tag: z.ZodString;
        file: z.ZodString;
        sha256: z.ZodString;
        published_at: z.ZodString;
        provenance: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["github-attestation"]>;
        }, "strip", z.ZodTypeAny, {
            type: "github-attestation";
        }, {
            type: "github-attestation";
        }>>;
    }, "strip", z.ZodTypeAny, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }, {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    }>;
    removed_at: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    status: z.ZodLiteral<"removed">;
}, "strict", z.ZodTypeAny, {
    schema_version: 1;
    status: "removed";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
    removed_at: string;
    reason?: string | undefined;
}, {
    schema_version: number;
    status: "removed";
    storage: {
        repository: string;
        commit: string;
    };
    version: string;
    source: {
        upstream_commit: string;
    };
    review: {
        pull_request: number;
        reviewer: string;
        approved_at: string;
    };
    artifact: {
        release_tag: string;
        file: string;
        sha256: string;
        published_at: string;
        provenance?: {
            type: "github-attestation";
        } | undefined;
    };
    removed_at: string;
    reason?: string | undefined;
}>]>;
export type PluginIdentityInput = z.infer<typeof PluginIdentitySchema>;
export type PluginSubmissionInput = z.infer<typeof PluginSubmissionSchema>;
export type VersionRecordInput = z.infer<typeof VersionRecordSchema>;
//# sourceMappingURL=schema.d.ts.map