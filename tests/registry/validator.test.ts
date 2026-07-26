/**
 * Parser Tests
 *
 * Unit tests for registry parser.
 */
import { describe, test, expect } from 'vitest';
import { join } from 'path';
import { validatePluginIdentity, validateVersionRecord, validateRegistry } from '../../src/registry/validator.js';
import type { Diagnostic } from '../../src/registry/diagnostics.js';

const fixturesPath = join(process.cwd(), 'tests', 'fixtures', 'registry');
const validFixturesPath = join(process.cwd(), 'tests', 'fixtures', 'registry-valid');

// ============================================================
// Plugin Identity Validation Tests
// ============================================================

describe('validatePluginIdentity', () => {
  test('valid plugin identity passes', () => {
    const content = `
schema_version: 1
id: topstats
upstream:
  repository: nicholass003/TopStats
  branch: main
`;
    const diagnostics = validatePluginIdentity('plugin.yaml', content, 'topstats');
    const errors = diagnostics.filter(d => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  test('invalid plugin ID fails', () => {
    const content = `
schema_version: 1
id: TopStats
upstream:
  repository: user/repo
  branch: main
`;
    const diagnostics = validatePluginIdentity('plugin.yaml', content, 'TopStats');
    const errors = diagnostics.filter(d => d.code === 'INVALID_PLUGIN_ID');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('URL instead of owner/repo fails', () => {
    const content = `
schema_version: 1
id: badplugin
upstream:
  repository: https://github.com/user/repo
  branch: main
`;
    const diagnostics = validatePluginIdentity('plugin.yaml', content, 'badplugin');
    const errors = diagnostics.filter(d => d.code === 'INVALID_REPOSITORY_IDENTITY');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('directory name mismatch fails', () => {
    const content = `
schema_version: 1
id: topstats
upstream:
  repository: user/repo
  branch: main
`;
    const diagnostics = validatePluginIdentity('plugin.yaml', content, 'different-name');
    const errors = diagnostics.filter(d => d.code === 'PLUGIN_ID_DIR_MISMATCH');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('invalid branch name fails', () => {
    const content = `
schema_version: 1
id: testplugin
upstream:
  repository: user/repo
  branch: "feature branch with spaces"
`;
    const diagnostics = validatePluginIdentity('plugin.yaml', content, 'testplugin');
    const errors = diagnostics.filter(d => d.code === 'INVALID_BRANCH');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('malformed YAML fails', () => {
    // Truly malformed YAML that cannot be parsed
    const content = `id: test
  invalid: [unclosed
upstream:`;
    const diagnostics = validatePluginIdentity('plugin.yaml', content, 'test');
    const errors = diagnostics.filter(d => d.code === 'MALFORMED_YAML');
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Version Record Validation Tests
// ============================================================

describe('validateVersionRecord', () => {
  test('valid approved version passes', () => {
    const content = `
schema_version: 1
version: 2.0.0
source:
  upstream_commit: a82f0e123456789abcdef123456789abcdef1234
review:
  pull_request: 42
  reviewer: axolotl-reviewer
  approved_at: 2026-07-20T15:30:00Z
status: approved
`;
    const diagnostics = validateVersionRecord('2.0.0.yaml', content);
    const errors = diagnostics.filter(d => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  test('filename/version mismatch fails', () => {
    const content = `
schema_version: 1
version: 2.1.0
source:
  upstream_commit: a82f0e123456789abcdef123456789abcdef1234
review:
  pull_request: 42
  reviewer: reviewer
  approved_at: 2026-07-20T15:30:00Z
status: approved
`;
    const diagnostics = validateVersionRecord('2.0.0.yaml', content);
    const errors = diagnostics.filter(d => d.code === 'VERSION_FILENAME_MISMATCH');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('invalid upstream commit fails', () => {
    const content = `
schema_version: 1
version: 1.0.0
source:
  upstream_commit: not-a-sha
review:
  pull_request: 1
  reviewer: reviewer
  approved_at: 2026-01-01T00:00:00Z
status: approved
`;
    const diagnostics = validateVersionRecord('1.0.0.yaml', content);
    const errors = diagnostics.filter(d => d.code === 'INVALID_UPSTREAM_COMMIT');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('short SHA fails', () => {
    const content = `
schema_version: 1
version: 1.0.0
source:
  upstream_commit: a82f0e
review:
  pull_request: 1
  reviewer: reviewer
  approved_at: 2026-01-01T00:00:00Z
status: approved
`;
    const diagnostics = validateVersionRecord('1.0.0.yaml', content);
    const errors = diagnostics.filter(d => d.code === 'INVALID_UPSTREAM_COMMIT');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('published version without artifact fails', () => {
    const content = `
schema_version: 1
version: 1.0.0
source:
  upstream_commit: a82f0e123456789abcdef123456789abcdef1234
review:
  pull_request: 1
  reviewer: reviewer
  approved_at: 2026-01-01T00:00:00Z
storage:
  repository: axolotl-pm-pl/test
  commit: a82f0e123456789abcdef123456789abcdef1234
status: published
`;
    const diagnostics = validateVersionRecord('1.0.0.yaml', content);
    const errors = diagnostics.filter(d => d.code === 'INVALID_FIELD_TYPE');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('invalid version format fails', () => {
    const content = `
schema_version: 1
version: latest
source:
  upstream_commit: a82f0e123456789abcdef123456789abcdef1234
review:
  pull_request: 1
  reviewer: reviewer
  approved_at: 2026-01-01T00:00:00Z
status: approved
`;
    const diagnostics = validateVersionRecord('latest.yaml', content);
    const errors = diagnostics.filter(d => d.code === 'INVALID_VERSION');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('invalid SHA-256 fails', () => {
    const content = `
schema_version: 1
version: 1.0.0
source:
  upstream_commit: a82f0e123456789abcdef123456789abcdef1234
review:
  pull_request: 1
  reviewer: reviewer
  approved_at: 2026-01-01T00:00:00Z
storage:
  repository: axolotl-pm-pl/test
  commit: a82f0e123456789abcdef123456789abcdef1234
artifact:
  release_tag: v1.0.0
  file: Test.phar
  sha256: short
  published_at: 2026-01-01T01:00:00Z
status: published
`;
    const diagnostics = validateVersionRecord('1.0.0.yaml', content);
    const errors = diagnostics.filter(d => d.code === 'INVALID_ARTIFACT_SHA256');
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Cross-Record Validation Tests
// ============================================================

describe('validateRegistry', () => {
  test('valid registry passes', () => {
    const result = validateRegistry(validFixturesPath);
    // validateRegistry returns { plugins, diagnostics: ValidationDiagnostics }
    // We need to access diagnostics.diagnostics to get the actual array
    const diagnosticsArray = 'diagnostics' in result
      ? (result.diagnostics as { diagnostics: Diagnostic[] }).diagnostics
      : (result as Diagnostic[]);
    const errors = diagnosticsArray.filter(d => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  test('invalid plugin ID detected', () => {
    const result = validateRegistry(fixturesPath);
    const diagnosticsArray = 'diagnostics' in result
      ? (result.diagnostics as { diagnostics: Diagnostic[] }).diagnostics
      : (result as Diagnostic[]);
    const errors = diagnosticsArray.filter(
      d => d.code === 'INVALID_PLUGIN_ID' && d.file.includes('bad-plugin-id')
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  test('URL format detected', () => {
    const result = validateRegistry(fixturesPath);
    const diagnosticsArray = 'diagnostics' in result
      ? (result.diagnostics as { diagnostics: Diagnostic[] }).diagnostics
      : (result as Diagnostic[]);
    const errors = diagnosticsArray.filter(
      d => d.code === 'INVALID_REPOSITORY_IDENTITY' && d.file.includes('bad-repo-format')
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  test('invalid version detected', () => {
    const result = validateRegistry(fixturesPath);
    const diagnosticsArray = 'diagnostics' in result
      ? (result.diagnostics as { diagnostics: Diagnostic[] }).diagnostics
      : (result as Diagnostic[]);
    const errors = diagnosticsArray.filter(
      d => d.code === 'INVALID_VERSION' && d.file.includes('bad-version')
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
