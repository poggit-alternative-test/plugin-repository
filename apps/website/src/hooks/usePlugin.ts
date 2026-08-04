/**
 * usePlugin Hook
 *
 * React hook for loading a single plugin's data.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPlugin } from '@/services/generated';
import type { Plugin } from '@/services/generated';

/**
 * State for a single plugin's data
 */
interface PluginState {
  data: Plugin | null;
  loading: boolean;
  error: Error | null;
  notFound: boolean;
}

/**
 * Hook for loading a single plugin by ID
 *
 * @param id - The plugin ID to load
 * @returns Plugin state with loading and error handling
 *
 * @example
 * function PluginPage({ id }: { id: string }) {
 *   const { data, loading, error, notFound } = usePlugin(id);
 *
 *   if (loading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *   if (notFound) return <NotFound />;
 *
 *   return <PluginDetails plugin={data} />;
 * }
 */
export function usePlugin(id: string | undefined) {
  const [state, setState] = useState<PluginState>({
    data: null,
    loading: true,
    error: null,
    notFound: false,
  });

  const load = useCallback(async () => {
    if (!id) {
      setState({
        data: null,
        loading: false,
        error: null,
        notFound: false,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await getPlugin(id);

      if (data) {
        setState({ data, loading: false, error: null, notFound: false });
      } else {
        setState({ data: null, loading: false, error: null, notFound: true });
      }
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
        notFound: false,
      });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    ...state,
    refetch: load,
  };
}
