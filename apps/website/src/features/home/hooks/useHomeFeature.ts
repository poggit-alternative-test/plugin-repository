/**
 * useHomeFeature Hook
 *
 * Orchestrates data loading for the home feature.
 * Uses existing search hooks to get index and popular plugins.
 */

import { useState, useEffect, useCallback } from 'react';
import { getSearchIndex, getPopularPlugins, getPlugins } from '@/services/generated';
import type { SearchIndex, PopularPlugins, PluginListItem, Manifest } from '@/services/generated';

export interface HomeFeatureState {
  /** Full search index */
  index: SearchIndex | null;
  /** Popular and trending plugins */
  popular: PopularPlugins | null;
  /** Plugin list */
  plugins: PluginListItem[];
  /** Manifest for stats */
  manifest: Manifest | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for loading home page data
 *
 * @returns Home page state with all required data
 */
export function useHomeFeature() {
  const [state, setState] = useState<HomeFeatureState>({
    index: null,
    popular: null,
    plugins: [],
    manifest: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [index, popular, pluginsList, manifest] = await Promise.all([
        getSearchIndex(),
        getPopularPlugins(),
        getPlugins(),
        // We could add a manifest service if needed
        Promise.resolve(null),
      ]);

      setState({
        index,
        popular,
        plugins: pluginsList.plugins,
        manifest,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({
        index: null,
        popular: null,
        plugins: [],
        manifest: null,
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
