/**
 * Submission Inspection Pipeline
 *
 * Orchestrates the complete submission inspection workflow.
 * Implements the untrusted submission validation pipeline.
 *
 * Lifecycle:
 * 1. Validate submission file
 * 2. Resolve GitHub repository
 * 3. Resolve exact SHA
 * 4. Acquire source (bounded, safe)
 * 5. Inspect plugin.yml
 * 6. Inspect composer.json
 * 7. Generate review signals
 * 8. Produce structured result
 */

import { existsSync, readFileSync, rmSync, statSync } from 'fs';
import { join, extname } from 'path';
import { tmpdir } from 'os';
import type { GitHubClient } from './github.js';
import { createGitHubClient } from './github.js';
import {
  SUBMISSION_CODES,
  submissionError,
  infrastructureError,
  submissionWarning,
  type SubmissionDiagnostic,
} from './diagnostics.js';
import {
  validateSubmissionFilename,
  parseRepositoryIdentity,
  parseSubmission,
} from './schema.js';
import {
  parsePluginYaml,
  derivePluginId,
  validateDerivedPluginId,
} from './plugin-yml.js';
import { parseComposerJson } from './composer.js';
import { analyzePhpFile, checkForCommittedPhar, aggregateSignals } from './signals.js';
import { acquireSource, safeReadFile } from './acquisition.js';
import {
  SubmissionInspectionResultBuilder,
  generateHumanReadableReport,
  generateJsonOutput,
  InspectionStatus,
  type SubmissionInspectionResult,
} from './result.js';

// ============================================================
// Pipeline Configuration
// ============================================================

export interface InspectionConfig {
  /**
   * GitHub API token for rate limit handling.
   * Can also be set via GITHUB_TOKEN environment variable.
   */
  githubToken?: string;
  /**
   * Request timeout in milliseconds.
   */
  timeout?: number;
  /**
   * Temporary directory for source extraction.
   * Defaults to system temp directory.
   */
  tempDir?: string;
  /**
   * GitHub client to use.
   * If not provided, a RealGitHubClient will be created.
   * This allows injecting a mock client for testing.
   */
  githubClient?: GitHubClient;
}

const DEFAULT_CONFIG: InspectionConfig = {
  timeout: 60000,
  tempDir: tmpdir(),
};

// ============================================================
// Pipeline Implementation
// ============================================================

/**
 * Inspect a submission file.
 *
 * @param submissionPath Path to submission YAML file
 * @param config Inspection configuration
 * @returns Inspection result
 */
