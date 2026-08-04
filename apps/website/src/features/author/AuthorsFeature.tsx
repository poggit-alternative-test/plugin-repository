/**
 * AuthorsFeature Component
 *
 * Displays a list/grid of all authors.
 * Uses real data from the registry.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import type { AuthorListItem } from '@/services/generated';
import { getAuthors } from '@/services/generated';
import { Search } from 'lucide-react';

export function AuthorsFeature() {
  const { colors } = useTheme();
  const [authors, setAuthors] = useState<AuthorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load authors
  useEffect(() => {
    async function loadAuthors() {
      try {
        setLoading(true);
        setError(null);
        const result = await getAuthors();
        setAuthors(result.authors);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load authors');
      } finally {
        setLoading(false);
      }
    }
    loadAuthors();
  }, []);

  // Filter authors by search query
  const filteredAuthors = authors.filter(author =>
    author.login.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort authors by plugin count (most plugins first)
  const sortedAuthors = [...filteredAuthors].sort(
    (a, b) => b.pluginCount - a.pluginCount
  );

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: colors.textSecondary }}>Loading authors...</div>
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
              Failed to load authors
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
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontSize: 32,
            fontWeight: 700,
            color: colors.textPrimary,
            marginBottom: 8,
            letterSpacing: '-0.02em',
          }}>
            Authors
          </h1>
          <p style={{
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 24,
          }}>
            {authors.length} authors with {authors.reduce((sum, a) => sum + a.pluginCount, 0)} total plugins
          </p>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 400 }}>
            <div style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: colors.textMuted,
              pointerEvents: 'none',
            }}>
              <Search className="h-4 w-4" />
            </div>
            <input
              type="search"
              placeholder="Search authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                paddingLeft: 36,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 14,
                color: colors.textPrimary,
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Authors Grid */}
        {sortedAuthors.length === 0 ? (
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
              No authors found
            </p>
            <p style={{ fontSize: 14, color: colors.textMuted }}>
              {searchQuery ? `No results for "${searchQuery}"` : 'No authors in the registry yet'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {sortedAuthors.map((author) => (
              <Link
                key={author.login}
                to={`/authors/${author.login}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
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
                {/* Avatar */}
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${colors.brandLight}, ${colors.brandDark})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {author.login.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.textPrimary,
                    marginBottom: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {author.login}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: colors.textMuted,
                  }}>
                    {author.pluginCount} plugin{author.pluginCount !== 1 ? 's' : ''} · Updated {formatDate(author.latestUpdate)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
