/**
 * SearchController Component
 *
 * Orchestrates search state management and URL synchronization.
 * This component does NOT render layout - it manages state and passes to children.
 *
 * Responsibilities:
 * - URL parameter parsing and synchronization
 * - Search state management
 * - Calling SDK services
 * - Passing state to presentation components
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSearchFeature, type SortOption, type ViewOption } from './hooks';
import { parseSearchParams, updateSearchParams } from './utils';

export interface SearchControllerProps {
  /** Child component to render with search state */
  children: (state: SearchControllerRenderProps) => React.ReactNode;
}

export interface SearchControllerRenderProps {
  // State
  query: string;
  page: number;
  sort: SortOption;
  view: ViewOption;
  filters: {
    category?: string;
    author?: string;
    status?: string;
  };
  results: ReturnType<typeof useSearchFeature>['results'];
  totalCount: number;
  loading: boolean;
  error: Error | null;
  totalPages: number;
  pageRange: { start: number; end: number };
  hasResults: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;

  // Actions
  setQuery: (query: string) => void;
  commitQuery: (query: string) => void;
  setPage: (page: number) => void;
  setSort: (sort: SortOption) => void;
  setView: (view: ViewOption) => void;
  setFilter: <K extends keyof NonNullable<SearchControllerRenderProps['filters']>>(
    key: K,
    value: NonNullable<SearchControllerRenderProps['filters']>[K]
  ) => void;
  clearFilters: () => void;
  refetch: () => void;
}

export function SearchController({ children }: SearchControllerProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse initial state from URL
  const initialState = useMemo(() => {
    return parseSearchParams(searchParams);
  }, []);

  // Initialize the search feature hook
  const search = useSearchFeature({
    initialQuery: initialState.query,
  });

  // Sync state to URL
  useEffect(() => {
    const params = updateSearchParams({
      query: search.query,
      page: search.page,
      sort: search.sort,
      category: search.filters.category,
      author: search.filters.author,
      status: search.filters.status,
      view: search.view,
    });

    // Only update if params changed
    const currentParams = searchParams.toString();
    const newParams = params.toString();

    if (currentParams !== newParams) {
      setSearchParams(params, { replace: true });
    }
  }, [
    search.query,
    search.page,
    search.sort,
    search.filters.category,
    search.filters.author,
    search.filters.status,
    search.view,
  ]);

  // Handle filter changes with proper typing
  const setFilter = useCallback(
    (key: 'category' | 'author' | 'status', value: string | undefined) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      search.setFilter(key as any, value as any);
    },
    [search]
  );

  // Render children with state
  return children({
    // State
    query: search.query,
    page: search.page,
    sort: search.sort,
    view: search.view,
    filters: {
      category: search.filters.category,
      author: search.filters.author,
      status: search.filters.status,
    },
    results: search.results,
    totalCount: search.totalCount,
    loading: search.loading,
    error: search.error,
    totalPages: search.totalPages,
    pageRange: search.pageRange,
    hasResults: search.hasResults,
    hasActiveFilters: search.hasActiveFilters,
    activeFilterCount: search.activeFilterCount,

    // Actions
    setQuery: search.setQuery,
    commitQuery: search.commitQuery,
    setPage: search.setPage,
    setSort: search.setSort,
    setView: search.setView,
    setFilter,
    clearFilters: search.clearFilters,
    refetch: search.refetch,
  });
}
