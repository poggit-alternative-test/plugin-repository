/**
 * plugin.yml Validator for the Build Domain
 *
 * Validates plugin.yml from plugin source for build preparation.
 * Uses Build Domain types for diagnostics.
 *
 * SECURITY: plugin.yml is untrusted developer-controlled input.
 * Treat as attacker-controlled YAML with bounded parsing.
 */

import yaml from 'yaml';
import type {
  PluginMetadata,
  BuildDiagnostic,
  PluginCommand,
  PluginPermission,
} from './types.js';
import {
  BUILD_ERROR_CODES,
  BUILD_WARNING_CODES,
  buildError,
  buildWarning,
  hasBuildErrors,
} from './types.js';

// ============================================================
// Resource Limits
// ============================================================

/** Maximum plugin.yml size: 1 MiB (for Build domain, allows more than submission) */
export const PLUGIN_YML_MAX_SIZE = 1024 * 1024;

// ============================================================
// Parser Result Types
// ============================================================

/**
 * Result of plugin.yml validation.
 */
export interface PluginYmlValidationResult {
  /** Whether validation succeeded */
  success: boolean;
  /** Parsed metadata (if success) */
  metadata?: PluginMetadata;
  /** Diagnostics from validation */
  diagnostics: BuildDiagnostic[];
}

// ============================================================
// Main Validation Function
// ============================================================

/**
 * Validate plugin.yml content and extract metadata.
 *
 * @param content Raw plugin.yml content
 * @param sourcePath Optional source path for diagnostics
 * @returns Validation result with metadata and diagnostics
 */
export function validatePluginYml(
  content: string,
  sourcePath?: string
): PluginYmlValidationResult {
  const diagnostics: BuildDiagnostic[] = [];

  // Step 1: Size check
  if (content.length > PLUGIN_YML_MAX_SIZE) {
    diagnostics.push(
      buildError(
        BUILD_ERROR_CODES.PLUGIN_YML_SIZE_EXCEEDED,
        `plugin.yml exceeds maximum size of ${PLUGIN_YML_MAX_SIZE} bytes (${content.length} bytes)`,
        { sourcePath, size: content.length, maxSize: PLUGIN_YML_MAX_SIZE }
      )
    );
    return { success: false, diagnostics };
  }

  // Step 2: Parse YAML
  let data: unknown;
  try {
    data = yaml.parse(content, {
      // Disable custom tags to prevent code execution
      customTags: [],
    });
  } catch (e) {
    diagnostics.push(
      buildError(
        BUILD_ERROR_CODES.PLUGIN_YML_INVALID,
        `Failed to parse plugin.yml: ${e instanceof Error ? e.message : 'Unknown error'}`,
        { sourcePath }
      )
    );
    return { success: false, diagnostics };
  }

  // Step 3: Validate structure is object (null is treated as empty object)
  if (typeof data !== 'object' || data === null) {
    // null is treated as empty object for missing/empty YAML
    if (data === null) {
      data = {};
    } else {
      diagnostics.push(
        buildError(
          BUILD_ERROR_CODES.PLUGIN_YML_INVALID,
          'plugin.yml must be a YAML object',
          { sourcePath }
        )
      );
      return { success: false, diagnostics };
    }
  }

  if (Array.isArray(data)) {
    diagnostics.push(
      buildError(
        BUILD_ERROR_CODES.PLUGIN_YML_INVALID,
        'plugin.yml must be a YAML object, not an array',
        { sourcePath }
      )
    );
    return { success: false, diagnostics };
  }

  const obj = data as Record<string, unknown>;

  // Step 4: Validate required fields
  const missingFieldErrors = validateRequiredFields(obj, sourcePath);
  diagnostics.push(...missingFieldErrors);

  // If any required field is missing, fail immediately
  if (missingFieldErrors.length > 0) {
    return { success: false, diagnostics };
  }

  // Step 5: Validate and normalize each field
  const validationResult = validateFields(obj, sourcePath);
  diagnostics.push(...validationResult.diagnostics);

  // If field validation produced errors, fail
  if (hasBuildErrors(validationResult.diagnostics)) {
    return { success: false, diagnostics };
  }

  // Step 6: Build metadata
  const metadata = buildMetadata(obj, validationResult);

  return {
    success: true,
    metadata,
    diagnostics,
  };
}

// ============================================================
// Field Validation
// ============================================================

