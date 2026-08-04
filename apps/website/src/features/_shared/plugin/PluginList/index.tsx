/**
 * PluginList Component
 *
 * A reusable list of plugin cards.
 * Used for displaying search results, author plugins, category plugins, etc.
 * Visual implementation follows Figma design.
 */

import { Card } from '@/components/ui';
import type { PluginListItem } from '@/services/generated';
import { PluginCard } from '../PluginCard';

export interface PluginListProps {
  /** Array of plugins to display */
  plugins: PluginListItem[];
  /** Optional title for the list */
  title?: string;
  /** Whether to show plugin count */
  showCount?: boolean;
  /** Message when list is empty */
  emptyMessage?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PluginList displays a vertical list of plugins.
 *
 * @example
 * // Basic usage
 * <PluginList plugins={searchResults} />
 *
 * // With title
 * <PluginList plugins={author.plugins} title="Plugins" showCount />
 *
 * // Empty state
 * <PluginList plugins={[]} emptyMessage="No plugins found" />
 */
export function PluginList({
  plugins,
  title,
  showCount = false,
  emptyMessage = 'No plugins found.',
  className = '',
}: PluginListProps) {
  // Empty state
  if (plugins.length === 0) {
    return (
      <Card padding="md" className={className}>
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      {(title || showCount) && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
          {showCount && (
            <span className="ml-2 text-gray-400 dark:text-gray-500">
              ({plugins.length})
            </span>
          )}
        </h3>
      )}

      {/* Plugin list */}
      <div className="space-y-2">
        {plugins.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} />
        ))}
      </div>
    </div>
  );
}
