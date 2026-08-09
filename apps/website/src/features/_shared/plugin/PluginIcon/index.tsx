/**
 * PluginIcon Component
 *
 * Tries to load plugin icon from repository.
 * Falls back to letter avatar if icon not found.
 */

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export interface PluginIconProps {
  /** Plugin repository in owner/repo format */
  repo?: string;
  /** Plugin name for fallback avatar */
  name: string;
  /** Icon size in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

const ICON_PATHS = [
  'main/icon.png',
  'main/assets/icon.png',
  'main/resources/icon.png',
  'HEAD/icon.png',
  'HEAD/assets/icon.png',
  'HEAD/resources/icon.png',
  'master/icon.png',
  'master/assets/icon.png',
  'master/resources/icon.png',
];

export function PluginIcon({ repo, name, size = 56, className = '' }: PluginIconProps) {
  const { colors } = useTheme();
  const [iconIndex, setIconIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  const borderRadius = Math.max(8, size / 4);

  // Fallback to letter avatar
  if (!repo || hasError) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius,
          background: `linear-gradient(135deg, ${colors.brandBg}, ${colors.card})`,
          border: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.4,
          fontWeight: 600,
          color: colors.brand,
          flexShrink: 0,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  const iconUrl = `https://raw.githubusercontent.com/${repo}/${ICON_PATHS[iconIndex]}`;

  return (
    <img
      src={iconUrl}
      alt={name}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius,
        border: `1px solid ${colors.border}`,
        objectFit: 'cover',
        flexShrink: 0,
      }}
      onError={() => {
        if (iconIndex < ICON_PATHS.length - 1) {
          setIconIndex(iconIndex + 1);
        } else {
          setHasError(true);
        }
      }}
    />
  );
}
