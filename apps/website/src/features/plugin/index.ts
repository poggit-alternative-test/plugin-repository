/**
 * Plugin Feature
 *
 * The plugin detail feature module.
 *
 * Architecture:
 * - Generated JSON → SDK (services/) → Hooks → Feature Components → Page → UI
 *
 * @example
 * // In a page component
 * import { PluginFeature } from '@/features/plugin';
 *
 * function PluginPage() {
 *   return <PluginFeature pluginId={slug} />;
 * }
 */

// Main feature component
export { PluginFeature } from './PluginFeature';
export type { PluginFeatureProps } from './PluginFeature';

// Components
export * from './components';

// Hooks
export * from './hooks';

// Utils
export * from './utils';
