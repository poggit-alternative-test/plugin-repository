/**
 * Plugins Page
 *
 * Displays all discovered plugins with filtering and sorting.
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { PluginCard } from '@/features/_shared/plugin';
import { getPlugins } from '@/services/generated';
import type { PluginListItem } from '@/services/generated';

type SortOption = 'downloads' | 'name' | 'updated';

export function PluginsPage() {
  const { colors } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plugins, setPlugins] = useState<PluginListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = searchParams.get('q') || '';
  const author = searchParams.get('author') || '';
  const sort = (searchParams.get('sort') as SortOption) || 'downloads';

  useEffect(() => {
    async function loadPlugins() {
      try {
        const result = await getPlugins();
        setPlugins(result.plugins || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plugins');
        setPlugins([]);
      } finally {
        setLoading(false);
      }
    }

    loadPlugins();
  }, []);

  const updateParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams);
  };

  // Filter and sort plugins
  const filteredPlugins = useMemo(() => {
    if (!Array.isArray(plugins)) return [];

    let result = [...plugins];

    // Apply search filter
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.summary?.toLowerCase().includes(q)
      );
    }

    // Apply author filter
    if (author) {
      result = result.filter(p => p.author.toLowerCase() === author.toLowerCase());
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sort) {
        case 'downloads':
          return (b.downloads || 0) - (a.downloads || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          return (b.downloads || 0) - (a.downloads || 0);
      }
    });

    return result;
  }, [plugins, query, author, sort]);

  // Stats
  const stats = useMemo(() => {
    const totalDownloads = plugins.reduce((sum, p) => sum + (p.downloads || 0), 0);
    return { total: plugins.length, totalDownloads };
  }, [plugins]);

  const activeFilterCount = [query, author].filter(Boolean).length;

  if (loading) {
    return (
      <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: colors.textSecondary }}>Loading plugins...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
        <div className="page-container">
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 16, fontWeight: 500, color: colors.error, marginBottom: 8 }}>
              Failed to load plugins
            </p>
            <p style={{ fontSize: 14, color: colors.textMuted }}>
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
      <div className="page-container">
        {/* Header */}
        <header style={{ marginBottom: 32 }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            color: colors.textPrimary,
            marginBottom: 8,
            letterSpacing: '-0.02em',
          }}>
            Plugin Repository
          </h1>
          <p style={{
            fontSize: 14,
            color: colors.textSecondary,
            maxWidth: 600,
          }}>
            Discover PocketMine-MP plugins available in the registry.
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 32, marginTop: 20, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 24, fontWeight: 700, color: colors.brand }}>
                {stats.total}
              </span>
              <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 4 }}>
                Plugins
              </span>
            </div>
            <div>
              <span style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary }}>
                {stats.totalDownloads >= 1000000
                  ? `${(stats.totalDownloads / 1000000).toFixed(1)}M`
                  : stats.totalDownloads >= 1000
                    ? `${(stats.totalDownloads / 1000).toFixed(1)}k`
                    : stats.totalDownloads}
              </span>
              <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 4 }}>
                Downloads
              </span>
            </div>
          </div>
        </header>

        {/* Search & Filters */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginBottom: 24,
        }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', maxWidth: 480 }}>
            <div style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              color: colors.textMuted,
              pointerEvents: 'none',
            }}>
              <Search className="h-5 w-5" />
            </div>
            <input
              type="search"
              placeholder="Search plugins..."
              value={query}
              onChange={(e) => updateParams({ q: e.target.value || null })}
              style={{
                width: '100%',
                padding: '12px 18px',
                paddingLeft: 48,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                fontSize: 14,
                color: colors.textPrimary,
                outline: 'none',
              }}
            />
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: colors.textMuted }}>Sort by:</span>
              <select
                value={sort}
                onChange={(e) => updateParams({ sort: e.target.value })}
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  color: colors.textPrimary,
                  outline: 'none',
                }}
              >
                <option value="downloads">Most Downloads</option>
                <option value="name">Name (A-Z)</option>
                <option value="updated">Recently Updated</option>
              </select>
            </div>

            {/* Author Filter */}
            <input
              type="text"
              placeholder="Filter by author..."
              value={author}
              onChange={(e) => updateParams({ author: e.target.value || null })}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                color: colors.textPrimary,
                outline: 'none',
                width: 160,
              }}
            />

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => updateParams({ q: null, author: null })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 12px',
                  fontSize: 12,
                  color: colors.brand,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>
          Showing {filteredPlugins.length} of {plugins.length} plugins
        </div>

        {/* Plugin Grid */}
        {filteredPlugins.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 16, fontWeight: 500, color: colors.textPrimary, marginBottom: 8 }}>
              No plugins found
            </p>
            <p style={{ fontSize: 14, color: colors.textMuted }}>
              {query || author ? 'Try adjusting your search or filters.' : 'No plugins have been discovered yet.'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {filteredPlugins.map((plugin) => (
              <PluginCard key={plugin.id} plugin={plugin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
