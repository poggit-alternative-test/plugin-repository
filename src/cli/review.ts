#!/usr/bin/env node
/**
 * Review CLI
 *
 * Trusted local/admin CLI for M4 Human Review System operations.
 *
 * ============================================================
 * TRUST BOUNDARY DOCUMENTATION
 * ============================================================
 *
 * This CLI is designed for TRUSTED LOCAL/ADMIN execution only.
 *
 * IMPORTANT SECURITY NOTES:
 *
 * 1. `--reviewer-id` records the reviewer's GitHub identity but does NOT
 *    authenticate ownership of that GitHub account. This CLI assumes the
 *    operator is authorized to act on behalf of the specified reviewer.
 *
 * 2. Production GitHub identity authentication/integration is a separate
 *    integration concern and must be implemented separately (e.g., GitHub App
 *    authentication, OAuth flows, or CI/CD pipeline integration).
 *
 * 3. This domain layer (M4) must NOT be misrepresented as proving GitHub
 *    identity. The trust boundary is at the CLI invocation, not within M4.
 *
 * 4. Review history is append-only. The LATEST valid authorized decision
 *    determines the effective state. Exact SHA remains the approval boundary.
 *
 * M4 Scope:
 * - Domain logic for human review decisions
 * - Exact SHA enforcement
 * - File-based storage with atomic writes
 * - Candidate identity management
 * - Reviewer authorization (declarative, not authenticated)
 *
 * NOT M4 Scope:
 * - GitHub OAuth / App authentication
 * - Source materialization (M5)
 * - PHAR building
 * - Publication
 * - Website
 * - Feedback systems
 *
 * Commands:
 *   inspect         - Inspect a review candidate
 *   validate-record - Validate a review record file
 *   approve        - Issue an approval decision
 *   reject         - Issue a rejection decision
 *   request-changes - Issue a changes requested decision
 *   state          - Get effective review state
 *   list           - List all candidates
 *
 * Environment Variables:
 *   REVIEW_REVIEWS_DIR - Base directory for review storage (default: ./reviews)
 *   REVIEW_CONFIG_DIR  - Base directory for config (default: ./config)
 */

import { parse, stringify } from 'yaml';
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  REVIEW_CODES,
  reviewError,
  reviewWarning,
  getReviewErrors,
  hasReviewErrors,
  ReviewSeverity,
} from '../review/diagnostics.js';

import {
  createCandidateIdentity,
  parseCandidateIdentity,
  validateSha,
  validateRepository,
  validatePluginSlug,
  validateComponents,
  type CandidateIdentity,
} from '../review/candidate-identity.js';

import {
  ReviewDecision,
  isValidReviewRecord,
  isValidCandidateInfo,
  createReviewRecord,
} from '../review/review-record.js';

import {
  EffectiveReviewState,
  deriveEffectiveState,
} from '../review/review-state.js';

import {
  ReviewerAuthorizer,
  isValidReviewerIdentity,
  isValidAuthorizationConfig,
  createEmptyAuthorizationConfig,
  type ReviewerIdentity,
} from '../review/reviewer-auth.js';

import {
  ReviewStorageManager,
  ReviewManager,
} from '../review/review-storage.js';

import {
  checkApprovalPreconditions,
  type ApprovalContext,
} from '../review/approval-preconditions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// Configuration
// ============================================================

// Use environment variables if set, otherwise use relative paths from project root
const reviewsEnv = process.env.REVIEW_REVIEWS_DIR;
const configEnv = process.env.REVIEW_CONFIG_DIR;
const DEFAULT_REVIEWS_DIR = reviewsEnv || join(process.cwd(), 'reviews');
const DEFAULT_CONFIG_DIR = configEnv || join(process.cwd(), 'config');

// ============================================================
// CLI Output
// ============================================================

function log(message: string): void {
  console.log(message);
}

function error(message: string): void {
  console.error(`ERROR: ${message}`);
}

function warn(message: string): void {
  console.warn(`WARNING: ${message}`);
}

function exit(code: number): void {
  process.exit(code);
}

// ============================================================
// Command: inspect
// ============================================================

interface InspectCommand {
  command: 'inspect';
  args: {
    pluginSlug: string;
    repository: string;
    sha: string;
  };
}

