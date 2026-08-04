/**
 * VersionArtifacts Component
 *
 * Displays download button and artifact information.
 * Follows Figma layout specifications with visual consistency to PluginSidebar.
 */

import { Download, FileArchive, ExternalLink } from 'lucide-react';
import { Button, Card, Stack, Divider } from '@/components/ui';
import { formatFileSize } from '../../utils';
import type { Version } from '@/services/generated';

export interface VersionArtifactsProps {
  version: Version;
}

export function VersionArtifacts({ version }: VersionArtifactsProps) {
  const isAvailable = version.status === 'published' && version.artifact;

  return (
    <Card padding="md">
      <Stack spacing="md">
        {/* Download Button */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Download
          </h3>
          {isAvailable ? (
            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={() => window.open(version.artifact.downloadUrl, '_blank')}
              >
                Download v{version.version}
              </Button>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {formatFileSize(version.artifact.size)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This version is not available for download.
            </p>
          )}
        </div>

        {/* Artifact Details */}
        {version.artifact && (
          <>
            <Divider />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Artifact
              </h3>
              <Stack spacing="xs">
                <ArtifactRow
                  icon={<FileArchive className="w-4 h-4" />}
                  label="File"
                  value={getFileName(version.artifact.file)}
                  mono
                />
                <ArtifactRow
                  icon={<span className="text-xs font-mono w-4 text-center">#</span>}
                  label="Size"
                  value={formatFileSize(version.artifact.size)}
                />
              </Stack>
            </div>
          </>
        )}

        {/* Source Links */}
        {version.source && (
          <>
            <Divider />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Source
              </h3>
              <Stack spacing="xs">
                <ArtifactRow
                  icon={<ExternalLink className="w-4 h-4" />}
                  label="Upstream"
                  value={truncateMiddle(version.source.upstream, 40)}
                  href={version.source.upstream}
                />
                <ArtifactRow
                  icon={<span className="text-xs font-mono w-4 text-center">@</span>}
                  label="Commit"
                  value={version.source.commit.slice(0, 7)}
                  href={`${version.source.upstream}/commit/${version.source.commit}`}
                  mono
                />
              </Stack>
            </div>
          </>
        )}
      </Stack>
    </Card>
  );
}

interface ArtifactRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}

function ArtifactRow({ icon, label, value, href, mono }: ArtifactRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 ml-auto truncate transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
          title={href}
        >
          {value}
        </a>
      ) : (
        <span className={`text-sm font-medium text-gray-900 dark:text-white ml-auto truncate ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      )}
    </div>
  );
}

/**
 * Get filename from path
 */
function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Truncate a string in the middle
 */
function truncateMiddle(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const half = Math.floor((maxLength - 3) / 2);
  return str.slice(0, half) + '...' + str.slice(-half);
}
