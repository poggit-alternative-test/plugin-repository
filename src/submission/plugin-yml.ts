/**
 * PocketMine Plugin Metadata Parser
 *
 * Safely parses plugin.yml from plugin repositories.
 * This is static inspection only - NO code execution.
 *
 * SECURITY: plugin.yml is untrusted developer-controlled input.
 * Treat as attacker-controlled YAML.
 */

import { z } from 'zod';
import yaml from 'yaml';
import { validateSemVer } from '../registry/validators.js';
import {
  SUBMISSION_CODES,
  submissionError,
  submissionWarning,
  reviewSignal,
  type SubmissionDiagnostic,
} from './diagnostics.js';
import { validateBranch } from './schema.js';

// ============================================================
// Resource Limits
// ============================================================

export const PLUGIN_YML_MAX_SIZE = 64 * 1024; // 64 KB

// ============================================================
// Plugin Metadata Schema
// ============================================================

const AUTHOR_TYPES = z.union([
  z.string(),
  z.array(z.string()),
]);

// PHP version can be a string like "8.1" or a number like 8.1 from YAML
const PHP_VERSION = z.union([
  z.string(),
  z.number(),
]);

/**
 * Schema for PocketMine plugin.yml metadata.
 *
 * Based on PocketMine-MP plugin.yml specification.
 * Fields marked as required are typically required by PocketMine.
 */
export const PocketMinePluginSchema = z.object({
  name: z
    .string()
    .min(1, 'Plugin name is required')
    .max(64, 'Plugin name too long'),
  version: z
    .string()
    .min(1, 'Version is required'),
  main: z
    .string()
    .min(1, 'Main class is required'),
  api: z.union([
    z.string(),
    z.array(z.string()),
  ]),
  author: AUTHOR_TYPES.optional(),
  authors: z.array(z.string()).optional(),
  description: z.string().optional(),
  website: z.string().optional(),
  php: z.union([PHP_VERSION, z.array(PHP_VERSION)]).optional(),
  dependencies: z.record(z.string()).optional(),
  'ext-namespace': z.string().optional(),
  prefix: z.string().optional(),
  load: z.enum(['STARTUP', 'POSTWORLD']).optional(),
  protocol: z.union([z.number(), z.array(z.number())]).optional(),
  'version_info': z.record(z.string()).optional(),
});

// ============================================================
// Parsed Plugin Metadata
// ============================================================

export interface ParsedPluginMetadata {
  name: string;
  version: string;
  main: string;
  api: string[];
  authors: string[];
  description?: string;
  website?: string;
  php?: string | string[];
  dependencies?: Record<string, string>;
  namespace?: string;
  prefix?: string;
  load?: 'STARTUP' | 'POSTWORLD';
  protocol?: number | number[];
  versionInfo?: Record<string, string>;
}

export interface PluginMetadataParseResult {
  success: boolean;
  metadata?: ParsedPluginMetadata;
  diagnostics: SubmissionDiagnostic[];
}

// ============================================================
// Parser Implementation
// ============================================================

/**
 * Parse plugin.yml content safely.
 *
 * @param content Raw plugin.yml content
 * @param sourcePath Source path for diagnostics
 * @returns Parsed metadata or diagnostics
 */
