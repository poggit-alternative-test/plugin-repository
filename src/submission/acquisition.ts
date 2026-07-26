/**
 * Source Acquisition
 *
 * Safely acquires source code from GitHub for a specific commit.
 * NO execution of repository-controlled scripts or code.
 *
 * Security requirements:
 * - Bounded download size
 * - Bounded extracted size
 * - Bounded file count
 * - Path traversal protection
 * - Symlink handling
 * - No execution
 * - Cleanup after run
 */

import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'fs';
import { join, relative, resolve, isAbsolute, sep } from 'path';
import {
  SUBMISSION_CODES,
  submissionError,
  submissionWarning,
  type SubmissionDiagnostic,
} from './diagnostics.js';
import type { GitHubClient } from './github.js';

// ============================================================
// Resource Limits
// ============================================================

export const LIMITS = {
  MAX_ARCHIVE_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_EXTRACTED_SIZE: 200 * 1024 * 1024, // 200 MB
  MAX_FILE_COUNT: 10000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB per file
  MAX_TREE_DEPTH: 20,
  EXTRACTION_TIMEOUT: 60000, // 60 seconds
  ARCHIVE_DOWNLOAD_TIMEOUT: 120000, // 120 seconds
} as const;

// ============================================================
// Result Types
// ============================================================

export interface SourceAcquisitionResult {
  success: boolean;
  sourcePath?: string;
  fileCount?: number;
  phpFileCount?: number;
  totalSizeBytes?: number;
  hasPluginYml?: boolean;
  hasComposerJson?: boolean;
  symlinkCount?: number;
  diagnostics: SubmissionDiagnostic[];
}

// ============================================================
// Path Security Validation
// ============================================================

/**
 * Validate that a path is safe for extraction.
 * Returns the safe path if valid, or null if the path is unsafe.
 *
 * Checks:
 * - No path traversal (..)
 * - No absolute paths
 * - No Windows drive paths
 * - No escape attempts via normalization
 */
export function validateExtractionPath(unsafePath: string, destination: string): string | null {
  // Normalize the path to remove . and ..
  const normalized = unsafePath.replace(/\\/g, '/');

  // Check for path traversal
  if (normalized.includes('..')) {
    return null;
  }

  // Check for absolute paths
  if (normalized.startsWith('/')) {
    return null;
  }

  // Check for Windows absolute paths
  if (/^[a-zA-Z]:/.test(normalized)) {
    return null;
  }

  // Check for Windows UNC paths
  if (normalized.startsWith('\\\\')) {
    return null;
  }

  // Resolve the full path
  const fullPath = resolve(destination, normalized);

  // Ensure the resolved path is still within the destination
  const resolvedDest = resolve(destination);
  if (!fullPath.startsWith(resolvedDest + sep)) {
    return null;
  }

  return fullPath;
}

/**
 * Check if a symlink target is safe (doesn't escape extraction directory).
 */
function isSymlinkTargetSafe(targetPath: string, destination: string): boolean {
  try {
    const resolved = resolve(destination, targetPath);
    const resolvedDest = resolve(destination);
    return resolved.startsWith(resolvedDest + sep) || resolved === resolvedDest;
  } catch {
    return false;
  }
}

/**
 * Check if a path is inside the destination directory.
 */
export function isPathEscape(filePath: string, destination: string): boolean {
  const resolved = resolve(destination, filePath);
  const resolvedDest = resolve(destination);
  return !resolved.startsWith(resolvedDest + sep) && resolved !== resolvedDest;
}

// ============================================================
// Bounded Download
// ============================================================

/**
 * Download a file with bounded size checks.
 * Reads in chunks and aborts if size limit is exceeded.
 */
