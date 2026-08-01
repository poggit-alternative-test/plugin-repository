/**
 * Unit tests for Build Domain types
 */

import { describe, it, expect } from 'vitest';
import {
  // Validation functions
  isValidGitSha,
  isValidSha256,
  isValidSemVer,
  isValidPluginId,
  isValidRepositoryIdentity,
  isValidMaterializationId,
  // Diagnostic helpers
  buildError,
  buildWarning,
  isBuildError,
  isBuildWarning,
  getBuildErrors,
  getBuildWarnings,
  hasBuildErrors,
  // Type guards
  isBuildSuccess,
  isBuildFailure,
  hasCriticalSecuritySignals,
  hasSecuritySignals,
  // Enums
  SecuritySignalSeverity,
  SecuritySignalType,
  BuildSeverity,
  // Codes
  BUILD_ERROR_CODES,
  BUILD_WARNING_CODES,
} from '../src/types.js';

describe('GitSha Validation', () => {
  it('accepts valid 40-character lowercase hex', () => {
    expect(isValidGitSha('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')).toBe(true);
  });

  it('accepts valid 40-character uppercase hex', () => {
    expect(isValidGitSha('A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2')).toBe(true);
  });

  it('accepts mixed case hex', () => {
    expect(isValidGitSha('a1B2c3D4e5F6a1B2c3D4e5F6a1B2c3D4e5F6a1B2')).toBe(true);
  });

  it('rejects too short', () => {
    expect(isValidGitSha('a1b2c3')).toBe(false);
  });

  it('rejects too long', () => {
    expect(isValidGitSha('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a')).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidGitSha('g1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidGitSha('')).toBe(false);
  });
});

describe('Sha256 Validation', () => {
  it('accepts valid 64-character lowercase hex', () => {
    expect(isValidSha256('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')).toBe(true);
  });

  it('accepts valid uppercase hex', () => {
    expect(isValidSha256('A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2')).toBe(true);
  });

  it('rejects too short', () => {
    expect(isValidSha256('a1b2c3')).toBe(false);
  });

  it('rejects too long', () => {
    expect(isValidSha256('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a')).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidSha256('g1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')).toBe(false);
  });
});

describe('SemVer Validation', () => {
  it('accepts standard version', () => {
    expect(isValidSemVer('1.0.0')).toBe(true);
  });

  it('accepts version with patch', () => {
    expect(isValidSemVer('1.2.3')).toBe(true);
  });

  it('accepts pre-release version', () => {
    expect(isValidSemVer('1.0.0-alpha')).toBe(true);
  });

  it('accepts version with build metadata', () => {
    expect(isValidSemVer('1.0.0+build.123')).toBe(true);
  });

  it('accepts version with pre-release and build metadata', () => {
    expect(isValidSemVer('1.0.0-alpha+build.123')).toBe(true);
  });

  it('rejects missing patch', () => {
    expect(isValidSemVer('1.0')).toBe(false);
  });

  it('rejects missing minor', () => {
    expect(isValidSemVer('1')).toBe(false);
  });

  it('rejects non-numeric parts', () => {
    expect(isValidSemVer('a.b.c')).toBe(false);
  });
});

describe('PluginId Validation', () => {
  it('accepts simple name', () => {
    expect(isValidPluginId('topstats')).toBe(true);
  });

  it('accepts hyphenated name', () => {
    expect(isValidPluginId('my-plugin')).toBe(true);
  });

  it('rejects underscored name', () => {
    // Plugin IDs use hyphens, not underscores
    expect(isValidPluginId('my_plugin')).toBe(false);
  });

  it('accepts single character', () => {
    expect(isValidPluginId('a')).toBe(true);
  });

  it('accepts 64 character name', () => {
    const name = 'a'.repeat(64);
    expect(isValidPluginId(name)).toBe(true);
  });

  it('rejects 65 character name', () => {
    const name = 'a'.repeat(65);
    expect(isValidPluginId(name)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidPluginId('')).toBe(false);
  });

  it('rejects name starting with hyphen', () => {
    expect(isValidPluginId('-my-plugin')).toBe(false);
  });

  it('rejects name ending with hyphen', () => {
    expect(isValidPluginId('my-plugin-')).toBe(false);
  });
});

