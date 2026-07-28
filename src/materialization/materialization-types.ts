/** Domain model for M5 trusted source materialization. */

export type GitSha = string & { readonly brand: unique symbol };
export type Sha256 = string & { readonly brand: unique symbol };
export type SemVer = string & { readonly brand: unique symbol };
export type PluginId = string & { readonly brand: unique symbol };
export type RepositoryIdentity = string & { readonly brand: unique symbol };

export interface SourceRef {
  repository: RepositoryIdentity;
  branch: string;
  commitSha: GitSha;
}

export interface SourceIntegrity {
  /** SHA-256 of the exact acquired archive bytes. */
  archiveSha256: Sha256;
  /** SHA-256 of the documented canonical source-tree byte stream. */
  treeSha256: Sha256;
  fileCount: number;
  totalSizeBytes: number;
  /** The source acquisition uses the M4-approved exact ref, never a branch. */
  acquiredSha: GitSha;
}

export interface TrustedM4Approval {
  candidateIdentity: string;
  approvalDecisionId: string;
  pluginId: PluginId;
  upstreamRepository: RepositoryIdentity;
  upstreamBranch: string;
  approvedSha: GitSha;
  reviewerId: string;
  reviewApprovedAt: string;
  inspectionCompletedAt: string;
}

export interface MaterializationAction {
  action: 'create-repository' | 'commit-source' | 'commit-provenance';
  repository: RepositoryIdentity;
  branch: string;
  /** Immutable, deterministic directory for this exact approved candidate. */
  pathPrefix?: string;
}

/**
 * A plan is a preview/retry descriptor only. It is deliberately not an
 * authorization credential: executePlan independently resolves M4 again.
 */
export interface MaterializationPlan {
  schemaVersion: 2;
  materializationId: Sha256;
  m4CandidateIdentity: string;
  m4ApprovalDecisionId: string;
  pluginId: PluginId;
  version: SemVer;
  source: SourceRef;
  sourceIntegrity: SourceIntegrity;
  storageRepository: RepositoryIdentity;
  storageBranch: string;
  sourcePath: string;
  provenancePath: string;
  actions: MaterializationAction[];
  dryRun: boolean;
  generatedAt: string;
}

export interface ProvenanceRecord {
  schemaVersion: 2;
  materializationId: Sha256;
  m4CandidateIdentity: string;
  m4ApprovalDecisionId: string;
  pluginId: PluginId;
  version: SemVer;
  upstreamRepository: RepositoryIdentity;
  upstreamBranch: string;
  upstreamCommit: GitSha;
  /** The source commit that contains the immutable materialized tree. */
  storageCommit: GitSha;
  storageRepository: RepositoryIdentity;
  storageBranch: string;
  canonicalProvenancePath: string;
  materializedAt: string;
  materializedBy: string;
  materializerVersion: string;
  reviewApprovedAt: string;
  inspectionCompletedAt: string;
  sourceIntegrity: SourceIntegrity;
}

export interface MaterializationResult {
  success: boolean;
  alreadyMaterialized: boolean;
  pluginId: PluginId;
  version: SemVer;
  plan: MaterializationPlan;
  provenance?: ProvenanceRecord;
  executedActions: number;
  failedActions: number;
  durationMs: number;
  errors: MaterializationError[];
  warnings: MaterializationWarning[];
}

/**
 * Opaque write capability issued by a trusted MaterializationService instance.
 * It is intentionally independent of serialized MaterializationPlan data.
 */
export interface TrustedExecutionContext {
  readonly kind: 'trusted-m5-execution-context';
}

