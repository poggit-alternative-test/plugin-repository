/**
 * Submission Diagnostics
 *
 * Structured diagnostics for submission inspection.
 * Distinguishes submission errors from infrastructure errors.
 */

import { DiagnosticCode } from '../registry/diagnostics.js';

// ============================================================
// Diagnostic Codes
// ============================================================

export const SUBMISSION_CODES = {
  // Submission scope errors
  SUBMISSION_INVALID_FILENAME: 'SUBMISSION_INVALID_FILENAME',
  SUBMISSION_INVALID_SCOPE: 'SUBMISSION_INVALID_SCOPE',
  SUBMISSION_MULTIPLE_FILES: 'SUBMISSION_MULTIPLE_FILES',
  SUBMISSION_TRAVERSAL_ATTEMPT: 'SUBMISSION_TRAVERSAL_ATTEMPT',
  SUBMISSION_HIDDEN_FILE: 'SUBMISSION_HIDDEN_FILE',
  SUBMISSION_NESTED_PATH: 'SUBMISSION_NESTED_PATH',
  SUBMISSION_INVALID_EXTENSION: 'SUBMISSION_INVALID_EXTENSION',
  SUBMISSION_UNEXPECTED_CHANGES: 'SUBMISSION_UNEXPECTED_CHANGES',

  // Submission content errors
  SUBMISSION_MISSING_SCHEMA_VERSION: 'SUBMISSION_MISSING_SCHEMA_VERSION',
  SUBMISSION_INVALID_SCHEMA_VERSION: 'SUBMISSION_INVALID_SCHEMA_VERSION',
  SUBMISSION_FORBIDDEN_FIELD: 'SUBMISSION_FORBIDDEN_FIELD',
  SUBMISSION_INVALID_REPOSITORY: 'SUBMISSION_INVALID_REPOSITORY',
  SUBMISSION_INVALID_BRANCH: 'SUBMISSION_INVALID_BRANCH',

  // Repository errors
  REPOSITORY_NOT_FOUND: 'REPOSITORY_NOT_FOUND',
  REPOSITORY_ARCHIVED: 'REPOSITORY_ARCHIVED',
  REPOSITORY_DISABLED: 'REPOSITORY_DISABLED',
  REPOSITORY_PRIVATE: 'REPOSITORY_PRIVATE',

  // Reference errors
  REFERENCE_NOT_FOUND: 'REFERENCE_NOT_FOUND',
  REFERENCE_AMBIGUOUS: 'REFERENCE_AMBIGUOUS',

  // GitHub API errors (infrastructure)
  GITHUB_RATE_LIMITED: 'GITHUB_RATE_LIMITED',
  GITHUB_API_FAILURE: 'GITHUB_API_FAILURE',
  GITHUB_TIMEOUT: 'GITHUB_TIMEOUT',
  GITHUB_AUTH_REQUIRED: 'GITHUB_AUTH_REQUIRED',

  // Source acquisition errors
  SOURCE_TOO_LARGE: 'SOURCE_TOO_LARGE',
  SOURCE_TOO_MANY_FILES: 'SOURCE_TOO_MANY_FILES',
  SOURCE_PATH_TRAVERSAL: 'SOURCE_PATH_TRAVERSAL',
  SOURCE_SYMLINK_ESCAPE: 'SOURCE_SYMLINK_ESCAPE',
  SOURCE_SYMLINK_METADATA: 'SOURCE_SYMLINK_METADATA',
  SOURCE_DEVICE_FILE: 'SOURCE_DEVICE_FILE',
  SOURCE_UNSUPPORTED_ARCHIVE: 'SOURCE_UNSUPPORTED_ARCHIVE',

  // Plugin metadata errors
  PLUGIN_YML_MISSING: 'PLUGIN_YML_MISSING',
  PLUGIN_YML_TOO_LARGE: 'PLUGIN_YML_TOO_LARGE',
  PLUGIN_YML_SYMLINK: 'PLUGIN_YML_SYMLINK',
  PLUGIN_YML_INVALID: 'PLUGIN_YML_INVALID',
  PLUGIN_YML_MISSING_NAME: 'PLUGIN_YML_MISSING_NAME',
  PLUGIN_YML_MISSING_VERSION: 'PLUGIN_YML_MISSING_VERSION',
  PLUGIN_YML_MISSING_MAIN: 'PLUGIN_YML_MISSING_MAIN',
  PLUGIN_YML_MISSING_API: 'PLUGIN_YML_MISSING_API',
  PLUGIN_VERSION_INVALID: 'PLUGIN_VERSION_INVALID',
  PLUGIN_NAME_INVALID: 'PLUGIN_NAME_INVALID',
  PLUGIN_ID_PROPOSAL_INVALID: 'PLUGIN_ID_PROPOSAL_INVALID',
  PLUGIN_MAIN_CLASS_MISSING: 'PLUGIN_MAIN_CLASS_MISSING',

  // Composer errors
  COMPOSER_JSON_INVALID: 'COMPOSER_JSON_INVALID',
  COMPOSER_JSON_TOO_LARGE: 'COMPOSER_JSON_TOO_LARGE',

  // Review signals (warnings/signals, not errors)
  REVIEW_SIGNAL_NETWORK_API: 'REVIEW_SIGNAL_NETWORK_API',
  REVIEW_SIGNAL_PROCESS_EXECUTION: 'REVIEW_SIGNAL_PROCESS_EXECUTION',
  REVIEW_SIGNAL_EVAL_EXEC: 'REVIEW_SIGNAL_EVAL_EXEC',
  REVIEW_SIGNAL_FILESYSTEM_SENSITIVE: 'REVIEW_SIGNAL_FILESYSTEM_SENSITIVE',
  REVIEW_SIGNAL_COMPOSER_SCRIPT: 'REVIEW_SIGNAL_COMPOSER_SCRIPT',
  REVIEW_SIGNAL_COMPOSER_PLUGIN: 'REVIEW_SIGNAL_COMPOSER_PLUGIN',
  REVIEW_SIGNAL_BUNDLED_BINARY: 'REVIEW_SIGNAL_BUNDLED_BINARY',
  REVIEW_SIGNAL_PHAR_COMMITTED: 'REVIEW_SIGNAL_PHAR_COMMITTED',
  REVIEW_SIGNAL_OBFUSCATION: 'REVIEW_SIGNAL_OBFUSCATION',
  REVIEW_SIGNAL_LARGE_ENCODED_BLOB: 'REVIEW_SIGNAL_LARGE_ENCODED_BLOB',
  REVIEW_SIGNAL_NATIVE_LIBRARY: 'REVIEW_SIGNAL_NATIVE_LIBRARY',

  // Warnings
  WARN_COMPOSER_PRESENT: 'WARN_COMPOSER_PRESENT',
  WARN_COMPOSER_SCRIPTS: 'WARN_COMPOSER_SCRIPTS',
  WARN_COMPOSER_PLUGINS: 'WARN_COMPOSER_PLUGINS',
  WARN_MULTIPLE_API_VERSIONS: 'WARN_MULTIPLE_API_VERSIONS',
  WARN_SYMLINKS_IGNORED: 'WARN_SYMLINKS_IGNORED',
} as const;

