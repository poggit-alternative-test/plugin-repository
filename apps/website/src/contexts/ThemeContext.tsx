/**
 * Theme Context
 *
 * Provides dark/light theme support following the Figma design system.
 * Uses Axolotl Blue for brand colors and Zinc for neutral colors.
 */

// Axolotl Blue palette (brand colors)
const axolotlBlue = {
  50: '#EBF5FF',
  100: '#C5E4FC',
  200: '#7BC5F8',
  300: '#3BAAF2',
  400: '#18B9EE',
  500: '#128AF1',
  600: '#084DE6',
  700: '#0535A8',
  800: '#031D6B',
  900: '#010B2E',
} as const;

// Zinc palette (neutral colors)
const zinc = {
  50: '#FAFAFA',
  100: '#F4F4F5',
  200: '#E4E4E7',
  300: '#D4D4D8',
  400: '#A1A1AA',
  500: '#71717A',
  600: '#52525B',
  700: '#3F3F46',
  800: '#27272A',
  900: '#18181B',
  950: '#09090B',
} as const;

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface ThemeColors {
  // Neutral colors (Zinc palette)
  bg: string;
  surface: string;
  sidebarBg: string;
  border: string;
  borderSubtle: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Brand colors (Axolotl Blue palette)
  brand: string;
  brandBg: string;
  brandLight: string;
  brandDark: string;
  // Gradient colors (for text and button gradients)
  gradientFrom: string;
  gradientTo: string;
  // Status colors
  error: string;
  errorBg: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
}

const lightTheme: ThemeColors = {
  bg: zinc[50],
  surface: '#FFFFFF',
  sidebarBg: zinc[100],
  border: zinc[200],
  borderSubtle: zinc[100],
  card: zinc[100],
  textPrimary: zinc[950],
  textSecondary: zinc[600],
  textMuted: zinc[400],
  brand: axolotlBlue[600],
  brandBg: axolotlBlue[50],
  brandLight: axolotlBlue[400],
  brandDark: axolotlBlue[600],
  // Gradient: Light to Dark blue
  gradientFrom: axolotlBlue[400],
  gradientTo: axolotlBlue[600],
  error: '#DC2626',
  errorBg: '#DC262620',
  success: '#16A34A',
  successBg: '#16A34A20',
  warning: '#D97706',
  warningBg: '#D9770620',
};

const darkTheme: ThemeColors = {
  bg: zinc[950],
  surface: '#111113',
  sidebarBg: '#0D0D0F',
  border: zinc[800],
  borderSubtle: zinc[900],
  card: zinc[900],
  textPrimary: zinc[50],
  textSecondary: zinc[400],
  textMuted: zinc[600],
  brand: axolotlBlue[400],
  brandBg: axolotlBlue[900],
  brandLight: axolotlBlue[400],
  brandDark: axolotlBlue[700],
  // Gradient: Bright cyan to vivid blue (visible on dark bg)
  gradientFrom: axolotlBlue[400],
  gradientTo: axolotlBlue[600],
  error: '#EF4444',
  errorBg: '#EF444420',
  success: '#22C55E',
  successBg: '#22C55E20',
  warning: '#F59E0B',
  warningBg: '#F59E0B20',
};

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', mode);
  }, [mode]);

  const colors = mode === 'dark' ? darkTheme : lightTheme;

  const toggleMode = () => setMode(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ mode, colors, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
