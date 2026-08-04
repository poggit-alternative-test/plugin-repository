/**
 * Shadow tokens
 *
 * Consistent box shadows for the design system.
 */

export const shadows = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
} as const;

export type Shadow = keyof typeof shadows;

/**
 * Component-specific shadows
 */
export const componentShadows = {
  card: 'shadow-sm',
  cardHover: 'shadow-md',
  dropdown: 'shadow-lg',
  modal: 'shadow-xl',
} as const;
