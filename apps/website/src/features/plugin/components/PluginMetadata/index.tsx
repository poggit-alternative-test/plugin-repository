/**
 * PluginMetadata Component
 *
 * Displays plugin statistics and metadata.
 * Follows Figma layout specifications.
 */

import React from 'react';
import { Download, Calendar, Tag, FileCode, GitBranch } from 'lucide-react';
import { Card, Stack, Badge, Divider } from '@/components/ui';
import type { Plugin } from '@/services/generated';

export interface PluginMetadataProps {
  plugin: Plugin;
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
    day: 'numeric',
  });
}

export function PluginMetadata({ plugin }: PluginMetadataProps) {
  const metadataItems: Array<{
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
  }> = [];

  // Downloads
  if (plugin.downloads) {
    metadataItems.push({
      icon: <Download className="w-4 h-4" />,
      label: 'Downloads',
      value: formatNumber(plugin.downloads.total),
    });
  }

  // Version
  metadataItems.push({
    icon: <Tag className="w-4 h-4" />,
    label: 'Version',
    value: <span className="font-mono">{plugin.latestVersion}</span>,
  });

  // License
  if (plugin.license) {
    metadataItems.push({
      icon: <FileCode className="w-4 h-4" />,
      label: 'License',
      value: plugin.license,
    });
  }

  // API version
  if (plugin.metadata?.apiVersion) {
    metadataItems.push({
      icon: <GitBranch className="w-4 h-4" />,
      label: 'API',
      value: <span className="font-mono">{plugin.metadata.apiVersion}</span>,
    });
  }

  // Created date
  metadataItems.push({
    icon: <Calendar className="w-4 h-4" />,
    label: 'Created',
    value: formatDate(plugin.createdAt),
  });

  // Categories
  const hasCategories = plugin.categories && plugin.categories.length > 0;

  // Tags
  const hasTags = plugin.tags && plugin.tags.length > 0;

  // Return null if no content
  if (metadataItems.length === 0 && !hasCategories && !hasTags) {
    return null;
  }

  return (
    <Card padding="md">
      <Stack spacing="md">
        {/* Details header */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Details
        </h3>

        {/* Metadata items */}
        <Stack spacing="sm">
          {metadataItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{item.icon}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{item.label}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white ml-auto">
                {item.value}
              </span>
            </div>
          ))}
        </Stack>

        {/* Categories */}
        {hasCategories && (
          <>
            <Divider />
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">Categories</span>
              <div className="flex flex-wrap gap-2">
                {plugin.categories!.map((category) => (
                  <Badge key={category} variant="default" size="sm">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Tags */}
        {hasTags && (
          <>
            <Divider />
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">Tags</span>
              <div className="flex flex-wrap gap-2">
                {plugin.tags!.map((tag) => (
                  <Badge key={tag} variant="default" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </Stack>
    </Card>
  );
}
