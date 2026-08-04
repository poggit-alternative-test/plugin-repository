/**
 * Generated Output Models
 *
 * These types define the exact JSON structure produced by the generator.
 * They are designed to be consumed by the Website.
 */

/**
 * Manifest - Global metadata about the generated dataset
 */
export interface Manifest {
  schemaVersion: number;
  generatedAt: string;
  registryCommit: string;
  generatorVersion: string;
  pluginCount: number;
  versionCount: number;
  authorCount: number;
  categoryCount: number;
  indexes: {
    plugins: string;
    versions: string;
    search: string;
    authors: string;
    categories?: string;
  };
}

/**
 * Plugin list item for lightweight browsing
 */
export interface PluginListItem {
  id: string;
  name: string;
  summary: string;
  latestVersion: string;
  status: VersionStatus;
  author: string;
  downloads?: number;
  updatedAt: string;
}

/**
 * Plugin list with pagination
 */
export interface PluginList {
  plugins: PluginListItem[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Complete plugin data for detail pages
 */
export interface Plugin {
  id: string;
  name: string;
  summary: string;
  description?: string;

  upstream: {
    repository: string;
    branch: string;
  };

  storage?: {
    repository: string;
  };

  author: string;

  status: VersionStatus;

  versions: VersionSummary[];

  latestVersion: string;

  latestRelease?: LatestRelease;

  categories?: string[];

  tags?: string[];

  license?: string;

  homepage?: string;
  issues?: string;
  source?: string;

  downloads?: {
    total: number;
    monthly?: number;
    weekly?: number;
  };

  verified?: {
    githubAttestation: boolean;
    reviewer?: string;
  };

  metadata?: {
    mainClass?: string;
    apiVersion?: string;
    loadOrder?: string;
    dependencies?: Record<string, string>;
  };

  createdAt: string;
  updatedAt: string;
}

/**
 * Version status values
 */
export type VersionStatus = 'approved' | 'materialized' | 'published' | 'deprecated' | 'revoked' | 'removed';

/**
 * Version summary for plugin version list
 */
export interface VersionSummary {
  version: string;
  status: VersionStatus;
  publishedAt: string;
  apiVersion?: string;
}

/**
 * Latest release information (duplicated in plugin for performance)
 */
export interface LatestRelease {
  version: string;
  file: string;
  sha256: string;
  size: number;
  publishedAt: string;
}

/**
 * Complete version data for version pages
 */
export interface Version {
  plugin: string;
  version: string;

  status: VersionStatus;
  apiVersion?: string;

  release: {
    tag: string;
    publishedAt: string;
    changelog?: string;
  };

  artifact: {
    file: string;
    sha256: string;
    size: number;
    downloadUrl: string;
  };

  checksums?: {
    sha256: string;
    sha512?: string;
    md5?: string;
  };

  review: {
    pullRequest: number;
    reviewer: string;
    approvedAt: string;
  };

  storage: {
    repository: string;
    commit: string;
  };

  source: {
    upstream: string;
    commit: string;
  };

  provenance?: {
    type: ProvenanceType;
    verified: boolean;
  };

  dependencies?: {
    runtime?: Record<string, string>;
    suggested?: Record<string, string>;
  };

  manifest?: {
    name: string;
    version: string;
    main?: string;
    api?: string;
    loadOrder?: string;
    author?: string;
    description?: string;
  };

  readme?: string;

  // Lifecycle metadata for revoked/removed versions
  revokedAt?: string;
  reason?: string;
  removedAt?: string;
}

/**
 * Provenance type values
 */
export type ProvenanceType = 'github-attestation';

/**
 * Author list item
 */
export interface AuthorListItem {
  login: string;
  pluginCount: number;
  latestUpdate: string;
}

/**
 * Author list
 */
export interface AuthorList {
  authors: AuthorListItem[];
  count: number;
}

/**
 * Complete author profile
 */
export interface Author {
  login: string;

  profile?: {
    name?: string;
    bio?: string;
    avatar?: string;
    github?: string;
  };

  plugins: PluginListItem[];

  statistics: {
    pluginCount: number;
    versionCount: number;
    totalDownloads?: number;
    firstPluginAt?: string;
  };

  verified?: boolean;
}

/**
 * Category list item
 */
export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  pluginCount: number;
}

/**
 * Category list
 */
export interface CategoryList {
  categories: CategoryListItem[];
  count: number;
}

/**
 * Complete category with plugins
 */
export interface Category {
  id: string;
  name: string;
  slug: string;

  plugins: PluginListItem[];

  relatedCategories?: string[];

  metadata?: {
    description?: string;
    icon?: string;
    color?: string;
  };
}

/**
 * Search index entry
 */
export interface SearchIndexEntry {
  id: string;
  name: string;
  nameNormalized: string;
  nameKeywords: string[];
  summary: string;
  description?: string;
  author: string;
  authorNormalized: string;
  categories: string[];
  tags: string[];
  tagsNormalized: string[];
  versionCount: number;
  latestVersion: string;
  status: VersionStatus;
  license?: string;
  downloads?: number;
  popularity?: number;
  updatedAt: string;
}

/**
 * Full search index
 */
export interface SearchIndex {
  version: number;
  generatedAt: string;
  plugins: SearchIndexEntry[];
  metadata: {
    count: number;
    fields: string[];
  };
}

/**
 * Popular/trending plugins
 */
export interface PopularPlugins {
  trending: {
    id: string;
    score: number;
    delta?: string;
  }[];
  recentlyUpdated: {
    id: string;
    version: string;
    updatedAt: string;
  }[];
  newPlugins?: {
    id: string;
    createdAt: string;
  }[];
}

/**
 * README content (Markdown only)
 */
export interface Readme {
  plugin: string;
  version: string;
  content: string;
  sections?: {
    id: string;
    title: string;
    level: number;
  }[];
  links?: {
    text: string;
    url: string;
  }[];
  images?: {
    alt: string;
    url: string;
  }[];
}

/**
 * Generator options
 */
export interface GeneratorOptions {
  registryPath: string;
  outputPath: string;
  websitePath?: string;
  version?: string;
}
