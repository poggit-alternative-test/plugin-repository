/**
 * Author Feature
 *
 * The author detail feature module.
 *
 * Architecture:
 * - Generated JSON → SDK (services/) → Hooks → Feature Components → Page → UI
 */

// Main feature component
export { AuthorFeature } from './AuthorFeature';
export type { AuthorFeatureProps } from './AuthorFeature';

// Authors listing feature
export { AuthorsFeature } from './AuthorsFeature';

// Components
export * from './components';

// Hooks
export * from './hooks';

// Utils
export * from './utils';
