/**
 * Build Diagnostics
 *
 * Structured diagnostics for the Build domain.
 * Distinguishes build errors from infrastructure errors.
 */

// ============================================================
// Diagnostic Codes
// ============================================================

export const BUILD_CODES = {
  // Composer Runner errors
  COMPOSER_NOT_FOUND: 'COMPOSER_NOT_FOUND',
  COMPOSER_INSTALL_FAILED: 'COMPOSER_INSTALL_FAILED',
  COMPOSER_TIMEOUT: 'COMPOSER_TIMEOUT',
  COMPOSER_SCRIPT_BLOCKED: 'COMPOSER_SCRIPT_BLOCKED',
  COMPOSER_PLUGIN_BLOCKED: 'COMPOSER_PLUGIN_BLOCKED',
  COMPOSER_PERMISSION_DENIED: 'COMPOSER_PERMISSION_DENIED',
  COMPOSER_NO_COMPOSER_JSON: 'COMPOSER_NO_COMPOSER_JSON',
  COMPOSER_WORKSPACE_UNREADABLE: 'COMPOSER_WORKSPACE_UNREADABLE',
  COMPOSER_WORKSPACE_CREATION_FAILED: 'COMPOSER_WORKSPACE_CREATION_FAILED',
  COMPOSER_EMPTY_OUTPUT: 'COMPOSER_EMPTY_OUTPUT',
  COMPOSER_MEMORY_LIMIT_EXCEEDED: 'COMPOSER_MEMORY_LIMIT_EXCEEDED',
  COMPOSER_DISK_FULL: 'COMPOSER_DISK_FULL',

  // Pharynx Runner errors
  PHP_NOT_FOUND: 'PHP_NOT_FOUND',
  PHARYNX_NOT_FOUND: 'PHARYNX_NOT_FOUND',
  PHARYNX_RUN_FAILED: 'PHARYNX_RUN_FAILED',
  PHARYNX_TIMEOUT: 'PHARYNX_TIMEOUT',
  PHARYNX_PERMISSION_DENIED: 'PHARYNX_PERMISSION_DENIED',
  PHARYNX_NO_PLUGIN_DIR: 'PHARYNX_NO_PLUGIN_DIR',
  PHARYNX_WORKSPACE_UNREADABLE: 'PHARYNX_WORKSPACE_UNREADABLE',
  PHARYNX_PLUGIN_DIR_NOT_FOUND: 'PHARYNX_PLUGIN_DIR_NOT_FOUND',
  PHARYNX_OUTPUT_DIR_CREATION_FAILED: 'PHARYNX_OUTPUT_DIR_CREATION_FAILED',
  PHARYNX_OUTPUT_PHAR_MISSING: 'PHARYNX_OUTPUT_PHAR_MISSING',
  PHARYNX_INVALID_EXIT_CODE: 'PHARYNX_INVALID_EXIT_CODE',
} as const;

export type BuildDiagnosticCode = (typeof BUILD_CODES)[keyof typeof BUILD_CODES];

// ============================================================
// Severity Levels
// ============================================================

export enum BuildDiagnosticSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFRASTRUCTURE_ERROR = 'infrastructure_error',
}

// ============================================================
// Diagnostic Interface
// ============================================================

export interface BuildDiagnostic {
  code: BuildDiagnosticCode;
  severity: BuildDiagnosticSeverity;
  message: string;
  context?: Record<string, unknown>;
}

// ============================================================
// Diagnostic Factory Functions
// ============================================================

export function buildError(
  code: BuildDiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): BuildDiagnostic {
  return {
    code,
    severity: BuildDiagnosticSeverity.ERROR,
    message,
    ...(context && { context }),
  };
}

export function buildWarning(
  code: BuildDiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): BuildDiagnostic {
  return {
    code,
    severity: BuildDiagnosticSeverity.WARNING,
    message,
    ...(context && { context }),
  };
}

export function infrastructureError(
  code: BuildDiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): BuildDiagnostic {
  return {
    code,
    severity: BuildDiagnosticSeverity.INFRASTRUCTURE_ERROR,
    message,
    ...(context && { context }),
  };
}

// ============================================================
// Diagnostic Helpers
// ============================================================

export function getErrors(diagnostics: BuildDiagnostic[]): BuildDiagnostic[] {
  return diagnostics.filter((d) => d.severity === BuildDiagnosticSeverity.ERROR);
}

export function getWarnings(diagnostics: BuildDiagnostic[]): BuildDiagnostic[] {
  return diagnostics.filter((d) => d.severity === BuildDiagnosticSeverity.WARNING);
}

export function getInfrastructureErrors(diagnostics: BuildDiagnostic[]): BuildDiagnostic[] {
  return diagnostics.filter((d) => d.severity === BuildDiagnosticSeverity.INFRASTRUCTURE_ERROR);
}

export function hasErrors(diagnostics: BuildDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === BuildDiagnosticSeverity.ERROR);
}

export function hasInfrastructureErrors(diagnostics: BuildDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === BuildDiagnosticSeverity.INFRASTRUCTURE_ERROR);
}

/**
 * Classify a Composer exit code into a diagnostic.
 *
 * @param exitCode The exit code from Composer
 * @returns A build diagnostic describing the failure, or null if the exit code is acceptable
 */
export function classifyComposerExitCode(exitCode: number | null): BuildDiagnostic | null {
  switch (exitCode) {
    case 0:
      return null; // Success

    case 1:
      return buildError(
        BUILD_CODES.COMPOSER_INSTALL_FAILED,
        'Composer install failed: generic error (exit code 1). Check stderr for details.'
      );

    case 2:
      return buildError(
        BUILD_CODES.COMPOSER_INSTALL_FAILED,
        'Composer install failed: dependency resolution error (exit code 2).'
      );

    case 3:
      return buildError(
        BUILD_CODES.COMPOSER_INSTALL_FAILED,
        'Composer install failed: plugin/script error (exit code 3).'
      );

    case 4:
      return infrastructureError(
        BUILD_CODES.COMPOSER_SCRIPT_BLOCKED,
        'Composer install failed: some script was blocked (exit code 4).'
      );

    case 5:
      return buildError(
        BUILD_CODES.COMPOSER_NO_COMPOSER_JSON,
        'Composer install failed: no composer.json found (exit code 5).'
      );

    case null:
      return infrastructureError(
        BUILD_CODES.COMPOSER_TIMEOUT,
        'Composer process terminated without an exit code (likely killed by timeout).'
      );

    default:
      return buildError(
        BUILD_CODES.COMPOSER_INSTALL_FAILED,
        `Composer install failed with exit code ${exitCode}.`
      );
  }
}
