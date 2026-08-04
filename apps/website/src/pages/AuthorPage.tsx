/**
 * AuthorPage
 *
 * The author detail page.
 * Composes the AuthorFeature component with routing parameters.
 *
 * Architecture:
 * - Pages compose Feature Components
 * - Pages do not contain layout logic
 * - Pages extract route parameters and pass to features
 */

import { useParams } from 'react-router-dom';
import { AuthorFeature } from '@/features/author';

export function AuthorPage() {
  const { owner } = useParams<{ owner: string }>();

  if (!owner) {
    return null;
  }

  return <AuthorFeature login={owner} />;
}
