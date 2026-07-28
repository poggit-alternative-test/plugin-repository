/**
 * Review System Module
 *
 * Human review layer for the Axolotl Plugin Repository.
 *
 * @module review
 */

// Diagnostics
export {
  REVIEW_CODES,
  type ReviewDiagnosticCode,
  ReviewSeverity,
  type ReviewDiagnostic,
  reviewError,
  reviewWarning,
  reviewInfo,
  isReviewError,
  getReviewErrors,
  hasReviewErrors,
} from './diagnostics.js';

// Candidate Identity
export {
  type CandidateIdentityComponents,
  type CandidateIdentity,
  validateSha,
  validateRepository,
  validatePluginSlug,
  validateComponents,
  createCandidateIdentity,
  parseCandidateIdentity,
  equalCandidateIdentity,
  identityMatches,
  getCandidateReviewPath,
  getCandidateInfoPath,
  getDecisionsDirPath,
  getDecisionFilePath,
} from './candidate-identity.js';

// Reviewer Authorization
export {
  type ReviewerIdentity,
  type ReviewerAuthorizationConfig,
  validateGithubId,
  validateGithubLogin,
  isValidReviewerIdentity,
  isValidAuthorizationConfig,
  type AuthorizationResult,
  ReviewerAuthorizer,
  createEmptyAuthorizationConfig,
  createAuthorizationConfig,
} from './reviewer-auth.js';

// Review Record
export {
  ReviewDecision,
  TERMINAL_DECISIONS,
  NON_TERMINAL_DECISIONS,
  isTerminalDecision,
  isNonTerminalDecision,
  type ReviewRecord,
  type CandidateInfo,
  isValidDecisionId,
  isValidTimestamp,
  isValidReviewRecord,
  isValidCandidateInfo,
  generateDecisionId,
  createReviewRecord,
  createCandidateInfo,
} from './review-record.js';

// Review State
export {
  EffectiveReviewState,
  deriveEffectiveState,
  validateNewDecision,
  buildDecisionHistory,
  reviewerHasDecision,
  getDecisionsByReviewer,
  lastDecisionByReviewer,
  canApprove,
  canRequestChanges,
  canReject,
  getLatestDecision,
  getLatestDecisionByReviewer,
} from './review-state.js';

// Storage
export {
  ReviewStorageError,
  ReviewStorageManager,
  ReviewManager,
  type ReviewResult,
} from './review-storage.js';

// Approval Preconditions
export {
  type ApprovalPreconditions,
  type ApprovalContext,
  checkApprovalPreconditions,
  canApproveCandidate,
} from './approval-preconditions.js';
