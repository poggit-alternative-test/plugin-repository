/**
 * Registry Validator
 *
 * Validates registry structure, plugin identities, and version records.
 * Performs cross-record validation for consistency.
 */

import { join, basename, dirname } from 'path';
import { readdirSync, statSync, existsSync } from 'fs';
import {
  Diagnostic,
  error,
  warning,
  info,
  DiagnosticCode,
  aggregateDiagnostics,
  ValidationDiagnostics,
} from './diagnostics.js';
import {
  validateGitSha,
  validateSemVer,
  validatePluginId,
  validateRepositoryIdentity,
  validateBranch,
  validateTimestamp,
  validateSha256,
  validateReleaseTag,
} from './validators.js';
import {
  PluginIdentitySchema,
  VersionRecordSchema,
  SCHEMA_VERSION,
} from './schema.js';
import type { Plugin, VersionRecord, PluginIdentity } from './types.js';
import { loadRegistry, loadPluginIdentity, loadVersionRecords, safeParseYaml } from './parser.js';

// ============================================================
// Plugin Identity Validation
// ============================================================

/**
 * Validate a plugin identity
 */
export function validatePluginIdentity(
  filePath: string,
  content: string,
  dirName: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Parse the YAML using the hardened parser
  let parsed: Record<string, unknown>;
  try {
    parsed = safeParseYaml(content, filePath) as Record<string, unknown>;
  } catch (e) {
    diagnostics.push(
      error(
        'MALFORMED_YAML',
        filePath,
        e instanceof Error ? e.message : 'Failed to parse YAML'
      )
    );
    return diagnostics;
  }

  // Schema version check
  const schemaVersion = parsed.schema_version as number | undefined;
  if (schemaVersion === undefined) {
    diagnostics.push(
      error(
        'MISSING_REQUIRED_FIELD',
        filePath,
        'schema_version is required',
        'schema_version'
      )
    );
    return diagnostics;
  }
  if (schemaVersion > SCHEMA_VERSION) {
    diagnostics.push(
      error(
        'UNSUPPORTED_SCHEMA_VERSION',
        filePath,
        `Unsupported schema version: ${schemaVersion} (expected ${SCHEMA_VERSION})`
      )
    );
    return diagnostics;
  }

  // Validate schema
  const schemaResult = PluginIdentitySchema.safeParse(parsed);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      const path = issue.path.join('.');
      // Map schema validation errors to specific codes when possible
      if (path === 'id' && parsed.id) {
        diagnostics.push(
          error(
            'INVALID_PLUGIN_ID',
            filePath,
            issue.message,
            path
          )
        );
      } else if (path === 'upstream.repository') {
        diagnostics.push(
          error(
            'INVALID_REPOSITORY_IDENTITY',
            filePath,
            issue.message,
            path
          )
        );
      } else if (path === 'upstream.branch') {
        diagnostics.push(
          error(
            'INVALID_BRANCH',
            filePath,
            issue.message,
            path
          )
        );
      } else {
        diagnostics.push(
          error(
            'INVALID_FIELD_TYPE',
            filePath,
            `${path ? path + ': ' : ''}${issue.message}`,
            path || undefined
          )
        );
      }
    }
    return diagnostics;
  }

  // Validate plugin ID (schema already validated this, but we run it again for consistency)
  const idValidation = validatePluginId(parsed.id as string);
  if (!idValidation.success) {
    diagnostics.push(error('INVALID_PLUGIN_ID', filePath, idValidation.error!, 'id'));
  }

  // Validate directory name matches plugin ID
  if (parsed.id && dirName !== parsed.id) {
    diagnostics.push(
      error(
        'PLUGIN_ID_DIR_MISMATCH',
        filePath,
        `Plugin ID "${parsed.id}" does not match directory "${dirName}"`,
        'id'
      )
    );
  }

  // Validate repository identity
  const upstream = parsed.upstream as { repository?: string; branch?: string } | undefined;
  const repoValidation = validateRepositoryIdentity(upstream?.repository);
  if (!repoValidation.success) {
    diagnostics.push(
      error(
        'INVALID_REPOSITORY_IDENTITY',
        filePath,
        repoValidation.error!,
        'upstream.repository'
      )
    );
  }

  // Validate branch
  const branchValidation = validateBranch(upstream?.branch);
  if (!branchValidation.success) {
    diagnostics.push(
      error(
        'INVALID_BRANCH',
        filePath,
        branchValidation.error!,
        'upstream.branch'
      )
    );
  }

  // Check for URL instead of owner/repo
  if (typeof upstream?.repository === 'string') {
    if (
      upstream.repository.includes('://') ||
      upstream.repository.includes('github.com')
    ) {
      diagnostics.push(
        error(
          'REPOSITORY_IS_URL',
          filePath,
          'Repository must be "owner/name" format, not a URL',
          'upstream.repository'
        )
      );
    }
  }

  return diagnostics;
}

// ============================================================
// Version Record Validation
// ============================================================

/**
 * Validate a version record
 */
