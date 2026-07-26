/**
 * GitHub Client Abstraction
 *
 * Abstracts GitHub API interactions for submission inspection.
 * Allows for real API calls, mocking in tests, and different auth strategies.
 *
 * SECURITY: This client only accesses known GitHub API endpoints.
 * No arbitrary URL fetching to prevent SSRF.
 */

import {
  SUBMISSION_CODES,
  infrastructureError,
  submissionError,
  type SubmissionDiagnostic,
  DiagnosticSeverity,
} from './diagnostics.js';

// ============================================================
// Client Configuration
// ============================================================

export interface GitHubClientConfig {
  token?: string;
  baseUrl?: string;
  timeout?: number;
}

// ============================================================
// Data Types
// ============================================================

export interface RepositoryInfo {
  owner: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
  isArchived: boolean;
  isDisabled: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

export interface BranchInfo {
  name: string;
  commitSha: string;
  isProtected: boolean;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
}

// ============================================================
// GitHub Client Interface
// ============================================================

export interface GitHubClient {
  /**
   * Get repository information.
   */
  getRepository(owner: string, repo: string): Promise<GitHubResult<RepositoryInfo>>;

  /**
   * Get branch information including the current HEAD SHA.
   */
  getBranch(
    owner: string,
    repo: string,
    branch: string
  ): Promise<GitHubResult<BranchInfo>>;

  /**
   * Get commit information by SHA.
   */
  getCommit(
    owner: string,
    repo: string,
    sha: string
  ): Promise<GitHubResult<CommitInfo>>;

  /**
   * Get archive URL for a specific commit.
   * Returns a URL that can be fetched directly.
   */
  getArchiveUrl(
    owner: string,
    repo: string,
    sha: string,
    format: 'tarball' | 'zipball'
  ): Promise<GitHubResult<string>>;

  /**
   * Get file content from a specific commit.
   */
  getFileContent(
    owner: string,
    repo: string,
    path: string,
    sha: string
  ): Promise<GitHubResult<string>>;

  /**
   * Check if a path exists in a specific commit.
   */
  pathExists(
    owner: string,
    repo: string,
    path: string,
    sha: string
  ): Promise<GitHubResult<boolean>>;

  /**
   * Get tree (file list) for a specific commit.
   */
  getTree(
    owner: string,
    repo: string,
    sha: string,
    recursive?: boolean
  ): Promise<GitHubResult<GitHubTreeItem[]>>;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

// ============================================================
// Result Type
// ============================================================

export type GitHubResult<T> =
  | { success: true; data: T }
  | { success: false; error: SubmissionDiagnostic; isSubmissionError?: boolean };

// ============================================================
// Rate Limit Categories
// ============================================================

export enum GitHubApiCategory {
  CORE = 'core',
  SEARCH = 'search',
  GRAPHQL = 'graphql',
}

// ============================================================
// Real GitHub Client Implementation
// ============================================================

export class RealGitHubClient implements GitHubClient {
  private readonly token?: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: GitHubClientConfig = {}) {
    this.token = config.token;
    this.baseUrl = config.baseUrl ?? 'https://api.github.com';
    this.timeout = config.timeout ?? 30000;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<GitHubResult<T>> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Axolotl-PluginRepository/1.0',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemaining === '0') {
          const resetTime = response.headers.get('X-RateLimit-Reset');
          return {
            success: false,
            error: infrastructureError(SUBMISSION_CODES.GITHUB_RATE_LIMITED, `GitHub API rate limit exceeded. Resets at: ${resetTime ? new Date(Number(resetTime) * 1000).toISOString() : 'unknown'}`, { context: { category: this.getRateLimitCategory(path)  } }),
          };
        }
      }

      // Handle other error responses
      if (!response.ok) {
        if (response.status === 404) {
          // 404 is a submission error when looking up resources that should exist
          return {
            success: false,
            isSubmissionError: true,
            error: submissionError(SUBMISSION_CODES.REPOSITORY_NOT_FOUND, `GitHub API returned 404: resource not found`, { context: { status: response.status } }),
          };
        }

        if (response.status === 403) {
          return {
            success: false,
            error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, `GitHub API access forbidden (403)`, { context: { status: response.status } }),
          };
        }

