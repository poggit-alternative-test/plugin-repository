/**
 * HomeRecent Component
 *
 * List of recently updated plugins.
 * Matches Figma design exactly:
 * - Section Title: "Recently Updated" (fontSize:18, fontWeight:600)
 * - Vertical list with hover effects
 * - Plugin rows with icon, name, author, version
 */

import { Link } from '@/components/ui';
import { PluginIcon } from '@/features/_shared/plugin';
import type { PluginListItem } from '@/services/generated';
import { useTheme } from '@/contexts/ThemeContext';

export interface HomeRecentProps {
  /** Full plugin list for lookup */
  plugins?: PluginListItem[];
}

/**
 * Shows recently updated plugins from real data.
 * Figma tokens:
 * - Section title: 18px, weight 600
 * - List items: 14px padding, 10px borderRadius
 * - Icon: 36x36, borderRadius: 8
 * - Hover: subtle lift effect
 */
export function HomeRecent({ plugins = [] }: HomeRecentProps) {
  const { colors } = useTheme();

  if (plugins.length === 0) return null;

  // Sort by updatedAt and take first 5
  const recent = [...plugins]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const formatTimeAgo = (dateStr: string) => {
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

  return (
    <section>
      {/* Section header - Figma: 18px title */}
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: colors.textPrimary,
          marginBottom: 24,
        }}
      >
        Recently Updated
      </h2>

      {/* Plugin list - Figma: vertical stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recent.map((plugin) => (
          <Link
            key={plugin.id}
            to={`/plugins/${plugin.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 16px',
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.brand;
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            <PluginIcon repo={plugin.repo} name={plugin.name} size={36} />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: colors.textPrimary,
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {plugin.name}
              </div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>
                by {plugin.author} · {formatTimeAgo(plugin.updatedAt)}
              </div>
            </div>

            {/* Version */}
            <code
              style={{
                fontSize: 11,
                color: colors.brand,
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              v{plugin.latestVersion}
            </code>
          </Link>
        ))}
      </div>
    </section>
  );
}