describe('RepositoryIdentity Validation', () => {
  it('accepts simple owner/name', () => {
    expect(isValidRepositoryIdentity('owner/repo')).toBe(true);
  });

  it('accepts hyphenated owner and repo', () => {
    expect(isValidRepositoryIdentity('my-owner/my-repo')).toBe(true);
  });

  it('accepts underscored owner and repo', () => {
    expect(isValidRepositoryIdentity('my_owner/my_repo')).toBe(true);
  });

  it('accepts complex names', () => {
    expect(isValidRepositoryIdentity('axolotl-pm-pl/TopStats')).toBe(true);
  });

  it('rejects single component', () => {
    expect(isValidRepositoryIdentity('owner')).toBe(false);
  });

  it('rejects triple component', () => {
    expect(isValidRepositoryIdentity('owner/repo/extra')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidRepositoryIdentity('')).toBe(false);
  });
});

describe('MaterializationId Validation', () => {
  it('accepts valid SHA-256 as materialization ID', () => {
    const validSha256 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    expect(isValidMaterializationId(validSha256)).toBe(true);
  });

  it('rejects non-SHA-256', () => {
    expect(isValidMaterializationId('not-a-sha256')).toBe(false);
  });
});

describe('Diagnostic Helpers', () => {
  describe('buildError', () => {
    it('creates error diagnostic with code and message', () => {
      const error = buildError(BUILD_ERROR_CODES.PLUGIN_YML_MISSING, 'plugin.yml not found');
      expect(error.severity).toBe(BuildSeverity.ERROR);
      expect(error.code).toBe('PLUGIN_YML_MISSING');
      expect(error.message).toBe('plugin.yml not found');
      expect(error.context).toBeUndefined();
    });

    it('creates error diagnostic with context', () => {
      const error = buildError(BUILD_ERROR_CODES.PLUGIN_YML_INVALID, 'Invalid format', { path: '/src/plugin.yml' });
      expect(error.context).toEqual({ path: '/src/plugin.yml' });
    });
  });

  describe('buildWarning', () => {
    it('creates warning diagnostic with code and message', () => {
      const warning = buildWarning(BUILD_WARNING_CODES.VENDOR_DIR_DETECTED, 'vendor directory found');
      expect(warning.severity).toBe(BuildSeverity.WARNING);
      expect(warning.code).toBe('VENDOR_DIR_DETECTED');
      expect(warning.message).toBe('vendor directory found');
    });
  });

  describe('isBuildError', () => {
    it('returns true for error diagnostic', () => {
      const error = buildError(BUILD_ERROR_CODES.SOURCE_NOT_FOUND, 'Not found');
      expect(isBuildError(error)).toBe(true);
    });

    it('returns false for warning diagnostic', () => {
      const warning = buildWarning(BUILD_WARNING_CODES.LARGE_FILE_DETECTED, 'Large file');
      expect(isBuildError(warning)).toBe(false);
    });
  });

  describe('isBuildWarning', () => {
    it('returns true for warning diagnostic', () => {
      const warning = buildWarning(BUILD_WARNING_CODES.LARGE_FILE_DETECTED, 'Large file');
      expect(isBuildWarning(warning)).toBe(true);
    });

    it('returns false for error diagnostic', () => {
      const error = buildError(BUILD_ERROR_CODES.SOURCE_NOT_FOUND, 'Not found');
      expect(isBuildWarning(error)).toBe(false);
    });
  });

  describe('getBuildErrors', () => {
    it('filters errors from mixed diagnostics', () => {
      const diagnostics = [
        buildError(BUILD_ERROR_CODES.SOURCE_NOT_FOUND, 'Not found'),
        buildWarning(BUILD_WARNING_CODES.LARGE_FILE_DETECTED, 'Large file'),
        buildError(BUILD_ERROR_CODES.PLUGIN_YML_MISSING, 'Missing'),
      ];
      const errors = getBuildErrors(diagnostics);
      expect(errors).toHaveLength(2);
      expect(errors.every((d) => isBuildError(d))).toBe(true);
    });

    it('returns empty array when no errors', () => {
      const diagnostics = [
        buildWarning(BUILD_WARNING_CODES.LARGE_FILE_DETECTED, 'Large file'),
      ];
      expect(getBuildErrors(diagnostics)).toHaveLength(0);
    });
  });

  describe('getBuildWarnings', () => {
    it('filters warnings from mixed diagnostics', () => {
      const diagnostics = [
        buildError(BUILD_ERROR_CODES.SOURCE_NOT_FOUND, 'Not found'),
        buildWarning(BUILD_WARNING_CODES.LARGE_FILE_DETECTED, 'Large file'),
      ];
      const warnings = getBuildWarnings(diagnostics);
      expect(warnings).toHaveLength(1);
      expect(warnings.every((d) => isBuildWarning(d))).toBe(true);
    });
  });

  describe('hasBuildErrors', () => {
    it('returns true when errors present', () => {
      const diagnostics = [
        buildError(BUILD_ERROR_CODES.SOURCE_NOT_FOUND, 'Not found'),
        buildWarning(BUILD_WARNING_CODES.LARGE_FILE_DETECTED, 'Large file'),
      ];
      expect(hasBuildErrors(diagnostics)).toBe(true);
    });

    it('returns false when only warnings', () => {
      const diagnostics = [
        buildWarning(BUILD_WARNING_CODES.LARGE_FILE_DETECTED, 'Large file'),
      ];
      expect(hasBuildErrors(diagnostics)).toBe(false);
    });
  });
});

