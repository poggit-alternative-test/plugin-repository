/**
 * AuthorPlugins Component
 *
 * Displays a list of plugins by this author.
 * Uses the shared PluginList component.
 */

import { PluginList } from '@/features/_shared/plugin';
import type { Author } from '@/services/generated';

export interface AuthorPluginsProps {
  author: Author;
}

/**
 * AuthorPlugins displays all plugins by an author.
 *
 * @example
 * <AuthorPlugins author={author} />
 */
export function AuthorPlugins({ author }: AuthorPluginsProps) {
  return (
    <PluginList
      plugins={author.plugins}
      title="Plugins"
      showCount={true}
      emptyMessage="No plugins found for this author."
    />
  );
}
