/**
 * Generated Types
 *
 * Type definitions for the generated JSON output.
 * These types are derived from the Registry Generator output models.
 *
 * @source @axolotl/registry-generator
 */

// ============================================================
// Manifest
// ============================================================

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

// ============================================================
// Plugin Types
// ============================================================

export type VersionStatus = 'approved' | 'materialized' | 'published' | 'deprecated' | 'revoked' | 'removed';

export interface PluginListItem {
  id: string;
  name: string;
  summary: string;
  latestVersion: string;
  status: VersionStatus;
  author: string;
  repo?: string; // owner/repo format
  repoUrl?: string; // GitHub URL
  downloads?: number;
  updatedAt: string;
}

export interface PluginList {
  plugins: PluginListItem[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface Plugin {
  id: string;
  name: string;
  summary: string;
  description?: string;

  repo?: string; // owner/repo format
  repoUrl?: string; // GitHub URL

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

export interface VersionSummary {
  version: string;
  status: VersionStatus;
  publishedAt: string;
  apiVersion?: string;
}

export interface LatestRelease {
  version: string;
  file: string;
  sha256: string;
  size: number;
  publishedAt: string;
}

// ============================================================
// Version Types
// ============================================================

export type ProvenanceType = 'github-attestation';

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

  revokedAt?: string;
  reason?: string;
  removedAt?: string;
}

// ============================================================
// Author Types
// ============================================================

export interface AuthorListItem {
  login: string;
  pluginCount: number;
  latestUpdate: string;
}

export interface AuthorList {
  authors: AuthorListItem[];
  count: number;
}

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

// ============================================================
// Category Types
// ============================================================

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  pluginCount: number;
}

export interface CategoryList {
  categories: CategoryListItem[];
  count: number;
}

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

// ============================================================
// Search Types
// ============================================================

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

export interface SearchIndex {
  version: number;
  generatedAt: string;
  plugins: SearchIndexEntry[];
  metadata: {
    count: number;
    fields: string[];
  };
}

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

// ============================================================
// README Types
// ============================================================

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
