/**
 * Section Component
 *
 * A section container with optional title and description.
 */

import { type HTMLAttributes, type ReactNode } from 'react';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: 'section' | 'div' | 'article' | 'aside';
}

export function Section({
  children,
  as: Tag = 'section',
  className = '',
  ...props
}: SectionProps) {
  return (
    <Tag className={`py-8 ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  centered?: boolean;
}

export function SectionHeader({
  title,
  description,
  action,
  centered = false,
}: SectionHeaderProps) {
  return (
    <div className={`mb-6 ${centered ? 'text-center' : ''}`}>
      <div className={`flex ${action ? 'justify-between items-start' : ''} ${centered ? 'justify-center' : ''}`}>
        <div className={centered ? 'max-w-2xl mx-auto' : ''}>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {description && <p className="mt-2 text-gray-600">{description}</p>}
        </div>
        {action && <div className="ml-4">{action}</div>}
      </div>
    </div>
  );
}
