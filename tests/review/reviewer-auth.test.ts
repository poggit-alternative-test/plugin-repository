/**
 * Reviewer Authorization Tests
 *
 * Tests for reviewer authorization mechanism.
 *
 * M4 Requirements tested:
 * - Authorized reviewer accepted
 * - Unauthorized reviewer rejected
 * - Numeric ID canonical
 * - Username mismatch
 * - Missing identity rejected
 * - Malformed identity rejected
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  ReviewerAuthorizer,
  isValidReviewerIdentity,
  isValidAuthorizationConfig,
  validateGithubId,
  validateGithubLogin,
  createAuthorizationConfig,
  createEmptyAuthorizationConfig,
  type ReviewerIdentity,
  type ReviewerAuthorizationConfig,
} from '../../src/review/reviewer-auth.js';

describe('Reviewer Authorization', () => {
  const AUTHORIZED_REVIEWER: ReviewerIdentity = {
    githubId: 12345678,
    login: 'authorized-reviewer',
  };

  const OTHER_REVIEWER: ReviewerIdentity = {
    githubId: 87654321,
    login: 'other-reviewer',
  };

  describe('validateGithubId', () => {
    test('accepts valid positive integer', () => {
      expect(validateGithubId(12345678)).toBe(true);
    });

    test('rejects zero', () => {
      expect(validateGithubId(0)).toBe(false);
    });

    test('rejects negative numbers', () => {
      expect(validateGithubId(-1)).toBe(false);
    });

    test('rejects non-numbers', () => {
      expect(validateGithubId('123' as any)).toBe(false);
      expect(validateGithubId(null)).toBe(false);
      expect(validateGithubId(undefined)).toBe(false);
    });

    test('rejects non-integers', () => {
      expect(validateGithubId(123.45)).toBe(false);
    });
  });

  describe('validateGithubLogin', () => {
    test('accepts valid login', () => {
      expect(validateGithubLogin('valid-login')).toBe(true);
      expect(validateGithubLogin('user123')).toBe(true);
    });

    test('rejects empty login', () => {
      expect(validateGithubLogin('')).toBe(false);
    });

    test('rejects login too long', () => {
      expect(validateGithubLogin('a'.repeat(50))).toBe(false);
    });
  });

  describe('isValidReviewerIdentity', () => {
    test('accepts valid identity with login', () => {
      expect(isValidReviewerIdentity(AUTHORIZED_REVIEWER)).toBe(true);
    });

    test('accepts valid identity without login', () => {
      expect(isValidReviewerIdentity({ githubId: 12345678 })).toBe(true);
    });

    test('rejects missing githubId', () => {
      expect(isValidReviewerIdentity({ login: 'test' } as any)).toBe(false);
    });

    test('rejects invalid githubId', () => {
      expect(isValidReviewerIdentity({ githubId: -1 })).toBe(false);
      expect(isValidReviewerIdentity({ githubId: 0 })).toBe(false);
    });

    test('rejects non-object', () => {
      expect(isValidReviewerIdentity(null)).toBe(false);
      expect(isValidReviewerIdentity('string' as any)).toBe(false);
    });
  });

  describe('isValidAuthorizationConfig', () => {
    test('accepts valid config', () => {
      const config: ReviewerAuthorizationConfig = {
        version: 1,
        authorizedReviewers: [AUTHORIZED_REVIEWER],
      };
      expect(isValidAuthorizationConfig(config)).toBe(true);
    });

    test('accepts empty reviewers', () => {
      const config = createEmptyAuthorizationConfig();
      expect(isValidAuthorizationConfig(config)).toBe(true);
    });

    test('rejects missing version', () => {
      expect(isValidAuthorizationConfig({ authorizedReviewers: [] } as any)).toBe(false);
    });

    test('rejects missing reviewers array', () => {
      expect(isValidAuthorizationConfig({ version: 1 } as any)).toBe(false);
    });
  });

  describe('ReviewerAuthorizer', () => {
    let authorizer: ReviewerAuthorizer;

    beforeEach(() => {
      authorizer = new ReviewerAuthorizer(
        createAuthorizationConfig([AUTHORIZED_REVIEWER])
      );
    });

    test('authorized reviewer is accepted', () => {
      const result = authorizer.isAuthorized(AUTHORIZED_REVIEWER);
      expect(result.authorized).toBe(true);
      expect(result.reviewer).toEqual(AUTHORIZED_REVIEWER);
    });

    test('unauthorized reviewer is rejected', () => {
      const result = authorizer.isAuthorized(OTHER_REVIEWER);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain('not authorized');
    });

    test('numeric ID is canonical - username mismatch does not affect authorization', () => {
      // Reviewer with same ID but different login
      const reviewerWithChangedLogin: ReviewerIdentity = {
        githubId: 12345678,
        login: 'changed-login',
      };

      // Should still be authorized because ID matches
      const result = authorizer.isAuthorized(reviewerWithChangedLogin);
      expect(result.authorized).toBe(true);
    });

    test('isAuthorizedById works', () => {
      expect(authorizer.isAuthorizedById(12345678)).toBe(true);
      expect(authorizer.isAuthorizedById(87654321)).toBe(false);
    });

    test('getReviewerById returns reviewer info', () => {
      const reviewer = authorizer.getReviewerById(12345678);
      expect(reviewer).toEqual(AUTHORIZED_REVIEWER);
    });

    test('getReviewerById returns undefined for unknown ID', () => {
      const reviewer = authorizer.getReviewerById(99999999);
      expect(reviewer).toBeUndefined();
    });

    test('getAuthorizedReviewers returns all reviewers', () => {
      const reviewers = authorizer.getAuthorizedReviewers();
      expect(reviewers).toHaveLength(1);
      expect(reviewers[0]).toEqual(AUTHORIZED_REVIEWER);
    });

    test('rejects invalid reviewer identity', () => {
      const result = authorizer.isAuthorized({ githubId: -1 } as any);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    test('rejects duplicate IDs in config', () => {
      expect(() => {
        new ReviewerAuthorizer(
          createAuthorizationConfig([
            AUTHORIZED_REVIEWER,
            { githubId: 12345678, login: 'duplicate' },
          ])
        );
      }).toThrow('Duplicate');
    });

    test('rejects invalid config', () => {
      expect(() => {
        new ReviewerAuthorizer({ version: 1, authorizedReviewers: [{ githubId: -1 }] } as any);
      }).toThrow('Invalid');
    });
  });

  describe('createAuthorizationConfig', () => {
    test('creates config with reviewers', () => {
      const config = createAuthorizationConfig([AUTHORIZED_REVIEWER, OTHER_REVIEWER]);
      expect(config.version).toBe(1);
      expect(config.authorizedReviewers).toHaveLength(2);
    });

    test('creates empty config', () => {
      const config = createEmptyAuthorizationConfig();
      expect(config.version).toBe(1);
      expect(config.authorizedReviewers).toHaveLength(0);
    });
  });
});
