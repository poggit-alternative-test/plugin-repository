/**
 * HomeFeatured Component
 *
 * Grid of featured/trending plugins.
 * Matches Figma design exactly:
 * - Section Title: "Featured Plugins" (fontSize:18, fontWeight:600)
 * - View All Link
 * - Grid: gridTemplateColumns:repeat(3, 1fr), gap:12
 * - Card: padding:16px, borderRadius:12px
 */

import { Link } from '@/components/ui';
import { PluginIcon } from '@/features/_shared/plugin';
import type { PluginListItem } from '@/services/generated';
import { useTheme } from '@/contexts/ThemeContext';

export interface HomeFeaturedProps {
  /** Featured/trending plugins from real data */
  plugins: PluginListItem[];
  /** Link to view all */
  viewAllLink?: string;
}

/**
 * Figma tokens:
 * - Grid: repeat(3, 1fr), gap 12px
 * - Card: padding 16px, borderRadius 12px
 * - Title: 13px, fontWeight 600
 */
export function HomeFeatured({ plugins, viewAllLink }: HomeFeaturedProps) {
  const { colors } = useTheme();

  if (plugins.length === 0) return null;

  return (
    <section>
      {/* Section header - Figma tokens */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: colors.textPrimary,
            margin: 0,
          }}
        >
          Featured Plugins
        </h2>
        {viewAllLink && (
          <Link
            to={viewAllLink}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: colors.brand,
              textDecoration: 'none',
            }}
          >
            View all →
          </Link>
        )}
      </div>

      {/* Plugin grid - Figma: 3 columns, gap 12px */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        {plugins.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} />
        ))}
      </div>
    </section>
  );
}

/**
 * Plugin card using real data
 * Matches Figma tokens:
 * - padding: 16px
 * - borderRadius: 12px
 * - Icon: 32x32, borderRadius: 8
 * - Title: 13px, fontWeight 600
 * - Author: 10px, mono font
 */
function PluginCard({ plugin }: { plugin: PluginListItem }) {
  const { colors } = useTheme();

  const formatDownloads = (dl?: number) => {
    if (!dl) return '—';
    if (dl >= 1000000) return `${(dl / 1000000).toFixed(1)}M`;
    if (dl >= 1000) return `${(dl / 1000).toFixed(1)}k`;
    return dl.toString();
  };

  return (
    <Link
      to={`/plugins/${plugin.id}`}
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
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <PluginIcon repo={plugin.repo} name={plugin.name} size={32} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 2,
            }}
          >
            {plugin.name}
          </div>
          <div
            style={{
              fontSize: 10,
              color: colors.textMuted,
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            by {plugin.author}
          </div>
        </div>
      </div>

      {/* Summary - Figma: 11px, 2 lines max */}
      <p
        style={{
          fontSize: 11,
          color: colors.textSecondary,
          lineHeight: 1.5,
          marginBottom: 12,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {plugin.summary || 'No description available'}
      </p>

      {/* Footer - version and downloads */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <code
          style={{
            fontSize: 10,
            color: colors.brand,
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
          }}
        >
          v{plugin.latestVersion}
        </code>
        <span style={{ fontSize: 10, color: colors.textMuted }}>
          ↓ {formatDownloads(plugin.downloads)}
        </span>
      </div>
    </Link>
  );
}
