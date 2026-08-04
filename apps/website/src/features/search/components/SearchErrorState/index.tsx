/**
 * SearchErrorState Component
 *
 * Displayed when search fails due to an error.
 * Follows Figma layout specifications.
 */

import { AlertCircle } from 'lucide-react';
import { Card, Button } from '@/components/ui';

export interface SearchErrorStateProps {
  /** The error message */
  error: Error | string;
  /** Callback to retry */
  onRetry: () => void;
}

export function SearchErrorState({
  error,
  onRetry,
}: SearchErrorStateProps) {
  const message = error instanceof Error ? error.message : error;

  return (
    <Card padding="lg" className="text-center">
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Failed to load results
          </h3>
          <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">{message}</p>
        </div>
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Card>
  );
}
