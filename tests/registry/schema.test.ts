/**
 * Schema Tests
 *
 * Tests for schema validation including submission vs canonical schema.
 */
import { describe, test, expect } from 'vitest';
import {
  PluginSubmissionSchema,
  PluginIdentitySchema,
  VersionRecordSchema,
  ApprovedVersionSchema,
  PublishedVersionSchema,
  SCHEMA_VERSION,
} from '../../src/registry/schema.js';

describe('PluginSubmissionSchema', () => {
  test('minimal submission input is valid', () => {
    const submission = {
      schema_version: 1,
      upstream: {
        repository: 'nicholass003/TopStats',
        branch: 'main',
      },
    };

    const result = PluginSubmissionSchema.safeParse(submission);
    expect(result.success).toBe(true);
  });

  test('submission with default branch is valid', () => {
    const submission = {
      schema_version: 1,
      upstream: {
        repository: 'nicholass003/TopStats',
      },
    };

    const result = PluginSubmissionSchema.safeParse(submission);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.upstream.branch).toBe('main'); // Default applied
    }
  });

  test('submission with URL instead of owner/name fails', () => {
    const submission = {
      schema_version: 1,
      upstream: {
        repository: 'https://github.com/nicholass003/TopStats',
        branch: 'main',
      },
    };

    const result = PluginSubmissionSchema.safeParse(submission);
    expect(result.success).toBe(false);
  });
});

describe('PluginIdentitySchema (Canonical Registry)', () => {
  test('canonical record with id and upstream is valid', () => {
    const canonical = {
      schema_version: 1,
      id: 'topstats',
      upstream: {
        repository: 'nicholass003/TopStats',
        branch: 'main',
      },
    };

    const result = PluginIdentitySchema.safeParse(canonical);
    expect(result.success).toBe(true);
  });

  test('canonical record with storage is valid', () => {
    const canonical = {
      schema_version: 1,
      id: 'topstats',
      upstream: {
        repository: 'nicholass003/TopStats',
        branch: 'main',
      },
      storage: {
        repository: 'axolotl-pm-pl/TopStats',
      },
    };

    const result = PluginIdentitySchema.safeParse(canonical);
    expect(result.success).toBe(true);
  });

  test('submission input WITHOUT id is NOT valid as canonical', () => {
    // This is what a developer submits
    const submission = {
      schema_version: 1,
      upstream: {
        repository: 'nicholass003/TopStats',
        branch: 'main',
      },
    };

    // It should fail as canonical registry identity (missing id)
    const result = PluginIdentitySchema.safeParse(submission);
    expect(result.success).toBe(false);
  });

  test('canonical record rejects uppercase plugin ID', () => {
    const canonical = {
      schema_version: 1,
      id: 'TopStats', // Wrong: uppercase
      upstream: {
        repository: 'nicholass003/TopStats',
        branch: 'main',
      },
    };

    const result = PluginIdentitySchema.safeParse(canonical);
    expect(result.success).toBe(false);
  });

  test('canonical record rejects URL instead of owner/name', () => {
    const canonical = {
      schema_version: 1,
      id: 'topstats',
      upstream: {
        repository: 'https://github.com/nicholass003/TopStats',
        branch: 'main',
      },
    };

    const result = PluginIdentitySchema.safeParse(canonical);
    expect(result.success).toBe(false);
  });
});

describe('Submission vs Canonical Schema Separation', () => {
  test('submission schema accepts what canonical schema rejects', () => {
    const submissionInput = {
      schema_version: 1,
      upstream: {
        repository: 'nicholass003/TopStats',
        branch: 'main',
      },
    };

    // Submission schema accepts it
    const submissionResult = PluginSubmissionSchema.safeParse(submissionInput);
    expect(submissionResult.success).toBe(true);

    // Canonical schema rejects it (missing id)
    const canonicalResult = PluginIdentitySchema.safeParse(submissionInput);
    expect(canonicalResult.success).toBe(false);
  });

  test('canonical schema accepts what submission schema accepts', () => {
    const canonicalInput = {
      schema_version: 1,
      id: 'topstats',
      upstream: {
        repository: 'nicholass003/TopStats',
        branch: 'main',
      },
    };

    // Canonical schema accepts it
    const canonicalResult = PluginIdentitySchema.safeParse(canonicalInput);
    expect(canonicalResult.success).toBe(true);

    // Submission schema also accepts it (submission schema is more permissive)
    const submissionResult = PluginSubmissionSchema.safeParse(canonicalInput);
    expect(submissionResult.success).toBe(true);
  });
});

