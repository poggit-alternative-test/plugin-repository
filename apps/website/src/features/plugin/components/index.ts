/**
 * Plugin Feature Components
 *
 * Feature-specific components for the plugin detail page.
 *
 * Architecture:
 * - Feature components are composed from UI primitives
 * - Feature components may use hooks and services
 * - Reusable domain components are in @/features/_shared/plugin
 */

export { PluginHeader } from './PluginHeader';
export { PluginMetadata } from './PluginMetadata';
export { PluginVersions } from './PluginVersions';
export { PluginSidebar } from './PluginSidebar';
export { PluginStatus } from './PluginStatus';
export { PluginReadmePreview } from './PluginReadmePreview';
