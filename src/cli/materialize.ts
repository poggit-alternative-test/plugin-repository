#!/usr/bin/env node
/**
 * M5 administrative CLI. Plans are read-only previews; this milestone does
 * not enable live GitHub writes. A serialized plan is never an authorization.
 *
 * Authentication: Uses GitHub App for production. Configure via:
 * - M5_GITHUB_APP_ID
 * - M5_GITHUB_APP_PRIVATE_KEY_PATH or M5_GITHUB_APP_PRIVATE_KEY
 * - M5_GITHUB_APP_INSTALLATION_ID (or use M5_GITHUB_APP_INSTALLATION_ID_BY_ORG)
 *
 * Tester mode: Set M5_TESTER_ENABLED=true for restricted tester org access.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import {
  FileM4ApprovalStore,
  GitHubExactSourceAcquirer,
  RealGitHubClient,
  createMaterializationService,
  loadTesterConfigFromEnv,
  validateTesterConfig,
  type ApprovedCandidateInfo,
  type PluginId,
  type SemVer,
  type RepositoryIdentity,
  type GitSha,
  isValidGitSha,
  isValidPluginId,
  isValidSemVer,
} from '../materialization/index.js';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function has(name: string): boolean { return process.argv.includes(name); }
function fail(message: string): never { console.error(`ERROR: ${message}`); process.exit(1); }
function warn(message: string): void { console.warn(`WARNING: ${message}`); }

/**
 * Load and validate the GitHub App transport configuration.
 * Fails if tester mode is misconfigured.
 */
function loadTransportConfig() {
  // Load tester config from environment
  const testerConfig = loadTesterConfigFromEnv();

  // Validate the configuration
  const validation = validateTesterConfig(testerConfig);

  // Report any warnings but don't fail
  for (const warning of validation.warnings) {
    warn(warning);
  }

  // Fail if configuration is invalid
  if (!validation.valid) {
    for (const error of validation.errors) {
      console.error(`CONFIG ERROR: ${error}`);
    }
    fail('Invalid tester transport configuration. Fix errors and retry.');
  }

  // Build RealGitHubClient config
  const githubAppConfig = testerConfig.githubAppConfig;

  // Construct the GitHub client
  // Note: writeEnabled=false preserves read-only behavior for plan command
  const githubClient = new RealGitHubClient({
    githubApp: githubAppConfig ?? undefined,
    installationId: githubAppConfig?.installationId,
    writeEnabled: false, // Plan command is read-only
    testerConfig,
  });

  return { githubClient, testerConfig };
}

function service() {
  const reviewDir = process.env.MAT_M4_REVIEWS_DIR || fail('Missing required trusted configuration: MAT_M4_REVIEWS_DIR');
  const owner = process.env.MAT_STORAGE_OWNER || fail('Missing required trusted configuration: MAT_STORAGE_OWNER');
  const reviewersPath = process.env.MAT_REVIEWERS_CONFIG || fail('Missing required trusted configuration: MAT_REVIEWERS_CONFIG');

  if (!existsSync(reviewersPath)) fail(`Reviewer authorization configuration not found: ${reviewersPath}`);
  const parsed = parse(readFileSync(reviewersPath, 'utf-8')) as { authorizedReviewers?: Array<{ githubId?: number }> };
  const reviewerIds = (parsed.authorizedReviewers ?? []).flatMap((reviewer) => {
    const id = reviewer.githubId;
    return typeof id === 'number' && Number.isInteger(id) && id > 0 ? [id] : [];
  });
  if (reviewerIds.length === 0) fail('Trusted reviewer configuration has no authorized numeric GitHub IDs.');

  // Load GitHub App transport configuration
  const { githubClient } = loadTransportConfig();

  return createMaterializationService({
    storageOwners: [owner],
    defaultStorage: { owner, branch: process.env.MAT_STORAGE_BRANCH || 'main' },
    provenanceDir: process.env.MAT_PROVENANCE_DIR || join(process.cwd(), 'provenance-cache'),
    m4ApprovalStore: new FileM4ApprovalStore(reviewDir, reviewerIds),
    sourceAcquirer: new GitHubExactSourceAcquirer(githubClient),
  });
}

async function plan(): Promise<void> {
  const pluginId = arg('--plugin-slug'); const sha = arg('--sha'); const repository = arg('--repository'); const version = arg('--version') || '1.0.0';
  if (!pluginId || !isValidPluginId(pluginId)) fail('Use a valid --plugin-slug.');
  if (!sha || !isValidGitSha(sha)) fail('Use an exact 40-character --sha.');
  if (!repository) fail('--repository is required; M5 verifies it against trusted M4 state.');
  if (!isValidSemVer(version)) fail('Use a valid --version.');
  const result = await service().generatePlan({ pluginId: pluginId as PluginId, version: version as SemVer, upstreamRepository: repository as RepositoryIdentity, upstreamCommit: sha as GitSha });
  if (result.errors.length) { for (const error of result.errors) console.error(`[${error.code}] ${error.message}`); process.exitCode = 1; return; }
  console.log(JSON.stringify(result.plan, null, 2));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command || has('--help')) {
    console.log('Usage: materialize plan --plugin-slug ID --repository owner/repo --sha SHA [--version X.Y.Z]');
    console.log('');
    console.log('M4 Configuration (required):');
    console.log('  MAT_M4_REVIEWS_DIR      - Path to M4 review records');
    console.log('  MAT_STORAGE_OWNER      - Storage repository owner');
    console.log('  MAT_REVIEWERS_CONFIG  - Path to reviewers YAML');
    console.log('');
    console.log('GitHub App Transport (required for production):');
    console.log('  M5_GITHUB_APP_ID                    - GitHub App ID');
    console.log('  M5_GITHUB_APP_PRIVATE_KEY_PATH      - Path to private key PEM file');
    console.log('  M5_GITHUB_APP_INSTALLATION_ID       - Installation ID for the org');
    console.log('  M5_TESTER_ENABLED=true              - Enable tester mode (required)');
    console.log('  M5_TESTER_ALLOWED_ORGS             - Comma-separated allowed orgs');
    console.log('');
    console.log('M5 live writes are intentionally disabled; execute is unavailable.');
    return;
  }
  if (command === 'plan') return plan();
  if (command === 'execute') fail('Live GitHub materialization is intentionally disabled in this M5 implementation.');
  fail(`Unknown command: ${command}`);
}
main().catch((error) => fail(error instanceof Error ? error.message : 'Unknown failure'));
