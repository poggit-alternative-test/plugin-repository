/**
 * Spacing tokens
 *
 * Consistent spacing scale for the design system.
 */

/**
 * Spacing scale (Tailwind class names)
 */
export const spacing = {
  0: 'space-0',
  1: 'space-1',
  2: 'space-2',
  3: 'space-3',
  4: 'space-4',
  5: 'space-5',
  6: 'space-6',
  8: 'space-8',
  10: 'space-10',
  12: 'space-12',
  16: 'space-16',
} as const;

/**
 * Component-specific spacing
 */
export const componentSpacing = {
  // Padding
  padding: {
    none: 'p-0',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  },
  // Gap
  gap: {
    none: 'gap-0',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  },
} as const;

/**
 * Stack spacing (for Stack component)
 */
export const stackSpacing = {
  none: 0,
  xs: 1,
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
} as const;