export async function inspectSubmission(
  submissionPath: string,
  config: InspectionConfig = {}
): Promise<SubmissionInspectionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const builder = new SubmissionInspectionResultBuilder();
  const diagnostics: SubmissionDiagnostic[] = [];

  // Step 1: Validate submission file
  const fileValidation = validateSubmissionFile(submissionPath);
  if (!fileValidation.success) {
    diagnostics.push(...fileValidation.diagnostics);
    return builder
      .setStatus(InspectionStatus.SUBMISSION_ERROR)
      .addDiagnostics(...diagnostics)
      .build();
  }

  const { content = '', filename = '', slug = '' } = fileValidation;

  // Step 2: Parse submission
  const parseResult = parseSubmission(content);
  if (!parseResult.success) {
    for (const error of parseResult.errors) {
      diagnostics.push(
        submissionError(SUBMISSION_CODES.SUBMISSION_INVALID_SCOPE, error)
      );
    }
    return builder
      .setStatus(InspectionStatus.SUBMISSION_ERROR)
      .setSubmission({
        filename,
        slug,
        schemaVersion: 0,
        upstreamRepository: '',
        upstreamBranch: '',
      })
      .addDiagnostics(...diagnostics)
      .build();
  }

  const submission = parseResult.data!;

  builder.setSubmission({
    filename,
    slug,
    schemaVersion: submission.schemaVersion,
    upstreamRepository: submission.repository,
    upstreamBranch: submission.branch,
  });

  // Step 3: Parse repository identity
  const repoParse = parseRepositoryIdentity(submission.repository);
  if (!repoParse.valid) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.SUBMISSION_INVALID_REPOSITORY,
        repoParse.error || 'Invalid repository format'
      )
    );
    return builder
      .setStatus(InspectionStatus.SUBMISSION_ERROR)
      .addDiagnostics(...diagnostics)
      .build();
  }

  const { owner, name } = repoParse;

  // Step 4: Create GitHub client (or use injected one)
  const client = cfg.githubClient ?? createGitHubClient({
    token: cfg.githubToken,
    timeout: cfg.timeout,
  });

  // Step 5: Get repository info
  const repoResult = await client.getRepository(owner!, name!);
  let repoInfo = { isArchived: false, isDisabled: false, isPrivate: false };
  let canonicalRepoIdentity: { owner: string; name: string } | null = null;

  if (!repoResult.success) {
    // 404 is a submission error (repository doesn't exist)
    const status = repoResult.isSubmissionError
      ? InspectionStatus.SUBMISSION_ERROR
      : InspectionStatus.INFRASTRUCTURE_ERROR;
    diagnostics.push(repoResult.error);
    return builder
      .setStatus(status)
      .setGitHub({
        repositoryFound: false,
        repositoryArchived: false,
        repositoryDisabled: false,
        repositoryPrivate: false,
        branchFound: false,
        resolvedCommitSha: '',
        repositoryOwner: owner!,
        repositoryName: name!,
      })
      .addDiagnostics(...diagnostics)
      .build();
  }

  repoInfo = {
    isArchived: repoResult.data.isArchived,
    isDisabled: repoResult.data.isDisabled,
    isPrivate: repoResult.data.isPrivate,
  };

  // Store canonical identity for comparison
  canonicalRepoIdentity = {
    owner: repoResult.data.owner,
    name: repoResult.data.name,
  };

  // Check if archived or disabled
  if (repoInfo.isArchived || repoInfo.isDisabled) {
    builder.setGitHub({
      repositoryFound: true,
      repositoryArchived: repoInfo.isArchived,
      repositoryDisabled: repoInfo.isDisabled,
      repositoryPrivate: repoInfo.isPrivate,
      branchFound: false,
      resolvedCommitSha: '',
      repositoryOwner: owner!,
      repositoryName: name!,
    });
    // Don't fail, but warn
    if (repoInfo.isArchived) {
      diagnostics.push(
        submissionWarning(
          SUBMISSION_CODES.REPOSITORY_ARCHIVED,
          'Repository is archived'
        )
      );
    }
    if (repoInfo.isDisabled) {
      diagnostics.push(
        submissionWarning(
          SUBMISSION_CODES.REPOSITORY_DISABLED,
          'Repository is disabled'
        )
      );
    }
  }

  // Step 6: Resolve branch to exact SHA
  const branchResult = await client.getBranch(owner!, name!, submission.branch);

  if (!branchResult.success) {
    // 404 is a submission error (branch doesn't exist)
    const status = branchResult.isSubmissionError
      ? InspectionStatus.SUBMISSION_ERROR
      : InspectionStatus.INFRASTRUCTURE_ERROR;
    diagnostics.push(branchResult.error);
    return builder
      .setStatus(status)
      .setGitHub({
        repositoryFound: true,
        repositoryArchived: repoInfo.isArchived,
        repositoryDisabled: repoInfo.isDisabled,
        repositoryPrivate: repoInfo.isPrivate,
        branchFound: false,
        resolvedCommitSha: '',
        repositoryOwner: owner!,
        repositoryName: name!,
      })
      .addDiagnostics(...diagnostics)
      .build();
  }

  const resolvedSha = branchResult.data.commitSha;

  // Step 7: Check canonical repository identity
  if (canonicalRepoIdentity && (canonicalRepoIdentity.owner !== owner || canonicalRepoIdentity.name !== name)) {
    diagnostics.push(
      submissionWarning(
        SUBMISSION_CODES.REPOSITORY_NOT_FOUND,
        `Repository canonical identity differs from submission: submitted "${owner}/${name}" but GitHub has "${canonicalRepoIdentity.owner}/${canonicalRepoIdentity.name}". Please update your submission to use the canonical name.`
      )
    );
  }

  builder.setGitHub({
    repositoryFound: true,
    repositoryArchived: repoInfo.isArchived,
    repositoryDisabled: repoInfo.isDisabled,
    repositoryPrivate: repoInfo.isPrivate,
    branchFound: true,
    resolvedCommitSha: resolvedSha,
    repositoryOwner: canonicalRepoIdentity?.owner ?? owner!,
    repositoryName: canonicalRepoIdentity?.name ?? name!,
  });

  // Step 8: Acquire source at exact SHA (with authentication token for private repos)
  const tempDir = join(cfg.tempDir!, `axolotl-inspection-${Date.now()}`);

  const acquisitionResult = await acquireSource(client, owner!, name!, resolvedSha, tempDir, false, cfg.githubToken);
  diagnostics.push(...acquisitionResult.diagnostics);

  if (!acquisitionResult.success || !acquisitionResult.sourcePath) {
    // Cleanup
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    // Determine error type based on diagnostic severity
    const hasInfrastructureErrors = acquisitionResult.diagnostics.some(
      (d) =>
        d.severity === 'infrastructure_error' ||
        (d.severity === 'error' && (d.code === 'SOURCE_TOO_LARGE' || d.code === 'SOURCE_TOO_MANY_FILES'))
    );

    return builder
      .setStatus(hasInfrastructureErrors ? InspectionStatus.INFRASTRUCTURE_ERROR : InspectionStatus.SUBMISSION_ERROR)
      .setSource({
        sourceAcquired: false,
        fileCount: 0,
        phpFileCount: 0,
        hasPluginYml: false,
        hasComposerJson: false,
        symlinkCount: 0,
        totalSizeBytes: 0,
      })
      .addDiagnostics(...diagnostics)
      .build();
  }

  const sourcePath = acquisitionResult.sourcePath;

  // Use values from acquisition result (fileList is already computed during extraction)
  const fileCount = acquisitionResult.fileCount ?? 0;
  const phpFileCount = acquisitionResult.phpFileCount ?? 0;
  const hasPluginYml = acquisitionResult.hasPluginYml ?? false;
  const hasComposerJson = acquisitionResult.hasComposerJson ?? false;
  const symlinkCount = acquisitionResult.symlinkCount ?? 0;
  const totalSizeBytes = acquisitionResult.totalSizeBytes ?? 0;
  const fileList = acquisitionResult.fileList ?? [];

  builder.setSource({
    sourceAcquired: true,
    sourcePath,
    fileCount,
    phpFileCount,
    hasPluginYml,
    hasComposerJson,
    symlinkCount,
    totalSizeBytes,
  });

  // Step 8: Parse plugin.yml
  let pluginMetadata: ReturnType<typeof parsePluginYaml>['metadata'];
  if (hasPluginYml) {
    const pluginYmlPath = join(sourcePath, 'plugin.yml');
    const pluginYmlRead = safeReadFile(pluginYmlPath);

    if (pluginYmlRead.success && pluginYmlRead.content) {
      const parseResult = parsePluginYaml(pluginYmlRead.content, 'plugin.yml');
      diagnostics.push(...parseResult.diagnostics);

      if (parseResult.success && parseResult.metadata) {
        pluginMetadata = parseResult.metadata;

        // Derive plugin ID
        const suggestedId = derivePluginId(pluginMetadata.name);
        const idValidation = validateDerivedPluginId(suggestedId);

        builder.setPluginMetadata(
          pluginMetadata,
          suggestedId,
          idValidation.valid
        );

        if (!idValidation.valid) {
          diagnostics.push(
            submissionWarning(
              SUBMISSION_CODES.PLUGIN_ID_PROPOSAL_INVALID,
              `Suggested plugin ID "${suggestedId}" is invalid: ${idValidation.error}`,
              { field: 'id' }
            )
          );
        }
      }
    } else if (pluginYmlRead.error) {
      diagnostics.push(
        submissionError(
          SUBMISSION_CODES.PLUGIN_YML_INVALID,
          `Failed to read plugin.yml: ${pluginYmlRead.error}`
        )
      );
    }
  } else {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.PLUGIN_YML_MISSING,
        'plugin.yml not found in repository root'
      )
    );
  }

  // Step 9: Parse composer.json
  if (hasComposerJson) {
    const composerJsonPath = join(sourcePath, 'composer.json');
    const composerJsonRead = safeReadFile(composerJsonPath);

    if (composerJsonRead.success && composerJsonRead.content) {
      const parseResult = parseComposerJson(composerJsonRead.content, 'composer.json');
      diagnostics.push(...parseResult.diagnostics);

      if (parseResult.present && parseResult.metadata) {
        builder.setComposerMetadata(parseResult.metadata);
      }
    }
  }

  // Step 10: Generate review signals from PHP files
  const phpFiles = fileList.filter((f) => extname(f) === '.php');
  const signalResults = [];
  for (const phpFile of phpFiles.slice(0, 100)) {
    // Limit to first 100 PHP files
    const filePath = join(sourcePath, phpFile);
    const fileContent = safeReadFile(filePath, 512 * 1024); // 512KB per file

    if (fileContent.success && fileContent.content) {
      const result = analyzePhpFile(fileContent.content, phpFile);
      signalResults.push(result);
    }
  }

  // Check for committed PHAR files
  const pharSignals = checkForCommittedPhar(fileList);

  // Aggregate signals
  const { signals, diagnostics: signalDiagnostics } = aggregateSignals(signalResults);
  diagnostics.push(...signalDiagnostics);
  diagnostics.push(...pharSignals);

  builder.setReviewSignals(signals);

  // Cleanup source
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  // Determine final status
  // READY_FOR_REVIEW requires:
  // - No submission errors
  // - No infrastructure errors
  // - All required stages completed

  const submissionErrors = diagnostics.filter(
    (d) => d.severity === 'error'
  );
  const infrastructureErrors = diagnostics.filter(
    (d) => d.severity === 'infrastructure_error'
  );
  const criticalSignals = diagnostics.filter(
    (d) => d.code === 'PLUGIN_YML_MISSING' || d.code === 'SOURCE_TOO_LARGE' || d.code === 'SOURCE_TOO_MANY_FILES'
  );

  // Determine if we should be READY_FOR_REVIEW
  const hasSubmissionErrors = submissionErrors.length > 0 || criticalSignals.length > 0;
  const hasInfrastructureErrors = infrastructureErrors.length > 0;
  const hasRequiredCompletions =
    repoResult.success &&
    branchResult.success &&
    acquisitionResult.success &&
    acquisitionResult.sourcePath;

  const status = !hasRequiredCompletions
    ? InspectionStatus.SUBMISSION_ERROR
    : hasInfrastructureErrors
      ? InspectionStatus.INFRASTRUCTURE_ERROR
      : hasSubmissionErrors
        ? InspectionStatus.SUBMISSION_ERROR
        : InspectionStatus.READY_FOR_REVIEW;

  builder.setStatus(status);
  builder.addDiagnostics(...diagnostics);

  return builder.build();
}

