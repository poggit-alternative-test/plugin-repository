/**
 * Submission Diagnostics Tests
 *
 * Tests for submission diagnostics.
 */
import { describe, test, expect } from 'vitest';
import {
  SUBMISSION_CODES,
  DiagnosticSeverity,
  submissionError,
  submissionWarning,
  reviewSignal,
  infrastructureError,
  isInfrastructureError,
  isSubmissionError,
  isReviewSignal,
  getErrors,
  getWarnings,
  getReviewSignals,
  getInfrastructureErrors,
  hasErrors,
  hasInfrastructureErrors,
} from '../../src/submission/diagnostics.js';

describe('Diagnostic Creation', () => {
  test('submissionError creates error diagnostic', () => {
    const diag = submissionError(SUBMISSION_CODES.PLUGIN_YML_MISSING, 'plugin.yml not found');
    expect(diag.code).toBe(SUBMISSION_CODES.PLUGIN_YML_MISSING);
    expect(diag.severity).toBe(DiagnosticSeverity.ERROR);
    expect(diag.message).toBe('plugin.yml not found');
  });

  test('submissionWarning creates warning diagnostic', () => {
    const diag = submissionWarning(SUBMISSION_CODES.WARN_COMPOSER_PRESENT, 'Composer detected');
    expect(diag.code).toBe(SUBMISSION_CODES.WARN_COMPOSER_PRESENT);
    expect(diag.severity).toBe(DiagnosticSeverity.WARNING);
  });

  test('reviewSignal creates review signal diagnostic', () => {
    const diag = reviewSignal(SUBMISSION_CODES.REVIEW_SIGNAL_NETWORK_API, 'Network usage detected');
    expect(diag.code).toBe(SUBMISSION_CODES.REVIEW_SIGNAL_NETWORK_API);
    expect(diag.severity).toBe(DiagnosticSeverity.REVIEW_SIGNAL);
  });

  test('infrastructureError creates infrastructure error', () => {
    const diag = infrastructureError(SUBMISSION_CODES.GITHUB_RATE_LIMITED, 'Rate limited');
    expect(diag.code).toBe(SUBMISSION_CODES.GITHUB_RATE_LIMITED);
    expect(diag.severity).toBe(DiagnosticSeverity.INFRASTRUCTURE_ERROR);
  });

  test('diagnostic includes optional context', () => {
    const diag = submissionError(SUBMISSION_CODES.PLUGIN_YML_INVALID, 'Invalid YAML', {
      file: 'plugin.yml',
      field: 'name',
      context: { line: 5 },
    });
    expect(diag.file).toBe('plugin.yml');
    expect(diag.field).toBe('name');
    expect(diag.context).toEqual({ line: 5 });
  });
});

describe('Diagnostic Helpers', () => {
  const diagnostics = [
    submissionError(SUBMISSION_CODES.PLUGIN_YML_MISSING, 'Missing plugin.yml'),
    submissionError(SUBMISSION_CODES.PLUGIN_VERSION_INVALID, 'Invalid version'),
    submissionWarning(SUBMISSION_CODES.WARN_COMPOSER_PRESENT, 'Composer present'),
    reviewSignal(SUBMISSION_CODES.REVIEW_SIGNAL_NETWORK_API, 'Network usage'),
    infrastructureError(SUBMISSION_CODES.GITHUB_RATE_LIMITED, 'Rate limited'),
  ];

  test('isInfrastructureError filters correctly', () => {
    expect(isInfrastructureError(diagnostics[4])).toBe(true);
    expect(isInfrastructureError(diagnostics[0])).toBe(false);
  });

  test('isSubmissionError filters correctly', () => {
    expect(isSubmissionError(diagnostics[0])).toBe(true);
    expect(isSubmissionError(diagnostics[2])).toBe(false);
  });

  test('isReviewSignal filters correctly', () => {
    expect(isReviewSignal(diagnostics[3])).toBe(true);
    expect(isReviewSignal(diagnostics[0])).toBe(false);
  });

  test('getErrors returns only errors', () => {
    const errors = getErrors(diagnostics);
    expect(errors).toHaveLength(2);
    expect(errors.every((d) => d.severity === DiagnosticSeverity.ERROR)).toBe(true);
  });

  test('getWarnings returns only warnings', () => {
    const warnings = getWarnings(diagnostics);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe(DiagnosticSeverity.WARNING);
  });

  test('getReviewSignals returns only signals', () => {
    const signals = getReviewSignals(diagnostics);
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe(DiagnosticSeverity.REVIEW_SIGNAL);
  });

  test('getInfrastructureErrors returns only infra errors', () => {
    const infra = getInfrastructureErrors(diagnostics);
    expect(infra).toHaveLength(1);
    expect(infra[0].severity).toBe(DiagnosticSeverity.INFRASTRUCTURE_ERROR);
  });

  test('hasErrors returns true when errors present', () => {
    expect(hasErrors(diagnostics)).toBe(true);
    expect(hasErrors([])).toBe(false);
  });

  test('hasInfrastructureErrors returns true when infra errors present', () => {
    expect(hasInfrastructureErrors(diagnostics)).toBe(true);
    expect(hasInfrastructureErrors(diagnostics.slice(0, 4))).toBe(false);
  });
});

describe('Diagnostic Codes', () => {
  test('all expected codes are defined', () => {
    expect(SUBMISSION_CODES.SUBMISSION_INVALID_FILENAME).toBeDefined();
    expect(SUBMISSION_CODES.REPOSITORY_NOT_FOUND).toBeDefined();
    expect(SUBMISSION_CODES.PLUGIN_YML_MISSING).toBeDefined();
    expect(SUBMISSION_CODES.GITHUB_RATE_LIMITED).toBeDefined();
    expect(SUBMISSION_CODES.REVIEW_SIGNAL_NETWORK_API).toBeDefined();
  });

  test('codes are unique strings', () => {
    const values = Object.values(SUBMISSION_CODES);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});
