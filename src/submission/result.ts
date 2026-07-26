/**
 * Submission Inspection Result Model
 *
 * Structured result from submission inspection.
 * All inspection outcomes are represented here for programmatic consumption.
 */

import {
  SubmissionDiagnostic,
  SubmissionDiagnosticCode,
  DiagnosticSeverity,
} from './diagnostics.js';
import type { ParsedPluginMetadata } from './plugin-yml.js';
import type { ParsedComposerMetadata } from './composer.js';
import {
  ReviewSignal,
  SignalCategory,
  SignalSeverity,
} from './signals.js';

// ============================================================
// Result Status
// ============================================================

export enum InspectionStatus {
  READY_FOR_REVIEW = 'READY_FOR_REVIEW',
  SUBMISSION_ERROR = 'SUBMISSION_ERROR',
  INFRASTRUCTURE_ERROR = 'INFRASTRUCTURE_ERROR',
}

// ============================================================
// Submission Context
// ============================================================

export interface SubmissionContext {
  filename: string;
  slug: string;
  schemaVersion: number;
  upstreamRepository: string;
  upstreamBranch: string;
}

// ============================================================
// GitHub Resolution
// ============================================================

export interface GitHubResolution {
  repositoryFound: boolean;
  repositoryArchived: boolean;
  repositoryDisabled: boolean;
  repositoryPrivate: boolean;
  branchFound: boolean;
  resolvedCommitSha: string;
  repositoryOwner: string;
  repositoryName: string;
}

// ============================================================
// Source Analysis
// ============================================================

export interface SourceAnalysis {
  sourceAcquired: boolean;
  sourcePath?: string;
  fileCount: number;
  phpFileCount: number;
  hasPluginYml: boolean;
  hasComposerJson: boolean;
  symlinkCount: number;
  totalSizeBytes: number;
}

// ============================================================
// Main Result
// ============================================================

export interface SubmissionInspectionResult {
  // Inspection outcome
  status: InspectionStatus;

  // Context
  submission: SubmissionContext;

  // GitHub resolution
  github: GitHubResolution;

  // Source analysis
  source: SourceAnalysis;

  // Plugin metadata
  pluginMetadata?: ParsedPluginMetadata;
  suggestedPluginId?: string;
  suggestedPluginIdValid?: boolean;

  // Composer metadata
  composerMetadata?: ParsedComposerMetadata;

  // Review signals
  reviewSignals: ReviewSignal[];

  // All diagnostics
  diagnostics: SubmissionDiagnostic[];

  // Computed accessors
  readonly errors: SubmissionDiagnostic[];
  readonly warnings: SubmissionDiagnostic[];
  readonly signals: SubmissionDiagnostic[];
  readonly infrastructureErrors: SubmissionDiagnostic[];
  readonly hasSubmissionErrors: boolean;
  readonly hasInfrastructureErrors: boolean;
  readonly reviewSignalCount: number;
}

// ============================================================
// Result Builder
// ============================================================

export class SubmissionInspectionResultBuilder {
  private result: Partial<SubmissionInspectionResult>;

  constructor() {
    this.result = {
      reviewSignals: [],
      diagnostics: [],
    };
  }

  setStatus(status: InspectionStatus): this {
    this.result.status = status;
    return this;
  }

  setSubmission(context: SubmissionContext): this {
    this.result.submission = context;
    return this;
  }

  setGitHub(resolution: GitHubResolution): this {
    this.result.github = resolution;
    return this;
  }

  setSource(analysis: SourceAnalysis): this {
    this.result.source = analysis;
    return this;
  }

  setPluginMetadata(metadata: ParsedPluginMetadata, suggestedId: string, idValid: boolean): this {
    this.result.pluginMetadata = metadata;
    this.result.suggestedPluginId = suggestedId;
    this.result.suggestedPluginIdValid = idValid;
    return this;
  }

  setComposerMetadata(metadata: ParsedComposerMetadata): this {
    this.result.composerMetadata = metadata;
    return this;
  }

  setReviewSignals(signals: ReviewSignal[]): this {
    this.result.reviewSignals = signals;
    return this;
  }

  addDiagnostics(...diagnostics: SubmissionDiagnostic[]): this {
    this.result.diagnostics = [...(this.result.diagnostics || []), ...diagnostics];
    return this;
  }

