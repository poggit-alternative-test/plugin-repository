/**
 * Border radius tokens
 *
 * Consistent border radius for the design system.
 */

export const radius = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
} as const;

export type Radius = keyof typeof radius;

/**
 * Component-specific radius
 */
export const componentRadius = {
  button: 'rounded-lg',
  input: 'rounded-lg',
  card: 'rounded-lg',
  badge: 'rounded-full',
  avatar: 'rounded-full',
} as const;
