import type { PluginId, RepositoryIdentity } from './materialization-types.js';

/** There is intentionally no production storage-owner default. */
export const DEFAULT_STORAGE_BRANCH = 'main';
export const MAX_REPO_NAME_LENGTH = 64;
const VALID_NAME_CHARS = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*$/;
const RESERVED_NAMES = new Set(['api', 'settings', 'organizations', 'admin', 'login']);
export type RepositoryNameValidationResult = { valid: true; normalizedName: string } | { valid: false; error: string; code: 'INVALID_FORMAT' | 'TOO_LONG' | 'RESERVED_NAME' | 'INVALID_CHARACTERS' };
export function validateRepositoryName(name: string): RepositoryNameValidationResult {
  if (!name || name.length > MAX_REPO_NAME_LENGTH) return { valid: false, error: `Repository name must be between 1 and ${MAX_REPO_NAME_LENGTH} characters`, code: 'TOO_LONG' };
  if (!VALID_NAME_CHARS.test(name)) return { valid: false, error: 'Repository name has invalid characters', code: 'INVALID_CHARACTERS' };
  if (RESERVED_NAMES.has(name.toLowerCase())) return { valid: false, error: `Repository name '${name}' is reserved`, code: 'RESERVED_NAME' };
  return { valid: true, normalizedName: name.toLowerCase() };
}
export function pluginIdToRepoName(pluginId: PluginId): RepositoryNameValidationResult { return validateRepositoryName(String(pluginId).toLowerCase()); }
export function buildRepositoryIdentity(owner: string, name: string): RepositoryIdentity { return `${owner}/${name}` as RepositoryIdentity; }
export function parseRepositoryIdentity(identity: RepositoryIdentity): { owner: string; name: string } { const [owner, name] = String(identity).split('/'); return { owner, name }; }
export interface StoragePathConfig { owner: string; defaultBranch?: string; }
export interface StoragePaths { repository: RepositoryIdentity; defaultBranch: string; repositoryUrl: string; sourcePath: string; }
export function generateStoragePaths(pluginId: PluginId, version: string, config: StoragePathConfig): StoragePaths {
  const name = pluginIdToRepoName(pluginId); if (!name.valid) throw new Error(name.error);
  const repository = buildRepositoryIdentity(config.owner, name.normalizedName);
  return { repository, defaultBranch: config.defaultBranch ?? DEFAULT_STORAGE_BRANCH, repositoryUrl: `https://github.com/${repository}`, sourcePath: `plugins/${pluginId}/v${version}` };
}
