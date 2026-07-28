/**
 * M5 Materialization Domain Types Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isValidGitSha,
  isValidSha256,
  isValidSemVer,
  isValidPluginId,
  isValidRepositoryIdentity,
  isAllowedStorageOwner,
  materializationError,
  materializationWarning,
  isMaterializationError,
  getMaterializationErrors,
  hasMaterializationErrors,
  MaterializationSeverity,
  MATERIALIZATION_CODES,
  MATERIALIZATION_WARNINGS,
  ProvenanceStatus,
} from '../../src/materialization/materialization-types.js';

describe('M5: Materialization Types', () => {
  describe('isValidGitSha', () => {
    it('should accept valid 40-character hex SHA', () => {
      expect(isValidGitSha('a'.repeat(40))).toBe(true);
      expect(isValidGitSha('0'.repeat(40))).toBe(true);
      expect(isValidGitSha('abc123def456789012345678901234567890abcd')).toBe(true);
      expect(isValidGitSha('ABC123DEF456789012345678901234567890ABCD')).toBe(true); // uppercase
    });

    it('should reject invalid SHA', () => {
      expect(isValidGitSha('')).toBe(false);
      expect(isValidGitSha('abc')).toBe(false);
      expect(isValidGitSha('x'.repeat(40))).toBe(false); // invalid hex
      expect(isValidGitSha('a'.repeat(39))).toBe(false); // too short
      expect(isValidGitSha('a'.repeat(41))).toBe(false); // too long
      expect(isValidGitSha('gggg' + 'a'.repeat(36))).toBe(false); // g is not hex
    });
  });

  describe('isValidSha256', () => {
    it('should accept valid 64-character hex SHA-256', () => {
      expect(isValidSha256('a'.repeat(64))).toBe(true);
      expect(isValidSha256('0'.repeat(64))).toBe(true);
    });

    it('should reject invalid SHA-256', () => {
      expect(isValidSha256('a'.repeat(63))).toBe(false);
      expect(isValidSha256('a'.repeat(65))).toBe(false);
      expect(isValidSha256('g' + 'a'.repeat(63))).toBe(false);
    });
  });

  describe('isValidSemVer', () => {
    it('should accept valid SemVer strings', () => {
      expect(isValidSemVer('1.0.0')).toBe(true);
      expect(isValidSemVer('0.1.0')).toBe(true);
      expect(isValidSemVer('10.20.30')).toBe(true);
      expect(isValidSemVer('1.0.0-alpha')).toBe(true);
      expect(isValidSemVer('1.0.0-alpha.1')).toBe(true);
      expect(isValidSemVer('1.0.0+build')).toBe(true);
      expect(isValidSemVer('1.0.0-alpha+build')).toBe(true);
    });

    it('should reject invalid SemVer', () => {
      expect(isValidSemVer('')).toBe(false);
      expect(isValidSemVer('1')).toBe(false);
      expect(isValidSemVer('1.0')).toBe(false);
      expect(isValidSemVer('1.0.')).toBe(false);
      expect(isValidSemVer('v1.0.0')).toBe(false);
    });
  });

  describe('isValidPluginId', () => {
    it('should accept valid plugin IDs', () => {
      expect(isValidPluginId('my-plugin')).toBe(true);
      expect(isValidPluginId('plugin123')).toBe(true);
      expect(isValidPluginId('a')).toBe(true);
      expect(isValidPluginId('my-plugin-v2')).toBe(true);
      expect(isValidPluginId('plugin-with-many-words')).toBe(true);
    });

    it('should reject invalid plugin IDs', () => {
      expect(isValidPluginId('')).toBe(false);
      expect(isValidPluginId('-plugin')).toBe(false); // starts with hyphen
      expect(isValidPluginId('plugin-')).toBe(false); // ends with hyphen
      expect(isValidPluginId('my plugin')).toBe(false); // space
      expect(isValidPluginId('my.plugin')).toBe(false); // dot
      expect(isValidPluginId('my_plugin')).toBe(false); // underscore
      // Note: regex is case-insensitive, so 'MyPlugin' is valid (becomes 'myplugin')
    });
  });

  describe('isValidRepositoryIdentity', () => {
    it('should accept valid repository identities', () => {
      expect(isValidRepositoryIdentity('owner/repo')).toBe(true);
      expect(isValidRepositoryIdentity('my-org/my-plugin')).toBe(true);
      expect(isValidRepositoryIdentity('user123/repo456')).toBe(true);
      expect(isValidRepositoryIdentity('org.repo/repo')).toBe(true);
    });

    it('should reject invalid repository identities', () => {
      expect(isValidRepositoryIdentity('')).toBe(false);
      expect(isValidRepositoryIdentity('repo')).toBe(false); // missing owner
      expect(isValidRepositoryIdentity('owner/')).toBe(false); // missing repo
      expect(isValidRepositoryIdentity('/repo')).toBe(false); // missing owner
      expect(isValidRepositoryIdentity('owner/sub/repo')).toBe(false); // too many parts
    });
  });

  describe('isAllowedStorageOwner', () => {
    const allowedOwners = ['axolotl-pm-plugins', 'my-org'];

    it('should accept allowed owners', () => {
      expect(isAllowedStorageOwner('axolotl-pm-plugins/repo' as any, allowedOwners)).toBe(true);
      expect(isAllowedStorageOwner('my-org/repo' as any, allowedOwners)).toBe(true);
    });

    it('should reject disallowed owners', () => {
      expect(isAllowedStorageOwner('evil-org/repo' as any, allowedOwners)).toBe(false);
      expect(isAllowedStorageOwner('axolotl-pm-plugins-other/repo' as any, allowedOwners)).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isAllowedStorageOwner('AXOLOTL-PM-PLUGINS/repo' as any, allowedOwners)).toBe(true);
      expect(isAllowedStorageOwner('My-Org/repo' as any, allowedOwners)).toBe(true);
    });
  });

  describe('diagnostic factory functions', () => {
    it('should create error diagnostics', () => {
      const error = materializationError('INVALID_SHA', 'Invalid SHA provided');
      expect(error.code).toBe('INVALID_SHA');
      expect(error.severity).toBe(MaterializationSeverity.ERROR);
      expect(error.message).toBe('Invalid SHA provided');
      expect(error.context).toBeUndefined();
    });

    it('should create error diagnostics with context', () => {
      const error = materializationError('INVALID_SHA', 'Invalid SHA', { sha: 'abc' });
      expect(error.context).toEqual({ sha: 'abc' });
    });

    it('should create warning diagnostics', () => {
      const warning = materializationWarning('DRY_RUN_MODE', 'Running in dry-run mode');
      expect(warning.code).toBe('DRY_RUN_MODE');
      expect(warning.severity).toBe(MaterializationSeverity.WARNING);
      expect(warning.message).toBe('Running in dry-run mode');
    });
  });

  describe('diagnostic helper functions', () => {
    it('should identify errors', () => {
      const error = materializationError('INVALID_SHA', 'test');
      const warning = materializationWarning('DRY_RUN_MODE', 'test');
      expect(isMaterializationError(error)).toBe(true);
      expect(isMaterializationError(warning)).toBe(false);
    });

    it('should filter errors', () => {
      const diagnostics = [
        materializationError('INVALID_SHA', 'test1'),
        materializationWarning('DRY_RUN_MODE', 'test2'),
        materializationError('EXECUTION_FAILED', 'test3'),
      ];
      const errors = getMaterializationErrors(diagnostics);
      expect(errors).toHaveLength(2);
    });

    it('should check for errors', () => {
      expect(hasMaterializationErrors([])).toBe(false);
      expect(hasMaterializationErrors([materializationWarning('DRY_RUN_MODE', 'test')])).toBe(false);
      expect(hasMaterializationErrors([materializationError('INVALID_SHA', 'test')])).toBe(true);
    });
  });

  describe('MATERIALIZATION_CODES', () => {
    it('should have all required error codes', () => {
      expect(MATERIALIZATION_CODES.INVALID_SHA).toBeDefined();
      expect(MATERIALIZATION_CODES.INVALID_PLUGIN_ID).toBeDefined();
      expect(MATERIALIZATION_CODES.INVALID_VERSION).toBeDefined();
      expect(MATERIALIZATION_CODES.STORAGE_OWNER_NOT_ALLOWED).toBeDefined();
      expect(MATERIALIZATION_CODES.SOURCE_ARCHIVE_MISSING).toBeDefined();
      expect(MATERIALIZATION_CODES.WRITE_MODE_NOT_ENABLED).toBeDefined();
      expect(MATERIALIZATION_CODES.GITHUB_REPOSITORY_NOT_FOUND).toBeDefined();
    });
  });

  describe('MATERIALIZATION_WARNINGS', () => {
    it('should have all required warning codes', () => {
      expect(MATERIALIZATION_WARNINGS.DRY_RUN_MODE).toBeDefined();
      expect(MATERIALIZATION_WARNINGS.LARGE_FILE_COUNT).toBeDefined();
      expect(MATERIALIZATION_WARNINGS.FILE_COUNT_EXCEEDS_RECOMMENDATION).toBeDefined();
      expect(MATERIALIZATION_WARNINGS.SYMLINKS_IGNORED).toBeDefined();
    });
  });

  describe('ProvenanceStatus', () => {
    it('should have correct status values', () => {
      expect(ProvenanceStatus.PENDING).toBe('pending');
      expect(ProvenanceStatus.COMPLETED).toBe('completed');
      expect(ProvenanceStatus.FAILED).toBe('failed');
    });
  });
});
