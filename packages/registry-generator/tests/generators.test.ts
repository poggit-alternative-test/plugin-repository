/**
 * Generator Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, existsSync, readFileSync } from 'fs';
import { loadRegistry } from '../src/utils/registry.js';
import {
  generateManifest,
} from '../src/generators/manifest.js';
import {
  generatePluginIndex,
  generatePlugins,
} from '../src/generators/plugins.js';
import {
  generateAllVersions,
} from '../src/generators/versions.js';
import {
  generateAllAuthors,
} from '../src/generators/authors.js';
import {
  generateAllCategories,
} from '../src/generators/categories.js';
import {
  generateAllSearch,
} from '../src/generators/search.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_PATH = resolve(__dirname, '..', 'fixtures');
const OUTPUT_PATH = resolve(__dirname, '..', 'output');

describe('Manifest Generator', () => {
  beforeEach(() => {
    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  it('should generate manifest with correct structure', () => {
    const manifest = generateManifest({
      registryPath: FIXTURES_PATH,
      outputPath: OUTPUT_PATH,
      pluginCount: 1,
      versionCount: 2,
      authorCount: 1,
      categoryCount: 8,
    });

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.generatedAt).toBeDefined();
    expect(manifest.pluginCount).toBe(1);
    expect(manifest.versionCount).toBe(2);
    expect(manifest.authorCount).toBe(1);
    expect(manifest.categoryCount).toBe(8);
    expect(manifest.indexes).toBeDefined();
  });

  it('should write manifest to file', () => {
    generateManifest({
      registryPath: FIXTURES_PATH,
      outputPath: OUTPUT_PATH,
      pluginCount: 1,
      versionCount: 2,
      authorCount: 1,
      categoryCount: 8,
    });

    const manifestPath = join(OUTPUT_PATH, 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);

    const content = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(content.schemaVersion).toBe(1);
  });
});

describe('Plugin Generator', () => {
  let plugins: Awaited<ReturnType<typeof loadRegistry>>['plugins'];

  beforeEach(() => {
    const result = loadRegistry(FIXTURES_PATH);
    plugins = result.plugins;

    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  it('should generate plugin index', () => {
    if (plugins.length === 0) return;
    const index = generatePluginIndex(plugins, OUTPUT_PATH);

    expect(index.plugins.length).toBe(1);
    expect(index.plugins[0]?.id).toBe('testplugin');
    expect(index.plugins[0]?.author).toBe('testauthor');
    expect(index.pagination.total).toBe(1);
  });

  it('should generate individual plugin files', () => {
    if (plugins.length === 0) return;
    const generated = generatePlugins(plugins, OUTPUT_PATH);

    expect(generated.length).toBe(1);
    expect(generated[0]?.id).toBe('testplugin');
    expect(generated[0]?.upstream.repository).toBe('testauthor/TestPlugin');
  });

  it('should include latest version', () => {
    if (plugins.length === 0) return;
    const generated = generatePlugins(plugins, OUTPUT_PATH);

    expect(generated[0]?.latestVersion).toBe('2.0.0');
    expect(generated[0]?.latestRelease).toBeDefined();
    expect(generated[0]?.latestRelease?.version).toBe('2.0.0');
  });

  it('should include provenance information', () => {
    if (plugins.length === 0) return;
    const generated = generatePlugins(plugins, OUTPUT_PATH);

    expect(generated[0]?.verified).toBeDefined();
    expect(generated[0]?.verified?.githubAttestation).toBe(true);
  });
});

describe('Version Generator', () => {
  let plugins: Awaited<ReturnType<typeof loadRegistry>>['plugins'];

  beforeEach(() => {
    const result = loadRegistry(FIXTURES_PATH);
    plugins = result.plugins;

    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  it('should generate version files', () => {
    if (plugins.length === 0) return;
    const { totalVersions } = generateAllVersions(plugins, OUTPUT_PATH);

    expect(totalVersions).toBe(2);
  });

  it('should write version files to correct path', () => {
    if (plugins.length === 0) return;
    generateAllVersions(plugins, OUTPUT_PATH);

    const v1Path = join(OUTPUT_PATH, 'versions', 'testplugin', '1.0.0.json');
    const v2Path = join(OUTPUT_PATH, 'versions', 'testplugin', '2.0.0.json');

    expect(existsSync(v1Path)).toBe(true);
    expect(existsSync(v2Path)).toBe(true);
  });

  it('should include complete version data', () => {
    if (plugins.length === 0) return;
    generateAllVersions(plugins, OUTPUT_PATH);

    const v1Path = join(OUTPUT_PATH, 'versions', 'testplugin', '1.0.0.json');
    const content = JSON.parse(readFileSync(v1Path, 'utf-8'));

    expect(content.plugin).toBe('testplugin');
    expect(content.version).toBe('1.0.0');
    expect(content.status).toBe('published');
    expect(content.release.tag).toBe('v1.0.0');
    expect(content.artifact.file).toBe('TestPlugin.phar');
    expect(content.review.reviewer).toBe('axolotl-reviewer');
    expect(content.storage.repository).toBe('axolotl-pm-pl/TestPlugin');
    expect(content.provenance.type).toBe('github-attestation');
  });
});

describe('Author Generator', () => {
  let plugins: Awaited<ReturnType<typeof loadRegistry>>['plugins'];

  beforeEach(() => {
    const result = loadRegistry(FIXTURES_PATH);
    plugins = result.plugins;

    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  it('should generate author index', () => {
    if (plugins.length === 0) return;
    const { authorList } = generateAllAuthors(plugins, OUTPUT_PATH);

    expect(authorList.authors.length).toBe(1);
    expect(authorList.authors[0]?.login).toBe('testauthor');
    expect(authorList.count).toBe(1);
  });

  it('should generate author profiles', () => {
    if (plugins.length === 0) return;
    const { authors } = generateAllAuthors(plugins, OUTPUT_PATH);

    expect(authors.length).toBe(1);
    expect(authors[0]?.login).toBe('testauthor');
    expect(authors[0]?.plugins.length).toBe(1);
    expect(authors[0]?.statistics.pluginCount).toBe(1);
  });
});

describe('Category Generator', () => {
  let plugins: Awaited<ReturnType<typeof loadRegistry>>['plugins'];

  beforeEach(() => {
    const result = loadRegistry(FIXTURES_PATH);
    plugins = result.plugins;

    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  it('should generate category index', () => {
    if (plugins.length === 0) return;
    const { categoryList } = generateAllCategories(plugins, OUTPUT_PATH);

    expect(categoryList.categories.length).toBe(8);
    expect(categoryList.count).toBe(8);
  });
});

describe('Search Generator', () => {
  let plugins: Awaited<ReturnType<typeof loadRegistry>>['plugins'];

  beforeEach(() => {
    const result = loadRegistry(FIXTURES_PATH);
    plugins = result.plugins;

    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(OUTPUT_PATH)) {
      rmSync(OUTPUT_PATH, { recursive: true });
    }
  });

  it('should generate search index', () => {
    if (plugins.length === 0) return;
    const { searchIndex } = generateAllSearch(plugins, OUTPUT_PATH);

    expect(searchIndex.plugins.length).toBe(1);
    expect(searchIndex.plugins[0]?.id).toBe('testplugin');
    expect(searchIndex.plugins[0]?.name).toBe('TestPlugin');
  });

  it('should normalize search fields', () => {
    if (plugins.length === 0) return;
    const { searchIndex } = generateAllSearch(plugins, OUTPUT_PATH);

    expect(searchIndex.plugins[0]?.nameNormalized).toBe('testplugin');
    expect(searchIndex.plugins[0]?.authorNormalized).toBe('testauthor');
  });

  it('should extract name keywords', () => {
    if (plugins.length === 0) return;
    const { searchIndex } = generateAllSearch(plugins, OUTPUT_PATH);

    expect(searchIndex.plugins[0]?.nameKeywords).toContain('test');
    expect(searchIndex.plugins[0]?.nameKeywords).toContain('plugin');
  });

  it('should generate popular plugins', () => {
    if (plugins.length === 0) return;
    const { popularPlugins } = generateAllSearch(plugins, OUTPUT_PATH);

    expect(popularPlugins.trending.length).toBeGreaterThan(0);
    expect(popularPlugins.recentlyUpdated.length).toBeGreaterThan(0);
  });
});
