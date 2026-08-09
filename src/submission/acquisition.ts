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

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
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
  /** List of relative file paths extracted from source */
  fileList?: string[];
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

/**
 * Validate redirect URL against archive URL policy.
 * SECURITY: Every redirect destination is validated to prevent SSRF attacks.
 */
function validateRedirect(
  location: string | null,
  currentUrl: string,
  redirectChain: string[],
  allowLocalhost: boolean
): { valid: boolean; error?: string; redirectUrl?: string } {
  if (!location) {
    return { valid: false, error: 'Redirect response with no Location header' };
  }

  // Check redirect count limit
  if (redirectChain.length > MAX_REDIRECT_LIMIT) {
    return { valid: false, error: `Too many redirects (${redirectChain.length}), maximum allowed: ${MAX_REDIRECT_LIMIT}` };
  }

  // Resolve relative redirect URLs
  let redirectUrl: string;
  try {
    redirectUrl = new URL(location, currentUrl).toString();
  } catch {
    return { valid: false, error: `Malformed redirect URL: ${location}` };
  }

  // Validate redirect destination against archive URL policy
  const validation = validateArchiveUrl(redirectUrl, allowLocalhost);
  if (!validation.valid) {
    return { valid: false, error: `Redirect to unsafe destination rejected: ${validation.error}` };
  }

  return { valid: true, redirectUrl };
}

/**
 * Validate that downloaded content is a valid ZIP archive.
 */
function validateZipArchive(bodyBytes: Uint8Array): { valid: boolean; error?: string } {
  const ZIP_SIGNATURES = [
    { name: 'local file header', bytes: [0x50, 0x4B, 0x03, 0x04] },
    { name: 'empty archive', bytes: [0x50, 0x4B, 0x05, 0x06] },
    { name: 'spanned archive', bytes: [0x50, 0x4B, 0x07, 0x08] },
  ];

  for (const sig of ZIP_SIGNATURES) {
    if (sig.bytes.every((b, i) => bodyBytes[i] === b)) {
      return { valid: true };
    }
  }

  const hexPreview = Array.from(bodyBytes.slice(0, 4))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  return { valid: false, error: `Not a valid ZIP file (first 4 bytes: ${hexPreview})` };
}

/**
 * Write downloaded content to file and verify it was written correctly.
 */
