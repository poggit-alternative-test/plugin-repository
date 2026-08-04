/**
 * AuthorHeader Component
 *
 * Displays author name, avatar, and verification status.
 * Follows Figma layout specifications with visual consistency to PluginHeader.
 */

import { Github } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { Badge } from '@/components/ui';
import type { Author } from '@/services/generated';

export interface AuthorHeaderProps {
  author: Author;
}

export function AuthorHeader({ author }: AuthorHeaderProps) {
  const profile = author.profile;

  return (
    <div className="space-y-6">
      {/* Main info row */}
      <div className="flex items-start gap-6">
        {/* Avatar */}
        <Avatar
          src={profile?.avatar}
          name={profile?.name || author.login}
          size="xl"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
              {profile?.name || author.login}
            </h1>
            {author.verified && (
              <Badge variant="success" size="sm">
                Verified
              </Badge>
            )}
          </div>

          <p className="text-gray-500 dark:text-gray-400 mt-1">
            @{author.login}
          </p>
        </div>
      </div>

      {/* Bio */}
      {profile?.bio && (
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl">
          {profile.bio}
        </p>
      )}

      {/* GitHub Profile Link */}
      {profile?.github && (
        <a
          href={`https://github.com/${author.login}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
        >
          <Github className="w-4 h-4" />
          View GitHub Profile
        </a>
      )}
    </div>
  );
}
