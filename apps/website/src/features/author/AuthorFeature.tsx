/**
 * AuthorFeature Component
 *
 * Author profile page.
 * Figma tokens: avatar, stats grid, plugin grid, contribution graph.
 */

import { useState } from 'react';
import { useAuthorFeature } from './hooks';
import { LoadingState, ErrorState } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { ContributionGraph } from './components';

export interface AuthorFeatureProps {
  login: string;
}

/** Figma tokens: gradient avatar, 3-column plugin grid */
export function AuthorFeature({ login }: AuthorFeatureProps) {
  const { colors } = useTheme();
  const { author, loading, error } = useAuthorFeature(login);
  const [activeTab, setActiveTab] = useState<'plugins' | 'activity'>('plugins');

  if (loading) {
    return <div style={{ backgroundColor: colors.bg, minHeight: '100vh', padding: '48px 40px' }}>
      <LoadingState message="Loading author..." />
    </div>;
  }

  if (error || !author) {
    return <div style={{ backgroundColor: colors.bg, minHeight: '100vh', padding: '48px 40px' }}>
      <ErrorState title="Author not found" message={error?.message || 'Author not found'} />
    </div>;
  }

  // Extract plugin publish dates for contribution graph
  const pluginDates = author.plugins?.map(p => p.updatedAt) || [];

  return (
    <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 40px' }}>
        {/* Author profile header */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: `linear-gradient(135deg, ${colors.brandLight}, ${colors.brandDark})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {author.login.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>
                {author.profile?.name || author.login}
              </h1>
              {author.verified && (
                <span style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 6,
                  backgroundColor: colors.successBg,
                  color: colors.success,
                }}>
                  ✓ Verified
                </span>
              )}
            </div>
            <p style={{ fontSize: 14, color: colors.textSecondary, margin: 0 }}>@{author.login}</p>
            {author.profile?.bio && (
              <p style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, maxWidth: 480 }}>
                {author.profile.bio}
              </p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          gap: 32,
          padding: '20px 0',
          borderTop: `1px solid ${colors.border}`,
          borderBottom: `1px solid ${colors.border}`,
          marginBottom: 32,
        }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, fontFamily: 'var(--font-mono)' }}>
              {author.statistics.pluginCount}
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted }}>Plugins</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, fontFamily: 'var(--font-mono)' }}>
              {author.statistics.totalDownloads?.toLocaleString() || '0'}
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted }}>Downloads</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, fontFamily: 'var(--font-mono)' }}>
              {author.statistics.versionCount}
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted }}>Releases</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}`, marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab('plugins')}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === 'plugins' ? colors.brand : colors.textSecondary,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'plugins' ? `2px solid ${colors.brand}` : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            Plugins ({author.plugins?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === 'activity' ? colors.brand : colors.textSecondary,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'activity' ? `2px solid ${colors.brand}` : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            Activity
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'plugins' ? (
          /* Plugin grid - Figma: 3 columns */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {author.plugins?.map(p => (
              <a
                key={p.id}
                href={`/plugins/${p.id}`}
                style={{
                  padding: 16, background: colors.card,
                  border: `1px solid ${colors.border}`, borderRadius: 12,
                  textDecoration: 'none',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginBottom: 8 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted }}>{p.summary}</div>
                <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: colors.textMuted }}>
                  v{p.latestVersion}
                </div>
              </a>
            ))}
          </div>
        ) : (
          /* Activity / Contribution Graph */
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 16 }}>
              Contribution Activity
            </h3>
            <div style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 16,
              overflowX: 'auto',
            }}>
              <ContributionGraph pluginDates={pluginDates} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
