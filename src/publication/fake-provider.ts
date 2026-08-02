/**
 * Fake Publication Provider
 *
 * In-memory implementation of PublicationProvider for testing.
 * Simulates GitHub release operations without network calls.
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
// Simulated Storage
// ============================================================

interface SimulatedRelease {
  id: number;
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  assets: SimulatedAsset[];
  repository: RepositoryIdentity;
}

interface SimulatedAsset {
  id: number;
  name: string;
  contentType: string;
  size: number;
  content: Buffer;
}

/**
 * Configuration for FakePublicationProvider
 */
export interface FakePublicationProviderConfig {
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
   * Pre-populated releases
   */
  existingReleases?: SimulatedRelease[];
}

/**
 * Fake publication provider for deterministic testing.
 *
 * Features:
 * - In-memory release simulation
 * - Configurable failure rates
 * - Simulated latency
 * - Write mode toggle
 */
export class FakePublicationProvider implements PublicationProvider {
  private config: Required<FakePublicationProviderConfig>;
  private releases: Map<string, SimulatedRelease> = new Map();
  private releaseIdSequence = 1000;
  private assetIdSequence = 5000;
  private forcedFailures = 0;

  constructor(config: FakePublicationProviderConfig) {
    this.config = {
      writeEnabled: config.writeEnabled,
      latency: config.latency ?? 10,
      failureRate: config.failureRate ?? 0,
      existingReleases: config.existingReleases ?? [],
    };

    // Initialize with existing releases
    for (const release of this.config.existingReleases) {
      const key = `${release.repository}:${release.tagName}`;
      this.releases.set(key, release);
      this.releaseIdSequence = Math.max(this.releaseIdSequence, release.id + 1);
    }
  }

  isWriteEnabled(): boolean {
    return this.config.writeEnabled;
  }

  /**
   * Add a pre-existing release to the fake provider
   */
  addRelease(release: Omit<SimulatedRelease, 'assets'>): void {
    const fullRelease: SimulatedRelease = {
      ...release,
      assets: [],
    };
    const key = `${release.repository}:${release.tagName}`;
    this.releases.set(key, fullRelease);
  }

  /**
   * Get all simulated releases
   */
  getReleases(): Map<string, SimulatedRelease> {
    return this.releases;
  }

  /**
   * Force the next operation to fail
   */
  failNextOperation(): void {
    this.forcedFailures++;
  }

  /**
   * Clear all releases
   */
  clearReleases(): void {
    this.releases.clear();
  }

  private async simulateOperation<T>(operation: () => T): Promise<T> {
    // Simulate latency
    await new Promise((resolve) => setTimeout(resolve, this.config.latency));

    // Check for forced failure
    if (this.forcedFailures > 0) {
      this.forcedFailures--;
      const error: PublicationProviderError = {
        code: PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_INTERNAL_ERROR,
        message: 'Simulated forced failure',
      };
      // Return a rejected promise that will be caught
      throw error;
    }

    // Simulate random failures
    if (this.config.failureRate > 0 && Math.random() < this.config.failureRate) {
      const error: PublicationProviderError = {
        code: PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_NETWORK_ERROR,
        message: 'Simulated random failure',
      };
      throw error;
    }

    return operation();
  }

  private makeError(code: PublicationProviderErrorCode, message: string, statusCode?: number): PublicationProviderError {
    return { code, message, statusCode };
  }

  async createRelease(options: {
    repository: RepositoryIdentity;
    tagName: string;
    name: string;
    body: string;
    draft?: boolean;
  }): Promise<CreateReleaseResult> {
    return this.simulateOperation(() => {
      if (!this.config.writeEnabled) {
        return {
          success: false,
          error: this.makeError(
            PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_PERMISSION_DENIED,
            'Write mode is not enabled',
            403
          ),
        };
      }

      const key = `${options.repository}:${options.tagName}`;

      // Check if release already exists
      if (this.releases.has(key)) {
        return {
          success: false,
          error: this.makeError(
            PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_RELEASE_ALREADY_EXISTS,
            `Release ${options.tagName} already exists in ${options.repository}`,
            422
          ),
        };
      }

      const id = this.releaseIdSequence++;
      const now = new Date().toISOString();

      const release: SimulatedRelease = {
        id,
        tagName: options.tagName,
        name: options.name,
        body: options.body,
        draft: options.draft ?? true,
        prerelease: false,
        createdAt: now,
        updatedAt: now,
        htmlUrl: `https://github.com/${options.repository}/releases/tag/${options.tagName}`,
        assets: [],
        repository: options.repository,
      };

      this.releases.set(key, release);

      return {
        success: true,
        release: this.toRelease(release),
      };
    });
  }

