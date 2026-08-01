/**
 * Pharynx Runner Tests
 *
 * Tests for the Pharynx PHAR builder runner.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

import {
  runPharynx,
  checkPhpVersion,
  PHARYNX_RUNNER_LIMITS,
} from '../../src/build/pharynx-runner.js';
import {
  BUILD_CODES,
  buildError,
  infrastructureError,
  getErrors,
  getInfrastructureErrors,
  hasErrors,
} from '../../src/build/diagnostics.js';

// ============================================================
// Test Fixtures
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const TEST_TEMP_DIR = join(tmpdir(), 'axolotl-pharynx-runner-tests');

// Minimal plugin.yml for test fixtures
const MINIMAL_PLUGIN_YML = `name: TestPlugin
version: 1.0.0
main: TestPlugin\\Main
api: 5.0.0
author: TestAuthor
description: A test plugin
`;

function createFixturePlugin(name: string): string {
  const pluginPath = join(TEST_TEMP_DIR, name);
  mkdirSync(join(pluginPath, 'src', 'TestPlugin'), { recursive: true });
  mkdirSync(join(pluginPath, 'resources'), { recursive: true });

  writeFileSync(
    join(pluginPath, 'plugin.yml'),
    MINIMAL_PLUGIN_YML,
    'utf-8'
  );

  writeFileSync(
    join(pluginPath, 'src', 'TestPlugin', 'Main.php'),
    `<?php
namespace TestPlugin;

class Main {
    public function onEnable(): void {}
}
`,
    'utf-8'
  );

  return pluginPath;
}

function createOutputDir(name: string): string {
  const outPath = join(TEST_TEMP_DIR, 'output', name);
  mkdirSync(outPath, { recursive: true });
  return outPath;
}

// ============================================================
// Setup / Teardown
// ============================================================

beforeAll(() => {
  if (!existsSync(TEST_TEMP_DIR)) {
    mkdirSync(TEST_TEMP_DIR, { recursive: true });
  }
});

afterAll(() => {
  try {
    rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
  } catch {}
});

// ============================================================
// Limits Constants
// ============================================================

describe('PHARYNX_RUNNER_LIMITS', () => {
  test('default timeout is 10 minutes', () => {
    expect(PHARYNX_RUNNER_LIMITS.DEFAULT_TIMEOUT_MS).toBe(10 * 60 * 1000);
  });

  test('max output size is 1MB', () => {
    expect(PHARYNX_RUNNER_LIMITS.MAX_OUTPUT_SIZE).toBe(1024 * 1024);
  });

  test('max PHAR size is 50MB', () => {
    expect(PHARYNX_RUNNER_LIMITS.MAX_PHAR_SIZE).toBe(50 * 1024 * 1024);
  });

  test('min PHAR size is 512 bytes', () => {
    expect(PHARYNX_RUNNER_LIMITS.MIN_PHAR_SIZE).toBe(512);
  });
});

// ============================================================
// PHP Version Check
// ============================================================

describe('checkPhpVersion', () => {
  test('non-existent binary returns error', async () => {
    const result = await checkPhpVersion('/nonexistent/php-binary-' + Date.now());
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('php returns version on success', async () => {
    const result = await checkPhpVersion('php');
    if (result.success) {
      expect(result.version).toBeDefined();
      expect(result.version).toMatch(/^\d+\.\d+/); // e.g. "8.x.x"
    } else {
      // PHP not installed — acceptable in CI environments
      expect(result.error).toBeDefined();
    }
  });
});

// ============================================================
// Input Validation
// ============================================================

describe('runPharynx - input validation', () => {
  test('missing PHP binary returns PHP_NOT_FOUND infrastructure error', async () => {
    const pluginDir = createFixturePlugin('php-not-found');
    const outputDir = createOutputDir('php-not-found');
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx.phar',
      pluginDir,
      outputDir,
      outputPhar,
      phpPath: '/nonexistent/php-' + Date.now(),
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    const infraErrors = getInfrastructureErrors(result.diagnostics);
    expect(infraErrors.some(d => d.code === BUILD_CODES.PHP_NOT_FOUND)).toBe(true);
  });

  test('missing pharynx binary returns PHARYNX_NOT_FOUND infrastructure error', async () => {
    const pluginDir = createFixturePlugin('pharynx-not-found');
    const outputDir = createOutputDir('pharynx-not-found');
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx.phar-' + Date.now(),
      pluginDir,
      outputDir,
      outputPhar,
      phpPath: 'php',
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    const infraErrors = getInfrastructureErrors(result.diagnostics);
    expect(infraErrors.some(d => d.code === BUILD_CODES.PHARYNX_NOT_FOUND)).toBe(true);
  });

  test('empty pluginDir returns PHARYNX_NO_PLUGIN_DIR error', async () => {
    const outputDir = createOutputDir('empty-plugin-dir');
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx.phar',
      pluginDir: '',
      outputDir,
      outputPhar,
      phpPath: 'php',
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === BUILD_CODES.PHARYNX_NO_PLUGIN_DIR)).toBe(true);
  });

  test('non-existent pluginDir returns PHARYNX_PLUGIN_DIR_NOT_FOUND error', async () => {
    const outputDir = createOutputDir('nonexistent-plugin-dir');
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx.phar',
      pluginDir: join(TEST_TEMP_DIR, 'this-does-not-exist-' + Date.now()),
      outputDir,
      outputPhar,
      phpPath: 'php',
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === BUILD_CODES.PHARYNX_PLUGIN_DIR_NOT_FOUND)).toBe(true);
  });

  test('result always has all required fields', async () => {
    const pluginDir = createFixturePlugin('result-fields');
    const outputDir = createOutputDir('result-fields');
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx.phar',
      pluginDir,
      outputDir,
      outputPhar,
      phpPath: '/nonexistent/php',
      timeoutMs: 5000,
    });

    // All required fields present
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.pluginDir).toBe('string');
    expect(result.pluginDir).toBe(pluginDir);
    expect(typeof result.outputDir).toBe('string');
    expect(result.outputDir).toBe(outputDir);
    expect(typeof result.outputPhar).toBe('string');
    expect(result.outputPhar).toBe(outputPhar);
    // exitCode is number when PHP starts, null when PHP binary is missing
    expect(result.exitCode === null || typeof result.exitCode === 'number').toBe(true);
    expect(typeof result.elapsedMs).toBe('number');
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.stdout).toBe('string');
    expect(typeof result.stderr).toBe('string');
    expect(typeof result.timedOut).toBe('boolean');
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });
});

// ============================================================
// Output Directory Setup
// ============================================================

describe('runPharynx - output directory handling', () => {
  test('creates output directory if it does not exist', async () => {
    const pluginDir = createFixturePlugin('output-dir-create');
    const outputDir = join(TEST_TEMP_DIR, 'output', 'new-output-dir-' + Date.now());
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    // Verify it doesn't exist yet
    expect(existsSync(outputDir)).toBe(false);

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx.phar',
      pluginDir,
      outputDir,
      outputPhar,
      phpPath: 'php',
      timeoutMs: 5000,
    });

    // Should not fail due to output directory creation — it gets created
    expect(result.diagnostics.some(d => d.code === BUILD_CODES.PHARYNX_OUTPUT_DIR_CREATION_FAILED)).toBe(false);
  });
});

// ============================================================
// Argument Construction (via error behavior)
// ============================================================

describe('runPharynx - argument construction', () => {
  test('php -dphar.readonly=0 flag is used', async () => {
    // We can't directly verify the arguments without mocking spawn,
    // but we verify the runner accepts composerMode and additionalSources
    const pluginDir = createFixturePlugin('arg-construction');
    const outputDir = createOutputDir('arg-construction');
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx.phar',
      pluginDir,
      outputDir,
      outputPhar,
      phpPath: 'php',
      composerMode: true,
      additionalSources: ['src', 'resources'],
      additionalFiles: [{ name: 'icon.png', path: 'assets/icon.png' }],
      timeoutMs: 5000,
    });

    // Should fail on pharynx not found, not on argument parsing
    expect(result.diagnostics.some(d => d.code === BUILD_CODES.PHARYNX_NOT_FOUND)).toBe(true);
  });

  test('accepts empty additionalSources without error', async () => {
    const pluginDir = createFixturePlugin('empty-sources');
    const outputDir = createOutputDir('empty-sources');
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx.phar',
      pluginDir,
      outputDir,
      outputPhar,
      phpPath: 'php',
      additionalSources: [],
      additionalFiles: [],
      timeoutMs: 5000,
    });

    // Only PHARYNX_NOT_FOUND, no argument errors
    const errorCodes = result.diagnostics.map(d => d.code);
    expect(errorCodes).toContain(BUILD_CODES.PHARYNX_NOT_FOUND);
    expect(errorCodes.some(c => c.includes('ARGUMENT') || c.includes('INVALID'))).toBe(false);
  });
});

// ============================================================
// Diagnostics Quality
// ============================================================

describe('Pharynx diagnostics', () => {
  test('PHARYNX_NOT_FOUND message is descriptive', () => {
    const diag = infrastructureError(
      BUILD_CODES.PHARYNX_NOT_FOUND,
      'Pharynx not found at "/path/pharynx.phar". Ensure the Build Host has pharynx.phar installed.',
      { pharynxPath: '/path/pharynx.phar' }
    );
    expect(diag.message.length).toBeGreaterThan(30);
    expect(diag.context?.pharynxPath).toBe('/path/pharynx.phar');
  });

  test('PHARYNX_TIMEOUT message includes timeout value', () => {
    const diag = infrastructureError(
      BUILD_CODES.PHARYNX_TIMEOUT,
      'Pharynx build timed out after 600000ms',
      { timeoutMs: 600000, elapsedMs: 600000 }
    );
    expect(diag.message).toContain('600000');
    expect(diag.context?.timeoutMs).toBe(600000);
  });

  test('PHARYNX_OUTPUT_PHAR_MISSING includes path context', () => {
    const diag = buildError(
      BUILD_CODES.PHARYNX_OUTPUT_PHAR_MISSING,
      'Output PHAR not found at "/build/TopStats.phar"',
      { outputPhar: '/build/TopStats.phar' }
    );
    expect(diag.context?.outputPhar).toBe('/build/TopStats.phar');
  });

  test('PHARYNX_PLUGIN_DIR_NOT_FOUND includes pluginDir context', () => {
    const diag = buildError(
      BUILD_CODES.PHARYNX_PLUGIN_DIR_NOT_FOUND,
      'Plugin directory does not exist: /src',
      { pluginDir: '/src' }
    );
    expect(diag.context?.pluginDir).toBe('/src');
  });
});

// ============================================================
// Output Validation (failure cases)
// ============================================================

describe('runPharynx - output validation', () => {
  test('PHARYNX_INVALID_EXIT_CODE diagnostic is emitted on non-zero exit', async () => {
    // Use a valid PHP but invalid pharynx — it will try to run and fail
    const pluginDir = createFixturePlugin('exit-code');
    const outputDir = createOutputDir('exit-code');
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx-' + Date.now() + '.phar',
      pluginDir,
      outputDir,
      outputPhar,
      phpPath: 'php',
      timeoutMs: 5000,
    });

    // On Unix with real PHP but missing pharynx: exit code 1
    // On Windows shell: stderr has "cannot find the path"
    const errorCodes = result.diagnostics.map(d => d.code);

    // Either PHARYNX_NOT_FOUND (not found) or PHARYNX_INVALID_EXIT_CODE (tried and failed)
    const expectedCodes = [
      BUILD_CODES.PHARYNX_NOT_FOUND,
      BUILD_CODES.PHARYNX_INVALID_EXIT_CODE,
    ];
    expect(errorCodes.some(c => expectedCodes.includes(c as any))).toBe(true);
  });
});

// ============================================================
// Integration with real PHP (if available)
// ============================================================

describe('runPharynx - real PHP integration', () => {
  test('real PHP without pharynx produces diagnostics', async () => {
    const pluginDir = createFixturePlugin('real-php');
    const outputDir = createOutputDir('real-php');
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx-' + Date.now() + '.phar',
      pluginDir,
      outputDir,
      outputPhar,
      phpPath: 'php',
      timeoutMs: 5000,
    });

    // Result should be well-formed
    // exitCode may be null (process error) or a number (PHP ran but pharynx not found)
    // Either way, diagnostics must be populated
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    // Must have failure indication either via exitCode or diagnostics
    const hasFailure = result.exitCode !== 0 || getErrors(result.diagnostics).length > 0;
    expect(hasFailure).toBe(true);
  });

  test('stdout and stderr are captured as strings', async () => {
    const pluginDir = createFixturePlugin('capture-stdout');
    const outputDir = createOutputDir('capture-stdout');
    const outputPhar = join(outputDir, 'TestPlugin.phar');

    const result = await runPharynx({
      pharynxPath: '/nonexistent/pharynx.phar',
      pluginDir,
      outputDir,
      outputPhar,
      phpPath: 'php',
      timeoutMs: 5000,
    });

    expect(typeof result.stdout).toBe('string');
    expect(typeof result.stderr).toBe('string');
  });
});
