/**
 * Publication Service
 *
 * Orchestrates the publication of Build artifacts to GitHub Releases.
 *
 * Responsibilities:
 * - Accept BuildResult and verify build outputs
 * - Reuse Build metadata and checksums (don't recompute)
 * - Create GitHub Release with tag `v{version}`
 * - Upload PHAR, checksums.txt, and metadata.json as release assets
 * - Publish the release (make non-draft)
 * - Produce structured PublicationResult
 *
 * This module has NO knowledge of Registry updates.
 * Registry updates are handled by a separate workflow/stage.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { createHash } from 'crypto';

import type { PublicationProvider } from './provider.js';
import type {
  Release,
  CreateReleaseResult,
  UploadAssetResult,
} from './provider.js';
import {
  PUBLICATION_CODES,
  PublicationDiagnosticSeverity,
  publicationError,
  publicationInfrastructureError,
  publicationWarning,
  type PublicationDiagnostic,
} from './diagnostics.js';

// ============================================================
// Resource Limits
// ============================================================

export const PUBLICATION_SERVICE_LIMITS = {
  /** Maximum metadata.json size */
  MAX_METADATA_SIZE: 1 * 1024 * 1024, // 1 MB

  /** Minimum PHAR size */
  MIN_PHAR_SIZE: 1024,

  /** Maximum release body size */
  MAX_RELEASE_BODY_SIZE: 125000,

  /** Asset upload timeout (ms) */
  UPLOAD_TIMEOUT_MS: 5 * 60 * 1000,
} as const;

// ============================================================
// Build Integration Types
// ============================================================

/**
 * Build metadata as produced by Build domain
 * This is passed TO Publication, not recomputed by Publication
 */
export interface BuildMetadata {
  /** Plugin name from plugin.yml */
  pluginName: string;
  /** Plugin version from plugin.yml */
  pluginVersion: string;
  /** API version (e.g., "5.0.0") */
  apiVersion?: string;
  /** Main class namespace */
  mainClass?: string;
  /** Description from plugin.yml */
  description?: string;
  /** Author(s) from plugin.yml */
  author?: string | string[];
  /** Commands defined by plugin */
  commands?: Array<{ name: string; description?: string }>;
  /** Permissions defined by plugin */
  permissions?: Array<{ name: string; description?: string }>;
  /** Optional extra metadata */
  extra?: Record<string, unknown>;
}

/**
 * Build checksum manifest format
 */
export interface BuildChecksumManifest {
  /** SHA-256 checksums keyed by filename */
  checksums: Record<string, string>;
}

/**
 * Build result artifacts (from Build domain)
 */
export interface BuildArtifacts {
  /** Absolute path to the PHAR file */
  pharPath: string;
  /** SHA-256 of the PHAR (reused from Build, not recomputed) */
  sha256: string;
  /** Size of PHAR in bytes */
  sizeBytes: number;
}

// ============================================================
// Publication Request
// ============================================================

/**
 * Request to publish a build to GitHub Release
 *
 * Storage owner/repository come from configuration or Registry,
 * NOT hardcoded.
 */
export interface PublishToReleaseRequest {
  /**
   * Storage repository where the release will be created
   * Format: owner/name (e.g., "poggit-alternative-test/TopStats")
   */
  storageRepository: string;

  /**
   * Build metadata from Build domain
   */
  buildMetadata: BuildMetadata;

  /**
   * Build artifacts from Build domain
   */
  buildArtifacts: BuildArtifacts;

  /**
   * Optional checksum manifest
   * If not provided, will be generated from buildArtifacts
   */
  checksumManifest?: BuildChecksumManifest;

  /**
   * Optional custom release notes
   * If not provided, auto-generated notes will be used
   */
  releaseNotes?: string;

  /**
   * Whether to publish immediately (draft: false) or as draft (draft: true)
   * Default: draft (true) for review before publishing
   */
  draft?: boolean;

  /**
   * Optional pre-uploaded metadata.json content
   * If not provided, will be generated from buildMetadata
   */
  metadataJson?: string;
}

// ============================================================
// Publication Result
// ============================================================

/**
 * Result of publishing to GitHub Release
 */
