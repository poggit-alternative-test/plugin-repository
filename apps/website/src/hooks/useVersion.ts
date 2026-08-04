/**
 * useVersion Hook
 *
 * React hook for loading a single version's data.
 */

import { useState, useEffect, useCallback } from 'react';
import { getVersion } from '@/services/generated';
import type { Version } from '@/services/generated';

/**
 * State for a single version's data
 */
interface VersionState {
  data: Version | null;
  loading: boolean;
  error: Error | null;
  notFound: boolean;
}

/**
 * Hook for loading a version by plugin ID and version string
 *
 * @param pluginId - The plugin ID
 * @param version - The version string (e.g., "1.0.0")
 * @returns Version state with loading and error handling
 *
 * @example
 * function VersionPage({ pluginId, version }: Props) {
 *   const { data, loading, error, notFound } = useVersion(pluginId, version);
 *
 *   if (loading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *   if (notFound) return <NotFound />;
 *
 *   return <VersionDetails version={data} />;
 * }
 */
export function useVersion(
  pluginId: string | undefined,
  version: string | undefined
) {
  const [state, setState] = useState<VersionState>({
    data: null,
    loading: true,
    error: null,
    notFound: false,
  });

  const load = useCallback(async () => {
    if (!pluginId || !version) {
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
      const data = await getVersion(pluginId, version);

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
  }, [pluginId, version]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    ...state,
    refetch: load,
  };
}
