/**
 * SearchResults Component
 *
 * Displays search results using shared plugin components.
 */

import type { ViewOption } from '../../hooks';
import { PluginGrid, PluginList } from '@/features/_shared/plugin';
import type { PluginListItem, SearchIndexEntry } from '@/services/generated';

export interface SearchResultsProps {
  /** Search results */
  results: SearchIndexEntry[];
  /** Current page items */
  pageResults: SearchIndexEntry[];
  /** Current view mode */
  view: ViewOption;
}

export function SearchResults({
  pageResults,
  view,
}: SearchResultsProps) {
  if (pageResults.length === 0) {
    return null;
  }

  // Convert SearchIndexEntry to PluginListItem
  const plugins: PluginListItem[] = pageResults.map((entry) => ({
    id: entry.id,
    name: entry.name,
    summary: entry.summary || '',
    latestVersion: entry.latestVersion,
    status: entry.status,
    author: entry.author,
    downloads: entry.downloads,
    updatedAt: entry.updatedAt,
  }));

  if (view === 'list') {
    return <PluginList plugins={plugins} />;
  }

  return <PluginGrid plugins={plugins} columnsDesktop={4} />;
}
