/**
 * Review State Tests
 *
 * Tests for review decision history and effective state derivation.
 *
 * M4 Requirements tested:
 * - The LATEST valid authorized decision determines effective state
 * - Decision transition semantics
 * - Canonical ordering (timestamp + decisionId)
 * - History preservation
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  ReviewDecision,
  isTerminalDecision,
  isNonTerminalDecision,
  isValidReviewRecord,
  isValidCandidateInfo,
  createReviewRecord,
  createCandidateInfo,
  generateDecisionId,
} from '../../src/review/review-record.js';
import {
  EffectiveReviewState,
  deriveEffectiveState,
  validateNewDecision,
  buildDecisionHistory,
  reviewerHasDecision,
  canApprove,
  canReject,
  getLatestDecision,
} from '../../src/review/review-state.js';
import { createCandidateIdentity } from '../../src/review/candidate-identity.js';
import type { CandidateInfo, ReviewRecord } from '../../src/review/review-record.js';
import type { CandidateIdentity } from '../../src/review/candidate-identity.js';

describe('Review State', () => {
  const TEST_SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const TEST_SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const TEST_REPO = 'owner/repo';
  const TEST_PLUGIN = 'testplugin';

  let identityA: CandidateIdentity;
  let identityB: CandidateIdentity;
  let candidateInfo: CandidateInfo;

  beforeEach(() => {
    identityA = createCandidateIdentity({
      pluginSlug: TEST_PLUGIN,
      upstreamRepository: TEST_REPO,
      sha: TEST_SHA_A,
    });
    identityB = createCandidateIdentity({
      pluginSlug: TEST_PLUGIN,
      upstreamRepository: TEST_REPO,
      sha: TEST_SHA_B,
    });
    candidateInfo = createCandidateInfo(
      identityA,
      'main',
      new Date().toISOString()
    );
  });

  // ============================================================
  // Decision Transition Tests
  // ============================================================

  describe('Decision Transition Semantics', () => {
    test('PENDING → APPROVE = APPROVED', () => {
      const records: ReviewRecord[] = [
        createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 1 }),
      ];
      expect(deriveEffectiveState(records)).toBe(EffectiveReviewState.APPROVED);
    });

    test('PENDING → REJECT = REJECTED', () => {
      const records: ReviewRecord[] = [
        createReviewRecord(identityA, ReviewDecision.REJECT, { githubId: 1 }),
      ];
      expect(deriveEffectiveState(records)).toBe(EffectiveReviewState.REJECTED);
    });

    test('PENDING → REQUEST_CHANGES = CHANGES_REQUESTED', () => {
      const records: ReviewRecord[] = [
        createReviewRecord(identityA, ReviewDecision.REQUEST_CHANGES, { githubId: 1 }),
      ];
      expect(deriveEffectiveState(records)).toBe(EffectiveReviewState.CHANGES_REQUESTED);
    });

    test('REQUEST_CHANGES → APPROVE = APPROVED', () => {
      const record1 = createReviewRecord(identityA, ReviewDecision.REQUEST_CHANGES, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';

      const record2 = createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 2 });
      record2.timestamp = '2024-01-01T11:00:00.000Z';

      const records: ReviewRecord[] = [record1, record2];
      expect(deriveEffectiveState(records)).toBe(EffectiveReviewState.APPROVED);
    });

    test('REQUEST_CHANGES → REJECT = REJECTED', () => {
      const record1 = createReviewRecord(identityA, ReviewDecision.REQUEST_CHANGES, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';

      const record2 = createReviewRecord(identityA, ReviewDecision.REJECT, { githubId: 2 });
      record2.timestamp = '2024-01-01T11:00:00.000Z';

      const records: ReviewRecord[] = [record1, record2];
      expect(deriveEffectiveState(records)).toBe(EffectiveReviewState.REJECTED);
    });

    test('REJECT → APPROVE = APPROVED', () => {
      const record1 = createReviewRecord(identityA, ReviewDecision.REJECT, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';

      const record2 = createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 2 });
      record2.timestamp = '2024-01-01T11:00:00.000Z';

      const records: ReviewRecord[] = [record1, record2];
      expect(deriveEffectiveState(records)).toBe(EffectiveReviewState.APPROVED);
    });

    test('APPROVE → REJECT = REJECTED', () => {
      const record1 = createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';

      const record2 = createReviewRecord(identityA, ReviewDecision.REJECT, { githubId: 2 });
      record2.timestamp = '2024-01-01T11:00:00.000Z';

      const records: ReviewRecord[] = [record1, record2];
      expect(deriveEffectiveState(records)).toBe(EffectiveReviewState.REJECTED);
    });

    test('APPROVE → REQUEST_CHANGES = CHANGES_REQUESTED', () => {
      const record1 = createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';

      const record2 = createReviewRecord(identityA, ReviewDecision.REQUEST_CHANGES, { githubId: 2 });
      record2.timestamp = '2024-01-01T11:00:00.000Z';

      const records: ReviewRecord[] = [record1, record2];
      expect(deriveEffectiveState(records)).toBe(EffectiveReviewState.CHANGES_REQUESTED);
    });

    test('REJECT → REQUEST_CHANGES = CHANGES_REQUESTED', () => {
      const record1 = createReviewRecord(identityA, ReviewDecision.REJECT, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';

      const record2 = createReviewRecord(identityA, ReviewDecision.REQUEST_CHANGES, { githubId: 2 });
      record2.timestamp = '2024-01-01T11:00:00.000Z';

      const records: ReviewRecord[] = [record1, record2];
      expect(deriveEffectiveState(records)).toBe(EffectiveReviewState.CHANGES_REQUESTED);
    });
  });

  // ============================================================
  // History Preservation Tests
  // ============================================================

  describe('History Preservation', () => {
    test('all decisions are preserved in history', () => {
      const record1 = createReviewRecord(identityA, ReviewDecision.REQUEST_CHANGES, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';

      const record2 = createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 2 });
      record2.timestamp = '2024-01-01T11:00:00.000Z';

      const history = buildDecisionHistory(identityA, [record1, record2]);
      expect(history.decisions).toHaveLength(2);
      expect(history.decisions[0].decision).toBe(ReviewDecision.REQUEST_CHANGES);
      expect(history.decisions[1].decision).toBe(ReviewDecision.APPROVE);
    });
  });

  // ============================================================
  // Canonical Ordering Tests
  // ============================================================

  describe('Canonical Ordering', () => {
    test('decisions are ordered by timestamp', () => {
      const record1 = createReviewRecord(identityA, ReviewDecision.REQUEST_CHANGES, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';

      const record2 = createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 2 });
      record2.timestamp = '2024-01-01T11:00:00.000Z';

      const history = buildDecisionHistory(identityA, [record2, record1]); // Out of order
      expect(history.decisions[0].timestamp).toBe('2024-01-01T10:00:00.000Z');
      expect(history.decisions[1].timestamp).toBe('2024-01-01T11:00:00.000Z');
    });

    test('decisionId is tie-breaker for same timestamp', () => {
      const record1 = createReviewRecord(identityA, ReviewDecision.REJECT, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';
      record1.decisionId = 'aaa';

      const record2 = createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 2 });
      record2.timestamp = '2024-01-01T10:00:00.000Z';
      record2.decisionId = 'bbb';

      // Order: aaa < bbb, so REJECT comes first
      const records: ReviewRecord[] = [record2, record1]; // Out of order
      const latest = getLatestDecision(records);
      expect(latest?.decision).toBe(ReviewDecision.APPROVE);
    });
  });

  // ============================================================
  // Exact SHA Enforcement
  // ============================================================

  describe('Exact SHA Enforcement', () => {
    test('approval of SHA A does not apply to SHA B', () => {
      const recordsA: ReviewRecord[] = [
        createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 1 }),
      ];

      expect(deriveEffectiveState(recordsA)).toBe(EffectiveReviewState.APPROVED);

      // SHA B is a different candidate with no decisions
      const recordsB: ReviewRecord[] = [];
      expect(deriveEffectiveState(recordsB)).toBe(EffectiveReviewState.PENDING);
    });

    test('same plugin + same repo + different SHA = different candidate', () => {
      expect(identityA.canonical).toBe(`testplugin@${TEST_REPO}#${TEST_SHA_A}`);
      expect(identityB.canonical).toBe(`testplugin@${TEST_REPO}#${TEST_SHA_B}`);
      expect(identityA.sha).not.toBe(identityB.sha);
    });
  });

  // ============================================================
  // Duplicate Decision Tests
  // ============================================================

  describe('Duplicate Decisions', () => {
    test('same reviewer + same decision = duplicate rejected', () => {
      const records: ReviewRecord[] = [
        createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 1 }),
      ];

      const validation = validateNewDecision(
        candidateInfo,
        records,
        ReviewDecision.APPROVE,
        identityA,
        1 // Same reviewer
      );

      expect(validation.valid).toBe(false);
      expect(validation.diagnostics.some((d) => d.code === 'DUPLICATE_DECISION')).toBe(true);
    });

    test('different reviewer + same decision = allowed', () => {
      const records: ReviewRecord[] = [
        createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 1 }),
      ];

      const validation = validateNewDecision(
        candidateInfo,
        records,
        ReviewDecision.APPROVE,
        identityA,
        2 // Different reviewer
      );

      expect(validation.valid).toBe(true);
    });
  });

  // ============================================================
  // State Queries
  // ============================================================

  describe('getLatestDecision', () => {
    test('returns undefined for empty records', () => {
      expect(getLatestDecision([])).toBeUndefined();
    });

    test('returns latest decision by canonical order', () => {
      const record1 = createReviewRecord(identityA, ReviewDecision.REQUEST_CHANGES, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';

      const record2 = createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 2 });
      record2.timestamp = '2024-01-01T11:00:00.000Z';

      const latest = getLatestDecision([record1, record2]);
      expect(latest?.decision).toBe(ReviewDecision.APPROVE);
    });
  });

  // ============================================================
  // Validation Tests
  // ============================================================

  describe('validateNewDecision', () => {
    test('rejects when candidate not found', () => {
      const validation = validateNewDecision(
        null,
        [],
        ReviewDecision.APPROVE,
        identityA
      );

      expect(validation.valid).toBe(false);
      expect(validation.diagnostics.some((d) => d.code === 'CANDIDATE_NOT_FOUND')).toBe(true);
    });

    test('rejects when identity mismatch', () => {
      const validation = validateNewDecision(
        candidateInfo,
        [],
        ReviewDecision.APPROVE,
        identityB // Different SHA
      );

      expect(validation.valid).toBe(false);
      expect(validation.diagnostics.some((d) => d.code === 'CANDIDATE_IDENTITY_MISMATCH')).toBe(true);
    });
  });

  // ============================================================
  // ReviewRecord Validation
  // ============================================================

  describe('isValidReviewRecord', () => {
    test('accepts valid record', () => {
      const record = createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 1 });
      expect(isValidReviewRecord(record)).toBe(true);
    });

    test('rejects missing required fields', () => {
      expect(isValidReviewRecord({})).toBe(false);
    });

    test('rejects invalid decision', () => {
      const record = createReviewRecord(identityA, ReviewDecision.APPROVE, { githubId: 1 }) as any;
      record.decision = 'INVALID';
      expect(isValidReviewRecord(record)).toBe(false);
    });
  });

  describe('isValidCandidateInfo', () => {
    test('accepts valid candidate info', () => {
      expect(isValidCandidateInfo(candidateInfo)).toBe(true);
    });

    test('rejects missing required fields', () => {
      expect(isValidCandidateInfo({})).toBe(false);
    });
  });
});