        if (response.status >= 500) {
          return {
            success: false,
            error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, `GitHub API server error (${response.status})`, { context: { status: response.status } }),
          };
        }

        return {
          success: false,
          error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, `GitHub API request failed: ${response.status}`, { context: { status: response.status } }),
        };
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return { success: false, error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, 'GitHub API returned empty response')};
      }

      const data = JSON.parse(text) as T;
      return { success: true, data };
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          return {
            success: false,
            error: infrastructureError(SUBMISSION_CODES.GITHUB_TIMEOUT, `GitHub API request timed out after ${this.timeout}ms`),
          };
        }

        return {
          success: false,
          error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, `GitHub API request failed: ${e.message}`),
        };
      }

      return {
        success: false,
        error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, 'Unknown GitHub API error'),
      };
    }
  }

  private getRateLimitCategory(path: string): string {
    if (path.startsWith('/search')) {
      return GitHubApiCategory.SEARCH;
    }
    return GitHubApiCategory.CORE;
  }

  async getRepository(owner: string, repo: string): Promise<GitHubResult<RepositoryInfo>> {
    const result = await this.request<GitHubApiRepository>(`/repos/${owner}/${repo}`);

    if (!result.success) {
      // If 404, mark as submission error (repository doesn't exist)
      if (result.error.code === SUBMISSION_CODES.REPOSITORY_NOT_FOUND) {
        return {
          success: false,
          isSubmissionError: true,
          error: submissionError(
            SUBMISSION_CODES.REPOSITORY_NOT_FOUND,
            `Repository ${owner}/${repo} not found`,
            { context: { owner, repo } }
          ),
        };
      }
      return result;
    }

    const data = result.data;
    return {
      success: true,
      data: {
        owner: data.owner.login,
        name: data.name,
        fullName: data.full_name,
        isPrivate: data.private,
        isArchived: data.archived,
        isDisabled: data.disabled ?? false,
        defaultBranch: data.default_branch,
        htmlUrl: data.html_url,
      },
    };
  }

  async getBranch(
    owner: string,
    repo: string,
    branch: string
  ): Promise<GitHubResult<BranchInfo>> {
    const result = await this.request<GitHubApiBranch>(`/repos/${owner}/${repo}/branches/${branch}`);

    if (!result.success) {
      // Distinguish 404 as submission error - branch not found
      if (result.error.code === SUBMISSION_CODES.REPOSITORY_NOT_FOUND) {
        return {
          success: false,
          isSubmissionError: true,
          error: submissionError(
            SUBMISSION_CODES.REFERENCE_NOT_FOUND,
            `Branch "${branch}" not found in ${owner}/${repo}`,
            { context: { owner, repo, branch } }
          ),
        };
      }
      return result;
    }

    const data = result.data;
    return {
      success: true,
      data: {
        name: data.name,
        commitSha: data.commit.sha,
        isProtected: data.protected,
      },
    };
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<GitHubResult<CommitInfo>> {
    const result = await this.request<GitHubApiCommit>(`/repos/${owner}/${repo}/git/commits/${sha}`);

    if (!result.success) {
      return result;
    }

    const data = result.data;
    return {
      success: true,
      data: {
        sha: data.sha,
        message: data.message,
        author: {
          name: data.author.name,
          email: data.author.email,
          date: data.author.date,
        },
        committer: {
          name: data.committer.name,
          email: data.committer.email,
          date: data.committer.date,
        },
      },
    };
  }

  async getArchiveUrl(
    owner: string,
    repo: string,
    sha: string,
    format: 'tarball' | 'zipball'
  ): Promise<GitHubResult<string>> {
    // Validate format to prevent injection
    if (format !== 'tarball' && format !== 'zipball') {
      return {
        success: false,
        error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, 'Invalid archive format'),
      };
    }

    // For archive URL, we construct the GitHub URL directly
    // This is a known GitHub endpoint pattern
    const archiveUrl = `${this.baseUrl}/repos/${owner}/${repo}/${format}/${sha}`;

    // Validate URL construction
    if (!archiveUrl.includes(owner) || !archiveUrl.includes(repo)) {
      return {
        success: false,
        error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, 'Invalid archive URL construction'),
      };
    }

    return { success: true, data: archiveUrl };
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    sha: string
  ): Promise<GitHubResult<string>> {
    // Validate path to prevent injection
    if (path.includes('..') || path.startsWith('/')) {
      return {
        success: false,
        error: infrastructureError(SUBMISSION_CODES.SOURCE_PATH_TRAVERSAL, 'Invalid path in file content request'),
      };
    }

    const result = await this.request<GitHubApiFileContent>(
      `/repos/${owner}/${repo}/contents/${path}?ref=${sha}`
    );

    if (!result.success) {
      return result;
    }

    // GitHub returns base64-encoded content
    if (result.data.encoding === 'base64' && result.data.content) {
      try {
        const decoded = Buffer.from(result.data.content, 'base64').toString('utf-8');
        return { success: true, data: decoded };
      } catch {
        return {
          success: false,
          error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, 'Failed to decode file content'),
        };
      }
    }

    return {
      success: false,
      error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, 'Unsupported file encoding'),
    };
  }

  async pathExists(
    owner: string,
    repo: string,
    path: string,
    sha: string
  ): Promise<GitHubResult<boolean>> {
    const result = await this.request<GitHubApiFileContent | GitHubApiTreeResponse>(
      `/repos/${owner}/${repo}/contents/${path}?ref=${sha}`
    );

    if (!result.success) {
      // 404 means path doesn't exist
      if (result.error.code === SUBMISSION_CODES.REPOSITORY_NOT_FOUND) {
        return { success: true, data: false };
      }
      return result;
    }

    return { success: true, data: true };
  }

  async getTree(
    owner: string,
    repo: string,
    sha: string,
    recursive?: boolean
  ): Promise<GitHubResult<GitHubTreeItem[]>> {
    const params = recursive ? '?recursive=1' : '';
    const result = await this.request<GitHubApiTree>(
      `/repos/${owner}/${repo}/git/trees/${sha}${params}`
    );

    if (!result.success) {
      return result;
    }

    // GitHub returns a tree object with nested items
    if (result.data.truncated) {
      return {
        success: false,
        error: infrastructureError(SUBMISSION_CODES.SOURCE_TOO_MANY_FILES, 'Repository tree is too large to retrieve completely'),
      };
    }

    return {
      success: true,
      data: result.data.tree.map((item) => ({
        path: item.path,
        mode: item.mode,
        type: item.type as 'blob' | 'tree' | 'commit',
        sha: item.sha,
        size: item.size,
      })),
    };
  }
}

