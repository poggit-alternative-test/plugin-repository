/**
 * AuthorSidebar Component
 *
 * Displays quick links and profile information in sidebar.
 * Follows Figma layout specifications with visual consistency to PluginSidebar.
 */

import { Github } from 'lucide-react';
import { Card, Button, Stack, Divider } from '@/components/ui';
import type { Author } from '@/services/generated';

export interface AuthorSidebarProps {
  author: Author;
}

export function AuthorSidebar({ author }: AuthorSidebarProps) {
  const profile = author.profile;
  const hasLinks = profile?.github || author.verified;

  if (!hasLinks) {
    return null;
  }

  return (
    <Card padding="md">
      <Stack spacing="md">
        {/* GitHub Profile */}
        {profile?.github && (
          <>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              leftIcon={<Github className="w-4 h-4" />}
              onClick={() => window.open(`https://github.com/${author.login}`, '_blank')}
            >
              View on GitHub
            </Button>
            <Divider />
          </>
        )}

        {/* Verified Badge */}
        {author.verified && (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Verified Author</span>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          All plugins are reviewed by the PocketMine team before publication.
        </p>
      </Stack>
    </Card>
  );
}
