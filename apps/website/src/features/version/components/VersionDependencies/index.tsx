/**
 * VersionDependencies Component
 *
 * Displays runtime and suggested plugin dependencies.
 * Follows Figma layout specifications with visual consistency to VersionMetadata.
 */

import { Package, ArrowRight } from 'lucide-react';
import { Card, Badge, Stack } from '@/components/ui';
import type { Version } from '@/services/generated';

export interface VersionDependenciesProps {
  version: Version;
}

export function VersionDependencies({ version }: VersionDependenciesProps) {
  const { dependencies } = version;

  // No dependencies at all
  if (!dependencies || (!dependencies.runtime && !dependencies.suggested)) {
    return null;
  }

  return (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Dependencies
        </h3>
      </div>

      <Stack spacing="md">
        {/* Runtime Dependencies */}
        {dependencies.runtime && Object.keys(dependencies.runtime).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Required
            </h4>
            <div className="space-y-2">
              {Object.entries(dependencies.runtime).map(([name, version]) => (
                <DependencyItem key={name} name={name} version={version} type="required" />
              ))}
            </div>
          </div>
        )}

        {/* Suggested Dependencies */}
        {dependencies.suggested && Object.keys(dependencies.suggested).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Suggested
            </h4>
            <div className="space-y-2">
              {Object.entries(dependencies.suggested).map(([name, version]) => (
                <DependencyItem key={name} name={name} version={version} type="suggested" />
              ))}
            </div>
          </div>
        )}
      </Stack>
    </Card>
  );
}

interface DependencyItemProps {
  name: string;
  version: string;
  type: 'required' | 'suggested';
}

function DependencyItem({ name, version, type }: DependencyItemProps) {
  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <Badge variant={type === 'required' ? 'error' : 'default'} size="sm">
          {type === 'required' ? 'Required' : 'Optional'}
        </Badge>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{version}</span>
        <ArrowRight className="w-3 h-3 text-gray-400 dark:text-gray-500" />
      </div>
    </div>
  );
}
