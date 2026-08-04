/**
 * File utilities for the Registry Generator
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, existsSync } from 'fs';
import { join, dirname, basename, relative } from 'path';

/**
 * Read a file and return its contents as a string
 */
export function readFile(path: string): string {
  return readFileSync(path, 'utf-8');
}

/**
 * Write content to a file, creating directories as needed
 */
export function writeFile(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, content, 'utf-8');
}

/**
 * Write JSON to a file with pretty formatting
 */
export function writeJson(path: string, data: unknown): void {
  writeFile(path, JSON.stringify(data, null, 2));
}

/**
 * Copy a file, creating directories as needed
 */
export function copyFile(source: string, destination: string): void {
  const dir = dirname(destination);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  copyFileSync(source, destination);
}

/**
 * Check if a path exists
 */
export function exists(path: string): boolean {
  return existsSync(path);
}

/**
 * Check if a path is a directory
 */
export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a path is a file
 */
export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * List files in a directory
 */
export function listFiles(dir: string, extensions?: string[]): string[] {
  if (!exists(dir) || !isDirectory(dir)) {
    return [];
  }

  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (isFile(fullPath)) {
      if (!extensions || extensions.some(ext => entry.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

/**
 * List directories in a directory
 */
export function listDirectories(dir: string): string[] {
  if (!exists(dir) || !isDirectory(dir)) {
    return [];
  }

  const directories: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (isDirectory(fullPath)) {
      directories.push(fullPath);
    }
  }

  return directories.sort();
}

/**
 * Get relative path from base
 */
export function relativePath(from: string, to: string): string {
  return relative(from, to);
}

/**
 * Get filename without extension
 */
export function basenameWithoutExtension(path: string): string {
  return basename(path, '.yaml').replace(/\.yml$/, '');
}

/**
 * Ensure a directory exists
 */
export function ensureDirectory(dir: string): void {
  if (!exists(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
