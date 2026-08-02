/**
 * Registry Writer Tests
 *
 * Tests for the Registry publication integration.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  buildArtifactRef,
  updateVersionRecordWithPublication,
  writeVersionRecord,
  publishToRegistry,
  type WriterDiagnostic,
} from '../../src/registry/writer.js';

import type { PublishToReleaseResult } from '../../src/publication/index.js';

// ============================================================
// Test Fixtures
// ============================================================

const TEST_DIR = join(tmpdir(), 'axolotl-registry-writer-tests');

function createTestMaterializedVersion(pluginId: string, version: string): string {
  const dir = join(TEST_DIR, 'plugins', pluginId, 'versions');
  mkdirSync(dir, { recursive: true });

  const content = `schema_version: 1
version: ${version}
source:
  upstream_commit: ${'a'.repeat(40)}
storage:
  repository: test-org/${pluginId}
  commit: ${'b'.repeat(40)}
review:
  pull_request: 42
  reviewer: test-reviewer
  approved_at: '2026-07-01T00:00:00Z'
status: materialized
`;
  const filePath = join(dir, `${version}.yaml`);
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function createSuccessfulPublicationResult(
  pluginName: string,
  version: string
): PublishToReleaseResult {
  return {
    success: true,
    release: {
      id: 12345,
      tagName: `v${version}`,
      name: `${pluginName} v${version}`,
      htmlUrl: `https://github.com/test-org/${pluginName}/releases/tag/v${version}`,
      draft: false,
    },
    assets: [
      {
        name: `${pluginName}.phar`,
        contentType: 'application/octet-stream',
        size: 12345,
      },
    ],
    diagnostics: [
      {
        code: 'RELEASE_PUBLISHED',
        severity: 'info',
        message: 'Release published',
      },
    ],
    publishedAt: '2026-08-01T12:00:00Z',
  };
}

// ============================================================
// Setup/Teardown
// ============================================================

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {}
});

// ============================================================
// buildArtifactRef Tests
// ============================================================

describe('buildArtifactRef', () => {
  it('extracts artifact ref from successful publication', () => {
    const pubResult = createSuccessfulPublicationResult('TestPlugin', '1.0.0');
    const { artifactRef, diagnostics } = buildArtifactRef(pubResult, 'TestPlugin', '1.0.0');

    expect(diagnostics).toHaveLength(0);
    expect(artifactRef).toBeDefined();
    expect(artifactRef.releaseTag).toBe('v1.0.0');
    expect(artifactRef.file).toBe('TestPlugin.phar');
    expect(artifactRef.publishedAt).toBe('2026-08-01T12:00:00Z');
  });

  it('returns error when publication failed', () => {
    const failedResult: PublishToReleaseResult = {
      success: false,
      diagnostics: [
        {
          code: 'ASSET_UPLOAD_FAILED',
          severity: 'error',
          message: 'Upload failed',
        },
      ],
    };

    const { artifactRef, diagnostics } = buildArtifactRef(failedResult, 'TestPlugin', '1.0.0');

    expect(diagnostics.some((d) => d.severity === 'error')).toBe(true);
    expect(artifactRef).toBeNull();
  });

  it('warns when publishedAt is missing', () => {
    const resultWithoutTime: PublishToReleaseResult = {
      success: true,
      release: {
        id: 123,
        tagName: 'v1.0.0',
        name: 'Test v1.0.0',
        htmlUrl: 'https://github.com/test/test/releases/tag/v1.0.0',
        draft: false,
      },
      assets: [{ name: 'test.phar', contentType: 'application/octet-stream', size: 1000 }],
      diagnostics: [],
      // publishedAt intentionally omitted
    };

    const { diagnostics } = buildArtifactRef(resultWithoutTime, 'TestPlugin', '1.0.0');
    expect(diagnostics.some((d) => d.code === 'MISSING_PUBLISHED_AT')).toBe(true);
  });
});

// ============================================================
// updateVersionRecordWithPublication Tests
// ============================================================

describe('updateVersionRecordWithPublication', () => {
  it('updates materialized version to published', () => {
    const filePath = createTestMaterializedVersion('test-plugin', '1.0.0');

    const artifactRef = {
      releaseTag: 'v1.0.0',
      file: 'test-plugin.phar',
      sha256: 'abc123'.padEnd(64, '0'),
      publishedAt: '2026-08-01T12:00:00Z',
    };

    const { content, diagnostics } = updateVersionRecordWithPublication(filePath, artifactRef);

    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    expect(content).toBeTruthy();
    expect(content).toContain('status: published');
    expect(content).toContain('artifact:');
    expect(content).toContain('release_tag: v1.0.0');
    expect(content).toContain('file: test-plugin.phar');
    expect(content).toContain('sha256: abc123'.padEnd(64, '0'));
  });

  it('includes provenance when provided', () => {
    const filePath = createTestMaterializedVersion('test-plugin', '1.0.0');

    const artifactRef = {
      releaseTag: 'v1.0.0',
      file: 'test-plugin.phar',
      sha256: 'abc123'.padEnd(64, '0'),
      publishedAt: '2026-08-01T12:00:00Z',
      provenance: { type: 'github-attestation' },
    };

    const { content, diagnostics } = updateVersionRecordWithPublication(filePath, artifactRef);

    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    expect(content).toContain('provenance:');
    expect(content).toContain('type: github-attestation');
  });

  it('preserves existing fields', () => {
    const filePath = createTestMaterializedVersion('my-plugin', '2.0.0');

    const artifactRef = {
      releaseTag: 'v2.0.0',
      file: 'my-plugin.phar',
      sha256: 'def456'.padEnd(64, '1'),
      publishedAt: '2026-08-01T12:00:00Z',
    };

    const { content } = updateVersionRecordWithPublication(filePath, artifactRef);

    // Check preserved fields - YAML is nested, check top-level structure
    expect(content).toContain('schema_version: 1');
    expect(content).toContain('version: 2.0.0');
    expect(content).toContain('source:');
    expect(content).toContain('repository: test-org/my-plugin');
    expect(content).toContain('pull_request: 42');
  });

  it('rejects non-materialized status', () => {
    // Create an approved version file
    const dir = join(TEST_DIR, 'plugins', 'test', 'versions');
    mkdirSync(dir, { recursive: true });
    const approvedContent = `schema_version: 1
version: 1.0.0
status: approved
source:
  upstream_commit: ${'a'.repeat(40)}
review:
  pull_request: 42
  reviewer: reviewer
  approved_at: '2026-07-01T00:00:00Z'
`;
    const filePath = join(dir, '1.0.0.yaml');
    writeFileSync(filePath, approvedContent);

    const artifactRef = {
      releaseTag: 'v1.0.0',
      file: 'test.phar',
      sha256: '0'.repeat(64),
      publishedAt: '2026-08-01T12:00:00Z',
    };

    const { content, diagnostics } = updateVersionRecordWithPublication(filePath, artifactRef);

    expect(diagnostics.some((d) => d.code === 'INVALID_STATUS_TRANSITION')).toBe(true);
    expect(content).toBe('');
  });

  it('returns error for missing file', () => {
    const artifactRef = {
      releaseTag: 'v1.0.0',
      file: 'test.phar',
      sha256: '0'.repeat(64),
      publishedAt: '2026-08-01T12:00:00Z',
    };

    const { content, diagnostics } = updateVersionRecordWithPublication(
      '/non/existent/path.yaml',
      artifactRef
    );

    expect(diagnostics.some((d) => d.code === 'FILE_READ_ERROR')).toBe(true);
    expect(content).toBe('');
  });
});

// ============================================================
// writeVersionRecord Tests
// ============================================================

describe('writeVersionRecord', () => {
  it('writes file successfully', () => {
    const dir = join(TEST_DIR, 'write-test', 'versions');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, '1.0.0.yaml');

    const diagnostics = writeVersionRecord(
      filePath,
      'status: published\nversion: 1.0.0\n'
    );

    expect(diagnostics).toHaveLength(0);
    expect(existsSync(filePath)).toBe(true);
  });

  it('creates nested directories', () => {
    const filePath = join(TEST_DIR, 'deeply', 'nested', 'path', '1.0.0.yaml');
    const diagnostics = writeVersionRecord(filePath, 'status: published\n');

    expect(diagnostics).toHaveLength(0);
    expect(existsSync(filePath)).toBe(true);
  });

  it('overwrites existing file', () => {
    const dir = join(TEST_DIR, 'overwrite-test');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, '1.0.0.yaml');

    writeVersionRecord(filePath, 'version: 1.0.0\nstatus: materialized\n');
    const diagnostics = writeVersionRecord(filePath, 'version: 1.0.0\nstatus: published\n');

    expect(diagnostics).toHaveLength(0);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('status: published');
  });
});

// ============================================================
// publishToRegistry Integration Tests
// ============================================================

describe('publishToRegistry', () => {
  it('completes full publication-to-registry cycle', async () => {
    const pluginId = 'complete-test-plugin';
    const version = '1.0.0';

    // Create materialized version
    const filePath = createTestMaterializedVersion(pluginId, version);

    // Create successful publication result
    const pubResult = createSuccessfulPublicationResult(pluginId, version);

    // Execute publication to registry
    const result = await publishToRegistry(pluginId, version, TEST_DIR, pubResult);

    expect(result.success).toBe(true);
    expect(result.pluginId).toBe(pluginId);
    expect(result.version).toBe(version);
    expect(result.registryPath).toBe(filePath);

    // Verify file was written
    const written = readFileSync(filePath, 'utf-8');
    expect(written).toContain('status: published');
    expect(written).toContain('artifact:');
  });

  it('fails when publication fails', async () => {
    const failedResult: PublishToReleaseResult = {
      success: false,
      diagnostics: [
        {
          code: 'ASSET_UPLOAD_FAILED',
          severity: 'error',
          message: 'Upload failed',
        },
      ],
    };

    const result = await publishToRegistry('test-plugin', '1.0.0', TEST_DIR, failedResult);

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'PUBLICATION_FAILED')).toBe(true);
  });

  it('preserves provenance fields after update', async () => {
    const pluginId = 'provenance-test';
    const version = '1.0.0';
    createTestMaterializedVersion(pluginId, version);

    const pubResult = createSuccessfulPublicationResult(pluginId, version);
    const result = await publishToRegistry(pluginId, version, TEST_DIR, pubResult);

    expect(result.success).toBe(true);

    const content = readFileSync(result.registryPath!, 'utf-8');

    // Provenance fields should be preserved
    expect(content).toContain('source:');
    expect(content).toContain('storage:');
    expect(content).toContain('review:');
    expect(content).toContain('upstream_commit:');
    expect(content).toContain('repository:');
    expect(content).toContain('pull_request:');
  });

  it('includes provenance metadata in published version', async () => {
    const pluginId = 'provenance-metadata-test';
    const version = '1.0.0';
    createTestMaterializedVersion(pluginId, version);

    const pubResult = createSuccessfulPublicationResult(pluginId, version);
    const result = await publishToRegistry(
      pluginId,
      version,
      TEST_DIR,
      pubResult,
      { type: 'github-attestation' }
    );

    expect(result.success).toBe(true);

    const content = readFileSync(result.registryPath!, 'utf-8');
    expect(content).toContain('provenance:');
    expect(content).toContain('type: github-attestation');
  });
});

// ============================================================
// Lifecycle Transition Tests
// ============================================================

describe('Registry lifecycle transitions', () => {
  it('materialized -> published transition is allowed', async () => {
    const pluginId = 'lifecycle-test';
    const version = '1.0.0';
    createTestMaterializedVersion(pluginId, version);

    const pubResult = createSuccessfulPublicationResult(pluginId, version);
    const result = await publishToRegistry(pluginId, version, TEST_DIR, pubResult);

    expect(result.success).toBe(true);

    // Verify final state
    const finalContent = readFileSync(result.registryPath!, 'utf-8');
    expect(finalContent).toContain('status: published');
  });

  it('preserves source integrity during transition', async () => {
    const pluginId = 'source-preservation';
    const version = '2.0.0';
    createTestMaterializedVersion(pluginId, version);

    const pubResult = createSuccessfulPublicationResult(pluginId, version);
    const result = await publishToRegistry(pluginId, version, TEST_DIR, pubResult);

    expect(result.success).toBe(true);

    const content = readFileSync(result.registryPath!, 'utf-8');

    // Source commit must be preserved unchanged
    expect(content).toContain(`upstream_commit: ${'a'.repeat(40)}`);
    // Storage commit must be preserved
    expect(content).toContain(`commit: ${'b'.repeat(40)}`);
  });
});
