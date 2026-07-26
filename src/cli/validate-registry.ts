/**
 * Registry Validation CLI
 *
 * Command-line interface for validating the plugin registry.
 */

import { resolve } from 'path';
import { validateRegistry } from '../registry/validator.js';
import { formatDiagnostics, aggregateDiagnostics } from '../registry/diagnostics.js';

interface CLIOptions {
  path?: string;
  verbose?: boolean;
  json?: boolean;
}

interface CLIResult {
  valid: boolean;
  exitCode: number;
  output: string;
}

/**
 * Run the validation CLI
 */
export function runValidation(options: CLIOptions): CLIResult {
  const registryPath = options.path
    ? resolve(options.path)
    : resolve('registry');

  if (options.verbose) {
    console.error(`Validating registry: ${registryPath}`);
  }

  const { plugins, diagnostics: rawDiagnostics } = validateRegistry(registryPath);
  const diagnostics = Array.isArray(rawDiagnostics)
    ? aggregateDiagnostics(rawDiagnostics)
    : rawDiagnostics;

  if (options.json) {
    const jsonOutput = JSON.stringify(
      {
        valid: diagnostics.errorCount === 0,
        registryPath,
        plugins: plugins.length,
        versions: plugins.reduce((sum, p) => sum + p.versions.length, 0),
        diagnostics: diagnostics.diagnostics,
        summary: {
          errors: diagnostics.errorCount,
          warnings: diagnostics.warningCount,
          info: diagnostics.infoCount,
        },
      },
      null,
      2
    );
    return { valid: diagnostics.errorCount === 0, exitCode: diagnostics.errorCount === 0 ? 0 : 1, output: jsonOutput };
  }

  // Text output
  const lines: string[] = [];

  if (diagnostics.errorCount === 0) {
    lines.push(`Registry valid.`);
    lines.push(`Plugins: ${plugins.length}`);
    lines.push(
      `Versions: ${plugins.reduce((sum, p) => sum + p.versions.length, 0)}`
    );
  } else {
    lines.push(`Registry validation failed.`);
    lines.push('');
    lines.push(formatDiagnostics(diagnostics));
    lines.push('');
    lines.push(
      `${diagnostics.errorCount} error(s), ${diagnostics.warningCount} warning(s)`
    );
  }

  return {
    valid: diagnostics.errorCount === 0,
    exitCode: diagnostics.errorCount === 0 ? 0 : 1,
    output: lines.join('\n'),
  };
}

/**
 * Parse CLI arguments
 */
export function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--path' || arg === '-p') {
      options.path = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--json' || arg === '-j') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Registry Validation CLI

Usage:
  npm run registry:validate [options]

Options:
  --path, -p <path>    Path to registry directory (default: ./registry)
  --verbose, -v         Verbose output
  --json, -j           JSON output format
  --help, -h            Show this help message

Examples:
  npm run registry:validate
  npm run registry:validate --path ./registry
  npm run registry:validate --json
`);
}

// CLI entry point
const args = process.argv.slice(2);
const options = parseArgs(args);
const result = runValidation(options);

console.log(result.output);
process.exit(result.exitCode);
