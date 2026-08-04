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
// ============================================================
// Type Guards
// ============================================================
export function isApprovedVersion(v) {
    return v.status === 'approved';
}
export function isMaterializedVersion(v) {
    return v.status === 'materialized';
}
export function isPublishedVersion(v) {
    return v.status === 'published';
}
export function isDeprecatedVersion(v) {
    return v.status === 'deprecated';
}
export function isRevokedVersion(v) {
    return v.status === 'revoked';
}
export function isRemovedVersion(v) {
    return v.status === 'removed';
}
export function isMutableVersion(v) {
    return v.status === 'approved' || v.status === 'materialized';
}
/**
 * Check if version has immutable published provenance.
 * Includes versions that have completed the publication lifecycle.
 * Note: 'removed' versions are NOT immutable in the publication sense
 * (they're removed from discovery) but they DO preserve provenance
 * for audit purposes. Use hasPreservedProvenance() to include removed.
 */
export function hasPublishedProvenance(v) {
    return isPublishedVersion(v) || isDeprecatedVersion(v) || isRevokedVersion(v);
}
/**
 * Check if version has preserved provenance for audit.
 * All versions except 'approved' have some form of preserved provenance.
 * Even 'removed' versions preserve their provenance for audit.
 */
export function hasPreservedProvenance(v) {
    return v.status !== 'approved';
}
// ============================================================
// Invariants
// ============================================================
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
export const VALID_TRANSITIONS = {
    approved: ['materialized'],
    materialized: ['published'],
    published: ['deprecated', 'revoked'],
    deprecated: ['revoked', 'removed'],
    revoked: ['removed'],
    removed: [],
};
export function canTransition(from, to) {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
//# sourceMappingURL=types.js.map