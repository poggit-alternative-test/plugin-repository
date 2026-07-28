/**
 * Review Storage Manager
 *
 * File-based storage for review records with atomic append-only semantics.
 *
 * Structure:
 * reviews/
 * └── {plugin-slug}/
 *     └── {candidate-short-id}/
 *         ├── candidate.yaml      # Candidate info
 *         └── decisions/
 *             └── {decision-id}.yaml  # Individual decisions
 *
 * Atomic Write Contract:
 * - Validate record before writing
 * - Final decision path must not already exist
 * - Write to temporary file in same directory
 * - Atomically rename to final location
 * - Cleanup temp file on failure
 * - Never overwrite existing canonical records
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { parse, stringify } from 'yaml';
import type {
  ReviewRecord,
  CandidateInfo,
  ReviewDecision,
} from './review-record.js';
import {
  isValidReviewRecord,
  isValidCandidateInfo,
  createReviewRecord,
  createCandidateInfo,
} from './review-record.js';
import type { CandidateIdentity } from './candidate-identity.js';
import {
  getCandidateReviewPath,
  getCandidateInfoPath,
  getDecisionsDirPath,
  getDecisionFilePath,
} from './candidate-identity.js';
import { REVIEW_CODES } from './diagnostics.js';
import { reviewError, type ReviewDiagnostic } from './diagnostics.js';

// ============================================================
// Storage Error
// ============================================================

export class ReviewStorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReviewStorageError';
  }
}

// ============================================================
// Storage Manager
// ============================================================

export class ReviewStorageManager {
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Ensure a directory exists.
   */
  private ensureDir(dirPath: string): void {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Load YAML file.
   */
  private loadYaml<T>(filePath: string): T | null {
    try {
      if (!existsSync(filePath)) {
        return null;
      }
      const content = readFileSync(filePath, 'utf-8');
      return parse(content) as T;
    } catch (e) {
      throw new ReviewStorageError(
        `Failed to load ${filePath}`,
        REVIEW_CODES.REVIEW_STORAGE_ERROR,
        { filePath, error: e instanceof Error ? e.message : 'Unknown error' }
      );
    }
  }

  /**
   * Save YAML file.
   */
  private saveYaml(filePath: string, data: unknown): void {
    try {
      this.ensureDir(dirname(filePath));
      const content = stringify(data);
      writeFileSync(filePath, content, 'utf-8');
    } catch (e) {
      throw new ReviewStorageError(
        `Failed to save ${filePath}`,
        REVIEW_CODES.REVIEW_STORAGE_ERROR,
        { filePath, error: e instanceof Error ? e.message : 'Unknown error' }
      );
    }
  }

  /**
   * Save candidate information.
   */
  saveCandidateInfo(candidateIdentity: CandidateIdentity, info: CandidateInfo): void {
    const filePath = getCandidateInfoPath(this.basePath, candidateIdentity);
    this.saveYaml(filePath, info);
  }

  /**
   * Load candidate information.
   */
  loadCandidateInfo(candidateIdentity: CandidateIdentity): CandidateInfo | null {
    const filePath = getCandidateInfoPath(this.basePath, candidateIdentity);
    const data = this.loadYaml<CandidateInfo>(filePath);
    if (data && isValidCandidateInfo(data)) {
      return data;
    }
    return null;
  }

  /**
   * Save a review decision using atomic write semantics.
   *
   * Atomic Write Contract:
   * 1. Validate record before writing
   * 2. Check that final path does not already exist (no overwrite)
   * 3. Write to temporary file in same directory
   * 4. Atomically rename to final location
   * 5. Cleanup temp file on failure
   *
   * @throws ReviewStorageError if validation fails, file exists, or write fails
   */
  saveDecision(candidateIdentity: CandidateIdentity, record: ReviewRecord): void {
    // Step 1: Validate record before any filesystem operations
    if (!isValidReviewRecord(record)) {
      throw new ReviewStorageError(
        `Invalid review record: decisionId field missing or invalid`,
        REVIEW_CODES.INVALID_REVIEW_RECORD
      );
    }

    const decisionId = record.decisionId;
    const decisionsDir = getDecisionsDirPath(this.basePath, candidateIdentity);
    const finalPath = getDecisionFilePath(this.basePath, candidateIdentity, decisionId);

    // Step 2: Ensure directory exists
    this.ensureDir(decisionsDir);

    // Step 3: Check that final path does not already exist (fail closed on collision)
    if (existsSync(finalPath)) {
      throw new ReviewStorageError(
        `Decision already exists: ${decisionId}`,
        REVIEW_CODES.DUPLICATE_DECISION,
        { decisionId, filePath: finalPath }
      );
    }

    // Step 4: Write to temporary file in same directory
    const tempPath = `${finalPath}.tmp.${Date.now()}`;
    let tempFileCreated = false;

    try {
      const content = stringify(record);
      writeFileSync(tempPath, content, 'utf-8');
      tempFileCreated = true;

      // Step 5: Atomically rename to final location
      // On POSIX systems, rename is atomic if source and dest are on same filesystem
      // On Windows, this may not be fully atomic but is the best available option
      renameSync(tempPath, finalPath);
      tempFileCreated = false; // Successfully renamed, no cleanup needed

    } catch (e) {
      // Step 6: Cleanup temp file on failure
      if (tempFileCreated && existsSync(tempPath)) {
        try {
          unlinkSync(tempPath);
        } catch {
          // Best effort cleanup - log but don't throw
        }
      }
      throw new ReviewStorageError(
        `Failed to save decision: ${e instanceof Error ? e.message : 'Unknown error'}`,
        REVIEW_CODES.REVIEW_STORAGE_ERROR,
        { decisionId, error: e instanceof Error ? e.message : 'Unknown' }
      );
    }
  }

  /**
   * Load all decisions for a candidate.
   * Records are sorted by canonical order (timestamp, then decisionId).
   */
  loadDecisions(candidateIdentity: CandidateIdentity): ReviewRecord[] {
    const decisionsDir = getDecisionsDirPath(this.basePath, candidateIdentity);
    if (!existsSync(decisionsDir)) {
      return [];
    }

    const files = readdirSync(decisionsDir).filter((f) => f.endsWith('.yaml') && !f.includes('.tmp.'));
    const records: ReviewRecord[] = [];

    for (const file of files) {
      const filePath = join(decisionsDir, file);
      const data = this.loadYaml<unknown>(filePath);
      if (data && isValidReviewRecord(data)) {
        records.push(data);
      }
    }

    // Sort by canonical order: timestamp ascending, then decisionId ascending
    return records.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.decisionId.localeCompare(b.decisionId);
    });
  }

  /**
   * Load candidate info and decisions together.
   */
  loadCandidate(candidateIdentity: CandidateIdentity): {
    candidateInfo: CandidateInfo | null;
    decisions: ReviewRecord[];
  } {
    return {
      candidateInfo: this.loadCandidateInfo(candidateIdentity),
      decisions: this.loadDecisions(candidateIdentity),
    };
  }

  /**
   * Check if a candidate exists.
   */
  candidateExists(candidateIdentity: CandidateIdentity): boolean {
    const infoPath = getCandidateInfoPath(this.basePath, candidateIdentity);
    return existsSync(infoPath);
  }

  /**
   * List all plugin slugs with review history.
   */
  listPluginSlugs(): string[] {
    if (!existsSync(this.basePath)) {
      return [];
    }
    return readdirSync(this.basePath).filter((f) => {
      const path = join(this.basePath, f);
      // Check if it's a directory and not hidden
      return existsSync(path) && !f.startsWith('.');
    });
  }

  /**
   * List all candidates for a plugin.
   */
  listCandidates(pluginSlug: string): string[] {
    const pluginDir = join(this.basePath, pluginSlug);
    if (!existsSync(pluginDir)) {
      return [];
    }
    return readdirSync(pluginDir).filter((f) => {
      const path = join(pluginDir, f);
      return existsSync(path) && !f.startsWith('.');
    });
  }
}

