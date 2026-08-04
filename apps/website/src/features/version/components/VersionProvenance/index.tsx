/**
 * VersionProvenance Component
 *
 * Displays GitHub attestation and provenance information.
 * Follows Figma layout specifications with visual consistency to VersionMetadata.
 */

import { Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, Badge, Stack, Divider } from '@/components/ui';
import type { Version } from '@/services/generated';

export interface VersionProvenanceProps {
  version: Version;
}

export function VersionProvenance({ version }: VersionProvenanceProps) {
  if (!version.provenance) {
    return null;
  }

  const { type, verified } = version.provenance;

  return (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Provenance
        </h3>
      </div>

      <Stack spacing="md">
        {/* Attestation Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {verified ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            )}
            <span className="font-medium text-gray-900 dark:text-white">
              GitHub Attestation
            </span>
          </div>
          <Badge
            variant={verified ? 'success' : 'warning'}
            size="sm"
          >
            {verified ? 'Verified' : 'Pending'}
          </Badge>
        </div>

        {/* Type Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {type === 'github-attestation' && (
            <>
              This release has a{' '}
              <a
                href="https://docs.github.com/en/actions/security-guides/about-artifact-attestation"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
              >
                GitHub Artifact Attestation
              </a>
              {verified
                ? ', verifying the artifact was built from the declared source.'
                : '. Attestation verification is pending.'}
            </>
          )}
        </p>

        <Divider />

        {/* What it means */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What is this?
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Artifact Attestation provides cryptographic proof that your download
            was built from the published source code by GitHub Actions, making
            it tamper-proof and verifiable.
          </p>
        </div>
      </Stack>
    </Card>
  );
}
