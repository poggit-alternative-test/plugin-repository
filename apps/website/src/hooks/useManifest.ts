/**
 * useManifest Hook
 *
 * React hook for loading manifest data.
 */

import { useState, useEffect, useCallback } from 'react';
import { getManifest } from '@/services/generated';
import type { Manifest } from '@/services/generated';

/**
 * State for the manifest data
 */
interface ManifestState {
  data: Manifest | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for loading manifest data
 *
 * @returns Manifest state with loading and error handling
 *
 * @example
 * function App() {
 *   const { data, loading, error } = useManifest();
 *
 *   if (loading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *   if (!data) return <NotFound />;
 *
 *   return <div>{data.pluginCount} plugins</div>;
 * }
 */
export function useManifest() {
  const [state, setState] = useState<ManifestState>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await getManifest();
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
