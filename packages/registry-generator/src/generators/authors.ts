/**
 * Author Generator
 *
 * Generates author.json files for the Website.
 */

import { ensureDirectory, writeJson } from '../utils/file.js';
import type { LoadedPlugin, OutputVersion } from '../utils/registry.js';
import type { Author, AuthorList } from '../models/generated.js';

/**
 * Extract author from upstream repository
 */
function extractAuthor(upstreamRepository: string): string {
  const parts = upstreamRepository.split('/');
  return parts[0] ?? 'unknown';
}

/**
 * Get latest version with artifact for a plugin
 */
function getLatestPublished(versions: OutputVersion[]): OutputVersion | undefined {
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
 * Generate author index
 */
export function generateAuthorIndex(
  plugins: LoadedPlugin[],
  outputPath: string
): AuthorList {
  const authorMap = new Map<string, LoadedPlugin[]>();

  for (const plugin of plugins) {
    const author = extractAuthor(plugin.identity.upstream.repository);
    if (!authorMap.has(author)) {
      authorMap.set(author, []);
    }
    authorMap.get(author)!.push(plugin);
  }

  const items = Array.from(authorMap.entries()).map(([login, authorPlugins]) => ({
    login,
    pluginCount: authorPlugins.length,
    latestUpdate: authorPlugins[0]?.versions[0]?.review?.approvedAt ?? '',
  })).sort((a, b) => b.latestUpdate.localeCompare(a.latestUpdate));

  const list: AuthorList = {
    authors: items,
    count: items.length,
  };

  const indexPath = `${outputPath}/authors/index.json`;
  ensureDirectory(`${outputPath}/authors`);
  writeJson(indexPath, list);

  return list;
}

/**
 * Generate individual author profiles
 */
export function generateAuthors(
  plugins: LoadedPlugin[],
  outputPath: string
): Author[] {
  const authorMap = new Map<string, LoadedPlugin[]>();

  for (const plugin of plugins) {
    const author = extractAuthor(plugin.identity.upstream.repository);
    if (!authorMap.has(author)) {
      authorMap.set(author, []);
    }
    authorMap.get(author)!.push(plugin);
  }

  const generatedAuthors: Author[] = [];

  for (const [login, authorPlugins] of authorMap) {
    const pluginItems = authorPlugins.map(plugin => {
      const latest = getLatestPublished(plugin.versions);
      return {
        id: plugin.identity.id,
        name: latest?.artifact?.file?.replace('.phar', '') ?? plugin.identity.id,
        summary: '',
        latestVersion: latest?.version ?? '',
        status: latest?.status ?? 'published',
        author: login,
        updatedAt: latest?.artifact?.publishedAt ?? '',
      };
    });

    const generated: Author = {
      login,
      plugins: pluginItems,
      statistics: {
        pluginCount: authorPlugins.length,
        versionCount: authorPlugins.reduce((sum, p) => sum + p.versions.length, 0),
      },
    };

    const authorPath = `${outputPath}/authors/${login}.json`;
    ensureDirectory(`${outputPath}/authors`);
    writeJson(authorPath, generated);

    generatedAuthors.push(generated);
  }

  return generatedAuthors;
}

/**
 * Generate all author data
 */
export function generateAllAuthors(
  plugins: LoadedPlugin[],
  outputPath: string
): {
  authorList: AuthorList;
  authors: Author[];
} {
  const authorList = generateAuthorIndex(plugins, outputPath);
  const authors = generateAuthors(plugins, outputPath);
  return { authorList, authors };
}
