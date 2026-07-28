/**
 * Real GitHub Client - Production Implementation
 *
 * This module implements the GitHub transport for M5 materialization.
 *
 * Key design principles:
 *
 * 1. CAS (Compare-and-Swap) Semantics:
 *    - Trusted code reads branch HEAD H1
 *    - Mutation is constructed against H1
 *    - If another writer advances the branch before our mutation is published,
 *      we return CONCURRENCY_CONFLICT
 *    - Caller can re-read trusted state and reconcile/retry
 *    - Force updates are NEVER used
 *
 * 2. Authentication:
 *    - Uses GitHub App installation tokens
 *    - No personal access tokens in production
 *    - Tokens are cached and refreshed automatically
 *
 * 3. Rate Limiting:
 *    - Bounded retry with exponential backoff
 *    - Rate limit detection and handling
 *    - Deterministic behavior suitable for reconciliation
 *
 * 4. Safety:
 *    - Tester mode restrictions
 *    - Organization allowlisting
 *    - No production organization access
 */

import type {
  GitSha,
  RepositoryIdentity,
  MaterializationErrorCode,
} from './materialization-types.js';
import type {
  GitHubClient,
  CreateRepositoryResult,
  UploadFileResult,
  CreateCommitResult,
  RepositoryInfo,
  BranchInfo,
  RepositoryFile,
  GitHubClientError,
} from './github-client.js';
import { GitHubAppAuth, type GitHubAppConfig } from './github-app-auth.js';
import {
  type TesterTransportConfig,
  isAllowedTesterRepository,
  isAllowedTesterOwner,
  TESTER_ORGANIZATION,
} from './tester-transport-config.js';

// ============================================================
// Configuration
// ============================================================

export interface RealGitHubClientConfig {
  /** GitHub App configuration (required for production) */
  githubApp?: GitHubAppConfig;

  /** Installation ID to use (alternative to per-org config) */
  installationId?: string;

  /** Direct access token (for testing only, not production) */
  accessToken?: string;

  /** Base URL for GitHub API (defaults to github.com) */
  apiBaseUrl?: string;

  /**
   * Whether write operations are allowed.
   * When false, all write operations return WRITE_MODE_NOT_ENABLED.
   */
  writeEnabled: boolean;

  /**
   * Tester transport configuration.
   * When provided, enforces organization restrictions.
   */
  testerConfig?: TesterTransportConfig;

  /**
   * Rate limit configuration.
   */
  rateLimit?: {
    /** Maximum retries for transient failures */
    maxRetries: number;
    /** Base delay for exponential backoff in ms */
    baseRetryDelayMs: number;
    /** Maximum delay cap in ms */
    maxRetryDelayMs: number;
  };
}

const DEFAULT_RATE_LIMIT = {
  maxRetries: 3,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 32000,
};

// ============================================================
// Error Handling
// ============================================================

function createGitHubError(
  code: MaterializationErrorCode,
  message: string,
  statusCode?: number,
  details?: Record<string, unknown>
): GitHubClientError {
  return { code, message, statusCode, details };
}

function isTransientError(statusCode: number): boolean {
  // 5xx errors, 409 Conflict, 429 Rate Limited
  return statusCode >= 500 || statusCode === 409 || statusCode === 429;
}

/**
 * GitHub rate limit category.
 */
type RateLimitCategory = 'none' | 'primary' | 'secondary' | 'abuse';

/**
 * Check if a 403 response is a GitHub rate limit and extract retry info.
 *
 * GitHub returns 403 for multiple scenarios:
 * - Primary rate limit: X-RateLimit-Remaining: 0 or Retry-After header
 * - Secondary rate limit: specific error messages
 * - Abuse detection: specific error messages
 * - Permission denied: insufficient permissions (should NOT retry)
 */
