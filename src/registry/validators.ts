/**
 * Domain Validators
 *
 * Centralized validation for domain types.
 * Isolated so future Git object formats can be supported.
 */

import type { GitSha, SemVer, PluginId, RepositoryIdentity, Sha256 } from './types.js';

// ============================================================
// Regular Expressions
// ============================================================

/** Exactly 40 lowercase hexadecimal characters */
const GIT_SHA_REGEX = /^[a-f0-9]{40}$/;

/** SemVer 2.0.0 without pre-release metadata in registry context */
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/;

/** Plugin ID: lowercase, alphanumeric, hyphens, starts/ends alphanumeric, no consecutive hyphens */
const PLUGIN_ID_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Repository identity: owner/name format */
const REPO_IDENTITY_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9._-]+$/;

/** SHA-256: exactly 64 lowercase hexadecimal characters */
const SHA256_REGEX = /^[a-f0-9]{64}$/;

// ============================================================
// Validation Results
// ============================================================

export interface ValidationResult<T> {
  success: boolean;
  value?: T;
  error?: string;
}

export function success<T>(value: T): ValidationResult<T> {
  return { success: true, value };
}

export function failure<T>(error: string): ValidationResult<T> {
  return { success: false, error };
}

// ============================================================
// Domain Validators
// ============================================================

/**
 * Validate a Git SHA-1 commit identifier
 *
 * @param value - The string to validate
 * @returns ValidationResult with GitSha type or error
 */
export function validateGitSha(value: unknown): ValidationResult<GitSha> {
  if (typeof value !== 'string') {
    return failure(`Expected string, got ${typeof value}`);
  }

  if (!GIT_SHA_REGEX.test(value)) {
    if (value.length === 0) {
      return failure('Git SHA cannot be empty');
    }
    if (value.length < 40) {
      return failure(`Git SHA too short: expected 40 characters, got ${value.length}`);
    }
    if (value.length > 40) {
      return failure(`Git SHA too long: expected 40 characters, got ${value.length}`);
    }
    return failure(`Invalid Git SHA: "${value}" - must be 40 lowercase hexadecimal characters`);
  }

  return success(value as GitSha);
}

/**
 * Validate a semantic version string
 *
 * @param value - The string to validate
 * @returns ValidationResult with SemVer type or error
 */
export function validateSemVer(value: unknown): ValidationResult<SemVer> {
  if (typeof value !== 'string') {
    return failure(`Expected string, got ${typeof value}`);
  }

  if (!SEMVER_REGEX.test(value)) {
    return failure(`Invalid semantic version: "${value}" - expected format: 1.2.3 or 1.2.3-beta`);
  }

  return success(value as SemVer);
}

/**
 * Validate a plugin identifier
 *
 * Rules:
 * - Lowercase alphanumeric
 * - Hyphens allowed in middle
 * - Must start and end with alphanumeric
 * - No consecutive hyphens
 *
 * @param value - The string to validate
 * @returns ValidationResult with PluginId type or error
 */
export function validatePluginId(value: unknown): ValidationResult<PluginId> {
  if (typeof value !== 'string') {
    return failure(`Expected string, got ${typeof value}`);
  }

  if (value.length === 0) {
    return failure('Plugin ID cannot be empty');
  }

  if (value.length > 64) {
    return failure(`Plugin ID too long: maximum 64 characters, got ${value.length}`);
  }

  if (!PLUGIN_ID_REGEX.test(value)) {
    // Provide helpful error messages
    if (value !== value.toLowerCase()) {
      return failure(`Plugin ID must be lowercase: "${value}"`);
    }
    if (value.startsWith('-') || value.endsWith('-')) {
      return failure(`Plugin ID cannot start or end with hyphen: "${value}"`);
    }
    if (value.includes('--')) {
      return failure(`Plugin ID cannot have consecutive hyphens: "${value}"`);
    }
    return failure(`Invalid plugin ID: "${value}" - use lowercase letters, digits, and hyphens`);
  }

  return success(value as PluginId);
}

