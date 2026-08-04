/**
 * VersionChecksums Component
 *
 * Displays SHA256, SHA512, and MD5 checksums for verification.
 * Follows Figma layout specifications with visual consistency to VersionMetadata.
 */

import { ShieldCheck, Copy } from 'lucide-react';
import { Card, Stack, Button } from '@/components/ui';
import type { Version } from '@/services/generated';

export interface VersionChecksumsProps {
  version: Version;
}

export function VersionChecksums({ version }: VersionChecksumsProps) {
  if (!version.checksums) {
    return null;
  }

  const { sha256, sha512, md5 } = version.checksums;

  return (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Checksums
        </h3>
      </div>

      <Stack spacing="sm">
        {/* SHA256 */}
        <ChecksumRow
          algorithm="SHA-256"
          value={sha256}
        />

        {/* SHA512 */}
        {sha512 && (
          <ChecksumRow
            algorithm="SHA-512"
            value={sha512}
          />
        )}

        {/* MD5 */}
        {md5 && (
          <ChecksumRow
            algorithm="MD5"
            value={md5}
          />
        )}
      </Stack>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Click a checksum to copy it to your clipboard for verification.
      </p>
    </Card>
  );
}

interface ChecksumRowProps {
  algorithm: string;
  value: string;
}

function ChecksumRow({ algorithm, value }: ChecksumRowProps) {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {algorithm}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 h-7 px-2"
          leftIcon={<Copy className="w-3 h-3" />}
        >
          Copy
        </Button>
      </div>
      <code className="block w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-800 dark:text-gray-200 break-all select-all">
        {value}
      </code>
    </div>
  );
}
