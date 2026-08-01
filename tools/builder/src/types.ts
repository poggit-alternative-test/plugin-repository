/**
 * Build Domain Types
 *
 * Defines the core domain model for the Build Domain.
 *
 * The Build Domain transforms materialized source (from M5) into verified
 * PHAR artifacts. It has no publication credentials and cannot write
 * to storage or create releases.
 *
 * Design decisions:
 * - Branded types for SHA, version, and identifier safety
 * - Separated request/result types for clarity
 * - Diagnostic types follow the existing pattern from other domains
 * - Build states are simple (pending, building, complete, failed)
 *   since the build itself is atomic per invocation
 */

// ============================================================
// Core Value Types
// ============================================================

/** 40-character Git SHA-1 commit identifier */
export type GitSha = string & { readonly brand: unique symbol };

/** SHA-256 hexadecimal checksum */
export type Sha256 = string & { readonly brand: unique symbol };

/** Semantic version string (SemVer 2.0.0) */
export type SemVer = string & { readonly brand: unique symbol };

/** Stable plugin identifier */
export type PluginId = string & { readonly brand: unique symbol };

/** GitHub repository in owner/name format */
export type RepositoryIdentity = string & { readonly brand: unique symbol };

/** Materialization ID from M5 (SHA-256 of candidate identity) */
export type MaterializationId = string & { readonly brand: unique symbol };

// ============================================================
// Source Provenance Types
// ============================================================

/**
 * Provenance linking build to source and materialization.
 *
 * This establishes the trust chain:
 * - The exact upstream commit that was reviewed (M4)
 * - The storage where it was preserved (M5)
 * - The materialization that made it available for build
 */
export interface BuildSourceProvenance {
  /** Upstream repository where plugin was submitted */
  upstreamRepository: RepositoryIdentity;
  /** Branch that was submitted */
  upstreamBranch: string;
  /** Exact SHA that was approved in M4 review */
  upstreamCommit: GitSha;
  /** Storage repository containing preserved source */
  storageRepository: RepositoryIdentity;
  /** Branch of storage repository */
  storageBranch: string;
  /** Exact SHA in storage repository that was materialized */
  storageCommit: GitSha;
  /** Materialization ID from M5 */
  materializationId: MaterializationId;
  /** When the source was materialized */
  materializedAt: string; // ISO 8601
  /** When the source was approved in M4 */
  approvedAt: string; // ISO 8601
  /** When the inspection was completed */
  inspectedAt: string; // ISO 8601
}

// ============================================================
// Plugin Metadata Types
// ============================================================

/**
 * Parsed plugin.yml metadata for the plugin being built.
 */
export interface PluginMetadata {
  /** Plugin name from plugin.yml */
  name: string;
  /** Version from plugin.yml (may differ from registry version) */
  version: string;
  /** Main class fully qualified name */
  mainClass: string;
  /** API version from plugin.yml (e.g., "3.0.0") */
  apiVersion: string;
  /** Primary author from plugin.yml */
  author?: string;
  /** All authors from plugin.yml (authors array takes precedence) */
  authors?: string[];
  /** Description from plugin.yml */
  description?: string;
  /** Website from plugin.yml */
  website?: string;
  /** PHP version requirement from plugin.yml */
  php?: string | string[];
  /** Commands defined by the plugin */
  commands?: PluginCommand[];
  /** Permissions defined by the plugin */
  permissions?: PluginPermission[];
}

/**
 * Command definition from plugin.yml
 */
export interface PluginCommand {
  name: string;
  description?: string;
  usage?: string;
}

/**
 * Permission definition from plugin.yml
 */
export interface PluginPermission {
  name: string;
  description?: string;
  defaultValue?: string;
}

// ============================================================
// Build Request
// ============================================================

/**
 * A build request initiates PHAR construction from materialized source.
 *
 * The build request is derived from the registry version record
 * (status: materialized) and includes all provenance information
 * needed to establish the artifact chain.
 */
export interface BuildRequest {
  /** Stable plugin identifier */
  pluginId: PluginId;
  /** Version being built */
  version: SemVer;
  /** Source provenance chain */
  provenance: BuildSourceProvenance;
  /** Path to the checked-out source directory */
  sourcePath: string;
  /** Expected SHA-256 of the source tree (from M5) */
  expectedTreeSha256: Sha256;
}

