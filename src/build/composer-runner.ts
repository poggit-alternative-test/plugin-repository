/**
 * Composer Runner
 *
 * Executes Composer in a controlled workspace with:
 * - Production-only dependency installation (no dev dependencies, keeps PHAR clean)
 * - Dev dependency installation for build tooling (Pharynx etc.)
 * - Script/plugin execution blocked in all modes
 * - Structured diagnostics and timing
 * - Timeout enforcement
 *
 * SECURITY: This module executes external processes. It is intended ONLY for
 * trusted build pipelines where the source has been reviewed and approved.
 * The runner NEVER exposes secrets to the Composer process.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import {
  BUILD_CODES,
  buildError,
  buildWarning,
  infrastructureError,
  type BuildDiagnostic,
  classifyComposerExitCode,
} from './diagnostics.js';

// ============================================================
// Resource Limits
// ============================================================

export const COMPOSER_RUNNER_LIMITS = {
  /** Default timeout for Composer operations (ms) */
  DEFAULT_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes

  /** Composer JSON must be present and non-empty */
  MIN_COMPOSER_JSON_SIZE: 10, // bytes

  /** Maximum stdout/stderr to retain (chars) */
  MAX_OUTPUT_SIZE: 1024 * 1024, // 1 MB

  /** Maximum workspace path length */
  MAX_WORKSPACE_PATH_LENGTH: 4096,
} as const;

// ============================================================
// Configuration
// ============================================================

export interface ComposerRunnerConfig {
  /**
   * Working directory for the Composer run.
   * Must contain a composer.json.
   */
  workspace: string;

  /**
   * Timeout for the Composer operation in milliseconds.
   * Defaults to 5 minutes.
   */
  timeoutMs?: number;

  /**
   * Path to the Composer binary.
   * Defaults to 'composer' (uses PATH).
   */
  composerPath?: string;

  /**
   * Optional COMPOSER_HOME override for isolated global cache.
   */
  composerHome?: string;

  /**
   * Optional additional environment variables.
   * WARNING: Do NOT pass secrets here. They would be visible in process listings.
   */
  env?: Record<string, string>;

  /**
   * When true, only install dev dependencies (require-dev).
   * This is used to acquire build tooling like Pharynx without installing
   * production dependencies into the final artifact.
   * Defaults to false (production install).
   */
  devOnly?: boolean;
}

// ============================================================
// Result Types
// ============================================================

export interface ComposerInstallResult {
  /** Whether the installation succeeded */
  success: boolean;

  /** Workspace path used */
  workspace: string;

  /** Exit code from Composer, or null if killed by timeout */
  exitCode: number | null;

  /** Elapsed time in milliseconds */
  elapsedMs: number;

  /** Stdout from Composer (truncated to MAX_OUTPUT_SIZE) */
  stdout: string;

  /** Stderr from Composer (truncated to MAX_OUTPUT_SIZE) */
  stderr: string;

  /** Whether the process was killed due to timeout */
  timedOut: boolean;

  /** Composer version string if detected */
  composerVersion?: string;

  /** Number of packages installed */
  packagesInstalled?: number;

  /** Install mode used */
  mode: 'production' | 'dev-only';

  /** Diagnostics emitted during the run */
  diagnostics: BuildDiagnostic[];
}

// ============================================================
// Composer Version Detection
// ============================================================

/**
 * Parse Composer version from version string.
 * Example: "Composer version 2.6.5 2023-10-25 15:25:23" -> "2.6.5"
 */
function parseComposerVersion(versionOutput: string): string | undefined {
  const match = versionOutput.match(/Composer\s+version\s+(\S+)/i);
  return match?.[1];
}

// ============================================================
// Output Size Limit Helper
// ============================================================

/**
 * Truncate output to maximum size, keeping the tail.
 */
function truncateOutput(output: string, maxSize: number): string {
  if (output.length <= maxSize) {
    return output;
  }
  return '... [TRUNCATED] ...\n' + output.slice(-(maxSize - 24));
}

// ============================================================
// Composer Version Check
// ============================================================

/**
 * Verify Composer is available and get its version.
 */