function getField(obj: Record<string, unknown>, key: string): unknown {
  return obj[key];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function hasApi(value: unknown): boolean {
  if (typeof value === 'string' && value.length > 0) return true;
  if (Array.isArray(value) && value.length > 0) return true;
  return false;
}

function isValidPhpClass(value: string): boolean {
  // Basic PHP class/namespace validation
  // Allows: Vendor\Namespace\ClassName
  return /^[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff\\]*$/.test(value);
}

function isValidApiVersion(value: string): boolean {
  // PocketMine API versions are like "4.0.0", "3.0.0", etc.
  return /^\d+\.\d+\.\d+$/.test(value);
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizePhpVersion(value: unknown): string | string[] | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''))
      .filter(Boolean);
  }
  return undefined;
}

/**
 * Validate required fields are present.
 * Returns errors for any missing required fields.
 */
function validateRequiredFields(
  obj: Record<string, unknown>,
  sourcePath?: string
): BuildDiagnostic[] {
  const errors: BuildDiagnostic[] = [];

  if (!isNonEmptyString(obj.name)) {
    errors.push(
      buildError(
        BUILD_ERROR_CODES.PLUGIN_NAME_MISSING,
        'Plugin name is required',
        { sourcePath, field: 'name' }
      )
    );
  }

  if (!isNonEmptyString(obj.version)) {
    errors.push(
      buildError(
        BUILD_ERROR_CODES.PLUGIN_VERSION_MISSING,
        'Version is required',
        { sourcePath, field: 'version' }
      )
    );
  }

  if (!isNonEmptyString(obj.main)) {
    errors.push(
      buildError(
        BUILD_ERROR_CODES.PLUGIN_MAIN_MISSING,
        'Main class is required',
        { sourcePath, field: 'main' }
      )
    );
  }

  if (!hasApi(obj.api)) {
    errors.push(
      buildError(
        BUILD_ERROR_CODES.PLUGIN_API_MISSING,
        'API version is required',
        { sourcePath, field: 'api' }
      )
    );
  }

  return errors;
}

interface FieldValidationResult {
  name?: string;
  version?: string;
  main?: string;
  api?: string[];
  authorValue?: string;
  authorsValue?: string[];
  description?: string;
  website?: string;
  php?: string | string[];
  commands?: PluginCommand[];
  permissions?: PluginPermission[];
  diagnostics: BuildDiagnostic[];
}

/**
 * Validate and normalize individual fields.
 */
function validateFields(
  obj: Record<string, unknown>,
  sourcePath?: string
): FieldValidationResult {
  const result: FieldValidationResult = { diagnostics: [] };

  // Validate name
  const name = obj.name;
  if (isNonEmptyString(name)) {
    if (name.length > 64) {
      result.diagnostics.push(
        buildWarning(
          BUILD_WARNING_CODES.LARGE_FILE_DETECTED,
          `Plugin name exceeds 64 characters (${name.length})`,
          { sourcePath, field: 'name', size: name.length }
        )
      );
    }
    result.name = String(name);
  }

  // Validate version
  const version = obj.version;
  if (isNonEmptyString(version)) {
    result.version = String(version);
  }

  // Validate main
  const main = obj.main;
  if (isNonEmptyString(main)) {
    const mainClass = String(main);
    // Basic PHP class format validation
    if (!isValidPhpClass(mainClass)) {
      result.diagnostics.push(
        buildWarning(
          BUILD_WARNING_CODES.SECURITY_SIGNAL_MEDIUM,
          `Main class may not be a valid PHP class: ${mainClass}`,
          { sourcePath, field: 'main', value: mainClass }
        )
      );
    }
    result.main = mainClass;
  }

  // Validate API
  const apiResult = validateApi(obj.api, sourcePath);
  result.diagnostics.push(...apiResult.diagnostics);
  result.api = apiResult.api;

  // Validate author/authors
  const authorResult = validateAuthors(obj.author, obj.authors, sourcePath);
  result.diagnostics.push(...authorResult.diagnostics);
  result.authorValue = authorResult.author;
  result.authorsValue = authorResult.authors;

  // Validate optional fields
  const description = obj.description;
  if (isNonEmptyString(description)) {
    result.description = String(description);
  }

  const website = obj.website;
  if (isNonEmptyString(website)) {
    if (isValidUrl(website)) {
      result.website = String(website);
    } else {
      result.diagnostics.push(
        buildWarning(
          BUILD_WARNING_CODES.SECURITY_SIGNAL_MEDIUM,
          `Website URL may not be valid: ${website}`,
          { sourcePath, field: 'website', value: String(website) }
        )
      );
      result.website = String(website);
    }
  }

  // Validate PHP version
  const php = obj.php;
  if (php !== undefined) {
    result.php = normalizePhpVersion(php);
  }

  // Validate commands (supports both object and array formats)
  const commands = obj.commands;
  if (commands !== undefined) {
    const cmdResult = validateCommands(commands, sourcePath);
    result.diagnostics.push(...cmdResult.diagnostics);
    result.commands = cmdResult.commands;
  }

  // Validate permissions (supports both object and array formats)
  const permissions = obj.permissions;
  if (permissions !== undefined) {
    const permResult = validatePermissions(permissions, sourcePath);
    result.diagnostics.push(...permResult.diagnostics);
    result.permissions = permResult.permissions;
  }

  return result;
}

