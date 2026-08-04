/**
 * Generated JSON Client
 *
 * Responsible for loading JSON files from the generated directory.
 *
 * Architecture:
 * - All JSON loading MUST go through this client
 * - No page may call fetch() directly
 * - Client is prepared for future API migration
 *
 * Future: Replace this client with an HTTP-based API client
 * with minimal changes to the service layer.
 */

/**
 * Data source configuration
 *
 * Can be either:
 * - Static JSON files (current)
 * - Remote API endpoint (future)
 */
export interface DataSourceConfig {
  /** Base path to generated JSON files */
  basePath: string;
  /** Whether to use API instead of static files */
  useApi?: boolean;
  /** API base URL when useApi is true */
  apiBaseUrl?: string;
}

/**
 * Default configuration for static JSON files
 *
 * Assumes generated files are in /generated/ at the app root
 */
const DEFAULT_CONFIG: DataSourceConfig = {
  basePath: `${import.meta.env.BASE_URL}generated`,
  useApi: false,
};

/**
 * Current data source configuration
 */
let currentConfig: DataSourceConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the data source
 *
 * @example
 * // Use static JSON files (default)
 * configureDataSource({ basePath: `${import.meta.env.BASE_URL}generated` });
 *
 * // Use remote API (future)
 * configureDataSource({
 *   useApi: true,
 *   apiBaseUrl: 'https://api.example.com'
 * });
 */
export function configureDataSource(config: Partial<DataSourceConfig>): void {
  currentConfig = { ...DEFAULT_CONFIG, ...config };
}

/**
 * Get current data source configuration
 */
export function getDataSourceConfig(): DataSourceConfig {
  return { ...currentConfig };
}

/**
 * Cache for loaded JSON data
 *
 * In-memory cache to avoid redundant fetches.
 * Could be replaced with SWR/React Query in the future.
 */
const cache = new Map<string, unknown>();

/**
 * Clear the cache
 *
 * Useful for testing or when data is refreshed.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Check if data is cached
 */
export function isCached(key: string): boolean {
  return cache.has(key);
}

/**
 * Get cached data if available
 */
export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

/**
 * Cache data
 */
function setCache<T>(key: string, data: T): T {
  cache.set(key, data);
  return data;
}

/**
 * Build URL for a generated JSON file
 */
function buildUrl(path: string): string {
  const base = currentConfig.basePath.replace(/\/$/, '');
  const filePath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}/${filePath}`;
}

/**
 * Error for missing generated files
 * Used internally to signal that a file doesn't exist but should use defaults
 */
export class MissingFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingFileError';
  }
}

/**
 * Load JSON from a file
 *
 * @param path - Path to the JSON file relative to basePath
 * @param useCache - Whether to use cached data (default: true)
 * @returns Parsed JSON data
 * @throws MissingFileError if file is missing or returns invalid JSON (can be caught to use defaults)
 */
export async function loadJson<T>(path: string, useCache = true): Promise<T> {
  // Check cache first
  if (useCache && cache.has(path)) {
    return cache.get(path) as T;
  }

  const url = buildUrl(path);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new MissingFileError(`File not found: ${url}`);
    }

    const text = await response.text();

    // Validate that the response is valid JSON
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      // Response is HTML or other non-JSON content, treat as missing
      throw new MissingFileError(`Invalid JSON in: ${url}`);
    }

    const data = JSON.parse(text) as T;

    if (useCache) {
      return setCache(path, data);
    }

    return data;
  } catch (error) {
    // Re-throw MissingFileError for SDK to handle
    if (error instanceof MissingFileError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      // JSON parse error - treat as missing file
      throw new MissingFileError(`Invalid JSON in: ${url}`);
    }
    if (error instanceof Error) {
      throw new Error(`Failed to load JSON from ${url}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if a generated file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  const url = buildUrl(path);
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Load JSON synchronously from cache
 *
 * Returns cached data without fetching.
 * Use this only for data that has been preloaded.
 */
export function loadCached<T>(path: string): T | undefined {
  return cache.get(path) as T | undefined;
}

/**
 * Preload JSON data into cache
 *
 * Use this to warm up the cache during app initialization.
 */
export async function preload(paths: string[]): Promise<void> {
  await Promise.all(paths.map((path) => loadJson(path)));
}

/**
 * Client interface for future API migration
 *
 * This interface should be implemented by both
 * the JSON client and future HTTP clients.
 */
export interface GeneratedClient {
  /** Load manifest data */
  getManifest: () => Promise<import('./types').Manifest>;

  /** Load plugin list */
  getPluginList: () => Promise<import('./types').PluginList>;

  /** Load single plugin */
  getPlugin: (id: string) => Promise<import('./types').Plugin>;

  /** Load single version */
  getVersion: (pluginId: string, version: string) => Promise<import('./types').Version>;

  /** Load author list */
  getAuthorList: () => Promise<import('./types').AuthorList>;

  /** Load single author */
  getAuthor: (login: string) => Promise<import('./types').Author>;

  /** Load search index */
  getSearchIndex: () => Promise<import('./types').SearchIndex>;

  /** Load popular plugins */
  getPopularPlugins: () => Promise<import('./types').PopularPlugins>;
}
