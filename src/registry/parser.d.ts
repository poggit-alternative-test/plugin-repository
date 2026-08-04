/**
 * Registry Parser
 *
 * Parses YAML files into typed JavaScript objects.
 * Handles security considerations for untrusted input.
 */
import { Diagnostic } from './diagnostics.js';
import type { PluginIdentity, VersionRecord, Plugin } from './types.js';
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
export declare function safeParseYaml(content: string, filePath: string): unknown;
/**
 * Parse a plugin identity file
 */
export declare function parsePluginIdentity(filePath: string, content: string): {
    identity: PluginIdentity;
    diagnostics: Diagnostic[];
};
/**
 * Parse a version record file
 */
export declare function parseVersionRecord(filePath: string, content: string): {
    version: VersionRecord;
    diagnostics: Diagnostic[];
};
/**
 * Read and parse a plugin identity file
 */
export declare function loadPluginIdentity(pluginDir: string): {
    identity: PluginIdentity | null;
    diagnostics: Diagnostic[];
};
/**
 * Load all version records for a plugin
 */
export declare function loadVersionRecords(versionsDir: string): {
    versions: VersionRecord[];
    diagnostics: Diagnostic[];
};
/**
 * Load the complete registry from a directory
 */
export declare function loadRegistry(registryRoot: string): {
    plugins: Plugin[];
    diagnostics: Diagnostic[];
};
/**
 * Get the plugin ID from a directory path
 */
export declare function getPluginIdFromDir(pluginDir: string): string;
/**
 * Get the version from a version file path
 */
export declare function getVersionFromFile(filePath: string): string;
//# sourceMappingURL=parser.d.ts.map