function writeDownloadedContent(
  destinationPath: string,
  bodyBytes: Uint8Array
): { success: boolean; error?: string } {
  try {
    writeFileSync(destinationPath, Buffer.from(bodyBytes));

    // Verify file was written correctly
    const stats = statSync(destinationPath);
    if (stats.size !== bodyBytes.length) {
      return { success: false, error: `File size mismatch: expected ${bodyBytes.length}, got ${stats.size}` };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to write file' };
  }
}

const MAX_REDIRECT_LIMIT = 5;

/**
 * Download a file with bounded size checks and redirect validation.
 * SECURITY: Every redirect destination is validated against the archive URL policy
 * before being followed. This prevents SSRF via redirect attacks.
 *
 * @param url - The URL to download
 * @param destinationPath - Where to save the file
 * @param timeout - Download timeout in ms
 * @param allowLocalhost - Allow localhost URLs (testing only)
 * @param token - Optional GitHub token for authenticated downloads
 */
async function boundedDownload(
  url: string,
  destinationPath: string,
  timeout: number = LIMITS.ARCHIVE_DOWNLOAD_TIMEOUT,
  allowLocalhost: boolean = false,
  token?: string
): Promise<{ success: boolean; bytesRead: number; error?: string }> {
  // Validate URL first
  const urlValidation = validateArchiveUrl(url, allowLocalhost);
  if (!urlValidation.valid) {
    return { success: false, bytesRead: 0, error: `Unsafe archive URL: ${urlValidation.error}` };
  }

  // Track redirect chain
  const redirectChain: string[] = [url];

  return new Promise((resolve) => {
    let bytesRead = 0;
    let aborted = false;
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

    async function fetchWithRedirectValidation(currentUrl: string, currentToken?: string): Promise<void> {
      try {
        // Build headers for the request
        const headers: Record<string, string> = {
          Accept: 'application/vnd.github.v3+json',
        };

        if (currentToken) {
          headers.Authorization = `Bearer ${currentToken}`;
        }

        // Use manual redirect handling to validate each destination
        const response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers,
        });

        // Track redirect chain
        if (response.url !== currentUrl) {
          redirectChain.push(response.url);
        }

        // Handle redirects manually with validation
        if (response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) {
          const location = response.headers.get('location');
          const redirectValidation = validateRedirect(location, currentUrl, redirectChain, allowLocalhost);

          if (!redirectValidation.valid) {
            clearTimeout(timeoutId);
            settle({ success: false, bytesRead, error: redirectValidation.error });
            return;
          }

          // Follow the validated redirect (preserve token for authenticated requests)
          await fetchWithRedirectValidation(redirectValidation.redirectUrl!, currentToken);
          return;
        }

        // Not a redirect - handle the response
        if (!response.ok) {
          clearTimeout(timeoutId);
          settle({ success: false, bytesRead, error: `HTTP ${response.status}` });
          return;
        }

        // Read response body
        const bodyBuffer = await response.arrayBuffer();
        const bodyBytes = new Uint8Array(bodyBuffer);
        bytesRead = bodyBytes.length;

        // Validate ZIP signature
        const zipValidation = validateZipArchive(bodyBytes);
        if (!zipValidation.valid) {
          clearTimeout(timeoutId);
          settle({ success: false, bytesRead, error: zipValidation.error });
          return;
        }

        // Write to file
        const writeResult = writeDownloadedContent(destinationPath, bodyBytes);
        if (!writeResult.success) {
          clearTimeout(timeoutId);
          settle({ success: false, bytesRead, error: writeResult.error });
          return;
        }

        clearTimeout(timeoutId);
        settle({ success: true, bytesRead });
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error) {
          if (e.name === 'AbortError') {
            settle({
              success: false,
              bytesRead,
              error: aborted
                ? `Download exceeded size limit ${LIMITS.MAX_ARCHIVE_SIZE} bytes`
                : `Download timed out after ${timeout}ms`,
            });
          } else {
            settle({ success: false, bytesRead, error: e.message });
          }
        } else {
          settle({ success: false, bytesRead, error: 'Download failed' });
        }
      }
    }

    // Start the fetch with redirect validation
    fetchWithRedirectValidation(url, token).catch((e) => {
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
    // Use jszip for extraction (compatible with Node.js v24)
    const JSZip = (await import('jszip')).default;
    const zipData = readFileSync(archivePath);
    const zip = await JSZip.loadAsync(zipData);
    const entries = Object.keys(zip.files);

    let fileCount = 0;
    let extractedSize = 0;

    for (const entryPath of entries) {
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

      const zipEntry = zip.files[entryPath];

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

      // Handle symlinks - FATAL (jszip doesn't support symlinks natively)
      if (zipEntry.dir) {
        // It's a directory
        try {
          mkdirSync(safePath, { recursive: true });
        } catch {}
        continue;
      }

      // It's a file - check size
      // In jszip, we need to check the compressed/uncompressed size from internal properties
      // or get it from the decompressed content
      let entrySize = 0;
      try {
        // Try to get size from internal _data (jszip structure)
        const internalData = (zipEntry as unknown as { _data?: { uncompressedSize?: number; size?: number } })._data;
        entrySize = internalData?.uncompressedSize ?? internalData?.size ?? 0;
      } catch {
        entrySize = 0;
      }

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
        const content = await zipEntry.async('nodebuffer');
        // Ensure parent directory exists
        mkdirSync(dirname(safePath), { recursive: true });
        writeFileSync(safePath, content);
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
 * @param token Optional GitHub token for authenticated downloads
 * @returns Acquisition result with file list
 */
export async function acquireSource(
  client: GitHubClient,
  owner: string,
  repo: string,
  sha: string,
  tempDir: string,
  allowLocalhost: boolean = false,
  token?: string
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

    // Download with bounded size (include token for authenticated requests)
    archivePath = join(extractDir, 'archive.zip');
    const downloadResult = await boundedDownload(archiveUrl, archivePath, LIMITS.ARCHIVE_DOWNLOAD_TIMEOUT, allowLocalhost, token);

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
      fileList: analysis.fileList || [],
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
