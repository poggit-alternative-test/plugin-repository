/**
 * GitHub Client Abstraction
 *
 * Interface and implementations for GitHub operations.
 *
 * This abstraction allows:
 * - FakeGitHubClient for deterministic testing
 * - RealGitHubClient for production use (requires auth)
 * - Future: GitHub App authentication support
 */

import type {
  GitSha,
  RepositoryIdentity,
  MaterializationErrorCode,
} from './materialization-types.js';

// Import RealGitHubClient from the transport module
import type { RealGitHubClientConfig } from './real-github-client.js';
import { RealGitHubClientImpl as RealGitHubClient, createRealGitHubClient } from './real-github-client.js';

// Re-export for consumers of this module
export type { RealGitHubClientConfig };
export { RealGitHubClient, createRealGitHubClient };

// ============================================================
// GitHub Client Interface
// ============================================================

/**
 * Result of repository creation
 */
export interface CreateRepositoryResult {
  success: boolean;
  repository?: RepositoryIdentity;
  error?: GitHubClientError;
}

/**
 * Result of file upload
 */
export interface UploadFileResult {
  success: boolean;
  commitSha?: GitSha;
  error?: GitHubClientError;
}

/**
 * Result of creating a commit
 */
export interface CreateCommitResult {
  success: boolean;
  commitSha?: GitSha;
  error?: GitHubClientError;
}

/**
 * Repository information
 */
export interface RepositoryInfo {
  name: string;
  fullName: RepositoryIdentity;
  owner: string;
  isPrivate: boolean;
  isArchived: boolean;
  defaultBranch: string;
}

/**
 * Branch information
 */
export interface BranchInfo {
  name: string;
  sha: GitSha;
  isProtected: boolean;
}

/** Immutable snapshot of a file as stored at a repository ref. */
export interface RepositoryFile {
  path: string;
  content: Buffer;
}

/**
 * GitHub client interface for materialization operations.
 * All operations are read-only by default; write operations
 * require explicit enablement.
 */
export interface GitHubClient {
  /**
   * Check if client is configured for write operations
   */
  isWriteEnabled(): boolean;

  /**
   * Get repository information
   */
  getRepository(repository: RepositoryIdentity): Promise<RepositoryInfo | null>;

  /**
   * Check if repository exists
   */
  repositoryExists(repository: RepositoryIdentity): Promise<boolean>;

  /**
   * Get branch information
   */
  getBranch(repository: RepositoryIdentity, branch: string): Promise<BranchInfo | null>;

  /**
   * Get commit information
   */
  getCommit(repository: RepositoryIdentity, sha: GitSha): Promise<{
    sha: GitSha;
    message: string;
    author: { name: string; email: string; date: string };
  } | null>;

  /** Read files beneath a prefix at a branch/ref for reconciliation. */
  listFiles(repository: RepositoryIdentity, ref: string, prefix: string): Promise<RepositoryFile[]>;

  /**
   * Download archive/tarball for a specific ref
   */
  downloadArchive(
    repository: RepositoryIdentity,
    ref: string
  ): Promise<Buffer>;

  /**
   * Create a new repository (requires write mode)
   */
  createRepository(options: {
    name: string;
    description: string;
    private: boolean;
    owner?: string;
  }): Promise<CreateRepositoryResult>;

  /**
   * Upload files to a repository (requires write mode)
   */
  uploadFiles(options: {
    repository: RepositoryIdentity;
    branch: string;
    files: Array<{
      path: string;
      content: string;
      encoding: 'base64' | 'utf-8';
    }>;
    message: string;
    author: { name: string; email: string };
  }): Promise<UploadFileResult>;

  /**
   * Create a commit with files (requires write mode)
   */
  createCommit(options: {
    repository: RepositoryIdentity;
    branch: string;
    message: string;
    files: Array<{
      path: string;
      content: string;
      encoding: 'base64' | 'utf-8';
    }>;
    author: { name: string; email: string };
    /** Required optimistic-concurrency parent. null means an empty branch. */
    expectedParent: GitSha | null;
  }): Promise<CreateCommitResult>;

  /**
   * Create a new branch (requires write mode)
   */
  createBranch(options: {
    repository: RepositoryIdentity;
    branch: string;
    fromSha: GitSha;
  }): Promise<{ success: boolean; error?: GitHubClientError }>;

  /**
   * Close client and cleanup resources
   */
  close(): void;
}

// ============================================================
// GitHub Client Errors
// ============================================================

