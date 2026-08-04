/**
 * Heading Component
 *
 * A primitive heading component for consistent typography.
 */

import { type HTMLAttributes, type ReactNode } from 'react';

export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type HeadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  level?: HeadingLevel;
  size?: HeadingSize;
  muted?: boolean;
}

const sizeClasses: Record<HeadingSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
};

const defaultSizes: Record<HeadingLevel, HeadingSize> = {
  h1: '4xl',
  h2: '3xl',
  h3: '2xl',
  h4: 'xl',
  h5: 'lg',
  h6: 'md',
};

export function Heading({
  children,
  level = 'h2',
  size,
  muted = false,
  className = '',
  ...props
}: HeadingProps) {
  const Tag = level;
  const resolvedSize = size ?? defaultSizes[level];

  return (
    <Tag
      className={`
        font-bold text-gray-900
        ${sizeClasses[resolvedSize]}
        ${muted ? 'text-gray-600' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </Tag>
  );
}
