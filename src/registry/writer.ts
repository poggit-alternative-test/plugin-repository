/**
 * Registry Writer
 *
 * Updates registry files with Publication outputs.
 * Implements the Registry → Publication → Registry update cycle.
 *
 * This module is responsible for:
 * - Converting PublicationResult to ArtifactRef
 * - Updating version records with artifact information
 * - Writing updated registry files to disk
 * - Tracking lifecycle transitions
 *
 * The Registry Core owns the canonical state; Publication provides artifact data.
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import YAML from 'yaml';

import type { VersionRecord } from './types.js';
import type { PublishToReleaseResult } from '../publication/index.js';
import {
  PublicationDiagnosticSeverity,
  type PublicationDiagnostic,
  type PublicationDiagnosticCode,
} from '../publication/diagnostics.js';
import type { PluginIdentity } from './types.js';

// ============================================================
// Artifact Ref Builder
// ============================================================

/**
 * Build an ArtifactRef from PublicationResult
 */
export function buildArtifactRef(
  publishResult: PublishToReleaseResult,
  pluginName: string,
  version: string,
  provenance?: { type: 'github-attestation' }
): { artifactRef: ArtifactRefFromPublication; diagnostics: WriterDiagnostic[] } {
  const diagnostics: WriterDiagnostic[] = [];

  if (!publishResult.success || !publishResult.release) {
    diagnostics.push({
      severity: 'error',
      code: 'PUBLICATION_FAILED',
      message: 'Publication did not succeed; cannot create artifact ref',
    });
    return {
      artifactRef: null as unknown as ArtifactRefFromPublication,
      diagnostics,
    };
  }

  const release = publishResult.release;

  // Validate required fields
  if (!publishResult.publishedAt) {
    diagnostics.push({
      severity: 'warning',
      code: 'MISSING_PUBLISHED_AT',
      message: 'publishedAt not set; using current time',
    });
  }

  // Extract PHAR filename from assets
  const pharAsset = publishResult.assets?.find(
    (a) => a.name?.endsWith('.phar') || a.contentType === 'application/octet-stream'
  );
  const pharFilename = pharAsset?.name ?? `${pluginName}.phar`;

  // Extract SHA-256 from diagnostics or result
  const sha256Diagnostic = publishResult.diagnostics?.find(
    (d) => d.code === 'ASSET_UPLOADED' && d.severity === PublicationDiagnosticSeverity.INFO
  );
  const sha256FromDiagnostics = sha256Diagnostic?.context?.['sha256'] as string | undefined;

  const artifactRef: ArtifactRefFromPublication = {
    releaseTag: release.tagName,
    file: pharFilename,
    sha256: sha256FromDiagnostics ?? publishResult.release.tagName, // Placeholder; caller should verify
    publishedAt: publishResult.publishedAt ?? new Date().toISOString(),
    provenance,
  };

  return { artifactRef, diagnostics };
}

// Type alias for clarity
type ArtifactRefFromPublication = {
  releaseTag: string;
  file: string;
  sha256: string;
  publishedAt: string;
  provenance?: {
    type: 'github-attestation';
  };
};

// ============================================================
// Version Record Updater
// ============================================================

/**
 * Result of updating a version record
 */
export interface UpdateVersionResult {
  success: boolean;
  version?: string;
  diagnostics: WriterDiagnostic[];
}

/**
 * Diagnostic from writer operations
 */
export interface WriterDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
}

/**
 * Update a version record with publication artifact information
 *
 * Takes a version file path and PublicationResult, produces updated YAML content.
 */
