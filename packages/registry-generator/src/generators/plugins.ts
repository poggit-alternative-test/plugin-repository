/**
 * Plugin Generator
 *
 * Generates plugin.json files for the Website.
 * Uses OutputVersion type which excludes 'approved' status.
 */

import { ensureDirectory, writeJson } from '../utils/file.js';
import { loadRegistry, type LoadedPlugin, type OutputVersion } from '../utils/registry.js';
import type {
  Plugin,
  PluginList,
  PluginListItem,
} from '../models/generated.js';

/**
 * Extract author from upstream repository
 */
function extractAuthor(upstreamRepository: string): string {
  const parts = upstreamRepository.split('/');
  return parts[0] ?? 'unknown';
}

/**
 * Get the latest published version
 */
function getLatestPublishedVersion(versions: OutputVersion[]): OutputVersion | undefined {
  let latest: OutputVersion | undefined;
  for (const v of versions) {
    if (v.status === 'published') {
      if (!latest || v.version > latest.version) {
        latest = v;
      }
    }
  }
  return latest;
}

/**
 * Get the latest update timestamp
 */
function getLatestUpdateTimestamp(versions: OutputVersion[]): string {
  let latest = '';
  for (const v of versions) {
    if (v.artifact && v.artifact.publishedAt > latest) {
      latest = v.artifact.publishedAt;
    }
  }
  return latest;
}

/**
 * Generate plugin index
 */
export function generatePluginIndex(
  plugins: LoadedPlugin[],
  outputPath: string
): PluginList {
  const items: PluginListItem[] = [];

  for (const plugin of plugins) {
    const latestVersion = getLatestPublishedVersion(plugin.versions);

    items.push({
      id: plugin.identity.id,
      name: latestVersion?.artifact?.file?.replace('.phar', '') ?? plugin.identity.id,
      summary: '',
      latestVersion: latestVersion?.version ?? '',
      status: latestVersion?.status ?? 'published',
      author: extractAuthor(plugin.identity.upstream.repository),
      updatedAt: getLatestUpdateTimestamp(plugin.versions),
    });
  }

  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const list: PluginList = {
    plugins: items,
    pagination: {
      page: 1,
      perPage: 20,
      total: items.length,
      totalPages: Math.ceil(items.length / 20),
    },
  };

  const indexPath = `${outputPath}/plugins/index.json`;
  ensureDirectory(`${outputPath}/plugins`);
  writeJson(indexPath, list);

  return list;
}

/**
 * Generate individual plugin files
 */
export function generatePlugins(
  plugins: LoadedPlugin[],
  outputPath: string
): Plugin[] {
  const generatedPlugins: Plugin[] = [];

  for (const plugin of plugins) {
    const latestVersion = getLatestPublishedVersion(plugin.versions);

    // Version summaries
    const versionSummaries = plugin.versions
      .map(v => ({
        version: v.version,
        status: v.status,
        publishedAt: v.artifact?.publishedAt ?? '',
        apiVersion: undefined,
      }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

    // Latest release (duplicated for performance)
    let latestRelease: Plugin['latestRelease'] = undefined;
    if (latestVersion?.artifact) {
      latestRelease = {
        version: latestVersion.version,
        file: latestVersion.artifact.file,
        sha256: latestVersion.artifact.sha256,
        size: 0,
        publishedAt: latestVersion.artifact.publishedAt,
      };
    }

    const generated: Plugin = {
      id: plugin.identity.id,
      name: latestVersion?.artifact?.file?.replace('.phar', '') ?? plugin.identity.id,
      summary: '',
      upstream: {
        repository: plugin.identity.upstream.repository,
        branch: plugin.identity.upstream.branch,
      },
      storage: plugin.identity.storage,
      author: extractAuthor(plugin.identity.upstream.repository),
      status: latestVersion?.status ?? 'published',
      versions: versionSummaries,
      latestVersion: latestVersion?.version ?? '',
      latestRelease,
      createdAt: plugin.versions[0]?.review?.approvedAt ?? new Date().toISOString(),
      updatedAt: getLatestUpdateTimestamp(plugin.versions),
    };

    // Provenance info if available
    if (latestVersion?.artifact?.provenance) {
      generated.verified = {
        githubAttestation: latestVersion.artifact.provenance.type === 'github-attestation',
        reviewer: plugin.versions[0]?.review?.reviewer,
      };
    }

    const pluginPath = `${outputPath}/plugins/${plugin.identity.id}.json`;
    ensureDirectory(`${outputPath}/plugins`);
    writeJson(pluginPath, generated);

    generatedPlugins.push(generated);
  }

  return generatedPlugins;
}

/**
 * Generate all plugin data
 */
export function generateAllPlugins(
  registryPath: string,
  outputPath: string
): {
  plugins: LoadedPlugin[];
  pluginList: PluginList;
  generatedPlugins: Plugin[];
} {
  const { plugins, errors } = loadRegistry(registryPath);

  if (errors.length > 0) {
    console.warn(`Registry load warnings: ${errors.length} errors`);
    for (const error of errors) {
      console.warn(`  ${error.file}: ${error.error}`);
    }
  }

  const pluginList = generatePluginIndex(plugins, outputPath);
  const generatedPlugins = generatePlugins(plugins, outputPath);

  return { plugins, pluginList, generatedPlugins };
}
