/**
 * VersionPage
 *
 * The version detail page.
 * Composes the VersionFeature component with routing parameters.
 *
 * Architecture:
 * - Pages compose Feature Components
 * - Pages do not contain layout logic
 * - Pages extract route parameters and pass to features
 */

import { useParams } from 'react-router-dom';
import { VersionFeature } from '@/features/version';

export function VersionPage() {
  const { slug, version } = useParams<{ slug: string; version: string }>();

  if (!slug || !version) {
    return null;
  }

  return <VersionFeature pluginId={slug} version={version} />;
}
