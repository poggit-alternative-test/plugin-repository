/**
 * VersionHeader Component
 *
 * Displays version number, plugin name, and status.
 * Follows Figma layout specifications with visual consistency to PluginHeader.
 */

import { Link } from '@/components/ui';
import { StatusBadge } from '@/components/ui';
import type { Version } from '@/services/generated';

export interface VersionHeaderProps {
  version: Version;
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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function VersionHeader({ version }: VersionHeaderProps) {
  return (
    <div className="space-y-6">
      {/* Main header row */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          {/* Version info with plugin link */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-mono">
              v{version.version}
            </h1>
            <StatusBadge status={version.status} />
          </div>

          {/* Plugin name link */}
          <p className="text-lg text-gray-600 dark:text-gray-400">
            for{' '}
            <Link
              to={`/plugins/${version.plugin}`}
              className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              {version.plugin}
            </Link>
          </p>
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {/* API Version badge */}
        {version.apiVersion && (
          <>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm">
              <span className="text-gray-500 dark:text-gray-400">API</span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">{version.apiVersion}</span>
            </span>
            <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
          </>
        )}

        {/* Published date */}
        <span className="text-gray-500 dark:text-gray-400">
          Published {formatDate(version.release.publishedAt)}
        </span>
      </div>
    </div>
  );
}
