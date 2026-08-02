/**
 * Publication Service
 *
 * Accepts a successful build result and prepares the artifact for publication.
 *
 * - Copies PHAR to a local publication directory
 * - Computes SHA-256
 * - Collects metadata
 * - Returns structured diagnostics
 *
 * This module has NO knowledge of GitHub, registries, cloud storage, or upload targets.
 */

import { createHash } from 'crypto';
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  statSync,
} from 'fs';
import { basename, join } from 'path';

import {
  PUBLICATION_CODES,
  publicationError,
  publicationInfrastructureError,
  type PublicationDiagnostic,
} from './diagnostics.js';

// ============================================================
// Resource Limits
// ============================================================

export const PUBLICATION_LIMITS = {
  /** Minimum artifact size in bytes (PHAR must be non-empty) */
  MIN_ARTIFACT_SIZE: 1024,
} as const;

// ============================================================
// Request
// ============================================================

export interface PublicationRequest {
  /**
   * Absolute path to the PHAR artifact produced by Build.
   * Must be an existing file.
   */
  artifactPath: string;

  /**
   * Absolute path to the publication directory.
   * Created recursively if it does not exist.
   */
  destinationPath: string;

  /** Plugin name from plugin.yml (brand/identity) */
  pluginName: string;

  /** Plugin version from plugin.yml */
  pluginVersion: string;

  /** Optional context passed through to result for downstream consumers */
  context?: Record<string, unknown>;
}

// ============================================================
// Result
// ============================================================

export interface PublicationResult {
  /** Whether publication preparation succeeded */
  success: boolean;

  /** Absolute path to the published artifact */
  publishedPath?: string;

  /** SHA-256 hex digest of the published artifact */
  sha256?: string;

  /** Size of the published artifact in bytes */
  sizeBytes?: number;

  /** Basename of the published artifact */
  filename?: string;

  /** All diagnostics emitted during preparation */
  diagnostics: PublicationDiagnostic[];
}

// ============================================================
// SHA-256 (simple — safe for PHAR sizes)
// ============================================================

/**
 * Compute SHA-256 of a file synchronously.
 *
 * Uses readFileSync for all file sizes. For PHAR files (max 50 MB),
 * this is acceptable and avoids async complexity.
 *
 * @returns Hex SHA-256 digest, or null on failure
 */
export function computeSha256(absolutePath: string): string | null {
  try {
    const content = readFileSync(absolutePath);
    const hash = createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  } catch {
    return null;
  }
}

// ============================================================
// Publish
// ============================================================

/**
 * Publish an artifact to a local directory.
 *
 * Steps:
 * 1. Validate artifact exists and is a readable file
 * 2. Ensure destination directory exists
 * 3. Copy artifact to destination
 * 4. Verify copy with SHA-256
 *
 * @param request - Publication request
 * @returns Structured result
 */
export async function publish(request: PublicationRequest): Promise<PublicationResult> {
  const { artifactPath, destinationPath, pluginName, pluginVersion } = request;
  const diagnostics: PublicationDiagnostic[] = [];

  // ─── Artifact Validation ──────────────────────────────────

  if (!existsSync(artifactPath)) {
    diagnostics.push(
      publicationError(
        PUBLICATION_CODES.PUBLICATION_ARTIFACT_NOT_FOUND,
        `Artifact not found at "${artifactPath}"`,
        { artifactPath }
      )
    );
    return { success: false, diagnostics };
  }

  let artifactStats: ReturnType<typeof statSync>;
  try {
    artifactStats = statSync(artifactPath);
  } catch (e) {
    diagnostics.push(
      publicationInfrastructureError(
        PUBLICATION_CODES.PUBLISH_ARTIFACT_UNREADABLE,
        `Cannot stat artifact: ${e instanceof Error ? e.message : 'Unknown error'}`,
        { artifactPath }
      )
    );
    return { success: false, diagnostics };
  }

  if (!artifactStats.isFile()) {
    diagnostics.push(
      publicationError(
        PUBLICATION_CODES.PUBLISH_ARTIFACT_NOT_FILE,
        `Artifact is not a file: ${artifactPath}`,
        { artifactPath }
      )
    );
    return { success: false, diagnostics };
  }

  if (artifactStats.size === 0) {
    diagnostics.push(
      publicationError(
        PUBLICATION_CODES.PUBLISH_ARTIFACT_EMPTY,
        `Artifact is empty: ${artifactPath}`,
        { artifactPath }
      )
    );
    return { success: false, diagnostics };
  }

  if (artifactStats.size < PUBLICATION_LIMITS.MIN_ARTIFACT_SIZE) {
    diagnostics.push(
      publicationError(
        PUBLICATION_CODES.PUBLISH_ARTIFACT_EMPTY,
        `Artifact (${artifactStats.size} bytes) smaller than minimum ${PUBLICATION_LIMITS.MIN_ARTIFACT_SIZE} bytes`
      )
    );
    return { success: false, diagnostics };
  }

  // ─── Destination ─────────────────────────────────────────

  try {
    if (!existsSync(destinationPath)) {
      mkdirSync(destinationPath, { recursive: true });
    } else {
      const destStats = statSync(destinationPath);
      if (!destStats.isDirectory()) {
        diagnostics.push(
          publicationError(
            PUBLICATION_CODES.PUBLISH_DEST_NOT_DIRECTORY,
            `Destination path exists but is not a directory: ${destinationPath}`,
            { destinationPath }
          )
        );
        return { success: false, diagnostics };
      }
    }
  } catch (e) {
    diagnostics.push(
      publicationInfrastructureError(
        PUBLICATION_CODES.PUBLISH_DEST_CREATION_FAILED,
        `Cannot create destination directory "${destinationPath}": ${e instanceof Error ? e.message : 'Unknown error'}`,
        { destinationPath }
      )
    );
    return { success: false, diagnostics };
  }

  // ─── Copy Artifact ──────────────────────────────────────

  const filename = basename(artifactPath);
  const publishedPath = join(destinationPath, filename);

  try {
    copyFileSync(artifactPath, publishedPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ENOSPC|disk ?full|no space/i.test(msg)) {
      diagnostics.push(
        publicationInfrastructureError(
          PUBLICATION_CODES.PUBLISH_DEST_DISK_FULL,
          `Disk full writing "${publishedPath}": ${msg}`,
          { path: publishedPath }
        )
      );
    } else if (/EACCES|permission denied/i.test(msg)) {
      diagnostics.push(
        publicationError(
          PUBLICATION_CODES.PUBLISH_WRITE_DENIED,
          `Permission denied writing "${publishedPath}": ${msg}`,
          { path: publishedPath }
        )
      );
    } else {
      diagnostics.push(
        publicationError(
          PUBLICATION_CODES.PUBLISH_COPY_FAILED,
          `Copy failed: ${artifactPath} → ${publishedPath}: ${msg}`,
          { source: artifactPath, destination: publishedPath }
        )
      );
    }
    return { success: false, diagnostics };
  }

  // ─── Verify Copy ───────────────────────────────────────

  const digest = computeSha256(publishedPath);
  if (!digest) {
    diagnostics.push(
      publicationError(
        PUBLICATION_CODES.PUBLISH_HASH_COMPUTATION_FAILED,
        `Artifact copied but SHA-256 verification failed at "${publishedPath}"`,
        { path: publishedPath }
      )
    );
    return { success: false, diagnostics };
  }

  const publishedStats = statSync(publishedPath);

  return {
    success: true,
    publishedPath,
    sha256: digest,
    sizeBytes: publishedStats.size,
    filename,
    diagnostics,
  };
}
