/**
 * PluginCard Component
 *
 * A reusable card displaying a plugin's summary information.
 * Visual implementation follows Figma design: 12px border radius, 1px border.
 */

import { Link } from '@/components/ui';
import { StatusBadge } from '@/components/ui';
import { PluginIcon } from '@/features/_shared/plugin';
import type { PluginListItem } from '@/services/generated';
import { useTheme } from '@/contexts/ThemeContext';

export interface PluginCardProps {
  /** The plugin data to display */
  plugin: PluginListItem;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PluginCard displays a plugin summary in card format.
 * Figma style: background card color, border 1px solid, borderRadius 12px
 */
export function PluginCard({ plugin, className = '' }: PluginCardProps) {
  const { colors } = useTheme();

  return (
    <Link
      to={`/plugins/${plugin.id}`}
      className={`group block ${className}`}
    >
      <div
        className="rounded-[12px] border p-4 transition-all hover:opacity-90 cursor-pointer"
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
        }}
      >
        <div className="flex flex-col gap-3">
          {/* Plugin icon and name row */}
          <div className="flex items-center gap-2.5">
            <PluginIcon repo={plugin.repo} name={plugin.name} size={28} />

            {/* Plugin name and status */}
            <div className="flex flex-1 items-center justify-between gap-2">
              <span
                className="text-[13px] font-semibold truncate"
                style={{ color: colors.textPrimary }}
              >
                {plugin.name}
              </span>
              <StatusBadge status={plugin.status} />
            </div>
          </div>

          {/* Plugin summary */}
          <p
            className="line-clamp-2 text-[13px]"
            style={{ color: colors.textSecondary }}
          >
            {plugin.summary}
          </p>

          {/* Metadata row - Figma: fontSize 10, fontFamily JetBrains Mono */}
          <div className="flex items-center gap-2 border-t pt-3" style={{ borderColor: colors.border }}>
            <code
              className="text-[10px] font-mono"
              style={{ color: colors.textMuted }}
            >
              {plugin.latestVersion}
            </code>
            {plugin.downloads !== undefined && (
              <span className="text-[10px]" style={{ color: colors.textMuted }}>
                ↓ {formatDownloads(plugin.downloads)}
              </span>
            )}
            <span
              className="ml-auto text-[10px]"
              style={{ color: colors.textMuted }}
            >
              {plugin.author}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Format downloads for display
 */
function formatDownloads(downloads: number): string {
  if (downloads >= 1000000) {
    return (downloads / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (downloads >= 1000) {
    return (downloads / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return downloads.toString();
}