export function parsePluginYaml(
  content: string,
  sourcePath?: string
): PluginMetadataParseResult {
  const diagnostics: SubmissionDiagnostic[] = [];

  // Size check
  if (content.length > PLUGIN_YML_MAX_SIZE) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.PLUGIN_YML_TOO_LARGE,
        `plugin.yml exceeds maximum size of ${PLUGIN_YML_MAX_SIZE} bytes`,
        { file: sourcePath, context: { size: content.length } }
      )
    );
    return { success: false, diagnostics };
  }

  // Parse YAML using maintained library
  let data: unknown;
  try {
    data = yaml.parse(content);
  } catch (e) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.PLUGIN_YML_INVALID,
        `Failed to parse plugin.yml: ${e instanceof Error ? e.message : 'Unknown error'}`,
        { file: sourcePath }
      )
    );
    return { success: false, diagnostics };
  }

  // Validate structure
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.PLUGIN_YML_INVALID,
        'plugin.yml must be a YAML object',
        { file: sourcePath }
      )
    );
    return { success: false, diagnostics };
  }

  // Validate with Zod
  const parseResult = PocketMinePluginSchema.safeParse(data);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      const path = issue.path.join('.');

      // Determine error code based on issue
      let code: string;
      if (path === 'name' && issue.message.includes('required')) {
        code = SUBMISSION_CODES.PLUGIN_YML_MISSING_NAME;
      } else if (path === 'version' && issue.message.includes('required')) {
        code = SUBMISSION_CODES.PLUGIN_YML_MISSING_VERSION;
      } else if (path === 'main' && issue.message.includes('required')) {
        code = SUBMISSION_CODES.PLUGIN_YML_MISSING_MAIN;
      } else if (path === 'api' && issue.message.includes('required')) {
        code = SUBMISSION_CODES.PLUGIN_YML_MISSING_API;
      } else {
        code = SUBMISSION_CODES.PLUGIN_YML_INVALID;
      }

      diagnostics.push(
        submissionError(
          code as typeof SUBMISSION_CODES.PLUGIN_YML_INVALID,
          `${path ? path + ': ' : ''}${issue.message}`,
          { file: sourcePath, field: path || undefined }
        )
      );
    }
    return { success: false, diagnostics };
  }

  // Validate version is SemVer
  const versionResult = validateSemVer(parseResult.data.version);
  if (!versionResult.success) {
    diagnostics.push(
      submissionError(
        SUBMISSION_CODES.PLUGIN_VERSION_INVALID,
        `Invalid version format: ${versionResult.error}`,
        { file: sourcePath, field: 'version' }
      )
    );
    return { success: false, diagnostics };
  }

  // Normalize parsed data
  const normalized = normalizePluginMetadata(parseResult.data);

  return {
    success: true,
    metadata: normalized,
    diagnostics,
  };
}

/**
 * Normalize plugin metadata to consistent format.
 */
function normalizePluginMetadata(data: z.infer<typeof PocketMinePluginSchema>): ParsedPluginMetadata {
  // Normalize API versions to array
  let api: string[];
  if (typeof data.api === 'string') {
    api = [data.api];
  } else {
    api = data.api;
  }

  // Normalize authors
  let authors: string[];
  if (data.authors && Array.isArray(data.authors)) {
    authors = data.authors;
  } else if (data.author) {
    if (typeof data.author === 'string') {
      authors = [data.author];
    } else {
      authors = data.author;
    }
  } else {
    authors = [];
  }

  return {
    name: data.name,
    version: data.version,
    main: data.main,
    api,
    authors,
    description: data.description,
    website: data.website,
    // Normalize php: can be string, number, or array of either
    php: normalizePhpVersion(data.php),
    dependencies: data.dependencies,
    namespace: data['ext-namespace'],
    prefix: data.prefix,
    load: data.load,
    protocol: data.protocol,
    versionInfo: data.version_info,
  };
}

/**
 * Normalize PHP version to string or array of strings.
 */
function normalizePhpVersion(php: unknown): string | string[] | undefined {
  if (php === undefined) return undefined;
  if (typeof php === 'string') return php;
  // Convert number to string
  if (typeof php === 'number') return String(php);
  // Handle array
  if (Array.isArray(php)) {
    return php.map((v) => (typeof v === 'string' ? v : String(v)));
  }
  return undefined;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Derive a suggested plugin ID from plugin name.
 *
 * Rules:
 * - Lowercase
 * - Replace spaces with hyphens
 * - Remove special characters except hyphens
 * - Max 64 characters
 * - Must start/end with alphanumeric
 */
export function derivePluginId(pluginName: string): string {
  return pluginName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

/**
 * Validate a derived plugin ID against Registry rules.
 */
export function validateDerivedPluginId(id: string): {
  valid: boolean;
  error?: string;
} {
  // Registry ID rules from schema
  const PLUGIN_ID_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  if (!id || id.length === 0) {
    return { valid: false, error: 'Plugin ID cannot be empty' };
  }

  if (id.length > 64) {
    return { valid: false, error: 'Plugin ID must be 64 characters or less' };
  }

  if (!PLUGIN_ID_REGEX.test(id)) {
    return {
      valid: false,
      error: 'Plugin ID must be lowercase letters, digits, and hyphens (e.g., my-plugin)',
    };
  }

  return { valid: true };
}

/**
 * Extract namespace from main class path.
 * e.g., "Vendor\Plugin\Main" -> "Vendor\Plugin"
 */
export function extractNamespace(mainClass: string): string | null {
  const parts = mainClass.split('\\');
  if (parts.length > 1) {
    return parts.slice(0, -1).join('\\');
  }
  return null;
}
