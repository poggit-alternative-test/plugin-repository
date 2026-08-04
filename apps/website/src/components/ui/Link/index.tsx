/**
 * Link Component
 *
 * A navigation link component.
 */

import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  to?: string;
}

export function Link({ children, to, className = '', href, ...props }: LinkProps) {
  const isExternal = href?.startsWith('http') || href?.startsWith('//');
  const destination = to || href || '#';

  if (isExternal) {
    return (
      <a
        href={destination}
        className={`text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 ${className}`}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <RouterLink to={destination} className={`text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 ${className}`} {...props}>
      {children}
    </RouterLink>
  );
}
