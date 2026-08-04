/**
 * Registry Loader
 *
 * Loads Registry YAML using the Registry domain parser.
 * Registry owns parsing; Generator only transforms.
 * Registry owns domain types; Generator imports them.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

// Import from Registry domain - Registry owns parsing and types
import { parsePluginIdentity, parseVersionRecord } from '@registry/parser';
import type { PluginIdentity, VersionRecord, MaterializedVersion, PublishedVersion, DeprecatedVersion, RevokedVersion, RemovedVersion } from '@registry/types';

// ============================================================
// Generator-Specific Types (Narrowed from Registry)
// ============================================================

/**
 * Output version status values (excludes 'approved')
 */
export type OutputVersionStatus = 'materialized' | 'published' | 'deprecated' | 'revoked' | 'removed';

/**
 * Provenance reference type
 */
export interface OutputProvenanceRef {
  type: string;
}

/**
 * Artifact reference type (all statuses include artifact except materialized)
 */
export interface OutputArtifactRef {
  releaseTag: string;
  file: string;
  sha256: string;
  publishedAt: string;
  provenance?: OutputProvenanceRef;
}

/**
 * Output version for the Generator
 *
 * These types are narrowed from Registry VersionRecord:
 * - Excludes 'approved' status (not yet released)
 * - All statuses have the same base shape with status-specific additions
 */
export interface BaseOutputVersion {
  schemaVersion: number;
  version: string;
  status: OutputVersionStatus;
  source: {
    upstreamCommit: string;
  };
  review: {
    pullRequest: number;
    reviewer: string;
    approvedAt: string;
  };
  storage: {
    repository: string;
    commit: string;
  };
  artifact: OutputArtifactRef;
}

export interface OutputMaterializedVersion extends BaseOutputVersion {
  status: 'materialized';
}

export interface OutputPublishedVersion extends BaseOutputVersion {
  status: 'published';
}

export interface OutputDeprecatedVersion extends BaseOutputVersion {
  status: 'deprecated';
}

export interface OutputRevokedVersion extends BaseOutputVersion {
  status: 'revoked';
  revokedAt: string;
  reason?: string;
}

export interface OutputRemovedVersion extends BaseOutputVersion {
  status: 'removed';
  removedAt: string;
  reason?: string;
}

export type OutputVersion =
  | OutputMaterializedVersion
  | OutputPublishedVersion
  | OutputDeprecatedVersion
  | OutputRevokedVersion
  | OutputRemovedVersion;

// ============================================================
// Loading Types
// ============================================================

export interface LoadedPlugin {
  identity: PluginIdentity;
  versions: OutputVersion[];
}

export interface RegistryLoadError {
  plugin?: string;
  file: string;
  error: string;
}

// ============================================================
// Registry Loading Functions
// ============================================================

/**
 * Load all plugins from the registry
 * Filters out 'approved' versions (not yet released)
 */