export interface GitHubClientError {
  code: MaterializationErrorCode;
  message: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

export function isRateLimitError(error: GitHubClientError): boolean {
  return error.code === 'GITHUB_RATE_LIMITED' || error.statusCode === 403;
}

// ============================================================
// Fake GitHub Client (for testing)
// ============================================================

/**
 * Configuration for FakeGitHubClient
 */
export interface FakeGitHubClientConfig {
  /**
   * Whether write operations are allowed
   */
  writeEnabled: boolean;

  /**
   * Simulated latency per operation (ms)
   */
  latency?: number;

  /**
   * Simulated failure rate (0-1)
   */
  failureRate?: number;

  /**
   * Token prefix for authorization check
   */
  tokenPrefix?: string;
}

/**
 * Simulated repository storage
 */
interface SimulatedRepository {
  name: string;
  fullName: RepositoryIdentity;
  owner: string;
  isPrivate: boolean;
  isArchived: boolean;
  defaultBranch: string;
  branches: Map<string, GitSha>;
  commits: Map<GitSha, {
    message: string;
    author: { name: string; email: string; date: string };
    parents: GitSha[];
    tree: Map<string, { content: string; encoding: 'base64' | 'utf-8' }>;
  }>;
}

/**
 * Fake GitHub client for deterministic testing.
 *
 * Features:
 * - In-memory repository simulation
 * - Configurable failure rates
 * - Simulated latency
 * - Write mode toggle
 */
export class FakeGitHubClient implements GitHubClient {
  private config: Required<FakeGitHubClientConfig>;
  private repositories: Map<RepositoryIdentity, SimulatedRepository> = new Map();
  private archives: Map<string, Buffer> = new Map();
  private commitSequence = 0;
  private forcedCommitFailures = 0;

  constructor(config: FakeGitHubClientConfig) {
    this.config = {
      latency: config.latency ?? 10,
      failureRate: config.failureRate ?? 0,
      tokenPrefix: config.tokenPrefix ?? 'ghp_',
      writeEnabled: config.writeEnabled,
    };
  }

  isWriteEnabled(): boolean {
    return this.config.writeEnabled;
  }

  /**
   * Add a simulated repository to the fake client
   */
  addRepository(info: {
    fullName: RepositoryIdentity;
    isPrivate?: boolean;
    isArchived?: boolean;
    defaultBranch?: string;
  }): void {
    const repo: SimulatedRepository = {
      name: info.fullName.split('/')[1],
      fullName: info.fullName,
      owner: info.fullName.split('/')[0],
      isPrivate: info.isPrivate ?? false,
      isArchived: info.isArchived ?? false,
      defaultBranch: info.defaultBranch ?? 'main',
      branches: new Map([[info.defaultBranch ?? 'main', '0000000000000000000000000000000000000000' as GitSha]]),
      commits: new Map(),
    };
    this.repositories.set(info.fullName, repo);
  }

  /**
   * Add a simulated archive to the fake client
   */
  addArchive(key: string, archive: Buffer): void {
    this.archives.set(key, archive);
  }

  /**
   * Add a simulated commit to a repository
   */
  addCommit(
    repository: RepositoryIdentity,
    sha: GitSha,
    commit: {
      message: string;
      author: { name: string; email: string; date: string };
      parents?: GitSha[];
    }
  ): void {
    const repo = this.repositories.get(repository);
    if (repo) {
      repo.commits.set(sha, {
        ...commit,
        parents: commit.parents ?? [],
        tree: new Map(),
      });
    }
  }

  /**
   * Get all simulated repositories
   */
  getRepositories(): Map<RepositoryIdentity, SimulatedRepository> {
    return this.repositories;
  }

  /** Test-only fault injection for retry/reconciliation coverage. */
  failNextCreateCommit(count: number = 1): void { this.forcedCommitFailures += count; }

  /** Test-only simulation of an out-of-band trusted-state mutation. */
  mutateHeadFilesForTest(repository: RepositoryIdentity, branch: string, mutate: (tree: Map<string, { content: string; encoding: 'base64' | 'utf-8' }>) => void): void {
    const repo = this.repositories.get(repository); const head = repo?.branches.get(branch); const commit = head ? repo?.commits.get(head) : undefined;
    if (!commit) throw new Error('No branch head available for test mutation');
    mutate(commit.tree);
  }