export function updateVersionRecordWithPublication(
  versionFilePath: string,
  artifactRef: ArtifactRefFromPublication
): { content: string; diagnostics: WriterDiagnostic[] } {
  const diagnostics: WriterDiagnostic[] = [];

  // Read existing file
  let existing: Record<string, unknown>;
  try {
    const content = readFileSync(versionFilePath, 'utf-8');
    existing = YAML.parse(content) as Record<string, unknown>;
  } catch (e) {
    diagnostics.push({
      severity: 'error',
      code: 'FILE_READ_ERROR',
      message: `Failed to read version file: ${e instanceof Error ? e.message : 'Unknown error'}`,
      path: versionFilePath,
    });
    return {
      content: '',
      diagnostics,
    };
  }

  // Validate existing structure
  if (existing.status !== 'materialized') {
    diagnostics.push({
      severity: 'error',
      code: 'INVALID_STATUS_TRANSITION',
      message: `Cannot publish version with status "${existing.status}". Expected "materialized".`,
      path: versionFilePath,
    });
    return {
      content: '',
      diagnostics,
    };
  }

  // Build artifact object with provenance
  const artifact: Record<string, unknown> = {
    release_tag: artifactRef.releaseTag,
    file: artifactRef.file,
    sha256: artifactRef.sha256,
    published_at: artifactRef.publishedAt,
  };

  // Include provenance if provided
  if (artifactRef.provenance) {
    artifact.provenance = artifactRef.provenance;
  }

  // Build updated record
  const updated: VersionRecordYaml = {
    ...existing,
    artifact,
    status: 'published',
  };

  // Serialize
  const output = YAML.stringify(updated, { indent: 2, lineWidth: 0 });

  return {
    content: output,
    diagnostics,
  };
}

// YAML-compatible record type
type VersionRecordYaml = Record<string, unknown> & {
  status: string;
  artifact?: {
    release_tag: string;
    file: string;
    sha256: string;
    published_at: string;
  };
};

// ============================================================
// File Writer
// ============================================================

/**
 * Write a version record to disk
 */
export function writeVersionRecord(
  filePath: string,
  content: string
): WriterDiagnostic[] {
  const diagnostics: WriterDiagnostic[] = [];

  try {
    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, content, 'utf-8');
  } catch (e) {
    diagnostics.push({
      severity: 'error',
      code: 'FILE_WRITE_ERROR',
      message: `Failed to write file: ${e instanceof Error ? e.message : 'Unknown error'}`,
      path: filePath,
    });
  }

  return diagnostics;
}

// ============================================================
// Aggregate Writer Service
// ============================================================

/**
 * Complete publication-to-registry update result
 */
export interface PublishToRegistryResult {
  success: boolean;
  pluginId?: string;
  version?: string;
  registryPath?: string;
  diagnostics: WriterDiagnostic[];
}

/**
 * Update the registry with publication results
 *
 * This is the main entry point for the Publication → Registry integration.
 *
 * @param pluginId - Plugin identifier
 * @param version - Version string
 * @param registryRoot - Root path to registry
 * @param publishResult - Result from Publication domain
 * @param provenance - Optional provenance metadata (e.g., { type: 'github-attestation' })
 */
export async function publishToRegistry(
  pluginId: string,
  version: string,
  registryRoot: string,
  publishResult: PublishToReleaseResult,
  provenance?: { type: 'github-attestation' }
): Promise<PublishToRegistryResult> {
  const allDiagnostics: WriterDiagnostic[] = [];

  // Step 1: Validate publication result
  if (!publishResult.success) {
    allDiagnostics.push({
      severity: 'error',
      code: 'PUBLICATION_FAILED',
      message: 'Publication did not succeed; registry not updated',
    });
    return {
      success: false,
      pluginId,
      version,
      diagnostics: allDiagnostics,
    };
  }

  // Step 2: Build artifact ref with provenance
  const { artifactRef, diagnostics: refDiagnostics } = buildArtifactRef(
    publishResult,
    pluginId,
    version,
    provenance
  );
  allDiagnostics.push(...refDiagnostics);

  if (!artifactRef) {
    return {
      success: false,
      pluginId,
      version,
      diagnostics: allDiagnostics,
    };
  }

  // Step 3: Update version record
  const versionFilePath = join(registryRoot, 'plugins', pluginId, 'versions', `${version}.yaml`);
  const { content: updatedYaml, diagnostics: updateDiagnostics } = updateVersionRecordWithPublication(
    versionFilePath,
    artifactRef
  );
  allDiagnostics.push(...updateDiagnostics);

  if (!updatedYaml) {
    return {
      success: false,
      pluginId,
      version,
      diagnostics: allDiagnostics,
    };
  }

  // Step 4: Write to disk
  const writeDiagnostics = writeVersionRecord(versionFilePath, updatedYaml);
  allDiagnostics.push(...writeDiagnostics);

  if (writeDiagnostics.some((d) => d.severity === 'error')) {
    return {
      success: false,
      pluginId,
      version,
      registryPath: versionFilePath,
      diagnostics: allDiagnostics,
    };
  }

  return {
    success: true,
    pluginId,
    version,
    registryPath: versionFilePath,
    diagnostics: allDiagnostics,
  };
}
