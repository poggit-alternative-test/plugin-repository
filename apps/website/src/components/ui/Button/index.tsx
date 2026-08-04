/**
 * Button Component
 *
 * A versatile button component with multiple variants and sizes.
 * Visual implementation follows Figma design: 10px border radius.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from '../Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, { bg: string; color: string; border?: string; hover?: string }> = {
  primary: { bg: '#084DE6', color: '#FFFFFF', hover: '#0535A8' },
  secondary: { bg: 'var(--color-card)', color: 'var(--color-text-primary)', hover: 'var(--color-border)' },
  outline: { bg: 'transparent', color: 'var(--color-text-primary)', border: 'var(--color-border)', hover: 'var(--color-card)' },
  ghost: { bg: 'transparent', color: 'var(--color-text-secondary)', hover: 'var(--color-card)' },
  destructive: { bg: '#DC2626', color: '#FFFFFF', hover: '#B91C1C' },
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: 'px-4 py-2 text-[13px]',
  lg: 'px-5 py-2.5 text-[14px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    const variantStyle = variantStyles[variant];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2
          font-medium rounded-[10px]
          transition-all duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses[size]}
          ${className}
        `}
        style={{
          backgroundColor: variantStyle.bg,
          color: variantStyle.color,
          border: variantStyle.border ? `1px solid ${variantStyle.border}` : 'none',
          ...style,
        }}
        {...props}
      >
        {isLoading ? <Spinner size="sm" /> : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
