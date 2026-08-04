/**
 * Versions Service
 *
 * Provides access to version data for plugins.
 */

import { loadJson } from './client.js';
import type { Version } from './types.js';

/** Path prefix for version files */
const VERSION_PATH_PREFIX = '/versions/';

/** File extension for version files */
const VERSION_FILE_EXTENSION = '.json';

/**
 * Get a single version by plugin ID and version string
 *
 * @param pluginId - The plugin ID
 * @param version - The version string (e.g., "1.0.0")
 * @returns The version data or undefined if not found
 */
export async function getVersion(pluginId: string, version: string): Promise<Version | undefined> {
  try {
    const path = `${VERSION_PATH_PREFIX}${pluginId}/${version}${VERSION_FILE_EXTENSION}`;
    return await loadJson<Version>(path);
  } catch {
    // Version not found
    return undefined;
  }
}

/**
 * Get all versions for a plugin
 *
 * Note: This requires knowing all version strings in advance.
 * Typically used with plugin data that includes version list.
 *
 * @param pluginId - The plugin ID
 * @param versions - Array of version strings
 */
export async function getVersions(
  pluginId: string,
  versions: string[]
): Promise<Map<string, Version>> {
  const results = await Promise.all(
    versions.map(async (version) => {
      const data = await getVersion(pluginId, version);
      return { version, data };
    })
  );

  const map = new Map<string, Version>();
  for (const { version, data } of results) {
    if (data) {
      map.set(version, data);
    }
  }

  return map;
}