// ============================================================
// Field Validators
// ============================================================

function validateApi(
  api: unknown,
  sourcePath?: string
): { diagnostics: BuildDiagnostic[]; api?: string[] } {
  const diagnostics: BuildDiagnostic[] = [];

  if (api === undefined) {
    return { diagnostics };
  }

  if (typeof api === 'string') {
    if (!isValidApiVersion(api)) {
      diagnostics.push(
        buildWarning(
          BUILD_WARNING_CODES.SECURITY_SIGNAL_HIGH,
          `Invalid API version format: ${api}. Expected format like "4.0.0"`,
          { sourcePath, field: 'api', value: api }
        )
      );
    }
    return { diagnostics, api: [api] };
  }

  if (Array.isArray(api)) {
    const validApis: string[] = [];
    for (let i = 0; i < api.length; i++) {
      const item = api[i];
      if (typeof item === 'string') {
        if (!isValidApiVersion(item)) {
          diagnostics.push(
            buildWarning(
              BUILD_WARNING_CODES.SECURITY_SIGNAL_HIGH,
              `Invalid API version in array at index ${i}: ${item}`,
              { sourcePath, field: 'api', index: i, value: item }
            )
          );
        }
        validApis.push(item);
      } else {
        diagnostics.push(
          buildWarning(
            BUILD_WARNING_CODES.SECURITY_SIGNAL_MEDIUM,
            `API version at index ${i} is not a string`,
            { sourcePath, field: 'api', index: i, type: typeof item }
          )
        );
      }
    }
    return { diagnostics, api: validApis };
  }

  diagnostics.push(
    buildWarning(
      BUILD_WARNING_CODES.SECURITY_SIGNAL_MEDIUM,
      `API field must be string or array, got ${typeof api}`,
      { sourcePath, field: 'api', type: typeof api }
    )
  );

  return { diagnostics };
}

function validateAuthors(
  author: unknown,
  authors: unknown,
  sourcePath?: string
): { diagnostics: BuildDiagnostic[]; author?: string; authors?: string[] } {
  const diagnostics: BuildDiagnostic[] = [];
  let singleAuthor: string | undefined;
  let allAuthors: string[] | undefined;

  // Handle authors array
  if (Array.isArray(authors)) {
    allAuthors = [];
    for (const a of authors) {
      if (typeof a === 'string' && a.length > 0) {
        allAuthors.push(a);
      }
    }
    if (allAuthors.length === 0) {
      allAuthors = undefined;
    }
  }

  // Handle single author
  if (typeof author === 'string' && author.length > 0) {
    singleAuthor = author;
  }

  return { diagnostics, author: singleAuthor, authors: allAuthors };
}

/**
 * Validate commands - supports both object format (PocketMine) and array format.
 *
 * Object format (PocketMine standard):
 *   commands:
 *     test:
 *       description: Test command
 *       usage: /test
 *
 * Array format:
 *   commands:
 *     - name: test
 *       description: Test command
 */
