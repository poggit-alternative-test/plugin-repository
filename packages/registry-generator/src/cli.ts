#!/usr/bin/env node

/**
 * Registry Generator CLI
 *
 * Command-line interface for the Registry Generator.
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generate } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default paths
const REGISTRY_PATH = resolve(__dirname, '../../registry');
const OUTPUT_PATH = resolve(__dirname, '../../apps/website/public/generated');

// Parse command line arguments
const args = process.argv.slice(2);

let registryPath = REGISTRY_PATH;
let outputPath = OUTPUT_PATH;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--registry' || arg === '-r') {
    const nextArg = args[++i];
    if (nextArg) {
      registryPath = resolve(nextArg);
    }
  } else if (arg === '--output' || arg === '-o') {
    const nextArg = args[++i];
    if (nextArg) {
      outputPath = resolve(nextArg);
    }
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Registry Generator CLI

Usage:
  npx tsx src/cli.ts [options]

Options:
  --registry, -r <path>    Path to registry directory (default: ../../registry)
  --output, -o <path>      Path to output directory (default: ../../apps/website/public/generated)
  --help, -h              Show this help message
`);
    process.exit(0);
  }
}

console.log('Registry Generator');
console.log('================\n');
console.log(`Registry path: ${registryPath}`);
console.log(`Output path: ${outputPath}\n`);

const result = generate({
  registryPath,
  outputPath,
});

if (!result.success) {
  console.error('\n✗ Generation completed with errors');
  if (result.errors.registry.length > 0) {
    console.error('\nRegistry errors:');
    for (const error of result.errors.registry) {
      console.error(`  ${error.file}: ${error.error}`);
    }
  }
  if (result.errors.generation.length > 0) {
    console.error('\nGeneration errors:');
    for (const error of result.errors.generation) {
      console.error(`  ${error}`);
    }
  }
  process.exit(1);
}

console.log('\n✓ Done');