export function validateVersionRecord(
  filePath: string,
  content: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Parse the YAML using the hardened parser
  let parsed: Record<string, unknown>;
  try {
    parsed = safeParseYaml(content, filePath) as Record<string, unknown>;
  } catch (e) {
    diagnostics.push(
      error(
        'MALFORMED_YAML',
        filePath,
        e instanceof Error ? e.message : 'Failed to parse YAML'
      )
    );
    return diagnostics;
  }

  // Schema version check
  const schemaVersion = parsed.schema_version;
  if (schemaVersion === undefined) {
    diagnostics.push(
      error(
        'MISSING_REQUIRED_FIELD',
        filePath,
        'schema_version is required',
        'schema_version'
      )
    );
    return diagnostics;
  }
  if (typeof schemaVersion !== 'number' || schemaVersion > SCHEMA_VERSION) {
    diagnostics.push(
      error(
        'UNSUPPORTED_SCHEMA_VERSION',
        filePath,
        `Unsupported schema version: ${schemaVersion} (expected ${SCHEMA_VERSION})`
      )
    );
    return diagnostics;
  }

  // Validate schema
  const schemaResult = VersionRecordSchema.safeParse(parsed);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      const path = issue.path.join('.');
      // Map schema validation errors to specific codes when possible
      if (path === 'version') {
        diagnostics.push(
          error(
            'INVALID_VERSION',
            filePath,
            issue.message,
            path
          )
        );
      } else if (path === 'source.upstream_commit') {
        diagnostics.push(
          error(
            'INVALID_UPSTREAM_COMMIT',
            filePath,
            issue.message,
            path
          )
        );
      } else if (path === 'artifact.sha256') {
        diagnostics.push(
          error(
            'INVALID_ARTIFACT_SHA256',
            filePath,
            issue.message,
            path
          )
        );
      } else {
        diagnostics.push(
          error(
            'INVALID_FIELD_TYPE',
            filePath,
            `${path ? path + ': ' : ''}${issue.message}`,
            path || undefined
          )
        );
      }
    }
    return diagnostics;
  }

  // Validate version matches filename
  const filenameVersion = basename(filePath, '.yaml').replace(/\.yml$/, '');
  const recordVersion = parsed.version as string;
  if (filenameVersion !== recordVersion) {
    diagnostics.push(
      error(
        'VERSION_FILENAME_MISMATCH',
        filePath,
        `Version "${recordVersion}" does not match filename "${filenameVersion}.yaml"`,
        'version'
      )
    );
  }

  // Validate version format
  const versionValidation = validateSemVer(parsed.version);
  if (!versionValidation.success) {
    diagnostics.push(
      error('INVALID_VERSION', filePath, versionValidation.error!, 'version')
    );
  }

  // Validate upstream commit
  if (parsed.source) {
    const shaValidation = validateGitSha((parsed.source as Record<string, unknown>).upstream_commit);
    if (!shaValidation.success) {
      diagnostics.push(
        error(
          'INVALID_UPSTREAM_COMMIT',
          filePath,
          shaValidation.error!,
          'source.upstream_commit'
        )
      );
    }
  }

  // Validate review timestamp
  if (parsed.review) {
    const review = parsed.review as Record<string, unknown>;
    const timestampValidation = validateTimestamp(review.approved_at);
    if (!timestampValidation.success) {
      diagnostics.push(
        error(
          'INVALID_TIMESTAMP',
          filePath,
          timestampValidation.error!,
          'review.approved_at'
        )
      );
    }
  }

  // Validate storage commit if present
  if (parsed.storage) {
    const storage = parsed.storage as Record<string, unknown>;
    const shaValidation = validateGitSha(storage.commit);
    if (!shaValidation.success) {
      diagnostics.push(
        error(
          'INVALID_STORAGE_COMMIT',
          filePath,
          shaValidation.error!,
          'storage.commit'
        )
      );
    }
  }

  // Validate artifact SHA-256 if present
  if (parsed.artifact) {
    const artifact = parsed.artifact as Record<string, unknown>;
    const shaValidation = validateSha256(artifact.sha256);
    if (!shaValidation.success) {
      diagnostics.push(
        error(
          'INVALID_ARTIFACT_SHA256',
          filePath,
          shaValidation.error!,
          'artifact.sha256'
        )
      );
    }
  }

  // Validate published_at timestamp if present
  if (parsed.artifact && (parsed.artifact as Record<string, unknown>).published_at) {
    const timestampValidation = validateTimestamp(
      (parsed.artifact as Record<string, unknown>).published_at as string
    );
    if (!timestampValidation.success) {
      diagnostics.push(
        error(
          'INVALID_TIMESTAMP',
          filePath,
          timestampValidation.error!,
          'artifact.published_at'
        )
      );
    }
  }

  // Validate release tag format if present
  if (parsed.artifact && (parsed.artifact as Record<string, unknown>).release_tag) {
    const tagValidation = validateReleaseTag(
      (parsed.artifact as Record<string, unknown>).release_tag as string
    );
    if (!tagValidation.success) {
      diagnostics.push(
        error(
          'INVALID_FIELD_TYPE',
          filePath,
          tagValidation.error!,
          'artifact.release_tag'
        )
      );
    }
  }

  // Validate lifecycle invariants
  const status = parsed.status as string;

  if (status === 'approved' || status === 'materialized') {
    if (parsed.artifact) {
      diagnostics.push(
        warning(
          'PUBLISHED_WITHOUT_ARTIFACT',
          filePath,
          `Version with status "${status}" should not have artifact field`,
          'artifact'
        )
      );
    }
  }

  if (status === 'published') {
    if (!parsed.artifact) {
      diagnostics.push(
        error(
          'MISSING_ARTIFACT',
          filePath,
          'Published version must have artifact field',
          'artifact'
        )
      );
    }
  }

  return diagnostics;
}

