/**
 * Version Generator
 *
 * Generates version.json files for the Website.
 * Uses OutputVersion type which excludes 'approved' status.
 */

import { ensureDirectory, writeJson } from '../utils/file.js';
import type { LoadedPlugin, OutputVersion } from '../utils/registry.js';
import type { Version } from '../models/generated.js';

/**
 * Extract author from upstream repository
 */
function extractAuthor(upstreamRepository: string): string {
  const parts = upstreamRepository.split('/');
  return parts[0] ?? 'unknown';
}

/**
 * Generate a single version file
 */
function generateVersion(
  plugin: LoadedPlugin,
  versionData: OutputVersion,
  outputPath: string
): Version {
  const storage = versionData.storage ?? { repository: `axolotl-pm-pl/${plugin.identity.id}`, commit: '' };
  const artifact = versionData.artifact ?? {
    releaseTag: `v${versionData.version}`,
    file: `${plugin.identity.id}.phar`,
    sha256: '',
    publishedAt: versionData.review.approvedAt,
  };

  const version: Version = {
    plugin: plugin.identity.id,
    version: versionData.version,
    status: versionData.status,
    release: {
      tag: artifact.releaseTag,
      publishedAt: artifact.publishedAt,
      changelog: undefined,
    },
    artifact: {
      file: artifact.file,
      sha256: artifact.sha256,
      size: 0,
      downloadUrl: `https://github.com/${storage.repository}/releases/download/${artifact.releaseTag}/${artifact.file}`,
    },
    checksums: artifact.sha256 ? { sha256: artifact.sha256 } : undefined,
    review: {
      pullRequest: versionData.review.pullRequest,
      reviewer: versionData.review.reviewer,
      approvedAt: versionData.review.approvedAt,
    },
    storage: {
      repository: storage.repository,
      commit: storage.commit,
    },
    source: {
      upstream: plugin.identity.upstream.repository,
      commit: versionData.source.upstreamCommit,
    },
  };

  if (artifact.provenance) {
    version.provenance = {
      type: artifact.provenance.type as 'github-attestation',
      verified: true,
    };
  }

  return version;
}

/**
 * Generate version files for a plugin
 */
export function generateVersionsForPlugin(
  plugin: LoadedPlugin,
  outputPath: string
): Version[] {
  const versions: Version[] = [];

  for (const versionData of plugin.versions) {
    const version = generateVersion(plugin, versionData, outputPath);

    const versionPath = `${outputPath}/versions/${plugin.identity.id}/${versionData.version}.json`;
    ensureDirectory(`${outputPath}/versions/${plugin.identity.id}`);
    writeJson(versionPath, version);

    versions.push(version);
  }

  return versions;
}

/**
 * Generate all version files
 */
export function generateAllVersions(
  plugins: LoadedPlugin[],
  outputPath: string
): {
  totalVersions: number;
  versionsByPlugin: Map<string, Version[]>;
} {
  const versionsByPlugin = new Map<string, Version[]>();
  let totalVersions = 0;

  for (const plugin of plugins) {
    const versions = generateVersionsForPlugin(plugin, outputPath);
    versionsByPlugin.set(plugin.identity.id, versions);
    totalVersions += versions.length;
  }

  return { totalVersions, versionsByPlugin };
}
