#!/usr/bin/env node
/**
 * M5 administrative CLI. Plans are read-only previews; execute requires
 * a trusted execution context issued by the service.
 *
 * Authentication: Uses GitHub App for production. Configure via:
 * - M5_GITHUB_APP_ID
 * - M5_GITHUB_APP_PRIVATE_KEY_PATH or M5_GITHUB_APP_PRIVATE_KEY
 * - M5_GITHUB_APP_INSTALLATION_ID (or use M5_GITHUB_APP_INSTALLATION_ID_BY_ORG)
 *
 * Tester mode: Set M5_TESTER_ENABLED=true for restricted tester org access.
 *
 * Commands:
 * - plan: Generate a materialization plan (read-only preview)
 * - execute: Execute a materialization plan (requires write-enabled transport)
 */
import { existsSync, readFileSync, mkdirSync } from 'fs';
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
 * Load and validate the GitHub App transport configuration for read-only operations.
 */
function loadReadTransportConfig() {
  const testerConfig = loadTesterConfigFromEnv();
  const validation = validateTesterConfig(testerConfig);
  for (const warning of validation.warnings) warn(warning);
  if (!validation.valid) {
    for (const error of validation.errors) console.error(`CONFIG ERROR: ${error}`);
    fail('Invalid tester transport configuration.');
  }
  const githubAppConfig = testerConfig.githubAppConfig;
  const accessToken = testerConfig.testOverrides?.accessToken;

  if (!githubAppConfig?.appId && !accessToken) {
    fail('Either GitHub App (M5_GITHUB_APP_ID) or GitHub Token (GITHUB_TOKEN) is required.');
  }

  const githubClient = new RealGitHubClient({
    githubApp: githubAppConfig ?? undefined,
    installationId: githubAppConfig?.installationId,
    accessToken: accessToken,
    writeEnabled: false,
    testerConfig,
  });
  return { githubClient, testerConfig };
}

/**
 * Load and validate the GitHub App transport configuration for write operations.
 * Only available when M5_TESTER_ALLOW_REPO_CREATION=true.
 */
function loadWriteTransportConfig() {
  const testerConfig = loadTesterConfigFromEnv();
  const validation = validateTesterConfig(testerConfig);
  for (const warning of validation.warnings) warn(warning);
  if (!validation.valid) {
    for (const error of validation.errors) console.error(`CONFIG ERROR: ${error}`);
    fail('Invalid tester transport configuration.');
  }
  if (!testerConfig.allowRepositoryCreation) {
    fail('Repository creation is not enabled. Set M5_TESTER_ALLOW_REPO_CREATION=true to enable write operations.');
  }

  // Use GitHub App if configured, otherwise use access token
  const githubAppConfig = testerConfig.githubAppConfig;
  const accessToken = testerConfig.testOverrides?.accessToken;

  if (!githubAppConfig?.appId && !accessToken) {
    fail('Either GitHub App (M5_GITHUB_APP_ID) or GitHub Token (GITHUB_TOKEN) is required for write operations.');
  }

  const githubClient = new RealGitHubClient({
    githubApp: githubAppConfig ?? undefined,
    installationId: githubAppConfig?.installationId,
    accessToken: accessToken,
    writeEnabled: true,
    testerConfig,
  });
  return { githubClient, testerConfig };
}

function createServiceWithClient(githubClient: RealGitHubClient) {
  const reviewDir = process.env.MAT_M4_REVIEWS_DIR || fail('Missing required trusted configuration: MAT_M4_REVIEWS_DIR');
  const owner = process.env.MAT_STORAGE_OWNER || fail('Missing required trusted configuration: MAT_STORAGE_OWNER');
  const reviewersPath = process.env.MAT_REVIEWERS_CONFIG || fail('Missing required trusted configuration: MAT_REVIEWERS_CONFIG');

  // Create reviews directory if it doesn't exist (for test mode)
  if (!existsSync(reviewDir)) {
    mkdirSync(reviewDir, { recursive: true });
  }

  if (!existsSync(reviewersPath)) fail(`Reviewer authorization configuration not found: ${reviewersPath}`);
  console.error('[DEBUG] Parsing reviewers from:', reviewersPath);
  const parsed = parse(readFileSync(reviewersPath, 'utf-8')) as { authorizedReviewers?: Array<{ githubId?: number }> };
  console.error('[DEBUG] Parsed reviewers:', JSON.stringify(parsed));
  const reviewerIds = (parsed.authorizedReviewers ?? []).flatMap((reviewer) => {
    const id = reviewer.githubId;
    console.error('[DEBUG] Reviewer ID:', id, typeof id);
    return typeof id === 'number' && Number.isInteger(id) && id > 0 ? [id] : [];
  });
  console.error('[DEBUG] Final reviewerIds:', reviewerIds);
  if (reviewerIds.length === 0) fail('Trusted reviewer configuration has no authorized numeric GitHub IDs.');

  return createMaterializationService({
    storageOwners: [owner],
    defaultStorage: { owner, branch: process.env.MAT_STORAGE_BRANCH || 'main' },
    provenanceDir: process.env.MAT_PROVENANCE_DIR || join(process.cwd(), 'provenance-cache'),
    m4ApprovalStore: new FileM4ApprovalStore(reviewDir, reviewerIds),
    sourceAcquirer: new GitHubExactSourceAcquirer(githubClient),
  });
}

