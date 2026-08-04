/**
 * Typography tokens
 *
 * Consistent typography scale for the design system.
 */

/**
 * Font families
 */
export const fonts = {
  sans: 'font-sans',
  mono: 'font-mono',
} as const;

/**
 * Font sizes
 */
export const fontSizes = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
} as const;

/**
 * Font weights
 */
export const fontWeights = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
} as const;

/**
 * Line heights
 */
export const lineHeights = {
  tight: 'leading-tight',
  snug: 'leading-snug',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
} as const;
