/**
 * Review State Management
 *
 * Handles review decision history and effective state derivation.
 *
 * M4 Requirements:
 * - Do not destroy historical decisions
 * - Append-only review-event/history model
 * - Deterministic effective-state derivation
 * - The LATEST valid authorized decision determines effective state
 * - No quorum, voting, or reviewer priority
 */

// ============================================================
// Canonical Ordering Contract
// ============================================================
//
// Decisions are ordered by:
// 1. Primary: timestamp (ascending - earliest first)
// 2. Secondary: decisionId (lexicographic) for deterministic tie-breaking
//
// The LATEST decision (highest timestamp, or highest decisionId on tie)
// determines the effective state.
//
// Timestamps are generated server-side (trusted environment).
// This contract ensures deterministic ordering without depending on
// user-supplied values for security decisions.
// ============================================================

import type {
  ReviewRecord,
  CandidateInfo,
} from './review-record.js';
import {
  ReviewDecision,
  isTerminalDecision,
  isNonTerminalDecision,
} from './review-record.js';
import type { CandidateIdentity } from './candidate-identity.js';
import type { ReviewerIdentity } from './reviewer-auth.js';
import { REVIEW_CODES } from './diagnostics.js';
import { reviewError, reviewWarning, type ReviewDiagnostic } from './diagnostics.js';

// ============================================================
// Effective Review State
// ============================================================

export enum EffectiveReviewState {
  /** No review decisions yet */
  PENDING = 'PENDING',
  /** Approved */
  APPROVED = 'APPROVED',
  /** Rejected */
  REJECTED = 'REJECTED',
  /** Changes requested - non-terminal */
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
}

/**
 * Sort records by canonical order: timestamp ascending, then decisionId ascending.
 * This produces deterministic ordering regardless of filesystem enumeration.
 */
function sortByCanonicalOrder(records: ReviewRecord[]): ReviewRecord[] {
  return [...records].sort((a, b) => {
    // Primary: timestamp ascending
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    // Secondary: decisionId ascending (deterministic tie-breaker)
    return a.decisionId.localeCompare(b.decisionId);
  });
}

/**
 * Get the effective review state from decision history.
 *
 * Policy: The LATEST valid decision determines the effective state.
 *
 * Decision transitions:
 * - PENDING → any decision = that decision's state
 * - REQUEST_CHANGES → APPROVE = APPROVED
 * - REQUEST_CHANGES → REJECT = REJECTED
 * - REJECT → APPROVE = APPROVED
 * - APPROVE → REJECT = REJECTED
 * - APPROVE → REQUEST_CHANGES = CHANGES_REQUESTED
 * - REJECT → REQUEST_CHANGES = CHANGES_REQUESTED
 *
 * All history is preserved; the latest decision wins.
 */
export function deriveEffectiveState(records: ReviewRecord[]): EffectiveReviewState {
  if (records.length === 0) {
    return EffectiveReviewState.PENDING;
  }

  // Sort by canonical order (timestamp, then decisionId)
  const sorted = sortByCanonicalOrder(records);

  // The last decision in canonical order is the effective state
  const latest = sorted[sorted.length - 1];

  switch (latest.decision) {
    case ReviewDecision.APPROVE:
      return EffectiveReviewState.APPROVED;
    case ReviewDecision.REJECT:
      return EffectiveReviewState.REJECTED;
    case ReviewDecision.REQUEST_CHANGES:
      return EffectiveReviewState.CHANGES_REQUESTED;
    default:
      return EffectiveReviewState.PENDING;
  }
}

/**
 * Get the latest decision from records, using canonical ordering.
 */
export function getLatestDecision(records: ReviewRecord[]): ReviewRecord | undefined {
  if (records.length === 0) return undefined;
  const sorted = sortByCanonicalOrder(records);
  return sorted[sorted.length - 1];
}

// ============================================================
// Decision Validation
// ============================================================

export interface DecisionValidationResult {
  valid: boolean;
  diagnostics: ReviewDiagnostic[];
  newState?: EffectiveReviewState;
}

/**
 * Validate if a new decision can be made.
 *
 * Policy: The latest decision determines effective state.
 * All transitions are allowed EXCEPT duplicate decisions from the same reviewer.
 *
 * Transition behavior:
 * - REQUEST_CHANGES → APPROVE = APPROVED
 * - REQUEST_CHANGES → REJECT = REJECTED
 * - REJECT → APPROVE = APPROVED
 * - APPROVE → REJECT = REJECTED
 * - APPROVE → REQUEST_CHANGES = CHANGES_REQUESTED
 * - REJECT → REQUEST_CHANGES = CHANGES_REQUESTED
 *
 * All previous decisions remain in history.
 */
