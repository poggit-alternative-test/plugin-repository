/**
 * useAuthor Hook
 *
 * React hook for loading author data.
 */

import { useState, useEffect, useCallback } from 'react';
import { getAuthor, getAuthors } from '@/services/generated';
import type { Author, AuthorList } from '@/services/generated';

/**
 * State for author list data
 */
interface AuthorListState {
  data: AuthorList | null;
  loading: boolean;
  error: Error | null;
}

/**
 * State for a single author's data
 */
interface AuthorState {
  data: Author | null;
  loading: boolean;
  error: Error | null;
  notFound: boolean;
}

/**
 * Hook for loading author list
 *
 * @returns Author list state with loading and error handling
 *
 * @example
 * function AuthorListPage() {
 *   const { data, loading, error } = useAuthorList();
 *
 *   if (loading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *
 *   return (
 *     <ul>
 *       {data?.authors.map(author => (
 *         <li key={author.login}>{author.login}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 */
export function useAuthorList() {
  const [state, setState] = useState<AuthorListState>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await getAuthors();
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

/**
 * Hook for loading a single author by login
 *
 * @param login - The author's GitHub login
 * @returns Author state with loading and error handling
 *
 * @example
 * function AuthorPage({ login }: { login: string }) {
 *   const { data, loading, error, notFound } = useAuthor(login);
 *
 *   if (loading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *   if (notFound) return <NotFound />;
 *
 *   return <AuthorProfile author={data} />;
 * }
 */
export function useAuthor(login: string | undefined) {
  const [state, setState] = useState<AuthorState>({
    data: null,
    loading: true,
    error: null,
    notFound: false,
  });

  const load = useCallback(async () => {
    if (!login) {
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
      const data = await getAuthor(login);

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
  }, [login]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    ...state,
    refetch: load,
  };
}
