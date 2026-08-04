/**
 * README Generator
 *
 * Copies README files as Markdown to the output directory.
 * README files remain Markdown - never converted to HTML.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { ensureDirectory, writeFile } from '../utils/file.js';
import { loadRegistry, type LoadedPlugin } from '../utils/registry.js';
import type { Readme } from '../models/generated.js';

/**
 * Known README filenames
 */
const README_FILENAMES = [
  'README.md',
  'README.MD',
  'Readme.md',
  'readme.md',
  'README.txt',
  'README',
];

/**
 * Find README file in a directory
 */
function findReadmeFile(dir: string): string | null {
  for (const filename of README_FILENAMES) {
    const path = join(dir, filename);
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

/**
 * Extract sections from README content
 * Looks for markdown headings
 */
function extractSections(content: string): Readme['sections'] {
  const sections: NonNullable<Readme['sections']> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match && match[1] && match[2]) {
      const level = match[1].length;
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      sections.push({ id, title, level });
    }
  }

  return sections;
}

/**
 * Extract links from README content
 */
function extractLinks(content: string): Readme['links'] {
  const links: NonNullable<Readme['links']> = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const text = match[1];
    const url = match[2];
    // Skip anchor links and image links
    if (text && url && !url.startsWith('#') && !url.startsWith('!')) {
      links.push({ text, url });
    }
  }

  return links;
}

/**
 * Extract images from README content
 */
function extractImages(content: string): Readme['images'] {
  const images: NonNullable<Readme['images']> = [];
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    const alt = match[1] ?? '';
    const url = match[2];
    if (url) {
      images.push({ alt, url });
    }
  }

  return images;
}

/**
 * Generate README for a specific version
 * Copies Markdown file and creates metadata
 */
export function generateReadmeForVersion(
  plugin: LoadedPlugin,
  versionData: LoadedPlugin['versions'][0],
  _storagePath: string,
  outputPath: string
): Readme | null {
  // Find README in the version directory
  // For now, we don't have access to the actual source
  // This will be enhanced when we integrate with storage repositories

  // Placeholder implementation
  const readmeContent = `# ${plugin.identity.id}\n\nVersion ${versionData.version}\n`;
  const sections = extractSections(readmeContent);
  const links = extractLinks(readmeContent);
  const images = extractImages(readmeContent);

  const readme: Readme = {
    plugin: plugin.identity.id,
    version: versionData.version,
    content: readmeContent,
    sections,
    links,
    images,
  };

  // Write README metadata
  const readmePath = `${outputPath}/readmes/${plugin.identity.id}/${versionData.version}.json`;
  ensureDirectory(`${outputPath}/readmes/${plugin.identity.id}`);
  writeFile(
    readmePath,
    JSON.stringify(readme, null, 2)
  );

  return readme;
}

/**
 * Generate README for latest version
 * Copies to "latest" file for convenience
 */
export function generateLatestReadme(
  plugin: LoadedPlugin,
  latestVersion: LoadedPlugin['versions'][0],
  outputPath: string
): Readme | null {
  const readme = generateReadmeForVersion(
    plugin,
    latestVersion,
    plugin.identity.storage?.repository ?? '',
    outputPath
  );

  if (readme) {
    // Also write to "latest" file
    const latestPath = `${outputPath}/readmes/${plugin.identity.id}/latest.json`;
    ensureDirectory(`${outputPath}/readmes/${plugin.identity.id}`);
    writeFile(latestPath, JSON.stringify(readme, null, 2));
  }

  return readme;
}

/**
 * Generate all README files
 */
export function generateAllReadmes(
  plugins: LoadedPlugin[],
  outputPath: string
): {
  totalReadmes: number;
  readmesByPlugin: Map<string, number>;
} {
  const readmesByPlugin = new Map<string, number>();
  let totalReadmes = 0;

  for (const plugin of plugins) {
    let pluginReadmeCount = 0;

    // Generate READMEs for all published versions
    const releasableStatuses = [
      'materialized',
      'published',
      'deprecated',
      'revoked',
      'removed',
    ];

    for (const version of plugin.versions) {
      if (!releasableStatuses.includes(version.status)) {
        continue;
      }

      const readme = generateReadmeForVersion(
        plugin,
        version,
        plugin.identity.storage?.repository ?? '',
        outputPath
      );

      if (readme) {
        pluginReadmeCount++;
      }
    }

    // Generate latest README
    const latestVersion = plugin.versions.find(v => v.status === 'published');
    if (latestVersion) {
      generateLatestReadme(plugin, latestVersion, outputPath);
    }

    readmesByPlugin.set(plugin.identity.id, pluginReadmeCount);
    totalReadmes += pluginReadmeCount;
  }

  return { totalReadmes, readmesByPlugin };
}
