/**
 * List Component
 *
 * A list wrapper with consistent styling.
 */

import { type HTMLAttributes, type ReactNode } from 'react';

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
  unstyled?: boolean;
}

export function List({ children, unstyled = false, className = '', ...props }: ListProps) {
  return (
    <ul className={`${unstyled ? '' : 'divide-y divide-gray-200 border-t border-b border-gray-200'} ${className}`} {...props}>
      {children}
    </ul>
  );
}

export interface ListItemProps extends HTMLAttributes<HTMLLIElement> {
  children: ReactNode;
}

export function ListItem({ children, className = '', ...props }: ListItemProps) {
  return (
    <li className={`flex items-center py-3 px-4 ${className}`} {...props}>
      {children}
    </li>
  );
}
