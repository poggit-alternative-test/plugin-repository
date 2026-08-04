/**
 * SearchNoQuery Component
 *
 * Displayed when no search query has been entered.
 * Follows Figma layout specifications.
 */

import { Button } from '@/components/ui';

export interface SearchNoQueryProps {
  /** Callback to clear query */
  onClearQuery?: () => void;
}

export function SearchNoQuery({ onClearQuery }: SearchNoQueryProps) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500 dark:text-gray-400 mb-4">
        Enter a search term to find plugins
      </p>
      {onClearQuery && (
        <Button variant="outline" size="sm" onClick={onClearQuery}>
          Clear search
        </Button>
      )}
    </div>
  );
}
