/**
 * Unit tests for Build Filesystem Abstraction
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, symlinkSync, lstatSync } from 'fs';
import { join } from 'path';
import {
  listDirectory,
  listPhpFiles,
  safeReadFile,
  isPathSafe,
  FS_MAX_DEPTH,
  FS_MAX_FILES,
  DEFAULT_IGNORE_DIRS,
  groupByExtension,
  getTotalSize,
  collectFiles,
  getPhpFiles,
} from '../src/filesystem.js';

describe('listDirectory', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-fs-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('lists files in root directory', () => {
    writeFileSync(join(testDir, 'file1.txt'), 'content1');
    writeFileSync(join(testDir, 'file2.txt'), 'content2');

    const result = listDirectory(testDir);

    expect(result.totalFiles).toBe(2);
    expect(result.files).toHaveLength(2);
  });

  it('recursively lists files', () => {
    mkdirSync(join(testDir, 'subdir'));
    writeFileSync(join(testDir, 'file.txt'), 'content');
    writeFileSync(join(testDir, 'subdir', 'nested.txt'), 'nested');

    const result = listDirectory(testDir);

    expect(result.totalFiles).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it('skips ignored directories', () => {
    mkdirSync(join(testDir, 'vendor'));
    mkdirSync(join(testDir, 'node_modules'));
    writeFileSync(join(testDir, 'file.txt'), 'content');
    writeFileSync(join(testDir, 'vendor', 'lib.php'), '<?php');

    const result = listDirectory(testDir);

    expect(result.totalFiles).toBe(1);
    expect(result.files.some(f => f.name === 'file.txt')).toBe(true);
    expect(result.directories).toHaveLength(1); // Only root
  });

  it('respects maxDepth', () => {
    mkdirSync(join(testDir, 'level1'), { recursive: true });
    writeFileSync(join(testDir, 'level1', 'file.txt'), 'content');

    const result = listDirectory(testDir, { maxDepth: 1 });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('depth'))).toBe(true);
  });

  it('respects maxFiles limit', () => {
    for (let i = 0; i < 150; i++) {
      writeFileSync(join(testDir, `file${i}.txt`), 'content');
    }

    const result = listDirectory(testDir, { maxFiles: 100 });

    expect(result.truncated).toBe(true);
    expect(result.totalFiles).toBeLessThanOrEqual(100);
  });

  it('filters by extension', () => {
    writeFileSync(join(testDir, 'file.php'), '<?php');
    writeFileSync(join(testDir, 'file.txt'), 'text');
    writeFileSync(join(testDir, 'file.md'), '# markdown');

    const result = listDirectory(testDir, {
      includeExtensions: new Set(['.php', '.md'])
    });

    expect(result.totalFiles).toBe(2);
  });

  it('returns file info with metadata', () => {
    writeFileSync(join(testDir, 'test.php'), '<?php echo "test";');

    const result = listDirectory(testDir);

    const file = result.files.find(f => f.name === 'test.php');
    expect(file).toBeDefined();
    expect(file!.extension).toBe('.php');
    expect(file!.sizeBytes).toBeGreaterThan(0);
    expect(file!.isDirectory).toBe(false);
  });

  it('handles non-existent root', () => {
    const result = listDirectory(join(testDir, 'nonexistent'));

    expect(result.totalFiles).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('reports directories traversed', () => {
    mkdirSync(join(testDir, 'sub1'));
    mkdirSync(join(testDir, 'sub1', 'sub2'));
    writeFileSync(join(testDir, 'file.txt'), 'content');

    const result = listDirectory(testDir);

    expect(result.totalDirectories).toBeGreaterThanOrEqual(3);
  });
});

describe('listPhpFiles', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-php-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('lists only PHP files', () => {
    writeFileSync(join(testDir, 'script.php'), '<?php');
    writeFileSync(join(testDir, 'readme.md'), '# Readme');
    writeFileSync(join(testDir, 'data.json'), '{}');

    const result = listPhpFiles(testDir);

    expect(result.totalFiles).toBe(1);
    expect(result.files[0].name).toBe('script.php');
  });

  it('recursively finds PHP files', () => {
    mkdirSync(join(testDir, 'src'));
    writeFileSync(join(testDir, 'main.php'), '<?php');
    writeFileSync(join(testDir, 'src', 'Helper.php'), '<?php');

    const result = listPhpFiles(testDir);

    expect(result.totalFiles).toBe(2);
  });
});

describe('safeReadFile', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-read-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('reads valid file', () => {
    const filePath = join(testDir, 'test.txt');
    writeFileSync(filePath, 'Hello World');

    const result = safeReadFile(filePath);

    expect(result.success).toBe(true);
    expect(result.content).toBe('Hello World');
  });

  it('reads PHP files', () => {
    const filePath = join(testDir, 'script.php');
    writeFileSync(filePath, '<?php echo "test";');

    const result = safeReadFile(filePath);

    expect(result.success).toBe(true);
    expect(result.content).toBe('<?php echo "test";');
  });

  it('respects maxSize limit', () => {
    const filePath = join(testDir, 'large.txt');
    writeFileSync(filePath, 'x'.repeat(1000));

    const result = safeReadFile(filePath, { maxSize: 500 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds size limit');
  });

  it('handles non-existent file', () => {
    const result = safeReadFile(join(testDir, 'nonexistent.txt'));

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot stat');
  });

  it('returns file info on success', () => {
    const filePath = join(testDir, 'test.txt');
    writeFileSync(filePath, 'content');

    const result = safeReadFile(filePath);

    expect(result.fileInfo).toBeDefined();
    expect(result.fileInfo!.sizeBytes).toBe(7);
  });
});

describe('isPathSafe', () => {
  const root = '/project/src';

  it('returns true for paths within root', () => {
    expect(isPathSafe('/project/src/file.php', root)).toBe(true);
    expect(isPathSafe('/project/src/sub/file.php', root)).toBe(true);
  });

  it('returns false for paths outside root', () => {
    expect(isPathSafe('/project/other/file.php', root)).toBe(false);
    expect(isPathSafe('/etc/passwd', root)).toBe(false);
  });
});

describe('groupByExtension', () => {
  it('groups files by extension', () => {
    const files = [
      { name: 'a.php', extension: '.php', sizeBytes: 100 } as any,
      { name: 'b.php', extension: '.php', sizeBytes: 200 } as any,
      { name: 'c.txt', extension: '.txt', sizeBytes: 50 } as any,
    ];

    const groups = groupByExtension(files as any);

    expect(groups.get('.php')).toHaveLength(2);
    expect(groups.get('.txt')).toHaveLength(1);
  });
});

describe('getTotalSize', () => {
  it('calculates total size', () => {
    const files = [
      { sizeBytes: 100 } as any,
      { sizeBytes: 200 } as any,
      { sizeBytes: 50 } as any,
    ];

    expect(getTotalSize(files)).toBe(350);
  });

  it('handles empty array', () => {
    expect(getTotalSize([])).toBe(0);
  });
});

describe('constants', () => {
  it('FS_MAX_DEPTH is 20', () => {
    expect(FS_MAX_DEPTH).toBe(20);
  });

  it('FS_MAX_FILES is 10000', () => {
    expect(FS_MAX_FILES).toBe(10000);
  });

  it('DEFAULT_IGNORE_DIRS contains vendor and node_modules', () => {
    expect(DEFAULT_IGNORE_DIRS.has('vendor')).toBe(true);
    expect(DEFAULT_IGNORE_DIRS.has('node_modules')).toBe(true);
    expect(DEFAULT_IGNORE_DIRS.has('.git')).toBe(true);
  });
});
