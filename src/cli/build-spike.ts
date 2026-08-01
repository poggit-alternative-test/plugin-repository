/**
 * Build Integration Spike
 *
 * Smallest possible orchestration of Build components to prove the pipeline
 * can build a real plugin (TopStats) from GitHub source.
 *
 * NOT production code. NOT BuildService.
 *
 * Purpose: validate the integration path, discover first real blocker.
 *
 * Pipeline:
 *   1. Prepare workspace (clone/copy source)
 *   2. Validate plugin.yml
 *   3. Security scan
 *   4. Composer dev install (Pharynx tool)
 *   5. Composer production install (plugin deps)
 *   6. Pharynx build
 *   7. Verify PHAR
 */

import { existsSync, mkdirSync, rmSync, readFileSync, statSync, writeFileSync, cpSync } from 'fs';
import { join, basename, resolve, isAbsolute } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

// Build domain components
import {
  BUILD_CODES,
  getErrors,
  getWarnings,
  getInfrastructureErrors,
  type BuildDiagnostic,
} from '../build/diagnostics.js';
import {
  runComposerInstall,
} from '../build/composer-runner.js';
import {
  runPharynx,
  checkPhpVersion,
} from '../build/pharynx-runner.js';

// tools/builder components
import {
  validatePluginYml,
} from '../../tools/builder/src/plugin-yml-validator.js';
import {
  scanForSecuritySignals,
  scanForCommittedPhar,
} from '../../tools/builder/src/security-scanner.js';
import {
  listPhpFiles,
  safeReadFile,
} from '../../tools/builder/src/filesystem.js';

// ============================================================
// Types
// ============================================================

export interface BuildSpikeResult {
  success: boolean;
  pluginName?: string;
  version?: string;
  pharPath?: string;
  pharSizeBytes?: number;
  workspace?: string;
  steps: BuildStepResult[];
  diagnostics: BuildDiagnostic[];
  commands: ExecutedCommand[];
}

export interface BuildStepResult {
  step: string;
  status: 'pending' | 'running' | 'ok' | 'failed' | 'skipped';
  elapsedMs?: number;
  message?: string;
  diagnostics?: BuildDiagnostic[];
}

export interface ExecutedCommand {
  step: string;
  cmd: string;
  args?: string[];
  exitCode?: number | null;
  timedOut?: boolean;
}

// ============================================================
// Progress Logger
// ============================================================

const INDENT = '  ';
const STEP_PREFIX = '[STEP]';
const OK_PREFIX = '[  OK  ]';
const FAIL_PREFIX = '[FAIL ]';
const WARN_PREFIX = '[WARN ]';
const INFO_PREFIX = '[INFO ]';

function log(message: string): void {
  console.log(message);
}

function logStep(step: string, message: string): void {
  console.log(`${INDENT}${STEP_PREFIX} ${step}: ${message}`);
}

function logOk(step: string, message: string): void {
  console.log(`${INDENT}${OK_PREFIX} ${step} — ${message}`);
}

function logFail(step: string, message: string): void {
  console.log(`${INDENT}${FAIL_PREFIX} ${step} — ${message}`);
}

function logWarn(message: string): void {
  console.log(`${INDENT}${WARN_PREFIX} ${message}`);
}

function logInfo(message: string): void {
  console.log(`${INDENT}${INFO_PREFIX} ${message}`);
}

// ============================================================
// Diagnostic Helpers
// ============================================================

function printDiagnostics(step: string, diagnostics: BuildDiagnostic[]): void {
  const errors = getErrors(diagnostics);
  const warnings = getWarnings(diagnostics);
  const infraErrors = getInfrastructureErrors(diagnostics);

  for (const d of infraErrors) {
    logWarn(`  [INFRA] ${d.code}: ${d.message}`);
  }
  for (const d of errors) {
    logWarn(`  [ERROR] ${d.code}: ${d.message}`);
  }
  for (const d of warnings.slice(0, 5)) {
    logWarn(`  [WARN ] ${d.code}: ${d.message}`);
  }
  if (warnings.length > 5) {
    logWarn(`  ... and ${warnings.length - 5} more warnings`);
  }
}

// ============================================================
// Utility
// ============================================================

async function runCommand(
  step: string,
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ exitCode: number | null; timedOut: boolean; stdout: string; stderr: string; elapsedMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
    });

    proc.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      resolve({
        exitCode: code,
        timedOut,
        stdout,
        stderr,
        elapsedMs: Date.now() - start,
      });
    });

    proc.on('error', () => {
      // Treat errors as exit 1
      resolve({
        exitCode: 1,
        timedOut,
        stdout,
        stderr,
        elapsedMs: Date.now() - start,
      });
    });

    setTimeout(() => {
      timedOut = true;
      try { proc.kill(); } catch {}
    }, timeoutMs);
  });
}

