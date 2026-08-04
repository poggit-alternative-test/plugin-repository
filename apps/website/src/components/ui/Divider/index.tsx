/**
 * Divider Component
 *
 * A horizontal divider.
 * Visual implementation follows Figma design.
 */

import { type HTMLAttributes } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Divider({ orientation = 'horizontal', className = '', ...props }: DividerProps) {
  const { colors } = useTheme();

  if (orientation === 'vertical') {
    return (
      <div
        className={`inline-block w-px bg-[var(--color-border)] ${className}`}
        {...props}
      />
    );
  }

  return (
    <hr
      className={`border-0 border-t h-px mb-16 ${className}`}
      style={{ borderColor: colors.border }}
      {...props}
    />
  );
}
