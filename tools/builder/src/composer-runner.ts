/**
 * Composer Runner
 *
 * Executes Composer commands in a controlled workspace with bounded resources.
 *
 * SECURITY: Composer is executed with restricted flags to prevent script injection.
 * Only production dependencies are installed; no scripts or plugins are executed.
 */

import { spawn } from 'child_process';
import type { SpawnOptions } from 'child_process';
import { existsSync, statSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import type { BuildDiagnostic, BuildWarning, BuildError } from './types.js';
import { BUILD_ERROR_CODES, BUILD_WARNING_CODES, buildWarning, buildError } from './types.js';

// ============================================================
// Configuration
// ============================================================

export const COMPOSER_TIMEOUT_MS = 300000; // 5 minutes
export const COMPOSER_MEMORY_LIMIT = '512M';

export interface ComposerRunnerOptions {
  /** Working directory for composer (default: process.cwd()) */
  workingDirectory?: string;
  /** Timeout in milliseconds (default: 300000) */
  timeout?: number;
  /** Environment variables (extends process.env) */
  env?: Record<string, string>;
  /** Fail on warnings (default: false) */
  failOnWarnings?: boolean;
}

// ============================================================
// Result Types
// ============================================================

export interface ComposerResult {
  /** Whether the command succeeded */
  success: boolean;
  /** Exit code from composer */
  exitCode: number | null;
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
  /** Execution time in milliseconds */
  durationMs: number;
  /** Diagnostics (errors/warnings) */
  diagnostics: BuildDiagnostic[];
}

export interface ComposerInstallResult extends ComposerResult {
  /** Whether vendor directory was created */
  vendorInstalled: boolean;
}

export interface ComposerDumpResult extends ComposerResult {
  /** Whether autoloader was generated */
  autoloaderGenerated: boolean;
}

// ============================================================
// Composer Detection
// ============================================================

/**
 * Find the composer executable.
 * Checks common locations and PATH.
 */
export function findComposer(): string {
  // Check environment variable first
  const envPath = process.env.COMPOSER;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  // Check local composer
  const localPaths = [
    'composer.phar',
    'composer',
    'vendor/bin/composer',
  ];

  for (const path of localPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Use system composer
  return 'composer';
}

// ============================================================
// Safe Argument Building
// ============================================================

/**
 * Arguments for composer install with security restrictions.
 */
export function buildInstallArgs(options: {
  noDev?: boolean;
  noScripts?: boolean;
  noPlugins?: boolean;
  preferDist?: boolean;
  optimizeAutoloader?: boolean;
  ignorePlatformReqs?: boolean;
} = {}): string[] {
  const args = ['install', '--no-interaction', '--prefer-dist'];

  if (options.noDev ?? true) args.push('--no-dev');
  if (options.noScripts ?? true) args.push('--no-scripts');
  if (options.noPlugins ?? true) args.push('--no-plugins');
  if (options.optimizeAutoloader ?? true) args.push('--optimize-autoloader');
  if (options.preferDist ?? true) args.push('--prefer-dist');
  if (options.ignorePlatformReqs) args.push('--ignore-platform-reqs');

  return args;
}

/**
 * Arguments for composer dump-autoload.
 */
export function buildDumpArgs(options: {
  optimize?: boolean;
  workingDir?: string;
} = {}): string[] {
  const args: string[] = ['dump-autoload', '--no-interaction'];

  if (options.optimize ?? true) args.push('--optimize');
  if (options.workingDir) args.push('--working-dir', options.workingDir);

  return args;
}

// ============================================================
// Execution
// ============================================================

/**
 * Execute composer with timeout and capture output.
 */
export async function execComposer(
  composerPath: string,
  args: string[],
  options?: ComposerRunnerOptions
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}> {
  const timeout = options?.timeout ?? COMPOSER_TIMEOUT_MS;
  const cwd = options?.workingDirectory ?? process.cwd();

  // Validate working directory exists
  if (!existsSync(cwd)) {
    return {
      stdout: '',
      stderr: '',
      exitCode: null,
      durationMs: 0,
    };
  }

  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = '';
    let stderr = '';

    const spawnOpts: SpawnOptions = {
      cwd,
      timeout,
      env: { ...process.env, ...options?.env },
      shell: true,
    };

    const proc = spawn(composerPath, args, spawnOpts);

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', () => {
      // Ignore spawn errors (e.g., command not found)
    });

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code,
        durationMs: Date.now() - start,
      });
    });

    // Timeout handling
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
        stderr += '\n[TIMEOUT] Process exceeded timeout';
      }
    }, timeout);
  });
}

// ============================================================
// Composer Install
// ============================================================

/**
 * Run composer install with security restrictions.
 *
 * @param workingDir Directory containing composer.json
 * @param options Runner options
 * @returns Install result with diagnostics
 */
