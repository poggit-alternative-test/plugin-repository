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
 * - Fail closed on security violations
 */

import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';
import {
  SUBMISSION_CODES,
  submissionError,
  submissionWarning,
  type SubmissionDiagnostic,
  DiagnosticSeverity,
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
// Archive URL Validation
// ============================================================

/**
 * Validate that an archive URL is safe to fetch.
 *
 * Production archive download must not become a generic SSRF primitive.
 *
 * Allowed:
 * - HTTPS URLs from api.github.com
 * - HTTPS URLs from github.com (for archives)
 * - URLs from allowed hosts (configurable)
 *
 * Rejected:
 * - HTTP (non-HTTPS) URLs
 * - localhost, 127.0.0.1
 * - Private IP ranges
 * - URLs with credentials
 * - file:// URLs
 * - Unknown hosts
 */
export interface ArchiveUrlValidation {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

const ALLOWED_ARCHIVE_HOSTS = new Set([
  'api.github.com',
  'codeload.github.com',
  'github.com',
]);

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
]);

const BLOCKED_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,           // IPv4 loopback
  /^10\.\d+\.\d+\.\d+$/,             // RFC 1918 private
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // RFC 1918 private
  /^192\.168\.\d+\.\d+$/,           // RFC 1918 private
  /^169\.254\.\d+\.\d+$/,           // Link-local
  /^0\.0\.0\.0$/,                    // All zeros
  /^::1$/,                          // IPv6 loopback
  /^fe80:/i,                        // IPv6 link-local
  /^fc00:/i,                        // IPv6 unique local
  /^fd00:/i,                        // IPv6 unique local
];

export function validateArchiveUrl(url: string, allowLocalhost: boolean = false): ArchiveUrlValidation {
  // Must be a valid URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Must be HTTPS in production
  if (parsedUrl.protocol !== 'https:') {
    // Allow HTTP only for localhost in test mode
    if (allowLocalhost && parsedUrl.protocol === 'http:' && isLocalhost(parsedUrl.hostname)) {
      return { valid: true, normalizedUrl: url };
    }
    return { valid: false, error: `Non-HTTPS URL not allowed: ${parsedUrl.protocol}` };
  }

  // Check for credentials in URL
  if (parsedUrl.username || parsedUrl.password) {
    return { valid: false, error: 'URLs with credentials are not allowed' };
  }

  // Check hostname
  const hostname = parsedUrl.hostname.toLowerCase();

  // Block specific hostnames
  if (BLOCKED_HOSTS.has(hostname)) {
    return { valid: false, error: `Blocked hostname: ${hostname}` };
  }

  // Block IP patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: `Blocked IP range: ${hostname}` };
    }
  }

  // Allow known GitHub hosts
  if (ALLOWED_ARCHIVE_HOSTS.has(hostname)) {
    return { valid: true, normalizedUrl: url };
  }

  // Reject unknown hosts
  return { valid: false, error: `Unknown archive host: ${hostname}` };
}

function isLocalhost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === 'localhost' || lower === '127.0.0.1' || lower === '::1';
}

// ============================================================
// Bounded Download with Redirect Validation
// ============================================================

const MAX_REDIRECT_COUNT = 5;

/**
 * Download a file with bounded size checks and redirect validation.
 *
 * SECURITY: Every redirect destination is validated against the archive URL policy
 * before being followed. This prevents SSRF via redirect attacks.
 */
