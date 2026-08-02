/**
 * Publication Provider Interface
 *
 * Abstracts GitHub-specific release operations behind a provider boundary.
 * This allows Publication to remain independent from GitHub details
 * and enables testing with fake providers.
 *
 * Responsibilities:
 * - Create GitHub Releases
 * - Upload release assets
 * - Query release status
 * - Update release (e.g., publish from draft)
 */

// RepositoryIdentity: GitHub repository in owner/name format
export type RepositoryIdentity = string & { readonly brand: unique symbol };

// ============================================================
// Release Types
// ============================================================

/**
 * GitHub Release representation
 */
export interface Release {
  id: number;
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

/**
 * Release asset representation
 */
export interface ReleaseAsset {
  id: number;
  name: string;
  contentType: string;
  size: number;
  downloadCount: number;
  browserDownloadUrl: string;
}

/**
 * Result of creating a release
 */
export interface CreateReleaseResult {
  success: boolean;
  release?: Release;
  error?: PublicationProviderError;
}

/**
 * Result of uploading an asset
 */
export interface UploadAssetResult {
  success: boolean;
  asset?: ReleaseAsset;
  error?: PublicationProviderError;
}

/**
 * Result of getting a release by tag
 */
export interface GetReleaseResult {
  success: boolean;
  release?: Release | null;
  error?: PublicationProviderError;
}

/**
 * Result of updating a release
 */
export interface UpdateReleaseResult {
  success: boolean;
  release?: Release;
  error?: PublicationProviderError;
}

// ============================================================
// Error Types
// ============================================================

/**
 * Publication provider errors
 */
export interface PublicationProviderError {
  code: PublicationProviderErrorCode;
  message: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

/**
 * Error codes for publication providers
 */
export const PUBLICATION_PROVIDER_ERROR_CODES = {
  // Authentication/Authorization
  PROVIDER_AUTH_REQUIRED: 'PROVIDER_AUTH_REQUIRED',
  PROVIDER_AUTH_INVALID: 'PROVIDER_AUTH_INVALID',
  PROVIDER_PERMISSION_DENIED: 'PROVIDER_PERMISSION_DENIED',

  // Repository errors
  PROVIDER_REPOSITORY_NOT_FOUND: 'PROVIDER_REPOSITORY_NOT_FOUND',
  PROVIDER_REPOSITORY_ACCESS_DENIED: 'PROVIDER_REPOSITORY_ACCESS_DENIED',

  // Release errors
  PROVIDER_RELEASE_NOT_FOUND: 'PROVIDER_RELEASE_NOT_FOUND',
  PROVIDER_RELEASE_ALREADY_EXISTS: 'PROVIDER_RELEASE_ALREADY_EXISTS',
  PROVIDER_RELEASE_UPDATE_FAILED: 'PROVIDER_RELEASE_UPDATE_FAILED',
  PROVIDER_RELEASE_IMMUTABLE: 'PROVIDER_RELEASE_IMMUTABLE',

  // Asset errors
  PROVIDER_ASSET_UPLOAD_FAILED: 'PROVIDER_ASSET_UPLOAD_FAILED',
  PROVIDER_ASSET_TOO_LARGE: 'PROVIDER_ASSET_TOO_LARGE',

  // Network/infrastructure errors
  PROVIDER_NETWORK_ERROR: 'PROVIDER_NETWORK_ERROR',
  PROVIDER_RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',

  // General errors
  PROVIDER_INTERNAL_ERROR: 'PROVIDER_INTERNAL_ERROR',
  PROVIDER_VALIDATION_ERROR: 'PROVIDER_VALIDATION_ERROR',
} as const;

export type PublicationProviderErrorCode =
  (typeof PUBLICATION_PROVIDER_ERROR_CODES)[keyof typeof PUBLICATION_PROVIDER_ERROR_CODES];

// ============================================================
// Provider Interface
// ============================================================

/**
 * Publication Provider Interface
 *
 * Abstracts GitHub release operations. Implementations must be:
 * - Tested with FakePublicationProvider
 * - Used for real GitHub operations via GitHubPublicationProvider
 */
export interface PublicationProvider {
  /**
   * Check if the provider is configured for write operations
   */
  isWriteEnabled(): boolean;

  /**
   * Create a new release (draft by default)
   *
   * @param repository - Target repository (owner/name format)
   * @param tagName - Release tag (e.g., "v1.0.0")
   * @param name - Release name (e.g., "MyPlugin v1.0.0")
   * @param body - Release notes/body
   * @param draft - Whether to create as draft (default true)
   */
  createRelease(options: {
    repository: RepositoryIdentity;
    tagName: string;
    name: string;
    body: string;
    draft?: boolean;
  }): Promise<CreateReleaseResult>;

  /**
   * Upload a file as a release asset
   *
   * @param repository - Target repository
   * @param releaseId - Release ID
   * @param name - Asset filename
   * @param content - File content as Buffer
   * @param contentType - MIME type (e.g., "application/octet-stream")
   */
  uploadReleaseAsset(options: {
    repository: RepositoryIdentity;
    releaseId: number;
    name: string;
    content: Buffer;
    contentType?: string;
  }): Promise<UploadAssetResult>;

  /**
   * Get a release by tag
   *
   * @param repository - Target repository
   * @param tagName - Tag to look up
   */
  getReleaseByTag(options: {
    repository: RepositoryIdentity;
    tagName: string;
  }): Promise<GetReleaseResult>;

  /**
   * Update a release (e.g., publish from draft)
   *
   * @param repository - Target repository
   * @param releaseId - Release ID to update
   * @param draft - Set to false to publish
   */
  updateRelease(options: {
    repository: RepositoryIdentity;
    releaseId: number;
    draft?: boolean;
  }): Promise<UpdateReleaseResult>;

  /**
   * Close provider and cleanup resources
   */
  close(): void;
}

// ============================================================
// Provider Error Helpers
// ============================================================

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: PublicationProviderError): boolean {
  return (
    error.code === PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_RATE_LIMITED ||
    error.statusCode === 403
  );
}

/**
 * Check if error is a retryable network error
 */
export function isRetryableError(error: PublicationProviderError): boolean {
  return (
    error.code === PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_NETWORK_ERROR ||
    error.code === PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_TIMEOUT ||
    error.code === PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_RATE_LIMITED
  );
}
