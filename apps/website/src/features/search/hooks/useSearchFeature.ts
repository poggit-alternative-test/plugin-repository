/**
 * useSearchFeature Hook
 *
 * Orchestrates data loading and URL synchronization for search.
 * All business logic stays in services - this hook manages React state only.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getSearchIndex,
  search,
  filterPlugins,
  type PluginFilter,
} from '@/services/generated';
import type { SearchIndexEntry } from '@/services/generated';

// URL parameter names
export const SEARCH_PARAMS = {
  QUERY: 'q',
  PAGE: 'page',
  SORT: 'sort',
  CATEGORY: 'category',
  AUTHOR: 'author',
  STATUS: 'status',
  VIEW: 'view',
} as const;

// Sort options
export type SortOption =
  | 'relevance'
  | 'alphabetical'
  | 'recently-updated'
  | 'newest-release'
  | 'downloads';

// View options
export type ViewOption = 'grid' | 'list';

// Search state interface
export interface SearchState {
  // URL-synced state
  query: string;
  page: number;
  sort: SortOption;
  filters: PluginFilter;
  view: ViewOption;

  // Data state
  results: SearchIndexEntry[];
  allPlugins: SearchIndexEntry[];
  totalCount: number;
  loading: boolean;
  error: Error | null;
}

// Default state
const DEFAULT_STATE: Omit<SearchState, 'query' | 'filters'> = {
  page: 1,
  sort: 'relevance',
  view: 'grid',
  results: [],
  allPlugins: [],
  totalCount: 0,
  loading: true,
  error: null,
};

// Results per page
const PAGE_SIZE = 20;

export interface UseSearchFeatureOptions {
  /** Initial query from URL */
  initialQuery?: string;
}

export interface UseSearchFeatureReturn extends SearchState {
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Commit a query (creates history entry) */
  commitQuery: (query: string) => void;
  /** Set the current page */
  setPage: (page: number) => void;
  /** Set the sort option */
  setSort: (sort: SortOption) => void;
  /** Set a filter */
  setFilter: <K extends keyof PluginFilter>(key: K, value: PluginFilter[K]) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Set the view option */
  setView: (view: ViewOption) => void;
  /** Refresh the search results */
  refetch: () => void;
  /** Total pages */
  totalPages: number;
  /** Current page range (start-end) */
  pageRange: { start: number; end: number };
  /** Whether there are results */
  hasResults: boolean;
  /** Whether filters are active */
  hasActiveFilters: boolean;
  /** Number of active filters */
  activeFilterCount: number;
}

/**
 * Hook for managing search state and URL synchronization
 *
 * @param options - Configuration options
 * @returns Search state and actions
 */
export function useSearchFeature(
  options: UseSearchFeatureOptions = {}
): UseSearchFeatureReturn {
  const [state, setState] = useState<SearchState>(() => ({
    query: options.initialQuery || '',
    filters: {},
    ...DEFAULT_STATE,
  }));

  // Load initial data
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const index = await getSearchIndex();

        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            allPlugins: index.plugins,
            loading: false,
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Perform search when query or filters change
  useEffect(() => {
    let cancelled = false;

    async function performSearch() {
      // Skip if no query and no meaningful filters
      const hasQuery = state.query.trim().length >= 2;
      const hasFilters =
        state.filters.author ||
        state.filters.category ||
        state.filters.status;

      if (!hasQuery && !hasFilters) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            results: [],
            totalCount: 0,
            loading: false,
          }));
        }
        return;
      }

      setState((prev) => ({ ...prev, loading: true }));

      try {
        let results: SearchIndexEntry[];

        if (hasQuery) {
          // Search by query
          results = await search(state.query, 100, state.filters);
        } else {
          // Filter only
          results = await filterPlugins(state.filters);
        }

        // Sort results
        results = sortResults(results, state.sort);

        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            results,
            totalCount: results.length,
            loading: false,
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      }
    }

    performSearch();

    return () => {
      cancelled = true;
    };
  }, [state.query, state.filters, state.sort]);

  // Actions
  const setQuery = useCallback((query: string) => {
    setState((prev) => ({
      ...prev,
      query,
      // Reset page when query changes
      page: 1,
    }));
  }, []);

  const commitQuery = useCallback(
    (query: string) => {
      setState((prev) => ({
        ...prev,
        query,
        page: 1,
      }));
    },
    []
  );

  const setPage = useCallback((page: number) => {
    setState((prev) => ({
      ...prev,
      page: Math.max(1, page),
    }));
  }, []);

  const setSort = useCallback((sort: SortOption) => {
    setState((prev) => ({
      ...prev,
      sort,
      page: 1, // Reset page on sort change
    }));
  }, []);

  const setFilter = useCallback(
    <K extends keyof PluginFilter>(key: K, value: PluginFilter[K]) => {
      setState((prev) => {
        const newFilters = { ...prev.filters };

        if (value === undefined || value === null || value === '') {
          delete newFilters[key];
        } else {
          newFilters[key] = value;
        }

        return {
          ...prev,
          filters: newFilters,
          page: 1, // Reset page on filter change
        };
      });
    },
    []
  );

  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filters: {},
      page: 1,
    }));
  }, []);

  const setView = useCallback((view: ViewOption) => {
    setState((prev) => ({ ...prev, view }));
  }, []);

  const refetch = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }));
  }, []);

  // Computed values
  const totalPages = Math.ceil(state.totalCount / PAGE_SIZE);
  const startIndex = (state.page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, state.totalCount);
  const hasResults = state.results.length > 0;
  const hasActiveFilters =
    !!(state.filters.author || state.filters.category || state.filters.status);
  const activeFilterCount = Object.values(state.filters).filter(
    Boolean
  ).length;

  return {
    ...state,
    setQuery,
    commitQuery,
    setPage,
    setSort,
    setFilter,
    clearFilters,
    setView,
    refetch,
    totalPages,
    pageRange: {
      start: state.totalCount > 0 ? startIndex + 1 : 0,
      end: endIndex,
    },
    hasResults,
    hasActiveFilters,
    activeFilterCount,
  };
}

/**
 * Sort results based on the selected sort option
 */
function sortResults(
  results: SearchIndexEntry[],
  sort: SortOption
): SearchIndexEntry[] {
  const sorted = [...results];

  switch (sort) {
    case 'alphabetical':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;

    case 'recently-updated':
      sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      break;

    case 'newest-release':
      // This would need a release date field - for now, use updatedAt
      sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      break;

    case 'downloads':
      sorted.sort((a, b) => {
        const aDownloads = a.downloads || 0;
        const bDownloads = b.downloads || 0;
        return bDownloads - aDownloads;
      });
      break;

    case 'relevance':
    default:
      // SDK already returns relevance-sorted results
      break;
  }

  return sorted;
}
