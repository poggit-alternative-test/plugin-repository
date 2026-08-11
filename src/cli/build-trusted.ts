/**
 * Build Trusted CLI
 *
 * Command-line interface for the GitHub Actions trusted build workflow.
 * This CLI orchestrates the Build domain components without duplicating logic.
 *
 * Usage:
 *   tsx src/cli/build-trusted.ts --source <path> --pharynx <pharynx-path> [--php <php-path>]
 *
 * Inputs:
 *   --source: Path to checked-out plugin source (required)
 *   --pharynx: Path to pharynx.phar on the build host (required)
 *   --php: Path to PHP binary (optional, defaults to 'php')
 *
 * Outputs:
 *   JSON result to stdout for workflow consumption
 *   Exit code 0 on success, 1 on failure
 *
 * This CLI is the single entry point for GitHub Actions builds.
 * All Build logic stays in the src/build/ and tools/builder/ packages.
 */

import { existsSync, mkdirSync, rmSync, statSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

import {
  runComposerInstall,
} from '../build/composer-runner.js';
import {
  runPharynx,
} from '../build/pharynx-runner.js';
import {
  validatePluginYml,
} from '../../tools/builder/src/plugin-yml-validator.js';
import {
  scanForSecuritySignals,
  scanForCommittedPhar,
} from '../../tools/builder/src/security-scanner.js';
import {
  BUILD_CODES,
  getErrors,
  getWarnings,
  getInfrastructureErrors,
  hasErrors,
  hasInfrastructureErrors,
  type BuildDiagnostic,
} from '../build/diagnostics.js';

// ============================================================
// Types
// ============================================================

interface BuildTrustedResult {
  success: boolean;
  pluginName: string;
  pluginVersion: string;
  pharPath: string;
  pharSizeBytes: number;
  sha256: string;
  checksums: {
    sha256: string;
  };
  diagnostics: {
    errors: BuildDiagnostic[];
    warnings: BuildDiagnostic[];
    infraErrors: BuildDiagnostic[];
    all: BuildDiagnostic[];
  };
  steps: {
    validatePluginYml: StepResult;
    securityScan: StepResult;
    composerDevInstall: StepResult;
    composerProdInstall: StepResult;
    pharynxBuild: StepResult;
    verifyPhar: StepResult;
    computeChecksums: StepResult;
  };
  elapsedMs: number;
}

interface StepResult {
  status: 'ok' | 'failed' | 'skipped';
  elapsedMs?: number;
  message?: string;
  errorCount?: number;
  warningCount?: number;
}

// ============================================================
// Argument Parsing
// ============================================================

function parseArgs(): { source: string; pharynx: string; php: string } | null {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = 'true';
      }
    }
  }

  if (!parsed.source || !parsed.pharynx) {
    return null;
  }

  return {
    source: parsed.source,
    pharynx: parsed.pharynx,
    php: parsed.php || 'php',
  };
}

// ============================================================
// Diagnostic Helpers
// ============================================================

