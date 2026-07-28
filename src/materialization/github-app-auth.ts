/**
 * GitHub App Authentication for M5 Materialization Transport
 *
 * This module provides GitHub App-based authentication for production use.
 * It does NOT use personal access tokens.
 *
 * Authentication flow:
 * 1. Load App credentials (ID, private key) from configuration
 * 2. Create a JWT signed with the private key
 * 3. Exchange JWT for installation access token
 * 4. Use access token for API operations
 * 5. Handle token refresh on expiration
 */

import { createHash, createSign } from 'crypto';
import type { MaterializationErrorCode } from './materialization-types.js';

// ============================================================
// GitHub App Types
// ============================================================

export interface GitHubAppConfig {
  /** GitHub App ID (found in App settings) */
  appId: string;
  /** Path to private key PEM file or the key content itself */
  privateKeyPath?: string;
  privateKeyContent?: string;
  /** Installation ID for the specific org/repo */
  installationId?: string;
  /** Installation ID discovery: map of organization → installation ID */
  installationIdByOrg?: Record<string, string>;
}

export interface InstallationAccessToken {
  token: string;
  expiresAt: Date;
  permissions: Record<string, string>;
}

export interface GitHubAppAuthError {
  code: 'AUTHENTICATION_REQUIRED' | 'AUTHENTICATION_FAILED' | 'INSTALLATION_NOT_FOUND' | 'TOKEN_EXPIRED';
  message: string;
  statusCode?: number;
}

export interface InstallationInfo {
  id: number;
  account: {
    login: string;
    id: number;
    type: 'User' | 'Organization';
  };
  permissions: Record<string, string>;
  repositorySelection: 'all' | 'subset';
}

// ============================================================
// JWT Creation
// ============================================================

/**
 * Create a GitHub App JWT for authentication.
 * JWT must be generated fresh for each request as GitHub rejects reuse.
 */
function createAppJwt(appId: string, privateKey: string): string {
  const header = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(JSON.stringify({
    iat: now,
    exp: now + 600, // 10 minutes max
    iss: appId,
  }));

  // Sign with RS256 using the private key
  const signingInput = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  // GitHub requires the PEM to have proper line endings
  const normalizedKey = normalizePrivateKey(privateKey);
  const signature = base64urlEncodeFromBase64(sign.sign(normalizedKey, 'base64'));

  return `${signingInput}.${signature}`;
}

function base64urlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlEncodeFromBase64(base64: string): string {
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function normalizePrivateKey(key: string): string {
  // Handle PEM format with various line endings
  const lines = key.split('\n');
  const normalized: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed === '-----BEGIN RSA PRIVATE KEY-----' || trimmed === '-----END RSA PRIVATE KEY-----') {
      continue;
    }
    if (trimmed.startsWith('-----')) {
      continue;
    }
    normalized.push(trimmed);
  }

  return [
    '-----BEGIN RSA PRIVATE KEY-----',
    normalized.join(''),
    '-----END RSA PRIVATE KEY-----'
  ].join('\n');
}

// ============================================================
// GitHub App Authentication Client
// ============================================================

/**
 * Manages GitHub App authentication and token lifecycle.
 *
 * Tokens are cached and refreshed automatically before expiration.
 * Thread-safe for concurrent access.
 */
export class GitHubAppAuth {
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly apiBaseUrl: string;
  private currentToken: InstallationAccessToken | null = null;
  private readonly tokenRefreshBufferMs: number;

  /**
   * Create a new GitHub App authenticator.
   *
   * @param config - GitHub App configuration
   * @param tokenRefreshBufferMs - Refresh token this many ms before expiry (default: 60s)
   */
  constructor(config: GitHubAppConfig, tokenRefreshBufferMs: number = 60000) {
    if (!config.appId) {
      throw new Error('GitHub App ID is required');
    }
    if (!config.privateKeyPath && !config.privateKeyContent) {
      throw new Error('GitHub App private key is required (either path or content)');
    }

    this.appId = config.appId;
    this.privateKey = this.loadPrivateKey(config);
    this.apiBaseUrl = 'https://api.github.com';
    this.tokenRefreshBufferMs = tokenRefreshBufferMs;
  }