export type SubmissionDiagnosticCode =
  (typeof SUBMISSION_CODES)[keyof typeof SUBMISSION_CODES];

// ============================================================
// Severity Levels
// ============================================================

export enum DiagnosticSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  REVIEW_SIGNAL = 'review_signal',
  INFRASTRUCTURE_ERROR = 'infrastructure_error',
}

// ============================================================
// Diagnostic Interface
// ============================================================

export interface SubmissionDiagnostic {
  code: SubmissionDiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  file?: string;
  field?: string;
  context?: Record<string, unknown>;
}

// ============================================================
// Diagnostic Factory Functions
// ============================================================

export function submissionError(
  code: SubmissionDiagnosticCode,
  message: string,
  options?: { file?: string; field?: string; context?: Record<string, unknown> }
): SubmissionDiagnostic {
  return {
    code,
    severity: DiagnosticSeverity.ERROR,
    message,
    ...(options?.file && { file: options.file }),
    ...(options?.field && { field: options.field }),
    ...(options?.context && { context: options.context }),
  };
}

export function submissionWarning(
  code: SubmissionDiagnosticCode,
  message: string,
  options?: { file?: string; field?: string; context?: Record<string, unknown> }
): SubmissionDiagnostic {
  return {
    code,
    severity: DiagnosticSeverity.WARNING,
    message,
    ...(options?.file && { file: options.file }),
    ...(options?.field && { field: options.field }),
    ...(options?.context && { context: options.context }),
  };
}

export function reviewSignal(
  code: SubmissionDiagnosticCode,
  message: string,
  options?: { file?: string; context?: Record<string, unknown> }
): SubmissionDiagnostic {
  return {
    code,
    severity: DiagnosticSeverity.REVIEW_SIGNAL,
    message,
    ...(options?.file && { file: options.file }),
    ...(options?.context && { context: options.context }),
  };
}

export function infrastructureError(
  code: SubmissionDiagnosticCode,
  message: string,
  options?: { context?: Record<string, unknown> }
): SubmissionDiagnostic {
  return {
    code,
    severity: DiagnosticSeverity.INFRASTRUCTURE_ERROR,
    message,
    ...(options?.context && { context: options.context }),
  };
}

// ============================================================
// Diagnostic Helpers
// ============================================================

export function isInfrastructureError(d: SubmissionDiagnostic): boolean {
  return d.severity === DiagnosticSeverity.INFRASTRUCTURE_ERROR;
}

export function isSubmissionError(d: SubmissionDiagnostic): boolean {
  return d.severity === DiagnosticSeverity.ERROR;
}

export function isReviewSignal(d: SubmissionDiagnostic): boolean {
  return d.severity === DiagnosticSeverity.REVIEW_SIGNAL;
}

export function getErrors(diagnostics: SubmissionDiagnostic[]): SubmissionDiagnostic[] {
  return diagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR);
}

export function getWarnings(diagnostics: SubmissionDiagnostic[]): SubmissionDiagnostic[] {
  return diagnostics.filter((d) => d.severity === DiagnosticSeverity.WARNING);
}

export function getReviewSignals(diagnostics: SubmissionDiagnostic[]): SubmissionDiagnostic[] {
  return diagnostics.filter((d) => d.severity === DiagnosticSeverity.REVIEW_SIGNAL);
}

export function getInfrastructureErrors(
  diagnostics: SubmissionDiagnostic[]
): SubmissionDiagnostic[] {
  return diagnostics.filter((d) => d.severity === DiagnosticSeverity.INFRASTRUCTURE_ERROR);
}

export function hasErrors(diagnostics: SubmissionDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === DiagnosticSeverity.ERROR);
}

export function hasInfrastructureErrors(diagnostics: SubmissionDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === DiagnosticSeverity.INFRASTRUCTURE_ERROR);
}
