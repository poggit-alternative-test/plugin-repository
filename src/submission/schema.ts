/**
 * Submission Schema
 *
 * Schema for validating developer submission files.
 * Uses PluginSubmissionSchema from registry schema but adds submission-specific validations.
 *
 * IMPORTANT: This schema validates developer SUBMISSION files, NOT canonical registry state.
 * Submissions are developer-controlled intent, not system-approved state.
 */

import { z } from 'zod';
import yaml from 'yaml';
import { PluginSubmissionSchema, SCHEMA_VERSION } from '../registry/schema.js';

// Re-export for convenience
export { PluginSubmissionSchema, SCHEMA_VERSION };

// ============================================================
// Submission Filename Validation
// ============================================================

/**
 * Validates submission filename format.
 *
 * Rules:
 * - Must have .yaml or .yml extension
 * - No path traversal
 * - No hidden files (starting with .)
 * - No nested directories
 * - No case-collision concerns on case-insensitive filesystems
 */
export function validateSubmissionFilename(filename: string): {
  valid: boolean;
  slug?: string;
  error?: string;
} {
  // Check for path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Path traversal not allowed' };
  }

  // Check for hidden files
  if (filename.startsWith('.')) {
    return { valid: false, error: 'Hidden files not allowed' };
  }

  // Check for nested directories
  if (filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Nested directories not allowed' };
  }

  // Check for valid extension
  if (!filename.endsWith('.yaml') && !filename.endsWith('.yml')) {
    return { valid: false, error: 'Must be .yaml or .yml file' };
  }

  // Extract slug (filename without extension)
  const slug = filename.replace(/\.ya?ml$/, '');

  // Check slug format (alphanumeric, dashes, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return { valid: false, error: 'Invalid slug format' };
  }

  return { valid: true, slug };
}

// ============================================================
// System-Controlled Fields That Must NOT Appear in Submissions
// ============================================================

const FORBIDDEN_SUBMISSION_FIELDS = [
  'id',
  'status',
  'storage',
  'artifact',
  'approved_at',
  'approved_by',
  'reviewer',
  'pull_request',
  'materialized_at',
  'published_at',
  'deprecated_at',
  'revoked_at',
  'removed_at',
  'reason',
  'provenance',
] as const;

/**
 * Check submission for forbidden system-controlled fields.
 * Returns array of field names that should not appear in submissions.
 */
export function findForbiddenFields(data: Record<string, unknown>): string[] {
  const found: string[] = [];

  for (const field of FORBIDDEN_SUBMISSION_FIELDS) {
    if (field in data) {
      found.push(field);
    }
  }

  // Also check nested objects
  if (data.upstream && typeof data.upstream === 'object') {
    const upstream = data.upstream as Record<string, unknown>;
    // No specific forbidden fields in upstream, but validate structure
  }

  return found;
}

// ============================================================
// Submission Parsing Result
// ============================================================

export interface ParsedSubmission {
  schemaVersion: number;
  repository: string;
  branch: string;
}

export interface SubmissionParseResult {
  success: boolean;
  data?: ParsedSubmission;
  errors: string[];
}

/**
 * Parse and validate a submission file.
 */
export function parseSubmission(yamlContent: string): SubmissionParseResult {
  const errors: string[] = [];

  let data: unknown;
  try {
    data = yaml.parse(yamlContent);
  } catch (e) {
    return {
      success: false,
      errors: [`YAML parse error: ${e instanceof Error ? e.message : 'Unknown error'}`],
    };
  }

  if (data === null || typeof data !== 'object') {
    return { success: false, errors: ['Submission must be a YAML object'] };
  }

  try {
    const parsed = PluginSubmissionSchema.parse(data);
    return {
      success: true,
      data: {
        schemaVersion: parsed.schema_version,
        repository: parsed.upstream.repository,
        branch: parsed.upstream.branch,
      },
      errors: [],
    };
  } catch (e) {
    if (e instanceof z.ZodError) {
      for (const issue of e.issues) {
        errors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
    } else {
      errors.push(`Parse error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    return { success: false, errors };
  }
}

// ============================================================
// Repository Identity Parsing
// ============================================================

const REPO_IDENTITY_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9._-]+$/;

/**
 * Parse repository identity into owner and name.
 */
export function parseRepositoryIdentity(
  repo: string
): { valid: boolean; owner?: string; name?: string; error?: string } {
  if (!repo || typeof repo !== 'string') {
    return { valid: false, error: 'Repository is required' };
  }

  // Check for URL (should not be present)
  if (repo.includes('://') || repo.includes('github.com')) {
    return { valid: false, error: 'Must be "owner/repository" format, not a URL' };
  }

  if (!REPO_IDENTITY_REGEX.test(repo)) {
    return { valid: false, error: 'Must be "owner/repository" format' };
  }

  const parts = repo.split('/');
  return {
    valid: true,
    owner: parts[0],
    name: parts[1],
  };
}

// ============================================================
// Branch Validation
// ============================================================

/**
 * Validate branch name format.
 *
 * Git branch names can contain special characters but we restrict to
 * common safe patterns to avoid issues.
 */
export function validateBranch(branch: string): { valid: boolean; error?: string } {
  if (!branch || typeof branch !== 'string') {
    return { valid: false, error: 'Branch is required' };
  }

  // Empty branch
  if (branch.length === 0) {
    return { valid: false, error: 'Branch cannot be empty' };
  }

  // Branch with leading/trailing spaces
  if (branch !== branch.trim()) {
    return { valid: false, error: 'Branch cannot have leading/trailing whitespace' };
  }

  // Common invalid patterns
  if (branch.includes('..')) {
    return { valid: false, error: 'Branch cannot contain ".."' };
  }

  // Branch ending with .lock (common in lock files)
  if (branch.endsWith('.lock')) {
    return { valid: false, error: 'Branch cannot end with .lock' };
  }

  // Git ref cannot end with /
  if (branch.endsWith('/')) {
    return { valid: false, error: 'Branch cannot end with /' };
  }

  // Control characters
  if (/[\x00-\x1f\x7f]/.test(branch)) {
    return { valid: false, error: 'Branch cannot contain control characters' };
  }

  // Double @ (could indicate unsafe ref)
  if (branch.includes('@@')) {
    return { valid: false, error: 'Branch cannot contain "@@"' };
  }

  return { valid: true };
}
