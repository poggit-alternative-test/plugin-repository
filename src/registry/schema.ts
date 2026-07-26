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

// ============================================================
// Regular Expressions
// ============================================================

const GIT_SHA_REGEX = /^[a-f0-9]{40}$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/;
const PLUGIN_ID_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const REPO_IDENTITY_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9._-]+$/;
const SHA256_REGEX = /^[a-f0-9]{64}$/;
const RELEASE_TAG_REGEX = /^v\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/;

// ============================================================
// Schema Versions
// ============================================================

export const SCHEMA_VERSION = 1;

// ============================================================
// Submission Schema (Developer Input)
// ============================================================

/**
 * Plugin Submission Schema
 *
 * Minimal input from developers. Only contains upstream reference.
 * This is NOT canonical registry state - it's developer-controlled intent.
 *
 * Rejects: approvals, storage, artifact, status, and other system-controlled fields.
 */
export const PluginSubmissionSchema = z.object({
  schema_version: z
    .number()
    .refine((v) => v === SCHEMA_VERSION, {
      message: `Schema version must be ${SCHEMA_VERSION}`,
    }),
  upstream: z.object({
    repository: z
      .string()
      .regex(REPO_IDENTITY_REGEX, 'Must be "owner/repository" format, not a URL'),
    branch: z.string().min(1, 'Branch is required').default('main'),
  }),
});

// ============================================================
// Plugin Identity Schemas (Canonical Registry State)
// ============================================================

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
export const PluginIdentitySchema = z.object({
  schema_version: z
    .number()
    .refine((v) => v === SCHEMA_VERSION, {
      message: `Schema version must be ${SCHEMA_VERSION}`,
    }),
  id: z
    .string()
    .regex(PLUGIN_ID_REGEX, 'Plugin ID must be lowercase letters, digits, and hyphens')
    .min(1, 'Plugin ID is required')
    .max(64, 'Plugin ID must be 64 characters or less'),
  upstream: z.object({
    repository: z
      .string()
      .regex(REPO_IDENTITY_REGEX, 'Must be "owner/repository" format, not a URL'),
    branch: z.string().min(1, 'Branch is required').default('main'),
  }),
  storage: z.object({
    repository: z.string().min(1, 'Storage repository is required'),
  }).optional(),
});

// ============================================================
// Version Record Schemas (Canonical Registry State)
// ============================================================

/**
 * Source reference schema
 */
const SourceRefSchema = z.object({
  upstream_commit: z
    .string()
    .regex(GIT_SHA_REGEX, 'Must be a valid 40-character Git SHA'),
});

/**
 * Review reference schema
 */
const ReviewRefSchema = z.object({
  pull_request: z.number().int().positive('PR number must be positive'),
  reviewer: z.string().min(1, 'Reviewer is required'),
  approved_at: z.string().min(1, 'Approval timestamp is required'),
});

/**
 * Version storage reference schema
 */
const VersionStorageRefSchema = z.object({
  repository: z.string().min(1, 'Storage repository is required'),
  commit: z.string().regex(GIT_SHA_REGEX, 'Must be a valid 40-character Git SHA'),
});

/**
 * Artifact reference schema
 */
const ArtifactRefSchema = z.object({
  release_tag: z.string().regex(RELEASE_TAG_REGEX, 'Must be "v1.2.3" format'),
  file: z.string().min(1, 'PHAR filename is required'),
  sha256: z.string().regex(SHA256_REGEX, 'Must be a valid 64-character SHA-256'),
  published_at: z.string().min(1, 'Publication timestamp is required'),
});

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
export const ApprovedVersionSchema = z.object({
  schema_version: z
    .number()
    .refine((v) => v === SCHEMA_VERSION, {
      message: `Schema version must be ${SCHEMA_VERSION}`,
    }),
  version: z
    .string()
    .regex(SEMVER_REGEX, 'Must be a valid semantic version (e.g., 1.0.0 or 2.1.0-beta)'),
  source: SourceRefSchema,
  review: ReviewRefSchema,
  // storage and artifact are NOT allowed in approved state
  status: z.literal('approved'),
}).strict(); // Strict mode: reject unexpected keys