export interface MaterializationError {
  actionIndex: number;
  code: MaterializationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
export interface MaterializationWarning {
  code: MaterializationWarningCode;
  message: string;
  context?: Record<string, unknown>;
}

export const MATERIALIZATION_CODES = {
  PLAN_GENERATION_FAILED: 'PLAN_GENERATION_FAILED',
  INVALID_CANDIDATE_STATE: 'INVALID_CANDIDATE_STATE',
  CANDIDATE_NOT_APPROVED: 'CANDIDATE_NOT_APPROVED',
  M4_STATE_UNAVAILABLE: 'M4_STATE_UNAVAILABLE',
  M4_IDENTITY_MISMATCH: 'M4_IDENTITY_MISMATCH',
  APPROVED_SHA_MISMATCH: 'APPROVED_SHA_MISMATCH',
  PLAN_REVALIDATION_FAILED: 'PLAN_REVALIDATION_FAILED',
  PLAN_TAMPERED: 'PLAN_TAMPERED',
  MATERIALIZATION_CONFLICT: 'MATERIALIZATION_CONFLICT',
  CONCURRENCY_CONFLICT: 'CONCURRENCY_CONFLICT',
  ALREADY_MATERIALIZED: 'ALREADY_MATERIALIZED',
  STORAGE_REPOSITORY_INVALID: 'STORAGE_REPOSITORY_INVALID',
  STORAGE_OWNER_NOT_ALLOWED: 'STORAGE_OWNER_NOT_ALLOWED',
  INVALID_STORAGE_OWNER: 'INVALID_STORAGE_OWNER',
  INVALID_REPOSITORY_NAME: 'INVALID_REPOSITORY_NAME',
  INVALID_PLUGIN_ID: 'INVALID_PLUGIN_ID',
  INVALID_VERSION: 'INVALID_VERSION',
  INVALID_SHA: 'INVALID_SHA',
  SOURCE_FETCH_FAILED: 'SOURCE_FETCH_FAILED',
  SOURCE_ARCHIVE_MISSING: 'SOURCE_ARCHIVE_MISSING',
  SOURCE_ARCHIVE_CORRUPTED: 'SOURCE_ARCHIVE_CORRUPTED',
  SOURCE_CHECKSUM_MISMATCH: 'SOURCE_CHECKSUM_MISMATCH',
  SOURCE_PATH_INVALID: 'SOURCE_PATH_INVALID',
  GITHUB_CLIENT_ERROR: 'GITHUB_CLIENT_ERROR',
  GITHUB_RATE_LIMITED: 'GITHUB_RATE_LIMITED',
  GITHUB_REPOSITORY_EXISTS: 'GITHUB_REPOSITORY_EXISTS',
  GITHUB_REPOSITORY_NOT_FOUND: 'GITHUB_REPOSITORY_NOT_FOUND',
  GITHUB_BRANCH_NOT_FOUND: 'GITHUB_BRANCH_NOT_FOUND',
  GITHUB_COMMIT_FAILED: 'GITHUB_COMMIT_FAILED',
  GITHUB_UPLOAD_FAILED: 'GITHUB_UPLOAD_FAILED',
  GITHUB_PERMISSION_DENIED: 'GITHUB_PERMISSION_DENIED',
  GITHUB_UNAUTHORIZED: 'GITHUB_UNAUTHORIZED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  ACTION_SEQUENCE_INVALID: 'ACTION_SEQUENCE_INVALID',
  ATOMICITY_VIOLATION: 'ATOMICITY_VIOLATION',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  WRITE_MODE_NOT_ENABLED: 'WRITE_MODE_NOT_ENABLED',
  PROVENANCE_SAVE_FAILED: 'PROVENANCE_SAVE_FAILED',
  PROVENANCE_NOT_FOUND: 'PROVENANCE_NOT_FOUND',
  PROVENANCE_INVALID: 'PROVENANCE_INVALID',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;
export type MaterializationErrorCode = (typeof MATERIALIZATION_CODES)[keyof typeof MATERIALIZATION_CODES];

export const MATERIALIZATION_WARNINGS = {
  DRY_RUN_MODE: 'DRY_RUN_MODE',
  STORAGE_OWNER_WARNING: 'STORAGE_OWNER_WARNING',
  RATE_LIMIT_APPROACHING: 'RATE_LIMIT_APPROACHING',
  LARGE_FILE_COUNT: 'LARGE_FILE_COUNT',
  FILE_COUNT_EXCEEDS_RECOMMENDATION: 'FILE_COUNT_EXCEEDS_RECOMMENDATION',
  SYMLINKS_IGNORED: 'SYMLINKS_IGNORED',
  VENDOR_DIR_DETECTED: 'VENDOR_DIR_DETECTED',
  LARGE_ARCHIVE_SIZE: 'LARGE_ARCHIVE_SIZE',
  CHECKSUM_NOT_VERIFIED: 'CHECKSUM_NOT_VERIFIED',
  ARCHIVE_AGE_UNCERTAIN: 'ARCHIVE_AGE_UNCERTAIN',
} as const;
export type MaterializationWarningCode = (typeof MATERIALIZATION_WARNINGS)[keyof typeof MATERIALIZATION_WARNINGS];

export enum ProvenanceStatus { PENDING = 'pending', COMPLETED = 'completed', FAILED = 'failed' }
export enum MaterializationSeverity { ERROR = 'error', WARNING = 'warning', INFO = 'info' }
export interface MaterializationDiagnostic { code: MaterializationErrorCode | MaterializationWarningCode; severity: MaterializationSeverity; message: string; context?: Record<string, unknown>; }
export function materializationError(code: MaterializationErrorCode, message: string, context?: Record<string, unknown>): MaterializationDiagnostic { return { code, severity: MaterializationSeverity.ERROR, message, context }; }
export function materializationWarning(code: MaterializationWarningCode, message: string, context?: Record<string, unknown>): MaterializationDiagnostic { return { code, severity: MaterializationSeverity.WARNING, message, context }; }
export function isMaterializationError(d: MaterializationDiagnostic): boolean { return d.severity === MaterializationSeverity.ERROR; }
export function getMaterializationErrors(diagnostics: MaterializationDiagnostic[]): MaterializationDiagnostic[] { return diagnostics.filter(isMaterializationError); }
export function hasMaterializationErrors(diagnostics: MaterializationDiagnostic[]): boolean { return diagnostics.some(isMaterializationError); }
export function isValidGitSha(value: string): value is GitSha { return /^[a-f0-9]{40}$/i.test(value); }
export function isValidSha256(value: string): value is Sha256 { return /^[a-f0-9]{64}$/i.test(value); }
export function isValidSemVer(value: string): value is SemVer { return /^\d+\.\d+\.\d+(-[a-z0-9.]+)?(\+[a-z0-9.]+)?$/i.test(value); }
export function isValidPluginId(value: string): value is PluginId { return value.length === 1 ? /^[a-z0-9]$/i.test(value) : /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/i.test(value); }
export function isValidRepositoryIdentity(value: string): value is RepositoryIdentity { return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(value); }
export function isAllowedStorageOwner(repository: RepositoryIdentity, allowedOwners: string[]): boolean { return allowedOwners.map((owner) => owner.toLowerCase()).includes(repository.split('/')[0]?.toLowerCase() ?? ''); }