// ============================================================
// Build Artifact Types
// ============================================================

/**
 * Result of PHAR construction.
 */
export interface BuildArtifact {
  /** Path to the built PHAR file */
  pharPath: string;
  /** Filename of the PHAR */
  filename: string;
  /** Size of the PHAR in bytes */
  sizeBytes: number;
  /** SHA-256 of the PHAR contents */
  sha256: Sha256;
  /** Number of files included in the PHAR */
  fileCount: number;
  /** SHA-256 of the source tree (computed during build) */
  computedTreeSha256: Sha256;
  /** Whether tree SHA matches expected */
  treeShaVerified: boolean;
}

/**
 * Checksum manifest for build artifacts.
 */
export interface BuildChecksumManifest {
  /** SHA-256 checksums for each artifact file */
  checksums: BuildChecksum[];
  /** Full manifest text (one line per file: "sha256  filename") */
  manifestText: string;
}

/**
 * Single file checksum entry.
 */
export interface BuildChecksum {
  /** SHA-256 hexadecimal digest */
  sha256: Sha256;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  sizeBytes: number;
}

/**
 * Build metadata document (metadata.json).
 */
export interface BuildMetadata {
  /** Schema version for this document format */
  schemaVersion: 1;
  /** Plugin identifier */
  pluginId: PluginId;
  /** Plugin name from plugin.yml */
  pluginName: string;
  /** Version being built */
  version: SemVer;
  /** API version from plugin.yml */
  apiVersion: string;
  /** SHA-256 of the PHAR artifact */
  pharSha256: Sha256;
  /** Size of the PHAR in bytes */
  pharSizeBytes: number;
  /** Number of files in the PHAR */
  pharFileCount: number;
  /** When the build was executed */
  buildTimestamp: string; // ISO 8601
  /** Source provenance */
  provenance: BuildSourceProvenance;
  /** Computed tree SHA (must match expected) */
  treeSha256: Sha256;
  /** Build environment info */
  environment: BuildEnvironment;
}

/**
 * Build environment information for reproducibility.
 */
export interface BuildEnvironment {
  /** PHP version used */
  phpVersion: string;
  /** PHAR builder version or identifier */
  builderVersion: string;
  /** Operating system */
  os: string;
}

// ============================================================
// Build Result Types
// ============================================================

/**
 * Result of a build execution.
 */
export interface BuildResult {
  /** Whether the build succeeded */
  success: boolean;
  /** The original build request */
  request: BuildRequest;
  /** Built PHAR artifact (if success) */
  artifact?: BuildArtifact;
  /** Checksum manifest (if success) */
  checksums?: BuildChecksumManifest;
  /** Metadata document (if success) */
  metadata?: BuildMetadata;
  /** Parsed plugin metadata (if success) */
  pluginMetadata?: PluginMetadata;
  /** Build duration in milliseconds */
  durationMs: number;
  /** Any errors encountered */
  errors: BuildError[];
  /** Any warnings generated */
  warnings: BuildWarning[];
  /** Any security signals detected */
  securitySignals: BuildSecuritySignal[];
}

/**
 * Build execution errors that caused failure.
 */
export interface BuildError {
  /** Error code for programmatic handling */
  code: BuildErrorCode;
  /** Human-readable message */
  message: string;
  /** Optional additional context */
  details?: Record<string, unknown>;
}

/**
 * Build warnings that do not cause failure.
 */
export interface BuildWarning {
  /** Warning code */
  code: BuildWarningCode;
  /** Human-readable message */
  message: string;
  /** Optional additional context */
  context?: Record<string, unknown>;
}

/**
 * Security signals detected during build.
 *
 * These are informational flags for review, not automatic rejections.
 */
export interface BuildSecuritySignal {
  /** Signal type */
  type: SecuritySignalType;
  /** Severity level */
  severity: SecuritySignalSeverity;
  /** Description of what was found */
  message: string;
  /** File containing the signal (if applicable) */
  file?: string;
  /** Line number (if applicable) */
  line?: number;
  /** Pattern that triggered the signal (if applicable) */
  pattern?: string;
}

// ============================================================
// Security Signal Types
// ============================================================

