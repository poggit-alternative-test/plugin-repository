/**
 * Search Generator
 *
 * Generates search index files for client-side fuzzy search.
 * Produces optimized index with normalized fields.
 */

import { ensureDirectory, writeJson } from '../utils/file.js';
import { loadRegistry, type LoadedPlugin } from '../utils/registry.js';
import type {
  SearchIndex,
  SearchIndexEntry,
  PopularPlugins,
  VersionStatus,
} from '../models/generated.js';

/**
 * Normalize text for search
 * - Lowercase
 * - Remove special characters
 * - Trim whitespace
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract keywords from name
 * Splits camelCase and PascalCase into words
 */
export function extractKeywords(name: string): string[] {
  const normalized = normalizeForSearch(name);
  // Split on spaces and hyphens
  const words = normalized.split(/[\s-]+/);
  // Also extract camelCase words
  const camelWords = name.match(/[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\d|$)/g) ?? [];
  return [...new Set([...words, ...camelWords.map(w => w.toLowerCase())])];
}

/**
 * Extract author from upstream repository
 */
function extractAuthor(upstreamRepository: string): string {
  const parts = upstreamRepository.split('/');
  return parts[0] ?? 'unknown';
}

/**
 * Convert version status
 */
function convertStatus(status: string): VersionStatus {
  switch (status) {
    case 'approved':
    case 'materialized':
    case 'published':
    case 'deprecated':
    case 'revoked':
    case 'removed':
      return status;
    default:
      return 'published';
  }
}

/**
 * Get the latest published version for a plugin
 */
function getLatestPublishedVersion(versions: LoadedPlugin['versions']) {
  let latest = versions[0];
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
function getLatestUpdateTimestamp(versions: LoadedPlugin['versions']): string {
  let latest = '';
  for (const v of versions) {
    if (v.status === 'published' || v.status === 'deprecated' || v.status === 'revoked') {
      const artifact = 'artifact' in v ? v.artifact : null;
      if (artifact && artifact.publishedAt > latest) {
        latest = artifact.publishedAt;
      }
    }
  }
  return latest;
}

/**
 * Calculate popularity score
 * Based on version count and download count
 */
function calculatePopularity(plugin: LoadedPlugin): number {
  // OutputVersion already excludes 'approved' status, so all versions count
  const versionCount = plugin.versions.length;
  // Simple scoring: version count normalized to 0-1
  return Math.min(versionCount / 10, 1);
}

/**
 * Generate search index
 */
export function generateSearchIndex(
  plugins: LoadedPlugin[],
  outputPath: string
): SearchIndex {
  const entries: SearchIndexEntry[] = [];

  for (const plugin of plugins) {
    const latestVersion = getLatestPublishedVersion(plugin.versions);
    const name = latestVersion?.artifact?.file?.replace('.phar', '') ?? plugin.identity.id;
    const author = extractAuthor(plugin.identity.upstream.repository);

    const entry: SearchIndexEntry = {
      id: plugin.identity.id,
      name,
      nameNormalized: normalizeForSearch(name),
      nameKeywords: extractKeywords(name),
      summary: '', // Will be populated from plugin.yml
      description: undefined,
      author,
      authorNormalized: normalizeForSearch(author),
      categories: [],
      tags: [],
      tagsNormalized: [],
      versionCount: plugin.versions.length,
      latestVersion: latestVersion?.version ?? '',
      status: latestVersion ? convertStatus(latestVersion.status) : 'published',
      license: undefined,
      downloads: undefined,
      popularity: calculatePopularity(plugin),
      updatedAt: getLatestUpdateTimestamp(plugin.versions),
    };

    entries.push(entry);
  }

  // Sort by popularity descending
  entries.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

  const index: SearchIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    plugins: entries,
    metadata: {
      count: entries.length,
      fields: [
        'name',
        'nameKeywords',
        'summary',
        'tags',
        'author',
        'description',
      ],
    },
  };

  // Write search index
  const indexPath = `${outputPath}/search/index.json`;
  ensureDirectory(`${outputPath}/search`);
  writeJson(indexPath, index);

  return index;
}

/**
 * Generate popular plugins list
 */
export function generatePopularPlugins(
  plugins: LoadedPlugin[],
  outputPath: string
): PopularPlugins {
  // Sort by popularity
  const sortedByPopularity = [...plugins].sort(
    (a, b) => calculatePopularity(b) - calculatePopularity(a)
  );

  // Get trending (top 10 by popularity)
  const trending = sortedByPopularity.slice(0, 10).map(plugin => ({
    id: plugin.identity.id,
    score: Math.round(calculatePopularity(plugin) * 100),
    delta: undefined, // Would require historical data
  }));

  // Get recently updated (sorted by latest update)
  const recentlyUpdated = [...plugins]
    .map(plugin => ({
      plugin,
      latestUpdate: getLatestUpdateTimestamp(plugin.versions),
    }))
    .filter(item => item.latestUpdate)
    .sort((a, b) => b.latestUpdate.localeCompare(a.latestUpdate))
    .slice(0, 10)
    .map(item => {
      const latestVersion = getLatestPublishedVersion(item.plugin.versions);
      return {
        id: item.plugin.identity.id,
        version: latestVersion?.version ?? '',
        updatedAt: item.latestUpdate,
      };
    });

  const popular: PopularPlugins = {
    trending,
    recentlyUpdated,
    newPlugins: undefined, // Would require createdAt tracking
  };

  // Write popular plugins
  const popularPath = `${outputPath}/search/popular.json`;
  ensureDirectory(`${outputPath}/search`);
  writeJson(popularPath, popular);

  return popular;
}

/**
 * Generate all search data
 */
export function generateAllSearch(
  plugins: LoadedPlugin[],
  outputPath: string
): {
  searchIndex: SearchIndex;
  popularPlugins: PopularPlugins;
} {
  const searchIndex = generateSearchIndex(plugins, outputPath);
  const popularPlugins = generatePopularPlugins(plugins, outputPath);

  return { searchIndex, popularPlugins };
}
