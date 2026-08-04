/**
 * SearchPage
 *
 * The search page.
 * Composes the SearchFeature component.
 *
 * Architecture:
 * - Pages compose Feature Components
 * - Pages do not contain layout logic
 * - Pages extract route parameters if needed
 */

import { SearchFeature } from '@/features/search';

export function SearchPage() {
  return <SearchFeature />;
}
