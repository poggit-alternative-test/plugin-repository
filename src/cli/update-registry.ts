#!/usr/bin/env node
/**
 * Registry Update CLI
 *
 * Thin orchestration layer for updating registry version records.
 * Reuses the existing Registry writer.
 *
 * Authentication: Uses GitHub App for GitHub API operations. Configure via:
 * - REG_GITHUB_APP_ID
 * - REG_GITHUB_APP_PRIVATE_KEY_PATH or REG_GITHUB_APP_PRIVATE_KEY
 * - REG_GITHUB_APP_INSTALLATION_ID (or use REG_TARGET_ORG for auto-discovery)
 *
 * Usage:
 *   tsx src/cli/update-registry.ts update-published [options]
 *
 * Options:
 *   --plugin-id <id>       Plugin identifier (required)
 *   --version <ver>        Plugin version (required)
 *   --release-tag <tag>    Release tag (e.g., v1.0.0) (required)
 *   --phar-file <file>     PHAR filename (required)
 *   --sha256 <hash>       SHA-256 checksum (required)
 *   --published-at <time>  ISO timestamp (required)
 *   --registry-root <dir> Registry root path (default: ./registry)
 *   --dry-run            Show what would be updated without writing
 *
 * This CLI does NOT:
 *   - Modify GitHub state (only local registry files)
 *   - Execute plugin code
 *   - Make trust decisions
 */
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import YAML from 'yaml';
import {
  writeVersionRecord,
  buildArtifactRef,
  updateVersionRecordWithPublication,
  type PublishToRegistryResult,
} from '../registry/writer.js';
import type { VersionRecord } from '../registry/types.js';

// ============================================================
// Argument Parsing
// ============================================================

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function has(name: string): boolean {
  return process.argv.includes(name);
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function warn(message: string): void {
  console.warn(`WARNING: ${message}`);
}

// ============================================================
// Version Record Schema Types
// ============================================================

interface PublicationResult {
  success: boolean;
  release?: {
    tagName: string;
    htmlUrl?: string;
  };
  assets?: Array<{ name: string; contentType?: string }>;
  publishedAt?: string;
  diagnostics?: Array<{ code: string; severity?: string; message?: string; context?: Record<string, unknown> }>;
}

// ============================================================
// Registry Update
// ============================================================

interface UpdateConfig {
  pluginId: string;
  version: string;
  releaseTag: string;
  pharFile: string;
  sha256: string;
  publishedAt: string;
  registryRoot: string;
  dryRun: boolean;
}

function loadConfig(): UpdateConfig {
  const pluginId = arg('--plugin-id');
  const version = arg('--version');
  const releaseTag = arg('--release-tag');
  const pharFile = arg('--phar-file');
  const sha256 = arg('--sha256');
  const publishedAt = arg('--published-at');
  const registryRoot = arg('--registry-root') || process.env.REG_REGISTRY_ROOT || './registry';
  const dryRun = has('--dry-run');

  // Validation
  if (!pluginId || !/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/i.test(pluginId)) {
    fail('--plugin-id is required and must be valid plugin ID format');
  }

  if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    fail('--version is required and must be valid SemVer');
  }

  if (!releaseTag || !/^v\d+\.\d+\.\d+/.test(releaseTag)) {
    fail('--release-tag is required and must be v#.#.# format');
  }

  if (!pharFile || !/\.phar$/i.test(pharFile)) {
    fail('--phar-file is required and must end with .phar');
  }

  if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
    fail('--sha256 is required and must be 64 hex characters');
  }

  if (!publishedAt) {
    fail('--published-at is required (ISO 8601 timestamp)');
  }

  // Verify registry root exists
  if (!existsSync(registryRoot)) {
    fail(`Registry root does not exist: ${registryRoot}`);
  }

  return {
    pluginId: pluginId.toLowerCase(),
    version,
    releaseTag,
    pharFile,
    sha256: sha256.toLowerCase(),
    publishedAt,
    registryRoot,
    dryRun,
  };
}

function buildPublicationResult(config: UpdateConfig): PublicationResult {
  return {
    success: true,
    release: {
      tagName: config.releaseTag,
    },
    assets: [
      { name: config.pharFile, contentType: 'application/octet-stream' },
      { name: 'checksums.txt', contentType: 'text/plain' },
      { name: 'metadata.json', contentType: 'application/json' },
    ],
    publishedAt: config.publishedAt,
    diagnostics: [
      {
        code: 'ASSET_UPLOADED',
        severity: 'info',
        message: `Uploaded PHAR: ${config.pharFile}`,
        context: { sha256: config.sha256 },
      },
    ],
  };
}