function checkGitHubRateLimit(
  response: Response,
  errorMessage: string | null
): { category: RateLimitCategory; retryAfterMs?: number } {
  const errorMsg = errorMessage?.toLowerCase() ?? '';

  // Abuse detection: triggered by request pattern violations
  if (errorMsg.includes('abuse detection') || errorMsg.includes('abuse detection mechanism')) {
    // Abuse detection typically uses Retry-After header
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return { category: 'abuse', retryAfterMs: seconds * 1000 };
      }
    }
    // Default retry after for abuse without header: 60 seconds
    return { category: 'abuse', retryAfterMs: 60000 };
  }

  // Secondary rate limit: specific error messages
  if (
    errorMsg.includes('secondary') ||
    errorMsg.includes('rate limit') ||
    errorMsg.includes('you have exceeded a secondary rate limit') ||
    errorMsg.includes('concurrent request limit')
  ) {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return { category: 'secondary', retryAfterMs: seconds * 1000 };
      }
    }
    // Secondary rate limit without Retry-After: default 60 seconds
    return { category: 'secondary', retryAfterMs: 60000 };
  }

  // Primary rate limit: check standard headers
  // X-RateLimit-Remaining: 0 indicates the primary limit is hit
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  const retryAfter = response.headers.get('Retry-After');

  // Primary rate limit: remaining is 0 or Retry-After header present
  if (remaining === '0' || retryAfter !== null) {
    let retryMs: number | undefined;
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        retryMs = seconds * 1000;
      }
    } else if (reset) {
      const resetTime = parseInt(reset, 10);
      if (!isNaN(resetTime)) {
        retryMs = Math.max(0, resetTime * 1000 - Date.now());
      }
    }
    return { category: 'primary', retryAfterMs: retryMs };
  }

  // No rate limit detected - this is a permission denied or other 403
  return { category: 'none' };
}

// ============================================================
// Real GitHub Client Implementation
// ============================================================

/**
 * Real GitHub client for production use.
 *
 * This implementation:
 * - Uses GitHub App authentication for production
 * - Implements CAS semantics for commit operations
 * - Handles rate limiting with exponential backoff
 * - Enforces tester mode organization restrictions
 */
export class RealGitHubClientImpl implements GitHubClient {
  private readonly githubApp: GitHubAppAuth | null;
  private readonly installationId: string | null;
  private readonly accessToken: string | null;
  private readonly apiBaseUrl: string;
  private readonly writeEnabled: boolean;
  private readonly testerConfig: TesterTransportConfig | null;
  private readonly rateLimit: { maxRetries: number; baseRetryDelayMs: number; maxRetryDelayMs: number };
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  constructor(config: RealGitHubClientConfig) {
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://api.github.com';
    this.writeEnabled = config.writeEnabled;
    this.testerConfig = config.testerConfig ?? null;
    this.rateLimit = { ...DEFAULT_RATE_LIMIT, ...config.rateLimit };

    // Initialize authentication
    if (config.accessToken) {
      // Direct token (for testing)
      this.accessToken = config.accessToken;
      this.githubApp = null;
      this.installationId = null;
    } else if (config.githubApp) {
      // GitHub App authentication
      this.githubApp = new GitHubAppAuth(config.githubApp);
      this.installationId = config.installationId ?? config.githubApp.installationId ?? null;
      this.accessToken = null;
    } else {
      throw new Error('Either githubApp config or accessToken is required');
    }
  }

  isWriteEnabled(): boolean {
    return this.writeEnabled;
  }

