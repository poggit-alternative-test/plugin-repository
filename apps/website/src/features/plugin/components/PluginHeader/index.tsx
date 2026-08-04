/**
 * PluginHeader Component
 *
 * Displays the plugin name, author, status, and metadata.
 * DOM structure matches Figma export exactly.
 */

import type { Plugin } from '@/services/generated';
import { useTheme } from '@/contexts/ThemeContext';

export interface PluginHeaderProps {
  plugin: Plugin;
}

/**
 * Badge component matching Figma T component
 */
function Badge({ label, color }: { label: string; color: 'blue' | 'green' | 'zinc' | 'red' | 'amber' }) {
  const { colors } = useTheme();

  const colorMap = {
    blue: { bg: colors.brandBg, text: colors.brand },
    green: { bg: colors.successBg, text: colors.success },
    zinc: { bg: colors.card, text: colors.textSecondary },
    red: { bg: colors.errorBg, text: colors.error },
    amber: { bg: colors.warningBg, text: colors.warning },
  };

  const { bg, text } = colorMap[color] || colorMap.zinc;

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        backgroundColor: bg,
        color: text,
      }}
    >
      {label}
    </span>
  );
}

/**
 * PluginHeader matches the Figma DOM structure:
 *
 * div (Plugin Header - flex, gap:16)
 * ├── div (Plugin Icon - 64x64, borderRadius:14)
 * └── div (Info - flex:1)
 *     ├── div (Title Row - flex, flexWrap:wrap)
 *     │   ├── h1 "EconomyCore"
 *     │   ├── Badge "v2.4.1"
 *     │   ├── Badge "latest"
 *     │   └── Badge "✓ Verified"
 *     ├── p (Description)
 *     └── div (Tags - flex, flexWrap:wrap)
 *         ├── Badge "Economy"
 *         ├── Badge "PM 5.x"
 *         ├── Badge "PHP 8.2+"
 *         └── Badge "MIT"
 */
export function PluginHeader({ plugin }: PluginHeaderProps) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 32,
      }}
    >
      {/* Plugin icon */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${colors.brandLight}22, ${colors.brandDark}22)`,
          border: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          flexShrink: 0,
        }}
      >
        {plugin.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        {/* Title row with badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 6,
          }}
        >
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {plugin.name}
          </h1>
          <Badge label={`v${plugin.latestVersion}`} color="blue" />
          <Badge label="latest" color="green" />
          {plugin.verified && <Badge label="✓ Verified" color="green" />}
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 1.6,
            margin: '0 0 12px',
          }}
        >
          {plugin.summary}
        </p>

        {/* Tags */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <Badge label="Economy" color="zinc" />
          <Badge label="PM 5.x" color="blue" />
          <Badge label="PHP 8.2+" color="zinc" />
          <Badge label="MIT" color="green" />
        </div>
      </div>
    </div>
  );
}
