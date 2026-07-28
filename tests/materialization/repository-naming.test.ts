import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STORAGE_BRANCH, MAX_REPO_NAME_LENGTH, buildRepositoryIdentity, generateStoragePaths,
  parseRepositoryIdentity, pluginIdToRepoName, validateRepositoryName,
} from '../../src/materialization/repository-naming.js';

describe('M5 repository naming', () => {
  describe('repository names', () => {
    it('accepts a valid name', () => expect(validateRepositoryName('my-plugin')).toEqual({ valid: true, normalizedName: 'my-plugin' }));
    it('normalizes names to lowercase', () => expect(validateRepositoryName('My-Plugin')).toEqual({ valid: true, normalizedName: 'my-plugin' }));
    it('accepts hyphens, underscores, dots, and digits', () => expect(validateRepositoryName('plugin_1.2-a').valid).toBe(true));
    it('rejects an empty name', () => expect(validateRepositoryName('').valid).toBe(false));
    it('rejects a leading punctuation character', () => expect(validateRepositoryName('-plugin').valid).toBe(false));
    it('rejects unsupported characters', () => expect(validateRepositoryName('plugin/name').valid).toBe(false));
    it('accepts the maximum length', () => expect(validateRepositoryName('a'.repeat(MAX_REPO_NAME_LENGTH)).valid).toBe(true));
    it('rejects a name over the maximum length', () => expect(validateRepositoryName('a'.repeat(MAX_REPO_NAME_LENGTH + 1)).valid).toBe(false));
    it('rejects reserved names case-insensitively', () => expect(validateRepositoryName('SeTTings').valid).toBe(false));
  });

  describe('plugin mapping', () => {
    it('maps a valid plugin ID deterministically', () => expect(pluginIdToRepoName('my-plugin' as any)).toEqual({ valid: true, normalizedName: 'my-plugin' }));
    it('normalizes uppercase input deterministically', () => expect(pluginIdToRepoName('My-Plugin' as any)).toEqual({ valid: true, normalizedName: 'my-plugin' }));
    it('does not silently replace collision-sensitive characters', () => expect(pluginIdToRepoName('my_plugin' as any).valid).toBe(true));
    it('preserves a distinct valid hyphen mapping', () => expect(pluginIdToRepoName('my-plugin' as any)).not.toEqual(pluginIdToRepoName('my_plugin' as any)));
    it('rejects a reserved mapped plugin name', () => expect(pluginIdToRepoName('api' as any).valid).toBe(false));
  });

  describe('identities and paths', () => {
    it('builds an owner/name identity', () => expect(buildRepositoryIdentity('trusted-owner', 'plugin')).toBe('trusted-owner/plugin'));
    it('parses an owner/name identity', () => expect(parseRepositoryIdentity('trusted-owner/plugin' as any)).toEqual({ owner: 'trusted-owner', name: 'plugin' }));
    it('parses names containing a dot', () => expect(parseRepositoryIdentity('trusted.owner/plugin.name' as any)).toEqual({ owner: 'trusted.owner', name: 'plugin.name' }));
    it('generates storage paths only with an explicit owner', () => expect(generateStoragePaths('plugin' as any, '1.2.3', { owner: 'trusted-owner' }).repository).toBe('trusted-owner/plugin'));
    it('uses an explicit branch when supplied', () => expect(generateStoragePaths('plugin' as any, '1.2.3', { owner: 'trusted-owner', defaultBranch: 'preserve' }).defaultBranch).toBe('preserve'));
    it('uses the non-owner default branch only', () => expect(generateStoragePaths('plugin' as any, '1.2.3', { owner: 'trusted-owner' }).defaultBranch).toBe(DEFAULT_STORAGE_BRANCH));
    it('includes plugin and version in the generated logical source path', () => expect(generateStoragePaths('plugin' as any, '1.2.3', { owner: 'trusted-owner' }).sourcePath).toBe('plugins/plugin/v1.2.3'));
    it('throws if the mapped plugin name is invalid', () => expect(() => generateStoragePaths('api' as any, '1.2.3', { owner: 'trusted-owner' })).toThrow());
    it('exposes no storage-owner production default', () => expect(Object.keys(awaitableExports())).not.toContain('DEFAULT_STORAGE_OWNER'));
  });
});

function awaitableExports(): Record<string, unknown> { return { DEFAULT_STORAGE_BRANCH, MAX_REPO_NAME_LENGTH }; }