describe('Type Guards', () => {
  const createMockResult = (overrides: Partial<import('../src/types.js').BuildResult> = {}) => ({
    success: true,
    request: {
      pluginId: 'test-plugin' as import('../src/types.js').PluginId,
      version: '1.0.0' as import('../src/types.js').SemVer,
      sourcePath: '/tmp/source',
      expectedTreeSha256: 'a'.repeat(64) as import('../src/types.js').Sha256,
      provenance: {
        upstreamRepository: 'owner/repo' as import('../src/types.js').RepositoryIdentity,
        upstreamBranch: 'main',
        upstreamCommit: 'a'.repeat(40) as import('../src/types.js').GitSha,
        storageRepository: 'axolotl-pm-pl/repo' as import('../src/types.js').RepositoryIdentity,
        storageBranch: 'main',
        storageCommit: 'a'.repeat(40) as import('../src/types.js').GitSha,
        materializationId: 'a'.repeat(64) as import('../src/types.js').MaterializationId,
        materializedAt: '2026-01-01T00:00:00Z',
        approvedAt: '2026-01-01T00:00:00Z',
        inspectedAt: '2026-01-01T00:00:00Z',
      },
    },
    durationMs: 1000,
    errors: [],
    warnings: [],
    securitySignals: [],
    ...overrides,
  });

  describe('isBuildSuccess', () => {
    it('returns true for successful result', () => {
      expect(isBuildSuccess(createMockResult({ success: true }))).toBe(true);
    });

    it('returns false for failed result', () => {
      expect(isBuildSuccess(createMockResult({ success: false }))).toBe(false);
    });
  });

  describe('isBuildFailure', () => {
    it('returns true for failed result', () => {
      expect(isBuildFailure(createMockResult({ success: false }))).toBe(true);
    });

    it('returns false for successful result', () => {
      expect(isBuildFailure(createMockResult({ success: true }))).toBe(false);
    });
  });

  describe('hasCriticalSecuritySignals', () => {
    it('returns true when critical signal present', () => {
      const result = createMockResult({
        securitySignals: [
          {
            type: SecuritySignalType.DANGEROUS_FUNCTION,
            severity: SecuritySignalSeverity.CRITICAL,
            message: 'eval() detected',
          },
        ],
      });
      expect(hasCriticalSecuritySignals(result)).toBe(true);
    });

    it('returns false when no signals', () => {
      const result = createMockResult({ securitySignals: [] });
      expect(hasCriticalSecuritySignals(result)).toBe(false);
    });

    it('returns false when only high severity signals', () => {
      const result = createMockResult({
        securitySignals: [
          {
            type: SecuritySignalType.BASE64_CONTENT,
            severity: SecuritySignalSeverity.HIGH,
            message: 'base64 detected',
          },
        ],
      });
      expect(hasCriticalSecuritySignals(result)).toBe(false);
    });
  });

  describe('hasSecuritySignals', () => {
    it('returns true when any signal present', () => {
      const result = createMockResult({
        securitySignals: [
          {
            type: SecuritySignalType.BASE64_CONTENT,
            severity: SecuritySignalSeverity.LOW,
            message: 'base64 detected',
          },
        ],
      });
      expect(hasSecuritySignals(result)).toBe(true);
    });

    it('returns false when no signals', () => {
      const result = createMockResult({ securitySignals: [] });
      expect(hasSecuritySignals(result)).toBe(false);
    });
  });
});

