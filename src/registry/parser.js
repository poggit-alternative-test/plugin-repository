/**
 * Registry Parser
 *
 * Parses YAML files into typed JavaScript objects.
 * Handles security considerations for untrusted input.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import YAML from 'yaml';
import { error } from './diagnostics.js';
import { PluginIdentitySchema, VersionRecordSchema, } from './schema.js';
// ============================================================
// YAML Parsing with Security
// ============================================================
/** Maximum file size for YAML files (1MB) */
const MAX_FILE_SIZE = 1024 * 1024;
/**
 * Safely parse YAML with security considerations
 *
 * Security measures:
 * - File size limit (1MB max)
 * - Core schema only (no custom types)
 * - No merge keys
 * - No custom tags
 * - Clear error messages
 */
export function safeParseYaml(content, filePath) {
    // File size check
    if (content.length > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${filePath} (max ${MAX_FILE_SIZE} bytes)`);
    }
    try {
        const result = YAML.parse(content, {
            // Prevent arbitrary code execution
            // YAML.parse doesn't execute by default, but we document the intent
            schema: 'core', // Use core schema only
            merge: false, // Disable merge keys
            customTags: [], // No custom tags
        });
        return result;
    }
    catch (e) {
        if (e instanceof Error) {
            throw new Error(`YAML parsing error in ${filePath}: ${e.message}`);
        }
        throw new Error(`YAML parsing error in ${filePath}: ${String(e)}`);
    }
}
// ============================================================
// Parser Functions
// ============================================================
/**
 * Parse a plugin identity file
 */
export function parsePluginIdentity(filePath, content) {
    const diagnostics = [];
    let parsed;
    try {
        parsed = safeParseYaml(content, filePath);
    }
    catch (e) {
        diagnostics.push(error('MALFORMED_YAML', filePath, e instanceof Error ? e.message : 'Unknown parsing error'));
        return { identity: null, diagnostics };
    }
    // Check for required schema_version
    const parsedRecord = parsed;
    if (parsedRecord.schema_version === undefined) {
        diagnostics.push(error('MISSING_REQUIRED_FIELD', filePath, 'schema_version is required', 'schema_version'));
        return { identity: null, diagnostics };
    }
    // Validate schema
    const result = PluginIdentitySchema.safeParse(parsed);
    if (!result.success) {
        for (const issue of result.error.issues) {
            const path = issue.path.join('.');
            // Map schema validation errors to specific codes when possible
            if (path === 'id') {
                diagnostics.push(error('INVALID_PLUGIN_ID', filePath, issue.message, path || undefined));
            }
            else if (path === 'upstream.repository') {
                diagnostics.push(error('INVALID_REPOSITORY_IDENTITY', filePath, issue.message, path || undefined));
            }
            else if (path === 'upstream.branch') {
                diagnostics.push(error('INVALID_BRANCH', filePath, issue.message, path || undefined));
            }
            else {
                diagnostics.push(error('INVALID_FIELD_TYPE', filePath, `${path ? path + ': ' : ''}${issue.message}`, path || undefined));
            }
        }
        return { identity: null, diagnostics };
    }
    // Cast to typed identity
    const identity = {
        schemaVersion: result.data.schema_version,
        id: result.data.id,
        upstream: {
            repository: result.data.upstream.repository,
            branch: result.data.upstream.branch,
        },
        storage: result.data.storage
            ? {
                repository: result.data.storage.repository,
            }
            : undefined,
    };
    return { identity, diagnostics };
}
/**
 * Parse a version record file
 */
export function parseVersionRecord(filePath, content) {
    const diagnostics = [];
    let parsed;
    try {
        parsed = safeParseYaml(content, filePath);
    }
    catch (e) {
        diagnostics.push(error('MALFORMED_YAML', filePath, e instanceof Error ? e.message : 'Unknown parsing error'));
        return { version: null, diagnostics };
    }
    // Check for required schema_version
    const parsedRecord = parsed;
    if (parsedRecord.schema_version === undefined) {
        diagnostics.push(error('MISSING_REQUIRED_FIELD', filePath, 'schema_version is required', 'schema_version'));
        return { version: null, diagnostics };
    }
    // Validate schema
    const result = VersionRecordSchema.safeParse(parsed);
    if (!result.success) {
        for (const issue of result.error.issues) {
            const path = issue.path.join('.');
            // Map schema validation errors to specific codes when possible
            if (path === 'version') {
                diagnostics.push(error('INVALID_VERSION', filePath, issue.message, path || undefined));
            }
            else if (path === 'source.upstream_commit') {
                diagnostics.push(error('INVALID_UPSTREAM_COMMIT', filePath, issue.message, path || undefined));
            }
            else if (path === 'artifact.sha256') {
                diagnostics.push(error('INVALID_ARTIFACT_SHA256', filePath, issue.message, path || undefined));
            }
            else if (path === 'schema_version') {
                diagnostics.push(error('UNSUPPORTED_SCHEMA_VERSION', filePath, issue.message, path || undefined));
            }
            else {
                diagnostics.push(error('INVALID_FIELD_TYPE', filePath, `${path ? path + ': ' : ''}${issue.message}`, path || undefined));
            }
        }
        return { version: null, diagnostics };
    }
    // Cast to typed version record (Zod validated this)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const version = result.data;
    return { version, diagnostics };
}
// ============================================================
// File System Operations
// ============================================================
/**
 * Read and parse a plugin identity file
 */
export function loadPluginIdentity(pluginDir) {
    const filePath = join(pluginDir, 'plugin.yaml');
    try {
        const stat = statSync(filePath);
        if (!stat.isFile()) {
            return {
                identity: null,
                diagnostics: [error('FILE_NOT_FOUND', filePath, 'plugin.yaml is not a file')],
            };
        }
    }
    catch {
        return {
            identity: null,
            diagnostics: [error('FILE_NOT_FOUND', filePath, 'plugin.yaml does not exist')],
        };
    }
    try {
        const content = readFileSync(filePath, 'utf-8');
        return parsePluginIdentity(filePath, content);
    }
    catch (e) {
        return {
            identity: null,
            diagnostics: [
                error('YAML_PARSING_ERROR', filePath, e instanceof Error ? e.message : 'Failed to read file'),
            ],
        };
    }
}
/**
 * Load all version records for a plugin
 */
export function loadVersionRecords(versionsDir) {
    const versions = [];
    const diagnostics = [];
    let entries;
    try {
        entries = readdirSync(versionsDir);
    }
    catch {
        return { versions: [], diagnostics: [] };
    }
    for (const entry of entries) {
        if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) {
            continue;
        }
        const filePath = join(versionsDir, entry);
        try {
            const stat = statSync(filePath);
            if (!stat.isFile())
                continue;
        }
        catch {
            continue;
        }
        try {
            const content = readFileSync(filePath, 'utf-8');
            const { version, diagnostics: fileDiagnostics } = parseVersionRecord(filePath, content);
            diagnostics.push(...fileDiagnostics);
            if (version) {
                versions.push(version);
            }
        }
        catch {
            diagnostics.push(error('YAML_PARSING_ERROR', filePath, 'Failed to read version file'));
        }
    }
    return { versions, diagnostics };
}
/**
 * Load the complete registry from a directory
 */
export function loadRegistry(registryRoot) {
    const plugins = [];
    const allDiagnostics = [];
    let pluginDirs;
    try {
        const pluginsDir = join(registryRoot, 'plugins');
        pluginDirs = readdirSync(pluginsDir);
    }
    catch {
        return { plugins: [], diagnostics: [] };
    }
    for (const dir of pluginDirs) {
        const pluginDir = join(registryRoot, 'plugins', dir);
        try {
            const stat = statSync(pluginDir);
            if (!stat.isDirectory())
                continue;
        }
        catch {
            continue;
        }
        const { identity, diagnostics: identityDiagnostics } = loadPluginIdentity(pluginDir);
        allDiagnostics.push(...identityDiagnostics);
        if (!identity)
            continue;
        const versionsDir = join(pluginDir, 'versions');
        const { versions, diagnostics: versionDiagnostics } = loadVersionRecords(versionsDir);
        allDiagnostics.push(...versionDiagnostics);
        plugins.push({ identity, versions });
    }
    return { plugins, diagnostics: allDiagnostics };
}
/**
 * Get the plugin ID from a directory path
 */
export function getPluginIdFromDir(pluginDir) {
    return basename(pluginDir);
}
/**
 * Get the version from a version file path
 */
export function getVersionFromFile(filePath) {
    return basename(filePath, '.yaml').replace(/\.yml$/, '');
}
//# sourceMappingURL=parser.js.map