  private async simulateOperation<T>(operation: () => T): Promise<T> {
    // Check for write operations
    // Simulate latency
    await new Promise((resolve) => setTimeout(resolve, this.config.latency));

    // Simulate failures
    if (this.config.failureRate > 0 && Math.random() < this.config.failureRate) {
      throw {
        code: 'GITHUB_CLIENT_ERROR' as MaterializationErrorCode,
        message: 'Simulated random failure',
      };
    }

    return operation();
  }

  async getRepository(repository: RepositoryIdentity): Promise<RepositoryInfo | null> {
    return this.simulateOperation(() => {
      const repo = this.repositories.get(repository);
      if (!repo) return null;
      return {
        name: repo.name,
        fullName: repo.fullName,
        owner: repo.owner,
        isPrivate: repo.isPrivate,
        isArchived: repo.isArchived,
        defaultBranch: repo.defaultBranch,
      };
    });
  }

  async repositoryExists(repository: RepositoryIdentity): Promise<boolean> {
    return this.simulateOperation(() => this.repositories.has(repository));
  }

  async getBranch(
    repository: RepositoryIdentity,
    branch: string
  ): Promise<BranchInfo | null> {
    return this.simulateOperation(() => {
      const repo = this.repositories.get(repository);
      if (!repo) return null;
      const sha = repo.branches.get(branch);
      if (!sha) return null;
      return {
        name: branch,
        sha,
        isProtected: false,
      };
    });
  }

  async getCommit(
    repository: RepositoryIdentity,
    sha: GitSha
  ): Promise<{
    sha: GitSha;
    message: string;
    author: { name: string; email: string; date: string };
  } | null> {
    return this.simulateOperation(() => {
      const repo = this.repositories.get(repository);
      if (!repo) return null;
      const commit = repo.commits.get(sha);
      if (!commit) return null;
      return {
        sha,
        message: commit.message,
        author: commit.author,
      };
    });
  }

  async listFiles(repository: RepositoryIdentity, ref: string, prefix: string): Promise<RepositoryFile[]> {
    return this.simulateOperation(() => {
      const repo = this.repositories.get(repository);
      if (!repo) return [];
      const sha = repo.branches.get(ref) ?? (ref as GitSha);
      const commit = repo.commits.get(sha);
      if (!commit) return [];
      return [...commit.tree.entries()]
        .filter(([filePath]) => filePath === prefix || filePath.startsWith(`${prefix}/`))
        .map(([filePath, file]) => ({
          path: filePath,
          content: Buffer.from(file.content, file.encoding === 'base64' ? 'base64' : 'utf-8'),
        }));
    });
  }

  async downloadArchive(repository: RepositoryIdentity, ref: string): Promise<Buffer> {
    return this.simulateOperation(async () => {
      const key = `${repository}:${ref}`;
      const archive = this.archives.get(key);
      if (archive) {
        return archive;
      }

      // Generate a fake archive if not found
      // In real implementation, this would call GitHub API
      return Buffer.from('fake archive content');
    });
  }

