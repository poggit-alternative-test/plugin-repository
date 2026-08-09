/**
 * M5 Tester Transport Configuration
 *
 * This module provides configuration for the tester transport that
 * restricts operations to the designated tester organization only.
 *
 * SAFETY: This configuration makes it IMPOSSIBLE to accidentally target
 * production organizations (axolotl-pm, axolotl-pm-pl).
 *
 * Test organization: poggit-alternative-test
 */

import type { RepositoryIdentity } from './materialization-types.js';

/**
 * Tester mode configuration.
 *
 * When tester mode is enabled:
 * - All storage operations are restricted to the allowed organizations list
 * - No operations can target production organizations
 * - Configuration explicitly controls what is allowed
 */
export interface TesterTransportConfig {
  /**
   * Whether tester mode is enabled.
   * When false, no writes are permitted.
   */
  enabled: boolean;

  /**
   * Explicit list of allowed storage owners for tester mode.
   * This list MUST contain only the tester organization.
   *
   * @example ['poggit-alternative-test']
   */
  allowedStorageOwners: readonly string[];

  /**
   * Whether to allow repository creation in tester mode.
   * Should be explicitly controlled.
   */
  allowRepositoryCreation: boolean;

  /**
   * Optional: GitHub App configuration for tester mode.
   * When provided, uses GitHub App authentication.
   * When undefined, uses read-only mode.
   */
  githubAppConfig?: {
    appId: string;
    privateKeyPath?: string;
    privateKeyContent?: string;
    installationId?: string;
    /** Map of org → installation ID for automatic discovery */
    installationIdByOrg?: Record<string, string>;
  };

  /**
   * Rate limit configuration for tester mode.
   */
  rateLimit?: {
    /** Maximum requests per minute */
    maxRequestsPerMinute?: number;
    /** Maximum retries for transient failures */
    maxRetries?: number;
    /** Base delay for exponential backoff in ms */
    baseRetryDelayMs?: number;
  };

  /**
   * Testing-specific overrides (for integration testing).
   */
  testOverrides?: {
    /** Override the API base URL (for mock/test servers) */
    apiBaseUrl?: string;
    /** Override the access token (for testing with mocks) */
    accessToken?: string;
  };
}

/**
 * Production organization blocklist.
 *
 * These organizations MUST NEVER be targeted by the tester transport.
 * This is a defense-in-depth measure.
 */
export const PRODUCTION_ORGANIZATIONS: readonly string[] = Object.freeze([
  'axolotl-pm',
  'axolotl-pm-pl',
  'axolotl-pm-plugins',
  'axolotl-pm-reviews',
]);

/**
 * The ONLY organization allowed for tester mode.
 */
export const TESTER_ORGANIZATION = 'poggit-alternative-test';

/**
 * Default tester transport configuration.
 *
 * This configuration:
 * - Enables tester mode
 * - Restricts to ONLY poggit-alternative-test
 * - Blocks all production organizations
 * - Does NOT allow repository creation by default (requires explicit githubAppConfig)
 * - Uses conservative rate limits
 */
export const DEFAULT_TESTER_CONFIG: TesterTransportConfig = {
  enabled: true,
  allowedStorageOwners: [TESTER_ORGANIZATION],
  allowRepositoryCreation: false,
  rateLimit: {
    maxRequestsPerMinute: 30,
    maxRetries: 3,
    baseRetryDelayMs: 1000,
  },
};

/**
 * Read-only tester configuration (no writes).
 */
export const READONLY_TESTER_CONFIG: TesterTransportConfig = {
  enabled: true,
  allowedStorageOwners: [TESTER_ORGANIZATION],
  allowRepositoryCreation: false,
  rateLimit: {
    maxRequestsPerMinute: 60,
    maxRetries: 3,
    baseRetryDelayMs: 1000,
  },
};

/**
 * Validate that a repository identity is allowed for tester mode.
 *
 * @param repository - The repository identity to validate
 * @param config - The tester transport configuration
 * @returns true if the repository is allowed, false otherwise
 */
export function isAllowedTesterRepository(
  repository: RepositoryIdentity,
  config: TesterTransportConfig
): boolean {
  const owner = String(repository).split('/')[0]?.toLowerCase() ?? '';

  // First, check the blocklist (defense in depth)
  if (PRODUCTION_ORGANIZATIONS.some(org => owner === org.toLowerCase())) {
    return false;
  }

  // Then, check the allowlist
  return config.allowedStorageOwners
    .map(o => o.toLowerCase())
    .includes(owner);
}

/**
 * Validate a storage owner for tester mode.
 *
 * @param owner - The storage owner to validate
 * @param config - The tester transport configuration
 * @returns true if the owner is allowed, false otherwise
 */
export function isAllowedTesterOwner(
  owner: string,
  config: TesterTransportConfig
): boolean {
  const normalizedOwner = owner.toLowerCase();

  // First, check the blocklist (defense in depth)
  if (PRODUCTION_ORGANIZATIONS.some(org => normalizedOwner === org.toLowerCase())) {
    return false;
  }

  // Then, check the allowlist
  return config.allowedStorageOwners
    .map(o => o.toLowerCase())
    .includes(normalizedOwner);
}

/**
 * Load tester configuration from environment variables.
 *
 * Environment variables:
 * - M5_TESTER_ENABLED: Set to 'true' to enable tester mode
 * - M5_TESTER_ALLOWED_ORGS: Comma-separated list of allowed organizations
 * - M5_TESTER_ALLOW_REPO_CREATION: Set to 'true' to allow repo creation
 * - M5_GITHUB_APP_ID: GitHub App ID
 * - M5_GITHUB_APP_PRIVATE_KEY_PATH: Path to private key file
 *
 * @returns Tester transport configuration from environment
 */
