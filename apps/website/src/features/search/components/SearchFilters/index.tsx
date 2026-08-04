/**
 * SearchFilters Component
 *
 * Filter sidebar/drawer for search refinement.
 * Follows Figma layout specifications.
 */

import { X } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import type { VersionStatus } from '@/services/generated';

export interface SearchFiltersProps {
  /** Active filters */
  filters: {
    category?: string;
    author?: string;
    status?: VersionStatus;
  };
  /** Number of active filters */
  activeFilterCount: number;
  /** Available categories */
  categories?: string[];
  /** Whether filters are disabled (no results) */
  disabled?: boolean;
  /** Callback to set a filter */
  onFilterChange: (key: 'category' | 'author' | 'status', value: string | undefined) => void;
  /** Callback to clear all filters */
  onClearFilters: () => void;
}

const STATUS_OPTIONS: { value: VersionStatus; label: string }[] = [
  { value: 'published', label: 'Published' },
  { value: 'approved', label: 'Approved' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'revoked', label: 'Revoked' },
];

export function SearchFilters({
  filters,
  activeFilterCount,
  categories = [],
  disabled = false,
  onFilterChange,
  onClearFilters,
}: SearchFiltersProps) {
  return (
    <aside className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            disabled={disabled}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Active filter count badge */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <Badge variant="info" size="sm">
              Status: {filters.status}
              <button
                onClick={() => onFilterChange('status', undefined)}
                className="ml-1 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.category && (
            <Badge variant="info" size="sm">
              Category: {filters.category}
              <button
                onClick={() => onFilterChange('category', undefined)}
                className="ml-1 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.author && (
            <Badge variant="info" size="sm">
              Author: {filters.author}
              <button
                onClick={() => onFilterChange('author', undefined)}
                className="ml-1 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Status filter */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</h4>
        <div className="space-y-1">
          {STATUS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
            >
              <input
                type="radio"
                name="status"
                value={option.value}
                checked={filters.status === option.value}
                onChange={() =>
                  onFilterChange(
                    'status',
                    filters.status === option.value
                      ? undefined
                      : option.value
                  )
                }
                disabled={disabled}
                className="text-primary-600 dark:text-primary-400 focus:ring-primary-500 dark:bg-gray-800"
              />
              {option.label}
            </label>
          ))}
          {filters.status && (
            <button
              onClick={() => onFilterChange('status', undefined)}
              className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mt-1"
            >
              Clear status filter
            </button>
          )}
        </div>
      </div>

      {/* Category filter - using native select */}
      {categories.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</h4>
          <select
            value={filters.category || ''}
            onChange={(e) =>
              onFilterChange('category', e.target.value || undefined)
            }
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100 focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-gray-700"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Author filter */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Author</h4>
        <input
          type="text"
          value={filters.author || ''}
          onChange={(e) =>
            onFilterChange('author', e.target.value || undefined)
          }
          placeholder="Filter by author..."
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-gray-700"
        />
      </div>
    </aside>
  );
}