export enum SecuritySignalSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum SecuritySignalType {
  /** Dangerous PHP function call detected */
  DANGEROUS_FUNCTION = 'DANGEROUS_FUNCTION',
  /** Base64-encoded content detected */
  BASE64_CONTENT = 'BASE64_CONTENT',
  /** Embedded binary content detected */
  EMBEDDED_BINARY = 'EMBEDDED_BINARY',
  /** Committed PHAR file detected */
  COMMITTED_PHAR = 'COMMITTED_PHAR',
  /** Potential obfuscated code */
  OBFUSCATION = 'OBFUSCATION',
  /** System command execution detected */
  SYSTEM_EXECUTION = 'SYSTEM_EXECUTION',
  /** File operations outside plugin directory */
  PATH_ESCAPE = 'PATH_ESCAPE',
  /** Network request to external server */
  EXTERNAL_NETWORK = 'EXTERNAL_NETWORK',
}

// ============================================================
// Error and Warning Codes
// ============================================================

export const BUILD_ERROR_CODES = {
  // Source validation errors
  SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
  SOURCE_PATH_INVALID: 'SOURCE_PATH_INVALID',
  SOURCE_TREE_SHA_MISMATCH: 'SOURCE_TREE_SHA_MISMATCH',

  // plugin.yml errors
  PLUGIN_YML_MISSING: 'PLUGIN_YML_MISSING',
  PLUGIN_YML_INVALID: 'PLUGIN_YML_INVALID',
  PLUGIN_YML_SIZE_EXCEEDED: 'PLUGIN_YML_SIZE_EXCEEDED',
  PLUGIN_NAME_MISSING: 'PLUGIN_NAME_MISSING',
  PLUGIN_VERSION_MISSING: 'PLUGIN_VERSION_MISSING',
  PLUGIN_MAIN_MISSING: 'PLUGIN_MAIN_MISSING',
  PLUGIN_API_MISSING: 'PLUGIN_API_MISSING',

  // Composer errors
  COMPOSER_JSON_INVALID: 'COMPOSER_JSON_INVALID',
  COMPOSER_SCRIPTS_DETECTED: 'COMPOSER_SCRIPTS_DETECTED',
  COMPOSER_PLUGINS_DETECTED: 'COMPOSER_PLUGINS_DETECTED',
  COMPOSER_LOCK_MISSING: 'COMPOSER_LOCK_MISSING',
  COMPOSER_INSTALL_FAILED: 'COMPOSER_INSTALL_FAILED',

  // PHAR build errors
  PHAR_BUILD_FAILED: 'PHAR_BUILD_FAILED',
  PHAR_VALIDATION_FAILED: 'PHAR_VALIDATION_FAILED',
  PHAR_FILE_COUNT_EXCEEDED: 'PHAR_FILE_COUNT_EXCEEDED',
  PHAR_SIZE_EXCEEDED: 'PHAR_SIZE_EXCEEDED',
  PHAR_MAIN_CLASS_INVALID: 'PHAR_MAIN_CLASS_INVALID',
  PHAR_STUB_INVALID: 'PHAR_STUB_INVALID',

  // PHAR content validation errors
  PHAR_CONTAINS_GIT: 'PHAR_CONTAINS_GIT',
  PHAR_CONTAINS_SYMLINK: 'PHAR_CONTAINS_SYMLINK',
  PHAR_CONTAINS_PATH_TRAVERSAL: 'PHAR_CONTAINS_PATH_TRAVERSAL',
  PHAR_CONTAINS_UNEXPECTED_FILE: 'PHAR_CONTAINS_UNEXPECTED_FILE',

  // Security errors (hard blocks)
  SECURITY_SIGNAL_CRITICAL: 'SECURITY_SIGNAL_CRITICAL',

  // Checksum/metadata errors
  CHECKSUM_GENERATION_FAILED: 'CHECKSUM_GENERATION_FAILED',
  METADATA_GENERATION_FAILED: 'METADATA_GENERATION_FAILED',

  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type BuildErrorCode = (typeof BUILD_ERROR_CODES)[keyof typeof BUILD_ERROR_CODES];

export const BUILD_WARNING_CODES = {
  // Size warnings
  LARGE_FILE_DETECTED: 'LARGE_FILE_DETECTED',
  LARGE_ARCHIVE_SIZE: 'LARGE_ARCHIVE_SIZE',
  MANY_FILES: 'MANY_FILES',

  // Structure warnings
  VENDOR_DIR_DETECTED: 'VENDOR_DIR_DETECTED',
  NO_RESOURCES_DIR: 'NO_RESOURCES_DIR',
  NO_COMPOSER_LOCK: 'NO_COMPOSER_LOCK',

  // Dependency warnings
  DEV_DEPENDENCIES_EXCLUDED: 'DEV_DEPENDENCIES_EXCLUDED',

  // Security warnings (soft blocks)
  SECURITY_SIGNAL_MEDIUM: 'SECURITY_SIGNAL_MEDIUM',
  SECURITY_SIGNAL_HIGH: 'SECURITY_SIGNAL_HIGH',

  // Other warnings
  COMPOSER_AUTOLOAD_SLOW: 'COMPOSER_AUTOLOAD_SLOW',
} as const;

export type BuildWarningCode = (typeof BUILD_WARNING_CODES)[keyof typeof BUILD_WARNING_CODES];

// ============================================================
// Diagnostic Helpers
// ============================================================

export enum BuildSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

export interface BuildDiagnostic {
  code: BuildErrorCode | BuildWarningCode;
  severity: BuildSeverity;
  message: string;
  context?: Record<string, unknown>;
}

export function buildError(
  code: BuildErrorCode,
  message: string,
  context?: Record<string, unknown>
): BuildDiagnostic {
  return { code, severity: BuildSeverity.ERROR, message, context };
}

export function buildWarning(
  code: BuildWarningCode,
  message: string,
  context?: Record<string, unknown>
): BuildDiagnostic {
  return { code, severity: BuildSeverity.WARNING, message, context };
}

export function isBuildError(diagnostic: BuildDiagnostic): boolean {
  return diagnostic.severity === BuildSeverity.ERROR;
}

export function isBuildWarning(diagnostic: BuildDiagnostic): boolean {
  return diagnostic.severity === BuildSeverity.WARNING;
}

export function getBuildErrors(diagnostics: BuildDiagnostic[]): BuildDiagnostic[] {
  return diagnostics.filter(isBuildError);
}

export function getBuildWarnings(diagnostics: BuildDiagnostic[]): BuildDiagnostic[] {
  return diagnostics.filter(isBuildWarning);
}

export function hasBuildErrors(diagnostics: BuildDiagnostic[]): boolean {
  return diagnostics.some(isBuildError);
}

// ============================================================
// Validation Functions
// ============================================================

/** Validate a Git SHA string */
export function isValidGitSha(value: string): value is GitSha {
  return /^[a-f0-9]{40}$/i.test(value);
}

/** Validate a SHA-256 string */
export function isValidSha256(value: string): value is Sha256 {
  return /^[a-f0-9]{64}$/i.test(value);
}

/** Validate a SemVer string */
export function isValidSemVer(value: string): value is SemVer {
  return /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$/i.test(value);
}

/** Validate a plugin ID string */
export function isValidPluginId(value: string): value is PluginId {
  if (value.length === 0 || value.length > 64) return false;
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/i.test(value) || /^[a-z0-9]$/i.test(value);
}

/** Validate a repository identity string (owner/name) */
export function isValidRepositoryIdentity(value: string): value is RepositoryIdentity {
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(value);
}

/** Validate a materialization ID string (SHA-256) */
export function isValidMaterializationId(value: string): value is MaterializationId {
  return isValidSha256(value);
}

// ============================================================
// Type Guards
// ============================================================

/** Check if a result represents a successful build */
export function isBuildSuccess(result: BuildResult): boolean {
  return result.success;
}

/** Check if a result represents a failed build */
export function isBuildFailure(result: BuildResult): boolean {
  return !result.success;
}

/** Check if there are any critical security signals */
export function hasCriticalSecuritySignals(result: BuildResult): boolean {
  return result.securitySignals.some(
    (s) => s.severity === SecuritySignalSeverity.CRITICAL
  );
}

/** Check if there are any high/medium security signals */
export function hasSecuritySignals(result: BuildResult): boolean {
  return result.securitySignals.length > 0;
}
