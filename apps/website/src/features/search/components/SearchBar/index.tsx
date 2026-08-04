/**
 * SearchBar Component
 *
 * Search input with clear functionality.
 * Follows Figma layout specifications.
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui';

export interface SearchBarProps {
  /** Current query value */
  value: string;
  /** Callback for query changes (instant) */
  onChange: (query: string) => void;
  /** Callback for query submission */
  onSubmit: (query: string) => void;
  /** Minimum query length for search */
  minLength?: number;
  /** Placeholder text */
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  minLength = 2,
  placeholder = 'Search plugins...',
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Sync with external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      onChange(newValue);

      // Clear existing debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Debounce the instant search update
      const timer = setTimeout(() => {
        if (newValue.trim().length >= minLength) {
          onSubmit(newValue);
        }
      }, 250);

      setDebounceTimer(timer);
    },
    [onChange, onSubmit, minLength, debounceTimer]
  );

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
    onSubmit('');
  }, [onChange, onSubmit]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      onSubmit(localValue);
    },
    [localValue, onSubmit, debounceTimer]
  );

  const isValid = localValue.trim().length >= minLength;

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
        <Input
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="pl-10 pr-10"
          aria-label="Search plugins"
        />
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {localValue && !isValid && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Enter at least {minLength} characters to search
        </p>
      )}
    </form>
  );
}
