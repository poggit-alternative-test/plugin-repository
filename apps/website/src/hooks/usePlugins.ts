/**
 * usePlugins Hook
 *
 * React hook for loading plugin list data.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPlugins } from '@/services/generated';
import type { PluginList } from '@/services/generated';

/**
 * State for the plugin list data
 */
interface PluginsState {
  data: PluginList | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for loading plugin list data
 *
 * @returns Plugin list state with loading and error handling
 *
 * @example
 * function PluginListPage() {
 *   const { data, loading, error } = usePlugins();
 *
 *   if (loading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *
 *   return (
 *     <ul>
 *       {data?.plugins.map(plugin => (
 *         <li key={plugin.id}>{plugin.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 */
export function usePlugins() {
  const [state, setState] = useState<PluginsState>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await getPlugins();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
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
