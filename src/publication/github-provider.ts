/**
 * GitHub Publication Provider
 *
 * Real GitHub implementation of PublicationProvider.
 * Uses GitHub REST API for release operations.
 *
 * This provider is used in production environments.
 */

import type {
  PublicationProvider,
  Release,
  ReleaseAsset,
  CreateReleaseResult,
  UploadAssetResult,
  GetReleaseResult,
  UpdateReleaseResult,
  PublicationProviderError,
  PublicationProviderErrorCode,
  RepositoryIdentity,
} from './provider.js';
import { PUBLICATION_PROVIDER_ERROR_CODES } from './provider.js';

// ============================================================
// Configuration
// ============================================================

/**
 * Configuration for GitHubPublicationProvider
 */
export interface GitHubPublicationProviderConfig {
  /**
   * GitHub API token
   * Can be a GitHub App installation token or a Personal Access Token
   * Required for all operations
   */
  token: string;

  /**
   * GitHub API base URL
   * Defaults to https://api.github.com
   * Can be overridden for GitHub Enterprise
   */
  apiBaseUrl?: string;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Maximum retries for rate-limited requests
   */
  maxRetries?: number;
}

// ============================================================
// HTTP Client Helper
// ============================================================

interface HttpResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: PublicationProviderError | null;
}