async function boundedDownload(
  url: string,
  destinationPath: string,
  timeout: number = LIMITS.ARCHIVE_DOWNLOAD_TIMEOUT
): Promise<{ success: boolean; bytesRead: number; error?: string }> {
  return new Promise((resolve) => {
    let bytesRead = 0;
    let aborted = false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      aborted = true;
      controller.abort();
    }, timeout);

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          clearTimeout(timeoutId);
          resolve({ success: false, bytesRead: 0, error: `HTTP ${response.status}` });
          return;
        }

        const contentLength = response.headers.get('content-length');
        const archiveSize = contentLength ? parseInt(contentLength, 10) : 0;

        // Early check if content-length exceeds limit
        if (archiveSize > LIMITS.MAX_ARCHIVE_SIZE) {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            bytesRead: 0,
            error: `Archive size ${archiveSize} exceeds limit ${LIMITS.MAX_ARCHIVE_SIZE}`,
          });
          return;
        }

        const writeStream = createWriteStream(destinationPath);

        // Use response body as an async iterable
        const reader = response.body!.getReader();

        async function pump(): Promise<void> {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                clearTimeout(timeoutId);
                writeStream.end();
                resolve({ success: true, bytesRead });
                return;
              }

              bytesRead += value.length;

              // Check during streaming
              if (bytesRead > LIMITS.MAX_ARCHIVE_SIZE) {
                clearTimeout(timeoutId);
                writeStream.close();
                resolve({
                  success: false,
                  bytesRead,
                  error: `Download exceeded size limit: ${bytesRead} bytes`,
                });
                return;
              }

              writeStream.write(value);
            }
          } catch (e) {
            clearTimeout(timeoutId);
            if (!aborted) {
              writeStream.close();
              resolve({ success: false, bytesRead, error: e instanceof Error ? e.message : 'Download failed' });
            }
          }
        }

        pump();
      })
      .catch((e) => {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
          resolve({
            success: false,
            bytesRead,
            error: aborted
              ? `Download exceeded size limit ${LIMITS.MAX_ARCHIVE_SIZE} bytes`
              : `Download timed out after ${timeout}ms`,
          });
        } else {
          resolve({ success: false, bytesRead, error: e instanceof Error ? e.message : 'Download failed' });
        }
      });
  });
}

// ============================================================
// Archive Extraction (Simplified - uses adm-zip for now)
// ============================================================

/**
 * Extract a tar.gz or zip archive with security checks.
 * For production use, consider using a streaming parser for better security.
 */
async function extractArchive(
  archivePath: string,
  destination: string
): Promise<{ success: boolean; files: string[]; symlinks: string[]; totalBytes: number; diagnostics: SubmissionDiagnostic[] }> {
  const diagnostics: SubmissionDiagnostic[] = [];
  const extractedFiles: string[] = [];
  const extractedSymlinks: string[] = [];
  let totalBytes = 0;

  try {
    // Dynamically import adm-zip
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries();

    let fileCount = 0;
    let extractedSize = 0;

    for (const entry of entries) {
      if (fileCount >= LIMITS.MAX_FILE_COUNT) {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_TOO_MANY_FILES,
            `Too many files in archive: ${fileCount} files`
          )
        );
        break;
      }

      const entryPath = entry.entryName;

      // Validate path security
      const safePath = validateExtractionPath(entryPath, destination);
      if (!safePath) {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_PATH_TRAVERSAL,
            `Blocked unsafe archive path: ${entryPath}`
          )
        );
        continue;
      }

      // Handle symlinks
      // adm-zip types don't fully expose symlink properties, use type assertion
      const entryAny = entry as unknown as { isSymbolicLink?: boolean; linkFileName?: string };
      if (entryAny.isSymbolicLink) {
        const target = entryAny.linkFileName;
        if (target && !isSymlinkTargetSafe(target, destination)) {
          diagnostics.push(
            submissionError(
              SUBMISSION_CODES.SOURCE_SYMLINK_ESCAPE,
              `Blocked symlink escaping extraction directory: ${entryPath} -> ${target}`
            )
          );
          continue;
        }
        extractedSymlinks.push(entryPath);
        continue;
      }

      // Skip directories
      if (entry.isDirectory) {
        try {
          mkdirSync(safePath, { recursive: true });
        } catch {}
        continue;
      }

      const entrySize = entry.header.size;

      // Check individual file size
      if (entrySize > LIMITS.MAX_FILE_SIZE) {
        diagnostics.push(
          submissionWarning(
            SUBMISSION_CODES.SOURCE_TOO_LARGE,
            `File exceeds size limit: ${entryPath} (${entrySize} bytes)`
          )
        );
        continue;
      }

      // Check total extracted size
      if (extractedSize + entrySize > LIMITS.MAX_EXTRACTED_SIZE) {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_TOO_LARGE,
            `Extracted content exceeds size limit: ${extractedSize + entrySize} bytes`
          )
        );
        break;
      }

      // Extract the file
      try {
        zip.extractEntryTo(entry, join(safePath, '..'), true, true);
        fileCount++;
        extractedSize += entrySize;
        totalBytes += entrySize;
        extractedFiles.push(relative(destination, safePath));
      } catch (e) {
        diagnostics.push(
          submissionWarning(
            SUBMISSION_CODES.SOURCE_PATH_TRAVERSAL,
            `Failed to extract file: ${entryPath}`
          )
        );
      }
    }

    return {
      success: true,
      files: extractedFiles,
      symlinks: extractedSymlinks,
      totalBytes,
      diagnostics,
    };
  } catch (e) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.SOURCE_UNSUPPORTED_ARCHIVE,
        `Failed to extract archive: ${e instanceof Error ? e.message : 'Unknown error'}`
      )
    );
    return { success: false, files: extractedFiles, symlinks: extractedSymlinks, totalBytes, diagnostics };
  }
}

