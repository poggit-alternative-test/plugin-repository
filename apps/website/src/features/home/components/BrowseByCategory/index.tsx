/**
 * BrowseByCategory Component
 *
 * Category cards for browsing plugins.
 * Matches Figma design exactly:
 * - 6 category cards
 * - 4-column grid on desktop, responsive on mobile
 * - gap: 10px
 * - padding: 14px 16px
 */

import { Link } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Wallet, Shield, Globe, MessageCircle, Layout, Settings } from 'lucide-react';

export interface BrowseByCategoryProps {
  // Props for dynamic categories (future: from API)
}

/**
 * Static categories matching Figma design
 * Figma tokens: 6 categories, icon + name + count
 */
const CATEGORIES = [
  { name: 'Economy', count: 312, icon: Wallet },
  { name: 'Anti-Cheat', count: 198, icon: Shield },
  { name: 'World', count: 176, icon: Globe },
  { name: 'Chat', count: 142, icon: MessageCircle },
  { name: 'UI', count: 130, icon: Layout },
  { name: 'Admin', count: 124, icon: Settings },
];

export function BrowseByCategory(_props: BrowseByCategoryProps) {
  const { colors } = useTheme();

  return (
    <section>
      {/* Section title - Figma: fontSize:18, fontWeight:600 */}
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: colors.textPrimary,
          marginBottom: 20,
        }}
      >
        Browse by Category
      </h2>

      {/* Category grid - Figma: responsive grid, gap:10 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10,
        }}
      >
        {CATEGORIES.map((cat) => {
          const IconComponent = cat.icon;
          return (
            <Link
              key={cat.name}
              to={`/search?category=${encodeURIComponent(cat.name)}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                backgroundColor: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.brand;
                e.currentTarget.style.backgroundColor = colors.brandBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.backgroundColor = colors.card;
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.brand,
                  flexShrink: 0,
                }}
              >
                <IconComponent className="h-5 w-5" />
              </div>

              {/* Info */}
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: colors.textPrimary,
                  }}
                >
                  {cat.name}
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>
                  {cat.count} plugins
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
