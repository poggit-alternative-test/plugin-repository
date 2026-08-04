/**
 * Grid Component
 *
 * A primitive component for CSS grid layouts.
 */

import { type HTMLAttributes, type ReactNode } from 'react';

export type GridColumns = 1 | 2 | 3 | 4 | 6 | 12;
export type GridGap = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  columns?: GridColumns | { base?: GridColumns; sm?: GridColumns; md?: GridColumns; lg?: GridColumns };
  gap?: GridGap;
}

const gapClasses: Record<GridGap, string> = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

function getColumnClasses(columns: GridColumns | { base?: GridColumns; sm?: GridColumns; md?: GridColumns; lg?: GridColumns }): string {
  if (typeof columns === 'number') {
    return `grid-cols-${columns}`;
  }

  const classes: string[] = [];

  if (columns.base) classes.push(`grid-cols-${columns.base}`);
  if (columns.sm) classes.push(`sm:grid-cols-${columns.sm}`);
  if (columns.md) classes.push(`md:grid-cols-${columns.md}`);
  if (columns.lg) classes.push(`lg:grid-cols-${columns.lg}`);

  return classes.join(' ');
}

export function Grid({
  children,
  columns = { sm: 1, md: 2, lg: 3 },
  gap = 'md',
  className = '',
  ...props
}: GridProps) {
  return (
    <div
      className={`
        grid
        ${gapClasses[gap]}
        ${getColumnClasses(columns)}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
