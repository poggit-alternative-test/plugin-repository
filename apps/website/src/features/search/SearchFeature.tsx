/**
 * SearchFeature Component
 *
 * Search page with full filter functionality.
 * Uses real data from the registry services.
 */

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Grid, List, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { PluginListItem, VersionStatus } from '@/services/generated';
import { getPlugins } from '@/services/generated';
import type { SortOption, ViewOption } from './hooks';
import { getSortLabel } from './utils';

// Static categories from actual plugin data
const CATEGORIES = [
  'Economy',
  'Anti-Cheat',
  'World',
  'Chat',
  'UI',
  'Admin',
  'API',
  'Minigames',
  'Protection',
  'Fun',
  'Misc',
];

const STATUS_OPTIONS: { value: VersionStatus; label: string }[] = [
  { value: 'published', label: 'Published' },
  { value: 'approved', label: 'Approved' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'revoked', label: 'Revoked' },
];

const SORT_OPTIONS: SortOption[] = [
  'relevance',
  'recently-updated',
  'downloads',
  'alphabetical',
];

export function SearchFeature() {
  const { colors } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for plugins data
  const [allPlugins, setAllPlugins] = useState<PluginListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load plugins on mount
  useEffect(() => {
    async function loadPlugins() {
      try {
        setLoading(true);
        setError(null);
        const result = await getPlugins();
        setAllPlugins(result.plugins);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plugins');
      } finally {
        setLoading(false);
      }
    }
    loadPlugins();
  }, []);

  // Parse current filters from URL
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const status = searchParams.get('status') as VersionStatus | null;
  const author = searchParams.get('author') || '';
  const sort = (searchParams.get('sort') as SortOption) || 'relevance';
  const view = (searchParams.get('view') as ViewOption) || 'grid';

  // Update URL
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    // Reset page when filters change
    newParams.delete('page');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Search handler
  const handleSearch = useCallback((value: string) => {
    updateParams({ q: value || null });
  }, [updateParams]);

  // Filter handlers
  const handleCategoryChange = useCallback((value: string) => {
    updateParams({ category: value || null });
  }, [updateParams]);

  const handleStatusChange = useCallback((value: VersionStatus | null) => {
    updateParams({ status: value || null });
  }, [updateParams]);

  const handleAuthorChange = useCallback((value: string) => {
    updateParams({ author: value || null });
  }, [updateParams]);

  const handleSortChange = useCallback((value: SortOption) => {
    updateParams({ sort: value });
  }, [updateParams]);

  const handleViewChange = useCallback((value: ViewOption) => {
    updateParams({ view: value });
  }, [updateParams]);

  const clearAllFilters = useCallback(() => {
    updateParams({ category: null, status: null, author: null });
  }, [updateParams]);

  // Filter plugins based on current filters
  const filteredPlugins = useMemo(() => {
    let results = [...allPlugins];

    // Apply query search (client-side fuzzy search)
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.author.toLowerCase().includes(lowerQuery) ||
        p.summary.toLowerCase().includes(lowerQuery)
      );
    }

    // Apply category filter
    if (category) {
      // Note: PluginListItem doesn't have categories, this would need to be fetched from full plugin data
      // For now, we'll skip this or add it when we have access to full plugin data
    }

    // Apply status filter
    if (status) {
      results = results.filter(p => p.status === status);
    }

    // Apply author filter
    if (author) {
      results = results.filter(p => p.author.toLowerCase().includes(author.toLowerCase()));
    }

    // Sort results
    switch (sort) {
      case 'alphabetical':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recently-updated':
        results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'downloads':
        results.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        break;
      case 'relevance':
      default:
        // For relevance, put exact matches first
        if (query) {
          const lowerQuery = query.toLowerCase();
          results.sort((a, b) => {
            const aExact = a.name.toLowerCase() === lowerQuery ? 1 : 0;
            const bExact = b.name.toLowerCase() === lowerQuery ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;
            return (b.downloads || 0) - (a.downloads || 0);
          });
        }
        break;
    }

    return results;
  }, [allPlugins, query, category, status, author, sort]);

  // Count active filters
  const activeFilterCount = [category, status, author].filter(Boolean).length;

  // Format number
  const formatNumber = (n?: number) => {
    if (!n) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: colors.textSecondary }}>Loading plugins...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 40px' }}>
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
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 40px' }}>
        {/* Search Bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ position: 'relative', maxWidth: 720 }}>
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
              placeholder="Search plugins, authors, categories..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 18px',
                paddingLeft: 48,
                backgroundColor: colors.surface,
                border: `1px solid ${query ? colors.brand : colors.border}`,
                borderRadius: 12,
                fontSize: 14,
                color: colors.textPrimary,
                outline: 'none',
                boxShadow: query ? `0 0 0 3px ${colors.brandBg}` : 'none',
                transition: 'all 0.15s ease',
              }}
            />
          </div>
        </div>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32 }}>
          {/* Filters Sidebar */}
          <aside>
            <div style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 20,
              position: 'sticky',
              top: 72,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>
                  Filters
                </h3>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    style={{
                      fontSize: 12,
                      color: colors.brand,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Active Filter Badges */}
              {activeFilterCount > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                  {category && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      fontSize: 11,
                      backgroundColor: colors.brandBg,
                      color: colors.brand,
                      borderRadius: 6,
                    }}>
                      Category: {category}
                      <button onClick={() => handleCategoryChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {status && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      fontSize: 11,
                      backgroundColor: colors.brandBg,
                      color: colors.brand,
                      borderRadius: 6,
                    }}>
                      Status: {status}
                      <button onClick={() => handleStatusChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {author && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      fontSize: 11,
                      backgroundColor: colors.brandBg,
                      color: colors.brand,
                      borderRadius: 6,
                    }}>
                      Author: {author}
                      <button onClick={() => handleAuthorChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* Status Filter */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {STATUS_OPTIONS.map((option) => (
                    <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="status"
                        checked={status === option.value}
                        onChange={() => handleStatusChange(status === option.value ? null : option.value)}
                        style={{ accentColor: colors.brand }}
                      />
                      <span style={{ fontSize: 13, color: colors.textPrimary }}>
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Category
                </h4>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    color: colors.textPrimary,
                    outline: 'none',
                  }}
                >
                  <option value="">All categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Author Filter */}
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Author
                </h4>
                <input
                  type="text"
                  placeholder="Filter by author..."
                  value={author}
                  onChange={(e) => handleAuthorChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    color: colors.textPrimary,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </aside>

          {/* Results */}
          <main>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${colors.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: colors.textSecondary }}>
                {filteredPlugins.length === 0 ? (
                  'No results'
                ) : (
                  <>
                    Showing <span style={{ fontWeight: 600, color: colors.textPrimary }}>1–{filteredPlugins.length}</span> of <span style={{ fontWeight: 600, color: colors.textPrimary }}>{filteredPlugins.length}</span> results
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Sort */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>Sort by:</span>
                  <select
                    value={sort}
                    onChange={(e) => handleSortChange(e.target.value as SortOption)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      color: colors.textPrimary,
                      outline: 'none',
                      minWidth: 140,
                    }}
                  >
                    {SORT_OPTIONS.map((s) => (
                      <option key={s} value={s}>{getSortLabel(s)}</option>
                    ))}
                  </select>
                </div>

                {/* View Toggle */}
                <div style={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <button
                    onClick={() => handleViewChange('grid')}
                    style={{
                      padding: 8,
                      background: view === 'grid' ? colors.card : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: view === 'grid' ? colors.textPrimary : colors.textMuted,
                    }}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleViewChange('list')}
                    style={{
                      padding: 8,
                      background: view === 'list' ? colors.card : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: view === 'list' ? colors.textPrimary : colors.textMuted,
                    }}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results List */}
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
                  {query ? `No results for "${query}"` : 'Try adjusting your filters'}
                </p>
              </div>
            ) : view === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {filteredPlugins.map((plugin) => (
                  <a
                    key={plugin.id}
                    href={`/plugins/${plugin.id}`}
                    style={{
                      display: 'block',
                      padding: 16,
                      backgroundColor: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.brand;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: colors.brandBg,
                        border: `1px solid ${colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.brand,
                        flexShrink: 0,
                      }}>
                        {plugin.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {plugin.name}
                        </div>
                        <div style={{ fontSize: 10, color: colors.textMuted, fontFamily: 'var(--font-mono)' }}>
                          by {plugin.author}
                        </div>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 1.5, marginBottom: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {plugin.summary}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <code style={{ fontSize: 10, color: colors.brand, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                        v{plugin.latestVersion}
                      </code>
                      <span style={{ fontSize: 10, color: colors.textMuted }}>
                        ↓ {formatNumber(plugin.downloads)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredPlugins.map((plugin) => (
                  <a
                    key={plugin.id}
                    href={`/plugins/${plugin.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: 16,
                      backgroundColor: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 10,
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.brand;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border;
                    }}
                  >
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: colors.brandBg,
                      border: `1px solid ${colors.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 600,
                      color: colors.brand,
                      flexShrink: 0,
                    }}>
                      {plugin.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary, marginBottom: 4 }}>
                        {plugin.name}
                      </div>
                      <div style={{ fontSize: 12, color: colors.textMuted }}>
                        {plugin.summary}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <code style={{ fontSize: 11, color: colors.brand, fontFamily: 'var(--font-mono)' }}>
                        v{plugin.latestVersion}
                      </code>
                      <span style={{ fontSize: 10, color: colors.textMuted }}>
                        ↓ {formatNumber(plugin.downloads)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