describe('Enums', () => {
  it('SecuritySignalSeverity has expected values', () => {
    expect(SecuritySignalSeverity.LOW).toBe('low');
    expect(SecuritySignalSeverity.MEDIUM).toBe('medium');
    expect(SecuritySignalSeverity.HIGH).toBe('high');
    expect(SecuritySignalSeverity.CRITICAL).toBe('critical');
  });

  it('SecuritySignalType has expected values', () => {
    expect(SecuritySignalType.DANGEROUS_FUNCTION).toBe('DANGEROUS_FUNCTION');
    expect(SecuritySignalType.BASE64_CONTENT).toBe('BASE64_CONTENT');
    expect(SecuritySignalType.COMMITTED_PHAR).toBe('COMMITTED_PHAR');
  });

  it('BuildSeverity has expected values', () => {
    expect(BuildSeverity.ERROR).toBe('error');
    expect(BuildSeverity.WARNING).toBe('warning');
    expect(BuildSeverity.INFO).toBe('info');
  });
});

describe('Error and Warning Codes', () => {
  it('BUILD_ERROR_CODES has required source validation codes', () => {
    expect(BUILD_ERROR_CODES.SOURCE_NOT_FOUND).toBe('SOURCE_NOT_FOUND');
    expect(BUILD_ERROR_CODES.SOURCE_PATH_INVALID).toBe('SOURCE_PATH_INVALID');
    expect(BUILD_ERROR_CODES.SOURCE_TREE_SHA_MISMATCH).toBe('SOURCE_TREE_SHA_MISMATCH');
  });

  it('BUILD_ERROR_CODES has required plugin.yml codes', () => {
    expect(BUILD_ERROR_CODES.PLUGIN_YML_MISSING).toBe('PLUGIN_YML_MISSING');
    expect(BUILD_ERROR_CODES.PLUGIN_YML_INVALID).toBe('PLUGIN_YML_INVALID');
    expect(BUILD_ERROR_CODES.PLUGIN_MAIN_MISSING).toBe('PLUGIN_MAIN_MISSING');
  });

  it('BUILD_ERROR_CODES has required PHAR codes', () => {
    expect(BUILD_ERROR_CODES.PHAR_BUILD_FAILED).toBe('PHAR_BUILD_FAILED');
    expect(BUILD_ERROR_CODES.PHAR_VALIDATION_FAILED).toBe('PHAR_VALIDATION_FAILED');
    expect(BUILD_ERROR_CODES.PHAR_CONTAINS_GIT).toBe('PHAR_CONTAINS_GIT');
    expect(BUILD_ERROR_CODES.PHAR_CONTAINS_SYMLINK).toBe('PHAR_CONTAINS_SYMLINK');
  });

  it('BUILD_ERROR_CODES has required security codes', () => {
    expect(BUILD_ERROR_CODES.SECURITY_SIGNAL_CRITICAL).toBe('SECURITY_SIGNAL_CRITICAL');
  });

  it('BUILD_WARNING_CODES has expected values', () => {
    expect(BUILD_WARNING_CODES.LARGE_FILE_DETECTED).toBe('LARGE_FILE_DETECTED');
    expect(BUILD_WARNING_CODES.VENDOR_DIR_DETECTED).toBe('VENDOR_DIR_DETECTED');
    expect(BUILD_WARNING_CODES.NO_RESOURCES_DIR).toBe('NO_RESOURCES_DIR');
  });
});
