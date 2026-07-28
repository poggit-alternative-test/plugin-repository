/**
 * Submission Inspection Module
 *
 * Exports all submission-related types and utilities.
 */

// Diagnostics
export {
  SUBMISSION_CODES,
  DiagnosticSeverity,
  type SubmissionDiagnostic,
  type SubmissionDiagnosticCode,
  submissionError,
  submissionWarning,
  reviewSignal,
  infrastructureError,
  isInfrastructureError,
  isSubmissionError,
  isReviewSignal,
  getErrors,
  getWarnings,
  getReviewSignals,
  getInfrastructureErrors,
  hasErrors,
  hasInfrastructureErrors,
} from './diagnostics.js';

// Schema
export {
  PluginSubmissionSchema,
  SCHEMA_VERSION,
  validateSubmissionFilename,
  findForbiddenFields,
  parseSubmission,
  parseRepositoryIdentity,
  validateBranch,
  type ParsedSubmission,
  type SubmissionParseResult,
} from './schema.js';

// GitHub Client
export {
  type GitHubClient,
  type GitHubClientConfig,
  type RepositoryInfo,
  type BranchInfo,
  type CommitInfo,
  type GitHubTreeItem,
  type GitHubResult,
  createGitHubClient,
  RealGitHubClient,
} from './github.js';

// Plugin YAML
export {
  PLUGIN_YML_MAX_SIZE,
  PocketMinePluginSchema,
  parsePluginYaml,
  derivePluginId,
  validateDerivedPluginId,
  extractNamespace,
  type ParsedPluginMetadata,
  type PluginMetadataParseResult,
} from './plugin-yml.js';

// Composer
export {
  COMPOSER_JSON_MAX_SIZE,
  parseComposerJson,
  isWordPressPlugin,
  hasNetworkDependencies,
  getAutoloadType,
  type ParsedComposerMetadata,
  type ComposerParseResult,
} from './composer.js';

// Review Signals
export {
  SignalCategory,
  SignalSeverity,
  analyzePhpFile,
  checkForCommittedPhar,
  aggregateSignals,
  type ReviewSignal,
  type FileSignalResult,
} from './signals.js';

// Source Acquisition
export {
  LIMITS,
  acquireSource,
  safeReadFile,
  validateExtractionPath,
  isPathEscape,
  validateArchiveUrl,
  type ArchiveUrlValidation,
  type SourceAcquisitionResult,
} from './acquisition.js';

// Result Model
export {
  InspectionStatus,
  type SubmissionContext,
  type GitHubResolution,
  type SourceAnalysis,
  type SubmissionInspectionResult,
  SubmissionInspectionResultBuilder,
  generateHumanReadableReport,
  generateJsonOutput,
} from './result.js';

// Main Inspection Pipeline
export {
  inspectSubmission,
  generateReport,
  type InspectionConfig,
} from './inspection.js';