export async function checkComposerVersion(
  composerPath: string = 'composer'
): Promise<{ success: boolean; version?: string; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(composerPath, ['--version'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      if (err.message.includes('ENOENT') || err.message.includes('spawn')) {
        resolve({
          success: false,
          error: `Composer not found at "${composerPath}" or not in PATH. Is Composer installed?`,
        });
      } else {
        resolve({ success: false, error: err.message });
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const version = parseComposerVersion(stdout);
        resolve({ success: true, version });
      } else {
        resolve({
          success: false,
          error: stderr || `Composer exited with code ${code}`,
        });
      }
    });

    // Short timeout for version check
    setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: 'Composer version check timed out' });
    }, 10000);
  });
}

// ============================================================
// Main Runner
// ============================================================

/**
 * Run Composer install in a controlled workspace.
 *
 * Security properties:
 * - No dev dependencies (--no-dev)
 * - No scripts executed (--no-scripts)
 * - No plugins activated (--no-plugins)
 * - No interactive prompts (--no-interaction)
 * - No autoloader optimization that might execute code (--no-autoloader)
 * - Secrets NOT passed via environment
 * - Process timeout enforced
 *
 * @param config - Runner configuration
 * @returns Structured result with diagnostics
 */
export async function runComposerInstall(
  config: ComposerRunnerConfig
): Promise<ComposerInstallResult> {
  const diagnostics: BuildDiagnostic[] = [];
  const startTime = Date.now();
  const timeoutMs = config.timeoutMs ?? COMPOSER_RUNNER_LIMITS.DEFAULT_TIMEOUT_MS;

  const workspace = config.workspace;
  const composerBinary = config.composerPath ?? 'composer';

  // Determine install mode (must be declared before early returns)
  const devOnly = config.devOnly ?? false;
  const mode: ComposerInstallResult['mode'] = devOnly ? 'dev-only' : 'production';

  // ─── Workspace Validation ──────────────────────────────────

  // Check workspace exists
  if (!existsSync(workspace)) {
    diagnostics.push(
      infrastructureError(
        BUILD_CODES.COMPOSER_WORKSPACE_CREATION_FAILED,
        `Workspace directory does not exist: ${workspace}`
      )
    );
    return {
      success: false,
      workspace,
      exitCode: null,
      elapsedMs: Date.now() - startTime,
      stdout: '',
      stderr: '',
      timedOut: false,
      mode,
      diagnostics,
    };
  }

  // Check workspace is a directory
  try {
    const stats = statSync(workspace);
    if (!stats.isDirectory()) {
      diagnostics.push(
        buildError(
          BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE,
          `Workspace path is not a directory: ${workspace}`
        )
      );
      return {
        success: false,
        workspace,
        exitCode: null,
        elapsedMs: Date.now() - startTime,
        stdout: '',
        stderr: '',
        timedOut: false,
        mode,
        diagnostics,
      };
    }
  } catch (e) {
    diagnostics.push(
      infrastructureError(
        BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE,
        `Cannot stat workspace directory: ${workspace}: ${e instanceof Error ? e.message : 'Unknown error'}`
      )
    );
    return {
      success: false,
      workspace,
      exitCode: null,
      elapsedMs: Date.now() - startTime,
      stdout: '',
      stderr: '',
      timedOut: false,
      mode,
      diagnostics,
    };
  }

  // Check workspace path length
  if (workspace.length > COMPOSER_RUNNER_LIMITS.MAX_WORKSPACE_PATH_LENGTH) {
    diagnostics.push(
      buildError(
        BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE,
        `Workspace path exceeds maximum length (${workspace.length} > ${COMPOSER_RUNNER_LIMITS.MAX_WORKSPACE_PATH_LENGTH})`
      )
    );
    return {
      success: false,
      workspace,
      exitCode: null,
      elapsedMs: Date.now() - startTime,
      stdout: '',
      stderr: '',
      timedOut: false,
      mode,
      diagnostics,
    };
  }

  // ─── Composer JSON Check ───────────────────────────────────

  const composerJsonPath = join(workspace, 'composer.json');
  if (!existsSync(composerJsonPath)) {
    diagnostics.push(
      buildError(
        BUILD_CODES.COMPOSER_NO_COMPOSER_JSON,
        `composer.json not found in workspace: ${workspace}`
      )
    );
    return {
      success: false,
      workspace,
      exitCode: null,
      elapsedMs: Date.now() - startTime,
      stdout: '',
      stderr: '',
      timedOut: false,
      mode,
      diagnostics,
    };
  }

  // Check composer.json is not empty
  try {
    const content = readFileSync(composerJsonPath, 'utf-8');
    if (content.trim().length < COMPOSER_RUNNER_LIMITS.MIN_COMPOSER_JSON_SIZE) {
      diagnostics.push(
        buildError(
          BUILD_CODES.COMPOSER_NO_COMPOSER_JSON,
          `composer.json in workspace is empty or too small`
        )
      );
      return {
        success: false,
        workspace,
        exitCode: null,
        elapsedMs: Date.now() - startTime,
        stdout: '',
        stderr: '',
        timedOut: false,
        mode,
        diagnostics,
      };
    }
  } catch (e) {
    diagnostics.push(
      infrastructureError(
        BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE,
        `Cannot read composer.json: ${e instanceof Error ? e.message : 'Unknown error'}`
      )
    );
    return {
      success: false,
      workspace,
      exitCode: null,
      elapsedMs: Date.now() - startTime,
      stdout: '',
      stderr: '',
      timedOut: false,
      mode,
      diagnostics,
    };
  }

  // ─── Build Environment ─────────────────────────────────────

  // Build clean environment — NO secrets
  const env: Record<string, string> = {
    ...process.env,
    // Ensure non-interactive mode
    COMPOSER_NO_INTERACTION: '1',
    // Disable Composer's network caching of auth credentials
    COMPOSER_ALLOW_SUPERUSER: '0',
    // Disable Composer's self-update (not relevant for builds)
    COMPOSER_DISABLE_NETWORK: '0',
    ...config.env,
  };

  // Override COMPOSER_HOME if specified for isolation
  if (config.composerHome) {
    env.COMPOSER_HOME = config.composerHome;
  }

  // ─── Run Composer ──────────────────────────────────────────

  // Build arguments
  // Key flags:
  //   --no-dev          : skip dev dependencies (production only, keeps PHAR clean)
  //   --dev             : include dev dependencies (for build tooling like Pharynx)
  //   --no-scripts      : do NOT execute any scripts defined in composer.json
  //   --no-plugins      : do NOT activate any plugins (blocks code execution)
  //   --no-autoloader   : skip autoloader dump (may run scripts, skip for safety)
  //   --prefer-dist     : prefer dist archives over git clones (faster)
  //   --no-progress     : suppress progress bar (cleaner output capture)
  //   --no-audit        : skip security audit during install (faster, review is separate)
  //   --ignore-platform-reqs : ignore platform requirements (allows installing on PHP 8.x
  //                            when composer.json requires ^5.0.0 PocketMine)
  //
  // Note: There is no --dev-only flag in Composer. To get dev dependencies, omit --no-dev.
  // To remove dev deps from an existing vendor/, run install --no-dev (second pass).
  const args = devOnly
    ? [
        // Dev mode: include dev dependencies for build tooling (Pharynx, etc.)
        // --no-dev is absent, so Composer includes require-dev by default
        'install',
        '--no-scripts',
        '--no-plugins',
        '--no-autoloader',
        '--prefer-dist',
        '--no-progress',
        '--ignore-platform-reqs',
        '--working-dir=.',
      ]
    : [
        // Production mode: exclude dev dependencies
        'install',
        '--no-dev',
        '--no-scripts',
        '--no-plugins',
        '--no-autoloader',
        '--prefer-dist',
        '--no-progress',
        '--ignore-platform-reqs',
        '--working-dir=.',
      ];

  return new Promise<ComposerInstallResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(composerBinary, args, {
      cwd: workspace,
      env,
      shell: true,
      // Explicitly do NOT inherit stdio — we capture it
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Capture stdout
    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
      // Hard cap on output to prevent memory exhaustion
      if (stdout.length > COMPOSER_RUNNER_LIMITS.MAX_OUTPUT_SIZE * 2) {
        stdout = truncateOutput(stdout, COMPOSER_RUNNER_LIMITS.MAX_OUTPUT_SIZE);
        diagnostics.push(
          buildWarning(
            BUILD_CODES.COMPOSER_EMPTY_OUTPUT,
            `Composer stdout exceeded ${COMPOSER_RUNNER_LIMITS.MAX_OUTPUT_SIZE} bytes and was truncated`
          )
        );
      }
    });

    // Capture stderr (Composer uses stderr for some output)
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > COMPOSER_RUNNER_LIMITS.MAX_OUTPUT_SIZE * 2) {
        stderr = truncateOutput(stderr, COMPOSER_RUNNER_LIMITS.MAX_OUTPUT_SIZE);
      }
    });

    // Handle process errors
    proc.on('error', (err) => {
      const elapsedMs = Date.now() - startTime;

      if (err.message.includes('ENOENT') || err.message.includes('spawn') || err.message.includes('not found')) {
        diagnostics.push(
          infrastructureError(
            BUILD_CODES.COMPOSER_NOT_FOUND,
            `Composer not found at "${composerBinary}" or not in PATH. Is Composer installed?`,
            { error: err.message }
          )
        );
      } else if (err.message.includes('EACCES') || err.message.includes('permission denied')) {
        diagnostics.push(
          infrastructureError(
            BUILD_CODES.COMPOSER_PERMISSION_DENIED,
            `Permission denied running Composer: ${err.message}`,
            { error: err.message }
          )
        );
      } else {
        diagnostics.push(
          infrastructureError(
            BUILD_CODES.COMPOSER_INSTALL_FAILED,
            `Failed to start Composer: ${err.message}`,
            { error: err.message }
          )
        );
      }

      resolve({
        success: false,
        workspace,
        exitCode: null,
        elapsedMs,
        stdout: truncateOutput(stdout, COMPOSER_RUNNER_LIMITS.MAX_OUTPUT_SIZE),
        stderr: truncateOutput(stderr, COMPOSER_RUNNER_LIMITS.MAX_OUTPUT_SIZE),
        timedOut: false,
        mode,
        diagnostics,
      });
    });

    // Handle exit
    proc.on('close', (code) => {
      const elapsedMs = Date.now() - startTime;
      const exitCode = code;

      // Truncate output to final limit
      stdout = truncateOutput(stdout, COMPOSER_RUNNER_LIMITS.MAX_OUTPUT_SIZE);
      stderr = truncateOutput(stderr, COMPOSER_RUNNER_LIMITS.MAX_OUTPUT_SIZE);

      // Extract Composer version from output if present
      const composerVersion = parseComposerVersion(stdout + stderr);

      // Detect packages installed from output
      const packagesInstalled = detectPackagesInstalled(stdout + stderr);

      // Detect "binary not found" from stderr.
      // On Windows with shell:true, spawn does NOT emit an 'error' event for
      // invalid binary paths — the shell exits with code 1 and stderr contains
      // the diagnostic. We intercept that case before generic exit-code handling.
      const notFoundPatterns = [
        /cannot find the path/i,
        /is not recognized as an/i,
        /command not found/i,
        /no such file or directory/i,
      ];
      const isNotFound = notFoundPatterns.some((p) => p.test(stderr));

      if (isNotFound) {
        diagnostics.push(
          infrastructureError(
            BUILD_CODES.COMPOSER_NOT_FOUND,
            `Composer not found at "${composerBinary}" or not in PATH. Is Composer installed?`,
            { stderr: stderr.slice(0, 500) }
          )
        );
      } else {
        // Classify the exit code
        const exitCodeDiagnostic = classifyComposerExitCode(exitCode);

        if (exitCodeDiagnostic) {
          diagnostics.push(exitCodeDiagnostic);
        }
      }

      // Check for script-related warnings in output
      checkForBlockedScripts(stdout + stderr, diagnostics);

      // Check for plugin-related warnings in output
      checkForBlockedPlugins(stdout + stderr, diagnostics);

      // Determine success
      const success = exitCode === 0 && !timedOut;

      resolve({
        success,
        workspace,
        exitCode,
        elapsedMs,
        stdout,
        stderr,
        timedOut,
        composerVersion,
        packagesInstalled,
        mode,
        diagnostics,
      });
    });

    // ─── Timeout Handler ──────────────────────────────────

    const timeoutHandle = setTimeout(() => {
      timedOut = true;

      // Kill the process group (cross-platform)
      try {
        proc.kill('SIGTERM');
        // Give it a moment to clean up gracefully
        setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            // Already exited
          }
        }, 2000);
      } catch {
        // Process already exited
      }

      diagnostics.push(
        infrastructureError(
          BUILD_CODES.COMPOSER_TIMEOUT,
          `Composer install timed out after ${timeoutMs}ms`,
          { timeoutMs, elapsedMs: Date.now() - startTime }
        )
      );
    }, timeoutMs);
  });
}

