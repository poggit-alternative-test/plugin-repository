/**
 * HomeFeature Component
 *
 * The main feature component that composes the home page.
 * Matches Figma design exactly:
 * - Hero section with radial gradient
 * - Statistics row (4 columns)
 * - Featured plugins (3-column grid)
 * - Recently updated
 * - Browse by category
 */

import { useHomeFeature } from './hooks';
import {
  HomeHero,
  HomeStats,
  HomeFeatured,
  HomeRecent,
  HomeEmptyState,
  BrowseByCategory,
} from './components';
import { useTheme } from '@/contexts/ThemeContext';
import { LoadingState, ErrorState } from '@/components/ui';

export interface HomeFeatureProps {
  /** Optional initial search query from URL */
  initialQuery?: string;
}

/**
 * Figma layout structure:
 * - Hero: centered, radial gradient, category chips
 * - Stats: 4 columns, borders top/bottom
 * - Content: padding 48px 40px, max-width 1280px
 *   - Featured Plugins section
 *   - Recently Updated section
 *   - Browse by Category section
 */
export function HomeFeature({ initialQuery }: HomeFeatureProps) {
  const { colors } = useTheme();
  const { plugins, loading, error } = useHomeFeature();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
        <div style={{ padding: '48px 40px', maxWidth: 1280, margin: '0 auto' }}>
          <LoadingState message="Loading..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
        <div style={{ padding: '48px 40px', maxWidth: 1280, margin: '0 auto' }}>
          <ErrorState
            title="Failed to load"
            message={error.message}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  if (plugins.length === 0) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
        {/* Hero section */}
        <HomeHero initialQuery={initialQuery} />

        {/* Stats row */}
        <div style={{ borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <HomeStats plugins={plugins} />
          </div>
        </div>

        {/* Content section */}
        <div style={{ padding: '48px 40px', maxWidth: 1280, margin: '0 auto' }}>
          <HomeEmptyState />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {/* Hero section with radial gradient */}
      <HomeHero initialQuery={initialQuery} pluginCount={plugins.length} />

      {/* Statistics row - full width with border */}
      <div style={{ borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <HomeStats plugins={plugins} />
        </div>
      </div>

      {/* Content section - Figma: padding 48px 40px */}
      <div style={{ padding: '48px 40px', maxWidth: 1280, margin: '0 auto' }}>
        {/* Featured plugins - Figma: 3-column grid */}
        <section style={{ marginBottom: 48 }}>
          <HomeFeatured plugins={plugins.slice(0, 6)} viewAllLink="/search" />
        </section>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: colors.border, margin: '0 0 48px' }} />

        {/* Recently updated - Figma: vertical list */}
        <section style={{ marginBottom: 48 }}>
          <HomeRecent plugins={plugins} />
        </section>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: colors.border, margin: '0 0 48px' }} />

        {/* Browse by category */}
        <section>
          <BrowseByCategory />
        </section>
      </div>
    </div>
  );
}