// ============================================================
// Acquisition Implementation
// ============================================================

/**
 * Acquire source code from GitHub for a specific commit.
 *
 * @param client GitHub client
 * @param owner Repository owner
 * @param repo Repository name
 * @param sha Exact commit SHA
 * @param tempDir Temporary directory for extraction
 * @returns Acquisition result with file list
 */
export async function acquireSource(
  client: GitHubClient,
  owner: string,
  repo: string,
  sha: string,
  tempDir: string
): Promise<SourceAcquisitionResult> {
  const diagnostics: SubmissionDiagnostic[] = [];

  // Validate inputs
  if (!client || !owner || !repo || !sha) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.GITHUB_API_FAILURE,
        'Missing required parameters for source acquisition'
      )
    );
    return { success: false, diagnostics };
  }

  // Create temp directory for this acquisition
  const timestamp = Date.now();
  const extractDir = join(tempDir, `axolotl-${sha.slice(0, 8)}-${timestamp}`);
  let archivePath: string | null = null;

  try {
    mkdirSync(extractDir, { recursive: true });

    // Get archive URL for exact SHA
    const archiveResult = await client.getArchiveUrl(owner, repo, sha, 'zipball');

    if (!archiveResult.success) {
      diagnostics.push(archiveResult.error);
      return { success: false, diagnostics };
    }

    const archiveUrl = archiveResult.data;

    // Download with bounded size
    archivePath = join(extractDir, 'archive.zip');
    const downloadResult = await boundedDownload(archiveUrl, archivePath);

    if (!downloadResult.success) {
      if (downloadResult.error?.includes('size limit')) {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_TOO_LARGE,
            `Downloaded archive exceeds size limit: ${downloadResult.error}`
          )
        );
      } else {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.GITHUB_API_FAILURE,
            `Failed to download archive: ${downloadResult.error}`
          )
        );
      }
      return { success: false, diagnostics };
    }

    // Extract the archive
    // GitHub creates a root directory named "owner-repo-sha"
    const sourceDir = join(extractDir, 'source');

    // First, extract to temp location
    const extractResult = await extractArchive(archivePath, extractDir);

    if (!extractResult.success || extractResult.diagnostics.some(d => d.code === SUBMISSION_CODES.SOURCE_PATH_TRAVERSAL)) {
      diagnostics.push(...extractResult.diagnostics);
      return { success: false, diagnostics };
    }

    diagnostics.push(...extractResult.diagnostics);

    // Find the actual source root (GitHub creates a root directory)
    let actualSourceDir = sourceDir;
    try {
      const entries = readdirSync(extractDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'source' && entry.name !== 'archive.zip') {
          // This is the GitHub-created root directory
          actualSourceDir = join(extractDir, entry.name);
          break;
        }
      }
    } catch {}

    // Analyze the extracted source
    const analysis = analyzeExtractedSource(actualSourceDir);

    if (!analysis.success) {
      diagnostics.push(...analysis.diagnostics);
      return { success: false, diagnostics };
    }

    diagnostics.push(...analysis.diagnostics);

    // Report symlinks as warnings (we don't follow them)
    if (analysis.diagnostics.some(d => d.code === 'WARN_SYMLINKS_IGNORED')) {
      // Already added in analyzeExtractedSource
    }

    return {
      success: true,
      sourcePath: actualSourceDir,
      fileCount: analysis.fileList?.length || 0,
      phpFileCount: analysis.phpFileCount || 0,
      totalSizeBytes: analysis.totalSize || 0,
      hasPluginYml: analysis.hasPluginYml || false,
      hasComposerJson: analysis.hasComposerJson || false,
      symlinkCount: analysis.symlinkCount || 0,
      diagnostics,
    };
  } catch (e) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.GITHUB_API_FAILURE,
        `Source acquisition failed: ${e instanceof Error ? e.message : 'Unknown error'}`
      )
    );
    return { success: false, diagnostics };
  } finally {
    // Clean up archive if it exists
    if (archivePath && existsSync(archivePath)) {
      try {
        rmSync(archivePath);
      } catch {}
    }
  }
}