function handleInspect(args: InspectCommand['args']): void {
  const { pluginSlug, repository, sha } = args;

  // Validate inputs
  const slugResult = validatePluginSlug(pluginSlug);
  if (!slugResult.valid) {
    error(`Invalid plugin slug: ${slugResult.error}`);
    exit(1);
  }

  const repoResult = validateRepository(repository);
  if (!repoResult.valid) {
    error(`Invalid repository: ${repoResult.error}`);
    exit(1);
  }

  const shaResult = validateSha(sha);
  if (!shaResult.valid) {
    error(`Invalid SHA: ${shaResult.error}`);
    exit(1);
  }

  // Create candidate identity
  const identity = createCandidateIdentity({
    pluginSlug,
    upstreamRepository: repository,
    sha,
  });

  // Load from storage
  const storage = new ReviewStorageManager(DEFAULT_REVIEWS_DIR);
  const { candidateInfo, decisions } = storage.loadCandidate(identity);

  log('='.repeat(60));
  log('Review Candidate Inspection');
  log('='.repeat(60));
  log('');
  log(`Plugin: ${identity.pluginSlug}`);
  log(`Repository: ${identity.upstreamRepository}`);
  log(`SHA: ${identity.sha}`);
  log(`Canonical Identity: ${identity.canonical}`);
  log(`Short ID: ${identity.shortId}`);
  log('');

  if (!candidateInfo) {
    log('Status: CANDIDATE NOT FOUND');
    log('');
    warn('This candidate has not been registered for review.');
    exit(1);
    return; // unreachable but satisfies TypeScript
  }

  // TypeScript narrowing doesn't work after exit(), so assert non-null
  const info = candidateInfo!;

  log('Candidate Info');
  log('-'.repeat(40));
  log(`Branch: ${info.upstreamBranch}`);
  log(`Inspection Timestamp: ${info.inspectionTimestamp}`);
  log(`Evidence Ref: ${info.evidenceRef || '(none)'}`);
  log('');

  const effectiveState = deriveEffectiveState(decisions);
  log('Review State');
  log('-'.repeat(40));
  log(`Effective State: ${effectiveState}`);
  log(`Total Decisions: ${decisions.length}`);
  log('');

  if (decisions.length > 0) {
    log('Decision History');
    log('-'.repeat(40));
    for (const decision of decisions) {
      log(`  [${decision.timestamp}] ${decision.decision}`);
      log(`    Decision ID: ${decision.decisionId}`);
      log(`    Reviewer: ${decision.reviewer.login || 'unknown'} (${decision.reviewer.githubId})`);
      if (decision.notes) {
        log(`    Notes: ${decision.notes}`);
      }
    }
  }

  log('');
  log('='.repeat(60));
}

// ============================================================
// Command: validate-record
// ============================================================

interface ValidateRecordCommand {
  command: 'validate-record';
  args: {
    file: string;
  };
}

function handleValidateRecord(args: ValidateRecordCommand['args']): void {
  const { file } = args;

  if (!existsSync(file)) {
    error(`File not found: ${file}`);
    exit(1);
  }

  try {
    const content = readFileSync(file, 'utf-8');
    const record = parse(content);

    log(`Validating: ${file}`);
    log('');

    if (isValidReviewRecord(record)) {
      log('Result: VALID');
      log('');
      log(`Decision ID: ${record.decisionId}`);
      log(`Decision: ${record.decision}`);
      log(`Candidate: ${record.candidateIdentity}`);
      log(`Reviewer: ${record.reviewer.login || 'unknown'} (${record.reviewer.githubId})`);
      log(`Timestamp: ${record.timestamp}`);
      exit(0);
    } else {
      error('Result: INVALID');
      error('');
      error('Record does not match ReviewRecord schema');
      exit(1);
    }
  } catch (e) {
    error(`Failed to parse file: ${e instanceof Error ? e.message : 'Unknown error'}`);
    exit(1);
  }
}

// ============================================================
// Command: approve
// ============================================================

interface ApproveCommand {
  command: 'approve';
  args: {
    pluginSlug: string;
    repository: string;
    sha: string;
    reviewerId: number;
    reviewerLogin?: string;
    notes?: string;
  };
}

