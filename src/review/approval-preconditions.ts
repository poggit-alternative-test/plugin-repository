/**
 * Approval Preconditions
 *
 * Validates all requirements before an approval can be issued.
 *
 * M4 Requirements:
 * - APPROVE must fail closed unless all preconditions are met
 * - Check: candidate exists, candidate completed M3, READY_FOR_REVIEW,
 *   exact SHA present and valid, reviewer authorized, candidate identity matches,
 *   required inspection evidence exists, no infrastructure error
 */

import type { SubmissionInspectionResult, InspectionStatus } from '../submission/result.js';
import { InspectionStatus as SubmissionInspectionStatus } from '../submission/result.js';
import type { CandidateInfo } from './review-record.js';
import type { CandidateIdentity } from './candidate-identity.js';
import type { ReviewerIdentity } from './reviewer-auth.js';
import { ReviewerAuthorizer } from './reviewer-auth.js';
import { REVIEW_CODES } from './diagnostics.js';
import { reviewError, reviewWarning, type ReviewDiagnostic } from './diagnostics.js';

// ============================================================
// Precondition Results
// ============================================================

export interface ApprovalPreconditions {
  canApprove: boolean;
  diagnostics: ReviewDiagnostic[];
}

export interface ApprovalContext {
  candidateIdentity: CandidateIdentity;
  candidateInfo: CandidateInfo | null;
  inspectionResult: SubmissionInspectionResult | null;
  reviewer: ReviewerIdentity;
  authorizer: ReviewerAuthorizer;
}

// ============================================================
// Precondition Checks
// ============================================================

/**
 * Check if candidate exists.
 */
function checkCandidateExists(
  context: ApprovalContext
): ReviewDiagnostic | null {
  if (!context.candidateInfo) {
    return reviewError(
      REVIEW_CODES.CANDIDATE_NOT_FOUND,
      'Candidate not found in review storage'
    );
  }
  return null;
}

/**
 * Check if inspection was completed.
 */
function checkInspectionCompleted(
  context: ApprovalContext
): ReviewDiagnostic | null {
  if (!context.inspectionResult) {
    return reviewError(
      REVIEW_CODES.EVIDENCE_MISSING,
      'No inspection result provided'
    );
  }
  return null;
}

/**
 * Check if candidate status is READY_FOR_REVIEW.
 */
function checkReadyForReview(
  context: ApprovalContext
): ReviewDiagnostic | null {
  if (!context.inspectionResult) {
    return reviewError(
      REVIEW_CODES.CANDIDATE_NOT_READY,
      'Cannot verify inspection status'
    );
  }

  if (context.inspectionResult.status !== SubmissionInspectionStatus.READY_FOR_REVIEW) {
    return reviewError(
      REVIEW_CODES.CANDIDATE_NOT_READY,
      `Cannot approve: inspection status is ${context.inspectionResult.status}, expected READY_FOR_REVIEW`
    );
  }
  return null;
}

/**
 * Check if exact SHA is present and valid.
 */
function checkExactSha(
  context: ApprovalContext
): ReviewDiagnostic | null {
  if (!context.candidateInfo) {
    return reviewError(
      REVIEW_CODES.INVALID_CANDIDATE_SHA,
      'Cannot verify SHA: candidate info missing'
    );
  }

  const sha = context.candidateInfo.sha;
  if (!sha || !/^[a-f0-9]{40}$/i.test(sha)) {
    return reviewError(
      REVIEW_CODES.INVALID_CANDIDATE_SHA,
      'Invalid or missing SHA in candidate info'
    );
  }

  // Verify SHA matches the candidate identity
  if (sha !== context.candidateIdentity.sha) {
    return reviewError(
      REVIEW_CODES.CANDIDATE_IDENTITY_MISMATCH,
      `SHA mismatch: candidate info has ${sha}, identity has ${context.candidateIdentity.sha}`
    );
  }

  // Verify SHA matches inspection result
  if (context.inspectionResult?.github.resolvedCommitSha !== sha) {
    return reviewError(
      REVIEW_CODES.CANDIDATE_IDENTITY_MISMATCH,
      `SHA mismatch: inspection resolved ${context.inspectionResult?.github.resolvedCommitSha}, candidate has ${sha}`
    );
  }

  return null;
}

/**
 * Check if reviewer is authorized.
 */
function checkReviewerAuthorized(
  context: ApprovalContext
): ReviewDiagnostic | null {
  const authResult = context.authorizer.isAuthorized(context.reviewer);

  if (!authResult.authorized) {
    return reviewError(
      REVIEW_CODES.REVIEWER_NOT_AUTHORIZED,
      authResult.error || 'Reviewer is not authorized'
    );
  }
  return null;
}

/**
 * Check if candidate identity matches.
 */
function checkIdentityMatches(
  context: ApprovalContext
): ReviewDiagnostic | null {
  if (!context.candidateInfo) {
    return reviewError(
      REVIEW_CODES.CANDIDATE_IDENTITY_MISMATCH,
      'Cannot verify identity: candidate info missing'
    );
  }

  if (context.candidateInfo.candidateIdentity !== context.candidateIdentity.canonical) {
    return reviewError(
      REVIEW_CODES.CANDIDATE_IDENTITY_MISMATCH,
      `Candidate identity mismatch: storage has ${context.candidateInfo.candidateIdentity}, expected ${context.candidateIdentity.canonical}`
    );
  }
  return null;
}