/**
 * Validate a repository identity (owner/name format)
 *
 * @param value - The string to validate
 * @returns ValidationResult with RepositoryIdentity type or error
 */
export function validateRepositoryIdentity(value: unknown): ValidationResult<RepositoryIdentity> {
  if (typeof value !== 'string') {
    return failure(`Expected string, got ${typeof value}`);
  }

  if (value.includes('://')) {
    return failure(
      `Repository identity must be "owner/name" format, not a URL: "${value}"`
    );
  }

  if (value.includes('github.com')) {
    return failure(
      `Repository identity must be "owner/name" format, not a URL: "${value}"`
    );
  }

  if (!REPO_IDENTITY_REGEX.test(value)) {
    return failure(
      `Invalid repository identity: "${value}" - expected format: "owner/repository"`
    );
  }

  return success(value as RepositoryIdentity);
}

/**
 * Validate a SHA-256 checksum
 *
 * @param value - The string to validate
 * @returns ValidationResult with Sha256 type or error
 */
export function validateSha256(value: unknown): ValidationResult<Sha256> {
  if (typeof value !== 'string') {
    return failure(`Expected string, got ${typeof value}`);
  }

  if (!SHA256_REGEX.test(value)) {
    if (value.length !== 64) {
      return failure(
        `SHA-256 must be 64 hexadecimal characters, got ${value.length}`
      );
    }
    return failure(`Invalid SHA-256: "${value}" - must be 64 lowercase hexadecimal characters`);
  }

  return success(value as Sha256);
}

/**
 * Validate a branch name
 *
 * @param value - The string to validate
 * @returns ValidationResult or error
 */
export function validateBranch(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string') {
    return failure(`Expected string, got ${typeof value}`);
  }

  if (value.length === 0) {
    return failure('Branch name cannot be empty');
  }

  if (value.length > 255) {
    return failure(`Branch name too long: maximum 255 characters, got ${value.length}`);
  }

  // Git branch names have restrictions
  // https://git-scm.com/docs/git-check-ref-format
  if (value.includes(' ')) {
    return failure(`Branch name cannot contain spaces: "${value}"`);
  }

  if (value.includes('~') || value.includes('^') || value.includes(':')) {
    return failure(`Branch name contains invalid characters: "${value}"`);
  }

  if (value.startsWith('/') || value.endsWith('/')) {
    return failure(`Branch name cannot start or end with slash: "${value}"`);
  }

  if (value.includes('..')) {
    return failure(`Branch name cannot contain "..": "${value}"`);
  }

  // Catch common mistakes
  const invalidBranches = ['.', '..', 'HEAD', 'head'];
  if (invalidBranches.includes(value)) {
    return failure(`Branch name "${value}" is reserved`);
  }

  return success(value);
}

/**
 * Validate an ISO 8601 timestamp
 *
 * @param value - The string to validate
 * @returns ValidationResult or error
 */
export function validateTimestamp(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string') {
    return failure(`Expected string, got ${typeof value}`);
  }

  if (value.length === 0) {
    return failure('Timestamp cannot be empty');
  }

  // Basic ISO 8601 validation
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return failure(`Invalid timestamp: "${value}" - expected ISO 8601 format`);
  }

  return success(value);
}

/**
 * Validate a release tag format
 *
 * @param value - The string to validate
 * @returns ValidationResult or error
 */
export function validateReleaseTag(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string') {
    return failure(`Expected string, got ${typeof value}`);
  }

  if (value.length === 0) {
    return failure('Release tag cannot be empty');
  }

  if (!value.startsWith('v')) {
    return failure(`Release tag must start with "v": "${value}"`);
  }

  // Extract version part and validate
  const versionPart = value.slice(1);
  const semverResult = validateSemVer(versionPart);
  if (!semverResult.success) {
    return failure(`Release tag has invalid version: "${value}" - ${semverResult.error}`);
  }

  return success(value);
}