function handleApprove(args: ApproveCommand['args']): void {
  const { pluginSlug, repository, sha, reviewerId, reviewerLogin, notes } = args;

  // Validate inputs
  const validation = validateComponents({ pluginSlug, upstreamRepository: repository, sha });
  if (!validation.valid) {
    error(`Invalid input: ${validation.error}`);
    exit(1);
  }

  if (!reviewerId || reviewerId <= 0) {
    error('Invalid reviewer ID');
    exit(1);
  }

  // Create candidate identity
  const identity = createCandidateIdentity({ pluginSlug, upstreamRepository: repository, sha });

  // Load configuration
  const configFile = join(DEFAULT_CONFIG_DIR, 'reviewers.yaml');
  let authorizer: ReviewerAuthorizer = new ReviewerAuthorizer(createEmptyAuthorizationConfig());

  if (existsSync(configFile)) {
    try {
      const configContent = readFileSync(configFile, 'utf-8');
      const config = parse(configContent);
      if (!isValidAuthorizationConfig(config)) {
        error('Invalid reviewer authorization config');
        exit(1);
        return;
      }
      authorizer = new ReviewerAuthorizer(config);
    } catch (e) {
      error(`Failed to load reviewer config: ${e instanceof Error ? e.message : 'Unknown error'}`);
      exit(1);
      return;
    }
  } else {
    warn('No reviewer config found - using empty authorization');
  }

  // Check reviewer authorization
  const reviewer: ReviewerIdentity = { githubId: reviewerId, login: reviewerLogin };
  const authResult = authorizer.isAuthorized(reviewer);

  if (!authResult.authorized) {
    error(`REVIEWER NOT AUTHORIZED: ${authResult.error}`);
    exit(1);
  }

  // Load candidate
  const storage = new ReviewStorageManager(DEFAULT_REVIEWS_DIR);
  const { candidateInfo, decisions } = storage.loadCandidate(identity);

  if (!candidateInfo) {
    error('Candidate not found - register it first');
    exit(1);
  }

  // Check preconditions
  const context: ApprovalContext = {
    candidateIdentity: identity,
    candidateInfo,
    inspectionResult: null, // Would come from inspection storage
    reviewer,
    authorizer,
  };

  const preconditions = checkApprovalPreconditions(context);

  if (!preconditions.canApprove) {
    error('APPROVAL PRECONDITIONS NOT MET:');
    for (const diag of preconditions.diagnostics) {
      error(`  [${diag.code}] ${diag.message}`);
    }
    exit(1);
  }

  // Record approval
  const reviewManager = new ReviewManager(DEFAULT_REVIEWS_DIR);
  const result = reviewManager.recordDecision(identity, ReviewDecision.APPROVE, reviewer, { notes });

  if (!result.success) {
    error('Failed to record approval:');
    for (const diag of result.diagnostics) {
      error(`  [${diag.code}] ${diag.message}`);
    }
    exit(1);
  }

  log('APPROVAL RECORDED');
  log('');
  log(`Decision ID: ${result.record?.decisionId}`);
  log(`Candidate: ${identity.canonical}`);
  log(`Approved by: ${reviewer.login || reviewer.githubId}`);
  log(`Timestamp: ${result.record?.timestamp}`);
}

// ============================================================
// Command: reject
// ============================================================

interface RejectCommand {
  command: 'reject';
  args: {
    pluginSlug: string;
    repository: string;
    sha: string;
    reviewerId: number;
    reviewerLogin?: string;
    notes?: string;
  };
}

