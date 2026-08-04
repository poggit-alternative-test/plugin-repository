/**
 * Badge Components
 *
 * A small label component for status and categories.
 * Visual implementation follows Figma design: 6px border radius, JetBrains Mono font.
 */

import type { ComponentPropsWithoutRef } from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: 'var(--color-card)', text: 'var(--color-text-secondary)' },
  success: { bg: '#16A34A20', text: '#16A34A' },
  warning: { bg: '#D9770620', text: '#D97706' },
  error: { bg: '#DC262620', text: '#DC2626' },
  info: { bg: 'var(--color-brand-bg)', text: 'var(--color-brand)' },
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-[11px]',
};

export function Badge({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}: BadgeProps) {
  const style = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-[6px] ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
      }}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * StatusBadge Component
 *
 * A specialized badge for version/plugin status.
 */

export type StatusType = 'approved' | 'materialized' | 'published' | 'deprecated' | 'revoked' | 'removed';

const statusVariantMap: Record<StatusType, BadgeVariant> = {
  approved: 'info',
  materialized: 'warning',
  published: 'success',
  deprecated: 'default',
  revoked: 'error',
  removed: 'default',
};

export interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariantMap[status]} size="sm" className={className}>
      {status}
    </Badge>
  );
}
