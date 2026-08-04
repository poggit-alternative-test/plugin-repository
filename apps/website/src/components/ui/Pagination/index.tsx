/**
 * Pagination Component
 *
 * A component for navigating between pages.
 */

import { type HTMLAttributes } from 'react';
import { Button } from '../Button';

export interface PaginationProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className = '',
  ...props
}: PaginationProps) {
  const range = (start: number, end: number) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) return range(1, totalPages);

    const left = Math.max(currentPage - siblingCount, 1);
    const right = Math.min(currentPage + siblingCount, totalPages);

    if (left === 1 && right < totalPages) {
      return [...range(1, 3 + siblingCount), 'ellipsis', totalPages];
    }
    if (right === totalPages && left > 1) {
      return [1, 'ellipsis', ...range(totalPages - (2 + siblingCount), totalPages)];
    }
    return [1, 'ellipsis', ...range(left, right), 'ellipsis', totalPages];
  };

  if (totalPages <= 1) return null;

  const pages = getPageNumbers();

  return (
    <nav className={`flex items-center justify-center gap-1 ${className}`} aria-label="Pagination" {...props}>
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Button>

      {pages.map((page, i) =>
        page === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-2 text-gray-500">...</span>
        ) : (
          <Button
            key={page}
            variant={currentPage === page ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        )
      )}

      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>
    </nav>
  );
}
