/**
 * useSearch Hook
 *
 * React hook for searching and filtering plugins.
 * All business logic is in the search service - this hook only manages React state.
 */

import { useState, useEffect, useCallback } from 'react';
import { getSearchIndex, getPopularPlugins, search, filterPlugins } from '@/services/generated';
import type {
  PopularPlugins,
  SearchIndex,
  SearchIndexEntry,
  PluginFilter,
} from '@/services/generated';

/**
 * State for search data
 */
interface SearchState {
  index: SearchIndex | null;
  popular: PopularPlugins | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for loading search index and popular plugins
 *
 * @returns Search state with loading and error handling
 *
 * @example
 * function SearchPage() {
 *   const { index, popular, loading, error } = useSearch();
 *
 *   if (loading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *
 *   return (
 *     <div>
 *       <Trending plugins={popular?.trending} />
 *       <SearchResults plugins={index?.plugins} />
 *     </div>
 *   );
 * }
 */
export function useSearch() {
  const [state, setState] = useState<SearchState>({
    index: null,
    popular: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [index, popular] = await Promise.all([
        getSearchIndex(),
        getPopularPlugins(),
      ]);

      setState({ index, popular, loading: false, error: null });
    } catch (err) {
      setState({
        index: null,
        popular: null,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    ...state,
    refetch: load,
  };
}

/**
 * Hook for performing search queries
 *
 * @param query - The search query string
 * @param limit - Maximum number of results
 * @returns Search results with loading state
 *
 * @example
 * function SearchResults({ query }: { query: string }) {
 *   const { results, loading } = useSearchResults(query);
 *
 *   if (loading) return <Loading />;
 *
 *   return (
 *     <ul>
 *       {results.map(plugin => (
 *         <li key={plugin.id}>{plugin.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 */
export function useSearchResults(query: string, limit = 20) {
  const [results, setResults] = useState<SearchIndexEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;

    async function performSearch() {
      setLoading(true);
      setError(null);

      try {
        const searchResults = await search(query, limit);

        if (!cancelled) {
          setResults(searchResults);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    performSearch();

    return () => {
      cancelled = true;
    };
  }, [query, limit]);

  return { results, loading, error };
}

/**
 * Hook for filtered plugin lists
 *
 * @param filter - Filter configuration
 * @returns Filtered plugins
 *
 * @example
 * function AuthorPlugins({ author }: { author: string }) {
 *   const { plugins, loading } = useFilteredPlugins({ author });
 *
 *   return (
 *     <ul>
 *       {plugins.map(plugin => (
 *         <li key={plugin.id}>{plugin.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 */
export function useFilteredPlugins(filter: PluginFilter) {
  const [plugins, setPlugins] = useState<SearchIndexEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function performFilter() {
      setLoading(true);
      setError(null);

      try {
        const filtered = await filterPlugins(filter);

        if (!cancelled) {
          setPlugins(filtered);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setPlugins([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    performFilter();

    return () => {
      cancelled = true;
    };
  }, [filter.author, filter.category, filter.status]);

  return { plugins, loading, error };
}