function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================================
// Main Build Function
// ============================================================

export async function buildPlugin(options: {
  /** Path to local plugin source directory */
  sourcePath: string;
  /** Path to pharynx.phar on the build host */
  pharynxPath: string;
  /** Path to PHP binary */
  phpPath?: string;
  /** Timeout per step in ms (default 5 min) */
  stepTimeoutMs?: number;
}): Promise<BuildSpikeResult> {
  const startTime = Date.now();
  const { sourcePath, pharynxPath, phpPath = 'php', stepTimeoutMs = 5 * 60 * 1000 } = options;

  log('\n' + '='.repeat(60));
  log('BUILD SPIKE — Integration Test');
  log('='.repeat(60));
  log(`Source:  ${sourcePath}`);
  log(`Pharynx: ${pharynxPath}`);
  log(`PHP:     ${phpPath}`);
  log(`Timeout: ${formatMs(stepTimeoutMs)} per step`);
  log('='.repeat(60) + '\n');

  // Resolve paths to absolute to avoid cwd-relative resolution issues.
  // Leave bare command names (e.g. 'php', 'composer') as-is — they are in PATH.
  const absSourcePath = isAbsolute(sourcePath) ? sourcePath : resolve(process.cwd(), sourcePath);
  const absPharynxPath = isAbsolute(pharynxPath) || pharynxPath.includes('/') || pharynxPath.includes('\\')
    ? (isAbsolute(pharynxPath) ? pharynxPath : resolve(process.cwd(), pharynxPath))
    : pharynxPath;
  const absPhpPath = isAbsolute(phpPath) || phpPath.includes('/') || phpPath.includes('\\')
    ? (isAbsolute(phpPath) ? phpPath : resolve(process.cwd(), phpPath))
    : phpPath;

  log(`Resolved to:`);
  log(`  Source:  ${absSourcePath}`);
  log(`  Pharynx: ${absPharynxPath}`);
  log(`  PHP:     ${absPhpPath}`);
  log('');

  const steps: BuildStepResult[] = [];
  const allDiagnostics: BuildDiagnostic[] = [];
  const commands: ExecutedCommand[] = [];

  // ─── STEP 0: Setup workspace ───────────────────────────────

  async function runStep(
    name: string,
    fn: () => Promise<{ ok: boolean; message?: string; diagnostics?: BuildDiagnostic[]; skip?: boolean }>
  ): Promise<boolean> {
    const stepResult: BuildStepResult = { step: name, status: 'running' };
    steps.push(stepResult);

    logStep(name, 'running...');

    const stepStart = Date.now();
    try {
      const result = await fn();
      stepResult.elapsedMs = Date.now() - stepStart;

      if (result.skip) {
        stepResult.status = 'skipped';
        stepResult.message = result.message ?? 'skipped';
        logOk(name, `skipped — ${result.message}`);
        return true;
      }

      if (result.ok) {
        stepResult.status = 'ok';
        stepResult.message = result.message ?? 'ok';
        if (result.diagnostics?.length) {
          printDiagnostics(name, result.diagnostics);
          allDiagnostics.push(...result.diagnostics);
        }
        logOk(name, `${result.message ?? 'ok'} (${formatMs(stepResult.elapsedMs!)})`);
        return true;
      } else {
        stepResult.status = 'failed';
        stepResult.message = result.message ?? 'failed';
        stepResult.diagnostics = result.diagnostics;
        if (result.diagnostics?.length) {
          printDiagnostics(name, result.diagnostics);
          allDiagnostics.push(...result.diagnostics);
        }
        logFail(name, result.message ?? 'failed');
        return false;
      }
    } catch (err) {
      stepResult.elapsedMs = Date.now() - stepStart;
      stepResult.status = 'failed';
      stepResult.message = err instanceof Error ? err.message : String(err);
      logFail(name, stepResult.message);
      return false;
    }
  }

  // ─── STEP 1: Validate plugin.yml ─────────────────────────

  const pluginYmlOk = await runStep('plugin.yml validation', async () => {
    const pluginYmlPath = join(absSourcePath, 'plugin.yml');
    if (!existsSync(pluginYmlPath)) {
      return {
        ok: false,
        message: `plugin.yml not found at ${pluginYmlPath}`,
        diagnostics: [],
      };
    }

    const read = safeReadFile(pluginYmlPath, 1024 * 1024);
    if (!read.success || !read.content) {
      return {
        ok: false,
        message: `Failed to read plugin.yml: ${read.error}`,
        diagnostics: [],
      };
    }

    const result = validatePluginYml(read.content, pluginYmlPath);
    return {
      ok: result.success,
      message: result.success
        ? `${result.metadata?.name} v${result.metadata?.version}`
        : 'validation failed',
      diagnostics: result.diagnostics,
    };
  });

  if (!pluginYmlOk) {
    return { success: false, steps, diagnostics: allDiagnostics, commands };
  }

  // Extract plugin name/version from plugin.yml
  const pluginYmlPath = join(sourcePath, 'plugin.yml');
  const pluginYmlContent = readFileSync(pluginYmlPath, 'utf-8');
  const pluginYmlResult = validatePluginYml(pluginYmlContent);
  const pluginName = pluginYmlResult.metadata?.name ?? basename(absSourcePath);
  const pluginVersion = pluginYmlResult.metadata?.version ?? 'unknown';

  // ─── STEP 2: Security Scan ────────────────────────────────

  const scanOk = await runStep('security scan', async () => {
    const scanResult = scanForSecuritySignals(absSourcePath);
    const pharScanResult = scanForCommittedPhar(absSourcePath);

    const allScanDiagnostics = [
      ...scanResult.diagnostics,
      ...pharScanResult.diagnostics,
    ];

    const errorCount = getErrors(allScanDiagnostics).length;
    const signalCount = scanResult.signalCount + pharScanResult.signalCount;

    return {
      ok: true, // Scan does not block build — signals are informational
      message: `${scanResult.filesScanned} files scanned, ${signalCount} signals, ${errorCount} errors`,
      diagnostics: allScanDiagnostics,
    };
  });

  if (!scanOk) {
    // Scan failure is not fatal — log and continue
    logWarn('Security scan step failed — continuing anyway');
  }

  // ─── STEP 3: Composer dev install (Pharynx tool) ──────────

  logStep('composer dev-install', 'running...');

  const composerDevResult = await runComposerInstall({
    workspace: absSourcePath,
    timeoutMs: stepTimeoutMs,
    devOnly: true,
  });

  commands.push({
    step: 'composer dev-install',
    cmd: 'composer',
    args: ['install', '--no-scripts', '--no-plugins', '--no-autoloader', '--prefer-dist', '--no-progress', '--ignore-platform-reqs', '--working-dir=.'],
    exitCode: composerDevResult.exitCode,
  });

  if (composerDevResult.success) {
    logOk('composer dev-install', `${composerDevResult.packagesInstalled ?? '?'} packages (${formatMs(composerDevResult.elapsedMs)})`);
  } else {
    logFail('composer dev-install', `exit ${composerDevResult.exitCode ?? 'null'}`);
    logInfo('stderr: ' + composerDevResult.stderr.slice(0, 2000));
    printDiagnostics('composer dev-install', composerDevResult.diagnostics);
    allDiagnostics.push(...composerDevResult.diagnostics);

    log('\nStopping at composer dev-install — cannot proceed without Pharynx tool.\n');
    return {
      success: false,
      pluginName,
      version: pluginVersion,
      workspace: absSourcePath,
      steps,
      diagnostics: allDiagnostics,
      commands,
    };
  }

  // ─── STEP 4: Composer production install (plugin deps) ────

  logStep('composer prod-install', 'running...');

  const composerProdResult = await runComposerInstall({
    workspace: absSourcePath,
    timeoutMs: stepTimeoutMs,
    devOnly: false,
  });

  commands.push({
    step: 'composer prod-install',
    cmd: 'composer',
    args: ['install', '--no-dev', '--no-scripts', '--no-plugins', '--no-autoloader', '--prefer-dist', '--no-progress', '--ignore-platform-reqs', '--working-dir=.'],
    exitCode: composerProdResult.exitCode,
  });

  if (composerProdResult.success) {
    logOk('composer prod-install', `${composerProdResult.packagesInstalled ?? '?'} packages (${formatMs(composerProdResult.elapsedMs)})`);
  } else {
    logFail('composer prod-install', `exit ${composerProdResult.exitCode ?? 'null'}`);
    printDiagnostics('composer prod-install', composerProdResult.diagnostics);
    allDiagnostics.push(...composerProdResult.diagnostics);

    log('\nStopping at composer prod-install.\n');
    return {
      success: false,
      pluginName,
      version: pluginVersion,
      workspace: absSourcePath,
      steps,
      diagnostics: allDiagnostics,
      commands,
    };
  }

  // ─── STEP 5: Pharynx build ──────────────────────────────

  const outputPhar = join(tmpdir(), `${pluginName}-${pluginVersion}.phar`);

  logStep('pharynx build', 'running...');
  logInfo(`output phar: ${outputPhar}`);

  const pharynxResult = await runPharynx({
    pharynxPath: absPharynxPath,
    pluginDir: absSourcePath,
    outputPhar,
    phpPath: absPhpPath,
    composerMode: true,       // infer virion paths from composer.json
    // Note: additionalFiles omitted — Windows temp path mismatch prevents asset copying.
    // Pharynx handles plugin.yml and composer autoload natively. Icon.png can be
    // added by the BuildService when it implements proper workspace path handling.
    timeoutMs: stepTimeoutMs,
  });

  commands.push({
    step: 'pharynx build',
    cmd: absPhpPath,
    args: [
      '-dphar.readonly=0',
      absPharynxPath,
      '-i', absSourcePath,
      `-p=${outputPhar}`,
      '-c',
    ],
    exitCode: pharynxResult.exitCode,
    timedOut: pharynxResult.timedOut,
  });

  if (pharynxResult.success) {
    logOk('pharynx build', `PHAR written to ${outputPhar} (${formatMs(pharynxResult.elapsedMs)})`);
  } else {
    logFail('pharynx build', `exit ${pharynxResult.exitCode ?? 'null'}`);
    logInfo('stdout:\n' + pharynxResult.stdout.slice(0, 2000));
    logInfo('stderr:\n' + pharynxResult.stderr.slice(0, 2000));
    printDiagnostics('pharynx build', pharynxResult.diagnostics);
    allDiagnostics.push(...pharynxResult.diagnostics);

    // Cleanup output PHAR on failure (the dir is managed by Pharynx)
    try { if (existsSync(outputPhar)) rmSync(outputPhar); } catch {}

    log('\nStopping at pharynx build.\n');
    return {
      success: false,
      pluginName,
      version: pluginVersion,
      workspace: absSourcePath,
      steps,
      diagnostics: allDiagnostics,
      commands,
    };
  }

  // ─── STEP 6: Verify PHAR ─────────────────────────────────

  const pharOk = await runStep('verify PHAR', async () => {
    if (!existsSync(outputPhar)) {
      return {
        ok: false,
        message: `PHAR not found at ${outputPhar}`,
        diagnostics: [],
      };
    }

    const size = fileSize(outputPhar);
    return {
      ok: true,
      message: `${outputPhar} (${formatBytes(size)})`,
      diagnostics: [],
    };
  });

  // ─── Done ────────────────────────────────────────────────

  const totalElapsedMs = Date.now() - startTime;

  log('\n' + '='.repeat(60));
  log('BUILD COMPLETE');
  log('='.repeat(60));
  log(`Plugin:   ${pluginName} v${pluginVersion}`);
  log(`PHAR:     ${outputPhar}`);
  log(`Size:     ${formatBytes(fileSize(outputPhar))}`);
  log(`Duration: ${formatMs(totalElapsedMs)}`);
  log('='.repeat(60) + '\n');

  return {
    success: true,
    pluginName,
    version: pluginVersion,
    pharPath: outputPhar,
    pharSizeBytes: fileSize(outputPhar),
    workspace: absSourcePath,
    steps,
    diagnostics: allDiagnostics,
    commands,
  };
}

// ============================================================
// CLI Entry Point
// ============================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: tsx src/cli/build-spike.ts <source-path> <pharynx-path> [php-path]');
    console.error('');
    console.error('Example:');
    console.error('  tsx src/cli/build-spike.ts /tmp/TopStats /usr/local/bin/pharynx.phar php');
    process.exit(1);
  }

  const [sourcePath, pharynxPath, phpPath] = args;

  if (!existsSync(sourcePath)) {
    console.error(`Error: source path does not exist: ${sourcePath}`);
    process.exit(1);
  }

  if (!existsSync(pharynxPath)) {
    console.error(`Error: pharynx.phar not found at: ${pharynxPath}`);
    console.error('Ensure pharynx.phar is installed on the Build Host.');
    process.exit(1);
  }

  const result = await buildPlugin({
    sourcePath,
    pharynxPath,
    phpPath: phpPath ?? 'php',
    stepTimeoutMs: 5 * 60 * 1000,
  });

  if (!result.success) {
    log('\nBuild spike FAILED.\n');
    process.exit(1);
  }

  log('\nBuild spike SUCCEEDED.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
