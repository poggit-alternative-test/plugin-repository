/**
 * ErrorState Component
 *
 * A component for displaying error states.
 */

import { type ReactNode, type HTMLAttributes } from 'react';
import { Button } from '../Button';

export interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  error?: Error | null;
  onRetry?: () => void;
  icon?: ReactNode;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  error,
  onRetry,
  icon,
  className = '',
  ...props
}: ErrorStateProps) {
  const displayMessage = message || error?.message || 'An unexpected error occurred. Please try again.';

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`} {...props}>
      {icon ? (
        <div className="mb-4 text-red-500">{icon}</div>
      ) : (
        <svg className="w-12 h-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )}

      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-6 max-w-sm">{displayMessage}</p>

      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          Try again
        </Button>
      )}
    </div>
  );
}
