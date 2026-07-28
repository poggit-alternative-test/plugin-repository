/**
 * Candidate Identity Tests
 *
 * Tests for deterministic candidate identity generation.
 *
 * M4 Requirements tested:
 * - Deterministic candidate ID
 * - SHA change changes candidate
 * - Repository change changes candidate
 * - Plugin identity change changes candidate
 */

import { describe, test, expect } from 'vitest';
import {
  createCandidateIdentity,
  parseCandidateIdentity,
  equalCandidateIdentity,
  identityMatches,
  validateSha,
  validateRepository,
  validatePluginSlug,
  validateComponents,
  type CandidateIdentityComponents,
} from '../../src/review/candidate-identity.js';

describe('Candidate Identity', () => {
  const VALID_COMPONENTS: CandidateIdentityComponents = {
    pluginSlug: 'topstats',
    upstreamRepository: 'nicholass003/TopStats',
    sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };

  describe('validateSha', () => {
    test('accepts valid 40-char hex SHA', () => {
      const result = validateSha('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(result.valid).toBe(true);
    });

    test('rejects empty SHA', () => {
      const result = validateSha('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    test('rejects SHA with wrong length', () => {
      const result = validateSha('aaaaaa');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('40');
    });

    test('rejects SHA with non-hex characters', () => {
      const result = validateSha('gggggggggggggggggggggggggggggggggggggggg');
      expect(result.valid).toBe(false);
    });

    test('accepts uppercase SHA', () => {
      const result = validateSha('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateRepository', () => {
    test('accepts valid owner/repo format', () => {
      const result = validateRepository('nicholass003/TopStats');
      expect(result.valid).toBe(true);
    });

    test('rejects empty repository', () => {
      const result = validateRepository('');
      expect(result.valid).toBe(false);
    });

    test('rejects repository without slash', () => {
      const result = validateRepository('TopStats');
      expect(result.valid).toBe(false);
    });

    test('rejects repository with multiple slashes', () => {
      const result = validateRepository('owner/repo/extra');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePluginSlug', () => {
    test('accepts valid lowercase slug', () => {
      const result = validatePluginSlug('topstats');
      expect(result.valid).toBe(true);
    });

    test('accepts slug with hyphens', () => {
      const result = validatePluginSlug('my-plugin-v2');
      expect(result.valid).toBe(true);
    });

    test('rejects empty slug', () => {
      const result = validatePluginSlug('');
      expect(result.valid).toBe(false);
    });

    test('rejects uppercase slug', () => {
      const result = validatePluginSlug('TopStats');
      expect(result.valid).toBe(false);
    });

    test('rejects slug starting with hyphen', () => {
      const result = validatePluginSlug('-topstats');
      expect(result.valid).toBe(false);
    });
  });

  describe('createCandidateIdentity', () => {
    test('creates deterministic identity', () => {
      const identity1 = createCandidateIdentity(VALID_COMPONENTS);
      const identity2 = createCandidateIdentity(VALID_COMPONENTS);

      expect(identity1.canonical).toBe(identity2.canonical);
      expect(identity1.shortId).toBe(identity2.shortId);
    });

    test('canonical format is plugin@owner/repo#sha', () => {
      const identity = createCandidateIdentity(VALID_COMPONENTS);
      expect(identity.canonical).toBe('topstats@nicholass003/TopStats#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    });

    test('has all required fields', () => {
      const identity = createCandidateIdentity(VALID_COMPONENTS);

      expect(identity.canonical).toBeDefined();
      expect(identity.shortId).toBeDefined();
      expect(identity.pluginSlug).toBe(VALID_COMPONENTS.pluginSlug);
      expect(identity.upstreamRepository).toBe(VALID_COMPONENTS.upstreamRepository);
      expect(identity.sha).toBe(VALID_COMPONENTS.sha);
    });

    test('shortId is 12 characters', () => {
      const identity = createCandidateIdentity(VALID_COMPONENTS);
      expect(identity.shortId.length).toBe(12);
    });
  });

  describe('parseCandidateIdentity', () => {
    test('parses valid canonical identity', () => {
      const canonical = 'topstats@nicholass003/TopStats#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const identity = parseCandidateIdentity(canonical);

      expect(identity).not.toBeNull();
      expect(identity?.pluginSlug).toBe('topstats');
      expect(identity?.upstreamRepository).toBe('nicholass003/TopStats');
      expect(identity?.sha).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    });

    test('returns null for invalid format', () => {
      expect(parseCandidateIdentity('invalid')).toBeNull();
      expect(parseCandidateIdentity('')).toBeNull();
      expect(parseCandidateIdentity(null as any)).toBeNull();
    });
  });

  describe('SHA change changes candidate', () => {
    test('same plugin + same repo + different SHA = different identity', () => {
      const sha1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const sha2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      const identity1 = createCandidateIdentity({
        ...VALID_COMPONENTS,
        sha: sha1,
      });
      const identity2 = createCandidateIdentity({
        ...VALID_COMPONENTS,
        sha: sha2,
      });

      expect(equalCandidateIdentity(identity1, identity2)).toBe(false);
      expect(identity1.canonical).not.toBe(identity2.canonical);
      expect(identity1.sha).not.toBe(identity2.sha);
    });
  });

  describe('repository change changes candidate', () => {
    test('same plugin + different repo + same SHA = different identity', () => {
      const repo1 = 'nicholass003/TopStats';
      const repo2 = 'otherowner/TopStats';

      const identity1 = createCandidateIdentity({
        ...VALID_COMPONENTS,
        upstreamRepository: repo1,
      });
      const identity2 = createCandidateIdentity({
        ...VALID_COMPONENTS,
        upstreamRepository: repo2,
      });

      expect(equalCandidateIdentity(identity1, identity2)).toBe(false);
      expect(identity1.upstreamRepository).not.toBe(identity2.upstreamRepository);
    });
  });

  describe('plugin identity change changes candidate', () => {
    test('different plugin + same repo + same SHA = different identity', () => {
      const plugin1 = 'topstats';
      const plugin2 = 'differentplugin';

      const identity1 = createCandidateIdentity({
        ...VALID_COMPONENTS,
        pluginSlug: plugin1,
      });
      const identity2 = createCandidateIdentity({
        ...VALID_COMPONENTS,
        pluginSlug: plugin2,
      });

      expect(equalCandidateIdentity(identity1, identity2)).toBe(false);
      expect(identity1.pluginSlug).not.toBe(identity2.pluginSlug);
    });
  });

  describe('identityMatches', () => {
    test('matches all fields', () => {
      const identity = createCandidateIdentity(VALID_COMPONENTS);

      expect(identityMatches(identity, VALID_COMPONENTS)).toBe(true);
    });

    test('matches partial pluginSlug', () => {
      const identity = createCandidateIdentity(VALID_COMPONENTS);

      expect(identityMatches(identity, { pluginSlug: 'topstats' })).toBe(true);
      expect(identityMatches(identity, { pluginSlug: 'different' })).toBe(false);
    });

    test('matches partial SHA', () => {
      const identity = createCandidateIdentity(VALID_COMPONENTS);
      const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

      expect(identityMatches(identity, { sha })).toBe(true);
      expect(identityMatches(identity, { sha: 'bbbbbbbb' + 'a'.repeat(32) })).toBe(false);
    });
  });
});