/**
 * Check if inspection evidence exists.
 */
function checkEvidenceExists(
  context: ApprovalContext
): ReviewDiagnostic | null {
  if (!context.inspectionResult) {
    return reviewError(
      REVIEW_CODES.EVIDENCE_MISSING,
      'No inspection evidence available'
    );
  }

  // Check that we have actual source analysis
  if (!context.inspectionResult.source.sourceAcquired) {
    return reviewError(
      REVIEW_CODES.EVIDENCE_INCOMPLETE,
      'Source was not successfully acquired'
    );
  }

  // Check that plugin metadata was extracted
  if (!context.inspectionResult.pluginMetadata) {
    return reviewError(
      REVIEW_CODES.EVIDENCE_INCOMPLETE,
      'Plugin metadata not extracted'
    );
  }

  return null;
}

/**
 * Check for infrastructure errors.
 */
function checkNoInfrastructureErrors(
  context: ApprovalContext
): ReviewDiagnostic | null {
  if (!context.inspectionResult) {
    return reviewError(
      REVIEW_CODES.EVIDENCE_INVALID,
      'Cannot verify infrastructure status'
    );
  }

  if (context.inspectionResult.hasInfrastructureErrors) {
    const infraErrors = context.inspectionResult.infrastructureErrors;
    return reviewError(
      REVIEW_CODES.EVIDENCE_INVALID,
      `Cannot approve: ${infraErrors.length} infrastructure error(s) present`,
      { errors: infraErrors.map((e) => e.message) }
    );
  }
  return null;
}

/**
 * Check for submission errors.
 */
function checkNoSubmissionErrors(
  context: ApprovalContext
): ReviewDiagnostic | null {
  if (!context.inspectionResult) {
    return null; // Already checked in other conditions
  }

  if (context.inspectionResult.status === SubmissionInspectionStatus.SUBMISSION_ERROR) {
    const errors = context.inspectionResult.errors;
    return reviewError(
      REVIEW_CODES.CANNOT_APPROVE_SUBMISSION_ERROR,
      `Cannot approve: submission has ${errors.length} error(s)`,
      { errors: errors.map((e) => e.message) }
    );
  }
  return null;
}

// ============================================================
// Main Precondition Checker
// ============================================================

/**
 * Check all approval preconditions.
 *
 * APPROVE must fail closed unless ALL preconditions are met:
 * 1. Candidate exists
 * 2. Inspection completed
 * 3. Status is READY_FOR_REVIEW
 * 4. Exact SHA is present and valid
 * 5. Reviewer is authorized
 * 6. Candidate identity matches
 * 7. Inspection evidence exists
 * 8. No infrastructure errors
 * 9. No submission errors
 */
export function checkApprovalPreconditions(
  context: ApprovalContext
): ApprovalPreconditions {
  const diagnostics: ReviewDiagnostic[] = [];

  // Run all checks
  const checks = [
    checkCandidateExists,
    checkInspectionCompleted,
    checkReadyForReview,
    checkExactSha,
    checkReviewerAuthorized,
    checkIdentityMatches,
    checkEvidenceExists,
    checkNoInfrastructureErrors,
    checkNoSubmissionErrors,
  ];

  for (const check of checks) {
    const result = check(context);
    if (result) {
      diagnostics.push(result);
    }
  }

  return {
    canApprove: diagnostics.length === 0,
    diagnostics,
  };
}

/**
 * Simplified approval check for CLI use.
 */
export function canApproveCandidate(
  inspectionResult: SubmissionInspectionResult | null,
  reviewer: ReviewerIdentity,
  authorizer: ReviewerAuthorizer
): ApprovalPreconditions {
  // For CLI use, we create a minimal context
  // The candidate info and identity would come from the inspection result
  const candidateInfo: CandidateInfo | null = inspectionResult ? {
    schemaVersion: 1,
    candidateIdentity: '', // Will be validated
    pluginSlug: inspectionResult.submission.slug,
    upstreamRepository: inspectionResult.submission.upstreamRepository,
    upstreamBranch: inspectionResult.submission.upstreamBranch,
    sha: inspectionResult.github.resolvedCommitSha,
    inspectionTimestamp: new Date().toISOString(),
  } : null;

  const context: ApprovalContext = {
    candidateIdentity: {
      canonical: inspectionResult
        ? `${inspectionResult.submission.slug}@${inspectionResult.submission.upstreamRepository}#${inspectionResult.github.resolvedCommitSha}`
        : '' as any,
      shortId: '',
      pluginSlug: inspectionResult?.submission.slug || '',
      upstreamRepository: inspectionResult?.submission.upstreamRepository || '',
      sha: inspectionResult?.github.resolvedCommitSha || '',
    },
    candidateInfo,
    inspectionResult,
    reviewer,
    authorizer,
  };

  return checkApprovalPreconditions(context);
}