function handleReject(args: RejectCommand['args']): void {
  const { pluginSlug, repository, sha, reviewerId, reviewerLogin, notes } = args;

  // Validate inputs
  const validation = validateComponents({ pluginSlug, upstreamRepository: repository, sha });
  if (!validation.valid) {
    error(`Invalid input: ${validation.error}`);
    exit(1);
  }

  if (!reviewerId || reviewerId <= 0) {
    error('Invalid reviewer ID');
    exit(1);
  }

  // Create candidate identity
  const identity = createCandidateIdentity({ pluginSlug, upstreamRepository: repository, sha });

  // Load configuration
  const configFile = join(DEFAULT_CONFIG_DIR, 'reviewers.yaml');
  let authorizer: ReviewerAuthorizer = new ReviewerAuthorizer(createEmptyAuthorizationConfig());

  if (existsSync(configFile)) {
    try {
      const configContent = readFileSync(configFile, 'utf-8');
      const config = parse(configContent);
      if (!isValidAuthorizationConfig(config)) {
        error('Invalid reviewer authorization config');
        exit(1);
        return;
      }
      authorizer = new ReviewerAuthorizer(config);
    } catch (e) {
      error(`Failed to load reviewer config: ${e instanceof Error ? e.message : 'Unknown error'}`);
      exit(1);
      return;
    }
  } else {
    warn('No reviewer config found - using empty authorization');
  }

  // Check reviewer authorization
  const reviewer: ReviewerIdentity = { githubId: reviewerId, login: reviewerLogin };
  const authResult = authorizer.isAuthorized(reviewer);

  if (!authResult.authorized) {
    error(`REVIEWER NOT AUTHORIZED: ${authResult.error}`);
    exit(1);
  }

  // Load candidate
  const storage = new ReviewStorageManager(DEFAULT_REVIEWS_DIR);
  const { candidateInfo } = storage.loadCandidate(identity);

  if (!candidateInfo) {
    error('Candidate not found - register it first');
    exit(1);
  }

  // Record rejection
  const reviewManager = new ReviewManager(DEFAULT_REVIEWS_DIR);
  const result = reviewManager.recordDecision(identity, ReviewDecision.REJECT, reviewer, { notes });

  if (!result.success) {
    error('Failed to record rejection:');
    for (const diag of result.diagnostics) {
      error(`  [${diag.code}] ${diag.message}`);
    }
    exit(1);
  }

  log('REJECTION RECORDED');
  log('');
  log(`Decision ID: ${result.record?.decisionId}`);
  log(`Candidate: ${identity.canonical}`);
  log(`Rejected by: ${reviewer.login || reviewer.githubId}`);
  log(`Timestamp: ${result.record?.timestamp}`);
}

// ============================================================
// Command: state
// ============================================================

interface StateCommand {
  command: 'state';
  args: {
    pluginSlug: string;
    repository: string;
    sha: string;
  };
}

function handleState(args: StateCommand['args']): void {
  const { pluginSlug, repository, sha } = args;

  // Validate inputs
  const validation = validateComponents({ pluginSlug, upstreamRepository: repository, sha });
  if (!validation.valid) {
    error(`Invalid input: ${validation.error}`);
    exit(1);
  }

  // Create candidate identity
  const identity = createCandidateIdentity({ pluginSlug, upstreamRepository: repository, sha });

  // Load from storage
  const storage = new ReviewStorageManager(DEFAULT_REVIEWS_DIR);
  const { candidateInfo, decisions } = storage.loadCandidate(identity);

  // Candidate not found is a failure condition
  if (!candidateInfo) {
    error('CANDIDATE_NOT_FOUND');
    exit(1);
  }

  // No decisions = PENDING
  if (decisions.length === 0) {
    log('PENDING');
    exit(0);
  }

  const effectiveState = deriveEffectiveState(decisions);
  log(effectiveState);
}

// ============================================================
// Command: list
// ============================================================

interface ListCommand {
  command: 'list';
  args: {
    pluginSlug?: string;
  };
}

function handleList(args: ListCommand['args']): void {
  const { pluginSlug } = args;

  const storage = new ReviewStorageManager(DEFAULT_REVIEWS_DIR);

  if (pluginSlug) {
    // List candidates for a specific plugin
    const candidates = storage.listCandidates(pluginSlug);
    if (candidates.length === 0) {
      log(`No review history for plugin: ${pluginSlug}`);
      exit(0);
    }
    log(`Candidates for ${pluginSlug}:`);
    for (const shortId of candidates) {
      log(`  ${shortId}`);
    }
  } else {
    // List all plugins
    const plugins = storage.listPluginSlugs();
    if (plugins.length === 0) {
      log('No review history');
      exit(0);
    }
    log('Plugins with review history:');
    for (const slug of plugins) {
      const count = storage.listCandidates(slug).length;
      log(`  ${slug}: ${count} candidate(s)`);
    }
  }
}

// ============================================================
// Main CLI Entry Point
// ============================================================

interface CLICommand {
  command: string;
  args: Record<string, string | number | undefined>;
}

