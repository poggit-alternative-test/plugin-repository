/**
 * Search Loading State Component
 *
 * Skeleton loading state for search results.
 * Follows Figma layout specifications.
 */

import { Skeleton } from '@/components/ui';

export interface SearchLoadingStateProps {
  /** Number of skeleton items to show */
  count?: number;
}

export function SearchLoadingState({ count = 8 }: SearchLoadingStateProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton width="60%" height="20px" />
            <Skeleton width="60px" height="20px" variant="text" />
          </div>
          <Skeleton width="100%" height="14px" />
          <Skeleton width="80%" height="14px" />
          <div className="flex gap-4 pt-2">
            <Skeleton width="60px" height="12px" />
            <Skeleton width="80px" height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
}