  async uploadReleaseAsset(options: {
    repository: RepositoryIdentity;
    releaseId: number;
    name: string;
    content: Buffer;
    contentType?: string;
  }): Promise<UploadAssetResult> {
    return this.simulateOperation(() => {
      if (!this.config.writeEnabled) {
        return {
          success: false,
          error: this.makeError(
            PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_PERMISSION_DENIED,
            'Write mode is not enabled',
            403
          ),
        };
      }

      // Find the release
      let release: SimulatedRelease | undefined;
      for (const r of this.releases.values()) {
        if (r.id === options.releaseId && r.repository === options.repository) {
          release = r;
          break;
        }
      }

      if (!release) {
        return {
          success: false,
          error: this.makeError(
            PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_RELEASE_NOT_FOUND,
            `Release ${options.releaseId} not found`,
            404
          ),
        };
      }

      const id = this.assetIdSequence++;
      const asset: SimulatedAsset = {
        id,
        name: options.name,
        contentType: options.contentType ?? 'application/octet-stream',
        size: options.content.length,
        content: options.content,
      };

      release.assets.push(asset);

      return {
        success: true,
        asset: this.toAsset(asset),
      };
    });
  }

  async getReleaseByTag(options: {
    repository: RepositoryIdentity;
    tagName: string;
  }): Promise<GetReleaseResult> {
    return this.simulateOperation(() => {
      const key = `${options.repository}:${options.tagName}`;
      const release = this.releases.get(key);

      if (!release) {
        return {
          success: true,
          release: null,
        };
      }

      return {
        success: true,
        release: this.toRelease(release),
      };
    });
  }

  async updateRelease(options: {
    repository: RepositoryIdentity;
    releaseId: number;
    draft?: boolean;
  }): Promise<UpdateReleaseResult> {
    return this.simulateOperation(() => {
      if (!this.config.writeEnabled) {
        return {
          success: false,
          error: this.makeError(
            PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_PERMISSION_DENIED,
            'Write mode is not enabled',
            403
          ),
        };
      }

      // Find the release
      let release: SimulatedRelease | undefined;
      for (const r of this.releases.values()) {
        if (r.id === options.releaseId && r.repository === options.repository) {
          release = r;
          break;
        }
      }

      if (!release) {
        return {
          success: false,
          error: this.makeError(
            PUBLICATION_PROVIDER_ERROR_CODES.PROVIDER_RELEASE_NOT_FOUND,
            `Release ${options.releaseId} not found`,
            404
          ),
        };
      }

      // Update draft status
      if (options.draft !== undefined) {
        release.draft = options.draft;
        release.updatedAt = new Date().toISOString();
      }

      return {
        success: true,
        release: this.toRelease(release),
      };
    });
  }

  close(): void {
    // No-op for fake provider
  }

  // ============================================================
  // Conversion Helpers
  // ============================================================

  private toRelease(r: SimulatedRelease): Release {
    return {
      id: r.id,
      tagName: r.tagName,
      name: r.name,
      body: r.body,
      draft: r.draft,
      prerelease: r.prerelease,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      htmlUrl: r.htmlUrl,
    };
  }

  private toAsset(a: SimulatedAsset): ReleaseAsset {
    return {
      id: a.id,
      name: a.name,
      contentType: a.contentType,
      size: a.size,
      downloadCount: 0,
      browserDownloadUrl: `https://github.com/downloads/${a.name}`,
    };
  }
}
