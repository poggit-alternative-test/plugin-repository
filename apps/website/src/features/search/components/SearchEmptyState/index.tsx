/**
 * SearchEmptyState Component
 *
 * Displayed when search has no results.
 * Follows Figma layout specifications.
 */

import { Search } from 'lucide-react';
import { Card, Button } from '@/components/ui';

export interface SearchEmptyStateProps {
  /** The query that produced no results */
  query: string;
  /** Whether filters are active */
  hasFilters: boolean;
  /** Callback to clear filters */
  onClearFilters: () => void;
}

export function SearchEmptyState({
  query,
  hasFilters,
  onClearFilters,
}: SearchEmptyStateProps) {
  return (
    <Card padding="lg" className="text-center">
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
          <Search className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No results found
          </h3>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {query ? (
              <>
                No plugins match <span className="font-medium text-gray-900 dark:text-white">"{query}"</span>
              </>
            ) : (
              'No plugins match your filters'
            )}
          </p>
        </div>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear all filters
          </Button>
        )}
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          Try adjusting your search or browse all plugins.
        </p>
      </div>
    </Card>
  );
}
