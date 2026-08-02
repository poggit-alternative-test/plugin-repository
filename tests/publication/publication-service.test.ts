/**
 * Publication Service Tests
 *
 * Tests for the publication service and providers.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  PUBLICATION_CODES,
  publicationError,
  publicationWarning,
  getPublicationErrors,
  getPublicationWarnings,
  hasPublicationErrors,
} from '../../src/publication/diagnostics.js';

import {
  FakePublicationProvider,
  type FakePublicationProviderConfig,
} from '../../src/publication/fake-provider.js';

import {
  PUBLICATION_PROVIDER_ERROR_CODES,
  type PublicationProvider,
} from '../../src/publication/provider.js';

import {
  PUBLICATION_SERVICE_LIMITS,
  publishToRelease,
  type BuildMetadata,
  type BuildArtifacts,
  type PublishToReleaseRequest,
} from '../../src/publication/publication-service.js';

// ============================================================
// Test Fixtures
// ============================================================

const TEST_DIR = join(tmpdir(), 'axolotl-publication-service-tests');

function createTestPhar(name: string, size: number = 2048): string {
  mkdirSync(TEST_DIR, { recursive: true });
  const path = join(TEST_DIR, `${name}.phar`);
  // Write enough bytes to pass minimum size check
  const content = Buffer.alloc(size);
  content.write('FAKE_PHAR:' + name, 0, 'utf-8');
  writeFileSync(path, content);
  return path;
}

function createFakePharWithSha256(name: string, sha256: string): string {
  mkdirSync(TEST_DIR, { recursive: true });
  const path = join(TEST_DIR, `${name}.phar`);
  const content = Buffer.alloc(2048);
  content.write('FAKE_PHAR:' + name, 0, 'utf-8');
  writeFileSync(path, content);
  return path;
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
// Diagnostic Tests
// ============================================================

describe('Publication Diagnostics', () => {
  it('publicationError creates error diagnostic', () => {
    const diag = publicationError(
      PUBLICATION_CODES.PUBLICATION_ARTIFACT_NOT_FOUND,
      'PHAR not found',
      { path: '/test/path.phar' }
    );

    expect(diag.code).toBe(PUBLICATION_CODES.PUBLICATION_ARTIFACT_NOT_FOUND);
    expect(diag.severity).toBe('error');
    expect(diag.message).toBe('PHAR not found');
    expect(diag.context).toEqual({ path: '/test/path.phar' });
  });

  it('publicationWarning creates warning diagnostic', () => {
    const diag = publicationWarning(
      PUBLICATION_CODES.ASSET_UPLOAD_FAILED,
      'Asset upload failed'
    );

    expect(diag.code).toBe(PUBLICATION_CODES.ASSET_UPLOAD_FAILED);
    expect(diag.severity).toBe('warning');
  });

  it('getPublicationErrors filters errors correctly', () => {
    const diagnostics = [
      publicationError(PUBLICATION_CODES.PROVIDER_ERROR, 'Error 1'),
      publicationWarning(PUBLICATION_CODES.ASSET_UPLOADED, 'Asset uploaded'),
      publicationError(PUBLICATION_CODES.RELEASE_NOT_FOUND, 'Not found'),
    ];

    const errors = getPublicationErrors(diagnostics);
    expect(errors).toHaveLength(2);
    expect(errors[0].code).toBe(PUBLICATION_CODES.PROVIDER_ERROR);
    expect(errors[1].code).toBe(PUBLICATION_CODES.RELEASE_NOT_FOUND);
  });

  it('getPublicationWarnings filters warnings correctly', () => {
    const diagnostics = [
      publicationWarning(PUBLICATION_CODES.ASSET_UPLOAD_FAILED, 'Upload failed'),
      publicationWarning(PUBLICATION_CODES.METADATA_TOO_LARGE, 'Metadata large'),
      publicationError(PUBLICATION_CODES.PROVIDER_ERROR, 'Error'),
    ];

    const warnings = getPublicationWarnings(diagnostics);
    expect(warnings).toHaveLength(2);
  });

  it('hasPublicationErrors returns true when errors present', () => {
    const diagnostics = [
      publicationWarning(PUBLICATION_CODES.ASSET_UPLOADED, 'Uploaded'),
      publicationError(PUBLICATION_CODES.PROVIDER_ERROR, 'Error'),
    ];

    expect(hasPublicationErrors(diagnostics)).toBe(true);
  });

  it('hasPublicationErrors returns false when only warnings', () => {
    const diagnostics = [
      publicationWarning(PUBLICATION_CODES.ASSET_UPLOADED, 'Uploaded'),
      publicationWarning(PUBLICATION_CODES.METADATA_TOO_LARGE, 'Large'),
    ];

    expect(hasPublicationErrors(diagnostics)).toBe(false);
  });
});

// ============================================================
// Fake Provider Tests
// ============================================================

describe('FakePublicationProvider', () => {
  let provider: FakePublicationProvider;

  beforeEach(() => {
    provider = new FakePublicationProvider({ writeEnabled: true, latency: 0 });
  });

  afterEach(() => {
    provider.close();
  });

  describe('createRelease', () => {
    it('creates a new release successfully', async () => {
      const result = await provider.createRelease({
        repository: 'test-owner/test-repo',
        tagName: 'v1.0.0',
        name: 'TestPlugin v1.0.0',
        body: 'Test release notes',
        draft: true,
      });

      expect(result.success).toBe(true);
      expect(result.release).toBeDefined();
      expect(result.release?.tagName).toBe('v1.0.0');
      expect(result.release?.name).toBe('TestPlugin v1.0.0');
      expect(result.release?.draft).toBe(true);
    });

    it('fails when release already exists', async () => {
      // Create first release
      await provider.createRelease({
        repository: 'test-owner/test-repo',
        tagName: 'v1.0.0',
        name: 'Test v1.0.0',
        body: 'Notes',
        draft: true,
      });

      // Try to create duplicate
      const result = await provider.createRelease({
        repository: 'test-owner/test-repo',
        tagName: 'v1.0.0',
        name: 'Test v1.0.0',
        body: 'Notes',
        draft: true,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_RELEASE_ALREADY_EXISTS);
    });

    it('fails when write mode is disabled', async () => {
      const readOnlyProvider = new FakePublicationProvider({ writeEnabled: false });
      const result = await readOnlyProvider.createRelease({
        repository: 'test-owner/test-repo',
        tagName: 'v1.0.0',
        name: 'Test v1.0.0',
        body: 'Notes',
        draft: true,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_PERMISSION_DENIED);
      readOnlyProvider.close();
    });
  });

  describe('uploadReleaseAsset', () => {
    it('uploads an asset successfully', async () => {
      // Create release first
      const releaseResult = await provider.createRelease({
        repository: 'test-owner/test-repo',
        tagName: 'v1.0.0',
        name: 'Test v1.0.0',
        body: 'Notes',
        draft: true,
      });

      const releaseId = releaseResult.release!.id;

      // Upload asset
      const buffer = Buffer.from('test content');
      const result = await provider.uploadReleaseAsset({
        repository: 'test-owner/test-repo',
        releaseId,
        name: 'test.phar',
        content: buffer,
        contentType: 'application/octet-stream',
      });

      expect(result.success).toBe(true);
      expect(result.asset).toBeDefined();
      expect(result.asset?.name).toBe('test.phar');
      expect(result.asset?.size).toBe(buffer.length);
    });

    it('fails for non-existent release', async () => {
      const buffer = Buffer.from('test content');
      const result = await provider.uploadReleaseAsset({
        repository: 'test-owner/test-repo',
        releaseId: 99999,
        name: 'test.phar',
        content: buffer,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_RELEASE_NOT_FOUND);
    });
  });

  describe('getReleaseByTag', () => {
    it('returns release when it exists', async () => {
      await provider.createRelease({
        repository: 'test-owner/test-repo',
        tagName: 'v1.0.0',
        name: 'Test v1.0.0',
        body: 'Notes',
        draft: true,
      });

      const result = await provider.getReleaseByTag({
        repository: 'test-owner/test-repo',
        tagName: 'v1.0.0',
      });

      expect(result.success).toBe(true);
      expect(result.release).toBeDefined();
      expect(result.release?.tagName).toBe('v1.0.0');
    });

    it('returns null when release does not exist', async () => {
      const result = await provider.getReleaseByTag({
        repository: 'test-owner/test-repo',
        tagName: 'v99.99.99',
      });

      expect(result.success).toBe(true);
      expect(result.release).toBeNull();
    });
  });

  describe('updateRelease', () => {
    it('publishes draft release', async () => {
      const releaseResult = await provider.createRelease({
        repository: 'test-owner/test-repo',
        tagName: 'v1.0.0',
        name: 'Test v1.0.0',
        body: 'Notes',
        draft: true,
      });

      const releaseId = releaseResult.release!.id;
      expect(releaseResult.release?.draft).toBe(true);

      const updateResult = await provider.updateRelease({
        repository: 'test-owner/test-repo',
        releaseId,
        draft: false,
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.release?.draft).toBe(false);
    });
  });

  describe('isWriteEnabled', () => {
    it('returns true when write enabled', () => {
      const enabled = new FakePublicationProvider({ writeEnabled: true });
      expect(enabled.isWriteEnabled()).toBe(true);
      enabled.close();
    });

    it('returns false when write disabled', () => {
      const disabled = new FakePublicationProvider({ writeEnabled: false });
      expect(disabled.isWriteEnabled()).toBe(false);
      disabled.close();
    });
  });
});

// ============================================================
// Publication Service Tests
// ============================================================

describe('publishToRelease', () => {
  let provider: FakePublicationProvider;

  beforeEach(() => {
    provider = new FakePublicationProvider({ writeEnabled: true, latency: 0 });
  });

  afterEach(() => {
    provider.close();
  });

  const validMetadata: BuildMetadata = {
    pluginName: 'TestPlugin',
    pluginVersion: '1.0.0',
    apiVersion: '5.0.0',
    mainClass: 'TestPlugin\\Main',
    description: 'A test plugin',
    author: 'TestAuthor',
  };

  const validArtifacts: BuildArtifacts = {
    pharPath: '',
    sha256: 'a'.repeat(64),
    sizeBytes: 2048,
  };

  beforeEach(() => {
    validArtifacts.pharPath = createTestPhar('test-plugin');
  });

  describe('validation', () => {
    it('fails when PHAR does not exist', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: {
          ...validArtifacts,
          pharPath: '/non/existent/path.phar',
        },
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(false);
      expect(hasPublicationErrors(result.diagnostics)).toBe(true);
      expect(result.diagnostics[0].code).toBe(PUBLICATION_CODES.PUBLICATION_ARTIFACT_NOT_FOUND);
    });

    it('fails when provider is not write-enabled', async () => {
      const readOnlyProvider = new FakePublicationProvider({ writeEnabled: false });

      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
      };

      const result = await publishToRelease(readOnlyProvider, request);

      expect(result.success).toBe(false);
      expect(result.diagnostics[0].code).toBe(PUBLICATION_CODES.PROVIDER_NOT_WRITE_ENABLED);

      readOnlyProvider.close();
    });
  });

  describe('release creation', () => {
    it('creates a draft release successfully', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
        draft: true,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
      expect(result.release).toBeDefined();
      expect(result.release?.tagName).toBe('v1.0.0');
      expect(result.release?.name).toBe('TestPlugin v1.0.0');
      expect(result.release?.draft).toBe(true);
    });

    it('publishes release immediately when draft: false', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
        draft: false,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
      expect(result.release?.draft).toBe(false);
    });

    it('includes assets in result', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
      expect(result.assets).toBeDefined();
      expect(result.assets?.length).toBeGreaterThanOrEqual(3);

      const assetNames = result.assets?.map(a => a.name) ?? [];
      expect(assetNames).toContain('test-plugin.phar');
      expect(assetNames).toContain('checksums.txt');
      expect(assetNames).toContain('metadata.json');
    });

    it('generates release notes from metadata', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
      // Check that a release was created
      const releaseCheck = await provider.getReleaseByTag({
        repository: 'test-org/test-plugin',
        tagName: 'v1.0.0',
      });
      expect(releaseCheck.release?.body).toContain('TestPlugin');
      expect(releaseCheck.release?.body).toContain('1.0.0');
    });

    it('uses custom release notes when provided', async () => {
      const customNotes = '# Custom Release Notes\n\nThese are the custom notes.';
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
        releaseNotes: customNotes,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);

      const releaseCheck = await provider.getReleaseByTag({
        repository: 'test-org/test-plugin',
        tagName: 'v1.0.0',
      });
      expect(releaseCheck.release?.body).toBe(customNotes);
    });
  });

  describe('asset uploads', () => {
    it('uploads PHAR asset', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
      expect(result.assets?.find(a => a.name.endsWith('.phar'))).toBeDefined();
    });

    it('uploads checksums.txt', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
      expect(result.assets?.find(a => a.name === 'checksums.txt')).toBeDefined();
    });

    it('uploads metadata.json', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
      expect(result.assets?.find(a => a.name === 'metadata.json')).toBeDefined();
    });

    it('accepts custom metadata.json content', async () => {
      const customMetadata = JSON.stringify({ custom: 'data', version: '1.0.0' });
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
        metadataJson: customMetadata,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
    });

    it('accepts custom checksum manifest', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
        checksumManifest: {
          checksums: {
            'test.phar': 'b'.repeat(64),
          },
        },
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
    });
  });

  describe('diagnostics', () => {
    it('returns diagnostics on success', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it('includes release created diagnostic', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
      expect(result.diagnostics.some(d => d.code === PUBLICATION_CODES.RELEASE_CREATED)).toBe(true);
    });

    it('includes publishedAt timestamp on success', async () => {
      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
      };

      const result = await publishToRelease(provider, request);

      expect(result.success).toBe(true);
      expect(result.publishedAt).toBeDefined();
      expect(result.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('error handling', () => {
    it('fails when provider throws', async () => {
      const failProvider = new FakePublicationProvider({ writeEnabled: true, latency: 0 });
      failProvider.failNextOperation();

      const request: PublishToReleaseRequest = {
        storageRepository: 'test-org/test-plugin',
        buildMetadata: validMetadata,
        buildArtifacts: validArtifacts,
      };

      const result = await publishToRelease(failProvider, request);

      expect(result.success).toBe(false);
      // Infrastructure errors are included in diagnostics when provider throws
      expect(result.diagnostics.length).toBeGreaterThan(0);

      failProvider.close();
    });
  });
});

// ============================================================
// Limits Tests
// ============================================================

describe('PUBLICATION_SERVICE_LIMITS', () => {
  it('has reasonable default limits', () => {
    expect(PUBLICATION_SERVICE_LIMITS.MIN_PHAR_SIZE).toBe(1024);
    expect(PUBLICATION_SERVICE_LIMITS.MAX_METADATA_SIZE).toBeGreaterThan(0);
    expect(PUBLICATION_SERVICE_LIMITS.MAX_RELEASE_BODY_SIZE).toBeGreaterThan(0);
    expect(PUBLICATION_SERVICE_LIMITS.UPLOAD_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
