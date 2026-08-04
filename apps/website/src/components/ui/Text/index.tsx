/**
 * Text Component
 *
 * A primitive text component for consistent typography.
 */

import { type HTMLAttributes, type ReactNode } from 'react';

export type TextVariant = 'muted' | 'secondary' | 'primary' | 'success' | 'warning' | 'error';
export type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl';
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';

export interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
  variant?: TextVariant;
  size?: TextSize;
  weight?: TextWeight;
  muted?: boolean;
}

const variantClasses: Record<TextVariant, string> = {
  muted: 'text-gray-500',
  secondary: 'text-gray-600',
  primary: 'text-gray-900',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600',
};

const sizeClasses: Record<TextSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const weightClasses: Record<TextWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

export function Text({
  children,
  variant = 'secondary',
  size = 'base',
  weight = 'normal',
  muted = false,
  className = '',
  ...props
}: TextProps) {
  return (
    <p
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${weightClasses[weight]}
        ${muted ? 'opacity-75' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </p>
  );
}
