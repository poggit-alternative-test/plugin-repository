/**
 * Diagnostics Tests
 *
 * Unit tests for diagnostic utilities.
 */
import { describe, test, expect } from 'vitest';

import {
  error,
  warning,
  info,
  createDiagnostic,
  aggregateDiagnostics,
  formatDiagnostics,
  DiagnosticCode,
} from '../../src/registry/diagnostics.js';

describe('createDiagnostic', () => {
  test('creates diagnostic with all fields', () => {
    const diagnostic = createDiagnostic(
      DiagnosticCode.INVALID_PLUGIN_ID,
      'error',
      'plugin.yaml',
      'Plugin ID must be lowercase',
      'id'
    );

    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.code).toBe('INVALID_PLUGIN_ID');
    expect(diagnostic.file).toBe('plugin.yaml');
    expect(diagnostic.path).toBe('id');
    expect(diagnostic.message).toBe('Plugin ID must be lowercase');
  });
});

describe('error/warning/info helpers', () => {
  test('error creates error severity', () => {
    const diagnostic = error(
      DiagnosticCode.INVALID_VERSION,
      'version.yaml',
      'Invalid version format'
    );
    expect(diagnostic.severity).toBe('error');
  });

  test('warning creates warning severity', () => {
    const diagnostic = warning(
      DiagnosticCode.DUPLICATE_UPSTREAM,
      'plugin.yaml',
      'Multiple plugins reference same upstream'
    );
    expect(diagnostic.severity).toBe('warning');
  });

  test('info creates info severity', () => {
    const diagnostic = info(
      DiagnosticCode.MISSING_ARTIFACT,
      'version.yaml',
      'No artifacts yet'
    );
    expect(diagnostic.severity).toBe('info');
  });
});

describe('aggregateDiagnostics', () => {
  test('counts diagnostics correctly', () => {
    const diagnostics = [
      error(DiagnosticCode.INVALID_PLUGIN_ID, 'a.yaml', 'msg'),
      error(DiagnosticCode.INVALID_VERSION, 'b.yaml', 'msg'),
      warning(DiagnosticCode.DUPLICATE_UPSTREAM, 'c.yaml', 'msg'),
      info(DiagnosticCode.MISSING_ARTIFACT, 'd.yaml', 'msg'),
    ];

    const result = aggregateDiagnostics(diagnostics);

    expect(result.errorCount).toBe(2);
    expect(result.warningCount).toBe(1);
    expect(result.infoCount).toBe(1);
    expect(result.diagnostics).toHaveLength(4);
  });

  test('empty array returns zero counts', () => {
    const result = aggregateDiagnostics([]);

    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.infoCount).toBe(0);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe('formatDiagnostics', () => {
  test('formats errors with prefix', () => {
    const result = aggregateDiagnostics([
      error(DiagnosticCode.INVALID_PLUGIN_ID, 'plugin.yaml', 'must be lowercase', 'id'),
    ]);

    const output = formatDiagnostics(result);

    expect(output).toContain('ERROR [INVALID_PLUGIN_ID]');
    expect(output).toContain('plugin.yaml:id');
    expect(output).toContain('must be lowercase');
  });

  test('formats warnings with prefix', () => {
    const result = aggregateDiagnostics([
      warning(DiagnosticCode.DUPLICATE_UPSTREAM, 'plugin.yaml', 'multiple refs'),
    ]);

    const output = formatDiagnostics(result);

    expect(output).toContain('WARN [DUPLICATE_UPSTREAM]');
  });

  test('returns empty string for no diagnostics', () => {
    const result = aggregateDiagnostics([]);
    const output = formatDiagnostics(result);

    expect(output).toBe('');
  });
});
