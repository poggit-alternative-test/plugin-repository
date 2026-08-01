/**
 * Build Filesystem Abstraction
 *
 * Provides safe filesystem operations for the Build Domain.
 *
 * SECURITY: All operations are bounded to prevent resource exhaustion.
 * No execution of file contents as code.
 */

import { readdirSync, readFileSync, statSync, existsSync, lstatSync } from 'fs';
import { join, extname, relative, basename } from 'path';

// ============================================================
// Resource Limits
// ============================================================

export const FS_MAX_DEPTH = 20;
export const FS_MAX_FILES = 10000;
export const FS_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MiB

// ============================================================
// Default Ignore Patterns
// ============================================================

export const DEFAULT_IGNORE_DIRS = new Set([
  'vendor',
  'node_modules',
  '.git',
  '.github',
  '.idea',
  '.vscode',
  'tests',
  'test',
  '__tests__',
  'dist',
  'build',
  '.tmp',
  '.cache',
  '.nyc_output',
  'coverage',
]);

export const DEFAULT_IGNORE_PATTERNS = new Set([
  '.git',
  '.DS_Store',
  'Thumbs.db',
]);

export const DEFAULT_INCLUDE_EXTENSIONS = new Set(['.php']);

// ============================================================
// Result Types
// ============================================================

export interface FileInfo {
  /** Absolute path */
  absolutePath: string;
  /** Relative path from source root */
  relativePath: string;
  /** File name */
  name: string;
  /** File extension */
  extension: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Whether this is a symlink */
  isSymlink: boolean;
  /** Whether this is a directory */
  isDirectory: boolean;
}

export interface DirectoryListingOptions {
  /** Maximum directory depth (default: 20) */
  maxDepth?: number;
  /** Maximum total files (default: 10000) */
  maxFiles?: number;
  /** Directories to skip (default: DEFAULT_IGNORE_DIRS) */
  ignoreDirs?: Set<string>;
  /** Files to skip by basename (default: DEFAULT_IGNORE_PATTERNS) */
  ignoreFiles?: Set<string>;
  /** Extensions to include (empty = all files) */
  includeExtensions?: Set<string>;
  /** Follow symlinks (default: false) */
  followSymlinks?: boolean;
  /** Include directory entries (default: false) */
  includeDirectories?: boolean;
}

export interface DirectoryListingResult {
  /** All discovered files */
  files: FileInfo[];
  /** Directories discovered */
  directories: string[];
  /** Total files found */
  totalFiles: number;
  /** Total directories traversed */
  totalDirectories: number;
  /** Whether limits were hit */
  truncated: boolean;
  /** Diagnostics/warnings */
  warnings: string[];
}

export interface SafeReadOptions {
  /** Maximum file size in bytes (default: 10 MiB) */
  maxSize?: number;
  /** Encoding (default: 'utf-8') */
  encoding?: BufferEncoding;
}

export interface SafeReadResult {
  /** Whether read succeeded */
  success: boolean;
  /** File content (if successful) */
  content?: string;
  /** File info */
  fileInfo?: FileInfo;
  /** Error message (if failed) */
  error?: string;
}

// ============================================================
// Main Functions
// ============================================================

/**
 * List files in a directory recursively with ignore rules and limits.
 *
 * @param rootPath Root directory to start listing
 * @param options Listing options
 * @returns Directory listing result
 */
export function listDirectory(
  rootPath: string,
  options: DirectoryListingOptions = {}
): DirectoryListingResult {
  const maxDepth = options.maxDepth ?? FS_MAX_DEPTH;
  const maxFiles = options.maxFiles ?? FS_MAX_FILES;
  const ignoreDirs = options.ignoreDirs ?? DEFAULT_IGNORE_DIRS;
  const ignoreFiles = options.ignoreFiles ?? DEFAULT_IGNORE_PATTERNS;
  const includeExtensions = options.includeExtensions;
  const followSymlinks = options.followSymlinks ?? false;

  const files: FileInfo[] = [];
  const directories: string[] = [];
  const warnings: string[] = [];
  let totalDirectories = 0;
  let truncated = false;

  // Validate root path
  if (!existsSync(rootPath)) {
    warnings.push(`Root path does not exist: ${rootPath}`);
    return { files, directories: [], totalFiles: 0, totalDirectories: 0, truncated: false, warnings };
  }

  function traverse(currentPath: string, depth: number): void {
    if (truncated) return;
    if (depth > maxDepth) {
      warnings.push(`Max depth exceeded at: ${relative(rootPath, currentPath)}`);
      return;
    }

    let entries: ReturnType<typeof readdirSync<boolean>>;
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch {
      warnings.push(`Cannot read directory: ${relative(rootPath, currentPath)}`);
      return;
    }

    for (const entry of entries) {
      if (truncated) break;

      const entryName: string = entry.name;
      const fullPath = join(currentPath, entryName);
      const relPath = relative(rootPath, fullPath);

      // Skip ignored files
      if (ignoreFiles.has(entryName) || ignoreFiles.has(entryName.toLowerCase())) {
        continue;
      }

      // Handle symlinks
      let isSymlink = false;
      try {
        isSymlink = lstatSync(fullPath).isSymbolicLink();
      } catch {
        warnings.push(`Cannot stat: ${relPath}`);
        continue;
      }

      if (isSymlink && !followSymlinks) {
        continue;
      }

      // Handle directories
      if (entry.isDirectory()) {
        const dirName = entryName.toLowerCase();
        if (ignoreDirs.has(dirName)) {
          continue;
        }

        directories.push(relPath);
        totalDirectories++;
        traverse(fullPath, depth + 1);
        continue;
      }

      // Handle files (skip non-regular files)
      if (!entry.isFile()) {
        continue;
      }

      const ext = extname(entryName).toLowerCase();
      if (includeExtensions && includeExtensions.size > 0 && !includeExtensions.has(ext)) {
        continue;
      }

      // Get file stats
      let sizeBytes = 0;
      try {
        sizeBytes = statSync(fullPath).size;
      } catch {
        warnings.push(`Cannot stat file: ${relPath}`);
        continue;
      }

      files.push({
        absolutePath: fullPath,
        relativePath: relPath,
        name: entryName,
        extension: ext,
        sizeBytes,
        isSymlink,
        isDirectory: false,
      });

      if (files.length >= maxFiles) {
        truncated = true;
        warnings.push(`Max files limit reached: ${maxFiles}`);
        break;
      }
    }
  }

  // Start traversal
  directories.push('');
  totalDirectories = 1;
  traverse(rootPath, 1);

  return {
    files,
    directories,
    totalFiles: files.length,
    totalDirectories,
    truncated,
    warnings,
  };
}