function validateCommands(
  commands: unknown,
  sourcePath?: string
): { diagnostics: BuildDiagnostic[]; commands?: PluginCommand[] } {
  const diagnostics: BuildDiagnostic[] = [];
  const validCommands: PluginCommand[] = [];

  // Handle object format (PocketMine standard)
  if (typeof commands === 'object' && commands !== null && !Array.isArray(commands)) {
    const cmdMap = commands as Record<string, unknown>;
    for (const [cmdName, cmdData] of Object.entries(cmdMap)) {
      if (typeof cmdData === 'object' && cmdData !== null) {
        const cmdObj = cmdData as Record<string, unknown>;
        validCommands.push({
          name: cmdName,
          description: typeof cmdObj.description === 'string' ? String(cmdObj.description) : undefined,
          usage: typeof cmdObj.usage === 'string' ? String(cmdObj.usage) : undefined,
        });
      }
    }
    return { diagnostics, commands: validCommands.length > 0 ? validCommands : undefined };
  }

  // Handle array format
  if (Array.isArray(commands)) {
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      if (typeof cmd === 'object' && cmd !== null) {
        const cmdObj = cmd as Record<string, unknown>;
        if (typeof cmdObj.name === 'string') {
          validCommands.push({
            name: String(cmdObj.name),
            description: typeof cmdObj.description === 'string' ? String(cmdObj.description) : undefined,
            usage: typeof cmdObj.usage === 'string' ? String(cmdObj.usage) : undefined,
          });
        }
      }
    }
    return { diagnostics, commands: validCommands.length > 0 ? validCommands : undefined };
  }

  // Invalid format - warn but don't fail
  diagnostics.push(
    buildWarning(
      BUILD_WARNING_CODES.SECURITY_SIGNAL_MEDIUM,
      `Commands field must be an object or array, got ${typeof commands}`,
      { sourcePath, field: 'commands', type: typeof commands }
    )
  );

  return { diagnostics, commands: undefined };
}

/**
 * Validate permissions - supports both object format (PocketMine) and array format.
 *
 * Object format (PocketMine standard):
 *   permissions:
 *     permplugin.command:
 *       description: Allows command
 *       default: true
 */
function validatePermissions(
  permissions: unknown,
  sourcePath?: string
): { diagnostics: BuildDiagnostic[]; permissions?: PluginPermission[] } {
  const diagnostics: BuildDiagnostic[] = [];
  const validPermissions: PluginPermission[] = [];

  // Handle object format (PocketMine standard)
  if (typeof permissions === 'object' && permissions !== null && !Array.isArray(permissions)) {
    const permMap = permissions as Record<string, unknown>;
    for (const [permName, permData] of Object.entries(permMap)) {
      if (typeof permData === 'object' && permData !== null) {
        const permObj = permData as Record<string, unknown>;
        validPermissions.push({
          name: permName,
          description: typeof permObj.description === 'string' ? String(permObj.description) : undefined,
          defaultValue: typeof permObj.default === 'string' ? String(permObj.default) : undefined,
        });
      }
    }
    return { diagnostics, permissions: validPermissions.length > 0 ? validPermissions : undefined };
  }

  // Handle array format
  if (Array.isArray(permissions)) {
    for (let i = 0; i < permissions.length; i++) {
      const perm = permissions[i];
      if (typeof perm === 'object' && perm !== null) {
        const permObj = perm as Record<string, unknown>;
        if (typeof permObj.name === 'string') {
          validPermissions.push({
            name: String(permObj.name),
            description: typeof permObj.description === 'string' ? String(permObj.description) : undefined,
            defaultValue: typeof permObj.default === 'string' ? String(permObj.default) : undefined,
          });
        }
      }
    }
    return { diagnostics, permissions: validPermissions.length > 0 ? validPermissions : undefined };
  }

  // Invalid format - warn but don't fail
  diagnostics.push(
    buildWarning(
      BUILD_WARNING_CODES.SECURITY_SIGNAL_MEDIUM,
      `Permissions field must be an object or array, got ${typeof permissions}`,
      { sourcePath, field: 'permissions', type: typeof permissions }
    )
  );

  return { diagnostics, permissions: undefined };
}

// ============================================================
// Metadata Builder
// ============================================================

function buildMetadata(
  obj: Record<string, unknown>,
  validation: FieldValidationResult
): PluginMetadata {
  return {
    name: validation.name ?? String(obj.name ?? ''),
    version: validation.version ?? String(obj.version ?? ''),
    mainClass: validation.main ?? String(obj.main ?? ''),
    apiVersion: validation.api?.[0] ?? '',
    author: validation.authorValue,
    authors: validation.authorsValue,
    description: validation.description,
    website: validation.website,
    php: validation.php,
    commands: validation.commands,
    permissions: validation.permissions,
  };
}