export function validateNewDecision(
  candidateInfo: CandidateInfo | null,
  records: ReviewRecord[],
  newDecision: ReviewDecision,
  candidateIdentity: CandidateIdentity,
  reviewerId?: number
): DecisionValidationResult {
  const diagnostics: ReviewDiagnostic[] = [];

  // Check candidate exists
  if (!candidateInfo) {
    diagnostics.push(
      reviewError(REVIEW_CODES.CANDIDATE_NOT_FOUND, 'Candidate not found')
    );
    return { valid: false, diagnostics };
  }

  // Check candidate identity matches
  if (candidateInfo.candidateIdentity !== candidateIdentity.canonical) {
    diagnostics.push(
      reviewError(
        REVIEW_CODES.CANDIDATE_IDENTITY_MISMATCH,
        `Candidate identity mismatch: expected ${candidateInfo.candidateIdentity}, got ${candidateIdentity.canonical}`
      )
    );
    return { valid: false, diagnostics };
  }

  // Check for duplicate decision from same reviewer
  if (reviewerId !== undefined) {
    const existingDecision = records.find(
      (r) => r.reviewer.githubId === reviewerId && r.decision === newDecision
    );
    if (existingDecision) {
      diagnostics.push(
        reviewError(
          REVIEW_CODES.DUPLICATE_DECISION,
          `Reviewer ${reviewerId} has already issued this decision`
        )
      );
      return { valid: false, diagnostics };
    }
  }

  // All transitions are allowed - latest decision wins
  // Compute new effective state
  const newRecords = [
    ...records,
    {
      decisionId: 'validation-check',
      candidateIdentity: candidateIdentity.canonical,
      pluginSlug: candidateIdentity.pluginSlug,
      upstreamRepository: candidateIdentity.upstreamRepository,
      reviewedSha: candidateIdentity.sha,
      decision: newDecision,
      reviewer: { githubId: reviewerId ?? 0 },
      timestamp: new Date().toISOString(),
      schemaVersion: 1,
    },
  ];
  const newState = deriveEffectiveState(newRecords);

  return { valid: true, diagnostics, newState };
}

// ============================================================
// Decision History
// ============================================================

export interface DecisionHistory {
  candidateIdentity: string;
  decisions: ReviewRecord[];
  effectiveState: EffectiveReviewState;
}

/**
 * Build decision history from records.
 * Uses canonical ordering: timestamp ascending, then decisionId ascending.
 */
export function buildDecisionHistory(
  candidateIdentity: CandidateIdentity,
  records: ReviewRecord[]
): DecisionHistory {
  return {
    candidateIdentity: candidateIdentity.canonical,
    decisions: sortByCanonicalOrder(records),
    effectiveState: deriveEffectiveState(records),
  };
}

/**
 * Check if a specific reviewer has already made a decision.
 */
export function reviewerHasDecision(
  records: ReviewRecord[],
  reviewer: ReviewerIdentity
): ReviewRecord | undefined {
  return records.find(
    (r) => r.reviewer.githubId === reviewer.githubId
  );
}

/**
 * Get all decisions by a specific reviewer.
 */
export function getDecisionsByReviewer(
  records: ReviewRecord[],
  reviewer: ReviewerIdentity
): ReviewRecord[] {
  return records.filter((r) => r.reviewer.githubId === reviewer.githubId);
}

/**
 * Check if the last decision was by a specific reviewer.
 */
export function lastDecisionByReviewer(
  records: ReviewRecord[],
  reviewer: ReviewerIdentity
): ReviewRecord | undefined {
  const sorted = sortByCanonicalOrder(records);
  // Find the last decision by this reviewer
  const reviewerDecisions = sorted.filter((r) => r.reviewer.githubId === reviewer.githubId);
  return reviewerDecisions[reviewerDecisions.length - 1];
}

// ============================================================
// State Queries
// ============================================================

/**
 * Check if a candidate can be approved.
 */
export function canApprove(
  candidateInfo: CandidateInfo | null,
  records: ReviewRecord[],
  candidateIdentity: CandidateIdentity
): DecisionValidationResult {
  return validateNewDecision(
    candidateInfo,
    records,
    ReviewDecision.APPROVE,
    candidateIdentity
  );
}

/**
 * Check if a candidate can have changes requested.
 */
export function canRequestChanges(
  candidateInfo: CandidateInfo | null,
  records: ReviewRecord[],
  candidateIdentity: CandidateIdentity
): DecisionValidationResult {
  return validateNewDecision(
    candidateInfo,
    records,
    ReviewDecision.REQUEST_CHANGES,
    candidateIdentity
  );
}

/**
 * Check if a candidate can be rejected.
 */
export function canReject(
  candidateInfo: CandidateInfo | null,
  records: ReviewRecord[],
  candidateIdentity: CandidateIdentity
): DecisionValidationResult {
  return validateNewDecision(
    candidateInfo,
    records,
    ReviewDecision.REJECT,
    candidateIdentity
  );
}

/**
 * Get the latest decision by a specific reviewer.
 */
export function getLatestDecisionByReviewer(
  records: ReviewRecord[],
  reviewer: ReviewerIdentity
): ReviewRecord | undefined {
  return lastDecisionByReviewer(records, reviewer);
}
