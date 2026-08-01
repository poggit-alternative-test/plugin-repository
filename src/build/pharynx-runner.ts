/**
 * Pharynx Runner
 *
 * Executes Pharynx (PocketMine PHAR builder) in a controlled workspace.
 * Compiles plugin source into a PHAR archive.
 *
 * SECURITY: This module executes external processes. It is intended ONLY for
 * trusted build pipelines where the source has been reviewed and approved.
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';

import {
  BUILD_CODES,
  buildError,
  infrastructureError,
  type BuildDiagnostic,
} from './diagnostics.js';

// ============================================================
// Resource Limits
// ============================================================

export const PHARYNX_RUNNER_LIMITS = {
  /** Default timeout for Pharynx operations (ms) — PHAR compilation can be slow */
  DEFAULT_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes

  /** Maximum stdout/stderr to retain (chars) */
  MAX_OUTPUT_SIZE: 1024 * 1024, // 1 MB

  /** Maximum output PHAR size to validate (bytes) — 50 MB */
  MAX_PHAR_SIZE: 50 * 1024 * 1024,

  /** Minimum output PHAR size — must be non-empty */
  MIN_PHAR_SIZE: 512,
} as const;

// ============================================================
// Configuration
// ============================================================

export interface PharynxRunnerConfig {
  /**
   * Absolute path to the pharynx.phar executable on the build host.
   * The file must already exist — this runner does not download it.
   */
  pharynxPath: string;

  /**
   * Working directory — this is passed to Pharynx as the -i (plugin dir) argument.
   * It is also used as the PHP process working directory.
   */
  pluginDir: string;

  /**
   * Absolute path to the directory where unpacked PHAR contents will be written.
   * If omitted, Pharynx derives the output directory from the -p path.
   * Note: On Windows, using -o with absolute paths can cause issues in some environments.
   */
  outputDir?: string;

  /**
   * Absolute path where the final .phar file will be written.
   * Must end in .phar.
   */
  outputPhar: string;

  /**
   * Timeout for the Pharynx operation in milliseconds.
   * Defaults to 10 minutes.
   */
  timeoutMs?: number;

  /**
   * Path to the PHP binary.
   * Defaults to 'php'.
   */
  phpPath?: string;

  /**
   * When true, infer source paths and antigens from composer.json.
   * This uses the -c flag to Pharynx.
   * Assumes composer install was already run.
   * Defaults to false.
   */
  composerMode?: boolean;

  /**
   * Additional source directories to bundle into the PHAR.
   * Each entry is passed as -s <path> to Pharynx.
   */
  additionalSources?: string[];

  /**
   * Additional files or directories to bundle as assets.
   * Each entry is passed as -f <name>:<path> to Pharynx.
   */
  additionalFiles?: Array<{ name: string; path: string }>;

  /**
   * Additional environment variables.
   * WARNING: Do NOT pass secrets — they would be visible in process listings.
   */
  env?: Record<string, string>;
}

// ============================================================
// Result Types
// ============================================================

export interface PharynxRunResult {
  /** Whether the build succeeded */
  success: boolean;

  /** Plugin directory used */
  pluginDir: string;

  /** Output directory path (unpacked PHAR contents) */
  outputDir: string;

  /** Final PHAR file path */
  outputPhar: string;

  /** Exit code from Pharynx (via PHP), or null if killed by timeout */
  exitCode: number | null;

  /** Elapsed time in milliseconds */
  elapsedMs: number;

  /** Stdout from Pharynx (truncated to MAX_OUTPUT_SIZE) */
  stdout: string;

  /** Stderr from Pharynx (truncated to MAX_OUTPUT_SIZE) */
  stderr: string;

  /** Whether the process was killed due to timeout */
  timedOut: boolean;

  /** PHP version detected from output */
  phpVersion?: string;

  /** Size of the produced PHAR in bytes */
  pharSizeBytes?: number;

  /** Diagnostics emitted during the run */
  diagnostics: BuildDiagnostic[];
}

// ============================================================
// PHP Version Detection
// ============================================================

/**
 * Parse PHP version from version string.
 * Example: "PHP 8.2.10 (cli) ..." -> "8.2.10"
 */
function parsePhpVersion(output: string): string | undefined {
  const match = output.match(/PHP\s+(\d+\.\d+\.\d+)/);
  return match?.[1];
}

// ============================================================
// Output Size Limit Helper
// ============================================================

function truncateOutput(output: string, maxSize: number): string {
  if (output.length <= maxSize) {
    return output;
  }
  return '... [TRUNCATED] ...\n' + output.slice(-(maxSize - 24));
}

// ============================================================
// Version Check
// ============================================================

