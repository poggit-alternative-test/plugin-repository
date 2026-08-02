#!/usr/bin/env node
/**
 * Publication CLI
 *
 * Thin orchestration layer for publishing build artifacts to GitHub Releases.
 * Reuses the existing Publication service and GitHub provider.
 *
 * Authentication: Uses GitHub App for production. Configure via:
 * - PUB_GITHUB_APP_ID
 * - PUB_GITHUB_APP_PRIVATE_KEY_PATH or PUB_GITHUB_APP_PRIVATE_KEY
 * - PUB_GITHUB_APP_INSTALLATION_ID (or use PUB_GITHUB_APP_INSTALLATION_ID_BY_ORG)
 *
 * Usage:
 *   tsx src/cli/publish.ts publish --storage-repository owner/name [options]
 *
 * Options:
 *   --phar <path>           Path to PHAR file (required)
 *   --sha256 <hash>         SHA-256 of PHAR (required)
 *   --plugin-name <name>    Plugin name from plugin.yml (required)
 *   --version <ver>        Plugin version (required)
 *   --storage-repository    Target repository (required)
 *   --draft                Create as draft (default: true)
 *   --publish              Publish immediately (implies --no-draft)
 *
 * This CLI does NOT:
 *   - Build the PHAR (Build domain handles this)
 *   - Update the registry (handled separately)
 */
import { existsSync } from 'fs';
import {
  publishToRelease,
  type BuildMetadata,
  type BuildArtifacts,
} from '../publication/index.js';
import {
  GitHubPublicationProvider,
  createGitHubPublicationProvider,
} from '../publication/github-provider.js';
import {
  GitHubAppAuth,
  loadGitHubAppConfig,
} from '../materialization/github-app-auth.js';

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
// GitHub App Authentication
// ============================================================

interface GitHubAppCredentials {
  appId: string;
  privateKey: string;
  installationId?: string;
}

function loadGitHubAppCredentials(): GitHubAppCredentials | null {
  const appId = process.env.PUB_GITHUB_APP_ID;
  if (!appId) return null;

  const privateKeyPath = process.env.PUB_GITHUB_APP_PRIVATE_KEY_PATH;
  const privateKeyContent = process.env.PUB_GITHUB_APP_PRIVATE_KEY;

  if (!privateKeyPath && !privateKeyContent) {
    fail('GitHub App authentication requires either PUB_GITHUB_APP_PRIVATE_KEY_PATH or PUB_GITHUB_APP_PRIVATE_KEY');
  }

  let privateKey: string;
  if (privateKeyContent) {
    privateKey = privateKeyContent;
  } else if (privateKeyPath) {
    const { readFileSync } = require('fs');
    try {
      privateKey = readFileSync(privateKeyPath, 'utf-8');
    } catch (e) {
      fail(`Failed to read private key from ${privateKeyPath}`);
    }
  } else {
    fail('No private key provided');
  }

  return {
    appId,
    privateKey,
    installationId: process.env.PUB_GITHUB_APP_INSTALLATION_ID,
  };
}

async function getInstallationToken(credentials: GitHubAppCredentials): Promise<string> {
  const auth = new GitHubAppAuth({
    appId: credentials.appId,
    privateKey: credentials.privateKey,
  });

  // Get installation ID
  let installationId = credentials.installationId;
  if (!installationId) {
    // Try to find by org
    const org = process.env.PUB_STORAGE_OWNER || process.env.PUB_TARGET_ORG;
    if (!org) {
      fail('Installation ID or target org required for GitHub App authentication');
    }
    const installations = await auth.listInstallations();
    const match = installations.find(i => i.account?.login?.toLowerCase() === org.toLowerCase());
    if (!match) {
      fail(`No GitHub App installation found for organization: ${org}`);
    }
    installationId = String(match.id);
  }

  // Get installation token
  const token = await auth.createInstallationToken(parseInt(installationId, 10));
  return token;
}

// ============================================================
// Configuration
// ============================================================

interface PublishConfig {
  pharPath: string;
  sha256: string;
  pluginName: string;
  version: string;
  storageRepository: string;
  draft: boolean;
  githubToken: string;
  apiUrl?: string;
}

