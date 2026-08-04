/**
 * Manifest Service
 *
 * Provides access to the generated manifest data.
 */

import { loadJson, MissingFileError } from './client.js';
import type { Manifest } from './types.js';

/** Path to the manifest JSON file */
const MANIFEST_PATH = '/manifest.json';

/**
 * Default empty Manifest for when file is missing
 * This represents an empty repository state
 */
const EMPTY_MANIFEST: Manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  registryCommit: 'unknown',
  generatorVersion: '0.0.0',
  pluginCount: 0,
  versionCount: 0,
  authorCount: 0,
  categoryCount: 0,
  indexes: {
    plugins: new Date().toISOString(),
    versions: new Date().toISOString(),
    search: new Date().toISOString(),
    authors: new Date().toISOString(),
  },
};

/**
 * Get the manifest data
 *
 * The manifest contains global metadata about the generated dataset.
 * Returns empty manifest if file is missing.
 */
export async function getManifest(): Promise<Manifest> {
  try {
    return await loadJson<Manifest>(MANIFEST_PATH);
  } catch (error) {
    if (error instanceof MissingFileError) {
      return EMPTY_MANIFEST;
    }
    throw error;
  }
}
