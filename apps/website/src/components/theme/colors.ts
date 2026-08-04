/**
 * Theme Module
 *
 * Semantic design tokens for the Axolotl Plugin Registry.
 * These tokens provide a shared vocabulary between components.
 *
 * Note: These are TypeScript constants only. Tailwind is the
 * actual styling implementation. Do not duplicate Tailwind config.
 */

/**
 * Color tokens
 *
 * Semantic color names mapped to Tailwind classes.
 */
export const colors = {
  // Primary palette
  primary: {
    50: 'primary-50',
    100: 'primary-100',
    200: 'primary-200',
    300: 'primary-300',
    400: 'primary-400',
    500: 'primary-500',
    600: 'primary-600',
    700: 'primary-700',
    800: 'primary-800',
    900: 'primary-900',
    950: 'primary-950',
  },

  // Gray palette
  gray: {
    50: 'gray-50',
    100: 'gray-100',
    200: 'gray-200',
    300: 'gray-300',
    400: 'gray-400',
    500: 'gray-500',
    600: 'gray-600',
    700: 'gray-700',
    800: 'gray-800',
    900: 'gray-900',
  },

  // Semantic colors
  success: 'green-600',
  warning: 'yellow-600',
  error: 'red-600',
  info: 'blue-600',
} as const;

/**
 * Semantic color tokens
 */
export const semanticColors = {
  text: {
    primary: 'gray-900',
    secondary: 'gray-600',
    muted: 'gray-500',
    inverse: 'white',
  },
  background: {
    primary: 'white',
    secondary: 'gray-50',
    muted: 'gray-100',
  },
  border: {
    default: 'gray-200',
    strong: 'gray-300',
    focus: 'primary-500',
  },
} as const;
