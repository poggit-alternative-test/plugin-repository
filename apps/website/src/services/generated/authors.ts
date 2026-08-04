/**
 * Authors Service
 *
 * Provides access to author profile data.
 */

import { loadJson, MissingFileError } from './client.js';
import type { Author, AuthorList } from './types.js';

/** Path to the author index file */
const AUTHOR_INDEX_PATH = '/authors/index.json';

/** Path prefix for individual author files */
const AUTHOR_PATH_PREFIX = '/authors/';

/** File extension for author files */
const AUTHOR_FILE_EXTENSION = '.json';

/**
 * Default empty AuthorList for when file is missing
 * This represents an empty repository state
 */
const EMPTY_AUTHOR_LIST: AuthorList = {
  authors: [],
  count: 0,
};

/**
 * Get the author list
 *
 * Returns a list of all authors with their plugin counts.
 * Returns empty list if file is missing.
 */
export async function getAuthors(): Promise<AuthorList> {
  try {
    return await loadJson<AuthorList>(AUTHOR_INDEX_PATH);
  } catch (error) {
    if (error instanceof MissingFileError) {
      return EMPTY_AUTHOR_LIST;
    }
    throw error;
  }
}

/**
 * Get a single author by login
 *
 * @param login - The author's GitHub login
 * @returns The author data or undefined if not found
 */
export async function getAuthor(login: string): Promise<Author | undefined> {
  try {
    const path = `${AUTHOR_PATH_PREFIX}${login}${AUTHOR_FILE_EXTENSION}`;
    return await loadJson<Author>(path);
  } catch {
    // Author not found
    return undefined;
  }
}