function update(): void {
  const config = loadConfig();

  const versionFile = join(config.registryRoot, 'plugins', config.pluginId, 'versions', `${config.version}.yaml`);

  console.log('Registry Update:');
  console.log(`  Plugin: ${config.pluginId}`);
  console.log(`  Version: ${config.version}`);
  console.log(`  File: ${versionFile}`);

  // Check if file exists
  if (!existsSync(versionFile)) {
    fail(`Version file not found: ${versionFile}`);
  }

  // Read existing record
  let existingContent: string;
  try {
    existingContent = readFileSync(versionFile, 'utf-8');
  } catch (e) {
    fail(`Failed to read version file: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  let existing: Record<string, unknown>;
  try {
    existing = YAML.parse(existingContent) as Record<string, unknown>;
  } catch (e) {
    fail(`Failed to parse existing YAML: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  // Check current status
  const currentStatus = existing['status'] as string;
  if (currentStatus !== 'materialized') {
    warn(`Version record has status "${currentStatus}", expected "materialized". Proceeding anyway.`);
  }

  // Build artifact ref from publication result
  const publicationResult = buildPublicationResult(config);
  const { artifactRef, diagnostics } = buildArtifactRef(
    publicationResult,
    config.pluginId,
    config.version
  );

  // Report diagnostics
  for (const diag of diagnostics) {
    if (diag.severity === 'warning') {
      warn(diag.message);
    }
    console.log(`  [${diag.code}] ${diag.message}`);
  }

  // Update the version record
  const { content: updatedYaml, diagnostics: updateDiagnostics } = updateVersionRecordWithPublication(
    versionFile,
    artifactRef
  );

  // Report update diagnostics
  for (const diag of updateDiagnostics) {
    if (diag.severity === 'error') {
      console.error(`  [${diag.code}] ${diag.message}`);
    } else {
      console.log(`  [${diag.code}] ${diag.message}`);
    }
  }

  if (!updatedYaml) {
    fail('Failed to update version record');
  }

  if (config.dryRun) {
    console.log('');
    console.log('=== DRY RUN - Would update with: ===');
    console.log(updatedYaml);
    console.log('');
    console.log('Dry run complete. No files written.');
    return;
  }

  // Write the updated record
  const writeDiagnostics = writeVersionRecord(versionFile, updatedYaml);

  for (const diag of writeDiagnostics) {
    if (diag.severity === 'error') {
      console.error(`  [${diag.code}] ${diag.message}`);
    } else {
      console.log(`  [${diag.code}] ${diag.message}`);
    }
  }

  if (writeDiagnostics.some(d => d.severity === 'error')) {
    fail('Failed to write updated registry file');
  }

  console.log('');
  console.log('Registry updated successfully:');
  console.log(`  File: ${versionFile}`);
  console.log(`  Status: published`);

  // Output result
  console.log('');
  console.log('--- REGISTRY_UPDATE_RESULT ---');
  console.log(JSON.stringify({
    success: true,
    pluginId: config.pluginId,
    version: config.version,
    file: versionFile,
    status: 'published',
  }, null, 2));
  console.log('--- END REGISTRY_UPDATE_RESULT ---');
}

function main(): void {
  const command = process.argv[2];

  if (!command || has('--help')) {
    console.log('Usage: update-registry <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  update-published  Update registry with publication results');
    console.log('');
    console.log('Options:');
    console.log('  --plugin-id <id>       Plugin identifier (required)');
    console.log('  --version <ver>        Plugin version (required)');
    console.log('  --release-tag <tag>    Release tag (e.g., v1.0.0) (required)');
    console.log('  --phar-file <file>     PHAR filename (required)');
    console.log('  --sha256 <hash>       SHA-256 checksum (required)');
    console.log('  --published-at <time>  ISO timestamp (required)');
    console.log('  --registry-root <dir> Registry root (default: ./registry)');
    console.log('  --dry-run              Show what would be updated');
    console.log('');
    console.log('GitHub App Authentication (for API operations):');
    console.log('  REG_GITHUB_APP_ID                    GitHub App ID');
    console.log('  REG_GITHUB_APP_PRIVATE_KEY_PATH      Path to private key PEM file');
    console.log('  REG_GITHUB_APP_INSTALLATION_ID          Installation ID');
    console.log('');
    console.log('Note: Registry writes do not require GitHub authentication.');
    console.log('      Authentication is only needed for GitHub API operations.');
    return;
  }

  if (command === 'update-published') {
    return update();
  }

  fail(`Unknown command: ${command}`);
}

main();
