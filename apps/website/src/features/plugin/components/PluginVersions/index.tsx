/**
 * PluginVersions Component
 *
 * Displays all versions for a plugin.
 * This component delegates to the shared VersionList.
 */

import { VersionList } from '@/features/_shared/plugin';
import { Card } from '@/components/ui';
import type { Plugin } from '@/services/generated';

export interface PluginVersionsProps {
  plugin: Plugin;
  currentVersion?: string;
  onVersionSelect?: (version: string) => void;
}

/**
 * PluginVersions displays all versions for a plugin.
 *
 * @example
 * // Basic usage
 * <PluginVersions plugin={plugin} />
 *
 * // With version selection
 * <PluginVersions plugin={plugin} currentVersion={selected} onVersionSelect={handleSelect} />
 */
export function PluginVersions({
  plugin,
  currentVersion,
  onVersionSelect,
}: PluginVersionsProps) {
  return (
    <Card padding="md">
      <VersionList
        plugin={plugin}
        currentVersion={currentVersion}
        onVersionSelect={onVersionSelect}
      />
    </Card>
  );
}