// ============================================================
// Validation Helpers
// ============================================================

function validateSubmissionFile(
  path: string
): {
  success: boolean;
  content?: string;
  filename?: string;
  slug?: string;
  diagnostics: SubmissionDiagnostic[];
} {
  const diagnostics: SubmissionDiagnostic[] = [];

  // Check if file exists
  if (!existsSync(path)) {
    return {
      success: false,
      diagnostics: [
        submissionError(
          SUBMISSION_CODES.SUBMISSION_INVALID_FILENAME,
          `Submission file not found: ${path}`
        ),
      ],
    };
  }

  // Check if it's a file
  if (!statSync(path).isFile()) {
    return {
      success: false,
      diagnostics: [
        submissionError(
          SUBMISSION_CODES.SUBMISSION_INVALID_FILENAME,
          `Path is not a file: ${path}`
        ),
      ],
    };
  }

  // Extract filename
  const filename = path.split(/[/\\]/).pop() || path;

  // Validate filename
  const filenameValidation = validateSubmissionFilename(filename);
  if (!filenameValidation.valid) {
    return {
      success: false,
      diagnostics: [
        submissionError(
          SUBMISSION_CODES.SUBMISSION_INVALID_FILENAME,
          filenameValidation.error || 'Invalid submission filename',
          { file: filename }
        ),
      ],
    };
  }

  // Check extension
  const ext = extname(filename).toLowerCase();
  if (ext !== '.yaml' && ext !== '.yml') {
    return {
      success: false,
      diagnostics: [
        submissionError(
          SUBMISSION_CODES.SUBMISSION_INVALID_EXTENSION,
          `Invalid file extension: ${ext}. Must be .yaml or .yml`,
          { file: filename }
        ),
      ],
    };
  }

  // Read content
  let content: string;
  try {
    content = readFileSync(path, 'utf-8');
  } catch (e) {
    return {
      success: false,
      diagnostics: [
        submissionError(
          SUBMISSION_CODES.SUBMISSION_INVALID_FILENAME,
          `Failed to read file: ${e instanceof Error ? e.message : 'Unknown error'}`
        ),
      ],
    };
  }

  return {
    success: true,
    content,
    filename,
    slug: filenameValidation.slug,
    diagnostics,
  };
}

// ============================================================
// Report Generation
// ============================================================

export function generateReport(
  result: SubmissionInspectionResult,
  format: 'text' | 'json' = 'text'
): string {
  if (format === 'json') {
    return generateJsonOutput(result);
  }
  return generateHumanReadableReport(result);
}

// ============================================================
// Exports
// ============================================================

export { createGitHubClient } from './github.js';
export * from './diagnostics.js';
export * from './schema.js';
export * from './plugin-yml.js';
export * from './composer.js';
export * from './signals.js';
export * from './result.js';
export * from './acquisition.js';