  async createRepository(options: {
    name: string;
    description: string;
    private: boolean;
    owner?: string;
  }): Promise<CreateRepositoryResult> {
    return this.simulateOperation(() => {
      if (!this.config.writeEnabled) {
        return {
          success: false,
          error: {
            code: 'WRITE_MODE_NOT_ENABLED' as MaterializationErrorCode,
            message: 'Write mode is not enabled. Use --write flag to enable.',
          },
        };
      }

      const fullName = `${options.owner ?? 'fake-owner'}/${options.name}` as RepositoryIdentity;

      if (this.repositories.has(fullName)) {
        return {
          success: false,
          error: {
            code: 'GITHUB_REPOSITORY_EXISTS' as MaterializationErrorCode,
            message: `Repository ${fullName} already exists`,
            statusCode: 422,
          },
        };
      }

      const repo: SimulatedRepository = {
        name: options.name,
        fullName,
        owner: options.owner ?? 'fake-owner',
        isPrivate: options.private,
        isArchived: false,
        defaultBranch: 'main',
        branches: new Map([['main', '0000000000000000000000000000000000000000' as GitSha]]),
        commits: new Map(),
      };

      this.repositories.set(fullName, repo);

      return {
        success: true,
        repository: fullName,
      };
    });
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
    return this.simulateOperation(() => {
      if (!this.config.writeEnabled) {
        return {
          success: false,
          error: {
            code: 'WRITE_MODE_NOT_ENABLED' as MaterializationErrorCode,
            message: 'Write mode is not enabled. Use --write flag to enable.',
          },
        };
      }

      const repo = this.repositories.get(options.repository);
      if (!repo) {
        return {
          success: false,
          error: {
            code: 'GITHUB_REPOSITORY_NOT_FOUND' as MaterializationErrorCode,
            message: `Repository ${options.repository} not found`,
            statusCode: 404,
          },
        };
      }

      const sha = this.nextCommitSha();
      const prior = repo.branches.get(options.branch);
      const previousTree = prior ? repo.commits.get(prior)?.tree : undefined;
      repo.commits.set(sha, {
        message: options.message,
        author: { ...options.author, date: new Date().toISOString() },
        parents: prior ? [prior] : [],
        tree: new Map([
          ...(previousTree ?? new Map()).entries(),
          ...options.files.map((f) => [
            f.path,
            { content: f.content, encoding: f.encoding },
          ] as const),
        ]),
      });

      repo.branches.set(options.branch, sha);

      return { success: true, commitSha: sha };
    });
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
    return this.simulateOperation(() => {
      if (!this.config.writeEnabled) {
        return {
          success: false,
          error: {
            code: 'WRITE_MODE_NOT_ENABLED' as MaterializationErrorCode,
            message: 'Write mode is not enabled. Use --write flag to enable.',
          },
        };
      }

      const repo = this.repositories.get(options.repository);
      if (!repo) {
        return {
          success: false,
          error: {
            code: 'GITHUB_REPOSITORY_NOT_FOUND' as MaterializationErrorCode,
            message: `Repository ${options.repository} not found`,
            statusCode: 404,
          },
        };
      }

      if (this.forcedCommitFailures > 0) {
        this.forcedCommitFailures--;
        return { success: false, error: { code: 'GITHUB_COMMIT_FAILED' as MaterializationErrorCode, message: 'Forced commit failure for test' } };
      }

      const actualHead = repo.branches.get(options.branch) ?? null;
      if (actualHead !== options.expectedParent) {
        return { success: false, error: { code: 'CONCURRENCY_CONFLICT' as MaterializationErrorCode, message: 'Branch head changed before conditional commit', details: { expectedParent: options.expectedParent, actualHead } } };
      }

      const sha = this.nextCommitSha();
      const parent = actualHead ?? undefined;
      const previousTree = parent ? repo.commits.get(parent)?.tree : undefined;
      repo.commits.set(sha, {
        message: options.message,
        author: { ...options.author, date: new Date().toISOString() },
        parents: parent ? [parent] : [],
        tree: new Map([
          ...(previousTree ?? new Map()).entries(),
          ...options.files.map((f) => [
            f.path,
            { content: f.content, encoding: f.encoding },
          ] as const),
        ]),
      });

      // Update branch reference
      repo.branches.set(options.branch, sha);

      return { success: true, commitSha: sha };
    });
  }

  async createBranch(options: {
    repository: RepositoryIdentity;
    branch: string;
    fromSha: GitSha;
  }): Promise<{ success: boolean; error?: GitHubClientError }> {
    return this.simulateOperation(() => {
      if (!this.config.writeEnabled) {
        return {
          success: false,
          error: {
            code: 'WRITE_MODE_NOT_ENABLED' as MaterializationErrorCode,
            message: 'Write mode is not enabled. Use --write flag to enable.',
          },
        };
      }

      const repo = this.repositories.get(options.repository);
      if (!repo) {
        return {
          success: false,
          error: {
            code: 'GITHUB_REPOSITORY_NOT_FOUND' as MaterializationErrorCode,
            message: `Repository ${options.repository} not found`,
            statusCode: 404,
          },
        };
      }

      repo.branches.set(options.branch, options.fromSha);

      return { success: true };
    });
  }

  close(): void {
    // No-op for fake client
  }

  private nextCommitSha(): GitSha {
    this.commitSequence += 1;
    return this.commitSequence.toString(16).padStart(40, '0') as GitSha;
  }
}

// ============================================================
// Client Factory
// ============================================================

export type GitHubClientType = 'fake' | 'real';

/**
 * Create a GitHub client based on configuration
 */
export function createGitHubClient(
  type: GitHubClientType,
  config: FakeGitHubClientConfig | RealGitHubClientConfig
): GitHubClient {
  if (type === 'fake') {
    return new FakeGitHubClient(config as FakeGitHubClientConfig);
  }
  return new RealGitHubClient(config as RealGitHubClientConfig);
}