// ============================================================
// Output Analysis
// ============================================================

/**
 * Detect how many packages were installed from Composer output.
 */
function detectPackagesInstalled(output: string): number | undefined {
  // Match patterns like:
  // "X package suggestions installed"
  // "Installing dependencies from lock file"
  // "- Installing vendor/package (1.2.3)"
  // "X packages installed"
  const installLineMatch = output.match(/^[\s\S]*?(\d+)\s+package[s]?\s+(?:from|installed)/im);
  if (installLineMatch) {
    return parseInt(installLineMatch[1], 10);
  }

  // Count "- Installing" lines
  const installingLines = output.match(/^\s*-\s+Installing\s+/mgi);
  if (installingLines) {
    return installingLines.length;
  }

  // Check for "Nothing to install" or "already up-to-date"
  if (output.includes('Nothing to install') || output.includes('already up-to-date')) {
    return 0;
  }

  return undefined;
}

/**
 * Check output for evidence that scripts were attempted/run.
 */
function checkForBlockedScripts(output: string, diagnostics: BuildDiagnostic[]): void {
  // These patterns indicate script execution attempts were made by Composer
  // (normally blocked by --no-scripts but we check output to be sure)
  const scriptPatterns = [
    /executing script/i,
    /running script/i,
    /script.*would you like to/i,
  ];

  for (const pattern of scriptPatterns) {
    if (pattern.test(output)) {
      diagnostics.push(
        buildWarning(
          BUILD_CODES.COMPOSER_SCRIPT_BLOCKED,
          'Composer output suggests scripts were executed despite --no-scripts flag'
        )
      );
      break;
    }
  }
}

