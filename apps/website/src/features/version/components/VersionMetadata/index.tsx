/**
 * VersionMetadata Component
 *
 * Displays review information, dates, and pull request details.
 * Follows Figma layout specifications with visual consistency to PluginMetadata.
 */

import { GitPullRequest, User, Calendar, CheckCircle } from 'lucide-react';
import { Stack, Badge, Card, Divider } from '@/components/ui';
import type { Version } from '@/services/generated';

export interface VersionMetadataProps {
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

export function VersionMetadata({ version }: VersionMetadataProps) {
  const isRevoked = version.status === 'revoked';
  const isRemoved = version.status === 'removed';

  return (
    <Card padding="md">
      <Stack spacing="md">
        {/* Review Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            Review Information
          </h3>
          <Stack spacing="sm">
            <MetadataRow
              icon={<GitPullRequest className="w-4 h-4" />}
              label="Pull Request"
              value={`#${version.review.pullRequest}`}
              href={`https://github.com/axolotl-pm/plugin-repository/pull/${version.review.pullRequest}`}
              mono
            />
            <MetadataRow
              icon={<User className="w-4 h-4" />}
              label="Reviewer"
              value={version.review.reviewer}
              href={`https://github.com/${version.review.reviewer}`}
            />
            <MetadataRow
              icon={<Calendar className="w-4 h-4" />}
              label="Approved"
              value={formatDate(version.review.approvedAt)}
            />
          </Stack>
        </div>

        <Divider />

        {/* Release Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Release
          </h3>
          <Stack spacing="sm">
            <MetadataRow
              icon={<Calendar className="w-4 h-4" />}
              label="Published"
              value={formatDate(version.release.publishedAt)}
            />
            {version.release.tag && (
              <MetadataRow
                icon={<span className="text-xs font-mono">#</span>}
                label="Tag"
                value={version.release.tag}
                mono
              />
            )}
          </Stack>
        </div>

        {/* Revoked/Removed Info */}
        {(isRevoked || isRemoved) && (
          <>
            <Divider />
            <div>
              <Badge variant="error" size="sm">
                {isRevoked ? 'Revoked' : 'Removed'}
              </Badge>
              {version.revokedAt && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  on {formatDate(version.revokedAt)}
                </p>
              )}
              {version.reason && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Reason: {version.reason}
                </p>
              )}
            </div>
          </>
        )}
      </Stack>
    </Card>
  );
}

interface MetadataRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}

function MetadataRow({ icon, label, value, href, mono }: MetadataRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 ml-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded transition-colors"
        >
          {value}
        </a>
      ) : (
        <span className={`text-sm font-medium text-gray-900 dark:text-white ml-auto ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      )}
    </div>
  );
}