// ============================================================
// GitHub API Response Types
// ============================================================

interface GitHubApiRepository {
  owner: { login: string };
  name: string;
  full_name: string;
  private: boolean;
  archived: boolean;
  disabled?: boolean;
  default_branch: string;
  html_url: string;
}

interface GitHubApiBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

interface GitHubApiCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
}

interface GitHubApiFileContent {
  encoding: string;
  content: string;
  sha: string;
  size: number;
}

interface GitHubApiTreeResponse {
  sha: string;
  url: string;
}

interface GitHubApiTree {
  sha: string;
  truncated: boolean;
  tree: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string;
    size?: number;
  }>;
}

// ============================================================
// Factory Function
// ============================================================

export function createGitHubClient(config?: GitHubClientConfig): GitHubClient {
  return new RealGitHubClient(config);
}

// ============================================================
// Fake GitHub Client for Testing
// ============================================================

export interface FakeGitHubClientConfig {
  repositories?: Record<string, {
    owner?: string;
    name?: string;
    fullName?: string;
    isPrivate?: boolean;
    isArchived?: boolean;
    isDisabled?: boolean;
    defaultBranch?: string;
    htmlUrl?: string;
  }>;
  branches?: Record<string, {
    name?: string;
    commitSha?: string;
    isProtected?: boolean;
  }>;
  shouldFail?: {
    getRepository?: { status?: number; code?: string };
    getBranch?: { status?: number; code?: string };
    getArchiveUrl?: { status?: number; code?: string };
  };
  archiveUrls?: Record<string, string>;
}

