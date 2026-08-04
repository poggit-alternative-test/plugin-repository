/**
 * useAuthorFeature Hook
 *
 * Orchestrates data loading for the author feature.
 * All business logic stays in services, this hook only manages React state.
 */

import { useState, useEffect, useCallback } from 'react';
import { getAuthor } from '@/services/generated';
import type { Author } from '@/services/generated';

export interface AuthorFeatureState {
  author: Author | null;
  loading: boolean;
  error: Error | null;
  notFound: boolean;
}

/**
 * Hook for loading author data
 *
 * @param login - The author's GitHub login
 * @returns Author state with loading and error handling
 */
export function useAuthorFeature(login: string | undefined) {
  const [state, setState] = useState<AuthorFeatureState>({
    author: null,
    loading: true,
    error: null,
    notFound: false,
  });

  const load = useCallback(async () => {
    if (!login) {
      setState({
        author: null,
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
      const author = await getAuthor(login);

      if (author) {
        setState({
          author,
          loading: false,
          error: null,
          notFound: false,
        });
      } else {
        setState({
          author: null,
          loading: false,
          error: null,
          notFound: true,
        });
      }
    } catch (err) {
      setState({
        author: null,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
        notFound: false,
      });
    }
  }, [login]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    ...state,
    refetch: load,
  };
}
