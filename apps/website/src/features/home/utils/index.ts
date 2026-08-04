/**
 * Home Feature Utils
 *
 * Utility functions for the home feature.
 */

/**
 * Get the repository stats for display
 */
export function getStats(
  pluginCount: number,
  versionCount: number
): { label: string; value: string }[] {
  return [
    { label: 'Plugins', value: formatNumber(pluginCount) },
    { label: 'Versions', value: formatNumber(versionCount) },
  ];
}

/**
 * Format a large number for display
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}