/**
 * List only PHP files in a directory tree.
 */
export function listPhpFiles(
  rootPath: string,
  options: Omit<DirectoryListingOptions, 'includeExtensions'> & { includeExtensions?: Set<string> } = {}
): DirectoryListingResult {
  return listDirectory(rootPath, {
    ...options,
    includeExtensions: options.includeExtensions ?? DEFAULT_INCLUDE_EXTENSIONS,
  });
}

/**
 * Read a file safely with bounded size.
 *
 * @param filePath Path to the file
 * @param options Read options
 * @returns Safe read result
 */
export function safeReadFile(
  filePath: string,
  options: SafeReadOptions = {}
): SafeReadResult {
  const maxSize = options.maxSize ?? FS_MAX_FILE_SIZE;
  const encoding = options.encoding ?? 'utf-8';

  // Get file info
  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(filePath);
  } catch {
    return {
      success: false,
      error: `Cannot stat: ${filePath}`,
    };
  }

  if (stats.size > maxSize) {
    return {
      success: false,
      error: `File exceeds size limit: ${stats.size} > ${maxSize} bytes`,
      fileInfo: {
        absolutePath: filePath,
        relativePath: basename(filePath),
        name: basename(filePath),
        extension: extname(filePath).toLowerCase(),
        sizeBytes: stats.size,
        isSymlink: stats.isSymbolicLink(),
        isDirectory: stats.isDirectory(),
      },
    };
  }

  // Read content
  let content: string;
  try {
    content = readFileSync(filePath, { encoding });
  } catch (e) {
    return {
      success: false,
      error: `Cannot read: ${e instanceof Error ? e.message : 'Unknown error'}`,
      fileInfo: {
        absolutePath: filePath,
        relativePath: basename(filePath),
        name: basename(filePath),
        extension: extname(filePath).toLowerCase(),
        sizeBytes: stats.size,
        isSymlink: stats.isSymbolicLink(),
        isDirectory: stats.isDirectory(),
      },
    };
  }

  return {
    success: true,
    content,
    fileInfo: {
      absolutePath: filePath,
      relativePath: basename(filePath),
      name: basename(filePath),
      extension: extname(filePath).toLowerCase(),
      sizeBytes: stats.size,
      isSymlink: stats.isSymbolicLink(),
      isDirectory: stats.isDirectory(),
    },
  };
}

/**
 * Check if path is within root (symlink-safe).
 */
export function isPathSafe(filePath: string, rootPath: string): boolean {
  try {
    const normalized = filePath.toLowerCase();
    const normalizedRoot = rootPath.toLowerCase();
    return normalized.startsWith(normalizedRoot);
  } catch {
    return false;
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get a file listing for a specific set of paths (used by scanner/validator).
 */
export function listSpecificFiles(
  rootPath: string,
  filePaths: string[],
  options: SafeReadOptions & { maxSize?: number } = {}
): Map<string, SafeReadResult> {
  const results = new Map<string, SafeReadResult>();

  for (const relPath of filePaths) {
    const fullPath = join(rootPath, relPath);

    // Security check: ensure path is within root
    if (!isPathSafe(fullPath, rootPath)) {
      results.set(relPath, { success: false, error: 'Path traversal detected' });
      continue;
    }

    results.set(relPath, safeReadFile(fullPath, options));
  }

  return results;
}

/**
 * Collect files matching a predicate.
 */
export function collectFiles(
  rootPath: string,
  predicate: (info: FileInfo) => boolean,
  options: DirectoryListingOptions = {}
): FileInfo[] {
  return listDirectory(rootPath, options).files.filter(predicate);
}

/**
 * Get all PHP files from a directory.
 */
export function getPhpFiles(
  rootPath: string,
  options?: Omit<DirectoryListingOptions, 'includeExtensions'>
): FileInfo[] {
  return listPhpFiles(rootPath, options).files;
}

/**
 * Get total size of files in bytes.
 */
export function getTotalSize(files: FileInfo[]): number {
  return files.reduce((sum, f) => sum + f.sizeBytes, 0);
}

/**
 * Group files by extension.
 */
export function groupByExtension(files: FileInfo[]): Map<string, FileInfo[]> {
  const groups = new Map<string, FileInfo[]>();

  for (const file of files) {
    const ext = file.extension || '(no extension)';
    if (!groups.has(ext)) {
      groups.set(ext, []);
    }
    groups.get(ext)!.push(file);
  }

  return groups;
}
