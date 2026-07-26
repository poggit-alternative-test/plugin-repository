/**
 * Validation Diagnostics
 *
 * Structured error reporting for registry validation.
 */

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * A single diagnostic message
 */
export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  file: string;
  path?: string;
  message: string;
}

/**
 * Collection of diagnostics with summary
 */
export interface ValidationDiagnostics {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/**
 * Diagnostic codes
 *
 * Stable identifiers for each error type.
 * Used by CI for annotation.
 */
export const DiagnosticCode = {
  // Schema errors
  UNSUPPORTED_SCHEMA_VERSION: 'UNSUPPORTED_SCHEMA_VERSION',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE: 'INVALID_FIELD_TYPE',

  // Plugin identity errors
  INVALID_PLUGIN_ID: 'INVALID_PLUGIN_ID',
  PLUGIN_ID_DIR_MISMATCH: 'PLUGIN_ID_DIR_MISMATCH',
  INVALID_REPOSITORY_IDENTITY: 'INVALID_REPOSITORY_IDENTITY',
  REPOSITORY_IS_URL: 'REPOSITORY_IS_URL',
  INVALID_BRANCH: 'INVALID_BRANCH',
  DUPLICATE_PLUGIN_ID: 'DUPLICATE_PLUGIN_ID',
  DUPLICATE_UPSTREAM: 'DUPLICATE_UPSTREAM',

  // Version errors
  INVALID_VERSION: 'INVALID_VERSION',
  VERSION_FILENAME_MISMATCH: 'VERSION_FILENAME_MISMATCH',
  INVALID_UPSTREAM_COMMIT: 'INVALID_UPSTREAM_COMMIT',
  SHORT_SHA: 'SHORT_SHA',
  COMMIT_AS_BRANCH: 'COMMIT_AS_BRANCH',
  INVALID_REVIEWER: 'INVALID_REVIEWER',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
  INVALID_PR_NUMBER: 'INVALID_PR_NUMBER',

  // Status/lifecycle errors
  MISSING_STORAGE_COMMIT: 'MISSING_STORAGE_COMMIT',
  MISSING_ARTIFACT: 'MISSING_ARTIFACT',
  INVALID_ARTIFACT_SHA256: 'INVALID_ARTIFACT_SHA256',
  INVALID_STORAGE_COMMIT: 'INVALID_STORAGE_COMMIT',
  STORAGE_REPO_MISMATCH: 'STORAGE_REPO_MISMATCH',
  PUBLISHED_WITHOUT_ARTIFACT: 'PUBLISHED_WITHOUT_ARTIFACT',

  // Cross-record errors
  DUPLICATE_VERSION: 'DUPLICATE_VERSION',
  DUPLICATE_STORAGE_REPO: 'DUPLICATE_STORAGE_REPO',
  STORAGE_REPO_CONFLICT: 'STORAGE_REPO_CONFLICT',

  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  MALFORMED_YAML: 'MALFORMED_YAML',
  YAML_PARSING_ERROR: 'YAML_PARSING_ERROR',
  DUPLICATE_YAML_KEY: 'DUPLICATE_YAML_KEY',

  // Provenance errors
  PROVENANCE_MUTATED: 'PROVENANCE_MUTATED',
} as const;

export type DiagnosticCodeType = (typeof DiagnosticCode)[keyof typeof DiagnosticCode];

/**
 * Create a diagnostic
 */
export function createDiagnostic(
  code: DiagnosticCodeType,
  severity: DiagnosticSeverity,
  file: string,
  message: string,
  path?: string
): Diagnostic {
  return { severity, code, file, path, message };
}

/**
 * Create an error diagnostic
 */
export function error(
  code: DiagnosticCodeType,
  file: string,
  message: string,
  path?: string
): Diagnostic {
  return createDiagnostic(code, 'error', file, message, path);
}

/**
 * Create a warning diagnostic
 */
export function warning(
  code: DiagnosticCodeType,
  file: string,
  message: string,
  path?: string
): Diagnostic {
  return createDiagnostic(code, 'warning', file, message, path);
}

/**
 * Create an info diagnostic
 */
export function info(
  code: DiagnosticCodeType,
  file: string,
  message: string,
  path?: string
): Diagnostic {
  return createDiagnostic(code, 'info', file, message, path);
}

/**
 * Aggregate diagnostics
 */
export function aggregateDiagnostics(diagnostics: Diagnostic[]): ValidationDiagnostics {
  return {
    diagnostics,
    errorCount: diagnostics.filter(d => d.severity === 'error').length,
    warningCount: diagnostics.filter(d => d.severity === 'warning').length,
    infoCount: diagnostics.filter(d => d.severity === 'info').length,
  };
}

/**
 * Format diagnostics for CLI output
 */
export function formatDiagnostics(diagnostics: ValidationDiagnostics): string {
  if (diagnostics.diagnostics.length === 0) {
    return '';
  }

  const lines: string[] = [];

  for (const d of diagnostics.diagnostics) {
    const prefix = d.severity === 'error' ? 'ERROR' : d.severity === 'warning' ? 'WARN' : 'INFO';
    const location = d.path ? `${d.file}:${d.path}` : d.file;
    lines.push(`${prefix} [${d.code}]`);
    lines.push(`  ${location}`);
    lines.push(`  ${d.message}`);
  }

  return lines.join('\n');
}
