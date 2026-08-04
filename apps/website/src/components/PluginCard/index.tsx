/**
 * Plugin Card Component
 *
 * Displays a single plugin with verification status,
 * download links, and star buttons.
 * Uses Tailwind CSS for styling.
 */

import type { Plugin } from '@/types/plugin';

interface PluginCardProps {
  plugin: Plugin;
}

export function PluginCard({ plugin }: PluginCardProps) {
  const { repo, repo_url, plugin: p, stats, release, verification } = plugin;
  const [owner, repoName] = repo.split('/');

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasDownload = release?.assets && release.assets.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {p.name}
          </h3>
          {verification.is_verified ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
              ✓ Verified
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400">
              ⚠ Unverified
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
          <span>by {p.author}</span>
          <span>•</span>
          <span>API {p.api}</span>
        </div>
      </div>

      {/* Description */}
      {plugin.description && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
          {plugin.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mb-3">
        <a
          href={`${repo_url}/stargazers`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
        >
          ⭐ {formatNumber(stats.stars)}
        </a>
        <a
          href={`${repo_url}/network/members`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          🍴 {formatNumber(stats.forks)}
        </a>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          📝 {stats.open_issues}
        </span>
      </div>

      {/* Version & Release Info */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3 flex-wrap">
        <span className="font-mono font-medium text-gray-900 dark:text-white">
          v{p.version}
        </span>
        {release && (
          <>
            <span>•</span>
            <a
              href={release.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              🏷️ {release.tag}
            </a>
            <span>•</span>
            <span>{formatDate(release.published_at)}</span>
          </>
        )}
        {!release && (
          <>
            <span>•</span>
            <span className="italic opacity-70">No release yet</span>
          </>
        )}
      </div>

      {/* Verification Info */}
      {verification.is_verified && (
        <div className="mb-3">
          <span className="text-xs text-green-700 dark:text-green-400">
            🔐 Built with pmmp-plugin-actions
          </span>
        </div>
      )}

      {!verification.is_verified && release && (
        <div className="mb-3">
          <span className="text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Not verified - may not be built with official workflow
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {/* Star Button */}
        <a
          href={`https://github.com/${owner}/${repoName}/star`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          ⭐ Star
        </a>

        {/* View on GitHub */}
        <a
          href={repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          View on GitHub
        </a>

        {/* Download Button */}
        {hasDownload && (
          <a
            href={release!.assets[0].download_url}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            📥 Download v{release!.tag.replace(/^v/, '')}
          </a>
        )}

        {/* No Release Warning */}
        {!hasDownload && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 italic">
            📦 Release pending
          </span>
        )}
      </div>

      {/* Release Assets */}
      {hasDownload && release && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="font-mono">📦 {release.assets[0].name}</span>
            <span>{formatFileSize(release.assets[0].size)}</span>
            {release.assets[0].downloads > 0 && (
              <span>📥 {formatNumber(release.assets[0].downloads)} downloads</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
