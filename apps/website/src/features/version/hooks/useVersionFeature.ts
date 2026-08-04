/**
 * useVersionFeature Hook
 *
 * Orchestrates data loading for the version feature.
 * All business logic stays in services, this hook only manages React state.
 */

import { useState, useEffect, useCallback } from 'react';
import { getVersion, getPlugin } from '@/services/generated';
import type { Version, Plugin } from '@/services/generated';

export interface VersionFeatureState {
  version: Version | null;
  plugin: Plugin | null;
  loading: boolean;
  error: Error | null;
  notFound: boolean;
}

/**
 * Hook for loading version and plugin data for the feature
 *
 * @param pluginId - The plugin ID
 * @param versionString - The version string
 * @returns Combined state for version and plugin data
 */
export function useVersionFeature(
  pluginId: string | undefined,
  versionString: string | undefined
) {
  const [state, setState] = useState<VersionFeatureState>({
    version: null,
    plugin: null,
    loading: true,
    error: null,
    notFound: false,
  });

  const load = useCallback(async () => {
    if (!pluginId || !versionString) {
      setState({
        version: null,
        plugin: null,
        loading: false,
        error: null,
        notFound: false,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      notFound: false,
    }));

    try {
      // Load version data
      const version = await getVersion(pluginId, versionString);

      if (!version) {
        setState({
          version: null,
          plugin: null,
          loading: false,
          error: null,
          notFound: true,
        });
        return;
      }

      // Load plugin data for context
      const plugin = await getPlugin(pluginId);

      setState({
        version,
        plugin: plugin || null,
        loading: false,
        error: null,
        notFound: false,
      });
    } catch (err) {
      setState({
        version: null,
        plugin: null,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
        notFound: false,
      });
    }
  }, [pluginId, versionString]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    ...state,
    refetch: load,
  };
}
