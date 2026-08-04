/**
 * VersionItem Component
 *
 * A reusable component for displaying a single version entry.
 * Can be used in version lists, version dropdowns, etc.
 */

import { Link } from '@/components/ui';
import { StatusBadge } from '@/components/ui';
import type { VersionSummary } from '@/services/generated';

export interface VersionItemProps {
  /** The version data */
  version: VersionSummary;
  /** The plugin ID for building the link */
  pluginId: string;
  /** Whether this is the currently selected version */
  isCurrent?: boolean;
  /** Whether this is the latest version */
  isLatest?: boolean;
  /** Callback when version is selected (instead of navigation) */
  onSelect?: (version: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format a date string for display (relative or absolute)
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * VersionItem displays a single version with its status and date.
 *
 * @example
 * // As a link
 * <VersionItem version={v} pluginId="my-plugin" />
 *
 * // As a selectable item
 * <VersionItem version={v} pluginId="my-plugin" onSelect={handleSelect} isCurrent={v.version === selected} />
 */
export function VersionItem({
  version,
  pluginId,
  isCurrent = false,
  isLatest = false,
  onSelect,
  className = '',
}: VersionItemProps) {
  const content = (
    <div
      className={`
        flex items-center justify-between gap-4 p-3
        rounded-lg border transition-colors
        ${isCurrent ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
        ${className}
      `}
    >
      {/* Version info */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
          {version.version}
        </span>
        <StatusBadge status={version.status} />
        {isLatest && (
          <span className="text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/50 px-2 py-0.5 rounded">
            Latest
          </span>
        )}
      </div>

      {/* Date and API */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        {version.apiVersion && (
          <span className="font-mono text-xs">
            API {version.apiVersion}
          </span>
        )}
        <span>
          {formatDate(version.publishedAt)}
        </span>
      </div>
    </div>
  );

  // Selectable button
  if (onSelect) {
    return (
      <button
        onClick={() => onSelect(version.version)}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-lg"
        type="button"
      >
        {content}
      </button>
    );
  }

  // Link to version page
  return (
    <Link
      to={`/versions/${pluginId}/${version.version}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-lg"
    >
      {content}
    </Link>
  );
}