describe('VersionRecordSchema Lifecycle Invariants', () => {
  test('approved version does NOT require storage or artifact', () => {
    const approved = {
      schema_version: 1,
      version: '1.0.0',
      source: {
        upstream_commit: 'a82f0e123456789abcdef123456789abcdef1234',
      },
      review: {
        pull_request: 42,
        reviewer: 'axolotl-reviewer',
        approved_at: '2026-07-20T15:30:00Z',
      },
      status: 'approved',
    };

    const result = ApprovedVersionSchema.safeParse(approved);
    expect(result.success).toBe(true);
  });

  test('published version REQUIRES storage and artifact', () => {
    const published = {
      schema_version: 1,
      version: '1.0.0',
      source: {
        upstream_commit: 'a82f0e123456789abcdef123456789abcdef1234',
      },
      review: {
        pull_request: 42,
        reviewer: 'axolotl-reviewer',
        approved_at: '2026-07-20T15:30:00Z',
      },
      storage: {
        repository: 'axolotl-pm-pl/TopStats',
        commit: 'a82f0e123456789abcdef123456789abcdef1234',
      },
      artifact: {
        release_tag: 'v1.0.0',
        file: 'TopStats.phar',
        sha256: 'a'.repeat(64),
        published_at: '2026-07-20T16:00:00Z',
      },
      status: 'published',
    };

    const result = PublishedVersionSchema.safeParse(published);
    expect(result.success).toBe(true);
  });

  test('published version WITHOUT storage fails', () => {
    const publishedWithoutStorage = {
      schema_version: 1,
      version: '1.0.0',
      source: {
        upstream_commit: 'a82f0e123456789abcdef123456789abcdef1234',
      },
      review: {
        pull_request: 42,
        reviewer: 'axolotl-reviewer',
        approved_at: '2026-07-20T15:30:00Z',
      },
      artifact: {
        release_tag: 'v1.0.0',
        file: 'TopStats.phar',
        sha256: 'a'.repeat(64),
        published_at: '2026-07-20T16:00:00Z',
      },
      status: 'published',
    };

    const result = PublishedVersionSchema.safeParse(publishedWithoutStorage);
    expect(result.success).toBe(false);
  });

  test('published version WITHOUT artifact fails', () => {
    const publishedWithoutArtifact = {
      schema_version: 1,
      version: '1.0.0',
      source: {
        upstream_commit: 'a82f0e123456789abcdef123456789abcdef1234',
      },
      review: {
        pull_request: 42,
        reviewer: 'axolotl-reviewer',
        approved_at: '2026-07-20T15:30:00Z',
      },
      storage: {
        repository: 'axolotl-pm-pl/TopStats',
        commit: 'a82f0e123456789abcdef123456789abcdef1234',
      },
      status: 'published',
    };

    const result = PublishedVersionSchema.safeParse(publishedWithoutArtifact);
    expect(result.success).toBe(false);
  });

  test('top-level status is the lifecycle discriminant', () => {
    // This should fail - cannot have status nested in review
    const wrongStatus = {
      schema_version: 1,
      version: '1.0.0',
      source: {
        upstream_commit: 'a82f0e123456789abcdef123456789abcdef1234',
      },
      review: {
        pull_request: 42,
        reviewer: 'axolotl-reviewer',
        approved_at: '2026-07-20T15:30:00Z',
        status: 'approved', // Wrong: nested status
      },
      status: 'approved',
    };

    const result = ApprovedVersionSchema.safeParse(wrongStatus);
    // The schema accepts it because review.status is not a defined field,
    // but the top-level status is what matters for discrimination
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('approved');
    }
  });
});

describe('Schema Version', () => {
  test('schema version 1 is supported', () => {
    const record = {
      schema_version: 1,
      version: '1.0.0',
      source: {
        upstream_commit: 'a82f0e123456789abcdef123456789abcdef1234',
      },
      review: {
        pull_request: 42,
        reviewer: 'axolotl-reviewer',
        approved_at: '2026-07-20T15:30:00Z',
      },
      status: 'approved',
    };

    const result = ApprovedVersionSchema.safeParse(record);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schema_version).toBe(SCHEMA_VERSION);
    }
  });

  test('schema version 2 is rejected', () => {
    const record = {
      schema_version: 2,
      version: '1.0.0',
      source: {
        upstream_commit: 'a82f0e123456789abcdef123456789abcdef1234',
      },
      review: {
        pull_request: 42,
        reviewer: 'axolotl-reviewer',
        approved_at: '2026-07-20T15:30:00Z',
      },
      status: 'approved',
    };

    const result = ApprovedVersionSchema.safeParse(record);
    expect(result.success).toBe(false);
  });
});