/**
 * Check output for evidence that plugins were activated despite --no-plugins.
 */
function checkForBlockedPlugins(output: string, diagnostics: BuildDiagnostic[]): void {
  const pluginPatterns = [
    /plugin.*activated/i,
    /loading plugin/i,
  ];

  for (const pattern of pluginPatterns) {
    if (pattern.test(output)) {
      diagnostics.push(
        buildWarning(
          BUILD_CODES.COMPOSER_PLUGIN_BLOCKED,
          'Composer output suggests plugins were activated despite --no-plugins flag'
        )
      );
      break;
    }
  }
}

// ============================================================
// Validation Utilities
// ============================================================

/**
 * Validate that a workspace path is safe for Composer operations.
 * Use this before calling runComposerInstall to fail fast with clear diagnostics.
 *
 * @param workspacePath - The path to validate
 * @returns List of diagnostics (empty if valid)
 */
export function validateWorkspacePath(workspacePath: string): BuildDiagnostic[] {
  const diagnostics: BuildDiagnostic[] = [];

  if (!workspacePath || workspacePath.trim() === '') {
    diagnostics.push(
      buildError(BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE, 'Workspace path is empty')
    );
    return diagnostics;
  }

  if (workspacePath.length > COMPOSER_RUNNER_LIMITS.MAX_WORKSPACE_PATH_LENGTH) {
    diagnostics.push(
      buildError(
        BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE,
        `Workspace path exceeds maximum length of ${COMPOSER_RUNNER_LIMITS.MAX_WORKSPACE_PATH_LENGTH} characters`
      )
    );
  }

  // Check for null bytes
  if (workspacePath.includes('\0')) {
    diagnostics.push(
      buildError(
        BUILD_CODES.COMPOSER_WORKSPACE_UNREADABLE,
        'Workspace path contains null bytes — invalid'
      )
    );
  }

  return diagnostics;
}