/**
 * Analyze extracted source for limits and structure.
 */
export function analyzeExtractedSource(sourcePath: string): {
  success: boolean;
  fileList?: string[];
  phpFileCount?: number;
  totalSize?: number;
  hasPluginYml?: boolean;
  hasComposerJson?: boolean;
  symlinkCount?: number;
  diagnostics: SubmissionDiagnostic[];
} {
  const diagnostics: SubmissionDiagnostic[] = [];
  const fileList: string[] = [];
  const symlinks: string[] = [];
  const largeFiles: string[] = [];
  const deepPaths: string[] = [];
  let totalSize = 0;
  let phpFileCount = 0;
  let hasPluginYml = false;
  let hasComposerJson = false;

  function walkDir(dir: string, depth: number = 0): void {
    if (depth > LIMITS.MAX_TREE_DEPTH) {
      deepPaths.push(relative(sourcePath, dir));
      return;
    }

    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relative(sourcePath, fullPath);

        // Check for symlinks - don't follow them
        if (entry.isSymbolicLink()) {
          symlinks.push(relPath);
          continue;
        }

        if (entry.isDirectory()) {
          walkDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          fileList.push(relPath);

          try {
            const stats = statSync(fullPath);
            totalSize += stats.size;

            if (stats.size > LIMITS.MAX_FILE_SIZE) {
              largeFiles.push(`${relPath} (${formatSize(stats.size)})`);
            }

            // Check file type
            if (entry.name.endsWith('.php')) {
              phpFileCount++;
            } else if (entry.name === 'plugin.yml') {
              hasPluginYml = true;
            } else if (entry.name === 'composer.json') {
              hasComposerJson = true;
            }
          } catch {}
        }
      }
    } catch (e) {
      diagnostics.push(
        submissionWarning(
          SUBMISSION_CODES.SOURCE_PATH_TRAVERSAL,
          `Cannot read directory: ${relative(sourcePath, dir)}`
        )
      );
    }
  }

  try {
    walkDir(sourcePath);
  } catch (e) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.SOURCE_PATH_TRAVERSAL,
        `Failed to analyze source: ${e instanceof Error ? e.message : 'Unknown error'}`
      )
    );
    return { success: false, diagnostics };
  }

  // Check limits
  if (fileList.length > LIMITS.MAX_FILE_COUNT) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.SOURCE_TOO_MANY_FILES,
        `Source contains ${fileList.length} files, limit is ${LIMITS.MAX_FILE_COUNT}`
      )
    );
    return { success: false, diagnostics };
  }

  if (totalSize > LIMITS.MAX_EXTRACTED_SIZE) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.SOURCE_TOO_LARGE,
        `Source size ${formatSize(totalSize)} exceeds limit ${formatSize(LIMITS.MAX_EXTRACTED_SIZE)}`
      )
    );
    return { success: false, diagnostics };
  }

  // Warn about large files
  if (largeFiles.length > 0) {
    diagnostics.push(
      submissionWarning(
        SUBMISSION_CODES.SOURCE_TOO_LARGE,
        `Large files detected: ${largeFiles.slice(0, 5).join(', ')}`
      )
    );
  }

  // Warn about deep paths
  if (deepPaths.length > 0) {
    diagnostics.push(
      submissionWarning(
        SUBMISSION_CODES.SOURCE_TOO_MANY_FILES,
        `Paths exceed maximum depth: ${deepPaths.slice(0, 5).join(', ')}`
      )
    );
  }

  // Warn about symlinks
  if (symlinks.length > 0) {
    diagnostics.push(
      submissionWarning(
        SUBMISSION_CODES.WARN_SYMLINKS_IGNORED,
        `Symlinks ignored during analysis: ${symlinks.length} symlink(s)`
      )
    );
  }

  return {
    success: true,
    fileList,
    phpFileCount,
    totalSize,
    hasPluginYml,
    hasComposerJson,
    symlinkCount: symlinks.length,
    diagnostics,
  };
}

/**
 * Safe read of a single file.
 */
export function safeReadFile(filePath: string, maxSize: number = 1024 * 1024): {
  success: boolean;
  content?: string;
  error?: string;
} {
  try {
    const stats = statSync(filePath);
    if (stats.size > maxSize) {
      return { success: false, error: 'File too large' };
    }
    const content = readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Clean up extraction directory.
 */
export function cleanupExtraction(tempDir: string): void {
  try {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  } catch {}
}

// ============================================================
// Utility Functions
// ============================================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
