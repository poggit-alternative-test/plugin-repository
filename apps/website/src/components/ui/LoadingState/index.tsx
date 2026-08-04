/**
 * LoadingState Component
 *
 * A component for displaying loading states.
 */

import { type ReactNode, type HTMLAttributes } from 'react';
import { Spinner } from '../Spinner';

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  message?: string;
  icon?: ReactNode;
}

export function LoadingState({
  message,
  icon,
  className = '',
  ...props
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`} {...props}>
      {icon ? <div className="mb-4">{icon}</div> : <Spinner size="lg" className="mb-4 text-primary-600" />}
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
