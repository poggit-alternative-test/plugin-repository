/**
 * Review Storage Tests
 *
 * Tests for file-based review storage manager.
 *
 * M4 Requirements tested:
 * - Atomic append-only writes
 * - Candidate info persistence
 * - Decision history preservation
 * - Directory structure: reviews/{plugin-slug}/{short-id}/
 * - Duplicate/collision handling
 * - Malformed record rejection
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { ReviewStorageManager, ReviewStorageError } from '../../src/review/review-storage.js';
import { createCandidateIdentity } from '../../src/review/candidate-identity.js';
import { createCandidateInfo, createReviewRecord, ReviewDecision } from '../../src/review/review-record.js';
import type { CandidateIdentity } from '../../src/review/candidate-identity.js';

describe('Review Storage', () => {
  const TEST_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const TEST_REPO = 'owner/repo';
  const TEST_PLUGIN = 'testplugin';
  const TEST_DIR = join(process.cwd(), 'test-reviews-temp');

  let identity: CandidateIdentity;
  let storage: ReviewStorageManager;

  beforeEach(() => {
    // Create clean test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    identity = createCandidateIdentity({
      pluginSlug: TEST_PLUGIN,
      upstreamRepository: TEST_REPO,
      sha: TEST_SHA,
    });
    storage = new ReviewStorageManager(TEST_DIR);
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  // ============================================================
  // Atomic Write Tests
  // ============================================================

  describe('Atomic Writes', () => {
    test('successful atomic write creates file', () => {
      const record = createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 123 });
      storage.saveDecision(identity, record);

      const filePath = join(TEST_DIR, TEST_PLUGIN, identity.shortId, 'decisions', `${record.decisionId}.yaml`);
      expect(existsSync(filePath)).toBe(true);
    });

    test('existing decision cannot be overwritten', () => {
      const record = createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 123 });
      storage.saveDecision(identity, record);

      // Attempt to save same record again
      expect(() => storage.saveDecision(identity, record)).toThrow(ReviewStorageError);
    });

    test('malformed record is never materialized', () => {
      const record = createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 123 }) as any;
      delete record.decision; // Make it invalid

      expect(() => storage.saveDecision(identity, record)).toThrow();

      // No file should exist
      const filePath = join(TEST_DIR, TEST_PLUGIN, identity.shortId, 'decisions', `${record.decisionId}.yaml`);
      expect(existsSync(filePath)).toBe(false);
    });

    test('duplicate decision ID fails closed', () => {
      // Create two records - the second has a manually set same decision ID
      // We can't easily test this with modified records due to validation,
      // so we test by attempting to save the same record twice
      const record = createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 1 });
      storage.saveDecision(identity, record);

      // Attempt to save same record again (same ID)
      expect(() => storage.saveDecision(identity, record)).toThrow(ReviewStorageError);
    });
  });

  // ============================================================
  // Directory Structure Tests
  // ============================================================

  describe('Directory Structure', () => {
    test('creates plugin directory on first save', () => {
      const candidateInfo = createCandidateInfo(identity, 'main', new Date().toISOString());
      storage.saveCandidateInfo(identity, candidateInfo);

      const pluginDir = join(TEST_DIR, TEST_PLUGIN);
      expect(existsSync(pluginDir)).toBe(true);
    });

    test('creates short-id subdirectory', () => {
      const candidateInfo = createCandidateInfo(identity, 'main', new Date().toISOString());
      storage.saveCandidateInfo(identity, candidateInfo);

      const candidateDir = join(TEST_DIR, TEST_PLUGIN, identity.shortId);
      expect(existsSync(candidateDir)).toBe(true);
    });

    test('creates decisions subdirectory when decision is saved', () => {
      const record = createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 123 });
      storage.saveDecision(identity, record);

      const decisionsDir = join(TEST_DIR, TEST_PLUGIN, identity.shortId, 'decisions');
      expect(existsSync(decisionsDir)).toBe(true);
    });
  });

  // ============================================================
  // Candidate Info Persistence
  // ============================================================

  describe('Candidate Info Persistence', () => {
    test('saves and loads candidate info', () => {
      const candidateInfo = createCandidateInfo(identity, 'main', new Date().toISOString());
      storage.saveCandidateInfo(identity, candidateInfo);

      const { candidateInfo: loaded } = storage.loadCandidate(identity);
      expect(loaded).not.toBeNull();
      expect(loaded?.pluginSlug).toBe(TEST_PLUGIN);
      expect(loaded?.upstreamBranch).toBe('main');
    });

    test('returns null for non-existent candidate', () => {
      const { candidateInfo } = storage.loadCandidate(identity);
      expect(candidateInfo).toBeNull();
    });
  });

  // ============================================================
  // Decision Persistence
  // ============================================================

  describe('Decision Persistence', () => {
    test('saves decision to file', () => {
      const record = createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 123 });
      storage.saveDecision(identity, record);

      const { decisions } = storage.loadCandidate(identity);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].decision).toBe(ReviewDecision.APPROVE);
    });

    test('generates unique filename per decision', () => {
      const record1 = createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 1 });
      const record2 = createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 2 });

      storage.saveDecision(identity, record1);
      storage.saveDecision(identity, record2);

      expect(record1.decisionId).not.toBe(record2.decisionId);
    });

    test('loads all decisions for candidate', () => {
      storage.saveDecision(identity, createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 1 }));
      storage.saveDecision(identity, createReviewRecord(identity, ReviewDecision.REJECT, { githubId: 2 }));
      storage.saveDecision(identity, createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 3 }));

      const decisions = storage.loadDecisions(identity);
      expect(decisions).toHaveLength(3);
    });

    test('decisions ordered by timestamp', () => {
      const record1 = createReviewRecord(identity, ReviewDecision.REQUEST_CHANGES, { githubId: 1 });
      record1.timestamp = '2024-01-01T10:00:00.000Z';

      const record2 = createReviewRecord(identity, ReviewDecision.APPROVE, { githubId: 2 });
      record2.timestamp = '2024-01-01T11:00:00.000Z';

      storage.saveDecision(identity, record1);
      storage.saveDecision(identity, record2);

      const { decisions } = storage.loadCandidate(identity);
      expect(decisions[0].decisionId).toBe(record1.decisionId);
      expect(decisions[1].decisionId).toBe(record2.decisionId);
    });

    test('returns empty array for non-existent candidate', () => {
      const decisions = storage.loadDecisions(identity);
      expect(decisions).toEqual([]);
    });
  });

  // ============================================================
  // Candidate Isolation
  // ============================================================

  describe('Candidate Isolation', () => {
    test('isolates candidates by plugin', () => {
      const identity2 = createCandidateIdentity({
        pluginSlug: 'otherplugin',
        upstreamRepository: TEST_REPO,
        sha: TEST_SHA,
      });

      storage.saveCandidateInfo(identity, createCandidateInfo(identity, 'main', new Date().toISOString()));
      storage.saveCandidateInfo(identity2, createCandidateInfo(identity2, 'main', new Date().toISOString()));

      const plugins = storage.listPluginSlugs();
      expect(plugins).toContain(TEST_PLUGIN);
      expect(plugins).toContain('otherplugin');
    });

    test('isolates candidates by SHA', () => {
      const sha1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const sha2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      const identity1 = createCandidateIdentity({
        pluginSlug: TEST_PLUGIN,
        upstreamRepository: TEST_REPO,
        sha: sha1,
      });
      const identity2 = createCandidateIdentity({
        pluginSlug: TEST_PLUGIN,
        upstreamRepository: TEST_REPO,
        sha: sha2,
      });

      storage.saveCandidateInfo(identity1, createCandidateInfo(identity1, 'main', new Date().toISOString()));
      storage.saveCandidateInfo(identity2, createCandidateInfo(identity2, 'main', new Date().toISOString()));

      expect(storage.candidateExists(identity1)).toBe(true);
      expect(storage.candidateExists(identity2)).toBe(true);
      expect(identity1.canonical).not.toBe(identity2.canonical);
    });
  });

  // ============================================================
  // Collision Handling
  // ============================================================

  describe('Short Locator Collision Handling', () => {
    test('different SHAs have different short IDs', () => {
      const identity1 = createCandidateIdentity({
        pluginSlug: TEST_PLUGIN,
        upstreamRepository: TEST_REPO,
        sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });
      const identity2 = createCandidateIdentity({
        pluginSlug: TEST_PLUGIN,
        upstreamRepository: TEST_REPO,
        sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });

      expect(identity1.shortId).not.toBe(identity2.shortId);
    });

    test('full canonical identity is always used for security', () => {
      // Even if short IDs somehow collided (extremely unlikely), the full
      // canonical identity would still be validated
      const info = createCandidateInfo(identity, 'main', new Date().toISOString());
      expect(info.candidateIdentity).toBe(identity.canonical);
      expect(info.candidateIdentity).toContain(identity.sha);
    });
  });
});
