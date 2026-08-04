/**
 * VersionFeature Component
 *
 * Version detail page.
 * Figma tokens: 360px sidebar, 1fr content, grid layout.
 */

import { useVersionFeature } from './hooks';
import { LoadingState, ErrorState } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';

export interface VersionFeatureProps {
  pluginId: string;
  version: string;
}

export function VersionFeature({ pluginId, version }: VersionFeatureProps) {
  const { colors } = useTheme();
  const { version: v, loading, error } = useVersionFeature(pluginId, version);

  if (loading) {
    return <div style={{ backgroundColor: colors.bg, minHeight: '100vh', padding: '48px 40px' }}>
      <LoadingState message="Loading version..." />
    </div>;
  }

  if (error || !v) {
    return <div style={{ backgroundColor: colors.bg, minHeight: '100vh', padding: '48px 40px' }}>
      <ErrorState title="Version not found" message={error?.message || 'Version not found'} />
    </div>;
  }

  return (
    <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 40px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textPrimary, marginBottom: 8 }}>
          {pluginId} — {version}
        </h1>
        <p style={{ fontSize: 13, color: colors.textSecondary }}>
          Version {version} for {pluginId}
        </p>
      </div>
    </div>
  );
}
