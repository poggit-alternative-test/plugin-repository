/**
 * Review Record Schema
 *
 * Canonical representation of a human review decision.
 *
 * M4 Requirements:
 * - Schema/version information
 * - Candidate identity
 * - Plugin identity
 * - Upstream repository identity
 * - Exact reviewed SHA
 * - Decision
 * - Reviewer identity
 * - Review timestamp
 * - Optional reviewer notes/reason
 * - References to relevant inspection evidence
 */

// ============================================================
// Decision Types
// ============================================================

export enum ReviewDecision {
  APPROVE = 'APPROVED',
  REQUEST_CHANGES = 'CHANGES_REQUESTED',
  REJECT = 'REJECTED',
}

/**
 * Terminal decisions - no further review required
 */
export const TERMINAL_DECISIONS: readonly ReviewDecision[] = [
  ReviewDecision.APPROVE,
  ReviewDecision.REJECT,
] as const;

/**
 * Non-terminal decisions - review can continue
 */
export const NON_TERMINAL_DECISIONS: readonly ReviewDecision[] = [
  ReviewDecision.REQUEST_CHANGES,
] as const;

/**
 * Check if a decision is terminal.
 */
export function isTerminalDecision(decision: ReviewDecision): boolean {
  return TERMINAL_DECISIONS.includes(decision);
}

/**
 * Check if a decision is non-terminal.
 */
export function isNonTerminalDecision(decision: ReviewDecision): boolean {
  return NON_TERMINAL_DECISIONS.includes(decision);
}

// ============================================================
// Review Record
// ============================================================

export interface ReviewRecord {
  /** Schema version for forward compatibility */
  schemaVersion: number;
  /** Unique decision ID (UUID or timestamp-based) */
  decisionId: string;
  /** Candidate identity canonical string */
  candidateIdentity: string;
  /** Plugin slug */
  pluginSlug: string;
  /** Upstream repository */
  upstreamRepository: string;
  /** Exact SHA reviewed */
  reviewedSha: string;
  /** Human review decision */
  decision: ReviewDecision;
  /** Reviewer identity */
  reviewer: {
    githubId: number;
    login?: string;
  };
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Optional reviewer notes/reason */
  notes?: string;
  /** Reference to inspection evidence (optional) */
  evidenceRef?: string;
  /** Optional previous decision ID for history tracking */
  previousDecisionId?: string;
}

// ============================================================
// Candidate Information (stored alongside decisions)
// ============================================================

export interface CandidateInfo {
  /** Schema version */
  schemaVersion: number;
  /** Canonical candidate identity */
  candidateIdentity: string;
  /** Plugin slug */
  pluginSlug: string;
  /** Upstream repository */
  upstreamRepository: string;
  /** Branch that was submitted */
  upstreamBranch: string;
  /** Exact SHA */
  sha: string;
  /** When inspection was completed */
  inspectionTimestamp: string;
  /** Reference to inspection evidence */
  evidenceRef?: string;
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate a decision ID format.
 */
export function isValidDecisionId(id: string): boolean {
  // Allow UUIDs or timestamp-based IDs
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length >= 8 && id.length <= 64;
}

/**
 * Validate a timestamp string (ISO 8601).
 */
export function isValidTimestamp(timestamp: string): boolean {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

/**
 * Validate a review record.
 */
export function isValidReviewRecord(record: unknown): record is ReviewRecord {
  if (typeof record !== 'object' || record === null) return false;
  const r = record as Record<string, unknown>;

  if (typeof r.schemaVersion !== 'number') return false;
  if (typeof r.decisionId !== 'string' || !isValidDecisionId(r.decisionId)) return false;
  if (typeof r.candidateIdentity !== 'string') return false;
  if (typeof r.pluginSlug !== 'string') return false;
  if (typeof r.upstreamRepository !== 'string') return false;
  if (typeof r.reviewedSha !== 'string' || !/^[a-f0-9]{40}$/i.test(r.reviewedSha)) return false;
  if (!Object.values(ReviewDecision).includes(r.decision as ReviewDecision)) return false;
  if (typeof r.reviewer !== 'object' || r.reviewer === null) return false;
  const reviewer = r.reviewer as Record<string, unknown>;
  if (typeof reviewer.githubId !== 'number' || reviewer.githubId <= 0) return false;
  if (typeof r.timestamp !== 'string' || !isValidTimestamp(r.timestamp)) return false;
  if (r.notes !== undefined && typeof r.notes !== 'string') return false;

  return true;
}

/**
 * Validate a candidate info record.
 */
export function isValidCandidateInfo(info: unknown): info is CandidateInfo {
  if (typeof info !== 'object' || info === null) return false;
  const i = info as Record<string, unknown>;

  if (typeof i.schemaVersion !== 'number') return false;
  if (typeof i.candidateIdentity !== 'string') return false;
  if (typeof i.pluginSlug !== 'string') return false;
  if (typeof i.upstreamRepository !== 'string') return false;
  if (typeof i.upstreamBranch !== 'string') return false;
  if (typeof i.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(i.sha)) return false;
  if (typeof i.inspectionTimestamp !== 'string' || !isValidTimestamp(i.inspectionTimestamp)) return false;

  return true;
}

// ============================================================
// Record Creation
// ============================================================

import type { CandidateIdentity } from './candidate-identity.js';
import type { ReviewerIdentity } from './reviewer-auth.js';

/**
 * Generate a unique decision ID.
 */
export function generateDecisionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Create a new review record.
 */
export function createReviewRecord(
  candidateIdentity: CandidateIdentity,
  decision: ReviewDecision,
  reviewer: ReviewerIdentity,
  options?: {
    notes?: string;
    evidenceRef?: string;
    previousDecisionId?: string;
  }
): ReviewRecord {
  return {
    schemaVersion: 1,
    decisionId: generateDecisionId(),
    candidateIdentity: candidateIdentity.canonical,
    pluginSlug: candidateIdentity.pluginSlug,
    upstreamRepository: candidateIdentity.upstreamRepository,
    reviewedSha: candidateIdentity.sha,
    decision,
    reviewer: {
      githubId: reviewer.githubId,
      login: reviewer.login,
    },
    timestamp: new Date().toISOString(),
    notes: options?.notes,
    evidenceRef: options?.evidenceRef,
    previousDecisionId: options?.previousDecisionId,
  };
}

/**
 * Create candidate info from inspection data.
 */
export function createCandidateInfo(
  candidateIdentity: CandidateIdentity,
  upstreamBranch: string,
  inspectionTimestamp: string,
  evidenceRef?: string
): CandidateInfo {
  return {
    schemaVersion: 1,
    candidateIdentity: candidateIdentity.canonical,
    pluginSlug: candidateIdentity.pluginSlug,
    upstreamRepository: candidateIdentity.upstreamRepository,
    upstreamBranch,
    sha: candidateIdentity.sha,
    inspectionTimestamp,
    evidenceRef,
  };
}
