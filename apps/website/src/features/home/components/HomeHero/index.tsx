/**
 * HomeHero Component
 *
 * Hero section with search functionality.
 * Matches Figma design exactly:
 * - padding: 80px 40px 60px
 * - radial-gradient background
 * - 52px heading with gradient text
 * - Category chips
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export interface HomeHeroProps {
  /** Initial search query */
  initialQuery?: string;
  /** Plugin count badge */
  pluginCount?: number;
}

/**
 * Figma tokens:
 * - Hero padding: 80px 40px 60px
 * - Hero heading: 52px, weight 800, letter-spacing -0.04em
 * - Gradient text effect on "PocketMine-MP"
 * - Category chips
 */
const CATEGORY_CHIPS = [
  'Economy',
  'Anti-Cheat',
  'World',
  'Chat',
  'UI',
  'Admin',
];

export function HomeHero({ initialQuery = '', pluginCount = 0 }: HomeHeroProps) {
  const [query, setQuery] = useState(initialQuery);
  const navigate = useNavigate();
  const { colors } = useTheme();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleCategoryClick = (category: string) => {
    navigate(`/search?category=${encodeURIComponent(category)}`);
  };

  return (
    <section
      style={{
        padding: '80px 40px 60px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Radial gradient background - Figma style */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${colors.brandDark}18 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Content wrapper */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
        {/* Plugin count badge with success indicator */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 999,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
            fontSize: 11,
            color: colors.textMuted,
            marginBottom: 24,
          }}
        >
          <span style={{ color: colors.success }}>●</span>
          <span>
            {pluginCount.toLocaleString()} plugins available · API 5.0.0 compatible
          </span>
        </div>

        {/* Hero heading - Figma: 52px, weight 800, gradient brand text */}
        <h1
          style={{
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            color: colors.textPrimary,
            marginBottom: 20,
            fontFamily: 'var(--font-sans)',
          }}
        >
          The open plugin registry for{' '}
          <span
            style={{
              background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            PocketMine-MP  
          </span>
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: 16,
            color: colors.textSecondary,
            lineHeight: 1.7,
            marginBottom: 32,
          }}
        >
          Discover, install, and publish plugins. Trusted by developers worldwide.
        </p>

        {/* Search bar - Figma tokens: maxWidth:580, gap:10 */}
        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', gap: 10, maxWidth: 580, margin: '0 auto 24px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: colors.textMuted,
                }}
              >
                <Search className="h-5 w-5" />
              </div>
              <input
                type="search"
                placeholder="Search plugins, authors, categories…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  paddingLeft: 44,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  fontSize: 14,
                  color: colors.textPrimary,
                  outline: 'none',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = colors.brand;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.brandBg}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: '14px 24px',
                background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Search
            </button>
          </div>
        </form>

        {/* Category chips - Figma tokens: inline flex, gap based on categories */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {CATEGORY_CHIPS.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 500,
                color: colors.textSecondary,
                backgroundColor: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 999,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.brand;
                e.currentTarget.style.color = colors.brand;
                e.currentTarget.style.backgroundColor = colors.brandBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.color = colors.textSecondary;
                e.currentTarget.style.backgroundColor = colors.card;
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
