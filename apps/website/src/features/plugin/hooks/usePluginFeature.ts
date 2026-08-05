/**
 * usePluginFeature Hook
 *
 * Orchestrates data loading for the plugin feature.
 * All business logic stays in services, this hook only manages React state.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPlugin, getVersion, fetchPluginData } from '@/services/generated';
import type { Plugin, Version } from '@/services/generated';

export interface PluginFeatureState {
  plugin: Plugin | null;
  version: Version | null;
  releases: Version[];
  readme: string | null;
  dependencies: { depend: string[]; softdepend: string[] };
  loading: boolean;
  githubLoading: boolean;
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
    releases: [],
    readme: null,
    dependencies: { depend: [], softdepend: [] },
    loading: true,
    githubLoading: true,
    error: null,
    notFound: false,
  });

  const load = useCallback(async () => {
    if (!pluginId) {
      setState({
        plugin: null,
        version: null,
        releases: [],
        readme: null,
        dependencies: { depend: [], softdepend: [] },
        loading: false,
        githubLoading: false,
        error: null,
        notFound: false,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      githubLoading: true,
      error: null,
      notFound: false,
    }));

    try {
      // Load plugin data
      const plugin = await getPlugin(pluginId);

      if (!plugin) {
        setState((prev) => ({
          ...prev,
          plugin: null,
          version: null,
          releases: [],
          readme: null,
          dependencies: { depend: [], softdepend: [] },
          loading: false,
          githubLoading: false,
          error: null,
          notFound: true,
        }));
        return;
      }

      // If a specific version is requested, load it
      let versionData: Version | null = null;
      if (version) {
        versionData = (await getVersion(pluginId, version)) || null;
      }

      setState((prev) => ({
        ...prev,
        plugin,
        version: versionData,
        loading: false,
      }));

      // Fetch GitHub data (releases, README, dependencies)
      if (plugin.repo) {
        try {
          const githubData = await fetchPluginData(plugin.repo);
          setState((prev) => ({
            ...prev,
            releases: githubData.releases,
            readme: githubData.readme,
            dependencies: githubData.dependencies,
            githubLoading: false,
          }));
        } catch {
          setState((prev) => ({
            ...prev,
            githubLoading: false,
          }));
        }
      } else {
        setState((prev) => ({
          ...prev,
          githubLoading: false,
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        plugin: null,
        version: null,
        releases: [],
        readme: null,
        dependencies: { depend: [], softdepend: [] },
        loading: false,
        githubLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
        notFound: false,
      }));
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
