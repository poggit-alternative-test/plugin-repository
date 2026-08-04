/**
 * PluginSidebar Component
 *
 * Displays download button, metadata, and links.
 * DOM structure matches Figma export exactly.
 */

import type { Plugin } from '@/services/generated';
import { useTheme } from '@/contexts/ThemeContext';

export interface PluginSidebarProps {
  plugin: Plugin;
}

/**
 * PluginSidebar matches the Figma DOM structure:
 *
 * div (Sidebar - padding:24, flexDirection:column, gap:24)
 * ├── button (Install - gradient, full width)
 * │   └── text "↓ Install Plugin"
 * ├── div (Metadata List - flex:column, gap:16)
 * │   ├── div (Metadata Item)
 * │   │   ├── span "Version"
 * │   │   └── span "2.4.1"
 * │   └── ... (8 items)
 * └── div (Links Section)
 *     ├── div (Label) "Links"
 *     └── a links...
 */
export function PluginSidebar({ plugin }: PluginSidebarProps) {
  const { colors } = useTheme();

  const metadata = [
    { label: 'Version', value: plugin.latestVersion || 'N/A', mono: true },
    { label: 'Published', value: '2 days ago', mono: false },
    { label: 'Author', value: plugin.author, mono: true },
    { label: 'License', value: 'MIT', mono: false },
    { label: 'PHP', value: '≥ 8.2', mono: true },
    { label: 'PM API', value: '4.0.0, 5.x', mono: true },
    { label: 'Downloads', value: '248,341', mono: true },
    { label: 'Dependents', value: '47 plugins', mono: false },
  ];

  const links = [
    'GitHub Repository ↗',
    'Issue Tracker ↗',
    'Changelog ↗',
    'Wiki ↗',
  ];

  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Install button */}
      <button
        onClick={() => {
          if (plugin.latestRelease?.file) {
            window.open(plugin.latestRelease.file, '_blank');
          }
        }}
        style={{
          width: '100%',
          padding: '12px',
          background: `linear-gradient(135deg, ${colors.brandLight}, ${colors.brandDark})`,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        ↓ Install Plugin
      </button>

      {/* Metadata list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {metadata.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: `1px solid ${colors.borderSubtle}`,
              fontSize: 12,
            }}
          >
            <span style={{ color: colors.textMuted }}>{item.label}</span>
            <span
              style={{
                color: colors.textSecondary,
                fontFamily: item.mono ? 'var(--font-mono)' : 'var(--font-sans)',
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Links section */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: colors.textMuted,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Links
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {links.map((link) => (
            <a
              key={link}
              href="#"
              style={{
                fontSize: 12,
                color: colors.brand,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
