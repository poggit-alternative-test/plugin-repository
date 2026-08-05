/**
 * GitHub API Service
 *
 * Fetches additional plugin data from GitHub on-demand.
 * Used for: releases, README, plugin.yml (dependencies)
 */

import type { Version } from './types.js';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: {
    name: string;
    browser_download_url: string;
    size: number;
    download_count?: number;
  }[];
}

interface PluginYml {
  name?: string;
  version?: string;
  api?: string;
  main?: string;
  author?: string;
  authors?: string[];
  description?: string;
  depend?: string | string[];
  softdepend?: string | string[];
  loadbefore?: string | string[];
  [key: string]: unknown;
}

/**
 * Fetch all releases from GitHub API
 */
export async function fetchReleases(repo: string): Promise<Version[]> {
  try {
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) return [];

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/releases`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) return [];

    const releases: GitHubRelease[] = await response.json();

    return releases.map((release) => {
      // Find PHAR asset
      const pharAsset = release.assets.find(
        (a) => a.name.endsWith('.phar') || a.name.endsWith('.phar.zip')
      );

      return {
        plugin: repo,
        version: release.tag_name.replace(/^v/, ''),
        status: 'published' as const,
        apiVersion: undefined,
        release: {
          tag: release.tag_name,
          publishedAt: release.published_at,
          changelog: release.body || undefined,
        },
        artifact: pharAsset
          ? {
              file: pharAsset.name,
              sha256: '', // Would need additional API call to get this
              size: pharAsset.size,
              downloadUrl: pharAsset.browser_download_url,
            }
          : {
              file: '',
              sha256: '',
              size: 0,
              downloadUrl: release.html_url,
            },
        checksums: undefined,
        review: {
          pullRequest: 0,
          reviewer: '',
          approvedAt: release.published_at,
        },
        storage: {
          repository: repo,
          commit: '',
        },
        source: {
          upstream: `https://github.com/${repo}`,
          commit: '',
        },
        provenance: undefined,
        dependencies: undefined,
        manifest: undefined,
        readme: undefined,
        revokedAt: undefined,
        reason: undefined,
        removedAt: undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetch README.md from GitHub RAW content
 * Uses /HEAD/ path - GitHub automatically redirects to default branch
 */
export async function fetchReadme(repo: string): Promise<string | null> {
  try {
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) return null;

    // Try common README filenames with /HEAD/ - GitHub auto-redirects to default branch
    const readmeNames = ['README.md', 'README', 'readme.md', 'Readme.md'];

    for (const name of readmeNames) {
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repoName}/HEAD/${name}`
        );

        if (response.ok) {
          return await response.text();
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch plugin.yml from GitHub and parse dependencies
 */
export async function fetchPluginDependencies(
  repo: string
): Promise<{ depend: string[]; softdepend: string[] }> {
  try {
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) return { depend: [], softdepend: [] };

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/plugin.yml`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) return { depend: [], softdepend: [] };

    const data = await response.json();
    if (!data.content) return { depend: [], softdepend: [] };

    // Decode base64 and parse YAML
    const yamlContent = atob(data.content.replace(/\n/g, ''));
    const plugin: PluginYml = parseYaml(yamlContent);

    const depend = parseDependencies(plugin.depend);
    const softdepend = parseDependencies(plugin.softdepend);

    return { depend, softdepend };
  } catch {
    return { depend: [], softdepend: [] };
  }
}

/**
 * Simple YAML parser for plugin.yml
 */
function parseYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');

  let currentKey = '';
  let currentArray: string[] = [];
  let inArray = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for array item (starts with -)
    if (trimmed.startsWith('-')) {
      const value = trimmed.substring(1).trim();
      if (value) {
        currentArray.push(value);
      }
      inArray = true;
      continue;
    }

    // Save previous array if exists
    if (inArray && currentKey) {
      result[currentKey] = currentArray;
      currentArray = [];
      inArray = false;
    }

    // Parse key: value
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      if (value) {
        result[key] = value;
      } else {
        currentKey = key;
        currentArray = [];
        inArray = false;
      }
    }
  }

  // Save last array if exists
  if (inArray && currentKey) {
    result[currentKey] = currentArray;
  }

  return result;
}

/**
 * Parse dependency string or array
 */
function parseDependencies(
  depend: unknown
): string[] {
  if (!depend) return [];
  if (Array.isArray(depend)) return depend.map(String);
  if (typeof depend === 'string') {
    return depend
      .split(/[,\s]+/)
      .map((d) => d.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Fetch all plugin data from GitHub
 */
export async function fetchPluginData(repo: string) {
  const [releases, readme, dependencies] = await Promise.all([
    fetchReleases(repo),
    fetchReadme(repo),
    fetchPluginDependencies(repo),
  ]);

  return {
    releases,
    readme,
    dependencies,
  };
}
