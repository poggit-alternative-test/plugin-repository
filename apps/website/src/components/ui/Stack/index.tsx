/**
 * Stack Component
 *
 * A primitive component for vertical layout.
 */

import { type HTMLAttributes, type ReactNode } from 'react';

export type StackSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackJustify = 'start' | 'center' | 'end' | 'between';

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  spacing?: StackSpacing;
  align?: StackAlign;
  justify?: StackJustify;
  divider?: ReactNode;
}

const spacingClasses: Record<StackSpacing, string> = {
  none: 'space-y-0',
  xs: 'space-y-1',
  sm: 'space-y-2',
  md: 'space-y-4',
  lg: 'space-y-6',
  xl: 'space-y-8',
};

const alignClasses: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyClasses: Record<StackJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

export function Stack({
  children,
  spacing = 'md',
  align = 'stretch',
  justify = 'start',
  divider,
  className = '',
  ...props
}: StackProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const withDividers = divider
    ? childArray.flatMap((child, index) =>
        index < childArray.length - 1
          ? [child, <div key={`divider-${index}`} className="py-2">{divider}</div>]
          : [child]
      )
    : childArray;

  return (
    <div
      className={`
        flex flex-col
        ${spacingClasses[spacing]}
        ${alignClasses[align]}
        ${justifyClasses[justify]}
        ${className}
      `}
      {...props}
    >
      {withDividers}
    </div>
  );
}