function printDiagnostics(prefix: string, diagnostics: BuildDiagnostic[]): void {
  for (const d of diagnostics) {
    const severity = d.severity === 'error' ? 'ERROR' :
                     d.severity === 'infrastructure_error' ? 'INFRA' : 'WARN';
    console.error(`[${prefix}] [${severity}] ${d.code}: ${d.message}`);
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================================
// Step Runner
// ============================================================

async function runStep<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; step: StepResult }> {
  const start = Date.now();
  let status: StepResult['status'] = 'ok';
  let message: string | undefined;

  try {
    const result = await fn();
    const elapsedMs = Date.now() - start;

    const diagnostics = 'diagnostics' in result && Array.isArray(result.diagnostics)
      ? result.diagnostics as BuildDiagnostic[]
      : [];

    const errorCount = getErrors(diagnostics).length;
    const warningCount = getWarnings(diagnostics).length;
    const infraErrorCount = getInfrastructureErrors(diagnostics).length;

    if (hasErrors(diagnostics) || hasInfrastructureErrors(diagnostics)) {
      status = 'failed';
      message = `${errorCount} error(s), ${infraErrorCount} infra error(s)`;
    } else {
      message = `completed in ${formatMs(elapsedMs)}${warningCount > 0 ? ` (${warningCount} warning(s))` : ''}`;
    }

    if (diagnostics.length > 0) {
      printDiagnostics(name, diagnostics);
    }

    return {
      result,
      step: { status, elapsedMs, message, errorCount, warningCount },
    };
  } catch (err) {
    const elapsedMs = Date.now() - start;
    status = 'failed';
    message = err instanceof Error ? err.message : String(err);
    console.error(`[${name}] FAILED: ${message}`);

    return {
      result: {} as T,
      step: { status, elapsedMs, message },
    };
  }
}

// ============================================================
// Main Build Function
// ============================================================

async function buildTrusted(options: {
  sourcePath: string;
  pharynxPath: string;
  phpPath: string;
}): Promise<BuildTrustedResult> {
  const { sourcePath, pharynxPath, phpPath } = options;
  const startTime = Date.now();

  // Resolve paths
  const absSourcePath = isAbsolute(sourcePath) ? sourcePath : resolve(process.cwd(), sourcePath);
  const absPharynxPath = isAbsolute(pharynxPath) ? pharynxPath : resolve(process.cwd(), pharynxPath);
  const absPhpPath = isAbsolute(phpPath) ? phpPath : resolve(process.cwd(), phpPath);

  console.log(`[build-trusted] Source: ${absSourcePath}`);
  console.log(`[build-trusted] Pharynx: ${absPharynxPath}`);
  console.log(`[build-trusted] PHP: ${absPhpPath}`);

  // Initialize result structure
  const steps: BuildTrustedResult['steps'] = {
    validatePluginYml: { status: 'skipped' },
    securityScan: { status: 'skipped' },
    composerDevInstall: { status: 'skipped' },
    composerProdInstall: { status: 'skipped' },
    pharynxBuild: { status: 'skipped' },
    verifyPhar: { status: 'skipped' },
    computeChecksums: { status: 'skipped' },
  };

  const allDiagnostics: BuildDiagnostic[] = [];
  let pluginName = 'unknown';
  let pluginVersion = 'unknown';
  let pharPath = '';
  let pharSizeBytes = 0;
  let sha256 = '';

  // ─── STEP 1: Validate plugin.yml ─────────────────────────

  console.log('\n[build-trusted] === Step 1: Validate plugin.yml ===');

  const pluginYmlPath = join(absSourcePath, 'plugin.yml');
  if (!existsSync(pluginYmlPath)) {
    console.error(`[build-trusted] FATAL: plugin.yml not found at ${pluginYmlPath}`);
    return {
      success: false,
      pluginName,
      pluginVersion,
      pharPath: '',
      pharSizeBytes: 0,
      sha256: '',
      checksums: { sha256: '' },
      diagnostics: {
        errors: [{ code: 'PLUGIN_YML_NOT_FOUND' as BuildDiagnostic['code'], severity: 'error' as const, message: `plugin.yml not found at ${pluginYmlPath}` }],
        warnings: [],
        infraErrors: [],
        all: [],
      },
      steps,
      elapsedMs: Date.now() - startTime,
    };
  }

  const pluginYmlContent = readFileSync(pluginYmlPath, 'utf-8');
  const pluginYmlResult = validatePluginYml(pluginYmlContent, pluginYmlPath);

  if (!pluginYmlResult.success) {
    console.error(`[build-trusted] plugin.yml validation failed`);
    printDiagnostics('validatePluginYml', pluginYmlResult.diagnostics as BuildDiagnostic[]);
  }

  pluginName = pluginYmlResult.metadata?.name ?? pluginName;
  pluginVersion = pluginYmlResult.metadata?.version ?? pluginVersion;

  steps.validatePluginYml = {
    status: pluginYmlResult.success ? 'ok' : 'failed',
    message: pluginYmlResult.success
      ? `${pluginName} v${pluginVersion}`
      : 'validation failed',
    errorCount: getErrors(pluginYmlResult.diagnostics as BuildDiagnostic[]).length,
    warningCount: getWarnings(pluginYmlResult.diagnostics as BuildDiagnostic[]).length,
  };
  allDiagnostics.push(...(pluginYmlResult.diagnostics as BuildDiagnostic[]));

  if (!pluginYmlResult.success) {
    return createFailureResult(startTime, pluginName, pluginVersion, allDiagnostics, steps);
  }

  // ─── STEP 2: Security Scan ────────────────────────────────

  console.log('\n[build-trusted] === Step 2: Security Scan ===');

  const scanResult = scanForSecuritySignals(absSourcePath);
  const pharScanResult = scanForCommittedPhar(absSourcePath);
  const scanDiagnostics = [...scanResult.diagnostics, ...pharScanResult.diagnostics] as BuildDiagnostic[];

  const scanErrorCount = getErrors(scanDiagnostics).length;
  const scanWarningCount = getWarnings(scanDiagnostics).length;
  const scanSignalCount = scanResult.signalCount + pharScanResult.signalCount;

  steps.securityScan = {
    status: scanErrorCount === 0 ? 'ok' : 'failed',
    message: `${scanResult.filesScanned} files, ${scanSignalCount} signals, ${scanWarningCount} warnings`,
    errorCount: scanErrorCount,
    warningCount: scanWarningCount,
  };
  allDiagnostics.push(...scanDiagnostics);

  // ─── STEP 3: Composer Dev Install (Pharynx tool) ──────────

  console.log('\n[build-trusted] === Step 3: Composer Dev Install ===');

  const composerDevResult = await runComposerInstall({
    workspace: absSourcePath,
    timeoutMs: 5 * 60 * 1000,
    devOnly: true,
  });

  steps.composerDevInstall = {
    status: composerDevResult.success ? 'ok' : 'failed',
    elapsedMs: composerDevResult.elapsedMs,
    message: composerDevResult.success
      ? `${composerDevResult.packagesInstalled ?? 0} packages`
      : `exit ${composerDevResult.exitCode ?? 'null'}`,
    errorCount: getErrors(composerDevResult.diagnostics).length,
    warningCount: getWarnings(composerDevResult.diagnostics).length,
  };
  allDiagnostics.push(...composerDevResult.diagnostics);

  if (!composerDevResult.success) {
    console.error('[build-trusted] Composer dev install failed');
    return createFailureResult(startTime, pluginName, pluginVersion, allDiagnostics, steps);
  }

  // ─── STEP 4: Composer Production Install ──────────────────

  console.log('\n[build-trusted] === Step 4: Composer Production Install ===');

  const composerProdResult = await runComposerInstall({
    workspace: absSourcePath,
    timeoutMs: 5 * 60 * 1000,
    devOnly: false,
  });

  steps.composerProdInstall = {
    status: composerProdResult.success ? 'ok' : 'failed',
    elapsedMs: composerProdResult.elapsedMs,
    message: composerProdResult.success
      ? `${composerProdResult.packagesInstalled ?? 0} packages`
      : `exit ${composerProdResult.exitCode ?? 'null'}`,
    errorCount: getErrors(composerProdResult.diagnostics).length,
    warningCount: getWarnings(composerProdResult.diagnostics).length,
  };
  allDiagnostics.push(...composerProdResult.diagnostics);

  if (!composerProdResult.success) {
    console.error('[build-trusted] Composer production install failed');
    return createFailureResult(startTime, pluginName, pluginVersion, allDiagnostics, steps);
  }

  // ─── STEP 5: Pharynx Build ────────────────────────────────

  console.log('\n[build-trusted] === Step 5: Pharynx Build ===');

  const outputPhar = join(tmpdir(), `${pluginName}-${pluginVersion}.phar`);

  const pharynxResult = await runPharynx({
    pharynxPath: absPharynxPath,
    pluginDir: absSourcePath,
    outputPhar,
    phpPath: absPhpPath,
    composerMode: true,
    timeoutMs: 10 * 60 * 1000,
  });

  steps.pharynxBuild = {
    status: pharynxResult.success ? 'ok' : 'failed',
    elapsedMs: pharynxResult.elapsedMs,
    message: pharynxResult.success
      ? `PHAR written to ${outputPhar}`
      : `exit ${pharynxResult.exitCode ?? 'null'}`,
    errorCount: getErrors(pharynxResult.diagnostics).length,
    warningCount: getWarnings(pharynxResult.diagnostics).length,
  };
  allDiagnostics.push(...pharynxResult.diagnostics);

  if (!pharynxResult.success) {
    console.error('[build-trusted] Pharynx build failed');
    return createFailureResult(startTime, pluginName, pluginVersion, allDiagnostics, steps);
  }

  pharPath = outputPhar;
  pharSizeBytes = pharynxResult.pharSizeBytes ?? 0;

  // ─── STEP 6: Verify PHAR ─────────────────────────────────

  console.log('\n[build-trusted] === Step 6: Verify PHAR ===');

  if (!existsSync(pharPath)) {
    console.error(`[build-trusted] FATAL: PHAR not found at ${pharPath}`);
    steps.verifyPhar = {
      status: 'failed',
      message: `PHAR not found at ${pharPath}`,
    };
    return createFailureResult(startTime, pluginName, pluginVersion, allDiagnostics, steps);
  }

  const pharStats = statSync(pharPath);
  steps.verifyPhar = {
    status: 'ok',
    message: `${pharPath} (${pharStats.size} bytes)`,
  };

  // ─── STEP 7: Compute Checksums ────────────────────────────

  console.log('\n[build-trusted] === Step 7: Compute Checksums ===');

  const checksumContent = readFileSync(pharPath);
  const hash = createHash('sha256');
  hash.update(checksumContent);
  sha256 = hash.digest('hex');

  steps.computeChecksums = {
    status: 'ok',
    message: `SHA-256: ${sha256}`,
  };

  // ─── Complete ────────────────────────────────────────────

  const elapsedMs = Date.now() - startTime;

  console.log('\n[build-trusted] === Build Complete ===');
  console.log(`[build-trusted] Plugin: ${pluginName} v${pluginVersion}`);
  console.log(`[build-trusted] PHAR: ${pharPath}`);
  console.log(`[build-trusted] Size: ${pharSizeBytes} bytes`);
  console.log(`[build-trusted] SHA-256: ${sha256}`);
  console.log(`[build-trusted] Duration: ${formatMs(elapsedMs)}`);

  return {
    success: true,
    pluginName,
    pluginVersion,
    pharPath,
    pharSizeBytes,
    sha256,
    checksums: { sha256 },
    diagnostics: {
      errors: getErrors(allDiagnostics),
      warnings: getWarnings(allDiagnostics),
      infraErrors: getInfrastructureErrors(allDiagnostics),
      all: allDiagnostics,
    },
    steps,
    elapsedMs,
  };
}

// ============================================================
// Helper Functions
// ============================================================

function createFailureResult(
  startTime: number,
  pluginName: string,
  pluginVersion: string,
  allDiagnostics: BuildDiagnostic[],
  steps: BuildTrustedResult['steps']
): BuildTrustedResult {
  return {
    success: false,
    pluginName,
    pluginVersion,
    pharPath: '',
    pharSizeBytes: 0,
    sha256: '',
    checksums: { sha256: '' },
    diagnostics: {
      errors: getErrors(allDiagnostics),
      warnings: getWarnings(allDiagnostics),
      infraErrors: getInfrastructureErrors(allDiagnostics),
      all: allDiagnostics,
    },
    steps,
    elapsedMs: Date.now() - startTime,
  };
}

// ============================================================
// CLI Entry Point
// ============================================================

async function main(): Promise<void> {
  console.log('[build-trusted] Build Trusted CLI starting...');

  const args = parseArgs();
  if (!args) {
    console.error('Usage: tsx src/cli/build-trusted.ts --source <path> --pharynx <pharynx-path> [--php <php-path>]');
    console.error('');
    console.error('Required arguments:');
    console.error('  --source   Path to checked-out plugin source');
    console.error('  --pharynx  Path to pharynx.phar on the build host');
    console.error('');
    console.error('Optional arguments:');
    console.error('  --php      Path to PHP binary (defaults to "php")');
    process.exit(1);
  }

  // Validate source exists
  if (!existsSync(args.source)) {
    console.error(`[build-trusted] FATAL: Source path does not exist: ${args.source}`);
    process.exit(1);
  }

  // Validate pharynx exists
  if (!existsSync(args.pharynx)) {
    console.error(`[build-trusted] FATAL: Pharynx not found at: ${args.pharynx}`);
    console.error('[build-trusted] Ensure pharynx.phar is installed on the Build Host.');
    process.exit(1);
  }

  try {
    const result = await buildTrusted({
      sourcePath: args.source,
      pharynxPath: args.pharynx,
      phpPath: args.php,
    });

    // Output JSON result for workflow consumption
    console.log('\n--- BUILD_RESULT_JSON ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('--- END_BUILD_RESULT ---');

    if (!result.success) {
      console.error('[build-trusted] Build FAILED');
      process.exit(1);
    }

    console.log('[build-trusted] Build SUCCEEDED');
    process.exit(0);
  } catch (err) {
    console.error('[build-trusted] FATAL ERROR:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[build-trusted] FATAL ERROR:', err);
  process.exit(1);
});