async function boundedDownload(
  url: string,
  destinationPath: string,
  timeout: number = LIMITS.ARCHIVE_DOWNLOAD_TIMEOUT,
  allowLocalhost: boolean = false
): Promise<{ success: boolean; bytesRead: number; error?: string }> {
  // Validate URL first
  const urlValidation = validateArchiveUrl(url, allowLocalhost);
  if (!urlValidation.valid) {
    return { success: false, bytesRead: 0, error: `Unsafe archive URL: ${urlValidation.error}` };
  }

  return new Promise((resolve) => {
    let bytesRead = 0;
    let aborted = false;
    let redirectCount = 0;
    let settled = false;

    const settle = (result: { success: boolean; bytesRead: number; error?: string }) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      aborted = true;
      controller.abort();
    }, timeout);

    async function fetchWithRedirectValidation(currentUrl: string): Promise<void> {
      try {
        // Use manual redirect handling to validate each destination
        const response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
        });

        // Handle redirects manually with validation
        if (response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) {
          // Check redirect count limit
          redirectCount++;
          if (redirectCount > MAX_REDIRECT_COUNT) {
            clearTimeout(timeoutId);
            settle({
              success: false,
              bytesRead,
              error: `Too many redirects (${redirectCount}), maximum allowed: ${MAX_REDIRECT_COUNT}`,
            });
            return;
          }

          // Get redirect location from Location header
          const location = response.headers.get('location');
          if (!location) {
            clearTimeout(timeoutId);
            settle({
              success: false,
              bytesRead,
              error: `Redirect response with no Location header`,
            });
            return;
          }

          // Resolve relative redirect URLs
          let redirectUrl: string;
          try {
            redirectUrl = new URL(location, currentUrl).toString();
          } catch {
            clearTimeout(timeoutId);
            settle({
              success: false,
              bytesRead,
              error: `Malformed redirect URL: ${location}`,
            });
            return;
          }

          // Validate redirect destination against archive URL policy
          const redirectValidation = validateArchiveUrl(redirectUrl, allowLocalhost);
          if (!redirectValidation.valid) {
            clearTimeout(timeoutId);
            settle({
              success: false,
              bytesRead,
              error: `Redirect to unsafe destination rejected: ${redirectValidation.error}`,
            });
            return;
          }

          // Follow the validated redirect
          await fetchWithRedirectValidation(redirectUrl);
          return;
        }

        // Not a redirect - handle the response
        if (!response.ok) {
          clearTimeout(timeoutId);
          settle({ success: false, bytesRead, error: `HTTP ${response.status}` });
          return;
        }

        const contentLength = response.headers.get('content-length');
        const archiveSize = contentLength ? parseInt(contentLength, 10) : 0;

        // Early check if content-length exceeds limit
        if (archiveSize > LIMITS.MAX_ARCHIVE_SIZE) {
          clearTimeout(timeoutId);
          settle({
            success: false,
            bytesRead,
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
                settle({ success: true, bytesRead });
                return;
              }

              bytesRead += value.length;

              // Check during streaming
              if (bytesRead > LIMITS.MAX_ARCHIVE_SIZE) {
                clearTimeout(timeoutId);
                writeStream.close();
                // Clean up partial file on size limit
                try {
                  rmSync(destinationPath, { force: true });
                } catch {}
                settle({
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
              // Clean up partial file on error
              try {
                rmSync(destinationPath, { force: true });
              } catch {}
              settle({ success: false, bytesRead, error: e instanceof Error ? e.message : 'Download failed' });
            }
          }
        }

        pump();
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error) {
          if (e.name === 'AbortError') {
            // Clean up partial file on abort
            try {
              rmSync(destinationPath, { force: true });
            } catch {}
            settle({
              success: false,
              bytesRead,
              error: aborted
                ? `Download exceeded size limit ${LIMITS.MAX_ARCHIVE_SIZE} bytes`
                : `Download timed out after ${timeout}ms`,
            });
          } else {
            // Clean up partial file on error
            try {
              rmSync(destinationPath, { force: true });
            } catch {}
            settle({ success: false, bytesRead, error: e.message });
          }
        } else {
          settle({ success: false, bytesRead, error: 'Download failed' });
        }
      }
    }

    // Start the fetch with redirect validation
    fetchWithRedirectValidation(url).catch((e) => {
      settle({ success: false, bytesRead, error: e instanceof Error ? e.message : 'Download failed' });
    });
  });
}

// ============================================================
// Archive Extraction (Fail-Closed)
// ============================================================

/**
 * Fatal extraction errors that must cause immediate failure.
 */
enum FatalExtractionError {
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  ABSOLUTE_PATH = 'ABSOLUTE_PATH',
  SYMLINK_ESCAPE = 'SYMLINK_ESCAPE',
  SIZE_LIMIT = 'SIZE_LIMIT',
  FILE_COUNT_LIMIT = 'FILE_COUNT_LIMIT',
  UNSUPPORTED_ARCHIVE = 'UNSUPPORTED_ARCHIVE',
}

interface ExtractionResult {
  success: boolean;
  files: string[];
  symlinks: string[];
  totalBytes: number;
  diagnostics: SubmissionDiagnostic[];
  fatalError?: FatalExtractionError;
}

/**
 * Extract a zip archive with security checks.
 * FAILS CLOSED on any security violation.
 */
