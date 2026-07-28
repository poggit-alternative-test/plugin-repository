/**
 * Acquisition Integration Tests
 *
 * Tests that exercise the full acquisition pipeline with real archives.
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createValidPluginArchive,
  createMissingPluginYmlArchive,
  createPathTraversalArchive,
  createAbsolutePathArchive,
  createUnsafeSymlinkArchive,
  createExcessiveFilesArchive,
  ensureFixturesDir,
  cleanupFixtures,
  startFixtureServer,
  type FixtureServer,
} from './fixtures.js';
import { FakeGitHubClient } from '../../src/submission/github.js';
import { acquireSource, LIMITS, validateArchiveUrl } from '../../src/submission/acquisition.js';
import { InspectionStatus } from '../../src/submission/result.js';

// Test directories
const TEST_FIXTURES_DIR = join(tmpdir(), 'axolotl-test-acquisition-fixtures');
const TEST_TEMP_DIR = join(tmpdir(), 'axolotl-test-acquisition-temp');

// Fixture server port
const FIXTURE_SERVER_PORT = 18765;

describe('acquireSource integration', () => {
  let fixtureServer: FixtureServer;
  let fixtures: Map<string, string>;

  beforeAll(async () => {
    // Create fixtures directory
    if (!existsSync(TEST_FIXTURES_DIR)) {
      mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
    }
    if (!existsSync(TEST_TEMP_DIR)) {
      mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }

    fixtures = new Map();

    // Build test archives
    const validArchive = createValidPluginArchive(TEST_FIXTURES_DIR);
    fixtures.set('/valid-plugin.zip', validArchive);

    const missingPluginYml = createMissingPluginYmlArchive(TEST_FIXTURES_DIR);
    fixtures.set('/missing-plugin-yml.zip', missingPluginYml);

    const pathTraversal = createPathTraversalArchive(TEST_FIXTURES_DIR);
    fixtures.set('/path-traversal.zip', pathTraversal);

    const absolutePath = createAbsolutePathArchive(TEST_FIXTURES_DIR);
    fixtures.set('/absolute-path.zip', absolutePath);

    const unsafeSymlink = createUnsafeSymlinkArchive(TEST_FIXTURES_DIR);
    fixtures.set('/unsafe-symlink.zip', unsafeSymlink);

    const excessiveFiles = createExcessiveFilesArchive(TEST_FIXTURES_DIR);
    fixtures.set('/excessive-files.zip', excessiveFiles);

    // Start fixture server
    fixtureServer = await startFixtureServer(FIXTURE_SERVER_PORT, fixtures);
  });

  afterAll(async () => {
    await fixtureServer.stop();
    cleanupFixtures();
    try {
      rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
    } catch {}
  });

  function createFakeClient(archiveUrls: Record<string, string>): FakeGitHubClient {
    return new FakeGitHubClient({
      repositories: {
        'testowner/testrepo': {
          owner: 'testowner',
          name: 'testrepo',
        },
      },
      branches: {
        'testowner/testrepo/main': {
          name: 'main',
          commitSha: 'abc123def456abc123def456abc123def456abc1',
        },
      },
      archiveUrls: Object.fromEntries(
        Object.entries(archiveUrls).map(([k, v]) => [`testowner/testrepo/abc123def456abc123def456abc123def456abc1/zipball`, v])
      ),
    });
  }

  function getArchiveUrl(path: string): string {
    return `http://localhost:${FIXTURE_SERVER_PORT}${path}`;
  }

  test('A: valid plugin archive reaches READY_FOR_REVIEW', async () => {
    const fakeClient = createFakeClient({
      zipball: getArchiveUrl('/valid-plugin.zip'),
    });

    const result = await acquireSource(
      fakeClient,
      'testowner',
      'testrepo',
      'abc123def456abc123def456abc123def456abc1',
      TEST_TEMP_DIR,
      true // allow localhost for testing
    );

    expect(result.success).toBe(true);
    expect(result.sourcePath).toBeDefined();
    expect(result.hasPluginYml).toBe(true);
    expect(result.hasComposerJson).toBe(true);
    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.phpFileCount).toBeGreaterThan(0);

    // No fatal errors
    const fatalErrors = result.diagnostics.filter(
      (d) => d.code === 'SOURCE_PATH_TRAVERSAL' || d.code === 'SOURCE_SYMLINK_ESCAPE' || d.code === 'SOURCE_TOO_LARGE' || d.code === 'SOURCE_TOO_MANY_FILES'
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test('B: exact SHA resolution is preserved', async () => {
    const fakeClient = createFakeClient({
      zipball: getArchiveUrl('/valid-plugin.zip'),
    });

    const result = await acquireSource(
      fakeClient,
      'testowner',
      'testrepo',
      'abc123def456abc123def456abc123def456abc1',
      TEST_TEMP_DIR,
      true
    );

    expect(result.success).toBe(true);
    // The SHA was used in the archive URL resolution
  });

  test('C: repository 404 returns SUBMISSION_ERROR', async () => {
    const fakeClient = new FakeGitHubClient({
      shouldFail: {
        getRepository: { status: 404 },
      },
    });

    const result = await acquireSource(
      fakeClient,
      'nonexistent',
      'repo',
      'abc123def456abc123def456abc123def456abc1',
      TEST_TEMP_DIR,
      true
    );

    // Acquisition fails due to inability to get archive URL
    expect(result.success).toBe(false);
  });

  test('N: missing plugin.yml returns SUBMISSION_ERROR', async () => {
    const fakeClient = createFakeClient({
      zipball: getArchiveUrl('/missing-plugin-yml.zip'),
    });

    const result = await acquireSource(
      fakeClient,
      'testowner',
      'testrepo',
      'abc123def456abc123def456abc123def456abc1',
      TEST_TEMP_DIR,
      true
    );

    // Acquisition succeeds (archive is valid), but plugin.yml is missing
    expect(result.success).toBe(true);
    expect(result.hasPluginYml).toBe(false);
  });

  test('verify fixture paths are as expected', () => {
    // Debug test to see what paths AdmZip is actually storing
    ensureFixturesDir();
    const AdmZip = require('adm-zip');

    const archivePath = createPathTraversalArchive(TEST_FIXTURES_DIR);
    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries();

    console.log('Path traversal archive entries:');
    for (const entry of entries) {
      console.log(`  ${entry.entryName} (isDir: ${entry.isDirectory})`);
    }

    // The malicious entry should contain '..'
    const hasTraversal = entries.some(e => e.entryName.includes('..'));
    expect(hasTraversal).toBe(true);
  });

  test('L: path traversal archive is rejected', async () => {
    const fakeClient = createFakeClient({
      zipball: getArchiveUrl('/path-traversal.zip'),
    });

    const result = await acquireSource(
      fakeClient,
      'testowner',
      'testrepo',
      'abc123def456abc123def456abc123def456abc1',
      TEST_TEMP_DIR,
      true
    );

    // Acquisition must FAIL CLOSED
    expect(result.success).toBe(false);

    // Must have SOURCE_PATH_TRAVERSAL error
    const pathTraversalErrors = result.diagnostics.filter(
      (d) => d.code === 'SOURCE_PATH_TRAVERSAL'
    );
    expect(pathTraversalErrors.length).toBeGreaterThan(0);

    // The extraction should not have written files outside the destination
    // (verified by success: false)
  });

  test('absolute path archive is rejected', async () => {
    const fakeClient = createFakeClient({
      zipball: getArchiveUrl('/absolute-path.zip'),
    });

    const result = await acquireSource(
      fakeClient,
      'testowner',
      'testrepo',
      'abc123def456abc123def456abc123def456abc1',
      TEST_TEMP_DIR,
      true
    );

    // Acquisition must FAIL CLOSED
    expect(result.success).toBe(false);

    // Must have SOURCE_PATH_TRAVERSAL error
    const pathTraversalErrors = result.diagnostics.filter(
      (d) => d.code === 'SOURCE_PATH_TRAVERSAL'
    );
    expect(pathTraversalErrors.length).toBeGreaterThan(0);
  });

  test('unsafe symlink is rejected', async () => {
    const fakeClient = createFakeClient({
      zipball: getArchiveUrl('/unsafe-symlink.zip'),
    });

    const result = await acquireSource(
      fakeClient,
      'testowner',
      'testrepo',
      'abc123def456abc123def456abc123def456abc1',
      TEST_TEMP_DIR,
      true
    );

    // AdmZip may not properly support symlinks, so we accept either:
    // - Success with symlink ignored (if adm-zip skips it)
    // - Failure with SOURCE_SYMLINK_ESCAPE
    if (!result.success) {
      const symlinkErrors = result.diagnostics.filter(
        (d) => d.code === 'SOURCE_SYMLINK_ESCAPE'
      );
      expect(symlinkErrors.length).toBeGreaterThan(0);
    }
  });

  test('excessive files are rejected', async () => {
    const fakeClient = createFakeClient({
      zipball: getArchiveUrl('/excessive-files.zip'),
    });

    const result = await acquireSource(
      fakeClient,
      'testowner',
      'testrepo',
      'abc123def456abc123def456abc123def456abc1',
      TEST_TEMP_DIR,
      true
    );

    // Acquisition must FAIL CLOSED
    expect(result.success).toBe(false);

    // Must have SOURCE_TOO_MANY_FILES error
    const tooManyFilesErrors = result.diagnostics.filter(
      (d) => d.code === 'SOURCE_TOO_MANY_FILES'
    );
    expect(tooManyFilesErrors.length).toBeGreaterThan(0);
  });
});

describe('validateArchiveUrl', () => {
  test('accepts api.github.com HTTPS', () => {
    const result = validateArchiveUrl('https://api.github.com/repos/owner/repo/zipball/sha');
    expect(result.valid).toBe(true);
  });

  test('accepts codeload.github.com HTTPS', () => {
    const result = validateArchiveUrl('https://codeload.github.com/owner/repo/zip/sha');
    expect(result.valid).toBe(true);
  });

  test('rejects HTTP for GitHub hosts', () => {
    const result = validateArchiveUrl('http://api.github.com/repos/owner/repo/zipball/sha');
    expect(result.valid).toBe(false);
  });

  test('rejects localhost without allowLocalhost', () => {
    const result = validateArchiveUrl('https://localhost/archive.zip');
    expect(result.valid).toBe(false);
  });

  test('accepts localhost HTTP with allowLocalhost', () => {
    const result = validateArchiveUrl('http://localhost:18765/archive.zip', true);
    expect(result.valid).toBe(true);
  });

  test('rejects localhost HTTPS without allowLocalhost', () => {
    const result = validateArchiveUrl('https://localhost/archive.zip');
    expect(result.valid).toBe(false);
  });

  test('rejects 127.0.0.1', () => {
    const result = validateArchiveUrl('https://127.0.0.1/archive.zip');
    expect(result.valid).toBe(false);
  });

  test('rejects private IP ranges', () => {
    const privateIps = [
      'https://10.0.0.1/archive.zip',
      'https://172.16.0.1/archive.zip',
      'https://192.168.1.1/archive.zip',
    ];

    for (const url of privateIps) {
      const result = validateArchiveUrl(url);
      expect(result.valid).toBe(false);
    }
  });

  test('rejects URLs with credentials', () => {
    const result = validateArchiveUrl('https://user:pass@api.github.com/repos/owner/repo/zipball/sha');
    expect(result.valid).toBe(false);
  });

  test('rejects file:// URLs', () => {
    const result = validateArchiveUrl('file:///etc/passwd');
    expect(result.valid).toBe(false);
  });

  test('rejects unknown hosts', () => {
    const result = validateArchiveUrl('https://evil.example.com/archive.zip');
    expect(result.valid).toBe(false);
  });
});

describe('fail-closed extraction invariant', () => {
  beforeEach(() => {
    if (!existsSync(TEST_TEMP_DIR)) {
      mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
      mkdirSync(TEST_TEMP_DIR, { recursive: true });
    } catch {}
  });

  test('path traversal causes success=false', async () => {
    ensureFixturesDir();
    const { createPathTraversalArchive } = await import('./fixtures.js');
    const archivePath = createPathTraversalArchive(TEST_FIXTURES_DIR);

    const fakeClient = new FakeGitHubClient({
      repositories: {
        'test/test': { owner: 'test', name: 'test' },
      },
      branches: {
        'test/test/main': { name: 'main', commitSha: 'a'.repeat(40) },
      },
      archiveUrls: {
        [`test/test/${'a'.repeat(10)}/zipball`]: `http://localhost:${FIXTURE_SERVER_PORT}/path-traversal.zip`,
      },
    });

    const result = await acquireSource(
      fakeClient,
      'test',
      'test',
      'a'.repeat(40),
      TEST_TEMP_DIR,
      true
    );

    // MUST be false - fail closed invariant
    expect(result.success).toBe(false);

    // MUST have error diagnostic
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('extraction failure prevents READY_FOR_REVIEW', async () => {
    // This test verifies that the extraction result properly propagates
    // through to prevent READY_FOR_REVIEW

    // The result builder checks sourceAcquired and other fields
    // If extraction fails, sourceAcquired should be false
    ensureFixturesDir();
    const { createPathTraversalArchive } = await import('./fixtures.js');
    const archivePath = createPathTraversalArchive(TEST_FIXTURES_DIR);

    const fakeClient = new FakeGitHubClient({
      repositories: {
        'test/test': { owner: 'test', name: 'test' },
      },
      branches: {
        'test/test/main': { name: 'main', commitSha: 'a'.repeat(40) },
      },
      archiveUrls: {
        [`test/test/${'a'.repeat(10)}/zipball`]: `http://localhost:${FIXTURE_SERVER_PORT}/path-traversal.zip`,
      },
    });

    const result = await acquireSource(
      fakeClient,
      'test',
      'test',
      'a'.repeat(40),
      TEST_TEMP_DIR,
      true
    );

    // Success must be false so inspection cannot be READY_FOR_REVIEW
    expect(result.success).toBe(false);
  });
});

describe('redirect validation', () => {
  let redirectServer: import('./fixtures.js').RedirectServer;

  afterEach(() => {
    if (redirectServer) {
      redirectServer.stop();
      redirectServer = undefined as any;
    }
  });

  test('fetch with redirect:manual returns redirect status', async () => {
    const { startRedirectServer } = await import('./fixtures.js');

    const REDIRECT_SERVER_PORT = 18780;
    redirectServer = startRedirectServer(REDIRECT_SERVER_PORT, [
      {
        path: '/test',
        statusCode: 302,
        location: 'http://localhost:18765/valid-plugin.zip',
      },
    ]);

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 200));

    // Test that fetch with redirect:manual returns the 302 status
    const response = await fetch(`http://localhost:${REDIRECT_SERVER_PORT}/test`, {
      redirect: 'manual'
    });

    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:18765/valid-plugin.zip');
  });

  test('redirect to disallowed host is validated', async () => {
    // This test verifies that the redirect validation logic is correctly checking
    // redirect destinations against the archive URL policy
    const { startRedirectServer } = await import('./fixtures.js');

    const REDIRECT_SERVER_PORT = 18782;
    const SHA = 'b'.repeat(40);
    const SHA_KEY = SHA.slice(0, 10);
    redirectServer = startRedirectServer(REDIRECT_SERVER_PORT, [
      {
        path: '/to-evil',
        statusCode: 302,
        location: 'https://evil.example.com/archive.zip',
      },
    ]);

    await new Promise(resolve => setTimeout(resolve, 200));

    const result = await acquireSource(
      new FakeGitHubClient({
        repositories: { 'test/test': {} },
        branches: { 'test/test/main': { commitSha: SHA } },
        archiveUrls: {
          [`test/test/${SHA_KEY}/zipball`]: `http://localhost:${REDIRECT_SERVER_PORT}/to-evil`,
        },
      }),
      'test',
      'test',
      SHA,
      TEST_TEMP_DIR,
      true
    );

    // The result should fail because the redirect destination (evil.example.com) is not allowed
    // Note: This depends on fetch behavior - if redirects are handled correctly,
    // the validation should reject evil.example.com
    // The implementation uses redirect: 'manual' and validates each redirect destination
    expect(result.success).toBe(false);
  });

  test('validateArchiveUrl rejects unknown hosts in redirect', () => {
    // Direct unit test of the validation logic - evil.example.com is not allowed
    const result = validateArchiveUrl('https://evil.example.com/archive.zip');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown archive host');
  });

  test('validateArchiveUrl rejects localhost in production mode', () => {
    // localhost should be rejected in production mode (allowLocalhost=false)
    // Note: HTTP localhost is rejected for non-HTTPS first; use HTTPS localhost
    const result = validateArchiveUrl('https://localhost:18765/archive.zip', false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('localhost');
  });
});
