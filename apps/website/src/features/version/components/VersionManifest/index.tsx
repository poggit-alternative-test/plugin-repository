/**
 * VersionManifest Component
 *
 * Displays plugin.yml manifest information.
 * Follows Figma layout specifications with visual consistency to VersionMetadata.
 */

import { FileCode } from 'lucide-react';
import { Card, Stack, Divider } from '@/components/ui';
import type { Version } from '@/services/generated';

export interface VersionManifestProps {
  version: Version;
}

export function VersionManifest({ version }: VersionManifestProps) {
  if (!version.manifest) {
    return null;
  }

  const { manifest } = version;

  return (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-4">
        <FileCode className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Manifest
        </h3>
      </div>

      <Divider className="mb-4" />

      <Stack spacing="sm">
        <ManifestRow label="Name" value={manifest.name} />
        <ManifestRow label="Version" value={manifest.version} mono />
        <ManifestRow label="Main Class" value={manifest.main} mono />
        <ManifestRow label="API Version" value={manifest.api} mono />
        <ManifestRow label="Load Order" value={manifest.loadOrder} />
        <ManifestRow label="Author" value={manifest.author} />
      </Stack>

      {manifest.description && (
        <>
          <Divider className="my-4" />
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Description
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-400">{manifest.description}</p>
          </div>
        </>
      )}
    </Card>
  );
}

interface ManifestRowProps {
  label: string;
  value?: string;
  mono?: boolean;
}

function ManifestRow({ label, value, mono }: ManifestRowProps) {
  if (!value) return null;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-medium text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
