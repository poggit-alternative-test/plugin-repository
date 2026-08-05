/**
 * Plugins Service
 *
 * Provides access to plugin data.
 */

import { loadJson, MissingFileError } from './client.js';
import type { Plugin, PluginList, VersionStatus } from './types.js';

/** Path to the plugin index file */
const PLUGIN_INDEX_PATH = '/plugins/index.json';

/** Path prefix for individual plugin files */
const PLUGIN_PATH_PREFIX = '/plugins/';

/** File extension for plugin files */
const PLUGIN_FILE_EXTENSION = '.json';

/**
 * Default empty PluginList for when file is missing
 * This represents an empty repository state
 */
const EMPTY_PLUGIN_LIST: PluginList = {
  plugins: [],
  pagination: {
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0,
  },
};

/**
 * Get the plugin list
 *
 * Returns a paginated list of all plugins.
 * Returns empty list if file is missing (empty repository).
 */
export async function getPlugins(): Promise<PluginList> {
  try {
    return await loadJson<PluginList>(PLUGIN_INDEX_PATH);
  } catch (error) {
    if (error instanceof MissingFileError) {
      return EMPTY_PLUGIN_LIST;
    }
    throw error;
  }
}

/**
 * Get a single plugin by ID
 *
 * @param id - The plugin ID
 * @returns The plugin data or undefined if not found
 */
export async function getPlugin(id: string): Promise<Plugin | undefined> {
  try {
    // First try to fetch individual plugin file
    const path = `${PLUGIN_PATH_PREFIX}${id}${PLUGIN_FILE_EXTENSION}`;
    return await loadJson<Plugin>(path);
  } catch {
    // Fallback: try to find in the index file and convert to full Plugin format
    try {
      const pluginList = await getPlugins();
      const listItem = pluginList.plugins.find(p => p.id === id);
      if (!listItem) return undefined;

      // Convert PluginListItem to Plugin format with defaults
      return {
        id: listItem.id,
        name: listItem.name,
        summary: listItem.summary,
        author: listItem.author,
        repo: listItem.repo,
        repoUrl: listItem.repoUrl,
        status: listItem.status as VersionStatus || 'materialized',
        latestVersion: listItem.latestVersion,
        updatedAt: listItem.updatedAt || new Date().toISOString(),
        createdAt: listItem.updatedAt || new Date().toISOString(),
        versions: [{ version: listItem.latestVersion, status: listItem.status as VersionStatus || 'materialized', publishedAt: listItem.updatedAt || new Date().toISOString() }],
        upstream: { repository: listItem.repo || listItem.id, branch: 'main' },
        latestRelease: listItem.downloads ? {
          version: listItem.latestVersion,
          file: '',
          sha256: '',
          size: 0,
          publishedAt: listItem.updatedAt || new Date().toISOString()
        } : undefined,
        downloads: listItem.downloads ? { total: listItem.downloads } : undefined,
      } as Plugin;
    } catch {
      return undefined;
    }
  }
}

/**
 * Check if a plugin exists
 *
 * @param id - The plugin ID
 */
export async function pluginExists(id: string): Promise<boolean> {
  const plugin = await getPlugin(id);
  return plugin !== undefined;
}
