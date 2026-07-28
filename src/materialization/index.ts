/**
 * Materialization Module
 *
 * M5: Trusted Source Materialization
 *
 * Exports all materialization domain types and services.
 */

// Domain types
export {
  type GitSha,
  type Sha256,
  type SemVer,
  type PluginId,
  type RepositoryIdentity,
  type MaterializationPlan,
  type MaterializationAction,
  type MaterializationResult,
  type TrustedExecutionContext,
  type ProvenanceRecord,
  type MaterializationError,
  type MaterializationWarning,
  type MaterializationDiagnostic,
  type SourceRef,
  type SourceIntegrity,
  type TrustedM4Approval,
  ProvenanceStatus,
  MATERIALIZATION_CODES,
  MATERIALIZATION_WARNINGS,
  type MaterializationErrorCode,
  type MaterializationWarningCode,
  MaterializationSeverity,
  isValidGitSha,
  isValidSha256,
  isValidSemVer,
  isValidPluginId,
  isValidRepositoryIdentity,
  isAllowedStorageOwner,
  materializationError,
  materializationWarning,
  isMaterializationError,
  getMaterializationErrors,
  hasMaterializationErrors,
} from './materialization-types.js';

// GitHub client
export {
  type GitHubClient,
  type CreateRepositoryResult,
  type UploadFileResult,
  type CreateCommitResult,
  type RepositoryInfo,
  type BranchInfo,
  type RepositoryFile,
  type GitHubClientError,
  type FakeGitHubClientConfig,
  type GitHubClientType,
  FakeGitHubClient,
  RealGitHubClient,
  createGitHubClient,
  isRateLimitError,
} from './github-client.js';

// Repository naming
export {
  DEFAULT_STORAGE_BRANCH,
  MAX_REPO_NAME_LENGTH,
  type RepositoryNameValidationResult,
  validateRepositoryName,
  pluginIdToRepoName,
  buildRepositoryIdentity,
  parseRepositoryIdentity,
  type StoragePathConfig,
  type StoragePaths,
  generateStoragePaths,
} from './repository-naming.js';

// Materialization service
export {
  type MaterializationServiceConfig,
  type ApprovedCandidateInfo,
  type TrustedM4ApprovalStore,
  type ExactSourceAcquirer,
  type MaterializationArchiveLimits,
  MATERIALIZATION_ARCHIVE_LIMITS,
  ArchiveDirectorySourceAcquirer,
  GitHubExactSourceAcquirer,
  FileM4ApprovalStore,
  materializeArchive,
  MaterializationService,
  createMaterializationService,
  DEFAULT_MATERIALIZATION_CONFIG,
} from './materialization-service.js';

// GitHub App Authentication
export {
  type GitHubAppConfig,
  type InstallationAccessToken,
  type GitHubAppAuthError,
  type InstallationInfo,
  GitHubAppAuth,
  loadGitHubAppConfig,
} from './github-app-auth.js';

// Tester Transport Configuration
export {
  type TesterTransportConfig,
  PRODUCTION_ORGANIZATIONS,
  TESTER_ORGANIZATION,
  DEFAULT_TESTER_CONFIG,
  READONLY_TESTER_CONFIG,
  isAllowedTesterRepository,
  isAllowedTesterOwner,
  loadTesterConfigFromEnv,
  validateTesterConfig,
} from './tester-transport-config.js';

// Real GitHub Client implementation
export {
  type RealGitHubClientConfig,
  RealGitHubClientImpl,
  createRealGitHubClient,
} from './real-github-client.js';
