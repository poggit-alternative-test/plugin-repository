/**
 * Generated Services
 *
 * Data access layer for the generated JSON files.
 *
 * @example
 * import { getPlugin, getVersion } from '@/services/generated';
 */

// Types
export * from './types.js';

// Client
export { configureDataSource, getDataSourceConfig, clearCache, preload } from './client.js';
export { loadJson, loadCached } from './client.js';
export type { DataSourceConfig, GeneratedClient } from './client.js';

// Manifest
export { getManifest } from './manifest.js';

// Plugins
export { getPlugins, getPlugin, pluginExists } from './plugins.js';

// Versions
export { getVersion, getVersions } from './versions.js';

// Authors
export { getAuthors, getAuthor } from './authors.js';

// Search
export {
  getSearchIndex,
  getPopularPlugins,
  search,
  filterPlugins,
} from './search.js';
export type { PluginFilter, SearchOptions, ScoredSearchResult } from './search.js';
