/**
 * Plugin data types
 */

export interface PluginStats {
  stars: number;
  forks: number;
  open_issues: number;
  watchers: number;
}

export interface PluginRelease {
  tag: string;
  name: string;
  url: string;
  published_at: string;
  is_draft: boolean;
  is_prerelease: boolean;
  body?: string;
  assets: PluginAsset[];
}

export interface PluginAsset {
  name: string;
  download_url: string;
  size: number;
  downloads: number;
}

export interface PluginVerification {
  is_verified: boolean;
  verified_at: string | null;
  workflow_name: string | null;
  workflow_info: string;
}

export interface Plugin {
  repo: string;
  repo_url: string;
  description: string;
  plugin: {
    name: string;
    version: string;
    api: string;
    author: string;
    main?: string;
  };
  stats: PluginStats;
  release: PluginRelease | null;
  verification: PluginVerification;
  last_updated: string;
  created_at: string;
}

export interface PluginList {
  updated_at: string;
  total: number;
  verified: number;
  plugins: Plugin[];
}
