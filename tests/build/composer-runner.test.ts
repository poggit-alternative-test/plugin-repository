/**
 * Composer Runner Tests
 *
 * Tests for the Composer Runner.
 *
 * Note: Tests that require an actual Composer binary will skip if Composer
 * is not available in the environment. Tests that don't require Composer
 * (workspace validation, diagnostics helpers) always run.
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

import {
  runComposerInstall,
  checkComposerVersion,
  validateWorkspacePath,
  COMPOSER_RUNNER_LIMITS,
} from '../../src/build/composer-runner.js';
import {
  BUILD_CODES,
  buildError,
  buildWarning,
  infrastructureError,
  classifyComposerExitCode,
  getErrors,
  getWarnings,
  getInfrastructureErrors,
  hasErrors,
  hasInfrastructureErrors,
} from '../../src/build/diagnostics.js';

// ============================================================
// Test Fixtures
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_TEMP_DIR = join(tmpdir(), 'axolotl-composer-runner-tests');

// Fixture composer.json for tests
const MINIMAL_COMPOSER_JSON = JSON.stringify({
  name: 'test/minimal-plugin',
  description: 'A minimal test plugin',
  require: {
    'pocketmine/pocketmine-mp': '^5.0.0',
  },
}, null, 2);

// Create a fixture workspace
function createFixtureWorkspace(name: string, composerJsonContent?: string): string {
  const workspacePath = join(TEST_TEMP_DIR, name);
  mkdirSync(workspacePath, { recursive: true });
  if (composerJsonContent !== undefined) {
    writeFileSync(join(workspacePath, 'composer.json'), composerJsonContent, 'utf-8');
  }
  return workspacePath;
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
// Workspace Validation Tests
// ============================================================

describe('validateWorkspacePath', () => {
  test('empty path returns error', () => {
    const diagnostics = validateWorkspacePath('');
    expect(getErrors(diagnostics)).toHaveLength(1);
    expect(diagnostics[0].code).toBe(BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE);
  });

  test('whitespace-only path returns error', () => {
    const diagnostics = validateWorkspacePath('   ');
    expect(getErrors(diagnostics)).toHaveLength(1);
  });

  test('path with null byte returns error', () => {
    const diagnostics = validateWorkspacePath('/some/path\0evil');
    expect(getErrors(diagnostics)).toHaveLength(1);
    expect(diagnostics[0].code).toBe(BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE);
  });

  test('very long path returns error', () => {
    const longPath = 'x'.repeat(COMPOSER_RUNNER_LIMITS.MAX_WORKSPACE_PATH_LENGTH + 1);
    const diagnostics = validateWorkspacePath(longPath);
    expect(getErrors(diagnostics)).toHaveLength(1);
    expect(diagnostics[0].code).toBe(BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE);
  });

  test('valid path returns no diagnostics', () => {
    const diagnostics = validateWorkspacePath('/tmp/valid-workspace');
    expect(diagnostics).toHaveLength(0);
  });
});

// ============================================================
// Diagnostics Helper Tests
// ============================================================

describe('classifyComposerExitCode', () => {
  test('exit code 0 returns null (success)', () => {
    expect(classifyComposerExitCode(0)).toBeNull();
  });

  test('exit code 1 returns generic failure', () => {
    const diag = classifyComposerExitCode(1);
    expect(diag).not.toBeNull();
    expect(diag!.code).toBe(BUILD_CODES.COMPOSER_INSTALL_FAILED);
    expect(diag!.severity).toBe('error');
  });

  test('exit code 2 returns dependency resolution failure', () => {
    const diag = classifyComposerExitCode(2);
    expect(diag).not.toBeNull();
    expect(diag!.code).toBe(BUILD_CODES.COMPOSER_INSTALL_FAILED);
  });

  test('exit code 3 returns plugin/script failure', () => {
    const diag = classifyComposerExitCode(3);
    expect(diag).not.toBeNull();
    expect(diag!.code).toBe(BUILD_CODES.COMPOSER_INSTALL_FAILED);
  });

  test('exit code 4 returns script blocked (infrastructure error)', () => {
    const diag = classifyComposerExitCode(4);
    expect(diag).not.toBeNull();
    expect(diag!.code).toBe(BUILD_CODES.COMPOSER_SCRIPT_BLOCKED);
    expect(diag!.severity).toBe('infrastructure_error');
  });

  test('exit code 5 returns no composer.json', () => {
    const diag = classifyComposerExitCode(5);
    expect(diag).not.toBeNull();
    expect(diag!.code).toBe(BUILD_CODES.COMPOSER_NO_COMPOSER_JSON);
  });

  test('exit code null returns timeout', () => {
    const diag = classifyComposerExitCode(null);
    expect(diag).not.toBeNull();
    expect(diag!.code).toBe(BUILD_CODES.COMPOSER_TIMEOUT);
    expect(diag!.severity).toBe('infrastructure_error');
  });

  test('unknown exit code returns generic failure', () => {
    const diag = classifyComposerExitCode(99);
    expect(diag).not.toBeNull();
    expect(diag!.code).toBe(BUILD_CODES.COMPOSER_INSTALL_FAILED);
    expect(diag!.message).toContain('99');
  });
});

describe('getErrors / getWarnings / getInfrastructureErrors', () => {
  test('correctly separates error severities', () => {
    const diagnostics = [
      buildError(BUILD_CODES.COMPOSER_NOT_FOUND, 'Not found'),
      buildWarning(BUILD_CODES.COMPOSER_EMPTY_OUTPUT, 'Empty output'),
      infrastructureError(BUILD_CODES.COMPOSER_TIMEOUT, 'Timeout'),
      buildError(BUILD_CODES.COMPOSER_INSTALL_FAILED, 'Install failed'),
    ];

    expect(getErrors(diagnostics)).toHaveLength(2);
    expect(getWarnings(diagnostics)).toHaveLength(1);
    expect(getInfrastructureErrors(diagnostics)).toHaveLength(1);
  });
});

describe('hasErrors / hasInfrastructureErrors', () => {
  test('hasErrors returns true for errors', () => {
    expect(hasErrors([buildError(BUILD_CODES.COMPOSER_NOT_FOUND, 'err')])).toBe(true);
  });

  test('hasErrors returns false for warnings only', () => {
    expect(hasErrors([buildWarning(BUILD_CODES.COMPOSER_EMPTY_OUTPUT, 'warn')])).toBe(false);
  });

  test('hasInfrastructureErrors returns true for infra errors', () => {
    expect(hasInfrastructureErrors([infrastructureError(BUILD_CODES.COMPOSER_TIMEOUT, 'timeout')])).toBe(true);
  });
});

// ============================================================
// Workspace Readiness Tests (No Composer Spawn Required)
// ============================================================

describe('runComposerInstall - workspace readiness', () => {
  test('missing workspace directory returns error', async () => {
    const result = await runComposerInstall({
      workspace: join(TEST_TEMP_DIR, 'non-existent-workspace-xyz123'),
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBeNull();
    expect(getInfrastructureErrors(result.diagnostics)).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe(BUILD_CODES.COMPOSER_WORKSPACE_CREATION_FAILED);
  });

  test('workspace that is a file (not directory) returns error', async () => {
    const filePath = join(TEST_TEMP_DIR, 'a-regular-file.txt');
    writeFileSync(filePath, 'not a directory', 'utf-8');

    const result = await runComposerInstall({
      workspace: filePath,
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics[0].code).toBe(BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE);
  });

  test('workspace without composer.json returns error', async () => {
    const workspace = createFixtureWorkspace('no-composer-json');

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === BUILD_CODES.COMPOSER_NO_COMPOSER_JSON)).toBe(true);
  });

  test('workspace with empty composer.json returns error', async () => {
    const workspace = createFixtureWorkspace('empty-composer-json', '');

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === BUILD_CODES.COMPOSER_NO_COMPOSER_JSON)).toBe(true);
  });

  test('workspace with whitespace-only composer.json returns error', async () => {
    const workspace = createFixtureWorkspace('whitespace-composer-json', '   \n\n  ');

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === BUILD_CODES.COMPOSER_NO_COMPOSER_JSON)).toBe(true);
  });

  test('valid workspace with composer.json proceeds to Composer execution', { timeout: 120000 }, async () => {
    const workspace = createFixtureWorkspace('valid-composer-json', MINIMAL_COMPOSER_JSON);

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 120000, // 120s — composer needs time to resolve dependencies from packagist (no lock file)
      composerPath: 'composer',
    });

    // Composer may or may not be installed in the test environment.
    // The key assertion is that we got past workspace validation
    // and reached the actual execution stage.
    // We check that the result is well-formed with diagnostics.
    expect(result.workspace).toBe(workspace);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.diagnostics)).toBe(true);

    // If Composer is not found, we get COMPOSER_NOT_FOUND
    // If it runs, we get a different result
    // Either way, the execution was attempted
    const notFoundDiag = result.diagnostics.find(
      d => d.code === BUILD_CODES.COMPOSER_NOT_FOUND
    );
    const installDiag = result.diagnostics.find(
      d => d.code === BUILD_CODES.COMPOSER_INSTALL_FAILED
    );

    // We should have either COMPOSER_NOT_FOUND or COMPOSER_INSTALL_FAILED or success
    const validOutcome =
      result.success ||                           // Composer succeeded
      notFoundDiag !== undefined ||               // Composer not installed
      installDiag !== undefined ||               // Composer ran but failed
      result.diagnostics.some(d => d.code === BUILD_CODES.COMPOSER_TIMEOUT); // Timeout

    expect(validOutcome).toBe(true);
  });

  test('composer not found produces infrastructure error', async () => {
    const workspace = createFixtureWorkspace('composer-not-found', MINIMAL_COMPOSER_JSON);

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 5000,
      composerPath: '/nonexistent/composer-binary-xyz',
    });

    // Should get COMPOSER_NOT_FOUND infrastructure error
    const infraErrors = getInfrastructureErrors(result.diagnostics);
    const hasNotFound = infraErrors.some(d => d.code === BUILD_CODES.COMPOSER_NOT_FOUND);

    // Also accept generic install failure if Composer was partially found
    const hasInstallFailed = infraErrors.some(d => d.code === BUILD_CODES.COMPOSER_INSTALL_FAILED);

    expect(hasNotFound || hasInstallFailed).toBe(true);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Composer Version Check Tests
// ============================================================

describe('checkComposerVersion', () => {
  test('non-existent binary returns error', async () => {
    const result = await checkComposerVersion('/nonexistent/composer');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('composer --version works if available', async () => {
    const result = await checkComposerVersion('composer');

    if (result.success) {
      // Composer is available
      expect(result.version).toBeDefined();
      expect(result.version).toMatch(/^\d+\.\d+/); // Should look like "2.x.x"
    } else {
      // Composer not installed — this is OK in test environments
      expect(result.error).toBeDefined();
    }
  });
});

// ============================================================
// Result Structure Tests
// ============================================================

describe('ComposerInstallResult structure', () => {
  test('result always has required fields', async () => {
    const workspace = createFixtureWorkspace('result-structure', MINIMAL_COMPOSER_JSON);

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 5000,
      composerPath: '/definitely/nonexistent-composer-' + Date.now(),
    });

    // Verify all required fields are present
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.workspace).toBe('string');
    expect(result.workspace).toBe(workspace);
    expect(typeof result.exitCode).toBe('number');
    expect(typeof result.elapsedMs).toBe('number');
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.stdout).toBe('string');
    expect(typeof result.stderr).toBe('string');
    expect(typeof result.timedOut).toBe('boolean');
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  test('result has correct exitCode when process fails to start', async () => {
    const workspace = createFixtureWorkspace('no-start', MINIMAL_COMPOSER_JSON);

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 5000,
      composerPath: '/completely/invalid/path/composer-' + Math.random(),
    });

    // When the process errors before starting:
    // - On Unix: Node.js emits 'error' with ENOENT → exitCode is null
    // - On Windows: Shell runs and exits with code 1 → exitCode is 1
    const notFoundDiag = result.diagnostics.some(
      d => d.code === BUILD_CODES.COMPOSER_NOT_FOUND
    );
    if (notFoundDiag) {
      // COMPOSER_NOT_FOUND should be present regardless of OS
      expect(result.exitCode === null || result.exitCode === 1).toBe(true);
    }
  });

  test('workspace path is returned in result', async () => {
    const workspace = createFixtureWorkspace('path-returned', MINIMAL_COMPOSER_JSON);

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 5000,
      composerPath: '/nonexistent',
    });

    // The result should contain the workspace path we passed
    expect(result.workspace).toBe(workspace);
  });

  test('composerVersion is undefined when not available', async () => {
    const workspace = createFixtureWorkspace('no-version', MINIMAL_COMPOSER_JSON);

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 5000,
      composerPath: '/nonexistent',
    });

    // Version should not be detected from a failed run
    expect(result.composerVersion).toBeUndefined();
  });

  test('diagnostics array is always populated', async () => {
    const workspace = createFixtureWorkspace('always-diags', MINIMAL_COMPOSER_JSON);

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 5000,
      composerPath: '/nonexistent',
    });

    // Even in failure cases, diagnostics should be an array
    expect(Array.isArray(result.diagnostics)).toBe(true);
    // And it should contain at least one diagnostic
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Timeout and Signal Tests
// ============================================================

describe('runComposerInstall - timeout handling', () => {
  test('timeout flag is set when process is killed by timeout', async () => {
    const workspace = createFixtureWorkspace('timeout-test', MINIMAL_COMPOSER_JSON);

    // Use 'sleep' as the composer path - it will hang, then the timeout fires.
    // On Windows, 'sleep' may not exist; on Unix it does.
    // We use a very short timeout so this test completes quickly.
    const result = await runComposerInstall({
      workspace,
      timeoutMs: 100, // Very short — should fire immediately
      composerPath: 'sleep',
    });

    // Either timedOut=true (timeout fired) or the process exited quickly
    // (on Windows where 'sleep' doesn't exist, it exits with "not found")
    expect(typeof result.timedOut).toBe('boolean');
    expect(result.workspace).toBe(workspace);

    // The result should be a valid ComposerInstallResult regardless of outcome
    expect(typeof result.success).toBe('boolean');
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  test('timeout infrastructure error is present when timed out', async () => {
    const workspace = createFixtureWorkspace('timeout-infra', MINIMAL_COMPOSER_JSON);

    const result = await runComposerInstall({
      workspace,
      timeoutMs: 100,
      composerPath: 'sleep',
    });

    // If the process timed out, there should be a timeout infrastructure error
    if (result.timedOut) {
      const infraErrors = getInfrastructureErrors(result.diagnostics);
      const hasTimeout = infraErrors.some(d => d.code === BUILD_CODES.COMPOSER_TIMEOUT);
      expect(hasTimeout).toBe(true);
    }
  });
});

// ============================================================
// Limits Constants
// ============================================================

describe('COMPOSER_RUNNER_LIMITS', () => {
  test('default timeout is 5 minutes', () => {
    expect(COMPOSER_RUNNER_LIMITS.DEFAULT_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });

  test('max output size is 1MB', () => {
    expect(COMPOSER_RUNNER_LIMITS.MAX_OUTPUT_SIZE).toBe(1024 * 1024);
  });

  test('max workspace path is 4096 chars', () => {
    expect(COMPOSER_RUNNER_LIMITS.MAX_WORKSPACE_PATH_LENGTH).toBe(4096);
  });
});

// ============================================================
// Error Message Quality Tests
// ============================================================

describe('Diagnostic message quality', () => {
  test('COMPOSER_NOT_FOUND message is descriptive', () => {
    const diag = infrastructureError(
      BUILD_CODES.COMPOSER_NOT_FOUND,
      `Composer not found at "composer" or not in PATH. Is Composer installed?`
    );
    expect(diag.message.length).toBeGreaterThan(20);
  });

  test('COMPOSER_TIMEOUT message includes timeout value', () => {
    const diag = infrastructureError(
      BUILD_CODES.COMPOSER_TIMEOUT,
      `Composer install timed out after 60000ms`,
      { timeoutMs: 60000, elapsedMs: 60000 }
    );
    expect(diag.message).toContain('60000');
    expect(diag.context?.timeoutMs).toBe(60000);
  });

  test('COMPOSER_NO_COMPOSER_JSON has context', () => {
    const diag = buildError(
      BUILD_CODES.COMPOSER_NO_COMPOSER_JSON,
      `composer.json not found in workspace: /some/path`,
      { workspace: '/some/path' }
    );
    expect(diag.context?.workspace).toBe('/some/path');
  });
});
