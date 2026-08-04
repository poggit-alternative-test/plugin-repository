/**
 * Container Component
 *
 * A responsive container component.
 * Visual implementation follows Figma design: 56px 64px padding on desktop.
 */

import { type HTMLAttributes } from 'react';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[80rem]',
  full: 'max-w-full',
};

export function Container({
  size = 'lg',
  className = '',
  children,
  ...props
}: ContainerProps) {
  return (
    <div
      className={`mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