export interface PublishToReleaseResult {
  /** Whether publication succeeded */
  success: boolean;

  /** Release information (if successful) */
  release?: {
    id: number;
    tagName: string;
    name: string;
    htmlUrl: string;
    draft: boolean;
  };

  /** Uploaded assets (if successful) */
  assets?: Array<{
    name: string;
    contentType: string;
    size: number;
  }>;

  /** All diagnostics from the publication process */
  diagnostics: PublicationDiagnostic[];

  /** Timestamp when publication completed */
  publishedAt?: string;
}

// ============================================================
// Release Notes Generator
// ============================================================

/**
 * Generate release notes from build metadata
 */
function generateReleaseNotes(metadata: BuildMetadata): string {
  const lines: string[] = [];

  lines.push(`# ${metadata.pluginName} v${metadata.pluginVersion}`);
  lines.push('');

  if (metadata.description) {
    lines.push(metadata.description);
    lines.push('');
  }

  lines.push('## Plugin Information');
  lines.push('');

  if (metadata.author) {
    const authors = Array.isArray(metadata.author) ? metadata.author.join(', ') : metadata.author;
    lines.push(`- **Author:** ${authors}`);
  }

  if (metadata.apiVersion) {
    lines.push(`- **API Version:** ${metadata.apiVersion}`);
  }

  if (metadata.mainClass) {
    lines.push(`- **Main Class:** \`${metadata.mainClass}\``);
  }

  lines.push('');

  if (metadata.commands && metadata.commands.length > 0) {
    lines.push('## Commands');
    lines.push('');
    for (const cmd of metadata.commands) {
      const desc = cmd.description ? `: ${cmd.description}` : '';
      lines.push(`- \`/${cmd.name}\`${desc}`);
    }
    lines.push('');
  }

  if (metadata.permissions && metadata.permissions.length > 0) {
    lines.push('## Permissions');
    lines.push('');
    for (const perm of metadata.permissions) {
      const desc = perm.description ? `: ${perm.description}` : '';
      lines.push(`- \`${perm.name}\`${desc}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*This release was built by the Axolotl Plugin Repository.*');

  return lines.join('\n');
}

// ============================================================
// Metadata JSON Generator
// ============================================================

/**
 * Generate metadata.json content
 */
function generateMetadataJson(metadata: BuildMetadata, pharSha256: string): string {
  const metadataJson: Record<string, unknown> = {
    schema_version: 1,
    plugin_name: metadata.pluginName,
    version: metadata.pluginVersion,
    built_at: new Date().toISOString(),
    source_sha256: pharSha256,
  };

  if (metadata.apiVersion) {
    metadataJson.api_version = metadata.apiVersion;
  }
  if (metadata.mainClass) {
    metadataJson.main_class = metadata.mainClass;
  }
  if (metadata.description) {
    metadataJson.description = metadata.description;
  }
  if (metadata.author) {
    metadataJson.author = metadata.author;
  }
  if (metadata.commands && metadata.commands.length > 0) {
    metadataJson.commands = metadata.commands;
  }
  if (metadata.permissions && metadata.permissions.length > 0) {
    metadataJson.permissions = metadata.permissions;
  }
  if (metadata.extra) {
    Object.assign(metadataJson, metadata.extra);
  }

  return JSON.stringify(metadataJson, null, 2);
}

// ============================================================
// Checksums.txt Generator
// ============================================================

/**
 * Generate checksums.txt content
 */
function generateChecksumsTxt(pharPath: string, providedSha256?: string): string {
  const sha256 = providedSha256 ?? computeLocalSha256(pharPath);
  return `${sha256}  ${basename(pharPath)}\n`;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Compute SHA-256 of a local file
 */
function computeLocalSha256(filePath: string): string {
  const content = readFileSync(filePath);
  const hash = createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

// ============================================================
// Publication Service
// ============================================================

/**
 * Publish build artifacts to GitHub Release
 *
 * @param provider - Publication provider (GitHub or Fake)
 * @param request - Publication request
 * @returns Publication result with diagnostics
 */
export async function publishToRelease(
  provider: PublicationProvider,
  request: PublishToReleaseRequest
): Promise<PublishToReleaseResult> {
  const diagnostics: PublicationDiagnostic[] = [];
  const startTime = Date.now();

  // ─── Step 1: Validate Build Artifacts ─────────────────────

  // Verify PHAR exists and is readable
  if (!existsSync(request.buildArtifacts.pharPath)) {
    diagnostics.push(
      publicationError(
        PUBLICATION_CODES.PUBLICATION_ARTIFACT_NOT_FOUND,
        `PHAR not found at "${request.buildArtifacts.pharPath}"`,
        { pharPath: request.buildArtifacts.pharPath }
      )
    );
    return {
      success: false,
      diagnostics,
    };
  }

  let pharStats: ReturnType<typeof statSync>;
  try {
    pharStats = statSync(request.buildArtifacts.pharPath);
  } catch (e) {
    diagnostics.push(
      publicationInfrastructureError(
        PUBLICATION_CODES.PUBLISH_ARTIFACT_UNREADABLE,
        `Cannot stat PHAR: ${e instanceof Error ? e.message : 'Unknown error'}`
      )
    );
    return {
      success: false,
      diagnostics,
    };
  }

  if (!pharStats.isFile()) {
    diagnostics.push(
      publicationError(
        PUBLICATION_CODES.PUBLISH_ARTIFACT_NOT_FILE,
        `PHAR path is not a file: ${request.buildArtifacts.pharPath}`
      )
    );
    return { success: false, diagnostics };
  }

  if (pharStats.size < PUBLICATION_SERVICE_LIMITS.MIN_PHAR_SIZE) {
    diagnostics.push(
      publicationError(
        PUBLICATION_CODES.PUBLISH_ARTIFACT_EMPTY,
        `PHAR is too small (${pharStats.size} bytes), may be corrupt`
      )
    );
    return { success: false, diagnostics };
  }

  // ─── Step 2: Verify Provider ──────────────────────────────

  if (!provider.isWriteEnabled()) {
    diagnostics.push(
      publicationError(
        PUBLICATION_CODES.PROVIDER_NOT_WRITE_ENABLED,
        'Publication provider is not configured for write operations'
      )
    );
    return {
      success: false,
      diagnostics,
    };
  }

  // ─── Step 3: Prepare Release Content ─────────────────────

  const tagName = `v${request.buildMetadata.pluginVersion}`;
  const releaseName = `${request.buildMetadata.pluginName} v${request.buildMetadata.pluginVersion}`;
  const releaseNotes = request.releaseNotes ?? generateReleaseNotes(request.buildMetadata);

  // Validate release notes length
  if (releaseNotes.length > PUBLICATION_SERVICE_LIMITS.MAX_RELEASE_BODY_SIZE) {
    diagnostics.push(
      publicationWarning(
        PUBLICATION_CODES.RELEASE_NOTES_TRUNCATED,
        `Release notes exceed maximum length (${releaseNotes.length} > ${PUBLICATION_SERVICE_LIMITS.MAX_RELEASE_BODY_SIZE}), truncating`
      )
    );
  }

  // ─── Step 4: Create Release ─────────────────────────────

  let createResult: CreateReleaseResult;
  try {
    createResult = await provider.createRelease({
      repository: request.storageRepository as any,
      tagName,
      name: releaseName,
      body: releaseNotes.slice(0, PUBLICATION_SERVICE_LIMITS.MAX_RELEASE_BODY_SIZE),
      draft: request.draft ?? true,
    });
  } catch (err) {
    diagnostics.push(
      publicationInfrastructureError(
        PUBLICATION_CODES.PROVIDER_ERROR,
        `Provider error creating release: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    );
    return {
      success: false,
      diagnostics,
    };
  }

  if (!createResult.success || !createResult.release) {
    const errorMsg = createResult.error?.message ?? 'Unknown error creating release';
    const errorCode = mapProviderErrorToDiagnostic(createResult.error?.code);

    diagnostics.push(
      publicationError(
        errorCode,
        `Failed to create release: ${errorMsg}`,
        {
          repository: request.storageRepository,
          tagName,
          errorCode: createResult.error?.code,
          statusCode: createResult.error?.statusCode,
        }
      )
    );

    return {
      success: false,
      diagnostics,
    };
  }

  const release = createResult.release;
  diagnostics.push({
    code: PUBLICATION_CODES.RELEASE_CREATED,
    severity: PublicationDiagnosticSeverity.WARNING,
    message: `Created release ${tagName} (ID: ${release.id})`,
  });

  // ─── Step 5: Upload PHAR Asset ──────────────────────────

  const pharContent = readFileSync(request.buildArtifacts.pharPath);

  let pharAssetResult: UploadAssetResult;
  try {
    pharAssetResult = await provider.uploadReleaseAsset({
      repository: request.storageRepository as any,
      releaseId: release.id,
      name: basename(request.buildArtifacts.pharPath),
      content: pharContent,
      contentType: 'application/octet-stream',
    });
  } catch (err) {
    diagnostics.push(
      publicationInfrastructureError(
        PUBLICATION_CODES.ASSET_UPLOAD_FAILED,
        `Provider error uploading PHAR: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    );
    return {
      success: false,
      release: {
        id: release.id,
        tagName: release.tagName,
        name: release.name,
        htmlUrl: release.htmlUrl,
        draft: release.draft,
      },
      diagnostics,
    };
  }

  if (!pharAssetResult.success) {
    diagnostics.push(
      publicationError(
        PUBLICATION_CODES.ASSET_UPLOAD_FAILED,
        `Failed to upload PHAR: ${pharAssetResult.error?.message ?? 'Unknown error'}`
      )
    );
    return {
      success: false,
      release: {
        id: release.id,
        tagName: release.tagName,
        name: release.name,
        htmlUrl: release.htmlUrl,
        draft: release.draft,
      },
      diagnostics,
    };
  }

  diagnostics.push({
    code: PUBLICATION_CODES.ASSET_UPLOADED,
    severity: PublicationDiagnosticSeverity.WARNING,
    message: `Uploaded PHAR asset (${pharAssetResult.asset?.name})`,
  });

  // ─── Step 6: Upload Checksums ──────────────────────────

  const checksumsContent = request.checksumManifest
    ? Object.entries(request.checksumManifest.checksums)
        .map(([file, hash]) => `${hash}  ${file}`)
        .join('\n') + '\n'
    : generateChecksumsTxt(request.buildArtifacts.pharPath, request.buildArtifacts.sha256);

  const checksumsBuffer = Buffer.from(checksumsContent, 'utf-8');

  let checksumsResult: UploadAssetResult;
  try {
    checksumsResult = await provider.uploadReleaseAsset({
      repository: request.storageRepository as any,
      releaseId: release.id,
      name: 'checksums.txt',
      content: checksumsBuffer,
      contentType: 'text/plain',
    });
  } catch (err) {
    diagnostics.push(
      publicationWarning(
        PUBLICATION_CODES.ASSET_UPLOAD_FAILED,
        `Provider error uploading checksums: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    );
    checksumsResult = { success: false };
  }

  if (!checksumsResult.success) {
    diagnostics.push(
      publicationWarning(
        PUBLICATION_CODES.ASSET_UPLOAD_FAILED,
        `Failed to upload checksums.txt: ${checksumsResult.error?.message ?? 'Unknown error'}`
      )
    );
    // Non-fatal: PHAR is uploaded
  } else {
    diagnostics.push({
      code: PUBLICATION_CODES.ASSET_UPLOADED,
      severity: PublicationDiagnosticSeverity.WARNING,
      message: `Uploaded checksums.txt asset`,
    });
  }

  // ─── Step 7: Upload Metadata JSON ───────────────────────

  const metadataJsonContent = request.metadataJson ?? generateMetadataJson(
    request.buildMetadata,
    request.buildArtifacts.sha256
  );

  const metadataBuffer = Buffer.from(metadataJsonContent, 'utf-8');

  if (metadataBuffer.length > PUBLICATION_SERVICE_LIMITS.MAX_METADATA_SIZE) {
    diagnostics.push(
      publicationWarning(
        PUBLICATION_CODES.METADATA_TOO_LARGE,
        `metadata.json exceeds maximum size (${metadataBuffer.length} > ${PUBLICATION_SERVICE_LIMITS.MAX_METADATA_SIZE})`
      )
    );
  }

  let metadataResult: UploadAssetResult;
  try {
    metadataResult = await provider.uploadReleaseAsset({
      repository: request.storageRepository as any,
      releaseId: release.id,
      name: 'metadata.json',
      content: metadataBuffer,
      contentType: 'application/json',
    });
  } catch (err) {
    diagnostics.push(
      publicationWarning(
        PUBLICATION_CODES.ASSET_UPLOAD_FAILED,
        `Provider error uploading metadata: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    );
    metadataResult = { success: false };
  }

  if (!metadataResult.success) {
    diagnostics.push(
      publicationWarning(
        PUBLICATION_CODES.ASSET_UPLOAD_FAILED,
        `Failed to upload metadata.json: ${metadataResult.error?.message ?? 'Unknown error'}`
      )
    );
    // Non-fatal: PHAR is uploaded
  } else {
    diagnostics.push({
      code: PUBLICATION_CODES.ASSET_UPLOADED,
      severity: PublicationDiagnosticSeverity.WARNING,
      message: `Uploaded metadata.json asset`,
    });
  }

  // ─── Step 8: Publish Release (if not draft) ────────────

  if (!createResult.release.draft) {
    // Already published (draft: false in create call)
  } else if (request.draft === false) {
    // Explicitly requested publish
    try {
      const updateResult = await provider.updateRelease({
        repository: request.storageRepository as any,
        releaseId: release.id,
        draft: false,
      });

      if (!updateResult.success) {
        diagnostics.push(
          publicationWarning(
            PUBLICATION_CODES.RELEASE_PUBLISH_FAILED,
            `Failed to publish release: ${updateResult.error?.message ?? 'Unknown error'}`
          )
        );
        // Release was created as draft, manual publish needed
      } else {
        diagnostics.push({
          code: PUBLICATION_CODES.RELEASE_PUBLISHED,
          severity: PublicationDiagnosticSeverity.WARNING,
          message: 'Release published (made non-draft)',
        });
      }
    } catch (err) {
      diagnostics.push(
        publicationWarning(
          PUBLICATION_CODES.RELEASE_PUBLISH_FAILED,
          `Provider error publishing release: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      );
    }
  }

  // ─── Complete ───────────────────────────────────────────

  return {
    success: true,
    release: {
      id: release.id,
      tagName: release.tagName,
      name: release.name,
      htmlUrl: release.htmlUrl,
      draft: release.draft,
    },
    assets: [
      {
        name: basename(request.buildArtifacts.pharPath),
        contentType: 'application/octet-stream',
        size: pharStats.size,
      },
      {
        name: 'checksums.txt',
        contentType: 'text/plain',
        size: checksumsBuffer.length,
      },
      {
        name: 'metadata.json',
        contentType: 'application/json',
        size: metadataBuffer.length,
      },
    ],
    diagnostics,
    publishedAt: new Date().toISOString(),
  };
}

// ============================================================
// Error Code Mapping
// ============================================================

function mapProviderErrorToDiagnostic(
  errorCode?: string
): PublicationDiagnostic['code'] {
  switch (errorCode) {
    case 'PROVIDER_AUTH_REQUIRED':
    case 'PROVIDER_AUTH_INVALID':
      return PUBLICATION_CODES.PROVIDER_AUTH_FAILED;
    case 'PROVIDER_PERMISSION_DENIED':
    case 'PROVIDER_REPOSITORY_ACCESS_DENIED':
      return PUBLICATION_CODES.PROVIDER_PERMISSION_DENIED;
    case 'PROVIDER_REPOSITORY_NOT_FOUND':
      return PUBLICATION_CODES.PROVIDER_REPOSITORY_NOT_FOUND;
    case 'PROVIDER_RELEASE_ALREADY_EXISTS':
      return PUBLICATION_CODES.RELEASE_ALREADY_EXISTS;
    case 'PROVIDER_ASSET_TOO_LARGE':
      return PUBLICATION_CODES.ASSET_TOO_LARGE;
    default:
      return PUBLICATION_CODES.PROVIDER_ERROR;
  }
}
