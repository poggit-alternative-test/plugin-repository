/**
 * Plugin YML Parser Tests
 *
 * Tests for PocketMine plugin.yml parsing.
 */
import { describe, test, expect } from 'vitest';
import {
  parsePluginYaml,
  derivePluginId,
  validateDerivedPluginId,
  extractNamespace,
  PLUGIN_YML_MAX_SIZE,
} from '../../src/submission/plugin-yml.js';

describe('parsePluginYaml', () => {
  test('valid minimal plugin.yml parses', () => {
    const yaml = `name: TopStats
version: 1.0.0
main: Nicholas\\TopStats\\Main
api:
- 5.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.name).toBe('TopStats');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.main).toBe('Nicholas\\TopStats\\Main');
      expect(result.metadata.api).toEqual(['5.0.0']);
    }
  });

  test('plugin.yml with scalar API version parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.api).toEqual(['5.0.0']);
    }
  });

  test('plugin.yml with multiple API versions parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api:
- 5.0.0
- 6.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.api).toEqual(['5.0.0', '6.0.0']);
    }
  });

  test('plugin.yml with quoted description containing colon parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
description: "This is a description: with a colon in it"
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.description).toBe('This is a description: with a colon in it');
    }
  });

  test('plugin.yml with single-quoted description parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
description: 'Test description with special chars: and stuff'
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.description).toBe('Test description with special chars: and stuff');
    }
  });

  test('plugin.yml with ext-namespace parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
'ext-namespace': Test
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.namespace).toBe('Test');
    }
  });

  test('plugin.yml with php dependency parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
php: 8.1
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.php).toBe('8.1');
    }
  });

  test('plugin.yml with php array parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
php:
- 8.0
- 8.1
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      // Note: YAML parses 8.0 as number 8, so we get "8" not "8.0"
      expect(result.metadata.php).toEqual(['8', '8.1']);
    }
  });

  test('plugin.yml with dependencies parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
dependencies:
  EconomyAPI: "*"
  SomePlugin: "^1.0.0"
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.dependencies).toEqual({
        EconomyAPI: '*',
        SomePlugin: '^1.0.0',
      });
    }
  });

  test('plugin.yml with version_info parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
'version_info':
  description: "Plugin for PocketMine"
  usage: "Just enable the plugin"
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.versionInfo).toBeDefined();
      expect(result.metadata.versionInfo?.description).toBe('Plugin for PocketMine');
      expect(result.metadata.versionInfo?.usage).toBe('Just enable the plugin');
    }
  });

  test('plugin.yml with protocol number parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
protocol: 50
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.protocol).toBe(50);
    }
  });

  test('plugin.yml with protocol array parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
protocol:
- 50
- 51
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.protocol).toEqual([50, 51]);
    }
  });

  test('plugin.yml with comments is parsed correctly', () => {
    const yaml = `# This is a comment
name: TestPlugin
# Another comment
version: 1.0.0
main: Test\\Main
api: 5.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
  });

  test('plugin.yml with POSTWORLD load parses', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
main: Test\\Main
api: 5.0.0
load: POSTWORLD
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.load).toBe('POSTWORLD');
    }
  });

  test('plugin.yml with all fields parses', () => {
    const yaml = `
name: AdvancedPlugin
version: 2.1.0
main: Vendor\\Plugin\\Main
api:
- 5.0.0
- 6.0.0
author: Nick
authors:
- Nick
- Alice
description: A test plugin
website: https://example.com
prefix: STATS
load: STARTUP
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.name).toBe('AdvancedPlugin');
      expect(result.metadata.version).toBe('2.1.0');
      expect(result.metadata.authors).toEqual(['Nick', 'Alice']);
      expect(result.metadata.description).toBe('A test plugin');
      expect(result.metadata.prefix).toBe('STATS');
      expect(result.metadata.load).toBe('STARTUP');
    }
  });

  test('plugin.yml missing name fails', () => {
    const yaml = `version: 1.0.0
main: Namespace\\Main
api:
- 5.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  test('plugin.yml missing version fails', () => {
    const yaml = `name: TestPlugin
main: Namespace\\Main
api:
- 5.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  test('plugin.yml missing main fails', () => {
    const yaml = `name: TestPlugin
version: 1.0.0
api:
- 5.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  test('plugin.yml invalid version format fails', () => {
    const yaml = `
name: TestPlugin
version: latest
main: Namespace\\Main
api:
- 5.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'PLUGIN_VERSION_INVALID')).toBe(true);
  });

  test('plugin.yml version with prerelease passes', () => {
    const yaml = `
name: TestPlugin
version: 1.0.0-beta
main: Namespace\\Main
api:
- 5.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.version).toBe('1.0.0-beta');
    }
  });

  test('plugin.yml too large fails', () => {
    const largeYaml = 'x'.repeat(PLUGIN_YML_MAX_SIZE + 1);
    const yaml = `name: Test\nversion: 1.0.0\nmain: Main\napi:\n- 5.0.0\ndescription: ${largeYaml}`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'PLUGIN_YML_TOO_LARGE')).toBe(true);
  });

  test('plugin.yml malformed YAML fails', () => {
    const yaml = `
name: Test
  invalid: indent
version: 1.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'PLUGIN_YML_INVALID')).toBe(true);
  });

  test('single API string converts to array', () => {
    const yaml = `
name: TestPlugin
version: 1.0.0
main: Main
api: 5.0.0
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.api).toEqual(['5.0.0']);
    }
  });

  test('author string converts to array', () => {
    const yaml = `
name: TestPlugin
version: 1.0.0
main: Main
api:
- 5.0.0
author: Single Author
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.authors).toEqual(['Single Author']);
    }
  });

  test('authors array takes precedence', () => {
    const yaml = `
name: TestPlugin
version: 1.0.0
main: Main
api:
- 5.0.0
author: One
authors:
- One
- Two
`;
    const result = parsePluginYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.metadata) {
      expect(result.metadata.authors).toEqual(['One', 'Two']);
    }
  });
});

describe('derivePluginId', () => {
  test('simple name derives correctly', () => {
    expect(derivePluginId('TopStats')).toBe('topstats');
  });

  test('name with spaces replaces with hyphens', () => {
    expect(derivePluginId('Top Stats Plugin')).toBe('top-stats-plugin');
  });

  test('mixed case converts to lowercase', () => {
    expect(derivePluginId('MyAwesomePlugin')).toBe('myawesomeplugin');
  });

  test('special characters removed', () => {
    expect(derivePluginId('Test@#$Plugin')).toBe('testplugin');
  });

  test('consecutive hyphens collapsed', () => {
    expect(derivePluginId('Test---Plugin')).toBe('test-plugin');
  });

  test('leading/trailing hyphens removed', () => {
    expect(derivePluginId('-TestPlugin-')).toBe('testplugin');
  });

  test('truncated to 64 chars', () => {
    const longName = 'a'.repeat(100);
    expect(derivePluginId(longName).length).toBe(64);
  });
});

describe('validateDerivedPluginId', () => {
  test('valid plugin ID passes', () => {
    expect(validateDerivedPluginId('topstats').valid).toBe(true);
    expect(validateDerivedPluginId('my-plugin-123').valid).toBe(true);
  });

  test('empty ID fails', () => {
    expect(validateDerivedPluginId('').valid).toBe(false);
  });

  test('uppercase fails', () => {
    expect(validateDerivedPluginId('TopStats').valid).toBe(false);
  });

  test('starts with hyphen fails', () => {
    expect(validateDerivedPluginId('-test').valid).toBe(false);
  });

  test('ends with hyphen fails', () => {
    expect(validateDerivedPluginId('test-').valid).toBe(false);
  });

  test('too long fails', () => {
    const longId = 'a'.repeat(65);
    expect(validateDerivedPluginId(longId).valid).toBe(false);
  });

  test('invalid characters fail', () => {
    expect(validateDerivedPluginId('test@plugin').valid).toBe(false);
    expect(validateDerivedPluginId('test.plugin').valid).toBe(false);
    expect(validateDerivedPluginId('test plugin').valid).toBe(false);
  });
});

describe('extractNamespace', () => {
  test('extracts namespace from namespaced class', () => {
    expect(extractNamespace('Vendor\\Plugin\\Main')).toBe('Vendor\\Plugin');
  });

  test('returns null for single-part class', () => {
    expect(extractNamespace('Main')).toBeNull();
  });

  test('handles deeper nesting', () => {
    expect(extractNamespace('Vendor\\Plugin\\Sub\\Main')).toBe('Vendor\\Plugin\\Sub');
  });
});
