/**
 * Code Component
 *
 * A primitive code component for inline code.
 */

import type { ReactNode, ComponentPropsWithoutRef } from 'react';

export interface CodeProps extends ComponentPropsWithoutRef<'code'> {
  children: ReactNode;
}

export function Code({ children, className = '', ...props }: CodeProps) {
  return (
    <code
      className={`px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 font-mono text-sm ${className}`}
      {...props}
    >
      {children}
    </code>
  );
}

export interface CodeBlockProps extends ComponentPropsWithoutRef<'pre'> {
  children: ReactNode;
}

export function CodeBlock({ children, className = '', ...props }: CodeBlockProps) {
  return (
    <pre
      className={`p-4 rounded-lg bg-gray-900 text-gray-100 dark:bg-gray-950 dark:text-gray-100 font-mono text-sm overflow-x-auto ${className}`}
      {...props}
    >
      <code>{children}</code>
    </pre>
  );
}