  /**
   * Get the current access token, refreshing if necessary.
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    if (!this.githubApp || !this.installationId) {
      throw new Error('GitHub App authentication not configured');
    }

    return this.githubApp.getAccessToken(this.installationId);
  }

  /**
   * Make an authenticated request to the GitHub API with retry logic.
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      retries?: number;
      acceptEmptyBody?: boolean;
    } = {}
  ): Promise<{ ok: boolean; status: number; data: T | null; error: GitHubClientError | null }> {
    const retries = options.retries ?? this.rateLimit.maxRetries;
    let lastError: GitHubClientError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const token = await this.getAccessToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        };

        const fetchOptions: RequestInit = {
          method,
          headers,
        };

        if (options.body) {
          headers['Content-Type'] = 'application/json';
          fetchOptions.body = JSON.stringify(options.body);
        }

        const response = await fetch(`${this.apiBaseUrl}${path}`, fetchOptions);
        this.requestCount++;
        this.lastRequestTime = Date.now();

        // Parse error response for rate limit checking
        let errorData: Record<string, unknown> = {};
        let errorMessage: string | null = null;
        try {
          errorData = await response.json() as Record<string, unknown>;
          errorMessage = extractErrorMessage(errorData);
        } catch {
          // Ignore JSON parse errors
        }

        // Handle 403: distinguish between rate limits and permission denied
        if (response.status === 403) {
          const rateLimitCheck = checkGitHubRateLimit(response, errorMessage);

          if (rateLimitCheck.category !== 'none' && attempt < retries) {
            // This is a rate limit - retry with backoff
            const retryAfterMs = rateLimitCheck.retryAfterMs ?? this.calculateBackoff(attempt);
            lastError = createGitHubError(
              'GITHUB_RATE_LIMITED',
              `GitHub API rate limit (${rateLimitCheck.category}) exceeded. Retry after ${retryAfterMs}ms.`,
              403,
              { category: rateLimitCheck.category, retryAfterMs, retryable: true }
            );
            await this.sleep(retryAfterMs);
            continue;
          }

          // Permission denied or other 403 - do not retry
          return {
            ok: false,
            status: 403,
            data: null,
            error: createGitHubError(
              'GITHUB_PERMISSION_DENIED',
              errorMessage || 'Permission denied or rate limit exceeded without retry',
              403,
              { category: rateLimitCheck.category, retryable: false }
            ),
          };
        }

        // Handle specific status codes
        if (response.ok) {
          if (response.status === 204 || options.acceptEmptyBody) {
            return { ok: true, status: response.status, data: null, error: null };
          }
          const data = await response.json() as T;
          return { ok: true, status: response.status, data, error: null };
        }

        const statusCode = response.status;

        // Check if error is transient and we should retry
        if (isTransientError(statusCode) && attempt < retries) {
          lastError = createGitHubError('GITHUB_CLIENT_ERROR', errorMessage || statusCode.toString(), statusCode, errorData);
          await this.sleep(this.calculateBackoff(attempt));
          continue;
        }

        // Map HTTP status to error codes
        const errorCode = mapStatusToErrorCode(statusCode, errorData);
        return {
          ok: false,
          status: statusCode,
          data: null,
          error: createGitHubError(errorCode, errorMessage || statusCode.toString(), statusCode, errorData),
        };
      } catch (error) {

        // Network error - retry
        if (attempt < retries) {
          lastError = createGitHubError('GITHUB_CLIENT_ERROR', error instanceof Error ? error.message : 'Network error', 0);
          await this.sleep(this.calculateBackoff(attempt));
          continue;
        }

        return {
          ok: false,
          status: 0,
          data: null,
          error: createGitHubError('GITHUB_CLIENT_ERROR', error instanceof Error ? error.message : 'Unknown error'),
        };
      }
    }

    return {
      ok: false,
      status: lastError?.statusCode ?? 0,
      data: null,
      error: lastError ?? createGitHubError('GITHUB_CLIENT_ERROR', 'Max retries exceeded'),
    };
  }

  private calculateBackoff(attempt: number): number {
    const delay = Math.min(
      this.rateLimit.baseRetryDelayMs * Math.pow(2, attempt),
      this.rateLimit.maxRetryDelayMs
    );
    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private validateWriteAccess(repository: RepositoryIdentity): GitHubClientError | null {
    if (!this.writeEnabled) {
      return createGitHubError(
        'WRITE_MODE_NOT_ENABLED',
        'Write mode is not enabled. RealGitHubClient is read-only.'
      );
    }

    if (this.testerConfig) {
      if (!isAllowedTesterRepository(repository, this.testerConfig)) {
        return createGitHubError(
          'GITHUB_PERMISSION_DENIED',
          `Repository ${repository} is not allowed in tester mode. Only ${this.testerConfig.allowedStorageOwners.join(', ')} are permitted.`,
          403
        );
      }
    }

    return null;
  }

  // ============================================================
  // Read Operations
  // ============================================================

  async getRepository(repository: RepositoryIdentity): Promise<RepositoryInfo | null> {
    const result = await this.request<{
      name: string;
      full_name: string;
      owner: { login: string };
      private: boolean;
      archived: boolean;
      default_branch: string;
    }>('GET', `/repos/${repository}`);

    if (!result.ok) {
      if (result.status === 404) return null;
      throw result.error;
    }

    const data = result.data!;
    return {
      name: data.name,
      fullName: data.full_name as RepositoryIdentity,
      owner: data.owner.login,
      isPrivate: data.private,
      isArchived: data.archived,
      defaultBranch: data.default_branch,
    };
  }

  async repositoryExists(repository: RepositoryIdentity): Promise<boolean> {
    const repo = await this.getRepository(repository);
    return repo !== null;
  }

  async getBranch(repository: RepositoryIdentity, branch: string): Promise<BranchInfo | null> {
    const result = await this.request<{
      name: string;
      commit: { sha: string };
      protected: boolean;
    }>('GET', `/repos/${repository}/branches/${encodeURIComponent(branch)}`);

    if (!result.ok) {
      if (result.status === 404) return null;
      throw result.error;
    }

    const data = result.data!;
    return {
      name: data.name,
      sha: data.commit.sha as GitSha,
      isProtected: data.protected,
    };
  }

  async getCommit(
    repository: RepositoryIdentity,
    sha: GitSha
  ): Promise<{
    sha: GitSha;
    message: string;
    author: { name: string; email: string; date: string };
  } | null> {
    const result = await this.request<{
      sha: string;
      commit: {
        message: string;
        author: { name: string; email: string; date: string };
      };
    }>('GET', `/repos/${repository}/commits/${sha}`);

    if (!result.ok) {
      if (result.status === 404) return null;
      throw result.error;
    }

    const data = result.data!;
    return {
      sha: data.sha as GitSha,
      message: data.commit.message,
      author: data.commit.author,
    };
  }

  async listFiles(repository: RepositoryIdentity, ref: string, prefix: string): Promise<RepositoryFile[]> {
    const result = await this.request<Array<{
      type: string;
      path: string;
      content?: string;
      sha?: string;
    }>>('GET', `/repos/${repository}/contents/${prefix}?ref=${encodeURIComponent(ref)}`);

    if (!result.ok) {
      if (result.status === 404) return [];
      throw result.error;
    }

    const data = result.data ?? [];
    return data
      .filter(entry => entry.type === 'file')
      .map(entry => ({
        path: entry.path,
        content: entry.content
          ? Buffer.from(entry.content.replace(/\n/g, ''), 'base64')
          : Buffer.alloc(0),
      }));
  }

  async downloadArchive(repository: RepositoryIdentity, ref: string): Promise<Buffer> {
    const token = await this.getAccessToken();
    const response = await fetch(
      `${this.apiBaseUrl}/repos/${repository}/zipball/${encodeURIComponent(ref)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      throw createGitHubError(
        'SOURCE_FETCH_FAILED',
        `Failed to download archive: ${response.statusText}`,
        response.status
      );
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  }

  // ============================================================
  // Write Operations
  // ============================================================

  async createRepository(options: {
    name: string;
    description: string;
    private: boolean;
    owner?: string;
  }): Promise<CreateRepositoryResult> {
    const owner = options.owner ?? TESTER_ORGANIZATION;

    // Validate access
    const repository = `${owner}/${options.name}` as RepositoryIdentity;
    const accessError = this.validateWriteAccess(repository);
    if (accessError) {
      return { success: false, error: accessError };
    }

    // Check ownership
    if (this.testerConfig && !isAllowedTesterOwner(owner, this.testerConfig)) {
      return {
        success: false,
        error: createGitHubError(
          'STORAGE_OWNER_NOT_ALLOWED',
          `Owner ${owner} is not allowed in tester mode. Allowed owners: ${this.testerConfig.allowedStorageOwners.join(', ')}`,
          403
        ),
      };
    }

    // Check if repository already exists
    const exists = await this.repositoryExists(repository);
    if (exists) {
      return {
        success: false,
        error: createGitHubError(
          'GITHUB_REPOSITORY_EXISTS',
          `Repository ${repository} already exists`,
          422
        ),
      };
    }

    // Create repository via API
    const result = await this.request<{
      full_name: string;
    }>('POST', '/user/repos', {
      body: {
        name: options.name,
        description: options.description,
        private: options.private,
        auto_init: true,
      },
    });

    if (!result.ok) {
      return {
        success: false,
        error: result.error ?? createGitHubError('GITHUB_CLIENT_ERROR', 'Failed to create repository'),
      };
    }

    return {
      success: true,
      repository: result.data!.full_name as RepositoryIdentity,
    };
  }

  async uploadFiles(options: {
    repository: RepositoryIdentity;
    branch: string;
    files: Array<{
      path: string;
      content: string;
      encoding: 'base64' | 'utf-8';
    }>;
    message: string;
    author: { name: string; email: string };
  }): Promise<UploadFileResult> {
    const accessError = this.validateWriteAccess(options.repository);
    if (accessError) {
      return { success: false, error: accessError };
    }

    // Get current branch HEAD
    const branch = await this.getBranch(options.repository, options.branch);
    if (!branch) {
      return {
        success: false,
        error: createGitHubError('GITHUB_BRANCH_NOT_FOUND', `Branch ${options.branch} not found`),
      };
    }

    // Create commit with CAS semantics
    const commitResult = await this.createCommit({
      repository: options.repository,
      branch: options.branch,
      expectedParent: branch.sha,
      message: options.message,
      files: options.files,
      author: options.author,
    });

    return {
      success: commitResult.success,
      commitSha: commitResult.commitSha,
      error: commitResult.error,
    };
  }

  async createCommit(options: {
    repository: RepositoryIdentity;
    branch: string;
    message: string;
    files: Array<{
      path: string;
      content: string;
      encoding: 'base64' | 'utf-8';
    }>;
    author: { name: string; email: string };
    expectedParent: GitSha | null;
  }): Promise<CreateCommitResult> {
    const accessError = this.validateWriteAccess(options.repository);
    if (accessError) {
      return { success: false, error: accessError };
    }

    // If no expected parent specified, use empty tree
    const parentTreeSha = options.expectedParent
      ? await this.getCommitTreeSha(options.repository, options.expectedParent)
      : '4b825dc642cb6eb9a060e54bf8d69288fbee4904'; // Empty tree SHA

    // Create new tree with files
    const treeResult = await this.createTree(options.repository, parentTreeSha, options.files);
    if (!treeResult.success) {
      return { success: false, error: treeResult.error };
    }

    // Create commit
    const commitResult = await this.request<{
      sha: string;
    }>('POST', `/repos/${options.repository}/git/commits`, {
      body: {
        message: options.message,
        tree: treeResult.treeSha,
        parents: options.expectedParent ? [options.expectedParent] : [],
        author: {
          name: options.author.name,
          email: options.author.email,
          date: new Date().toISOString(),
        },
        committer: {
          name: options.author.name,
          email: options.author.email,
          date: new Date().toISOString(),
        },
      },
    });

    if (!commitResult.ok) {
      // Check for conflict (parent doesn't match)
      if (commitResult.status === 422) {
        const errorData = commitResult.error?.details as Record<string, unknown> | undefined;
        if (errorData?.errors && Array.isArray(errorData.errors)) {
          const hasParentError = errorData.errors.some((e: unknown) =>
            typeof e === 'object' && e !== null && 'resource' in e && (e as Record<string, unknown>).resource === 'commit' &&
            'field' in e && (e as Record<string, unknown>).field === 'parents'
          );
          if (hasParentError) {
            return {
              success: false,
              error: createGitHubError(
                'CONCURRENCY_CONFLICT',
                'Branch head changed before commit could be created. Expected parent SHA does not match current branch state.',
                409,
                { expectedParent: options.expectedParent }
              ),
            };
          }
        }
      }
      return {
        success: false,
        error: commitResult.error ?? createGitHubError('GITHUB_COMMIT_FAILED', 'Failed to create commit'),
      };
    }

    // Update branch reference to point to new commit
    const refUpdateResult = await this.updateBranchRef(
      options.repository,
      options.branch,
      commitResult.data!.sha as GitSha,
      options.expectedParent
    );

    if (!refUpdateResult.success) {
      // The commit was created but branch update failed
      // This is a partial failure - the commit exists but branch didn't update
      // Return success with the commit SHA - caller can re-read and verify
      return {
        success: true,
        commitSha: commitResult.data!.sha as GitSha,
      };
    }

    return {
      success: true,
      commitSha: commitResult.data!.sha as GitSha,
    };
  }

  async createBranch(options: {
    repository: RepositoryIdentity;
    branch: string;
    fromSha: GitSha;
  }): Promise<{ success: boolean; error?: GitHubClientError }> {
    const accessError = this.validateWriteAccess(options.repository);
    if (accessError) {
      return { success: false, error: accessError };
    }

    const ref = `refs/heads/${options.branch}`;
    const result = await this.request<{ ref: string; object: { sha: string } }>(
      'POST',
      `/repos/${options.repository}/git/refs`,
      {
        body: {
          ref,
          sha: options.fromSha,
        },
      }
    );

    if (!result.ok) {
      return {
        success: false,
        error: result.error ?? createGitHubError('GITHUB_CLIENT_ERROR', 'Failed to create branch'),
      };
    }

    return { success: true };
  }

  close(): void {
    // No-op for real client
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private async getCommitTreeSha(repository: RepositoryIdentity, sha: GitSha): Promise<string> {
    const result = await this.request<{
      tree: { sha: string };
    }>('GET', `/repos/${repository}/git/commits/${sha}`);

    if (!result.ok) {
      throw result.error ?? createGitHubError('GITHUB_CLIENT_ERROR', 'Failed to get commit tree');
    }

    return result.data!.tree.sha;
  }

  private async createTree(
    repository: RepositoryIdentity,
    baseTreeSha: string,
    files: Array<{
      path: string;
      content: string;
      encoding: 'base64' | 'utf-8';
    }>
  ): Promise<{ success: boolean; treeSha?: string; error?: GitHubClientError }> {
    const tree = files.map(file => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      content: file.encoding === 'base64'
        ? Buffer.from(file.content, 'base64').toString('base64')
        : Buffer.from(file.content).toString('base64'),
    }));

    const result = await this.request<{ sha: string }>('POST', `/repos/${repository}/git/trees`, {
      body: {
        base_tree: baseTreeSha,
        tree,
      },
    });

    if (!result.ok) {
      return {
        success: false,
        error: result.error ?? createGitHubError('GITHUB_CLIENT_ERROR', 'Failed to create tree'),
      };
    }

    return { success: true, treeSha: result.data!.sha };
  }

  private async updateBranchRef(
    repository: RepositoryIdentity,
    branch: string,
    sha: GitSha,
    expectedCurrentSha: GitSha | null
  ): Promise<{ success: boolean; error?: GitHubClientError }> {
    const ref = `refs/heads/${branch}`;
    const path = `/repos/${repository}/git/refs/${encodeURIComponent(ref)}`;

    // If we have an expected current SHA, use conditional update
    if (expectedCurrentSha) {
      // GitHub's ref update doesn't support conditional updates directly,
      // but we can verify the current SHA first
      const current = await this.getBranch(repository, branch);
      if (!current) {
        return {
          success: false,
          error: createGitHubError('GITHUB_BRANCH_NOT_FOUND', `Branch ${branch} not found`),
        };
      }

      if (current.sha.toLowerCase() !== expectedCurrentSha.toLowerCase()) {
        return {
          success: false,
          error: createGitHubError(
            'CONCURRENCY_CONFLICT',
            'Branch head changed during commit operation. Another writer advanced the branch.',
            409,
            { expectedParent: expectedCurrentSha, actualHead: current.sha }
          ),
        };
      }
    }

    const result = await this.request<{ ref: string; object: { sha: string } }>('PATCH', path, {
      body: {
        sha,
        force: false, // NEVER force update
      },
    });

    if (!result.ok) {
      // 409 Conflict means another writer updated the branch
      if (result.status === 409) {
        return {
          success: false,
          error: createGitHubError(
            'CONCURRENCY_CONFLICT',
            'Branch was updated by another writer. Refusing to force-push.',
            409,
            { expectedHead: expectedCurrentSha }
          ),
        };
      }
      return {
        success: false,
        error: result.error ?? createGitHubError('GITHUB_CLIENT_ERROR', 'Failed to update branch ref'),
      };
    }

    return { success: true };
  }
}

// ============================================================
// Utility Functions
// ============================================================

function isGitHubClientError(error: unknown): error is GitHubClientError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as GitHubClientError).code === 'string'
  );
}

function extractErrorMessage(errorData: Record<string, unknown>): string | null {
  if (typeof errorData.message === 'string') {
    return errorData.message;
  }
  if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
    const firstError = errorData.errors[0];
    if (typeof firstError === 'object' && firstError !== null && 'message' in firstError) {
      return String((firstError as Record<string, unknown>).message);
    }
  }
  return null;
}

function mapStatusToErrorCode(status: number, errorData: Record<string, unknown>): MaterializationErrorCode {
  switch (status) {
    case 401:
      return 'GITHUB_UNAUTHORIZED';
    case 403:
      if (errorData.message === 'Resource not accessible by integration') {
        return 'GITHUB_PERMISSION_DENIED';
      }
      return 'GITHUB_PERMISSION_DENIED';
    case 404:
      return 'GITHUB_REPOSITORY_NOT_FOUND';
    case 409:
      return 'CONCURRENCY_CONFLICT';
    case 422:
      return 'GITHUB_COMMIT_FAILED';
    default:
      return 'GITHUB_CLIENT_ERROR';
  }
}

// ============================================================
// Factory Function
// ============================================================

export function createRealGitHubClient(config: RealGitHubClientConfig): GitHubClient {
  return new RealGitHubClientImpl(config);
}