class GitHubHttpClient {
  private token: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: GitHubPublicationProviderConfig) {
    this.token = config.token;
    this.baseUrl = config.apiBaseUrl ?? 'https://api.github.com';
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  private makeError(code: PublicationProviderErrorCode, message: string, status?: number): PublicationProviderError {
    return { code, message, statusCode: status };
  }

  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: Record<string, unknown>;
      query?: Record<string, string>;
      headers?: Record<string, string>;
    }
  ): Promise<HttpResponse<T>> {
    const url = new URL(path, this.baseUrl);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options?.headers,
    };

    let body: string | undefined;
    if (options?.body) {
      body = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }

    let lastError: PublicationProviderError | null = null;
    let retryCount = 0;

    while (retryCount <= this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url.toString(), {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json().catch(() => null);

        if (response.status === 401) {
          return {
            ok: false,
            status: response.status,
            data: null,
            error: this.makeError(
              PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_AUTH_INVALID,
              'Invalid or expired authentication token',
              response.status
            ),
          };
        }

        if (response.status === 403) {
          if (response.headers.get('X-RateLimit-Remaining') === '0') {
            return {
              ok: false,
              status: response.status,
              data: null,
              error: this.makeError(
                PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_RATE_LIMITED,
                'GitHub API rate limit exceeded',
                response.status
              ),
            };
          }
          return {
            ok: false,
            status: response.status,
            data: null,
            error: this.makeError(
              PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_PERMISSION_DENIED,
              'Insufficient permissions for this operation',
              response.status
            ),
          };
        }

        if (response.status === 404) {
          return {
            ok: false,
            status: response.status,
            data: null,
            error: this.makeError(
              PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_REPOSITORY_NOT_FOUND,
              `Repository not found or inaccessible: ${path}`,
              response.status
            ),
          };
        }

        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            data: data as T | null,
            error: this.makeError(
              PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_INTERNAL_ERROR,
              `GitHub API error: ${response.status} - ${JSON.stringify(data)}`,
              response.status
            ),
          };
        }

        return {
          ok: true,
          status: response.status,
          data: data as T,
          error: null,
        };
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          retryCount++;
          if (retryCount <= this.maxRetries) {
            // Exponential backoff
            await new Promise((r) => setTimeout(r, Math.pow(2, retryCount) * 100));
            continue;
          }
          lastError = this.makeError(
            PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_TIMEOUT,
            `Request timed out after ${this.timeout}ms`
          );
        } else {
          lastError = this.makeError(
            PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_NETWORK_ERROR,
            `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }
    }

    return {
      ok: false,
      status: 0,
      data: null,
      error: lastError,
    };
  }
}

// ============================================================
// GitHub API Types
// ============================================================

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface GitHubAsset {
  id: number;
  name: string;
  content_type: string;
  size: number;
  download_count: number;
  browser_download_url: string;
}

// ============================================================
// Provider Implementation
// ============================================================

/**
 * GitHub Publication Provider
 *
 * Implements PublicationProvider using GitHub REST API.
 *
 * Permissions required:
 * - contents: read (for verifying repository access)
 * - releases: write (for creating and updating releases)
 *
 * Note: Token type matters:
 * - GitHub App installation token: scoped to specific repos
 * - Personal Access Token: scoped to user's accessible repos
 */
export class GitHubPublicationProvider implements PublicationProvider {
  private http: GitHubHttpClient;
  private token: string;

  constructor(config: GitHubPublicationProviderConfig) {
    this.token = config.token;
    this.http = new GitHubHttpClient(config);
  }

  isWriteEnabled(): boolean {
    // Token presence implies write capability
    // In production, verify token has releases:write scope
    return !!this.token;
  }

  async createRelease(options: {
    repository: RepositoryIdentity;
    tagName: string;
    name: string;
    body: string;
    draft?: boolean;
  }): Promise<CreateReleaseResult> {
    const path = `/repos/${options.repository}/releases`;

    const response = await this.http.request<GitHubRelease>('POST', path, {
      body: {
        tag_name: options.tagName,
        name: options.name,
        body: options.body,
        draft: options.draft ?? true,
      },
    });

    if (!response.ok) {
      if (response.error?.code === PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_RELEASE_ALREADY_EXISTS) {
        return response as unknown as CreateReleaseResult;
      }
      return {
        success: false,
        error: response.error ?? {
          code: PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_INTERNAL_ERROR,
          message: 'Unknown error creating release',
        },
      };
    }

    return {
      success: true,
      release: this.toRelease(response.data!),
    };
  }

  async uploadReleaseAsset(options: {
    repository: RepositoryIdentity;
    releaseId: number;
    name: string;
    content: Buffer;
    contentType?: string;
  }): Promise<UploadAssetResult> {
    // GitHub requires multipart upload for release assets
    const path = `/repos/${options.repository}/releases/${options.releaseId}/assets`;

    // Create multipart form data
    const boundary = `----GitHubBoundary${Date.now()}`;
    const parts: string[] = [];

    // Add the name field
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${options.name}`);

    // Add the file
    const contentBase64 = options.content.toString('base64');
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${options.name}"\r\nContent-Type: ${options.contentType ?? 'application/octet-stream'}\r\n\r\n${contentBase64}`
    );

    parts.push(`--${boundary}--`);

    const body = parts.join('\r\n');

    const headers: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };

    // Note: GitHub requires upload to a different endpoint
    const uploadUrl = `https://uploads.github.com/repos/${options.repository}/releases/${options.releaseId}/assets?name=${encodeURIComponent(options.name)}`;

    // Use fetch directly for binary upload
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': `${options.contentType ?? 'application/octet-stream'}`,
        'Content-Length': options.content.length.toString(),
      },
      body: options.content,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: {
          code: PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_ASSET_UPLOAD_FAILED,
          message: `Asset upload failed: ${response.status} - ${errorText}`,
          statusCode: response.status,
        },
      };
    }

    const assetData = await response.json() as GitHubAsset;

    return {
      success: true,
      asset: this.toAsset(assetData),
    };
  }

  async getReleaseByTag(options: {
    repository: RepositoryIdentity;
    tagName: string;
  }): Promise<GetReleaseResult> {
    const path = `/repos/${options.repository}/releases/tags/${options.tagName}`;

    const response = await this.http.request<GitHubRelease>('GET', path);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: true,
          release: null,
        };
      }
      return {
        success: false,
        error: response.error ?? {
          code: PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_INTERNAL_ERROR,
          message: 'Unknown error getting release',
        },
      };
    }

    return {
      success: true,
      release: this.toRelease(response.data!),
    };
  }

  async updateRelease(options: {
    repository: RepositoryIdentity;
    releaseId: number;
    draft?: boolean;
  }): Promise<UpdateReleaseResult> {
    const path = `/repos/${options.repository}/releases/${options.releaseId}`;

    const body: Record<string, unknown> = {};
    if (options.draft !== undefined) {
      body.draft = options.draft;
    }

    const response = await this.http.request<GitHubRelease>('PATCH', path, { body });

    if (!response.ok) {
      return {
        success: false,
        error: response.error ?? {
          code: PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_RELEASE_UPDATE_FAILED,
          message: 'Unknown error updating release',
        },
      };
    }

    return {
      success: true,
      release: this.toRelease(response.data!),
    };
  }

  close(): void {
    // No-op for HTTP client
  }

  // ============================================================
  // Conversion Helpers
  // ============================================================

  private toRelease(r: GitHubRelease): Release {
    return {
      id: r.id,
      tagName: r.tag_name,
      name: r.name ?? r.tag_name,
      body: r.body ?? '',
      draft: r.draft,
      prerelease: r.prerelease,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      htmlUrl: r.html_url,
    };
  }

  private toAsset(a: GitHubAsset): ReleaseAsset {
    return {
      id: a.id,
      name: a.name,
      contentType: a.content_type,
      size: a.size,
      downloadCount: a.download_count,
      browserDownloadUrl: a.browser_download_url,
    };
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * Create a GitHub Publication Provider from environment variables
 *
 * Looks for:
 * - GITHUB_TOKEN (primary)
 * - GH_TOKEN (fallback)
 */
export function createGitHubPublicationProvider(
  options?: Partial<Omit<GitHubPublicationProviderConfig, 'token'>>
): GitHubPublicationProvider | null {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;

  if (!token) {
    return null;
  }

  return new GitHubPublicationProvider({
    token,
    ...options,
  });
}