// ============================================================
// Review Manager (High-Level API)
// ============================================================

export interface ReviewResult {
  success: boolean;
  record?: ReviewRecord;
  diagnostics: ReviewDiagnostic[];
}

export class ReviewManager {
  private readonly storage: ReviewStorageManager;

  constructor(basePath: string) {
    this.storage = new ReviewStorageManager(basePath);
  }

  /**
   * Register a new candidate (from inspection completion).
   */
  registerCandidate(
    candidateIdentity: CandidateIdentity,
    upstreamBranch: string,
    inspectionTimestamp: string,
    evidenceRef?: string
  ): void {
    const candidateInfo = createCandidateInfo(
      candidateIdentity,
      upstreamBranch,
      inspectionTimestamp,
      evidenceRef
    );
    this.storage.saveCandidateInfo(candidateIdentity, candidateInfo);
  }

  /**
   * Record a review decision.
   */
  recordDecision(
    candidateIdentity: CandidateIdentity,
    decision: ReviewDecision,
    reviewer: { githubId: number; login?: string },
    options?: {
      notes?: string;
      evidenceRef?: string;
    }
  ): ReviewResult {
    const diagnostics: ReviewDiagnostic[] = [];
    const { candidateInfo, decisions } = this.storage.loadCandidate(candidateIdentity);

    // Check candidate exists
    if (!candidateInfo) {
      diagnostics.push(
        reviewError(REVIEW_CODES.CANDIDATE_NOT_FOUND, 'Candidate not found')
      );
      return { success: false, diagnostics };
    }

    // Check if this is a duplicate decision
    const existingDecision = decisions.find(
      (d) => d.decision === decision && d.reviewer.githubId === reviewer.githubId
    );
    if (existingDecision) {
      diagnostics.push(
        reviewError(
          REVIEW_CODES.DUPLICATE_DECISION,
          `Reviewer has already made this decision`,
          { existingDecisionId: existingDecision.decisionId }
        )
      );
      return { success: false, diagnostics };
    }

    // Get the last decision for history
    const lastDecision = decisions.length > 0 ? decisions[decisions.length - 1] : undefined;

    // Create the new record
    const record = createReviewRecord(candidateIdentity, decision, reviewer, {
      notes: options?.notes,
      evidenceRef: options?.evidenceRef,
      previousDecisionId: lastDecision?.decisionId,
    });

    // Save
    this.storage.saveDecision(candidateIdentity, record);

    return { success: true, record, diagnostics };
  }

  /**
   * Get candidate state.
   */
  getCandidateState(candidateIdentity: CandidateIdentity): {
    candidateInfo: CandidateInfo | null;
    decisions: ReviewRecord[];
  } {
    return this.storage.loadCandidate(candidateIdentity);
  }

  /**
   * Get effective review state for a candidate.
   */
  getEffectiveState(candidateIdentity: CandidateIdentity): {
    candidateInfo: CandidateInfo | null;
    decisions: ReviewRecord[];
  } {
    return this.storage.loadCandidate(candidateIdentity);
  }

  /**
   * Check if a candidate exists.
   */
  candidateExists(candidateIdentity: CandidateIdentity): boolean {
    return this.storage.candidateExists(candidateIdentity);
  }
}