// ============================================================
// Cross-Record Validation
// ============================================================

/**
 * Validate the complete registry with cross-record checks
 */
export function validateRegistry(registryPath: string): {
  plugins: Plugin[];
  diagnostics: Diagnostic[] | ValidationDiagnostics;
} {
  const diagnostics: Diagnostic[] = [];
  const plugins: Plugin[] = [];

  // Load all plugins
  const pluginsDir = join(registryPath, 'plugins');

  if (!existsSync(pluginsDir)) {
    return { plugins: [], diagnostics };
  }

  const pluginDirs = readdirSync(pluginsDir);

  // Track for duplicate checking
  const pluginIds = new Set<string>();
  const upstreamRepos = new Set<string>();
  const storageRepos = new Set<string>();

  for (const dir of pluginDirs) {
    const pluginDir = join(pluginsDir, dir);

    if (!statSync(pluginDir).isDirectory()) continue;

    const { identity, diagnostics: identityDiagnostics } = loadPluginIdentity(pluginDir);
    diagnostics.push(...identityDiagnostics);

    if (!identity) continue;

    // Check for duplicate plugin IDs
    if (pluginIds.has(identity.id)) {
      diagnostics.push(
        error(
          'DUPLICATE_PLUGIN_ID',
          join(pluginDir, 'plugin.yaml'),
          `Duplicate plugin ID: "${identity.id}"`
        )
      );
    }
    pluginIds.add(identity.id);

    // Check for duplicate upstream repos
    if (upstreamRepos.has(identity.upstream.repository)) {
      diagnostics.push(
        warning(
          'DUPLICATE_UPSTREAM',
          join(pluginDir, 'plugin.yaml'),
          `Multiple plugins reference same upstream: "${identity.upstream.repository}"`,
          'upstream.repository'
        )
      );
    }
    upstreamRepos.add(identity.upstream.repository);

    // Load versions
    const versionsDir = join(pluginDir, 'versions');
    const { versions, diagnostics: versionDiagnostics } = loadVersionRecords(versionsDir);
    diagnostics.push(...versionDiagnostics);

    // Cross-record checks for versions
    const versionStrings = new Set<string>();

    for (const version of versions) {
      // Check for duplicate versions
      if (versionStrings.has(version.version)) {
        diagnostics.push(
          error(
            'DUPLICATE_VERSION',
            join(versionsDir, `${version.version}.yaml`),
            `Duplicate version: "${version.version}"`
          )
        );
      }
      versionStrings.add(version.version);

      // Validate storage repo consistency with plugin identity
      if ('storage' in version && version.storage && identity.storage) {
        if (version.storage.repository !== identity.storage.repository) {
          diagnostics.push(
            error(
              'STORAGE_REPO_MISMATCH',
              join(versionsDir, `${version.version}.yaml`),
              `Storage repository mismatch: version has "${version.storage.repository}", plugin has "${identity.storage.repository}"`,
              'storage.repository'
            )
          );
        }
      }

      // Check for duplicate storage repos
      if ('storage' in version && version.storage) {
        if (storageRepos.has(version.storage.repository)) {
          diagnostics.push(
            warning(
              'DUPLICATE_STORAGE_REPO',
              join(versionsDir, `${version.version}.yaml`),
              `Multiple versions reference same storage: "${version.storage.repository}"`
            )
          );
        }
        storageRepos.add(version.storage.repository);
      }

      // Validate immutable records not mutated (provenance check)
      if (
        version.status === 'published' ||
        version.status === 'deprecated' ||
        version.status === 'revoked'
      ) {
        // These statuses should have immutable provenance
        // A simple check: verify required provenance fields exist and are valid
        const requiredFields = ['source', 'storage', 'artifact', 'review'];
        for (const field of requiredFields) {
          if (!version[field as keyof VersionRecord]) {
            diagnostics.push(
              error(
                'MISSING_REQUIRED_FIELD',
                join(versionsDir, `${version.version}.yaml`),
                `Published version missing required field: ${field}`,
                field
              )
            );
          }
        }
      }
    }

    plugins.push({ identity, versions });
  }

  return { plugins, diagnostics: aggregateDiagnostics(diagnostics) };
}