export class FakeGitHubClient implements GitHubClient {
  private readonly config: FakeGitHubClientConfig;

  constructor(config: FakeGitHubClientConfig = {}) {
    this.config = config;
  }

  async getRepository(owner: string, repo: string): Promise<GitHubResult<RepositoryInfo>> {
    if (this.config.shouldFail?.getRepository) {
      const fail = this.config.shouldFail.getRepository;
      return {
        success: false,
        isSubmissionError: fail.status === 404,
        error: fail.status === 404
          ? submissionError(SUBMISSION_CODES.REPOSITORY_NOT_FOUND, `Repository ${owner}/${repo} not found`)
          : infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, `Repository lookup failed`),
      };
    }

    const key = `${owner}/${repo}`;
    const repoData = this.config.repositories?.[key];

    if (!repoData) {
      return {
        success: false,
        isSubmissionError: true,
        error: submissionError(SUBMISSION_CODES.REPOSITORY_NOT_FOUND, `Repository ${owner}/${repo} not found`),
      };
    }

    return {
      success: true,
      data: {
        owner: repoData.owner ?? owner,
        name: repoData.name ?? repo,
        fullName: repoData.fullName ?? `${owner}/${repo}`,
        isPrivate: repoData.isPrivate ?? false,
        isArchived: repoData.isArchived ?? false,
        isDisabled: repoData.isDisabled ?? false,
        defaultBranch: repoData.defaultBranch ?? 'main',
        htmlUrl: repoData.htmlUrl ?? `https://github.com/${owner}/${repo}`,
      },
    };
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<GitHubResult<BranchInfo>> {
    if (this.config.shouldFail?.getBranch) {
      const fail = this.config.shouldFail.getBranch;
      return {
        success: false,
        isSubmissionError: fail.status === 404,
        error: fail.status === 404
          ? submissionError(SUBMISSION_CODES.REFERENCE_NOT_FOUND, `Branch ${branch} not found in ${owner}/${repo}`)
          : infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, `Branch lookup failed`),
      };
    }

    const key = `${owner}/${repo}/${branch}`;
    const branchData = this.config.branches?.[key];

    if (!branchData) {
      return {
        success: false,
        isSubmissionError: true,
        error: submissionError(SUBMISSION_CODES.REFERENCE_NOT_FOUND, `Branch ${branch} not found in ${owner}/${repo}`),
      };
    }

    return {
      success: true,
      data: {
        name: branchData.name ?? branch,
        commitSha: branchData.commitSha ?? 'abc123def456abc123def456abc123def456abc1',
        isProtected: branchData.isProtected ?? false,
      },
    };
  }

  async getArchiveUrl(owner: string, repo: string, sha: string, format: 'tarball' | 'zipball'): Promise<GitHubResult<string>> {
    if (this.config.shouldFail?.getArchiveUrl) {
      return {
        success: false,
        error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, 'Archive URL generation failed'),
      };
    }

    const key = `${owner}/${repo}/${sha}/${format}`;
    const url = this.config.archiveUrls?.[key];

    if (url) {
      return { success: true, data: url };
    }

    // Default mock URL
    return { success: true, data: `https://api.github.com/repos/${owner}/${repo}/${format}/${sha}` };
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<GitHubResult<CommitInfo>> {
    return {
      success: true,
      data: {
        sha,
        message: `Commit ${sha.slice(0, 7)}`,
        author: { name: 'Test Author', email: 'test@example.com', date: new Date().toISOString() },
        committer: { name: 'Test Committer', email: 'test@example.com', date: new Date().toISOString() },
      },
    };
  }

  async getFileContent(owner: string, repo: string, path: string, sha: string): Promise<GitHubResult<string>> {
    return {
      success: false,
      error: infrastructureError(SUBMISSION_CODES.GITHUB_API_FAILURE, 'File content not mocked'),
    };
  }

  async pathExists(owner: string, repo: string, path: string, sha: string): Promise<GitHubResult<boolean>> {
    return { success: true, data: false };
  }

  async getTree(owner: string, repo: string, sha: string, recursive?: boolean): Promise<GitHubResult<GitHubTreeItem[]>> {
    return { success: true, data: [] };
  }
}