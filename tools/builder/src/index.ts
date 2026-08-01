/**
 * Build Domain
 *
 * Core types for the Build Domain of the Axolotl Plugin Repository.
 *
 * The Build Domain transforms materialized source (from M5) into verified
 * PHAR artifacts. It operates without publication credentials.
 */

// Value types
export type {
  GitSha,
  Sha256,
  SemVer,
  PluginId,
  RepositoryIdentity,
  MaterializationId,
} from './types.js';

// Provenance types
export type { BuildSourceProvenance } from './types.js';

// Metadata types
export type { PluginMetadata, PluginCommand, PluginPermission } from './types.js';

// Request/Result types
export type { BuildRequest, BuildResult, BuildArtifact, BuildChecksumManifest, BuildChecksum, BuildMetadata, BuildEnvironment } from './types.js';

// Diagnostic types
export type { BuildError, BuildWarning, BuildSecuritySignal } from './types.js';

// Enums
export { SecuritySignalSeverity, SecuritySignalType, BuildSeverity } from './types.js';

// Error/Warning codes
export { BUILD_ERROR_CODES, BUILD_WARNING_CODES } from './types.js';
export type { BuildErrorCode, BuildWarningCode } from './types.js';

// Diagnostic helpers
export {
  buildError,
  buildWarning,
  isBuildError,
  isBuildWarning,
  getBuildErrors,
  getBuildWarnings,
  hasBuildErrors,
} from './types.js';

// Validation functions
export {
  isValidGitSha,
  isValidSha256,
  isValidSemVer,
  isValidPluginId,
  isValidRepositoryIdentity,
  isValidMaterializationId,
} from './types.js';

// Type guards
export { isBuildSuccess, isBuildFailure, hasCriticalSecuritySignals, hasSecuritySignals } from './types.js';

// plugin.yml validation
export { validatePluginYml, PLUGIN_YML_MAX_SIZE } from './plugin-yml-validator.js';
export type { PluginYmlValidationResult } from './plugin-yml-validator.js';

// Security scanner
export {
  scanForSecuritySignals,
  checkForCommittedPhar,
  scanForCommittedPhar,
  SCANNER_MAX_FILES,
  SCANNER_MAX_FILE_SIZE,
  SCANNER_MAX_SIGNALS_PER_FILE,
  SCANNER_MAX_SIGNALS_TOTAL,
} from './security-scanner.js';
export type { SecurityScanResult } from './security-scanner.js';

// Filesystem abstraction
export {
  listDirectory,
  listPhpFiles,
  safeReadFile,
  isPathSafe,
  FS_MAX_DEPTH,
  FS_MAX_FILES,
  FS_MAX_FILE_SIZE,
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_PATTERNS,
  DEFAULT_INCLUDE_EXTENSIONS,
} from './filesystem.js';
export type {
  FileInfo,
  DirectoryListingOptions,
  DirectoryListingResult,
  SafeReadOptions,
  SafeReadResult,
} from './filesystem.js';
