/**
 * Inline Component
 *
 * A primitive component for horizontal layout.
 */

import { type HTMLAttributes, type ReactNode } from 'react';

export type InlineSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg';
export type InlineAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type InlineJustify = 'start' | 'center' | 'end' | 'between' | 'around';

export interface InlineProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  spacing?: InlineSpacing;
  align?: InlineAlign;
  justify?: InlineJustify;
  wrap?: boolean;
}

const spacingClasses: Record<InlineSpacing, string> = {
  none: 'space-x-0',
  xs: 'space-x-1',
  sm: 'space-x-2',
  md: 'space-x-4',
  lg: 'space-x-6',
};

const alignClasses: Record<InlineAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const justifyClasses: Record<InlineJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
};

export function Inline({
  children,
  spacing = 'sm',
  align = 'center',
  justify = 'start',
  wrap = false,
  className = '',
  ...props
}: InlineProps) {
  return (
    <div
      className={`
        flex
        ${spacingClasses[spacing]}
        ${alignClasses[align]}
        ${justifyClasses[justify]}
        ${wrap ? 'flex-wrap' : 'flex-nowrap'}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