export function loadTesterConfigFromEnv(): TesterTransportConfig {
  const enabled = process.env.M5_TESTER_ENABLED === 'true';

  if (!enabled) {
    return {
      enabled: false,
      allowedStorageOwners: [],
      allowRepositoryCreation: false,
    };
  }

  // Parse allowed organizations
  let allowedOwners: readonly string[];
  const orgsEnv = process.env.M5_TESTER_ALLOWED_ORGS;
  if (orgsEnv) {
    allowedOwners = orgsEnv.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    // Default to tester org only
    allowedOwners = [TESTER_ORGANIZATION];
  }

  // Validate no production orgs in the list
  const hasProductionOrg = allowedOwners.some(owner =>
    PRODUCTION_ORGANIZATIONS.some(org => owner.toLowerCase() === org.toLowerCase())
  );
  if (hasProductionOrg) {
    throw new Error(
      `Tester configuration must not include production organizations. ` +
      `Found production orgs in: ${allowedOwners.join(', ')}. ` +
      `Only ${TESTER_ORGANIZATION} is allowed.`
    );
  }

  // Parse GitHub App configuration
  const appId = process.env.M5_GITHUB_APP_ID;
  const privateKeyPath = process.env.M5_GITHUB_APP_PRIVATE_KEY_PATH;
  const privateKeyContent = process.env.M5_GITHUB_APP_PRIVATE_KEY;

  // Check for direct access token (for testing with PAT)
  const accessToken = process.env.MAT_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.M5_ACCESS_TOKEN;

  // Safe JSON parse for installation ID mapping
  let installationIdByOrg: Record<string, string> | undefined;
  const rawMapping = process.env.M5_GITHUB_APP_INSTALLATION_ID_BY_ORG;
  if (rawMapping) {
    try {
      const parsed = JSON.parse(rawMapping);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Must be a JSON object');
      }
      // Validate all values are non-empty strings
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof key !== 'string' || !key) {
          throw new Error('All keys must be non-empty strings');
        }
        if (typeof value !== 'string' || !value) {
          throw new Error(`Installation ID for "${key}" must be a non-empty string`);
        }
      }
      installationIdByOrg = parsed as Record<string, string>;
    } catch (error) {
      throw new Error(
        `Invalid M5_GITHUB_APP_INSTALLATION_ID_BY_ORG: ${error instanceof Error ? error.message : 'unknown error'}. ` +
        `Value: "${rawMapping.substring(0, 100)}${rawMapping.length > 100 ? '...' : ''}"`
      );
    }
  }

  return {
    enabled: true,
    allowedStorageOwners: allowedOwners,
    allowRepositoryCreation: process.env.M5_TESTER_ALLOW_REPO_CREATION === 'true',
    githubAppConfig: appId ? {
      appId,
      privateKeyPath,
      privateKeyContent,
      installationId: process.env.M5_GITHUB_APP_INSTALLATION_ID,
      installationIdByOrg,
    } : undefined,
    // Allow access token for testing
    testOverrides: accessToken ? { accessToken } : undefined,
    rateLimit: {
      maxRequestsPerMinute: parseInt(process.env.M5_RATE_LIMIT_MAX_PER_MINUTE || '30', 10),
      maxRetries: parseInt(process.env.M5_RATE_LIMIT_MAX_RETRIES || '3', 10),
      baseRetryDelayMs: parseInt(process.env.M5_RATE_LIMIT_BASE_DELAY_MS || '1000', 10),
    },
  };
}

/**
 * Validate that tester configuration is safe for E2E testing.
 *
 * This function checks that:
 * 1. Tester mode is enabled
 * 2. Only the tester organization is allowed
 * 3. No production organizations are in the allowed list
 * 4. Configuration is complete (has GitHub App credentials if writes enabled)
 *
 * @param config - The tester transport configuration
 * @returns Validation result with any errors found
 */
export function validateTesterConfig(config: TesterTransportConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.enabled) {
    errors.push('Tester mode is not enabled. Set M5_TESTER_ENABLED=true to enable.');
    return { valid: false, errors, warnings };
  }

  // Check that only tester org is in allowed list
  const allowedOrgs = config.allowedStorageOwners.map(o => o.toLowerCase());
  const hasTestOrg = allowedOrgs.includes(TESTER_ORGANIZATION.toLowerCase());
  const hasProductionOrg = allowedOrgs.some(org =>
    PRODUCTION_ORGANIZATIONS.some(prod => org === prod.toLowerCase())
  );

  if (!hasTestOrg) {
    errors.push(`${TESTER_ORGANIZATION} must be in the allowed organizations list.`);
  }

  if (hasProductionOrg) {
    errors.push('Production organizations are not allowed in tester mode.');
  }

  // If repo creation is allowed, require GitHub App config
  if (config.allowRepositoryCreation) {
    if (!config.githubAppConfig?.appId) {
      errors.push('Repository creation requires GitHub App configuration (M5_GITHUB_APP_ID).');
    }
  }

  // Warnings for potentially risky configurations
  if (config.allowedStorageOwners.length > 1) {
    warnings.push(`Multiple organizations are allowed: ${config.allowedStorageOwners.join(', ')}. Ensure this is intentional for testing.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
