/**
 * Registry Loader Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadRegistry, loadPlugin } from '../src/utils/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to fixtures directory (in parent package directory)
const FIXTURES_PATH = resolve(__dirname, '..', 'fixtures');

describe('loadRegistry', () => {
  it('should load plugins from registry', () => {
    const result = loadRegistry(FIXTURES_PATH);
    expect(result.plugins.length).toBeGreaterThan(0);
  });

  it('should load plugin identity', () => {
    const result = loadRegistry(FIXTURES_PATH);
    if (result.plugins.length === 0) {
      // Skip if no plugins loaded
      return;
    }
    const plugin = result.plugins[0];

    expect(plugin.identity).toBeDefined();
    expect(plugin.identity.id).toBe('testplugin');
    expect(plugin.identity.upstream.repository).toBe('testauthor/TestPlugin');
    expect(plugin.identity.upstream.branch).toBe('main');
  });

  it('should load storage repository', () => {
    const result = loadRegistry(FIXTURES_PATH);
    if (result.plugins.length === 0) {
      return;
    }
    const plugin = result.plugins[0];

    expect(plugin.identity.storage).toBeDefined();
    expect(plugin.identity.storage?.repository).toBe('axolotl-pm-pl/TestPlugin');
  });

  it('should load versions', () => {
    const result = loadRegistry(FIXTURES_PATH);
    if (result.plugins.length === 0) {
      return;
    }
    const plugin = result.plugins[0];
    expect(plugin.versions.length).toBeGreaterThan(0);
  });
});

describe('loadPlugin', () => {
  const pluginPath = join(FIXTURES_PATH, 'plugins', 'testplugin');

  it('should load a single plugin', () => {
    const result = loadPlugin(pluginPath);
    expect(result.plugin).toBeDefined();
    expect(result.error).toBeNull();
  });

  it('should have valid identity', () => {
    const result = loadPlugin(pluginPath);
    expect(result.plugin?.identity.id).toBe('testplugin');
  });

  it('should have versions', () => {
    const result = loadPlugin(pluginPath);
    expect(result.plugin?.versions.length).toBe(2);
  });

  it('should transform version records correctly', () => {
    const result = loadPlugin(pluginPath);
    const version = result.plugin?.versions[0];

    expect(version?.status).toBe('published');
    expect(version?.version).toBe('1.0.0');
    expect(version?.source).toBeDefined();
    expect(version?.source.upstreamCommit).toBe('a82f0e123456789abcdef123456789abcdef1234');
  });

  it('should include artifact information', () => {
    const result = loadPlugin(pluginPath);
    const version = result.plugin?.versions.find((v) => v.version === '1.0.0');

    expect(version).toBeDefined();
    if (version && 'artifact' in version) {
      expect(version.artifact?.releaseTag).toBe('v1.0.0');
      expect(version.artifact?.file).toBe('TestPlugin.phar');
    }
  });

  it('should include provenance information', () => {
    const result = loadPlugin(pluginPath);
    const version = result.plugin?.versions.find((v) => v.version === '1.0.0');

    expect(version).toBeDefined();
    if (version && 'artifact' in version && version.artifact) {
      expect(version.artifact.provenance).toBeDefined();
      expect(version.artifact.provenance?.type).toBe('github-attestation');
    }
  });
});
