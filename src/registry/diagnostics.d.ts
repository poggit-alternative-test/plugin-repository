/**
 * Validation Diagnostics
 *
 * Structured error reporting for registry validation.
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';
/**
 * A single diagnostic message
 */
export interface Diagnostic {
    severity: DiagnosticSeverity;
    code: string;
    file: string;
    path?: string;
    message: string;
}
/**
 * Collection of diagnostics with summary
 */
export interface ValidationDiagnostics {
    diagnostics: Diagnostic[];
    errorCount: number;
    warningCount: number;
    infoCount: number;
}
/**
 * Diagnostic codes
 *
 * Stable identifiers for each error type.
 * Used by CI for annotation.
 */
export declare const DiagnosticCode: {
    readonly UNSUPPORTED_SCHEMA_VERSION: "UNSUPPORTED_SCHEMA_VERSION";
    readonly MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD";
    readonly INVALID_FIELD_TYPE: "INVALID_FIELD_TYPE";
    readonly INVALID_PLUGIN_ID: "INVALID_PLUGIN_ID";
    readonly PLUGIN_ID_DIR_MISMATCH: "PLUGIN_ID_DIR_MISMATCH";
    readonly INVALID_REPOSITORY_IDENTITY: "INVALID_REPOSITORY_IDENTITY";
    readonly REPOSITORY_IS_URL: "REPOSITORY_IS_URL";
    readonly INVALID_BRANCH: "INVALID_BRANCH";
    readonly DUPLICATE_PLUGIN_ID: "DUPLICATE_PLUGIN_ID";
    readonly DUPLICATE_UPSTREAM: "DUPLICATE_UPSTREAM";
    readonly INVALID_VERSION: "INVALID_VERSION";
    readonly VERSION_FILENAME_MISMATCH: "VERSION_FILENAME_MISMATCH";
    readonly INVALID_UPSTREAM_COMMIT: "INVALID_UPSTREAM_COMMIT";
    readonly SHORT_SHA: "SHORT_SHA";
    readonly COMMIT_AS_BRANCH: "COMMIT_AS_BRANCH";
    readonly INVALID_REVIEWER: "INVALID_REVIEWER";
    readonly INVALID_TIMESTAMP: "INVALID_TIMESTAMP";
    readonly INVALID_PR_NUMBER: "INVALID_PR_NUMBER";
    readonly MISSING_STORAGE_COMMIT: "MISSING_STORAGE_COMMIT";
    readonly MISSING_ARTIFACT: "MISSING_ARTIFACT";
    readonly INVALID_ARTIFACT_SHA256: "INVALID_ARTIFACT_SHA256";
    readonly INVALID_STORAGE_COMMIT: "INVALID_STORAGE_COMMIT";
    readonly STORAGE_REPO_MISMATCH: "STORAGE_REPO_MISMATCH";
    readonly PUBLISHED_WITHOUT_ARTIFACT: "PUBLISHED_WITHOUT_ARTIFACT";
    readonly DUPLICATE_VERSION: "DUPLICATE_VERSION";
    readonly DUPLICATE_STORAGE_REPO: "DUPLICATE_STORAGE_REPO";
    readonly STORAGE_REPO_CONFLICT: "STORAGE_REPO_CONFLICT";
    readonly FILE_NOT_FOUND: "FILE_NOT_FOUND";
    readonly MALFORMED_YAML: "MALFORMED_YAML";
    readonly YAML_PARSING_ERROR: "YAML_PARSING_ERROR";
    readonly DUPLICATE_YAML_KEY: "DUPLICATE_YAML_KEY";
    readonly PROVENANCE_MUTATED: "PROVENANCE_MUTATED";
};
export type DiagnosticCodeType = (typeof DiagnosticCode)[keyof typeof DiagnosticCode];
/**
 * Create a diagnostic
 */
export declare function createDiagnostic(code: DiagnosticCodeType, severity: DiagnosticSeverity, file: string, message: string, path?: string): Diagnostic;
/**
 * Create an error diagnostic
 */
export declare function error(code: DiagnosticCodeType, file: string, message: string, path?: string): Diagnostic;
/**
 * Create a warning diagnostic
 */
export declare function warning(code: DiagnosticCodeType, file: string, message: string, path?: string): Diagnostic;
/**
 * Create an info diagnostic
 */
export declare function info(code: DiagnosticCodeType, file: string, message: string, path?: string): Diagnostic;
/**
 * Aggregate diagnostics
 */
export declare function aggregateDiagnostics(diagnostics: Diagnostic[]): ValidationDiagnostics;
/**
 * Format diagnostics for CLI output
 */
export declare function formatDiagnostics(diagnostics: ValidationDiagnostics): string;
//# sourceMappingURL=diagnostics.d.ts.map