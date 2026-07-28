/**
 * Review Diagnostics
 *
 * Structured diagnostics for the human review system.
 */

import { DiagnosticCode } from '../registry/diagnostics.js';

// ============================================================
// Review Diagnostic Codes
// ============================================================

export const REVIEW_CODES = {
  // Candidate identity errors
  CANDIDATE_NOT_FOUND: 'CANDIDATE_NOT_FOUND',
  CANDIDATE_IDENTITY_MISMATCH: 'CANDIDATE_IDENTITY_MISMATCH',
  INVALID_CANDIDATE_SHA: 'INVALID_CANDIDATE_SHA',
  CANDIDATE_NOT_READY: 'CANDIDATE_NOT_READY',

  // Reviewer errors
  REVIEWER_NOT_AUTHORIZED: 'REVIEWER_NOT_AUTHORIZED',
  INVALID_REVIEWER_IDENTITY: 'INVALID_REVIEWER_IDENTITY',
  REVIEWER_ID_MISSING: 'REVIEWER_ID_MISSING',

  // Decision errors
  INVALID_DECISION: 'INVALID_DECISION',
  DUPLICATE_DECISION: 'DUPLICATE_DECISION',
  CONFLICTING_DECISION: 'CONFLICTING_DECISION',
  ALREADY_APPROVED: 'ALREADY_APPROVED',
  ALREADY_REJECTED: 'ALREADY_REJECTED',
  CANNOT_APPROVE_NON_READY: 'CANNOT_APPROVE_NON_READY',
  CANNOT_APPROVE_INFRA_ERROR: 'CANNOT_APPROVE_INFRA_ERROR',
  CANNOT_APPROVE_SUBMISSION_ERROR: 'CANNOT_APPROVE_SUBMISSION_ERROR',
  CANNOT_APPROVE_NO_EVIDENCE: 'CANNOT_APPROVE_NO_EVIDENCE',

  // Record errors
  INVALID_REVIEW_RECORD: 'INVALID_REVIEW_RECORD',
  INVALID_REVIEW_RECORD_VERSION: 'INVALID_REVIEW_RECORD_VERSION',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
  INVALID_REVIEWER_NOTES: 'INVALID_REVIEWER_NOTES',

  // Storage errors
  REVIEW_STORAGE_ERROR: 'REVIEW_STORAGE_ERROR',
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND',

  // Authorization errors
  AUTHORIZATION_LOAD_ERROR: 'AUTHORIZATION_LOAD_ERROR',
  INVALID_AUTHORIZATION_CONFIG: 'INVALID_AUTHORIZATION_CONFIG',

  // Evidence errors
  EVIDENCE_MISSING: 'EVIDENCE_MISSING',
  EVIDENCE_INVALID: 'EVIDENCE_INVALID',
  EVIDENCE_INCOMPLETE: 'EVIDENCE_INCOMPLETE',

  // State errors
  REVIEW_STATE_ERROR: 'REVIEW_STATE_ERROR',
} as const;

export type ReviewDiagnosticCode = (typeof REVIEW_CODES)[keyof typeof REVIEW_CODES];

// ============================================================
// Severity Levels
// ============================================================

export enum ReviewSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

// ============================================================
// Diagnostic Interface
// ============================================================

export interface ReviewDiagnostic {
  code: ReviewDiagnosticCode;
  severity: ReviewSeverity;
  message: string;
  context?: Record<string, unknown>;
}

// ============================================================
// Diagnostic Factory Functions
// ============================================================

export function reviewError(
  code: ReviewDiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): ReviewDiagnostic {
  return {
    code,
    severity: ReviewSeverity.ERROR,
    message,
    context,
  };
}

export function reviewWarning(
  code: ReviewDiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): ReviewDiagnostic {
  return {
    code,
    severity: ReviewSeverity.WARNING,
    message,
    context,
  };
}

export function reviewInfo(
  code: ReviewDiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): ReviewDiagnostic {
  return {
    code,
    severity: ReviewSeverity.INFO,
    message,
    context,
  };
}

// ============================================================
// Diagnostic Helpers
// ============================================================

export function isReviewError(d: ReviewDiagnostic): boolean {
  return d.severity === ReviewSeverity.ERROR;
}

export function getReviewErrors(diagnostics: ReviewDiagnostic[]): ReviewDiagnostic[] {
  return diagnostics.filter((d) => d.severity === ReviewSeverity.ERROR);
}

export function hasReviewErrors(diagnostics: ReviewDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === ReviewSeverity.ERROR);
}
