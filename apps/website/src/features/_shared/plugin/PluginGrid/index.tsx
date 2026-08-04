/**
 * PluginGrid Component
 *
 * A reusable grid of plugin cards.
 * Visual implementation follows Figma design: 12px border radius, proper gaps.
 */

import type { PluginListItem } from '@/services/generated';
import { PluginCard } from '../PluginCard';

export interface PluginGridProps {
  /** Array of plugins to display */
  plugins: PluginListItem[];
  /** Number of columns on mobile */
  columnsMobile?: 1 | 2;
  /** Number of columns on tablet */
  columnsTablet?: 2 | 3 | 4;
  /** Number of columns on desktop */
  columnsDesktop?: 2 | 3 | 4 | 6;
  /** Additional CSS classes */
  className?: string;
}

const columnClasses = {
  mobile: {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
  },
  tablet: {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
  },
  desktop: {
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    6: 'lg:grid-cols-6',
  },
};

/**
 * PluginGrid displays plugins in a responsive grid layout.
 * Figma: gap-3 (12px)
 */
export function PluginGrid({
  plugins,
  columnsMobile = 1,
  columnsTablet = 2,
  columnsDesktop = 3,
  className = '',
}: PluginGridProps) {
  if (plugins.length === 0) {
    return null;
  }

  return (
    <div
      className={`
        grid
        ${columnClasses.mobile[columnsMobile]}
        ${columnClasses.tablet[columnsTablet]}
        ${columnClasses.desktop[columnsDesktop]}
        gap-3
        ${className}
      `}
    >
      {plugins.map((plugin) => (
        <PluginCard key={plugin.id} plugin={plugin} />
      ))}
    </div>
  );
}
