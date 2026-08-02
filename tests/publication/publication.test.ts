/**
 * Publication Service Tests
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

import {
  PUBLICATION_CODES,
  publish,
  computeSha256,
  PUBLICATION_LIMITS,
} from '../../src/publication/index.js';

const TEST_DIR = join(tmpdir(), 'axolotl-publication-tests');

// ─── Fixtures ───────────────────────────────────────────────

function createSmallPhar(name: string, size: number): string {
  const dir = join(TEST_DIR, 'fixtures');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.phar`);
  // Write bytes
  writeFileSync(path, Buffer.alloc(Math.max(size, PUBLICATION_LIMITS.MIN_ARTIFACT_SIZE + 1)));
  return path;
}

function createRealPhar(name: string): string {
  const dir = join(TEST_DIR, 'fixtures');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.phar`);
  // Create a file that's at least MIN_ARTIFACT_SIZE bytes
  // This ensures the publish function doesn't reject it as undersize
  const content = `FAKE_PHAR:${name}`.padEnd(PUBLICATION_LIMITS.MIN_ARTIFACT_SIZE + 1, 'x');
  writeFileSync(path, content, 'utf-8');
  return path;
}

function createDest(): string {
  const path = join(TEST_DIR, 'dest', `${Date.now()}-${Math.random()}`);
  return path;
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

// ─── publish() ─────────────────────────────────────────────

describe('publish', () => {
  it('missing artifact returns PUBLICATION_ARTIFACT_NOT_FOUND', async () => {
    const result = await publish({
      artifactPath: join(TEST_DIR, 'does-not-exist.phar'),
      destinationPath: createDest(),
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(
      (d) => d.code === PUBLICATION_CODES.PUBLICATION_ARTIFACT_NOT_FOUND
    )).toBe(true);
  });

  it('non-file artifact returns PUBLISH_ARTIFACT_NOT_FILE', async () => {
    const dir = join(TEST_DIR, 'is-dir');
    mkdirSync(dir, { recursive: true });
    const result = await publish({
      artifactPath: dir,
      destinationPath: createDest(),
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(
      (d) => d.code === PUBLICATION_CODES.PUBLISH_ARTIFACT_NOT_FILE
    )).toBe(true);
  });

  it('empty file returns PUBLISH_ARTIFACT_EMPTY', async () => {
    const emptyPath = join(TEST_DIR, 'empty.phar');
    writeFileSync(emptyPath, '', 'utf-8');

    const result = await publish({
      artifactPath: emptyPath,
      destinationPath: createDest(),
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.success).toBe(false);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain(PUBLICATION_CODES.PUBLISH_ARTIFACT_EMPTY);
  });

  it('undersize artifact returns PUBLISH_ARTIFACT_EMPTY', async () => {
    const smallPath = join(TEST_DIR, 'tiny.phar');
    // Write fewer bytes than MIN_ARTIFACT_SIZE to trigger the undersize error
    writeFileSync(smallPath, Buffer.alloc(PUBLICATION_LIMITS.MIN_ARTIFACT_SIZE - 1));

    const result = await publish({
      artifactPath: smallPath,
      destinationPath: createDest(),
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(
      (d) => d.code === PUBLICATION_CODES.PUBLISH_ARTIFACT_EMPTY
    )).toBe(true);
  });

  it('creates destination directory if missing', async () => {
    const artifactPath = createRealPhar('artifact');
    const dest = join(TEST_DIR, 'new-dest-sub', 'nested');

    const result = await publish({
      artifactPath,
      destinationPath: dest,
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.success).toBe(true);
    expect(existsSync(dest)).toBe(true);
  });

  it('destination is not a directory returns PUBLISH_DEST_NOT_DIRECTORY', async () => {
    const artifactPath = createRealPhar('artifact');
    const fileAsDest = join(TEST_DIR, 'file-as-dest');
    writeFileSync(fileAsDest, 'blocker');

    const result = await publish({
      artifactPath,
      destinationPath: fileAsDest,
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(
      (d) => d.code === PUBLICATION_CODES.PUBLISH_DEST_NOT_DIRECTORY
    )).toBe(true);
  });

  it('copies artifact to destination', async () => {
    const artifactPath = createRealPhar('artifact');
    const dest = createDest();

    const result = await publish({
      artifactPath,
      destinationPath: dest,
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.success).toBe(true);
    expect(result.publishedPath).toBeDefined();
    expect(existsSync(result.publishedPath!)).toBe(true);
  });

  it('filename is basename of artifact', async () => {
    const artifactPath = createRealPhar('MyPlugin');
    const dest = createDest();

    const result = await publish({
      artifactPath,
      destinationPath: dest,
      pluginName: 'MyPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.filename).toBe('MyPlugin.phar');
  });

  it('sha256 matches artifact content', async () => {
    const artifactPath = createRealPhar('content-phar');
    const dest = createDest();

    // Compute expected hash
    const content = readFileSync(artifactPath);
    const expected = createHash('sha256').update(content).digest('hex');

    const result = await publish({
      artifactPath,
      destinationPath: dest,
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.success).toBe(true);
    expect(result.sha256).toBe(expected);
  });

  it('sizeBytes matches artifact size', async () => {
    const artifactPath = createRealPhar('sized-phar');
    const artifactSize = statSync(artifactPath).size;
    const dest = createDest();

    const result = await publish({
      artifactPath,
      destinationPath: dest,
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.success).toBe(true);
    expect(result.sizeBytes).toBe(artifactSize);
  });

  it('copies file to destination, not moved', async () => {
    const artifactPath = createRealPhar('source-preserved');
    const dest = createDest();

    const result = await publish({
      artifactPath,
      destinationPath: dest,
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    // Source still exists — copy, not move
    expect(existsSync(artifactPath)).toBe(true);
    expect(result.success).toBe(true);
  });

  it('handles dot in filename', async () => {
    const artifactPath = createRealPhar('v1.0.0');
    const dest = createDest();

    const result = await publish({
      artifactPath,
      destinationPath: dest,
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
    });

    expect(result.success).toBe(true);
    expect(result.filename).toBeDefined();
  });

  it('context is passed through', async () => {
    const artifactPath = createRealPhar('context-test');
    const dest = createDest();

    const result = await publish({
      artifactPath,
      destinationPath: dest,
      pluginName: 'TestPlugin',
      pluginVersion: '1.0.0',
      context: { buildId: 'build-123', pipeline: 'test' },
    });

    // context is not in result shape — diagnostics may carry it, or BuildService adds it
    // This test verifies the parameter is accepted without error
    expect(result).toBeDefined();
  });
});

// ─── computeSha256 ────────────────────────────────────────────

describe('computeSha256', () => {
  it('computes correct SHA-256 of file content', () => {
    const filePath = join(TEST_DIR, 'sha-test.txt');
    const content = Buffer.from('hello world');
    writeFileSync(filePath, content);

    const digest = computeSha256(filePath);
    expect(digest).toBeDefined();
    expect(digest).toMatch(/^[a-f0-9]{64}$/);

    // Verify manually
    const expected = createHash('sha256').update(content).digest('hex');
    expect(digest).toBe(expected);
  });

  it('returns null for missing file', () => {
    const digest = computeSha256(join(TEST_DIR, 'nonexistent'));
    expect(digest).toBeNull();
  });

  it('handles large file (50 MB) without OOM', async () => {
    const largePath = join(TEST_DIR, 'large.bin');
    // Write a 50 MB file via streaming to avoid memory pressure
    const { createWriteStream } = await import('fs');
    const ws = createWriteStream(largePath);
    const chunk = Buffer.alloc(1024 * 1024); // 1 MB chunk
    for (let i = 0; i < 50; i++) {
      ws.write(chunk);
    }
    ws.end();
    await new Promise<void>((res) => ws.on('finish', res));

    const digest = computeSha256(largePath);
    expect(digest).toBeDefined();
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ─── PUBLICATION_LIMITS ───────────────────────────────────────

describe('PUBLICATION_LIMITS', () => {
  it('MIN_ARTIFACT_SIZE is 1024 bytes', () => {
    expect(PUBLICATION_LIMITS.MIN_ARTIFACT_SIZE).toBe(1024);
  });
});
