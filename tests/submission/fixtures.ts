/**
 * Test fixtures for submission acquisition tests.
 */
import { createServer, Server } from 'http';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, '..', '..', '.test-fixtures');

export interface FixtureServer {
  url: string;
  stop: () => void;
}

export interface RedirectServer {
  url: string;
  redirectTo: (path: string, statusCode: number) => string;
  stop: () => void;
}

export function ensureFixturesDir(): void {
  if (!existsSync(FIXTURES_DIR)) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  }
}

export function cleanupFixtures(): void {
  // Cleanup handled by individual tests
}

export interface RedirectConfig {
  path: string;
  statusCode: number;
  location: string;
}

/**
 * Start a local HTTP server for test fixtures.
 */
export function startFixtureServer(port: number, fixtures: Map<string, string>): Promise<FixtureServer> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const pathname = req.url || '/';
      const fixturePath = fixtures.get(pathname);

      if (fixturePath && existsSync(fixturePath)) {
        const content = readFileSync(fixturePath);
        res.writeHead(200, { 'Content-Type': 'application/zip' });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      resolve({
        url: `http://localhost:${port}`,
        stop: () => server.close(),
      });
    });
  });
}

/**
 * Start a local HTTP server that supports redirect configurations.
 */
export function startRedirectServer(port: number, redirects: RedirectConfig[]): RedirectServer {
  let server: ReturnType<typeof createServer> | null = null;

  // Start server synchronously by using listen callback
  server = createServer((req, res) => {
    const pathname = req.url || '/';

    // Find matching redirect config
    const redirect = redirects.find(r => r.path === pathname);

    if (redirect) {
      res.writeHead(redirect.statusCode, { 'Location': redirect.location });
      res.end();
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  // Start listening immediately
  server.listen(port);

  return {
    url: `http://localhost:${port}`,
    redirectTo: (path: string, statusCode: number) => `http://localhost:${port}${path}`,
    stop: () => { if (server) server.close(); },
  };
}

/**
 * Create a valid plugin archive.
 */
export function createValidPluginArchive(fixturesDir: string): string {
  const archivePath = join(fixturesDir, 'valid-plugin.zip');
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();

  zip.addFile('ValidPlugin/plugin.yml', Buffer.from(`name: ValidPlugin
version: 1.0.0
main: ValidPlugin\\Main
api: 5.0.0
author: TestAuthor
description: A test plugin
`, 'utf-8'));

  zip.addFile('ValidPlugin/src/Main.php', Buffer.from(`<?php
namespace ValidPlugin;

use pocketmine\\plugin\\PluginBase;

class Main extends PluginBase {
    public function onEnable(): void {
        $this->getLogger()->info("ValidPlugin enabled");
    }
}
`, 'utf-8'));

  zip.addFile('ValidPlugin/composer.json', Buffer.from(`{
  "name": "test/valid-plugin",
  "autoload": {
    "psr-4": {
      "ValidPlugin\\\\": "src/"
    }
  }
}
`, 'utf-8'));

  zip.writeZip(archivePath);
  return archivePath;
}

/**
 * Create an archive missing plugin.yml.
 */
export function createMissingPluginYmlArchive(fixturesDir: string): string {
  const archivePath = join(fixturesDir, 'missing-plugin-yml.zip');
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();

  // Add only PHP files, no plugin.yml
  zip.addFile('NoPlugin/src/Main.php', Buffer.from('<?php // no plugin.yml', 'utf-8'));

  zip.writeZip(archivePath);
  return archivePath;
}

/**
 * Create a ZIP file with raw bytes to preserve malicious paths.
 * AdmZip sanitizes paths, so we construct the ZIP manually.
 */
function createZipWithEntries(entries: Array<{ name: string; content: string }>, outputPath: string): void {
  const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
  const CENTRAL_DIR_SIGNATURE = 0x02014b50;
  const END_OF_CENTRAL_DIR_SIGNATURE = 0x06054b50;

  const buffers: Buffer[] = [];
  const centralDirectoryEntries: Buffer[] = [];
  let centralDirOffset = 0;

  for (const entry of entries) {
    const filename = Buffer.from(entry.name, 'utf-8');
    const content = Buffer.from(entry.content, 'utf-8');
    const crc32 = crc32Update(0, content);
    const compressedSize = content.length;
    const uncompressedSize = content.length;

    // Local file header
    const localHeader = Buffer.alloc(30 + filename.length);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // compression method (stored)
    localHeader.writeUInt16LE(0, 10); // last mod time
    localHeader.writeUInt16LE(0, 12); // last mod date
    localHeader.writeUInt32LE(crc32, 14); // crc32
    localHeader.writeUInt32LE(compressedSize, 18); // compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // uncompressed size
    localHeader.writeUInt16LE(filename.length, 26); // filename length
    localHeader.writeUInt16LE(0, 28); // extra field length
    filename.copy(localHeader, 30);

    buffers.push(localHeader, content);

    // Central directory entry
    const centralEntry = Buffer.alloc(46 + filename.length);
    centralEntry.writeUInt32LE(CENTRAL_DIR_SIGNATURE, 0);
    centralEntry.writeUInt16LE(0, 4); // version made by
    centralEntry.writeUInt16LE(20, 6); // version needed
    centralEntry.writeUInt16LE(0, 8); // flags
    centralEntry.writeUInt16LE(0, 10); // compression method
    centralEntry.writeUInt16LE(0, 12); // last mod time
    centralEntry.writeUInt16LE(0, 14); // last mod date
    centralEntry.writeUInt32LE(crc32, 16); // crc32
    centralEntry.writeUInt32LE(compressedSize, 20); // compressed size
    centralEntry.writeUInt32LE(uncompressedSize, 24); // uncompressed size
    centralEntry.writeUInt16LE(filename.length, 28); // filename length
    centralEntry.writeUInt16LE(0, 30); // extra field length
    centralEntry.writeUInt16LE(0, 32); // comment length
    centralEntry.writeUInt16LE(0, 34); // disk number start
    centralEntry.writeUInt16LE(0, 36); // internal attributes
    centralEntry.writeUInt32LE(0, 38); // external attributes
    centralEntry.writeUInt32LE(centralDirOffset, 42); // relative offset
    filename.copy(centralEntry, 46);

    centralDirectoryEntries.push(centralEntry);
    centralDirOffset += localHeader.length + content.length;
  }

  // Write central directory
  const centralDirStart = buffers.reduce((sum, b) => sum + b.length, 0);
  for (const entry of centralDirectoryEntries) {
    buffers.push(entry);
  }

  // End of central directory
  const centralDirSize = buffers.reduce((sum, b) => sum + b.length, 0) - centralDirStart;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(END_OF_CENTRAL_DIR_SIGNATURE, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central directory
  eocd.writeUInt16LE(centralDirectoryEntries.length, 8); // entries on disk
  eocd.writeUInt16LE(centralDirectoryEntries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // central directory size
  eocd.writeUInt32LE(centralDirStart, 16); // central directory offset
  eocd.writeUInt16LE(0, 20); // comment length

  buffers.push(eocd);

  writeFileSync(outputPath, Buffer.concat(buffers));
}

/**
 * CRC32 calculation for ZIP files.
 */
function crc32Update(crc: number, data: Buffer): number {
  const table = makeCrc32Table();
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0) >>> 0;
}

function makeCrc32Table(): number[] {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

/**
 * Create an archive with path traversal attempt.
 * Uses raw ZIP construction to preserve malicious paths.
 */
export function createPathTraversalArchive(fixturesDir: string): string {
  const archivePath = join(fixturesDir, 'path-traversal.zip');

  createZipWithEntries([
    {
      name: 'NormalPlugin/plugin.yml',
      content: `name: NormalPlugin
version: 1.0.0
main: NormalPlugin\\Main
api: 5.0.0
`,
    },
    {
      name: 'NormalPlugin/src/Main.php',
      content: '<?php // safe file',
    },
    // This path traversal attempt should be blocked
    {
      name: '../../../escape.php',
      content: '<?php // malicious escaped content',
    },
  ], archivePath);

  return archivePath;
}

/**
 * Create an archive with absolute path.
 */
export function createAbsolutePathArchive(fixturesDir: string): string {
  const archivePath = join(fixturesDir, 'absolute-path.zip');

  createZipWithEntries([
    {
      name: 'SafePlugin/plugin.yml',
      content: `name: SafePlugin
version: 1.0.0
main: SafePlugin\\Main
api: 5.0.0
`,
    },
    // Absolute path attempt - should be blocked
    {
      name: '/tmp/malicious.php',
      content: '<?php // absolute path escape',
    },
  ], archivePath);

  return archivePath;
}

/**
 * Create an archive with unsafe symlink.
 */
export function createUnsafeSymlinkArchive(fixturesDir: string): string {
  const archivePath = join(fixturesDir, 'unsafe-symlink.zip');
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();

  // AdmZip doesn't support symlinks well, so this creates a regular file
  // that would normally be a symlink in a real malicious archive
  zip.addFile('SafePlugin/plugin.yml', Buffer.from(`name: SafePlugin
version: 1.0.0
main: SafePlugin\\Main
api: 5.0.0
`, 'utf-8'));
  zip.addFile('SafePlugin/link_target', Buffer.from('<?php // symlink target', 'utf-8'));

  zip.writeZip(archivePath);
  return archivePath;
}

/**
 * Create an archive with excessive files.
 */
export function createExcessiveFilesArchive(fixturesDir: string): string {
  const archivePath = join(fixturesDir, 'excessive-files.zip');
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();

  // Create a plugin.yml
  zip.addFile('BigPlugin/plugin.yml', Buffer.from(`name: BigPlugin
version: 1.0.0
main: BigPlugin\\Main
api: 5.0.0
`, 'utf-8'));

  // Add many PHP files to exceed MAX_FILE_COUNT
  const FILE_COUNT = 15000;
  for (let i = 0; i < FILE_COUNT; i++) {
    const dir = `BigPlugin/src/${Math.floor(i / 1000)}`;
    zip.addFile(`${dir}/File${i}.php`, Buffer.from(`<?php // file ${i}`, 'utf-8'));
  }

  zip.writeZip(archivePath);
  return archivePath;
}