  build(): SubmissionInspectionResult {
    const diagnostics = this.result.diagnostics || [];

    return {
      status: this.result.status!,
      submission: this.result.submission!,
      github: this.result.github!,
      source: this.result.source!,
      pluginMetadata: this.result.pluginMetadata,
      suggestedPluginId: this.result.suggestedPluginId,
      suggestedPluginIdValid: this.result.suggestedPluginIdValid,
      composerMetadata: this.result.composerMetadata,
      reviewSignals: this.result.reviewSignals || [],
      diagnostics,
      // Accessors
      get errors() {
        return diagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR);
      },
      get warnings() {
        return diagnostics.filter((d) => d.severity === DiagnosticSeverity.WARNING);
      },
      get signals() {
        return diagnostics.filter((d) => d.severity === DiagnosticSeverity.REVIEW_SIGNAL);
      },
      get infrastructureErrors() {
        return diagnostics.filter((d) => d.severity === DiagnosticSeverity.INFRASTRUCTURE_ERROR);
      },
      get hasSubmissionErrors() {
        return this.errors.length > 0;
      },
      get hasInfrastructureErrors() {
        return this.infrastructureErrors.length > 0;
      },
      get reviewSignalCount() {
        return this.signals.length;
      },
    } as SubmissionInspectionResult;
  }
}

// ============================================================
// Report Generator
// ============================================================