function service() {
  const { githubClient } = loadReadTransportConfig();
  return createServiceWithClient(githubClient);
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

async function execute(): Promise<void> {
  const { githubClient } = loadWriteTransportConfig();
  const service = createServiceWithClient(githubClient);

  const pluginId = arg('--plugin-slug'); const sha = arg('--sha'); const repository = arg('--repository'); const version = arg('--version') || '1.0.0';
  const dryRun = has('--dry-run');
  if (!pluginId || !isValidPluginId(pluginId)) fail('Use a valid --plugin-slug.');
  if (!sha || !isValidGitSha(sha)) fail('Use an exact 40-character --sha.');
  if (!repository) fail('--repository is required; M5 verifies it against trusted M4 state.');
  if (!isValidSemVer(version)) fail('Use a valid --version.');

  console.error('[DEBUG] Dry run mode:', dryRun);

  // Generate plan first (default to dry-run=false for execute command)
  const planResult = await service.generatePlan({ pluginId: pluginId as PluginId, version: version as SemVer, upstreamRepository: repository as RepositoryIdentity, upstreamCommit: sha as GitSha }, { dryRun: dryRun ?? false });
  if (planResult.errors.length) {
    for (const error of planResult.errors) console.error(`[${error.code}] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  // Issue trusted execution context
  const context = service.createTrustedExecutionContext();

  // Execute the plan
  const result = await service.executePlan(planResult.plan, githubClient, context, { dryRun });

  console.log(JSON.stringify({
    success: result.success,
    alreadyMaterialized: result.alreadyMaterialized,
    pluginId: result.pluginId,
    version: result.version,
    executedActions: result.executedActions,
    failedActions: result.failedActions,
    durationMs: result.durationMs,
    errors: result.errors,
    warnings: result.warnings,
    provenance: result.provenance ? {
      materializationId: result.provenance.materializationId,
      storageCommit: result.provenance.storageCommit,
      storageRepository: result.provenance.storageRepository,
    } : undefined,
  }, null, 2));

  if (!result.success || result.failedActions > 0) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command || has('--help')) {
    console.log('Usage: materialize <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  plan     Generate a materialization plan (read-only preview)');
    console.log('  execute  Execute a materialization plan (requires write-enabled transport)');
    console.log('');
    console.log('Common options:');
    console.log('  --plugin-slug ID    Plugin identifier');
    console.log('  --repository owner/repo  Upstream repository');
    console.log('  --sha SHA          Exact 40-character commit SHA');
    console.log('  --version X.Y.Z    Plugin version');
    console.log('');
    console.log('M4 Configuration (required):');
    console.log('  MAT_M4_REVIEWS_DIR       Path to M4 review records');
    console.log('  MAT_STORAGE_OWNER        Storage repository owner');
    console.log('  MAT_REVIEWERS_CONFIG     Path to reviewers YAML');
    console.log('');
    console.log('GitHub App Transport (required for write operations):');
    console.log('  M5_GITHUB_APP_ID                      GitHub App ID');
    console.log('  M5_GITHUB_APP_PRIVATE_KEY_PATH        Path to private key PEM file');
    console.log('  M5_GITHUB_APP_INSTALLATION_ID          Installation ID for the org');
    console.log('');
    console.log('Tester mode (required for this environment):');
    console.log('  M5_TESTER_ENABLED=true                Enable tester mode');
    console.log('  M5_TESTER_ALLOWED_ORGS                Comma-separated allowed orgs');
    console.log('  M5_TESTER_ALLOW_REPO_CREATION=true    Enable write operations');
    return;
  }
  if (command === 'plan') return plan();
  if (command === 'execute') return execute();
  fail(`Unknown command: ${command}`);
}
main().catch((error) => fail(error instanceof Error ? error.message : 'Unknown failure'));
