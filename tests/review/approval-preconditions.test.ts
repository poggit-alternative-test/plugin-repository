/**
 * Approval Preconditions Tests
 *
 * Tests for approval precondition checking (fail-closed).
 *
 * M4 Requirements tested:
 * - Fail-closed when any precondition fails
 * - All preconditions must pass for approval
 * - Infrastructure errors block approval
 * - Candidate must be READY_FOR_REVIEW
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  checkApprovalPreconditions,
  type ApprovalContext,
  type ApprovalPreconditions,
} from '../../src/review/approval-preconditions.js';
import { createCandidateIdentity } from '../../src/review/candidate-identity.js';
import { createCandidateInfo, ReviewDecision } from '../../src/review/review-record.js';
import { createAuthorizationConfig, ReviewerAuthorizer } from '../../src/review/reviewer-auth.js';
import { InspectionStatus } from '../../src/submission/result.js';
import type { CandidateIdentity } from '../../src/review/candidate-identity.js';
import type { SubmissionInspectionResult } from '../../src/submission/result.js';

describe('Approval Preconditions', () => {
  const TEST_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const TEST_REPO = 'owner/repo';
  const TEST_PLUGIN = 'testplugin';

  let identity: CandidateIdentity;
  let authorizedReviewer = { githubId: 12345678, login: 'authorized-reviewer' };
  let unauthorizedReviewer = { githubId: 87654321, login: 'unauthorized-reviewer' };
  let authorizer: ReviewerAuthorizer;

  // Create a valid inspection result
  function createValidInspectionResult(): SubmissionInspectionResult {
    return {
      valid: true,
      status: InspectionStatus.READY_FOR_REVIEW,
      submission: {
        slug: TEST_PLUGIN,
        upstreamRepository: TEST_REPO,
        upstreamBranch: 'main',
        commitSha: TEST_SHA,
      },
      github: {
        resolvedCommitSha: TEST_SHA,
        resolvedRef: 'refs/heads/main',
        archiveUrl: 'https://api.github.com/repos/owner/repo/tarball/' + TEST_SHA,
      },
      source: {
        sourceAcquired: true,
        archivePath: '/tmp/source.tar.gz',
      },
      pluginMetadata: {
        name: 'TestPlugin',
        version: '1.0.0',
        main: 'TestPlugin\\Main',
        api: ['1.0.0'],
        description: 'Test plugin',
      },
      inspectionTimestamp: new Date().toISOString(),
      hasInfrastructureErrors: false,
      infrastructureErrors: [],
      errors: [],
    };
  }

  beforeEach(() => {
    identity = createCandidateIdentity({
      pluginSlug: TEST_PLUGIN,
      upstreamRepository: TEST_REPO,
      sha: TEST_SHA,
    });
    authorizer = new ReviewerAuthorizer(
      createAuthorizationConfig([authorizedReviewer])
    );
  });

  function createDefaultContext(overrides: Partial<ApprovalContext> = {}): ApprovalContext {
    const candidateInfo = createCandidateInfo(
      identity,
      'main',
      new Date().toISOString()
    );

    return {
      candidateIdentity: identity,
      candidateInfo,
      inspectionResult: createValidInspectionResult(),
      reviewer: authorizedReviewer,
      authorizer,
      ...overrides,
    } as ApprovalContext;
  }

  describe('Successful approval', () => {
    test('all preconditions pass when properly configured', () => {
      const context = createDefaultContext();
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe('Candidate validation', () => {
    test('fails when candidate info is missing', () => {
      const context = createDefaultContext({ candidateInfo: null });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
      expect(result.diagnostics.some(d => d.code === 'CANDIDATE_NOT_FOUND')).toBe(true);
    });

    test('fails when status is not READY_FOR_REVIEW', () => {
      const inspection = createValidInspectionResult();
      inspection.status = InspectionStatus.PENDING; // Wrong status

      const context = createDefaultContext({ inspectionResult: inspection });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
      expect(result.diagnostics.some(d => d.code === 'CANDIDATE_NOT_READY')).toBe(true);
    });

    test('passes when status is READY_FOR_REVIEW', () => {
      const context = createDefaultContext();
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(true);
    });
  });

  describe('Reviewer authorization', () => {
    test('fails when reviewer is not authorized', () => {
      const context = createDefaultContext({ reviewer: unauthorizedReviewer });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
      expect(result.diagnostics.some(d => d.code === 'REVIEWER_NOT_AUTHORIZED')).toBe(true);
    });

    test('passes when reviewer is authorized', () => {
      const context = createDefaultContext();
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(true);
      expect(result.diagnostics.some(d => d.code === 'REVIEWER_NOT_AUTHORIZED')).toBe(false);
    });

    test('fails when reviewer identity is invalid', () => {
      const context = createDefaultContext({ reviewer: { githubId: -1 } as any });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
    });
  });

  describe('SHA enforcement', () => {
    test('fails when candidate SHA does not match review SHA', () => {
      const differentIdentity = createCandidateIdentity({
        pluginSlug: TEST_PLUGIN,
        upstreamRepository: TEST_REPO,
        sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', // Different SHA
      });

      const context = createDefaultContext({
        candidateIdentity: differentIdentity,
      });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
      expect(result.diagnostics.some(d => d.code === 'CANDIDATE_IDENTITY_MISMATCH')).toBe(true);
    });

    test('passes when SHA matches', () => {
      const context = createDefaultContext();
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(true);
      expect(result.diagnostics.some(d => d.code === 'CANDIDATE_IDENTITY_MISMATCH')).toBe(false);
    });
  });

  describe('Inspection validation', () => {
    test('fails when inspection result is missing', () => {
      const context = createDefaultContext({ inspectionResult: null });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
      expect(result.diagnostics.some(d => d.code === 'EVIDENCE_MISSING')).toBe(true);
    });

    test('fails when source was not acquired', () => {
      const inspection = createValidInspectionResult();
      inspection.source.sourceAcquired = false;

      const context = createDefaultContext({ inspectionResult: inspection });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
      expect(result.diagnostics.some(d => d.code === 'EVIDENCE_INCOMPLETE')).toBe(true);
    });

    test('fails when plugin metadata is missing', () => {
      const inspection = createValidInspectionResult();
      inspection.pluginMetadata = undefined;

      const context = createDefaultContext({ inspectionResult: inspection });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
    });
  });

  describe('Infrastructure checks', () => {
    test('passes when infrastructure check passes', () => {
      const context = createDefaultContext();
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(true);
    });

    test('fails when infrastructure errors are present', () => {
      const inspection = createValidInspectionResult();
      inspection.hasInfrastructureErrors = true;
      inspection.infrastructureErrors = [{ message: 'Invalid file structure' }];

      const context = createDefaultContext({ inspectionResult: inspection });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
      expect(result.diagnostics.some(d => d.code === 'EVIDENCE_INVALID')).toBe(true);
    });
  });

  describe('Fail-closed behavior', () => {
    test('multiple failures are all reported', () => {
      const context = createDefaultContext({
        candidateInfo: null,
        reviewer: unauthorizedReviewer,
      });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
      expect(result.diagnostics.some(d => d.code === 'CANDIDATE_NOT_FOUND')).toBe(true);
      expect(result.diagnostics.some(d => d.code === 'REVIEWER_NOT_AUTHORIZED')).toBe(true);
    });

    test('partial success is not enough', () => {
      const inspection = createValidInspectionResult();
      inspection.hasInfrastructureErrors = true;
      inspection.infrastructureErrors = [{ message: 'API check failed' }];

      const context = createDefaultContext({
        inspectionResult: inspection,
      });
      const result = checkApprovalPreconditions(context);

      expect(result.canApprove).toBe(false);
      // Even though reviewer is authorized, infrastructure failure blocks approval
    });
  });

  describe('Diagnostic codes', () => {
    test('all required diagnostic codes are present', () => {
      const context = createDefaultContext({ candidateInfo: null });
      const result = checkApprovalPreconditions(context);

      const codes = result.diagnostics.map(d => d.code);
      expect(codes).toContain('CANDIDATE_NOT_FOUND');
    });

    test('diagnostic includes human-readable message', () => {
      const context = createDefaultContext({ candidateInfo: null });
      const result = checkApprovalPreconditions(context);

      const diag = result.diagnostics.find(d => d.code === 'CANDIDATE_NOT_FOUND');
      expect(diag?.message).toBeDefined();
      expect(diag?.message.length).toBeGreaterThan(0);
    });

    test('diagnostic includes severity', () => {
      const context = createDefaultContext({ candidateInfo: null });
      const result = checkApprovalPreconditions(context);

      const diag = result.diagnostics[0];
      expect(diag.severity).toBeDefined();
    });
  });
});