async function extractArchive(
  archivePath: string,
  destination: string
): Promise<ExtractionResult> {
  const diagnostics: SubmissionDiagnostic[] = [];
  const extractedFiles: string[] = [];
  const extractedSymlinks: string[] = [];
  let totalBytes = 0;
  let fatalError: FatalExtractionError | undefined;

  // Clean up any previous partial extraction
  const cleanUp = (): void => {
    try {
      if (existsSync(destination)) {
        rmSync(destination, { recursive: true, force: true });
      }
    } catch {}
  };

  // Clean destination before extraction
  cleanUp();
  mkdirSync(destination, { recursive: true });

  try {
    // Dynamically import adm-zip
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries();

    let fileCount = 0;
    let extractedSize = 0;

    for (const entry of entries) {
      // Check for fatal error - stop immediately
      if (fatalError) {
        break;
      }

      // Check file count limit
      if (fileCount >= LIMITS.MAX_FILE_COUNT) {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_TOO_MANY_FILES,
            `Too many files in archive: ${fileCount} files (limit: ${LIMITS.MAX_FILE_COUNT})`
          )
        );
        fatalError = FatalExtractionError.FILE_COUNT_LIMIT;
        break;
      }

      const entryPath = entry.entryName;

      // Validate path security - FATAL
      const safePath = validateExtractionPath(entryPath, destination);
      if (!safePath) {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_PATH_TRAVERSAL,
            `Blocked unsafe archive path: ${entryPath}`
          )
        );
        fatalError = FatalExtractionError.PATH_TRAVERSAL;
        break;
      }

      // Handle symlinks - FATAL
      const entryAny = entry as unknown as { isSymbolicLink?: boolean; linkFileName?: string };
      if (entryAny.isSymbolicLink) {
        const target = entryAny.linkFileName;
        if (!target) {
          // Symlink with no target - skip but don't fail
          continue;
        }
        if (!isSymlinkTargetSafe(target, destination)) {
          diagnostics.push(
            submissionError(
              SUBMISSION_CODES.SOURCE_SYMLINK_ESCAPE,
              `Blocked symlink escaping extraction directory: ${entryPath} -> ${target}`
            )
          );
          fatalError = FatalExtractionError.SYMLINK_ESCAPE;
          break;
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

      // Skip unsupported entry types (devices, etc.)
      // AdmZip uses type flags that we check via isDirectory/isSymbolicLink
      // Any other type should be skipped safely

      const entrySize = entry.header.size;

      // Check individual file size - FATAL
      if (entrySize > LIMITS.MAX_FILE_SIZE) {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_TOO_LARGE,
            `File exceeds size limit: ${entryPath} (${entrySize} bytes, limit: ${LIMITS.MAX_FILE_SIZE})`
          )
        );
        fatalError = FatalExtractionError.SIZE_LIMIT;
        break;
      }

      // Check total extracted size - FATAL
      if (extractedSize + entrySize > LIMITS.MAX_EXTRACTED_SIZE) {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_TOO_LARGE,
            `Extracted content exceeds size limit: ${extractedSize + entrySize} bytes (limit: ${LIMITS.MAX_EXTRACTED_SIZE})`
          )
        );
        fatalError = FatalExtractionError.SIZE_LIMIT;
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
        // Extraction failed - treat as fatal
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_PATH_TRAVERSAL,
            `Failed to extract file: ${entryPath} - ${e instanceof Error ? e.message : 'Unknown error'}`
          )
        );
        fatalError = FatalExtractionError.PATH_TRAVERSAL;
        break;
      }
    }

    // If we encountered a fatal error, clean up and fail
    if (fatalError) {
      cleanUp();
      return {
        success: false,
        files: [],
        symlinks: [],
        totalBytes: 0,
        diagnostics,
        fatalError,
      };
    }

    return {
      success: true,
      files: extractedFiles,
      symlinks: extractedSymlinks,
      totalBytes,
      diagnostics,
    };
  } catch (e) {
    cleanUp();
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.SOURCE_UNSUPPORTED_ARCHIVE,
        `Failed to extract archive: ${e instanceof Error ? e.message : 'Unknown error'}`
      )
    );
    return {
      success: false,
      files: [],
      symlinks: [],
      totalBytes: 0,
      diagnostics,
      fatalError: FatalExtractionError.UNSUPPORTED_ARCHIVE,
    };
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
 * @param allowLocalhost For testing only - allows localhost URLs
 * @returns Acquisition result with file list
 */
export async function acquireSource(
  client: GitHubClient,
  owner: string,
  repo: string,
  sha: string,
  tempDir: string,
  allowLocalhost: boolean = false
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

    // Validate archive URL
    const urlValidation = validateArchiveUrl(archiveUrl, allowLocalhost);
    if (!urlValidation.valid) {
      diagnostics.push(
        submissionError(
          SUBMISSION_CODES.SOURCE_PATH_TRAVERSAL,
          `Unsafe archive URL rejected: ${urlValidation.error}`
        )
      );
      return { success: false, diagnostics };
    }

    // Download with bounded size
    archivePath = join(extractDir, 'archive.zip');
    const downloadResult = await boundedDownload(archiveUrl, archivePath, LIMITS.ARCHIVE_DOWNLOAD_TIMEOUT, allowLocalhost);

    if (!downloadResult.success) {
      if (downloadResult.error?.includes('size limit')) {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_TOO_LARGE,
            `Downloaded archive exceeds size limit: ${downloadResult.error}`
          )
        );
      } else if (downloadResult.error?.includes('Unsafe')) {
        diagnostics.push(
          submissionError(
            SUBMISSION_CODES.SOURCE_PATH_TRAVERSAL,
            downloadResult.error
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
    const sourceDir = join(extractDir, 'source');
    mkdirSync(sourceDir, { recursive: true });

    const extractResult = await extractArchive(archivePath, sourceDir);

    // Propagate all diagnostics
    diagnostics.push(...extractResult.diagnostics);

    // If extraction failed, fail the acquisition
    if (!extractResult.success) {
      return { success: false, diagnostics };
    }

    // Find the actual source root (GitHub creates a root directory)
    let actualSourceDir = sourceDir;
    try {
      const entries = readdirSync(sourceDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory());
      if (dirs.length === 1) {
        // GitHub zipball creates a single root directory
        actualSourceDir = join(sourceDir, dirs[0].name);
      }
    } catch {}

    // Analyze the extracted source
    const analysis = analyzeExtractedSource(actualSourceDir);

    if (!analysis.success) {
      diagnostics.push(...analysis.diagnostics);
      return { success: false, diagnostics };
    }

    diagnostics.push(...analysis.diagnostics);

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
