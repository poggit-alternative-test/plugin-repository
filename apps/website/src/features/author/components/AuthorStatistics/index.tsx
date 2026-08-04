/**
 * AuthorStatistics Component
 *
 * Displays author statistics like plugin count, downloads, etc.
 * Follows Figma layout specifications with visual consistency to VersionMetadata.
 */

import { Package, Download, GitBranch, Calendar } from 'lucide-react';
import { Card, Stack } from '@/components/ui';
import type { Author } from '@/services/generated';

export interface AuthorStatisticsProps {
  author: Author;
}

export function AuthorStatistics({ author }: AuthorStatisticsProps) {
  const { statistics } = author;

  return (
    <Card padding="md">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Statistics
      </h3>

      <Stack spacing="sm">
        <StatRow
          icon={<Package className="w-4 h-4" />}
          label="Plugins"
          value={statistics.pluginCount}
        />
        <StatRow
          icon={<GitBranch className="w-4 h-4" />}
          label="Versions"
          value={statistics.versionCount}
        />
        {statistics.totalDownloads !== undefined && (
          <StatRow
            icon={<Download className="w-4 h-4" />}
            label="Downloads"
            value={formatNumber(statistics.totalDownloads)}
          />
        )}
        {statistics.firstPluginAt && (
          <StatRow
            icon={<Calendar className="w-4 h-4" />}
            label="First Plugin"
            value={formatDate(statistics.firstPluginAt)}
          />
        )}
      </Stack>
    </Card>
  );
}

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function StatRow({ icon, label, value }: StatRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white ml-auto">
        {value}
      </span>
    </div>
  );
}

/**
 * Format a large number for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString();
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
  });
}