  private loadPrivateKey(config: GitHubAppConfig): string {
    if (config.privateKeyContent) {
      return config.privateKeyContent;
    }

    if (config.privateKeyPath) {
      try {
        const { readFileSync } = require('fs');
        return readFileSync(config.privateKeyPath, 'utf-8');
      } catch (error) {
        throw new Error(`Failed to load GitHub App private key from ${config.privateKeyPath}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }

    throw new Error('No private key available');
  }

  /**
   * Get a valid installation access token, refreshing if necessary.
   *
   * @param installationId - The installation ID to get token for
   * @returns A valid access token
   */
  async getAccessToken(installationId: string): Promise<string> {
    if (this.currentToken && this.isTokenValid()) {
      return this.currentToken.token;
    }

    await this.refreshToken(installationId);
    return this.currentToken!.token;
  }

  private isTokenValid(): boolean {
    if (!this.currentToken) return false;
    // Buffer to refresh before actual expiration
    return this.currentToken.expiresAt.getTime() > Date.now() + this.tokenRefreshBufferMs;
  }

  private async refreshToken(installationId: string): Promise<void> {
    const jwt = createAppJwt(this.appId, this.privateKey);

    const response = await fetch(`${this.apiBaseUrl}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        code: 'AUTHENTICATION_FAILED' as MaterializationErrorCode,
        message: `Failed to obtain GitHub App installation token: ${response.statusText}`,
        statusCode: response.status,
        details: error,
      } as GitHubAppAuthError;
    }

    const data = await response.json() as {
      token: string;
      expires_at: string;
      permissions: Record<string, string>;
    };

    this.currentToken = {
      token: data.token,
      expiresAt: new Date(data.expires_at),
      permissions: data.permissions,
    };
  }

  /**
   * Get information about an installation.
   *
   * @param installationId - The installation ID
   * @returns Installation details
   */
  async getInstallation(installationId: string): Promise<InstallationInfo> {
    const jwt = createAppJwt(this.appId, this.privateKey);

    const response = await fetch(`${this.apiBaseUrl}/app/installations/${installationId}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw {
          code: 'INSTALLATION_NOT_FOUND' as MaterializationErrorCode,
          message: `GitHub App installation ${installationId} not found`,
          statusCode: response.status,
        } as GitHubAppAuthError;
      }
      throw {
        code: 'AUTHENTICATION_FAILED' as MaterializationErrorCode,
        message: `Failed to get installation info: ${response.statusText}`,
        statusCode: response.status,
      } as GitHubAppAuthError;
    }

    return response.json() as Promise<InstallationInfo>;
  }

  /**
   * List installations for this GitHub App.
   *
   * @returns List of installations
   */
  async listInstallations(): Promise<Array<{ id: number; account: { login: string } }>> {
    const jwt = createAppJwt(this.appId, this.privateKey);

    const response = await fetch(`${this.apiBaseUrl}/app/installations`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw {
        code: 'AUTHENTICATION_FAILED' as MaterializationErrorCode,
        message: `Failed to list installations: ${response.statusText}`,
        statusCode: response.status,
      } as GitHubAppAuthError;
    }

    const data = await response.json() as { installations: Array<{ id: number; account: { login: string } }> };
    return data.installations;
  }
}

// ============================================================
// GitHub App Configuration Loader
// ============================================================

export interface LoadGitHubAppConfigOptions {
  /** Environment variable or config key for App ID */
  appIdSource: string | { env?: string; config?: string };
  /** Environment variable or config key for private key path */
  privateKeySource: string | { env?: string; config?: string; default?: string };
  /** Organization to validate against (for tester mode) */
  allowedOrganizations?: string[];
}

/**
 * Load GitHub App configuration from environment/config.
 *
 * This is the safe way to load credentials without hardcoding them.
 */
export function loadGitHubAppConfig(options: LoadGitHubAppConfigOptions): GitHubAppConfig {
  const appId = loadValue(options.appIdSource, 'GITHUB_APP_ID');
  const privateKey = loadPrivateKey(options.privateKeySource);

  return {
    appId,
    privateKeyContent: privateKey,
  };
}

function loadValue(source: string | { env?: string; config?: string }, defaultEnv: string): string {
  if (typeof source === 'string') {
    return source;
  }

  if (source.env && process.env[source.env]) {
    return process.env[source.env]!;
  }

  if (source.config && process.env[source.config]) {
    return process.env[source.config]!;
  }

  return process.env[defaultEnv] || '';
}

function loadPrivateKey(source: string | { env?: string; config?: string; default?: string } | undefined): string {
  if (!source) {
    const envPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    const envContent = process.env.GITHUB_APP_PRIVATE_KEY;

    if (envContent) {
      return envContent;
    }

    if (envPath) {
      const { readFileSync } = require('fs');
      return readFileSync(envPath, 'utf-8');
    }

    throw new Error('GitHub App private key not configured. Set GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH');
  }

  if (typeof source === 'string') {
    const { readFileSync } = require('fs');
    return readFileSync(source, 'utf-8');
  }

  const envPath = source.env ? process.env[source.env] : undefined;
  const envContent = source.config ? process.env[source.config] : undefined;

  if (envContent) {
    return envContent;
  }

  if (envPath) {
    const { readFileSync } = require('fs');
    return readFileSync(envPath, 'utf-8');
  }

  if (source.default) {
    const { readFileSync } = require('fs');
    return readFileSync(source.default, 'utf-8');
  }

  throw new Error('GitHub App private key not configured');
}