function parseArgs(): CLICommand | null {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return null;
  }

  const command = args[0];
  const result: Record<string, string | number | undefined> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      const key = parts[0];
      let value: string | number | undefined = parts[1];

      // Convert numeric values
      if (value !== undefined && !isNaN(Number(value))) {
        value = Number(value);
      }

      result[key] = value;
    }
  }

  return { command, args: result };
}

function printUsage(): void {
  log(`
Review CLI - Human Review System for Axolotl Plugin Repository

Usage:
  npx tsx src/cli/review.ts <command> [options]

Commands:
  inspect         Inspect a review candidate
  validate-record Validate a review record file
  approve        Issue an approval decision
  reject         Issue a rejection decision
  request-changes Issue a changes-requested decision
  state          Get effective review state for a candidate
  list           List all candidates or plugins with review history

Options:
  --plugin-slug      Plugin slug (e.g., topstats)
  --repository       Upstream repository (e.g., owner/repo)
  --sha              Exact commit SHA (40 hex characters)
  --reviewer-id      GitHub user ID
  --reviewer-login   GitHub username (optional)
  --notes            Review notes/reason
  --file             File path for validate-record command

Examples:
  # Inspect a candidate
  npx tsx src/cli/review.ts inspect --plugin-slug=topstats --repository=nicholass003/TopStats --sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

  # Approve a candidate
  npx tsx src/cli/review.ts approve --plugin-slug=topstats --repository=nicholass003/TopStats --sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --reviewer-id=12345678 --reviewer-login=reviewer --notes="Security review complete"

  # Check review state
  npx tsx src/cli/review.ts state --plugin-slug=topstats --repository=nicholass003/TopStats --sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

  # List all plugins with review history
  npx tsx src/cli/review.ts list
`);
}

function main(): void {
  const parsed = parseArgs();

  if (!parsed) {
    printUsage();
    exit(0);
    return; // unreachable but satisfies TypeScript
  }

  const cmd = parsed.command;
  const args = parsed.args;

  switch (cmd) {
    case 'inspect':
      if (!args['plugin-slug'] || !args['repository'] || !args['sha']) {
        error('Missing required arguments: --plugin-slug, --repository, --sha');
        exit(1);
      }
      handleInspect({
        pluginSlug: args['plugin-slug'] as string,
        repository: args['repository'] as string,
        sha: args['sha'] as string,
      });
      break;

    case 'validate-record':
      if (!args['file']) {
        error('Missing required argument: --file');
        exit(1);
      }
      handleValidateRecord({ file: args['file'] as string });
      break;

    case 'approve':
      if (!args['plugin-slug'] || !args['repository'] || !args['sha'] || !args['reviewer-id']) {
        error('Missing required arguments: --plugin-slug, --repository, --sha, --reviewer-id');
        exit(1);
      }
      handleApprove({
        pluginSlug: args['plugin-slug'] as string,
        repository: args['repository'] as string,
        sha: args['sha'] as string,
        reviewerId: args['reviewer-id'] as number,
        reviewerLogin: args['reviewer-login'] as string | undefined,
        notes: args['notes'] as string | undefined,
      });
      break;

    case 'reject':
      if (!args['plugin-slug'] || !args['repository'] || !args['sha'] || !args['reviewer-id']) {
        error('Missing required arguments: --plugin-slug, --repository, --sha, --reviewer-id');
        exit(1);
      }
      handleReject({
        pluginSlug: args['plugin-slug'] as string,
        repository: args['repository'] as string,
        sha: args['sha'] as string,
        reviewerId: args['reviewer-id'] as number,
        reviewerLogin: args['reviewer-login'] as string | undefined,
        notes: args['notes'] as string | undefined,
      });
      break;

    case 'request-changes':
      log('request-changes command not fully implemented in this version');
      log('Use approve or reject for now');
      exit(1);
      break;

    case 'state':
      if (!args['plugin-slug'] || !args['repository'] || !args['sha']) {
        error('Missing required arguments: --plugin-slug, --repository, --sha');
        exit(1);
      }
      handleState({
        pluginSlug: args['plugin-slug'] as string,
        repository: args['repository'] as string,
        sha: args['sha'] as string,
      });
      break;

    case 'list':
      handleList({ pluginSlug: args['plugin-slug'] as string | undefined });
      break;

    default:
      error(`Unknown command: ${cmd}`);
      printUsage();
      exit(1);
  }
}

main();
