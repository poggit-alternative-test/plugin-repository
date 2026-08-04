/**
 * Registry Domain Types
 *
 * Defines the core domain model for the Axolotl Plugin Registry.
 *
 * Design decisions:
 * - Discriminated unions for version status to make invalid states unrepresentable
 * - Separate types for plugin identity vs version records
 * - Explicit SHA types for type safety
 */
/** 40-character Git SHA-1 commit identifier */
export type GitSha = string & {
    readonly brand: unique symbol;
};
/** SHA-256 hexadecimal checksum */
export type Sha256 = string & {
    readonly brand: unique symbol;
};
/** Semantic version string (SemVer 2.0.0) */
export type SemVer = string & {
    readonly brand: unique symbol;
};
/** Stable plugin identifier */
export type PluginId = string & {
    readonly brand: unique symbol;
};
/** GitHub repository in owner/name format */
export type RepositoryIdentity = string & {
    readonly brand: unique symbol;
};
/** Upstream repository reference from developer */
export interface UpstreamRef {
    repository: RepositoryIdentity;
    branch: string;
}
/** Storage repository reference (populated after materialization) */
export interface StorageRef {
    repository: string;
}
/**
 * Plugin Identity
 *
 * Represents the stable identity of a plugin in the registry.
 * Created from developer submission, enriched after materialization.
 */
export interface PluginIdentity {
    schemaVersion: 1;
    id: PluginId;
    upstream: UpstreamRef;
    storage?: StorageRef;
}
/** Source reference for a version */
export interface SourceRef {
    upstreamCommit: GitSha;
}
/** Review metadata for a version */
export interface ReviewRef {
    pullRequest: number;
    reviewer: string;
    approvedAt: string;
}
/** Storage reference for a version */
export interface VersionStorageRef {
    repository: string;
    commit: GitSha;
}
/** Artifact reference for a published version */
export interface ArtifactRef {
    releaseTag: string;
    file: string;
    sha256: Sha256;
    publishedAt: string;
    provenance?: ProvenanceRef;
}
/**
 * Provenance reference schema
 *
 * Indicates the provenance mechanism used for this artifact.
 * The actual provenance document is stored by the provider (e.g., GitHub),
 * not duplicated in the Registry.
 */
export interface ProvenanceRef {
    type: ProvenanceType;
}
/**
 * Supported provenance mechanism types
 *
 * Design allows adding new types without schema redesign:
 * - github-attestation: GitHub Artifact Attestations
 * - gitlab-attestation: GitLab attestations (future)
 * - self-attestation: Manual attestation (future)
 * - reproducible-build: Reproducible build verification (future)
 */
export type ProvenanceType = 'github-attestation';
/**
 * Approved version - reviewed but not yet materialized
 */
export interface ApprovedVersion {
    readonly status: 'approved';
    readonly schemaVersion: 1;
    readonly version: SemVer;
    readonly source: SourceRef;
    readonly review: ReviewRef;
}
/**
 * Materialized version - source preserved in storage
 */
export interface MaterializedVersion {
    readonly status: 'materialized';
    readonly schemaVersion: 1;
    readonly version: SemVer;
    readonly source: SourceRef;
    readonly storage: VersionStorageRef;
    readonly review: ReviewRef;
}
/**
 * Published version - release created
 */
export interface PublishedVersion {
    readonly status: 'published';
    readonly schemaVersion: 1;
    readonly version: SemVer;
    readonly source: SourceRef;
    readonly storage: VersionStorageRef;
    readonly review: ReviewRef;
    readonly artifact: ArtifactRef;
}
/**
 * Deprecated version - no longer recommended
 */
export interface DeprecatedVersion {
    readonly status: 'deprecated';
    readonly schemaVersion: 1;
    readonly version: SemVer;
    readonly source: SourceRef;
    readonly storage: VersionStorageRef;
    readonly review: ReviewRef;
    readonly artifact: ArtifactRef;
}
/**
 * Revoked version - security concern identified
 */
export interface RevokedVersion {
    readonly status: 'revoked';
    readonly schemaVersion: 1;
    readonly version: SemVer;
    readonly source: SourceRef;
    readonly storage: VersionStorageRef;
    readonly review: ReviewRef;
    readonly artifact: ArtifactRef;
    readonly revokedAt: string;
    readonly reason?: string;
}
/**
 * Removed version - removed from public discovery
 */
export interface RemovedVersion {
    readonly status: 'removed';
    readonly schemaVersion: 1;
    readonly version: SemVer;
    readonly removedAt: string;
    readonly reason?: string;
    readonly source: SourceRef;
    readonly storage: VersionStorageRef;
    readonly review: ReviewRef;
    readonly artifact: ArtifactRef;
}
/**
 * Discriminated union of all version states
 */
export type VersionRecord = ApprovedVersion | MaterializedVersion | PublishedVersion | DeprecatedVersion | RevokedVersion | RemovedVersion;
/** A single plugin with its version history */
export interface Plugin {
    identity: PluginIdentity;
    versions: VersionRecord[];
}
/** The complete registry */
export interface Registry {
    plugins: Plugin[];
}
export declare function isApprovedVersion(v: VersionRecord): v is ApprovedVersion;
export declare function isMaterializedVersion(v: VersionRecord): v is MaterializedVersion;
export declare function isPublishedVersion(v: VersionRecord): v is PublishedVersion;
export declare function isDeprecatedVersion(v: VersionRecord): v is DeprecatedVersion;
export declare function isRevokedVersion(v: VersionRecord): v is RevokedVersion;
export declare function isRemovedVersion(v: VersionRecord): v is RemovedVersion;
export declare function isMutableVersion(v: VersionRecord): boolean;
/**
 * Check if version has immutable published provenance.
 * Includes versions that have completed the publication lifecycle.
 * Note: 'removed' versions are NOT immutable in the publication sense
 * (they're removed from discovery) but they DO preserve provenance
 * for audit purposes. Use hasPreservedProvenance() to include removed.
 */
export declare function hasPublishedProvenance(v: VersionRecord): boolean;
/**
 * Check if version has preserved provenance for audit.
 * All versions except 'approved' have some form of preserved provenance.
 * Even 'removed' versions preserve their provenance for audit.
 */
export declare function hasPreservedProvenance(v: VersionRecord): boolean;
/**
 * Status transition validity
 *
 * Canonical lifecycle transitions:
 * - approved -> materialized (source preserved in storage)
 * - materialized -> published (release created)
 * - published -> deprecated / revoked (lifecycle changes)
 * - deprecated -> revoked / removed
 * - revoked -> removed
 */
export declare const VALID_TRANSITIONS: Record<VersionRecord['status'], VersionRecord['status'][]>;
export declare function canTransition(from: VersionRecord['status'], to: VersionRecord['status']): boolean;
//# sourceMappingURL=types.d.ts.map