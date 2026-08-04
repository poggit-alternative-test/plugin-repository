/**
 * usePluginFeature Hook
 *
 * Orchestrates data loading for the plugin feature.
 * All business logic stays in services, this hook only manages React state.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPlugin, getVersion } from '@/services/generated';
import type { Plugin, Version } from '@/services/generated';

export interface PluginFeatureState {
  plugin: Plugin | null;
  version: Version | null;
  loading: boolean;
  error: Error | null;
  notFound: boolean;
}

/**
 * Hook for loading plugin and version data for the feature
 *
 * @param pluginId - The plugin ID from the URL
 * @param version - Optional specific version to load
 * @returns Combined state for plugin and version data
 *
 * @example
 * function PluginDetail({ pluginId, version }: Props) {
 *   const { plugin, version, loading, error, notFound } = usePluginFeature(pluginId, version);
 *
 *   if (loading) return <LoadingState />;
 *   if (error) return <ErrorState error={error} />;
 *   if (notFound) return <NotFoundState />;
 *
 *   return <PluginFeature plugin={plugin} version={version} />;
 * }
 */
export function usePluginFeature(
  pluginId: string | undefined,
  version?: string | undefined
) {
  const [state, setState] = useState<PluginFeatureState>({
    plugin: null,
    version: null,
    loading: true,
    error: null,
    notFound: false,
  });

  const load = useCallback(async () => {
    if (!pluginId) {
      setState({
        plugin: null,
        version: null,
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
      // Load plugin data
      const plugin = await getPlugin(pluginId);

      if (!plugin) {
        setState({
          plugin: null,
          version: null,
          loading: false,
          error: null,
          notFound: true,
        });
        return;
      }

      // If a specific version is requested, load it
      let versionData: Version | null = null;
      if (version) {
        versionData = await getVersion(pluginId, version) || null;
      }

      setState({
        plugin,
        version: versionData,
        loading: false,
        error: null,
        notFound: false,
      });
    } catch (err) {
      setState({
        plugin: null,
        version: null,
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