/**
 * Check PHP availability and version.
 */
export async function checkPhpVersion(
  phpPath: string = 'php'
): Promise<{ success: boolean; version?: string; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(phpPath, ['--version'], {
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
          error: `PHP not found at "${phpPath}" or not in PATH.`,
        });
      } else {
        resolve({ success: false, error: err.message });
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const version = parsePhpVersion(stdout);
        resolve({ success: true, version });
      } else {
        resolve({
          success: false,
          error: stderr || `PHP exited with code ${code}`,
        });
      }
    });

    setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: 'PHP version check timed out' });
    }, 10000);
  });
}

// ============================================================
// Main Runner
// ============================================================

/**
 * Run Pharynx to build a PHAR from plugin source.
 *
 * Constructs and executes the PHP command:
 *   php -dphar.readonly=0 <pharynx.phar> \
 *     -i <pluginDir> \
 *     -o <outputDir> \
 *     -p=<outputPhar> \
 *     [-c] \
 *     [-s <additionalSource>...] \
 *     [-f <name>:<path>...]
 *
 * @param config - Runner configuration
 * @returns Structured result with diagnostics
 */
export async function runPharynx(
  config: PharynxRunnerConfig
): Promise<PharynxRunResult> {
  const diagnostics: BuildDiagnostic[] = [];
  const startTime = Date.now();
  const timeoutMs = config.timeoutMs ?? PHARYNX_RUNNER_LIMITS.DEFAULT_TIMEOUT_MS;

  const pharynxPath = config.pharynxPath;
  const pluginDir = config.pluginDir;
  const outputDir = config.outputDir;
  const outputPhar = config.outputPhar;
  const phpBinary = config.phpPath ?? 'php';

  // ─── Input Validation (synchronous, before any async operations) ────

  // Check pluginDir
  if (!pluginDir || pluginDir.trim() === '') {
    diagnostics.push(
      buildError(
        BUILD_CODES.PHARYNX_NO_PLUGIN_DIR,
        'Plugin directory is empty'
      )
    );
  }

  // Check pluginDir exists (if provided)
  if (pluginDir && pluginDir.trim() !== '' && !existsSync(pluginDir)) {
    diagnostics.push(
      buildError(
        BUILD_CODES.PHARYNX_PLUGIN_DIR_NOT_FOUND,
        `Plugin directory does not exist: ${pluginDir}`,
        { pluginDir }
      )
    );
  }

  // Check pharynxPath
  if (!existsSync(pharynxPath)) {
    diagnostics.push(
      infrastructureError(
        BUILD_CODES.PHARYNX_NOT_FOUND,
        `Pharynx not found at "${pharynxPath}". Ensure the Build Host has pharynx.phar installed.`,
        { pharynxPath }
      )
    );
  } else {
    try {
      const stats = statSync(pharynxPath);
      if (!stats.isFile()) {
        diagnostics.push(
          buildError(
            BUILD_CODES.PHARYNX_NOT_FOUND,
            `Pharynx path is not a file: ${pharynxPath}`
          )
        );
      }
    } catch (e) {
      diagnostics.push(
        infrastructureError(
          BUILD_CODES.PHARYNX_NOT_FOUND,
          `Cannot stat pharynx path: ${e instanceof Error ? e.message : 'Unknown error'}`
        )
      );
    }
  }

  // ─── PHP Binary Check ──────────────────────────────────────

  const phpVersion = await checkPhpVersion(phpBinary);
  if (!phpVersion.success) {
    diagnostics.push(
      infrastructureError(
        BUILD_CODES.PHP_NOT_FOUND,
        `PHP not found at "${phpBinary}" or not in PATH: ${phpVersion.error}`,
        { phpPath: phpBinary }
      )
    );
    return {
      success: false,
      pluginDir,
      outputDir,
      outputPhar,
      exitCode: null,
      elapsedMs: Date.now() - startTime,
      stdout: '',
      stderr: '',
      timedOut: false,
      diagnostics,
    };
  }

  // ─── Return early if input validation already failed ─────────

  if (diagnostics.length > 0) {
    return {
      success: false,
      pluginDir,
      outputDir,
      outputPhar,
      exitCode: null,
      elapsedMs: Date.now() - startTime,
      stdout: '',
      stderr: '',
      timedOut: false,
      phpVersion: phpVersion.version,
      diagnostics,
    };
  }

  // ─── Output Directory Setup ─────────────────────────────
  //
  // When outputDir is provided, ensure it exists. When omitted, Pharynx manages the directory.
  if (outputDir) {
    try {
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
    } catch (e) {
      diagnostics.push(
        infrastructureError(
          BUILD_CODES.PHARYNX_OUTPUT_DIR_CREATION_FAILED,
          `Failed to create output directory "${outputDir}": ${e instanceof Error ? e.message : 'Unknown error'}`,
          { outputDir }
        )
      );
      return {
        success: false,
        pluginDir,
        outputDir,
        outputPhar,
        exitCode: null,
        elapsedMs: Date.now() - startTime,
        stdout: '',
        stderr: '',
        timedOut: false,
        diagnostics,
      };
    }
  }

  // ─── Build Environment ───────────────────────────────────

  // Build clean environment — NO secrets
  const env: Record<string, string> = {
    ...process.env,
    ...config.env,
  };

  // ─── Build Command Arguments ──────────────────────────────
  //
  // Matches the contract from SOF3/pharynx gh-action:
  //   php -dphar.readonly=0 <pharynx> -i <pluginDir> [-o <outputDir>] -p=<outputPhar> [-c] [-s <src>...]
  //
  // Note: outputDir is optional. When omitted, Pharynx derives the output directory
  // from the -p path. This avoids path-escaping issues on Windows with absolute paths.

  const args: string[] = [
    // Disable PHAR read-only mode — required for PHAR creation
    '-dphar.readonly=0',
    // Pharynx executable
    pharynxPath,
    // Plugin source directory
    '-i', pluginDir,
  ];

  // Output directory (unpacked contents). Omit if not specified —
  // Pharynx will derive it from the -p path.
  if (outputDir) {
    args.push('-o', outputDir);
  }

  // Output PHAR path (packed archive)
  args.push(`-p=${outputPhar}`);

  // Composer mode: infer virion paths from composer.json
  if (config.composerMode) {
    args.push('-c');
  }

  // Additional source directories
  if (config.additionalSources && config.additionalSources.length > 0) {
    for (const source of config.additionalSources) {
      args.push('-s', source);
    }
  }

  // Additional files (named assets like icon.png)
  if (config.additionalFiles && config.additionalFiles.length > 0) {
    for (const { name, path } of config.additionalFiles) {
      args.push('-f', `${name}:${path}`);
    }
  }

  // ─── Execute ────────────────────────────────────────────

  return new Promise<PharynxRunResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(phpBinary, args, {
      cwd: pluginDir,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > PHARYNX_RUNNER_LIMITS.MAX_OUTPUT_SIZE * 2) {
        stdout = truncateOutput(stdout, PHARYNX_RUNNER_LIMITS.MAX_OUTPUT_SIZE);
        diagnostics.push(
          buildError(
            BUILD_CODES.PHARYNX_RUN_FAILED,
            `Pharynx stdout exceeded ${PHARYNX_RUNNER_LIMITS.MAX_OUTPUT_SIZE} bytes and was truncated`
          )
        );
      }
    });

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > PHARYNX_RUNNER_LIMITS.MAX_OUTPUT_SIZE * 2) {
        stderr = truncateOutput(stderr, PHARYNX_RUNNER_LIMITS.MAX_OUTPUT_SIZE);
      }
    });

    // Handle process errors
    proc.on('error', (err) => {
      const elapsedMs = Date.now() - startTime;

      if (err.message.includes('ENOENT') || err.message.includes('spawn') || err.message.includes('not found')) {
        // Check which binary was not found
        if (err.message.includes(phpBinary)) {
          diagnostics.push(
            infrastructureError(
              BUILD_CODES.PHP_NOT_FOUND,
              `PHP not found at "${phpBinary}" or not in PATH.`,
              { error: err.message }
            )
          );
        } else {
          diagnostics.push(
            infrastructureError(
              BUILD_CODES.PHARYNX_NOT_FOUND,
              `Failed to start Pharynx: ${err.message}`,
              { error: err.message }
            )
          );
        }
      } else if (err.message.includes('EACCES') || err.message.includes('permission denied')) {
        diagnostics.push(
          infrastructureError(
            BUILD_CODES.PHARYNX_PERMISSION_DENIED,
            `Permission denied: ${err.message}`,
            { error: err.message }
          )
        );
      } else {
        diagnostics.push(
          infrastructureError(
            BUILD_CODES.PHARYNX_RUN_FAILED,
            `Failed to start Pharynx: ${err.message}`,
            { error: err.message }
          )
        );
      }

      resolve({
        success: false,
        pluginDir,
        outputDir: outputDir ?? outputPhar ?? '',
        outputPhar,
        exitCode: null,
        elapsedMs,
        stdout: truncateOutput(stdout, PHARYNX_RUNNER_LIMITS.MAX_OUTPUT_SIZE),
        stderr: truncateOutput(stderr, PHARYNX_RUNNER_LIMITS.MAX_OUTPUT_SIZE),
        timedOut: false,
        diagnostics,
      });
    });

    // Handle exit
    proc.on('close', (code) => {
      const elapsedMs = Date.now() - startTime;
      const exitCode = code;

      stdout = truncateOutput(stdout, PHARYNX_RUNNER_LIMITS.MAX_OUTPUT_SIZE);
      stderr = truncateOutput(stderr, PHARYNX_RUNNER_LIMITS.MAX_OUTPUT_SIZE);

      const combinedOutput = stdout + stderr;
      const detectedPhpVersion = parsePhpVersion(combinedOutput) ?? phpVersion.version;

      // Check for "not found" patterns from stderr (Windows shell behavior)
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
            BUILD_CODES.PHARYNX_NOT_FOUND,
            `Pharynx not found at "${pharynxPath}". Check the Build Host installation.`,
            { stderr: stderr.slice(0, 500) }
          )
        );
      } else if (exitCode !== 0) {
        diagnostics.push(
          buildError(
            BUILD_CODES.PHARYNX_INVALID_EXIT_CODE,
            `Pharynx exited with code ${exitCode} (expected 0). Check output for errors.`,
            { exitCode }
          )
        );
      }

      // ─── Output Validation ──────────────────────────────

      let pharSizeBytes: number | undefined;

      if (exitCode === 0) {
        // Verify the output PHAR was actually created
        if (!existsSync(outputPhar)) {
          diagnostics.push(
            buildError(
              BUILD_CODES.PHARYNX_OUTPUT_PHAR_MISSING,
              `Pharynx reported success (exit 0) but output PHAR was not found at "${outputPhar}"`,
              { outputPhar }
            )
          );
        } else {
          try {
            const pharStats = statSync(outputPhar);
            pharSizeBytes = pharStats.size;

            // Size sanity checks
            if (pharSizeBytes < PHARYNX_RUNNER_LIMITS.MIN_PHAR_SIZE) {
              diagnostics.push(
                buildError(
                  BUILD_CODES.PHARYNX_OUTPUT_PHAR_MISSING,
                  `Output PHAR is suspiciously small (${pharSizeBytes} bytes). It may be empty or corrupt.`
                )
              );
            } else if (pharSizeBytes > PHARYNX_RUNNER_LIMITS.MAX_PHAR_SIZE) {
              diagnostics.push(
                buildError(
                  BUILD_CODES.PHARYNX_RUN_FAILED,
                  `Output PHAR exceeds maximum size (${pharSizeBytes} > ${PHARYNX_RUNNER_LIMITS.MAX_PHAR_SIZE} bytes)`
                )
              );
            }
          } catch (e) {
            diagnostics.push(
              buildError(
                BUILD_CODES.PHARYNX_OUTPUT_PHAR_MISSING,
                `Could not stat output PHAR "${outputPhar}": ${e instanceof Error ? e.message : 'Unknown error'}`
              )
            );
          }
        }

        // Verify output directory has contents (only when outputDir was explicitly provided)
        if (outputDir) {
          try {
            const outputEntries = readdirSync(outputDir);
            if (outputEntries && Array.isArray(outputEntries) && outputEntries.length === 0) {
              diagnostics.push(
                buildError(
                  BUILD_CODES.PHARYNX_RUN_FAILED,
                  `Output directory "${outputDir}" is empty. Pharynx may have failed silently.`
                )
              );
            }
          } catch {
            // Directory listing failure is non-fatal when outputDir is managed by Pharynx
          }
        }
      }

      const success = exitCode === 0 && !timedOut && !diagnostics.some(
        (d) => d.code === BUILD_CODES.PHARYNX_OUTPUT_PHAR_MISSING
      );

      resolve({
        success,
        pluginDir,
        outputDir,
        outputPhar,
        exitCode,
        elapsedMs,
        stdout,
        stderr,
        timedOut,
        phpVersion: detectedPhpVersion,
        pharSizeBytes,
        diagnostics,
      });
    });

    // ─── Timeout Handler ──────────────────────────────────

    setTimeout(() => {
      timedOut = true;

      try {
        proc.kill('SIGTERM');
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

      // Clean up the output directory on timeout
      try {
        if (existsSync(outputDir)) {
          rmSync(outputDir, { recursive: true, force: true });
        }
      } catch {}

      diagnostics.push(
        infrastructureError(
          BUILD_CODES.PHARYNX_TIMEOUT,
          `Pharynx build timed out after ${timeoutMs}ms`,
          { timeoutMs, elapsedMs: Date.now() - startTime }
        )
      );
    }, timeoutMs);
  });
}
