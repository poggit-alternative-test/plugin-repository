/**
 * Publication Diagnostics
 *
 * Structured diagnostics for the Publication domain.
 *
 * Publication responsibilities:
 * - Prepare artifacts for publication (local operations)
 * - Publish to GitHub Release via provider
 * - Produce structured results
 *
 * Publication does NOT:
 * - Update Registry
 * - Execute plugin code
 * - Have direct GitHub knowledge (uses provider abstraction)
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { basename, join, extname } from 'path';

// Reuse SHA-256 branded type from Registry package
type Sha256 = string & { readonly brand: unique symbol };

// ============================================================
// Diagnostic Codes
// ============================================================

export const PUBLICATION_CODES = {
  // Source artifact errors (from existing code)
  PUBLICATION_ARTIFACT_NOT_FOUND: 'PUBLICATION_ARTIFACT_NOT_FOUND',
  PUBLISH_ARTIFACT_NOT_FILE: 'PUBLISH_ARTIFACT_NOT_FILE',
  PUBLISH_ARTIFACT_EMPTY: 'PUBLISH_ARTIFACT_EMPTY',
  PUBLISH_ARTIFACT_UNREADABLE: 'PUBLISH_ARTIFACT_UNREADABLE',

  // Destination errors (from existing code)
  PUBLISH_DEST_NOT_DIRECTORY: 'PUBLISH_DEST_NOT_DIRECTORY',
  PUBLISH_DEST_CREATION_FAILED: 'PUBLISH_DEST_CREATION_FAILED',
  PUBLISH_DEST_DISK_FULL: 'PUBLISH_DEST_DISK_FULL',

  // Hash/IO errors (from existing code)
  PUBLISH_HASH_COMPUTATION_FAILED: 'PUBLISH_HASH_COMPUTATION_FAILED',

  // Copy errors (from existing code)
  PUBLISH_COPY_FAILED: 'PUBLISH_COPY_FAILED',
  PUBLISH_WRITE_DENIED: 'PUBLISH_WRITE_DENIED',

  // Provider errors (NEW)
  PROVIDER_NOT_WRITE_ENABLED: 'PROVIDER_NOT_WRITE_ENABLED',
  PROVIDER_AUTH_FAILED: 'PROVIDER_AUTH_FAILED',
  PROVIDER_PERMISSION_DENIED: 'PROVIDER_PERMISSION_DENIED',
  PROVIDER_REPOSITORY_NOT_FOUND: 'PROVIDER_REPOSITORY_NOT_FOUND',
  PROVIDER_ERROR: 'PROVIDER_ERROR',

  // Release errors (NEW)
  RELEASE_ALREADY_EXISTS: 'RELEASE_ALREADY_EXISTS',
  RELEASE_NOT_FOUND: 'RELEASE_NOT_FOUND',
  RELEASE_PUBLISH_FAILED: 'RELEASE_PUBLISH_FAILED',
  RELEASE_IMMUTABLE: 'RELEASE_IMMUTABLE',

  // Asset errors (NEW)
  ASSET_UPLOAD_FAILED: 'ASSET_UPLOAD_FAILED',
  ASSET_TOO_LARGE: 'ASSET_TOO_LARGE',

  // Metadata errors (NEW)
  METADATA_TOO_LARGE: 'METADATA_TOO_LARGE',
  RELEASE_NOTES_TRUNCATED: 'RELEASE_NOTES_TRUNCATED',

  // Success signals (informational)
  RELEASE_CREATED: 'RELEASE_CREATED',
  RELEASE_PUBLISHED: 'RELEASE_PUBLISHED',
  ASSET_UPLOADED: 'ASSET_UPLOADED',

  // Validation errors (NEW)
  INVALID_RELEASE_TAG: 'INVALID_RELEASE_TAG',
  INVALID_STORAGE_REPOSITORY: 'INVALID_STORAGE_REPOSITORY',
  CHECKSUM_MISMATCH: 'CHECKSUM_MISMATCH',
} as const;

export type PublicationDiagnosticCode =
  (typeof PUBLICATION_CODES)[keyof typeof PUBLICATION_CODES];

// ============================================================
// Severity Levels
// ============================================================

export enum PublicationDiagnosticSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFRASTRUCTURE_ERROR = 'infrastructure_error',
  INFO = 'info',
}

// ============================================================
// Diagnostic Interface
// ============================================================

export interface PublicationDiagnostic {
  code: PublicationDiagnosticCode;
  severity: PublicationDiagnosticSeverity;
  message: string;
  context?: Record<string, unknown>;
}

// ============================================================
// Diagnostic Factory Functions
// ============================================================

export function publicationError(
  code: PublicationDiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): PublicationDiagnostic {
  return {
    code,
    severity: PublicationDiagnosticSeverity.ERROR,
    message,
    ...(context && { context }),
  };
}

export function publicationInfrastructureError(
  code: PublicationDiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): PublicationDiagnostic {
  return {
    code,
    severity: PublicationDiagnosticSeverity.INFRASTRUCTURE_ERROR,
    message,
    ...(context && { context }),
  };
}

export function publicationWarning(
  code: PublicationDiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): PublicationDiagnostic {
  return {
    code,
    severity: PublicationDiagnosticSeverity.WARNING,
    message,
    ...(context && { context }),
  };
}

export function publicationInfo(
  code: PublicationDiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): PublicationDiagnostic {
  return {
    code,
    severity: PublicationDiagnosticSeverity.INFO,
    message,
    ...(context && { context }),
  };
}

// ============================================================
// Diagnostic Helpers
// ============================================================

export function getPublicationErrors(diagnostics: PublicationDiagnostic[]): PublicationDiagnostic[] {
  return diagnostics.filter((d) => d.severity === PublicationDiagnosticSeverity.ERROR);
}

export function getPublicationInfrastructureErrors(
  diagnostics: PublicationDiagnostic[]
): PublicationDiagnostic[] {
  return diagnostics.filter(
    (d) => d.severity === PublicationDiagnosticSeverity.INFRASTRUCTURE_ERROR
  );
}

export function getPublicationWarnings(diagnostics: PublicationDiagnostic[]): PublicationDiagnostic[] {
  return diagnostics.filter((d) => d.severity === PublicationDiagnosticSeverity.WARNING);
}

export function hasPublicationErrors(diagnostics: PublicationDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === PublicationDiagnosticSeverity.ERROR);
}

export function hasInfrastructureErrors(diagnostics: PublicationDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === PublicationDiagnosticSeverity.INFRASTRUCTURE_ERROR);
}