export function generateHumanReadableReport(result: SubmissionInspectionResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('Axolotl Submission Inspection');
  lines.push('='.repeat(60));
  lines.push('');

  // Status
  const statusLabel = result.status === InspectionStatus.READY_FOR_REVIEW
    ? 'READY FOR HUMAN REVIEW'
    : result.status === InspectionStatus.SUBMISSION_ERROR
      ? 'SUBMISSION ERROR'
      : 'INFRASTRUCTURE ERROR';
  lines.push(`Status: ${statusLabel}`);
  lines.push('');

  // Plugin info
  if (result.pluginMetadata) {
    lines.push('Plugin');
    lines.push('-'.repeat(40));
    lines.push(`  Name: ${result.pluginMetadata.name}`);
    lines.push(`  Version: ${result.pluginMetadata.version}`);
    lines.push(`  Main: ${result.pluginMetadata.main}`);
    if (result.suggestedPluginId) {
      lines.push(`  Suggested ID: ${result.suggestedPluginId}`);
      if (result.suggestedPluginIdValid) {
        lines.push(`  ID Valid: yes`);
      } else {
        lines.push(`  ID Valid: INVALID`);
      }
    }
    lines.push(`  API: ${result.pluginMetadata.api.join(', ')}`);
    if (result.pluginMetadata.authors.length > 0) {
      lines.push(`  Author(s): ${result.pluginMetadata.authors.join(', ')}`);
    }
    if (result.pluginMetadata.description) {
      lines.push(`  Description: ${result.pluginMetadata.description.slice(0, 80)}${result.pluginMetadata.description.length > 80 ? '...' : ''}`);
    }
    lines.push('');
  }

  // Upstream
  if (result.submission) {
    lines.push('Upstream');
    lines.push('-'.repeat(40));
    lines.push(`  Repository: ${result.submission.upstreamRepository}`);
    lines.push(`  Branch: ${result.submission.upstreamBranch}`);
    lines.push('');
  }

  // GitHub resolution
  if (result.github) {
    lines.push('GitHub Resolution');
    lines.push('-'.repeat(40));
    lines.push(`  Resolved SHA: ${result.github.resolvedCommitSha}`);
    if (result.github.repositoryArchived) {
      lines.push(`  WARNING: Repository is archived`);
    }
    if (result.github.repositoryDisabled) {
      lines.push(`  WARNING: Repository is disabled`);
    }
    if (result.github.repositoryPrivate) {
      lines.push(`  WARNING: Repository is private`);
    }
    lines.push('');
  }

  // Source
  if (result.source) {
    lines.push('Source');
    lines.push('-'.repeat(40));
    lines.push(`  Files: ${result.source.fileCount}`);
    lines.push(`  PHP Files: ${result.source.phpFileCount}`);
    lines.push(`  plugin.yml: ${result.source.hasPluginYml ? 'present' : 'MISSING'}`);
    lines.push(`  composer.json: ${result.source.hasComposerJson ? 'present' : 'not present'}`);
    if (result.source.symlinkCount > 0) {
      lines.push(`  Symlinks: ${result.source.symlinkCount} (not followed)`);
    }
    lines.push('');
  }

  // Composer
  if (result.composerMetadata) {
    lines.push('Composer');
    lines.push('-'.repeat(40));
    lines.push(`  Present: yes`);
    if (result.composerMetadata.scripts && Object.keys(result.composerMetadata.scripts).length > 0) {
      lines.push(`  Scripts: ${Object.keys(result.composerMetadata.scripts).join(', ')}`);
      lines.push(`  NOTE: Composer scripts detected - review recommended`);
    }
    if (result.composerMetadata.hasComposerPlugins) {
      lines.push(`  Composer Plugins: detected`);
    }
    const deps = Object.keys(result.composerMetadata.dependencies);
    if (deps.length > 0) {
      lines.push(`  Dependencies: ${deps.slice(0, 5).join(', ')}${deps.length > 5 ? ` and ${deps.length - 5} more` : ''}`);
    }
    lines.push('');
  }

  // Review Signals
  if (result.reviewSignals.length > 0) {
    lines.push('Review Signals');
    lines.push('-'.repeat(40));

    // Group by category
    const byCategory = new Map<SignalCategory, ReviewSignal[]>();
    for (const signal of result.reviewSignals) {
      const existing = byCategory.get(signal.category) || [];
      existing.push(signal);
      byCategory.set(signal.category, existing);
    }

    for (const [category, signals] of byCategory) {
      const severity = signals.some((s) => s.severity === SignalSeverity.HIGH)
        ? 'HIGH'
        : signals.some((s) => s.severity === SignalSeverity.MEDIUM)
          ? 'MEDIUM'
          : 'LOW';
      lines.push(`  [${severity}] ${category}: ${signals.length} occurrence(s)`);
      for (const signal of signals.slice(0, 3)) {
        lines.push(`    - ${signal.message}`);
        if (signal.file) {
          lines.push(`      ${signal.file}${signal.location?.line ? `:${signal.location.line}` : ''}`);
        }
      }
      if (signals.length > 3) {
        lines.push(`    ... and ${signals.length - 3} more`);
      }
    }
    lines.push('');
  }

  // Diagnostics
  if (result.diagnostics.length > 0) {
    const errors = result.errors;
    const warnings = result.warnings;
    const infraErrors = result.infrastructureErrors;

    if (errors.length > 0) {
      lines.push('Submission Errors');
      lines.push('-'.repeat(40));
      for (const error of errors) {
        lines.push(`  [${error.code}] ${error.message}`);
        if (error.file) {
          lines.push(`    at ${error.file}`);
        }
      }
      lines.push('');
    }

    if (infraErrors.length > 0) {
      lines.push('Infrastructure Errors');
      lines.push('-'.repeat(40));
      for (const error of infraErrors) {
        lines.push(`  [${error.code}] ${error.message}`);
      }
      lines.push('');
    }

    if (warnings.length > 0) {
      lines.push('Warnings');
      lines.push('-'.repeat(40));
      for (const warning of warnings) {
        lines.push(`  [${warning.code}] ${warning.message}`);
        if (warning.file) {
          lines.push(`    at ${warning.file}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('='.repeat(60));
  lines.push('NOTE: This report is for review purposes only.');
  lines.push('      Manual security review is REQUIRED before approval.');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Generate machine-readable JSON output.
 */
export function generateJsonOutput(result: SubmissionInspectionResult): string {
  // Return a serializable version
  return JSON.stringify(
    {
      status: result.status,
      submission: result.submission,
      github: result.github,
      source: result.source,
      pluginMetadata: result.pluginMetadata,
      suggestedPluginId: result.suggestedPluginId,
      suggestedPluginIdValid: result.suggestedPluginIdValid,
      composerMetadata: result.composerMetadata
        ? {
            ...result.composerMetadata,
            // Remove circular references
            autoload: Object.keys(result.composerMetadata.autoload || {}),
          }
        : undefined,
      reviewSignals: result.reviewSignals.map((s) => ({
        category: s.category,
        severity: s.severity,
        message: s.message,
        file: s.file,
        location: s.location,
      })),
      diagnostics: result.diagnostics.map((d) => ({
        code: d.code,
        severity: d.severity,
        message: d.message,
        file: d.file,
        field: d.field,
      })),
      summary: {
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        signalCount: result.reviewSignals.length,
        infrastructureErrorCount: result.infrastructureErrors.length,
      },
    },
    null,
    2
  );
}
