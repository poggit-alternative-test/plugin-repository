/**
 * SearchToolbar Component
 *
 * Toolbar with sort, view toggle, and result count.
 * Follows Figma layout specifications.
 */

import { Grid, List } from 'lucide-react';
import type { SortOption, ViewOption } from '../../hooks';
import { getSortLabel } from '../../utils';

export interface SearchToolbarProps {
  /** Result count */
  totalCount: number;
  /** Page range */
  pageRange: { start: number; end: number };
  /** Current sort */
  sort: SortOption;
  /** Current view */
  view: ViewOption;
  /** Available sort options */
  availableSorts?: SortOption[];
  /** Whether results are loading */
  loading?: boolean;
  /** Callback when sort changes */
  onSortChange: (sort: SortOption) => void;
  /** Callback when view changes */
  onViewChange: (view: ViewOption) => void;
}

const DEFAULT_SORTS: SortOption[] = [
  'relevance',
  'recently-updated',
  'downloads',
  'alphabetical',
];

export function SearchToolbar({
  totalCount,
  pageRange,
  sort,
  view,
  availableSorts = DEFAULT_SORTS,
  loading = false,
  onSortChange,
  onViewChange,
}: SearchToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      {/* Result count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {totalCount === 0 ? (
          'No results'
        ) : (
          <>
            Showing{' '}
            <span className="font-medium text-gray-900 dark:text-white">
              {pageRange.start}–{pageRange.end}
            </span>{' '}
            of{' '}
            <span className="font-medium text-gray-900 dark:text-white">
              {totalCount}
            </span>{' '}
            result{totalCount === 1 ? '' : 's'}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Sort select - using native select */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Sort by:</span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            disabled={loading}
            className="min-w-[160px] px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100 focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-gray-700"
          >
            {availableSorts.map((s) => (
              <option key={s} value={s}>
                {getSortLabel(s)}
              </option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => onViewChange('grid')}
            className={`p-2 ${
              view === 'grid'
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            aria-label="Grid view"
            title="Grid view"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange('list')}
            className={`p-2 ${
              view === 'list'
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            aria-label="List view"
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
