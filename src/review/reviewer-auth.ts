/**
 * Reviewer Authorization
 *
 * Declarative reviewer authorization mechanism.
 * Uses stable GitHub numeric user ID as canonical identity.
 *
 * M4 Requirement: Not every GitHub user may approve plugins.
 * Authorization must use stable GitHub identity, preferably numeric ID.
 */

// ============================================================
// Reviewer Identity
// ============================================================

export interface ReviewerIdentity {
  /** Canonical GitHub numeric user ID */
  githubId: number;
  /** GitHub login snapshot (informational) */
  login?: string;
}

// ============================================================
// Authorization Config
// ============================================================

export interface ReviewerAuthorizationConfig {
  version: number;
  authorizedReviewers: ReviewerIdentity[];
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate a GitHub ID.
 */
export function validateGithubId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
}

/**
 * Validate a GitHub login.
 */
export function validateGithubLogin(login: unknown): login is string {
  return typeof login === 'string' && login.length >= 1 && login.length <= 39;
}

/**
 * Validate a reviewer identity.
 */
export function isValidReviewerIdentity(identity: unknown): identity is ReviewerIdentity {
  if (typeof identity !== 'object' || identity === null) return false;
  const obj = identity as Record<string, unknown>;
  if (!validateGithubId(obj.githubId)) return false;
  if (obj.login !== undefined && typeof obj.login !== 'string') return false;
  return true;
}

/**
 * Validate a reviewer authorization config.
 */
export function isValidAuthorizationConfig(config: unknown): config is ReviewerAuthorizationConfig {
  if (typeof config !== 'object' || config === null) return false;
  const obj = config as Record<string, unknown>;

  if (typeof obj.version !== 'number') return false;
  if (!Array.isArray(obj.authorizedReviewers)) return false;

  for (const reviewer of obj.authorizedReviewers) {
    if (!isValidReviewerIdentity(reviewer)) return false;
  }

  return true;
}

// ============================================================
// Authorization Checker
// ============================================================

export interface AuthorizationResult {
  authorized: boolean;
  reviewer?: ReviewerIdentity;
  error?: string;
}

/**
 * Reviewer authorization checker.
 */
export class ReviewerAuthorizer {
  private readonly config: ReviewerAuthorizationConfig;

  constructor(config: ReviewerAuthorizationConfig) {
    if (!isValidAuthorizationConfig(config)) {
      throw new Error('Invalid reviewer authorization config');
    }

    // Ensure unique IDs
    const ids = new Set<number>();
    for (const reviewer of config.authorizedReviewers) {
      if (ids.has(reviewer.githubId)) {
        throw new Error(`Duplicate GitHub ID: ${reviewer.githubId}`);
      }
      ids.add(reviewer.githubId);
    }

    this.config = config;
  }

  /**
   * Check if a reviewer is authorized.
   *
   * Uses GitHub ID as canonical identity.
   * Username mismatch is logged but doesn't override numeric ID.
   */
  isAuthorized(identity: ReviewerIdentity): AuthorizationResult {
    if (!isValidReviewerIdentity(identity)) {
      return {
        authorized: false,
        error: 'Invalid reviewer identity structure',
      };
    }

    const authorized = this.config.authorizedReviewers.find(
      (r) => r.githubId === identity.githubId
    );

    if (!authorized) {
      return {
        authorized: false,
        error: `GitHub user ID ${identity.githubId} is not authorized`,
      };
    }

    // Check if login matches (warning only, not blocking)
    if (identity.login && authorized.login && identity.login !== authorized.login) {
      // Login changed - this is informational
      // The numeric ID is still authoritative
    }

    return {
      authorized: true,
      reviewer: authorized,
    };
  }

  /**
   * Get all authorized reviewers.
   */
  getAuthorizedReviewers(): ReviewerIdentity[] {
    return [...this.config.authorizedReviewers];
  }

  /**
   * Check if a GitHub ID is authorized by ID only.
   */
  isAuthorizedById(githubId: number): boolean {
    return this.config.authorizedReviewers.some((r) => r.githubId === githubId);
  }

  /**
   * Get reviewer info by ID.
   */
  getReviewerById(githubId: number): ReviewerIdentity | undefined {
    return this.config.authorizedReviewers.find((r) => r.githubId === githubId);
  }

  /**
   * Get the authorization config.
   */
  getConfig(): ReviewerAuthorizationConfig {
    return { ...this.config };
  }
}

// ============================================================
// Default Configuration
// ============================================================

/**
 * Create an empty authorization config.
 */
export function createEmptyAuthorizationConfig(): ReviewerAuthorizationConfig {
  return {
    version: 1,
    authorizedReviewers: [],
  };
}

/**
 * Create an authorization config with reviewers.
 */
export function createAuthorizationConfig(reviewers: ReviewerIdentity[]): ReviewerAuthorizationConfig {
  return {
    version: 1,
    authorizedReviewers: reviewers,
  };
}
