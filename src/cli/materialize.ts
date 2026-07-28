#!/usr/bin/env node
/**
 * M5 administrative CLI. Plans are read-only previews; this milestone does
 * not enable live GitHub writes. A serialized plan is never an authorization.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import {
  FileM4ApprovalStore, GitHubExactSourceAcquirer, RealGitHubClient, createMaterializationService,
  type ApprovedCandidateInfo, type PluginId, type SemVer, type RepositoryIdentity, type GitSha,
  isValidGitSha, isValidPluginId, isValidSemVer,
} from '../materialization/index.js';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function has(name: string): boolean { return process.argv.includes(name); }
function fail(message: string): never { console.error(`ERROR: ${message}`); process.exit(1); }
function requiredEnvironment(name: string): string { return process.env[name] || fail(`Missing required trusted configuration: ${name}`); }

function service() {
  const reviewDir = requiredEnvironment('MAT_M4_REVIEWS_DIR');
  const owner = requiredEnvironment('MAT_STORAGE_OWNER');
  const token = requiredEnvironment('MAT_GITHUB_TOKEN');
  const reviewersPath = requiredEnvironment('MAT_REVIEWERS_CONFIG');
  if (!existsSync(reviewersPath)) fail(`Reviewer authorization configuration not found: ${reviewersPath}`);
  const parsed = parse(readFileSync(reviewersPath, 'utf-8')) as { authorizedReviewers?: Array<{ githubId?: number }> };
  const reviewerIds = (parsed.authorizedReviewers ?? []).flatMap((reviewer) => {
    const id = reviewer.githubId;
    return typeof id === 'number' && Number.isInteger(id) && id > 0 ? [id] : [];
  });
  if (reviewerIds.length === 0) fail('Trusted reviewer configuration has no authorized numeric GitHub IDs.');
  return createMaterializationService({
    storageOwners: [owner], defaultStorage: { owner, branch: process.env.MAT_STORAGE_BRANCH || 'main' },
    provenanceDir: process.env.MAT_PROVENANCE_DIR || join(process.cwd(), 'provenance-cache'),
    m4ApprovalStore: new FileM4ApprovalStore(reviewDir, reviewerIds),
    sourceAcquirer: new GitHubExactSourceAcquirer(new RealGitHubClient({ accessToken: token, writeEnabled: false })),
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
    console.log('Required trusted config: MAT_M4_REVIEWS_DIR, MAT_STORAGE_OWNER, MAT_REVIEWERS_CONFIG, MAT_GITHUB_TOKEN.');
    console.log('M5 live writes are intentionally disabled; execute is unavailable.');
    return;
  }
  if (command === 'plan') return plan();
  if (command === 'execute') fail('Live GitHub materialization is intentionally disabled in this M5 implementation.');
  fail(`Unknown command: ${command}`);
}
main().catch((error) => fail(error instanceof Error ? error.message : 'Unknown failure'));
