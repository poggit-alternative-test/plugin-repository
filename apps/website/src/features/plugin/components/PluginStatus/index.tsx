/**
 * PluginStatus Component
 *
 * Displays detailed status information about a plugin.
 * Follows Figma layout specifications.
 */

import { AlertCircle, Clock, Shield, XCircle } from 'lucide-react';
import { Card, Stack, Badge } from '@/components/ui';
import type { Plugin, VersionStatus } from '@/services/generated';

export interface PluginStatusProps {
  plugin: Plugin;
}

const statusConfig: Record<
  VersionStatus,
  {
    label: string;
    description: string;
    variant: 'success' | 'warning' | 'error' | 'info' | 'default';
    icon: React.ReactNode;
  }
> = {
  approved: {
    label: 'Approved',
    description: 'This plugin has been approved by the review team.',
    variant: 'success',
    icon: <Shield className="w-5 h-5" />,
  },
  materialized: {
    label: 'Materialized',
    description: 'The plugin source code has been pulled and stored.',
    variant: 'info',
    icon: <Clock className="w-5 h-5" />,
  },
  published: {
    label: 'Published',
    description: 'The plugin is published and available for download.',
    variant: 'success',
    icon: <Shield className="w-5 h-5" />,
  },
  deprecated: {
    label: 'Deprecated',
    description: 'This plugin is no longer maintained.',
    variant: 'warning',
    icon: <AlertCircle className="w-5 h-5" />,
  },
  revoked: {
    label: 'Revoked',
    description: 'This plugin has been revoked and is no longer available.',
    variant: 'error',
    icon: <XCircle className="w-5 h-5" />,
  },
  removed: {
    label: 'Removed',
    description: 'This plugin has been removed from the repository.',
    variant: 'default',
    icon: <XCircle className="w-5 h-5" />,
  },
};

const variantStyles = {
  success: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
  error: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
  info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  default: 'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700',
};

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

export function PluginStatus({ plugin }: PluginStatusProps) {
  const config = statusConfig[plugin.status];

  return (
    <Card
      padding="md"
      className={`border-2 ${variantStyles[config.variant]}`}
    >
      <Stack spacing="md">
        {/* Status header */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">{config.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{config.label}</span>
              {plugin.latestVersion && (
                <Badge variant="default" size="sm" className="font-mono">
                  v{plugin.latestVersion}
                </Badge>
              )}
            </div>
            <p className="text-sm opacity-80 mt-1">{config.description}</p>
          </div>
        </div>

        {/* Compatibility info */}
        {(plugin.metadata?.apiVersion || plugin.metadata?.loadOrder) && (
          <div className="pt-3 border-t border-current/20">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              {plugin.metadata?.apiVersion && (
                <div className="flex items-center gap-1.5">
                  <span className="opacity-60">API:</span>
                  <span className="font-mono font-medium">v{plugin.metadata.apiVersion}</span>
                </div>
              )}
              {plugin.metadata?.loadOrder && (
                <div className="flex items-center gap-1.5">
                  <span className="opacity-60">Load:</span>
                  <span className="font-medium">{plugin.metadata.loadOrder}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Updated timestamp */}
        <div className="text-xs opacity-60">
          Updated {formatDate(plugin.updatedAt)}
        </div>
      </Stack>
    </Card>
  );
}