export async function composerInstall(
  workingDir: string,
  options?: ComposerRunnerOptions
): Promise<ComposerResult> {
  const diagnostics: BuildDiagnostic[] = [];
  const composerPath = findComposer();
  const start = Date.now();

  // Check if composer.json exists
  const composerJson = join(workingDir, 'composer.json');
  if (!existsSync(composerJson)) {
    diagnostics.push(
      buildWarning(
        BUILD_WARNING_CODES.NO_COMPOSER_LOCK,
        `composer.json not found in ${workingDir}`
      )
    );
    return {
      success: false,
      exitCode: null,
      stdout: '',
      stderr: '',
      durationMs: 0,
      diagnostics,
    };
  }

  // Build install arguments
  const args = buildInstallArgs({
    noDev: true,
    noScripts: true,
    noPlugins: true,
    preferDist: true,
    optimizeAutoloader: true,
  });

  // Execute composer
  const result = await execComposer(composerPath, args, {
    ...options,
    workingDirectory: workingDir,
  });

  // Build diagnostics
  if (result.exitCode !== 0) {
    diagnostics.push(
      buildError(
        BUILD_ERROR_CODES.COMPOSER_INSTALL_FAILED,
        `Composer install failed with exit code ${result.exitCode}`,
        {
          exitCode: result.exitCode,
          stderr: result.stderr.substring(0, 500),
          workingDirectory: workingDir,
        }
      )
    );
  } else if (result.stderr) {
    diagnostics.push(
      buildWarning(
        BUILD_WARNING_CODES.SECURITY_SIGNAL_MEDIUM,
        result.stderr.substring(0, 200)
      )
    );
  }

  // Check if vendor was installed
  const vendorDir = join(workingDir, 'vendor');
  const vendorInstalled = existsSync(vendorDir);

  if (!vendorInstalled && result.exitCode === 0) {
    diagnostics.push(
      buildWarning(
        BUILD_WARNING_CODES.VENDOR_DIR_DETECTED,
        'Composer install succeeded but vendor directory not found'
      )
    );
  }

  return {
    success: result.exitCode === 0 && vendorInstalled,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
    diagnostics,
    vendorInstalled,
  } as ComposerInstallResult & { stdout: string; stderr: string; exitCode: number | null; durationMs: number; diagnostics: BuildDiagnostic[] };
}

// ============================================================
// Composer Dump-Autoload
// ============================================================

/**
 * Run composer dump-autoload to regenerate autoloader.
 *
 * @param workingDir Working directory
 * @param options Runner options
 * @returns Dump result with diagnostics
 */
export async function composerDumpAutoload(
  workingDir: string,
  options?: ComposerRunnerOptions
): Promise<ComposerResult> {
  const diagnostics: BuildDiagnostic[] = [];
  const composerPath = findComposer();
  const result = await execComposer(
    composerPath,
    buildDumpArgs({ optimize: true }),
    { ...options, workingDirectory: workingDir }
  );

  if (result.exitCode !== 0) {
    diagnostics.push(
      buildError(
        BUILD_ERROR_CODES.COMPOSER_INSTALL_FAILED,
        `Composer dump-autoload failed with exit code ${result.exitCode}`,
        {
          exitCode: result.exitCode,
          stderr: result.stderr.substring(0, 500),
        }
      )
    );
  }

  return {
    success: result.exitCode === 0,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
    diagnostics,
  };
}

// ============================================================
// Composer Validation
// ============================================================

export interface ComposerValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Diagnostics from validation */
  diagnostics: BuildDiagnostic[];
  /** Parsed scripts (if found) */
  scripts?: Record<string, string | string[]>;
  /** Parsed autoload config (if found) */
  autoload?: Record<string, unknown>;
}

/**
 * Validate composer.json for build requirements.
 *
 * Does NOT execute composer - only reads and validates.
 *
 * @param workingDir Directory to validate
 * @returns Validation result
 */
export function validateComposer(workingDir: string): ComposerValidationResult {
  const diagnostics: BuildDiagnostic[] = [];
  const composerJson = join(workingDir, 'composer.json');

  if (!existsSync(composerJson)) {
    return { valid: true, diagnostics: [] };
  }

  let content: string;
  try {
    content = readFileSync(composerJson, 'utf-8');
  } catch {
    diagnostics.push(
      buildError(
        BUILD_ERROR_CODES.COMPOSER_JSON_INVALID,
        `Cannot read composer.json`
      )
    );
    return { valid: false, diagnostics };
  }

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (e) {
    diagnostics.push(
      buildError(
        BUILD_ERROR_CODES.COMPOSER_JSON_INVALID,
        `Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`
      )
    );
    return { valid: false, diagnostics };
  }

  if (typeof data !== 'object' || data === null) {
    diagnostics.push(
      buildError(
        BUILD_ERROR_CODES.COMPOSER_JSON_INVALID,
        'composer.json must be an object'
      )
    );
    return { valid: false, diagnostics };
  }

  const obj = data as Record<string, unknown>;

  // Extract relevant fields
  const scripts = typeof obj.scripts === 'object' && obj.scripts !== null
    ? (obj.scripts as Record<string, unknown>)
    : undefined;

  const autoload = typeof obj.autoload === 'object' && obj.autoload !== null
    ? (obj.autoload as Record<string, unknown>)
    : undefined;

  // Warn about scripts
  if (scripts && Object.keys(scripts).length > 0) {
    diagnostics.push(
      buildWarning(
        BUILD_WARNING_CODES.SECURITY_SIGNAL_HIGH,
        `composer.json contains ${Object.keys(scripts).length} script(s) - scripts will be ignored during install`
      )
    );
  }

  return {
    valid: true,
    diagnostics,
    scripts: scripts as Record<string, string | string[]>,
    autoload,
  };
}
