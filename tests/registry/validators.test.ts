/**
 * Validator Tests
 *
 * Unit tests for domain validators.
 */
import { describe, test, expect } from 'vitest';

import {
  validateGitSha,
  validateSemVer,
  validatePluginId,
  validateRepositoryIdentity,
  validateSha256,
  validateBranch,
  validateTimestamp,
  validateReleaseTag,
} from '../../src/registry/validators.js';

describe('validateGitSha', () => {
  const validSha = 'a82f0e123456789abcdef123456789abcdef1234';

  test('accepts valid 40-char lowercase hex', () => {
    const result = validateGitSha(validSha);
    expect(result.success).toBe(true);
  });

  test('rejects uppercase hex', () => {
    const result = validateGitSha('A82F0E123456789ABCDEF123456789ABCDEF1234');
    expect(result.success).toBe(false);
  });

  test('rejects short SHA', () => {
    const result = validateGitSha('a82f0e');
    expect(result.success).toBe(false);
  });

  test('rejects empty string', () => {
    const result = validateGitSha('');
    expect(result.success).toBe(false);
  });

  test('rejects non-string', () => {
    const result = validateGitSha(123);
    expect(result.success).toBe(false);
  });

  test('rejects invalid characters', () => {
    const result = validateGitSha('g82f0e123456789abcdef123456789abcdef1234');
    expect(result.success).toBe(false);
  });
});

describe('validateSemVer', () => {
  test('accepts valid version', () => {
    const result = validateSemVer('1.0.0');
    expect(result.success).toBe(true);
  });

  test('accepts version with pre-release', () => {
    const result = validateSemVer('2.1.0-beta');
    expect(result.success).toBe(true);
  });

  test('accepts version with RC', () => {
    const result = validateSemVer('1.0.0-rc1');
    expect(result.success).toBe(true);
  });

  test('rejects missing patch', () => {
    const result = validateSemVer('1.0');
    expect(result.success).toBe(false);
  });

  test('rejects invalid characters', () => {
    const result = validateSemVer('1.0.0-beta.1');
    expect(result.success).toBe(false);
  });

  test('rejects non-string', () => {
    const result = validateSemVer(1.0);
    expect(result.success).toBe(false);
  });
});

describe('validatePluginId', () => {
  test('accepts lowercase alphanumeric', () => {
    const result = validatePluginId('topstats');
    expect(result.success).toBe(true);
  });

  test('accepts with hyphens', () => {
    const result = validatePluginId('economy-api');
    expect(result.success).toBe(true);
  });

  test('accepts with numbers', () => {
    const result = validatePluginId('plugin123');
    expect(result.success).toBe(true);
  });

  test('rejects uppercase', () => {
    const result = validatePluginId('TopStats');
    expect(result.success).toBe(false);
  });

  test('rejects starting with hyphen', () => {
    const result = validatePluginId('-topstats');
    expect(result.success).toBe(false);
  });

  test('rejects ending with hyphen', () => {
    const result = validatePluginId('topstats-');
    expect(result.success).toBe(false);
  });

  test('rejects consecutive hyphens', () => {
    const result = validatePluginId('top--stats');
    expect(result.success).toBe(false);
  });

  test('rejects spaces', () => {
    const result = validatePluginId('top stats');
    expect(result.success).toBe(false);
  });

  test('rejects empty string', () => {
    const result = validatePluginId('');
    expect(result.success).toBe(false);
  });
});

describe('validateRepositoryIdentity', () => {
  test('accepts valid owner/repo', () => {
    const result = validateRepositoryIdentity('nicholass003/TopStats');
    expect(result.success).toBe(true);
  });

  test('accepts with hyphens', () => {
    const result = validateRepositoryIdentity('dev-team/my-plugin');
    expect(result.success).toBe(true);
  });

  test('accepts with dots', () => {
    const result = validateRepositoryIdentity('devteam/plugin.v2');
    expect(result.success).toBe(true);
  });

  test('rejects URL', () => {
    const result = validateRepositoryIdentity('https://github.com/user/repo');
    expect(result.success).toBe(false);
  });

  test('rejects github.com prefix', () => {
    const result = validateRepositoryIdentity('github.com/user/repo');
    expect(result.success).toBe(false);
  });

  test('rejects missing owner', () => {
    const result = validateRepositoryIdentity('/repo');
    expect(result.success).toBe(false);
  });
});

describe('validateSha256', () => {
  const validSha256 = 'a'.repeat(64);

  test('accepts valid 64-char lowercase hex', () => {
    const result = validateSha256(validSha256);
    expect(result.success).toBe(true);
  });

  test('rejects wrong length', () => {
    const result = validateSha256('a'.repeat(63));
    expect(result.success).toBe(false);
  });

  test('rejects uppercase', () => {
    const result = validateSha256('A'.repeat(64));
    expect(result.success).toBe(false);
  });
});

describe('validateBranch', () => {
  test('accepts main', () => {
    const result = validateBranch('main');
    expect(result.success).toBe(true);
  });

  test('accepts feature branch', () => {
    const result = validateBranch('feature/add-plugin');
    expect(result.success).toBe(true);
  });

  test('rejects spaces', () => {
    const result = validateBranch('main branch');
    expect(result.success).toBe(false);
  });

  test('rejects HEAD', () => {
    const result = validateBranch('HEAD');
    expect(result.success).toBe(false);
  });

  test('rejects double dots', () => {
    const result = validateBranch('feature..main');
    expect(result.success).toBe(false);
  });

  test('rejects empty string', () => {
    const result = validateBranch('');
    expect(result.success).toBe(false);
  });
});

describe('validateTimestamp', () => {
  test('accepts ISO 8601', () => {
    const result = validateTimestamp('2026-07-25T10:30:00Z');
    expect(result.success).toBe(true);
  });

  test('accepts with timezone', () => {
    const result = validateTimestamp('2026-07-25T10:30:00+00:00');
    expect(result.success).toBe(true);
  });

  test('rejects invalid date', () => {
    const result = validateTimestamp('not-a-date');
    expect(result.success).toBe(false);
  });
});

describe('validateReleaseTag', () => {
  test('accepts v-prefixed version', () => {
    const result = validateReleaseTag('v1.0.0');
    expect(result.success).toBe(true);
  });

  test('accepts with pre-release', () => {
    const result = validateReleaseTag('v2.1.0-beta');
    expect(result.success).toBe(true);
  });

  test('rejects missing v prefix', () => {
    const result = validateReleaseTag('1.0.0');
    expect(result.success).toBe(false);
  });
});
