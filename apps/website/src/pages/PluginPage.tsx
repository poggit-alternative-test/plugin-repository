/**
 * PluginPage
 *
 * The plugin detail page.
 * Composes the PluginFeature component with routing parameters.
 *
 * Architecture:
 * - Pages compose Feature Components
 * - Pages do not contain layout logic
 * - Pages extract route parameters and pass to features
 */

import { useParams } from 'react-router-dom';
import { PluginFeature } from '@/features/plugin';

export function PluginPage() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    return null;
  }

  return <PluginFeature pluginId={slug} />;
}