function loadConfig(): PublishConfig {
  // Required arguments
  const pharPath = arg('--phar');
  const sha256 = arg('--sha256');
  const pluginName = arg('--plugin-name');
  const version = arg('--version');
  const storageRepository = arg('--storage-repository');

  // Environment
  const storageOwner = arg('--storage-owner') || process.env.PUB_STORAGE_OWNER || fail('Storage owner required (--storage-owner or PUB_STORAGE_OWNER)');

  // GitHub App authentication
  const credentials = loadGitHubAppCredentials();
  if (!credentials) {
    fail('GitHub App credentials required. Set PUB_GITHUB_APP_ID and PUB_GITHUB_APP_PRIVATE_KEY_PATH or PUB_GITHUB_APP_PRIVATE_KEY');
  }

  // Draft mode
  const draft = !has('--publish'); // Default to draft

  // Validation
  if (!pharPath || !existsSync(pharPath)) {
    fail(`PHAR file not found: ${pharPath}`);
  }

  if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
    fail('Invalid SHA-256 format. Must be 64 hexadecimal characters.');
  }

  if (!pluginName) {
    fail('--plugin-name is required');
  }

  if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    fail('--version is required and must be valid SemVer');
  }

  // Build storage repository from owner and plugin name if not provided
  const targetRepo = storageRepository || `${storageOwner}/${pluginName.toLowerCase()}`;

  return {
    pharPath,
    sha256,
    pluginName,
    version,
    storageRepository: targetRepo,
    draft,
    githubToken: '', // Will be set asynchronously
    apiUrl: process.env.PUB_API_URL,
  };
}

// ============================================================
// Main
// ============================================================

async function publish(): Promise<void> {
  const config = loadConfig();

  // Get GitHub App token
  const credentials = loadGitHubAppCredentials();
  if (!credentials) {
    fail('GitHub App credentials required');
  }

  console.log('Authenticating with GitHub App...');
  const token = await getInstallationToken(credentials);
  config.githubToken = token;

  // Create the GitHub publication provider
  const provider = createGitHubPublicationProvider({
    token,
    apiBaseUrl: config.apiUrl,
  });

  if (!provider.isWriteEnabled()) {
    fail('GitHub provider is not write-enabled.');
  }

  // Build metadata from arguments
  const buildMetadata: BuildMetadata = {
    pluginName: config.pluginName,
    pluginVersion: config.version,
  };

  // Build artifacts from arguments
  const buildArtifacts: BuildArtifacts = {
    pharPath: config.pharPath,
    sha256: config.sha256,
    sizeBytes: 0, // Will be computed by service
  };

  console.log('Publishing to GitHub Release:');
  console.log(`  Repository: ${config.storageRepository}`);
  console.log(`  PHAR: ${config.pharPath}`);
  console.log(`  SHA-256: ${config.sha256}`);
  console.log(`  Draft: ${config.draft}`);
  console.log('');

  // Publish
  const result = await publishToRelease(provider, {
    storageRepository: config.storageRepository,
    buildMetadata,
    buildArtifacts,
    draft: config.draft,
  });

  // Output result as JSON
  console.log('--- PUBLICATION_RESULT_JSON ---');
  console.log(JSON.stringify(result, null, 2));
  console.log('--- END PUBLICATION_RESULT ---');

  if (!result.success) {
    console.error('Publication failed:');
    for (const diag of result.diagnostics) {
      if (diag.severity === 'error') {
        console.error(`  [${diag.code}] ${diag.message}`);
      }
    }
    process.exit(1);
  }

  console.log('');
  console.log('Publication successful!');
  if (result.release) {
    console.log(`  Release: ${result.release.htmlUrl}`);
    console.log(`  Tag: ${result.release.tagName}`);
  }

  provider.close();
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (!command || has('--help')) {
    console.log('Usage: publish <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  publish    Publish build artifacts to GitHub Release');
    console.log('');
    console.log('Publish options:');
    console.log('  --phar <path>              Path to PHAR file (required)');
    console.log('  --sha256 <hash>            SHA-256 of PHAR (required)');
    console.log('  --plugin-name <name>        Plugin name (required)');
    console.log('  --version <ver>             Plugin version (required)');
    console.log('  --storage-repository <repo> Target repository (owner/name)');
    console.log('  --storage-owner <owner>      Storage organization');
    console.log('  --draft                     Create as draft (default)');
    console.log('  --publish                   Publish immediately');
    console.log('');
    console.log('GitHub App Authentication:');
    console.log('  PUB_GITHUB_APP_ID                    GitHub App ID');
    console.log('  PUB_GITHUB_APP_PRIVATE_KEY_PATH      Path to private key PEM file');
    console.log('  PUB_GITHUB_APP_PRIVATE_KEY          Private key content (alternative)');
    console.log('  PUB_GITHUB_APP_INSTALLATION_ID        Installation ID (or use PUB_STORAGE_OWNER)');
    console.log('  PUB_STORAGE_OWNER                   Target organization for auto-discovery');
    console.log('  PUB_API_URL                        GitHub API URL (optional)');
    return;
  }

  if (command === 'publish') {
    return publish();
  }

  fail(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