/**
 * Materialized version - source preserved in storage
 * MUST have: version, source, review, storage
 * MUST NOT have: artifact
 */
export const MaterializedVersionSchema = z.object({
  schema_version: z
    .number()
    .refine((v) => v === SCHEMA_VERSION, {
      message: `Schema version must be ${SCHEMA_VERSION}`,
    }),
  version: z.string().regex(SEMVER_REGEX),
  source: SourceRefSchema,
  review: ReviewRefSchema,
  storage: VersionStorageRefSchema,
  // artifact is NOT allowed in materialized state
  status: z.literal('materialized'),
}).strict();

/**
 * Published version - release created
 * MUST have: version, source, review, storage, artifact
 */
export const PublishedVersionSchema = z.object({
  schema_version: z
    .number()
    .refine((v) => v === SCHEMA_VERSION, {
      message: `Schema version must be ${SCHEMA_VERSION}`,
    }),
  version: z.string().regex(SEMVER_REGEX),
  source: SourceRefSchema,
  review: ReviewRefSchema,
  storage: VersionStorageRefSchema,
  artifact: ArtifactRefSchema,
  status: z.literal('published'),
}).strict();

/**
 * Deprecated version - no longer recommended
 * MUST have: everything from published
 */
export const DeprecatedVersionSchema = z.object({
  schema_version: z
    .number()
    .refine((v) => v === SCHEMA_VERSION, {
      message: `Schema version must be ${SCHEMA_VERSION}`,
    }),
  version: z.string().regex(SEMVER_REGEX),
  source: SourceRefSchema,
  review: ReviewRefSchema,
  storage: VersionStorageRefSchema,
  artifact: ArtifactRefSchema,
  status: z.literal('deprecated'),
}).strict();

/**
 * Revoked version - security concern identified
 * MUST have: everything from published + revoked_at
 */
export const RevokedVersionSchema = z.object({
  schema_version: z
    .number()
    .refine((v) => v === SCHEMA_VERSION, {
      message: `Schema version must be ${SCHEMA_VERSION}`,
    }),
  version: z.string().regex(SEMVER_REGEX),
  source: SourceRefSchema,
  review: ReviewRefSchema,
  storage: VersionStorageRefSchema,
  artifact: ArtifactRefSchema,
  revoked_at: z.string().min(1, 'Revocation timestamp is required'),
  reason: z.string().optional(),
  status: z.literal('revoked'),
}).strict();

/**
 * Removed version - removed from public discovery
 * MUST preserve full provenance for audit
 * MUST have: everything from published + removed_at
 */
export const RemovedVersionSchema = z.object({
  schema_version: z
    .number()
    .refine((v) => v === SCHEMA_VERSION, {
      message: `Schema version must be ${SCHEMA_VERSION}`,
    }),
  version: z.string().regex(SEMVER_REGEX),
  source: SourceRefSchema,
  review: ReviewRefSchema,
  storage: VersionStorageRefSchema,
  artifact: ArtifactRefSchema,
  removed_at: z.string().min(1, 'Removal timestamp is required'),
  reason: z.string().optional(),
  status: z.literal('removed'),
}).strict();

/**
 * Union of all canonical version schemas
 */
export const VersionRecordSchema = z.discriminatedUnion('status', [
  ApprovedVersionSchema,
  MaterializedVersionSchema,
  PublishedVersionSchema,
  DeprecatedVersionSchema,
  RevokedVersionSchema,
  RemovedVersionSchema,
]);

// ============================================================
// Type Exports
// ============================================================

export type PluginIdentityInput = z.infer<typeof PluginIdentitySchema>;
export type PluginSubmissionInput = z.infer<typeof PluginSubmissionSchema>;
export type VersionRecordInput = z.infer<typeof VersionRecordSchema>;
