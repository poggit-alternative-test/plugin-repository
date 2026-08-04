/**
 * Git utilities for the Registry Generator
 */

import { execSync } from 'child_process';

/**
 * Get the current Git commit SHA
 */
export function getCurrentCommit(workingDir: string): string {
  try {
    const sha = execSync('git rev-parse HEAD', {
      cwd: workingDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return sha;
  } catch {
    return 'unknown';
  }
}

/**
 * Check if a directory is a Git repository
 */
export function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --git-dir', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
