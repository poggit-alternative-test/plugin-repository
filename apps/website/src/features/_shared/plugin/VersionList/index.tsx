/**
 * VersionList Component
 *
 * A reusable list of version items.
 */

import type { Plugin } from '@/services/generated';
import { VersionItem } from '../VersionItem';

export interface VersionListProps {
  /** The plugin containing versions */
  plugin: Plugin;
  /** Currently selected version (for highlighting) */
  currentVersion?: string;
  /** Callback when a version is selected */
  onVersionSelect?: (version: string) => void;
  /** Optional title */
  title?: string;
  /** Whether to show version count */
  showCount?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * VersionList displays a list of versions for a plugin.
 *
 * @example
 * // Basic version list
 * <VersionList plugin={plugin} />
 *
 * // With selection handling
 * <VersionList plugin={plugin} currentVersion={selected} onVersionSelect={setSelected} />
 *
 * // With title
 * <VersionList plugin={plugin} title="All Versions" showCount />
 */
export function VersionList({
  plugin,
  currentVersion,
  onVersionSelect,
  title = 'Versions',
  showCount = true,
  className = '',
}: VersionListProps) {
  const versions = [...plugin.versions].reverse(); // Newest first

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
        {showCount && <span className="ml-2 text-gray-400 dark:text-gray-500">({versions.length})</span>}
      </h3>

      {/* Version list */}
      <div className="space-y-2">
        {versions.map((version, index) => (
          <VersionItem
            key={version.version}
            pluginId={plugin.id}
            version={version}
            isCurrent={version.version === currentVersion}
            isLatest={index === 0}
            onSelect={onVersionSelect}
          />
        ))}
      </div>
    </div>
  );
}
