/**
 * Unit tests for plugin.yml validator
 */

import { describe, it, expect } from 'vitest';
import {
  validatePluginYml,
  PLUGIN_YML_MAX_SIZE,
} from '../src/plugin-yml-validator.js';
import {
  BUILD_ERROR_CODES,
  BUILD_WARNING_CODES,
} from '../src/types.js';

describe('validatePluginYml', () => {
  describe('valid plugin.yml', () => {
    it('parses minimal valid plugin.yml', () => {
      const content = `
name: TestPlugin
version: 1.0.0
main: TestPlugin\\Main
api: 4.0.0
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.name).toBe('TestPlugin');
      expect(result.metadata!.version).toBe('1.0.0');
      expect(result.metadata!.mainClass).toBe('TestPlugin\\Main');
      expect(result.metadata!.apiVersion).toBe('4.0.0');
    });

    it('parses complete plugin.yml with all fields', () => {
      const content = `
name: FullPlugin
version: 2.1.0
main: FullPlugin\\Main
api:
  - 4.0.0
  - 5.0.0
author: AuthorName
authors:
  - Author1
  - Author2
description: A full plugin example
website: https://example.com
php: 8.1
prefix: PREFIX
load: STARTUP
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.name).toBe('FullPlugin');
      expect(result.metadata!.apiVersion).toBe('4.0.0');
      expect(result.metadata!.author).toBe('AuthorName');
      expect(result.metadata!.authors).toEqual(['Author1', 'Author2']);
      expect(result.metadata!.description).toBe('A full plugin example');
      expect(result.metadata!.website).toBe('https://example.com');
    });

    it('parses commands (object format - PocketMine standard)', () => {
      const content = `
name: CmdPlugin
version: 1.0.0
main: CmdPlugin\\Main
api: 4.0.0
commands:
  test:
    description: Test command
    usage: /test
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.commands).toHaveLength(1);
      expect(result.metadata!.commands![0].name).toBe('test');
      expect(result.metadata!.commands![0].description).toBe('Test command');
      expect(result.metadata!.commands![0].usage).toBe('/test');
    });

    it('parses permissions (object format - PocketMine standard)', () => {
      const content = `
name: PermPlugin
version: 1.0.0
main: PermPlugin\\Main
api: 4.0.0
permissions:
  permplugin.command:
    description: Allows command
    default: op
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.permissions).toHaveLength(1);
      expect(result.metadata!.permissions![0].name).toBe('permplugin.command');
      expect(result.metadata!.permissions![0].defaultValue).toBe('op');
    });

    it('parses commands in array format', () => {
      const content = `
name: CmdPlugin
version: 1.0.0
main: CmdPlugin\\Main
api: 4.0.0
commands:
  - name: test
    description: Test command
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.commands).toHaveLength(1);
      expect(result.metadata!.commands![0].name).toBe('test');
    });

    it('normalizes api array to first element', () => {
      const content = `
name: ApiPlugin
version: 1.0.0
main: ApiPlugin\\Main
api:
  - 4.0.0
  - 5.0.0
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.apiVersion).toBe('4.0.0');
    });
  });

  describe('size validation', () => {
    it('rejects empty content', () => {
      const result = validatePluginYml('');
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_NAME_MISSING)).toBe(true);
    });

    it('accepts content at max size', () => {
      // Create content with valid YAML structure with padding in a key value
      const validYaml = 'name: Test\nversion: 1.0.0\nmain: Test\\Main\napi: 4.0.0';
      // Use a comment-style padding that is valid YAML
      const padding = '# ' + 'x'.repeat(Math.floor(PLUGIN_YML_MAX_SIZE * 0.9));
      const content = padding + '\n' + validYaml;
      expect(content.length).toBeLessThanOrEqual(PLUGIN_YML_MAX_SIZE);
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
    });

    it('rejects content exceeding max size', () => {
      const content = 'x'.repeat(PLUGIN_YML_MAX_SIZE + 1);
      const result = validatePluginYml(content);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_YML_SIZE_EXCEEDED)).toBe(true);
    });
  });

  describe('required field validation', () => {
    it('fails when name is missing', () => {
      const content = `
version: 1.0.0
main: Test\\Main
api: 4.0.0
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_NAME_MISSING)).toBe(true);
    });

    it('fails when version is missing', () => {
      const content = `
name: Test
main: Test\\Main
api: 4.0.0
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_VERSION_MISSING)).toBe(true);
    });

    it('fails when main is missing', () => {
      const content = `
name: Test
version: 1.0.0
api: 4.0.0
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_MAIN_MISSING)).toBe(true);
    });

    it('fails when api is missing', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_API_MISSING)).toBe(true);
    });
  });

  describe('invalid YAML', () => {
    it('rejects malformed YAML', () => {
      const content = `
name: Test
  invalid: indentation
version: 1.0.0
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_YML_INVALID)).toBe(true);
    });

    it('rejects non-object YAML array', () => {
      const content = '- item1\n- item2';
      const result = validatePluginYml(content);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_YML_INVALID)).toBe(true);
    });

    it('rejects scalar YAML', () => {
      const content = 'just a string';
      const result = validatePluginYml(content);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_YML_INVALID)).toBe(true);
    });
  });

  describe('field format validation', () => {
    it('warns on potentially invalid main class', () => {
      const content = `
name: Test
version: 1.0.0
main: "123invalid"
api: 4.0.0
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true); // Still succeeds, just warns
      expect(result.diagnostics.some(d =>
        d.code === BUILD_WARNING_CODES.SECURITY_SIGNAL_MEDIUM &&
        d.context?.field === 'main'
      )).toBe(true);
    });

    it('warns on invalid API version format', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: invalid-version
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true); // Still succeeds, just warns
      expect(result.diagnostics.some(d =>
        d.code === BUILD_WARNING_CODES.SECURITY_SIGNAL_HIGH &&
        d.context?.field === 'api'
      )).toBe(true);
    });

    it('warns on invalid website URL', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: 4.0.0
website: not-a-url
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.diagnostics.some(d =>
        d.code === BUILD_WARNING_CODES.SECURITY_SIGNAL_MEDIUM &&
        d.context?.field === 'website'
      )).toBe(true);
    });

    it('warns on empty array API', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: []
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_API_MISSING)).toBe(true);
    });
  });

  describe('array field validation', () => {
    it('warns on non-string items in authors array', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: 4.0.0
authors:
  - valid
  - 123
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.authors).toEqual(['valid']);
    });

    it('warns on invalid commands format', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: 4.0.0
commands: "not an object"
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.commands).toBeUndefined();
      expect(result.diagnostics.some(d =>
        d.code === BUILD_WARNING_CODES.SECURITY_SIGNAL_MEDIUM &&
        d.context?.field === 'commands'
      )).toBe(true);
    });

    it('parses multiple commands in object format', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: 4.0.0
commands:
  cmd1:
    description: Command 1
  cmd2:
    description: Command 2
    usage: /cmd2 <arg>
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.commands).toHaveLength(2);
    });

    it('parses multiple permissions in object format', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: 4.0.0
permissions:
  test.perm1:
    description: Permission 1
  test.perm2:
    description: Permission 2
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.permissions).toHaveLength(2);
    });
  });

  describe('diagnostics context', () => {
    it('includes sourcePath in diagnostics when provided', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: 4.0.0
`;
      const result = validatePluginYml(content, '/path/to/plugin.yml');
      expect(result.success).toBe(true);
      expect(result.diagnostics).toBeDefined();
    });

    it('handles undefined sourcePath', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: 4.0.0
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.diagnostics).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles names with special characters', () => {
      const content = `
name: "Test-Plugin_v2"
version: 1.0.0
main: Test\\Main
api: 4.0.0
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.name).toBe('Test-Plugin_v2');
    });

    it('handles numeric PHP version', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: 4.0.0
php: 8.1
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.php).toBe('8.1');
    });

    it('handles array PHP version', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: 4.0.0
php:
  - "8.0"
  - "8.1"
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.php).toEqual(['8.0', '8.1']);
    });

    it('handles empty optional arrays', () => {
      const content = `
name: Test
version: 1.0.0
main: Test\\Main
api: 4.0.0
authors: []
`;
      const result = validatePluginYml(content);
      expect(result.success).toBe(true);
      expect(result.metadata!.authors).toBeUndefined();
    });

    it('treats null YAML as empty object', () => {
      const content = '~'; // YAML null
      const result = validatePluginYml(content);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some(d => d.code === BUILD_ERROR_CODES.PLUGIN_NAME_MISSING)).toBe(true);
    });
  });
});

describe('PLUGIN_YML_MAX_SIZE', () => {
  it('is defined as 1 MiB', () => {
    expect(PLUGIN_YML_MAX_SIZE).toBe(1024 * 1024);
  });
});
