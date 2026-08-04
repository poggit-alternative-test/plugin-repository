/**
 * Manifest Generator
 *
 * Produces manifest.json with global metadata about the generated dataset.
 */

import { writeJson } from '../utils/file.js';
import { getCurrentCommit } from '../utils/git.js';
import type { Manifest } from '../models/generated.js';

const GENERATOR_VERSION = '0.1.0';
const SCHEMA_VERSION = 1;

/**
 * Generate manifest.json
 */
export function generateManifest(options: {
  registryPath: string;
  outputPath: string;
  pluginCount: number;
  versionCount: number;
  authorCount: number;
  categoryCount: number;
}): Manifest {
  const now = new Date().toISOString();
  const registryCommit = getCurrentCommit(options.registryPath);

  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now,
    registryCommit,
    generatorVersion: GENERATOR_VERSION,
    pluginCount: options.pluginCount,
    versionCount: options.versionCount,
    authorCount: options.authorCount,
    categoryCount: options.categoryCount,
    indexes: {
      plugins: now,
      versions: now,
      search: now,
      authors: now,
    },
  };

  const manifestPath = `${options.outputPath}/manifest.json`;
  writeJson(manifestPath, manifest);

  return manifest;
}
