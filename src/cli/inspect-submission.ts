/**
 * Submission Inspection CLI
 *
 * Local command-line tool for inspecting plugin submissions.
 * Supports both human-readable and JSON output.
 *
 * Usage:
 *   npm run submission:inspect -- submissions/topstats.yaml
 *   npm run submission:inspect -- submissions/topstats.yaml --json
 *   GITHUB_TOKEN=xxx npm run submission:inspect -- submissions/topstats.yaml
 *   npm run submission:inspect -- submissions/topstats.yaml --register
 */

import { resolve, isAbsolute } from 'path';
import { cwd } from 'process';
import { inspectSubmission, generateReport, InspectionStatus } from '../submission/inspection.js';
import { ReviewManager } from '../review/index.js';
import { createCandidateIdentity } from '../review/candidate-identity.js';
import { derivePluginId } from '../submission/plugin-yml.js';
import type { SubmissionInspectionResult } from '../submission/result.js';

// ============================================================
// CLI Options
// ============================================================

interface CliOptions {
  path: string;
  json: boolean;
  token?: string;
  timeout?: number;
  /** Register candidate with review store after successful inspection */
  register: boolean;
  /** Review store directory path (required if --register is used) */
  reviewDir?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    path: '',
    json: false,
    register: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--' || arg.startsWith('node') || arg.startsWith('tsx') || arg.startsWith('npm')) {
      continue;
    }

    if (arg === '--json' || arg === '-j') {
      options.json = true;
    } else if (arg === '--token' || arg === '-t') {
      options.token = argv[++i];
    } else if (arg === '--timeout') {
      options.timeout = parseInt(argv[++i], 10);
    } else if (arg === '--register' || arg === '-r') {
      options.register = true;
    } else if (arg === '--review-dir') {
      options.reviewDir = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      options.path = arg;
    }
  }

  // Get token from environment if not provided
  if (!options.token && process.env.GITHUB_TOKEN) {
    options.token = process.env.GITHUB_TOKEN;
  }

  // Get review dir from environment if not provided
  if (!options.reviewDir && process.env.MAT_M4_REVIEWS_DIR) {
    options.reviewDir = process.env.MAT_M4_REVIEWS_DIR;
  }

  return options;
}

function printHelp(): void {
  console.log(`
Axolotl Submission Inspector

Inspect a plugin submission for review.

Usage:
  npm run submission:inspect -- <submission-file> [options]

Arguments:
  submission-file    Path to submission YAML file

Options:
  --json, -j         Output machine-readable JSON
  --token, -t        GitHub API token (or set GITHUB_TOKEN env var)
  --timeout          Request timeout in milliseconds (default: 60000)
  --register, -r      Register candidate with review store after success
  --review-dir       Review store directory (or set MAT_M4_REVIEWS_DIR)
  --help, -h         Show this help message

Examples:
  npm run submission:inspect -- submissions/topstats.yaml
  GITHUB_TOKEN=abc123 npm run submission:inspect -- submissions/topstats.yaml
  npm run submission:inspect -- submissions/topstats.yaml --json > result.json

  # Inspect and register for review:
  npm run submission:inspect -- submissions/topstats.yaml --register
  MAT_M4_REVIEWS_DIR=/path/to/reviews npm run submission:inspect -- submissions/topstats.yaml --register

Exit Codes:
  0 - Inspection completed (READY_FOR_REVIEW or finished analysis)
  1 - Submission error or inspection failed
  2 - Infrastructure error (GitHub API issues)
  3 - Registration failed
`);
}

// ============================================================
// Registration
// ============================================================

/**
 * Register a successfully inspected candidate with the review store.
 */
function registerCandidate(result: SubmissionInspectionResult, reviewDir: string): void {
  const manager = new ReviewManager(reviewDir);

  // Extract information from inspection result
  const upstreamRepository = result.github.repositoryOwner && result.github.repositoryName
    ? `${result.github.repositoryOwner}/${result.github.repositoryName}`
    : result.submission.upstreamRepository;

  const upstreamBranch = result.submission.upstreamBranch;
  const resolvedSha = result.github.resolvedCommitSha;

  // Use suggested plugin ID or derive from plugin name
  const pluginId = result.suggestedPluginIdValid && result.suggestedPluginId
    ? result.suggestedPluginId
    : result.pluginMetadata?.name
      ? derivePluginId(result.pluginMetadata.name)
      : result.submission.slug;

  const inspectionTimestamp = new Date().toISOString();

  // Create candidate identity
  const identity = createCandidateIdentity({
    pluginSlug: pluginId,
    upstreamRepository,
    sha: resolvedSha,
  });

  // Register the candidate
  manager.registerCandidate(identity, upstreamBranch, inspectionTimestamp);

  console.error(`Registered candidate: ${identity.canonical}`);
}

// ============================================================
// CLI Implementation
// ============================================================

async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv.slice(2));

  if (!options.path) {
    console.error('Error: Submission file path is required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  // Resolve path
  const submissionPath = isAbsolute(options.path)
    ? options.path
    : resolve(cwd(), options.path);

  console.error(`Inspecting: ${submissionPath}`);

  try {
    const result = await inspectSubmission(submissionPath, {
      githubToken: options.token,
      timeout: options.timeout,
    });

    // Output report
    const report = generateReport(result, options.json ? 'json' : 'text');
    console.log(report);

    // Register candidate if requested and status is READY_FOR_REVIEW
    if (options.register) {
      if (!options.reviewDir) {
        console.error('\nError: --register requires --review-dir or MAT_M4_REVIEWS_DIR');
        process.exit(3);
      }

      if (result.status === InspectionStatus.READY_FOR_REVIEW) {
        console.error('\nRegistering with review store...');
        try {
          registerCandidate(result, options.reviewDir);
          console.error('Registration complete.');
        } catch (e) {
          console.error('\nRegistration failed:');
          console.error(e instanceof Error ? e.message : 'Unknown error');
          process.exit(3);
        }
      } else {
        console.error('\nSkipping registration: inspection did not result in READY_FOR_REVIEW');
        // Still exit with the appropriate code based on status
      }
    }

    // Exit code based on status
    if (result.status === InspectionStatus.READY_FOR_REVIEW) {
      process.exit(0);
    } else if (result.status === InspectionStatus.SUBMISSION_ERROR) {
      process.exit(1);
    } else {
      process.exit(2);
    }
  } catch (e) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            error: true,
            message: e instanceof Error ? e.message : 'Unknown error',
            stack: e instanceof Error ? e.stack : undefined,
          },
          null,
          2
        )
      );
    } else {
      console.error('Inspection failed:');
      console.error(e instanceof Error ? e.message : 'Unknown error');
      if (e instanceof Error && e.stack) {
        console.error('');
        console.error(e.stack);
      }
    }
    process.exit(2);
  }
}

// Run CLI
main(process.argv).catch((e) => {
  console.error('Fatal error:', e);
  process.exit(2);
});
