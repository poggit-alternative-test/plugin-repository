/**
 * Search Service
 *
 * Provides access to search index and search functionality.
 * All search logic is implemented here - hooks only handle React state.
 */

import { loadJson, MissingFileError } from './client.js';
import type { PopularPlugins, SearchIndex, SearchIndexEntry, VersionStatus } from './types.js';

/** Path to the search index file */
const SEARCH_INDEX_PATH = '/search/index.json';

/** Path to the popular plugins file */
const POPULAR_PLUGINS_PATH = '/search/popular.json';

/**
 * Default empty SearchIndex for when file is missing
 * This represents an empty repository state
 */
const EMPTY_SEARCH_INDEX: SearchIndex = {
  version: 1,
  generatedAt: new Date().toISOString(),
  plugins: [],
  metadata: {
    count: 0,
    fields: ['id', 'name', 'author', 'summary', 'categories', 'tags'],
  },
};

/**
 * Default empty PopularPlugins for when file is missing
 * This represents an empty repository state
 */
const EMPTY_POPULAR_PLUGINS: PopularPlugins = {
  trending: [],
  recentlyUpdated: [],
};

/**
 * Get the search index
 *
 * Returns the full search index with all plugins.
 * Returns empty index if file is missing (empty repository).
 */
export async function getSearchIndex(): Promise<SearchIndex> {
  try {
    return await loadJson<SearchIndex>(SEARCH_INDEX_PATH);
  } catch (error) {
    if (error instanceof MissingFileError) {
      return EMPTY_SEARCH_INDEX;
    }
    throw error;
  }
}

/**
 * Get popular/trending plugins
 *
 * Returns trending and recently updated plugins.
 * Returns empty popular plugins if file is missing (empty repository).
 */
export async function getPopularPlugins(): Promise<PopularPlugins> {
  try {
    return await loadJson<PopularPlugins>(POPULAR_PLUGINS_PATH);
  } catch (error) {
    if (error instanceof MissingFileError) {
      return EMPTY_POPULAR_PLUGINS;
    }
    throw error;
  }
}

/**
 * Filter configuration for plugin queries
 */
export interface PluginFilter {
  author?: string;
  category?: string;
  status?: VersionStatus;
}

/**
 * Filter plugins by author, category, and/or status
 *
 * All filters are combined with AND logic.
 * Omit a filter property to ignore that filter.
 *
 * @param filter - Filter criteria
 * @returns Matching plugins
 *
 * @example
 * // Get all plugins by an author
 * const plugins = await filterPlugins({ author: 'poggit' });
 *
 * // Get all published plugins in a category
 * const plugins = await filterPlugins({ category: 'admin-tools', status: 'published' });
 */
export async function filterPlugins(filter: PluginFilter): Promise<SearchIndexEntry[]> {
  const index = await getSearchIndex();
  let results = index.plugins;

  if (filter.author) {
    const normalizedAuthor = filter.author.toLowerCase();
    results = results.filter(
      (plugin) => plugin.authorNormalized === normalizedAuthor
    );
  }

  if (filter.category) {
    results = results.filter((plugin) =>
      plugin.categories.includes(filter.category!)
    );
  }

  if (filter.status) {
    results = results.filter((plugin) => plugin.status === filter.status);
  }

  return results;
}

/**
 * Search query options
 */
export interface SearchOptions {
  query: string;
  limit?: number;
  filters?: PluginFilter;
}

/**
 * Search result with relevance score
 */
export interface ScoredSearchResult {
  plugin: SearchIndexEntry;
  score: number;
}

/**
 * Search plugins by query
 *
 * Performs search across plugin names, authors, and keywords.
 * Results are scored by relevance and ranked accordingly.
 *
 * @param query - The search query string
 * @param limit - Maximum number of results (default: 20)
 * @param filters - Optional filters to apply
 * @returns Matching plugins sorted by relevance
 */
export async function search(
  query: string,
  limit = 20,
  filters?: PluginFilter
): Promise<SearchIndexEntry[]> {
  const index = await getSearchIndex();
  let plugins = index.plugins;

  // Apply filters first if provided
  if (filters) {
    if (filters.author) {
      const normalizedAuthor = filters.author.toLowerCase();
      plugins = plugins.filter((p) => p.authorNormalized === normalizedAuthor);
    }
    if (filters.category) {
      plugins = plugins.filter((p) => p.categories.includes(filters.category!));
    }
    if (filters.status) {
      plugins = plugins.filter((p) => p.status === filters.status);
    }
  }

  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return [];
  }

  const queryTerms = normalizedQuery.split(/\s+/);

  // Score each plugin by relevance
  const scored: ScoredSearchResult[] = [];

  for (const plugin of plugins) {
    let score = 0;

    // Exact match on name (highest weight)
    if (plugin.name.toLowerCase() === normalizedQuery) {
      score += 100;
    }

    // Name starts with query
    if (plugin.nameNormalized.startsWith(normalizedQuery)) {
      score += 50;
    }

    // Name contains query
    if (plugin.nameNormalized.includes(normalizedQuery)) {
      score += 30;
    }

    // Author exact match
    if (plugin.authorNormalized === normalizedQuery) {
      score += 40;
    }

    // Author contains query
    if (plugin.authorNormalized.includes(normalizedQuery)) {
      score += 20;
    }

    // Term-by-term matching
    for (const term of queryTerms) {
      if (plugin.nameNormalized.includes(term)) {
        score += 10;
      }
      if (plugin.authorNormalized.includes(term)) {
        score += 5;
      }
      if (plugin.nameKeywords.some((k) => k.includes(term))) {
        score += 8;
      }
      if (plugin.tagsNormalized.some((t) => t.includes(term))) {
        score += 5;
      }
    }

    if (score > 0) {
      scored.push({ plugin, score });
    }
  }

  // Sort by score descending and limit results
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((result) => result.plugin);
}