export function loadRegistry(registryPath: string): { plugins: LoadedPlugin[]; errors: RegistryLoadError[] } {
  const plugins: LoadedPlugin[] = [];
  const errors: RegistryLoadError[] = [];

  const pluginsDir = join(registryPath, 'plugins');

  let pluginDirs: string[];
  try {
    pluginDirs = readdirSync(pluginsDir);
  } catch {
    return { plugins: [], errors: [] };
  }

  for (const pluginDir of pluginDirs) {
    const pluginPath = join(pluginsDir, pluginDir);

    try {
      const stat = statSync(pluginPath);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const result = loadPlugin(pluginPath);
    if (result.plugin) {
      plugins.push(result.plugin);
    }
    if (result.error) {
      errors.push(result.error);
    }
  }

  return { plugins, errors };
}

/**
 * Load a single plugin from the registry
 * Filters to only released versions (not 'approved')
 */
export function loadPlugin(pluginDir: string): { plugin: LoadedPlugin | null; error: RegistryLoadError | null } {
  const pluginId = basename(pluginDir);

  const pluginYamlPath = join(pluginDir, 'plugin.yaml');
  let identity: PluginIdentity | null = null;

  try {
    const content = readFileSync(pluginYamlPath, 'utf-8');
    const { identity: parsedIdentity, diagnostics } = parsePluginIdentity(pluginYamlPath, content);

    if (diagnostics.length === 0 && parsedIdentity) {
      identity = parsedIdentity;
    } else {
      const errorMsg = diagnostics.map(d => d.message).join('; ');
      return {
        plugin: null,
        error: { plugin: pluginId, file: pluginYamlPath, error: errorMsg || 'Invalid plugin.yaml' },
      };
    }
  } catch (e) {
    return {
      plugin: null,
      error: { plugin: pluginId, file: pluginYamlPath, error: e instanceof Error ? e.message : 'Failed to read plugin.yaml' },
    };
  }

  if (!identity) {
    return { plugin: null, error: { plugin: pluginId, file: pluginYamlPath, error: 'Invalid plugin.yaml' } };
  }

  const versionsDir = join(pluginDir, 'versions');
  const versions: OutputVersion[] = [];

  let versionFiles: string[];
  try {
    versionFiles = readdirSync(versionsDir);
  } catch {
    return { plugin: { identity, versions }, error: null };
  }

  for (const versionFile of versionFiles) {
    if (!versionFile.endsWith('.yaml') && !versionFile.endsWith('.yml')) continue;

    const versionPath = join(versionsDir, versionFile);

    try {
      const stat = statSync(versionPath);
      if (!stat.isFile()) continue;
    } catch {
      continue;
    }

    try {
      const content = readFileSync(versionPath, 'utf-8');
      const { version, diagnostics: versionDiagnostics } = parseVersionRecord(versionPath, content);

      // Skip invalid versions
      if (versionDiagnostics.length > 0 || !version) continue;

      // Skip 'approved' versions - not yet released
      if (version.status === 'approved') continue;

      // Transform Registry version to Generator version type
      const transformed = transformVersion(version);
      versions.push(transformed);
    } catch {
      // Skip unreadable files
    }
  }

  return { plugin: { identity, versions }, error: null };
}

/**
 * Transform Registry VersionRecord to Generator OutputVersion
 * Filters to released statuses only
 *
 * Note: The input VersionRecord may be 'approved', but we filter those out
 * before calling this function. This function handles materialized+.
 */
function transformVersion(v: VersionRecord): OutputVersion {
  // Type-safe handling for each version status
  // Each case properly narrows the type

  if (v.status === 'materialized') {
    const mv = v as MaterializedVersion;
    return {
      schemaVersion: v.schemaVersion,
      version: v.version,
      status: 'materialized',
      source: { upstreamCommit: v.source.upstreamCommit },
      review: {
        pullRequest: v.review.pullRequest,
        reviewer: v.review.reviewer,
        approvedAt: v.review.approvedAt,
      },
      storage: {
        repository: mv.storage.repository,
        commit: mv.storage.commit,
      },
      artifact: {
        releaseTag: `v${v.version}`,
        file: '',
        sha256: '',
        publishedAt: '',
      },
    };
  }

  if (v.status === 'published') {
    const pv = v as PublishedVersion;
    return {
      schemaVersion: v.schemaVersion,
      version: v.version,
      status: 'published',
      source: { upstreamCommit: v.source.upstreamCommit },
      review: {
        pullRequest: v.review.pullRequest,
        reviewer: v.review.reviewer,
        approvedAt: v.review.approvedAt,
      },
      storage: {
        repository: pv.storage.repository,
        commit: pv.storage.commit,
      },
      artifact: {
        releaseTag: pv.artifact.releaseTag,
        file: pv.artifact.file,
        sha256: pv.artifact.sha256,
        publishedAt: pv.artifact.publishedAt,
        provenance: pv.artifact.provenance,
      },
    };
  }

  if (v.status === 'deprecated') {
    const dv = v as DeprecatedVersion;
    return {
      schemaVersion: v.schemaVersion,
      version: v.version,
      status: 'deprecated',
      source: { upstreamCommit: v.source.upstreamCommit },
      review: {
        pullRequest: v.review.pullRequest,
        reviewer: v.review.reviewer,
        approvedAt: v.review.approvedAt,
      },
      storage: {
        repository: dv.storage.repository,
        commit: dv.storage.commit,
      },
      artifact: {
        releaseTag: dv.artifact.releaseTag,
        file: dv.artifact.file,
        sha256: dv.artifact.sha256,
        publishedAt: dv.artifact.publishedAt,
        provenance: dv.artifact.provenance,
      },
    };
  }

  if (v.status === 'revoked') {
    const rv = v as RevokedVersion;
    return {
      schemaVersion: v.schemaVersion,
      version: v.version,
      status: 'revoked',
      source: { upstreamCommit: v.source.upstreamCommit },
      review: {
        pullRequest: v.review.pullRequest,
        reviewer: v.review.reviewer,
        approvedAt: v.review.approvedAt,
      },
      storage: {
        repository: rv.storage.repository,
        commit: rv.storage.commit,
      },
      artifact: {
        releaseTag: rv.artifact.releaseTag,
        file: rv.artifact.file,
        sha256: rv.artifact.sha256,
        publishedAt: rv.artifact.publishedAt,
        provenance: rv.artifact.provenance,
      },
      revokedAt: rv.revokedAt,
      reason: rv.reason,
    };
  }

  if (v.status === 'removed') {
    const rmv = v as RemovedVersion;
    return {
      schemaVersion: v.schemaVersion,
      version: v.version,
      status: 'removed',
      source: { upstreamCommit: v.source.upstreamCommit },
      review: {
        pullRequest: v.review.pullRequest,
        reviewer: v.review.reviewer,
        approvedAt: v.review.approvedAt,
      },
      storage: {
        repository: rmv.storage.repository,
        commit: rmv.storage.commit,
      },
      artifact: {
        releaseTag: rmv.artifact.releaseTag,
        file: rmv.artifact.file,
        sha256: rmv.artifact.sha256,
        publishedAt: rmv.artifact.publishedAt,
        provenance: rmv.artifact.provenance,
      },
      removedAt: rmv.removedAt,
      reason: rmv.reason,
    };
  }

  // This should never happen since we filter 'approved' before calling
  // but TypeScript needs an exhaustive check
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _status = (v as VersionRecord).status;
  throw new Error(`Unexpected version status: ${_status}`);
}
