/**
 * Publication Domain Module
 *
 * Publishes Build artifacts to GitHub Releases.
 *
 * Architecture:
 * - PublicationProvider interface abstracts GitHub operations
 * - PublicationService orchestrates the publication process
 * - Independent from Registry, Build internal details
 *
 * Workflow:
 * 1. Accept BuildResult with artifacts and metadata
 * 2. Validate artifacts exist and are valid
 * 3. Create GitHub Release (draft or published)
 * 4. Upload PHAR, checksums.txt, metadata.json as assets
 * 5. Publish release (if not draft)
 * 6. Return PublicationResult with diagnostics
 */

// ============================================================
// Diagnostics
// ============================================================

export {
  PUBLICATION_CODES,
  PublicationDiagnosticSeverity,
  type PublicationDiagnostic,
  type PublicationDiagnosticCode,
  publicationError,
  publicationInfrastructureError,
  publicationWarning,
  publicationInfo,
  getPublicationErrors,
  getPublicationInfrastructureErrors,
  getPublicationWarnings,
  hasPublicationErrors,
  hasInfrastructureErrors,
} from './diagnostics.js';

// ============================================================
// Provider Interface
// ============================================================

export {
  PUBLICATION_PROVIDER_ERROR_CODES,
  type PublicationProvider,
  type PublicationProviderError,
  type PublicationProviderErrorCode,
  type Release,
  type ReleaseAsset,
  type CreateReleaseResult,
  type UploadAssetResult,
  type GetReleaseResult,
  type UpdateReleaseResult,
  type RepositoryIdentity,
  isRateLimitError,
  isRetryableError,
} from './provider.js';

// ============================================================
// Provider Implementations
// ============================================================

export {
  FakePublicationProvider,
  type FakePublicationProviderConfig,
} from './fake-provider.js';

export {
  GitHubPublicationProvider,
  type GitHubPublicationProviderConfig,
  createGitHubPublicationProvider,
} from './github-provider.js';

// ============================================================
// Publication Service
// ============================================================

export {
  PUBLICATION_SERVICE_LIMITS,
  type BuildMetadata,
  type BuildChecksumManifest,
  type BuildArtifacts,
  type PublishToReleaseRequest,
  type PublishToReleaseResult,
  publishToRelease,
} from './publication-service.js';

// ============================================================
// Legacy Local Publish (kept for compatibility)
// ============================================================

export {
  PUBLICATION_LIMITS,
  type PublicationRequest,
  type PublicationResult,
  computeSha256,
  publish,
} from './publication.js';
