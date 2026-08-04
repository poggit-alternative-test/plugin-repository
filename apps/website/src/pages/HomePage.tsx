/**
 * HomePage
 *
 * The home page.
 * Composes the HomeFeature component.
 *
 * Architecture:
 * - Pages compose Feature Components
 * - Pages do not contain layout logic
 * - Pages extract route parameters if needed
 */

import { useSearchParams } from 'react-router-dom';
import { HomeFeature } from '@/features/home';

export function HomePage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  return <HomeFeature initialQuery={query} />;
}
