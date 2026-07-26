/**
 * Types Tests
 *
 * Unit tests for type guards and invariants.
 */
import { describe, test, expect } from 'vitest';

import {
  isApprovedVersion,
  isMaterializedVersion,
  isPublishedVersion,
  isDeprecatedVersion,
  isRevokedVersion,
  isRemovedVersion,
  isMutableVersion,
  hasPublishedProvenance,
  canTransition,
  VALID_TRANSITIONS,
} from '../../src/registry/types.js';

describe('Type guards', () => {
  describe('isApprovedVersion', () => {
    test('returns true for approved status', () => {
      const version = {
        status: 'approved',
        schemaVersion: 1,
        version: '1.0.0',
        source: { upstreamCommit: 'a'.repeat(40) },
        review: { pullRequest: 1, reviewer: 'user', approvedAt: '2026-01-01T00:00:00Z' },
      };
      expect(isApprovedVersion(version)).toBe(true);
    });

    test('returns false for other statuses', () => {
      const version = {
        status: 'published',
        schemaVersion: 1,
        version: '1.0.0',
        source: { upstreamCommit: 'a'.repeat(40) },
        review: { pullRequest: 1, reviewer: 'user', approvedAt: '2026-01-01T00:00:00Z' },
        storage: { repository: 'axolotl-pm-pl/test', commit: 'a'.repeat(40) },
        artifact: {
          releaseTag: 'v1.0.0',
          file: 'test.phar',
          sha256: 'b'.repeat(64),
          publishedAt: '2026-01-01T01:00:00Z',
        },
      };
      expect(isApprovedVersion(version)).toBe(false);
    });
  });

  describe('isPublishedVersion', () => {
    test('returns true for published status', () => {
      const version = {
        status: 'published',
        schemaVersion: 1,
        version: '1.0.0',
        source: { upstreamCommit: 'a'.repeat(40) },
        review: { pullRequest: 1, reviewer: 'user', approvedAt: '2026-01-01T00:00:00Z' },
        storage: { repository: 'axolotl-pm-pl/test', commit: 'a'.repeat(40) },
        artifact: {
          releaseTag: 'v1.0.0',
          file: 'test.phar',
          sha256: 'b'.repeat(64),
          publishedAt: '2026-01-01T01:00:00Z',
        },
      };
      expect(isPublishedVersion(version)).toBe(true);
    });
  });
});

describe('isMutableVersion', () => {
  test('returns true for approved', () => {
    expect(isMutableVersion({ status: 'approved' } as any)).toBe(true);
  });

  test('returns true for materialized', () => {
    expect(isMutableVersion({ status: 'materialized' } as any)).toBe(true);
  });

  test('returns false for published', () => {
    expect(isMutableVersion({ status: 'published' } as any)).toBe(false);
  });
});

describe('hasPublishedProvenance', () => {
  test('returns true for published', () => {
    expect(hasPublishedProvenance({ status: 'published' } as any)).toBe(true);
  });

  test('returns true for deprecated', () => {
    expect(hasPublishedProvenance({ status: 'deprecated' } as any)).toBe(true);
  });

  test('returns true for revoked', () => {
    expect(hasPublishedProvenance({ status: 'revoked' } as any)).toBe(true);
  });

  test('returns false for approved', () => {
    expect(hasPublishedProvenance({ status: 'approved' } as any)).toBe(false);
  });
});

describe('canTransition', () => {
  test('approved can transition to materialized', () => {
    expect(canTransition('approved', 'materialized')).toBe(true);
  });

  test('approved cannot transition directly to published', () => {
    expect(canTransition('approved', 'published')).toBe(false);
  });

  test('materialized can transition to published', () => {
    expect(canTransition('materialized', 'published')).toBe(true);
  });

  test('approved cannot transition to revoked', () => {
    expect(canTransition('approved', 'revoked')).toBe(false);
  });

  test('published can transition to deprecated', () => {
    expect(canTransition('published', 'deprecated')).toBe(true);
  });

  test('published can transition to revoked', () => {
    expect(canTransition('published', 'revoked')).toBe(true);
  });

  test('revoked cannot transition to published', () => {
    expect(canTransition('revoked', 'published')).toBe(false);
  });

  test('removed is terminal', () => {
    const transitions = VALID_TRANSITIONS.removed;
    expect(transitions).toHaveLength(0);
  });
});

describe('VALID_TRANSITIONS', () => {
  test('every status has transitions defined', () => {
    const statuses = [
      'approved',
      'materialized',
      'published',
      'deprecated',
      'revoked',
      'removed',
    ];

    for (const status of statuses) {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
    }
  });

  test('no status transitions to itself', () => {
    const statuses = [
      'approved',
      'materialized',
      'published',
      'deprecated',
      'revoked',
      'removed',
    ];

    for (const status of statuses) {
      expect(VALID_TRANSITIONS[status as keyof typeof VALID_TRANSITIONS]).not.toContain(status);
    }
  });
});
