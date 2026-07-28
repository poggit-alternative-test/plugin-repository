/**
 * Review Candidate Identity
 *
 * Deterministic identity for review candidates based on:
 * - Plugin identity (slug)
 * - Upstream repository
 * - Exact commit SHA
 *
 * M4 Requirement: Human approval MUST apply to an exact source identity.
 * Never approve a branch. Never approve a repository generically.
 */

import { createHash } from 'crypto';
import { join } from 'path';

// ============================================================
// Candidate Identity Components
// ============================================================

export interface CandidateIdentityComponents {
  /** Plugin slug (from submission filename) */
  pluginSlug: string;
  /** Upstream repository in format "owner/repo" */
  upstreamRepository: string;
  /** Exact commit SHA (40 hex characters) */
  sha: string;
}

// ============================================================
// Candidate Identity
// ============================================================

export interface CandidateIdentity {
  /** Canonical identity string: "plugin@owner/repo#sha" */
  readonly canonical: string;
  /** Short hash for display (first 12 chars of SHA256) */
  readonly shortId: string;
  /** Plugin slug */
  readonly pluginSlug: string;
  /** Upstream repository */
  readonly upstreamRepository: string;
  /** Exact SHA */
  readonly sha: string;
}

// ============================================================
// Validation
// ============================================================

/**
 * SHA validation regex (40 hex characters)
 */
const SHA_REGEX = /^[a-f0-9]{40}$/i;

/**
 * Repository validation regex
 */
const REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/**
 * Plugin slug validation regex
 */
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a SHA string.
 */
export function validateSha(sha: string): ValidationResult {
  if (!sha) {
    return { valid: false, error: 'SHA is required' };
  }
  if (!SHA_REGEX.test(sha)) {
    return { valid: false, error: 'SHA must be 40 hexadecimal characters' };
  }
  return { valid: true };
}

/**
 * Validate a repository string (owner/repo).
 */
export function validateRepository(repo: string): ValidationResult {
  if (!repo) {
    return { valid: false, error: 'Repository is required' };
  }
  if (!REPO_REGEX.test(repo)) {
    return { valid: false, error: 'Repository must be in format "owner/repo"' };
  }
  return { valid: true };
}

/**
 * Validate a plugin slug.
 */
export function validatePluginSlug(slug: string): ValidationResult {
  if (!slug) {
    return { valid: false, error: 'Plugin slug is required' };
  }
  if (!SLUG_REGEX.test(slug)) {
    return { valid: false, error: 'Plugin slug must be lowercase alphanumeric with hyphens' };
  }
  return { valid: true };
}

/**
 * Validate candidate identity components.
 */
export function validateComponents(components: CandidateIdentityComponents): ValidationResult {
  const slugValidation = validatePluginSlug(components.pluginSlug);
  if (!slugValidation.valid) return slugValidation;

  const repoValidation = validateRepository(components.upstreamRepository);
  if (!repoValidation.valid) return repoValidation;

  const shaValidation = validateSha(components.sha);
  if (!shaValidation.valid) return shaValidation;

  return { valid: true };
}

// ============================================================
// Candidate Identity Creation
// ============================================================

/**
 * Create a deterministic candidate identity from components.
 *
 * The canonical form is: "plugin@owner/repo#sha"
 */
export function createCandidateIdentity(components: CandidateIdentityComponents): CandidateIdentity {
  const validation = validateComponents(components);
  if (!validation.valid) {
    throw new Error(`Invalid candidate identity components: ${validation.error}`);
  }

  // Canonical form
  const canonical = `${components.pluginSlug}@${components.upstreamRepository}#${components.sha}`;

  // Short ID - first 12 chars of SHA256 of canonical
  const hash = createHash('sha256').update(canonical).digest('hex');
  const shortId = hash.substring(0, 12);

  return {
    canonical,
    shortId,
    pluginSlug: components.pluginSlug,
    upstreamRepository: components.upstreamRepository,
    sha: components.sha,
  };
}

/**
 * Parse a canonical candidate identity string.
 */
export function parseCandidateIdentity(canonical: string): CandidateIdentity | null {
  if (!canonical) return null;

  // Format: plugin@owner/repo#sha
  const match = canonical.match(/^([a-z0-9][a-z0-9-]*)@([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#([a-f0-9]{40})$/i);
  if (!match) return null;

  return createCandidateIdentity({
    pluginSlug: match[1],
    upstreamRepository: match[2],
    sha: match[3].toLowerCase(),
  });
}

/**
 * Compare two candidate identities for equality.
 */
export function equalCandidateIdentity(a: CandidateIdentity, b: CandidateIdentity): boolean {
  return a.canonical === b.canonical;
}

/**
 * Check if a candidate identity matches components.
 */
export function identityMatches(
  identity: CandidateIdentity,
  components: Partial<CandidateIdentityComponents>
): boolean {
  if (components.pluginSlug && identity.pluginSlug !== components.pluginSlug) return false;
  if (components.upstreamRepository && identity.upstreamRepository !== components.upstreamRepository) return false;
  if (components.sha && identity.sha !== components.sha) return false;
  return true;
}

// ============================================================
// Storage Path Helpers
// ============================================================

/**
 * Get the storage path for a candidate's review directory.
 */
export function getCandidateReviewPath(basePath: string, identity: CandidateIdentity): string {
  // Structure: reviews/{plugin-slug}/{short-id}/
  return join(basePath, identity.pluginSlug, identity.shortId);
}

/**
 * Get the candidate info file path.
 */
export function getCandidateInfoPath(basePath: string, identity: CandidateIdentity): string {
  return join(getCandidateReviewPath(basePath, identity), 'candidate.yaml');
}

/**
 * Get the decisions directory path.
 */
export function getDecisionsDirPath(basePath: string, identity: CandidateIdentity): string {
  return join(getCandidateReviewPath(basePath, identity), 'decisions');
}

/**
 * Get a decision file path.
 */
export function getDecisionFilePath(basePath: string, identity: CandidateIdentity, decisionId: string): string {
  return join(getDecisionsDirPath(basePath, identity), `${decisionId}.yaml`);
}
