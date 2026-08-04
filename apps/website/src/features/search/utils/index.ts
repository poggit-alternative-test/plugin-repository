/**
 * Search Feature Utils
 */

/**
 * Parse URL search params into search state
 */
export function parseSearchParams(
  params: URLSearchParams
): Partial<{
  query: string;
  page: number;
  sort: string;
  category: string;
  author: string;
  status: string;
  view: string;
}> {
  const result: ReturnType<typeof parseSearchParams> = {};

  const query = params.get('q');
  if (query && query.trim().length >= 2) {
    result.query = query.trim();
  }

  const page = params.get('page');
  if (page) {
    const pageNum = parseInt(page, 10);
    if (!isNaN(pageNum) && pageNum >= 1) {
      result.page = pageNum;
    }
  }

  const sort = params.get('sort');
  if (sort && isValidSort(sort)) {
    result.sort = sort;
  }

  const category = params.get('category');
  if (category) {
    result.category = category;
  }

  const author = params.get('author');
  if (author) {
    result.author = author;
  }

  const status = params.get('status');
  if (status && isValidStatus(status)) {
    result.status = status;
  }

  const view = params.get('view');
  if (view && (view === 'grid' || view === 'list')) {
    result.view = view;
  }

  return result;
}

/**
 * Update URL search params from search state
 */
export function updateSearchParams(
  state: Partial<{
    query: string;
    page: number;
    sort: string;
    category: string;
    author: string;
    status: string;
    view: string;
  }>
): URLSearchParams {
  const params = new URLSearchParams();

  // Query
  if (state.query && state.query.trim().length >= 2) {
    params.set('q', state.query.trim());
  }

  // Page (only if not 1)
  if (state.page && state.page > 1) {
    params.set('page', String(state.page));
  }

  // Sort (only if not default)
  if (state.sort && state.sort !== 'relevance') {
    params.set('sort', state.sort);
  }

  // Filters
  if (state.category) {
    params.set('category', state.category);
  }
  if (state.author) {
    params.set('author', state.author);
  }
  if (state.status) {
    params.set('status', state.status);
  }

  // View
  if (state.view && state.view !== 'grid') {
    params.set('view', state.view);
  }

  return params;
}

/**
 * Validate sort option
 */
function isValidSort(sort: string): boolean {
  return [
    'relevance',
    'alphabetical',
    'recently-updated',
    'newest-release',
    'downloads',
  ].includes(sort);
}

/**
 * Validate status
 */
function isValidStatus(status: string): boolean {
  return ['approved', 'published', 'deprecated', 'revoked', 'removed'].includes(
    status
  );
}

/**
 * Format the result count for display
 */
export function formatResultCount(
  total: number,
  pageStart: number,
  pageEnd: number
): string {
  if (total === 0) {
    return 'No results';
  }

  if (total <= pageEnd) {
    return `${total} result${total === 1 ? '' : 's'}`;
  }

  return `${pageStart}–${pageEnd} of ${total} results`;
}

/**
 * Get sort label for display
 */
export function getSortLabel(sort: string): string {
  const labels: Record<string, string> = {
    relevance: 'Relevance',
    alphabetical: 'Alphabetical',
    'recently-updated': 'Recently Updated',
    'newest-release': 'Newest Release',
    downloads: 'Most Downloads',
  };

  return labels[sort] || sort;
}
