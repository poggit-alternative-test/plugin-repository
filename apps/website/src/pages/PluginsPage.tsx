/**
 * Plugins Page
 *
 * Displays all discovered plugins with filtering and sorting.
 * Uses Tailwind CSS for styling.
 */

import { useState, useEffect, useMemo } from 'react';
import { PluginCard } from '@/components/PluginCard';
import type { Plugin } from '@/types/plugin';

type SortOption = 'stars' | 'name' | 'updated' | 'downloads';
type FilterOption = 'all' | 'verified' | 'unverified';

export function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('stars');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadPlugins() {
      try {
        const response = await fetch('/generated/plugins/index.json');
        if (!response.ok) {
          throw new Error('Failed to load plugins');
        }
        const data = await response.json();
        setPlugins(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPlugins([]);
      } finally {
        setLoading(false);
      }
    }

    loadPlugins();
  }, []);

  // Filter and sort plugins
  const filteredPlugins = useMemo(() => {
    let result = [...plugins];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.plugin.name.toLowerCase().includes(query) ||
        p.plugin.author.toLowerCase().includes(query) ||
        p.repo.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    // Apply verification filter
    if (filterBy === 'verified') {
      result = result.filter(p => p.verification.is_verified);
    } else if (filterBy === 'unverified') {
      result = result.filter(p => !p.verification.is_verified);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'stars':
          return b.stats.stars - a.stats.stars;
        case 'name':
          return a.plugin.name.localeCompare(b.plugin.name);
        case 'updated':
          return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
        case 'downloads':
          const downloadsA = a.release?.assets?.[0]?.downloads || 0;
          const downloadsB = b.release?.assets?.[0]?.downloads || 0;
          return downloadsB - downloadsA;
        default:
          return 0;
      }
    });

    return result;
  }, [plugins, filterBy, sortBy, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const verified = plugins.filter(p => p.verification.is_verified).length;
    const totalDownloads = plugins.reduce(
      (sum, p) => sum + (p.release?.assets?.[0]?.downloads || 0),
      0
    );
    const totalStars = plugins.reduce((sum, p) => sum + p.stats.stars, 0);
    return { verified, totalDownloads, totalStars };
  }, [plugins]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-gray-500 dark:text-gray-400">Loading plugins...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center p-8">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Error Loading Plugins</h2>
        <p className="text-gray-600 dark:text-gray-300">{error}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Make sure the GitHub Actions workflow has run to discover plugins.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Plugin Repository
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-6">
          Discover PocketMine-MP plugins built with pmmp-plugin-actions.
          Verified plugins are built using the official build workflow.
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-8 flex-wrap">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {plugins.length}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Plugins</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.verified}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Verified</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-amber-500">
              ⭐ {stats.totalStars.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Stars</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              📥 {stats.totalDownloads.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Downloads</span>
          </div>
        </div>
      </header>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-4 items-center w-full sm:w-auto">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-300">Filter:</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as FilterOption)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Plugins</option>
              <option value="verified">Verified Only</option>
              <option value="unverified">Unverified Only</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-300">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="stars">Most Stars</option>
              <option value="name">Name (A-Z)</option>
              <option value="updated">Recently Updated</option>
              <option value="downloads">Most Downloads</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Showing {filteredPlugins.length} of {plugins.length} plugins
        {filterBy !== 'all' && ` (${filterBy})`}
      </div>

      {/* Plugin Grid */}
      {filteredPlugins.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No plugins found
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery
              ? 'Try a different search term.'
              : 'No plugins have been discovered yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPlugins.map((plugin) => (
            <PluginCard key={plugin.repo} plugin={plugin} />
          ))}
        </div>
      )}

      {/* Footer info */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Plugins are automatically discovered based on repositories
          using the pmmp-plugin-actions workflow.
          Verification status indicates whether plugins are built
          with the official build system.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Want your plugin listed?
          <a
            href="https://github.com/axolotl-pm/pmmp-plugin-actions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
          >
            Add pmmp-plugin-actions to your repository
          </a>
        </p>
      </div>
    </div>
  );
}
