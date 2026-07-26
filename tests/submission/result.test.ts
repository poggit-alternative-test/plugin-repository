/**
 * Result Model Tests
 *
 * Tests for submission inspection result model.
 */
import { describe, test, expect } from 'vitest';
import {
  SubmissionInspectionResultBuilder,
  generateHumanReadableReport,
  generateJsonOutput,
  InspectionStatus,
} from '../../src/submission/result.js';
import { DiagnosticSeverity } from '../../src/submission/diagnostics.js';
import { SignalCategory, SignalSeverity } from '../../src/submission/signals.js';

describe('SubmissionInspectionResultBuilder', () => {
  test('builds complete result', () => {
    const builder = new SubmissionInspectionResultBuilder();
    const result = builder
      .setStatus(InspectionStatus.READY_FOR_REVIEW)
      .setSubmission({
        filename: 'topstats.yaml',
        slug: 'topstats',
        schemaVersion: 1,
        upstreamRepository: 'owner/repo',
        upstreamBranch: 'main',
      })
      .setGitHub({
        repositoryFound: true,
        repositoryArchived: false,
        repositoryDisabled: false,
        repositoryPrivate: false,
        branchFound: true,
        resolvedCommitSha: 'abc123def456',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
      })
      .setSource({
        sourceAcquired: true,
        sourcePath: '/tmp/source',
        fileCount: 100,
        phpFileCount: 10,
        hasPluginYml: true,
        hasComposerJson: false,
        symlinkCount: 0,
        totalSizeBytes: 1000000,
      })
      .setPluginMetadata(
        {
          name: 'TopStats',
          version: '1.0.0',
          main: 'TopStats\\Main',
          api: ['5.0.0'],
          authors: ['Nick'],
        },
        'topstats',
        true
      )
      .build();

    expect(result.status).toBe(InspectionStatus.READY_FOR_REVIEW);
    expect(result.submission.filename).toBe('topstats.yaml');
    expect(result.github.resolvedCommitSha).toBe('abc123def456');
    expect(result.source.fileCount).toBe(100);
    expect(result.pluginMetadata?.name).toBe('TopStats');
    expect(result.suggestedPluginId).toBe('topstats');
  });

  test('result accessors work correctly', () => {
    const builder = new SubmissionInspectionResultBuilder();
    const result = builder
      .setStatus(InspectionStatus.SUBMISSION_ERROR)
      .setSubmission({
        filename: 'test.yaml',
        slug: 'test',
        schemaVersion: 1,
        upstreamRepository: 'a/b',
        upstreamBranch: 'main',
      })
      .setGitHub({
        repositoryFound: false,
        repositoryArchived: false,
        repositoryDisabled: false,
        repositoryPrivate: false,
        branchFound: false,
        resolvedCommitSha: '',
        repositoryOwner: 'a',
        repositoryName: 'b',
      })
      .setSource({
        sourceAcquired: false,
        fileCount: 0,
        phpFileCount: 0,
        hasPluginYml: false,
        hasComposerJson: false,
        symlinkCount: 0,
        totalSizeBytes: 0,
      })
      .addDiagnostics({
        code: 'PLUGIN_YML_MISSING',
        severity: DiagnosticSeverity.ERROR,
        message: 'Missing plugin.yml',
      })
      .build();

    expect(result.hasSubmissionErrors).toBe(true);
    expect(result.hasInfrastructureErrors).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});

describe('generateHumanReadableReport', () => {
  test('generates report for ready status', () => {
    const builder = new SubmissionInspectionResultBuilder();
    const result = builder
      .setStatus(InspectionStatus.READY_FOR_REVIEW)
      .setSubmission({
        filename: 'topstats.yaml',
        slug: 'topstats',
        schemaVersion: 1,
        upstreamRepository: 'owner/repo',
        upstreamBranch: 'main',
      })
      .setGitHub({
        repositoryFound: true,
        repositoryArchived: false,
        repositoryDisabled: false,
        repositoryPrivate: false,
        branchFound: true,
        resolvedCommitSha: 'abc123def456789',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
      })
      .setSource({
        sourceAcquired: true,
        sourcePath: '/tmp/source',
        fileCount: 100,
        phpFileCount: 10,
        hasPluginYml: true,
        hasComposerJson: false,
        symlinkCount: 0,
        totalSizeBytes: 1000000,
      })
      .setPluginMetadata(
        {
          name: 'TopStats',
          version: '1.0.0',
          main: 'TopStats\\Main',
          api: ['5.0.0'],
          authors: ['Nick'],
        },
        'topstats',
        true
      )
      .build();

    const report = generateHumanReadableReport(result);
    expect(report).toContain('READY FOR HUMAN REVIEW');
    expect(report).toContain('TopStats');
    expect(report).toContain('1.0.0');
    expect(report).toContain('abc123def456789');
  });

  test('generates report for error status', () => {
    const builder = new SubmissionInspectionResultBuilder();
    const result = builder
      .setStatus(InspectionStatus.SUBMISSION_ERROR)
      .setSubmission({
        filename: 'test.yaml',
        slug: 'test',
        schemaVersion: 1,
        upstreamRepository: 'owner/repo',
        upstreamBranch: 'main',
      })
      .setGitHub({
        repositoryFound: true,
        repositoryArchived: false,
        repositoryDisabled: false,
        repositoryPrivate: false,
        branchFound: true,
        resolvedCommitSha: 'abc123',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
      })
      .setSource({
        sourceAcquired: false,
        fileCount: 0,
        phpFileCount: 0,
        hasPluginYml: false,
        hasComposerJson: false,
        symlinkCount: 0,
        totalSizeBytes: 0,
      })
      .addDiagnostics({
        code: 'PLUGIN_YML_MISSING',
        severity: DiagnosticSeverity.ERROR,
        message: 'plugin.yml not found',
      })
      .build();

    const report = generateHumanReadableReport(result);
    expect(report).toContain('SUBMISSION ERROR');
    expect(report).toContain('PLUGIN_YML_MISSING');
  });

  test('generates report for infrastructure error', () => {
    const builder = new SubmissionInspectionResultBuilder();
    const result = builder
      .setStatus(InspectionStatus.INFRASTRUCTURE_ERROR)
      .setSubmission({
        filename: 'test.yaml',
        slug: 'test',
        schemaVersion: 1,
        upstreamRepository: 'owner/repo',
        upstreamBranch: 'main',
      })
      .setGitHub({
        repositoryFound: false,
        repositoryArchived: false,
        repositoryDisabled: false,
        repositoryPrivate: false,
        branchFound: false,
        resolvedCommitSha: '',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
      })
      .setSource({
        sourceAcquired: false,
        fileCount: 0,
        phpFileCount: 0,
        hasPluginYml: false,
        hasComposerJson: false,
        symlinkCount: 0,
        totalSizeBytes: 0,
      })
      .addDiagnostics({
        code: 'GITHUB_RATE_LIMITED',
        severity: DiagnosticSeverity.INFRASTRUCTURE_ERROR,
        message: 'GitHub API rate limited',
      })
      .build();

    const report = generateHumanReadableReport(result);
    expect(report).toContain('INFRASTRUCTURE ERROR');
    expect(report).toContain('GITHUB_RATE_LIMITED');
  });
});

describe('generateJsonOutput', () => {
  test('generates valid JSON', () => {
    const builder = new SubmissionInspectionResultBuilder();
    const result = builder
      .setStatus(InspectionStatus.READY_FOR_REVIEW)
      .setSubmission({
        filename: 'test.yaml',
        slug: 'test',
        schemaVersion: 1,
        upstreamRepository: 'owner/repo',
        upstreamBranch: 'main',
      })
      .setGitHub({
        repositoryFound: true,
        repositoryArchived: false,
        repositoryDisabled: false,
        repositoryPrivate: false,
        branchFound: true,
        resolvedCommitSha: 'abc123',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
      })
      .setSource({
        sourceAcquired: true,
        sourcePath: '/tmp/source',
        fileCount: 100,
        phpFileCount: 10,
        hasPluginYml: true,
        hasComposerJson: false,
        symlinkCount: 0,
        totalSizeBytes: 1000000,
      })
      .build();

    const json = generateJsonOutput(result);
    const parsed = JSON.parse(json);

    expect(parsed.status).toBe('READY_FOR_REVIEW');
    expect(parsed.submission.slug).toBe('test');
    expect(parsed.github.resolvedCommitSha).toBe('abc123');
    expect(parsed.summary.errorCount).toBe(0);
  });

  test('JSON includes review signals', () => {
    const builder = new SubmissionInspectionResultBuilder();
    const result = builder
      .setStatus(InspectionStatus.READY_FOR_REVIEW)
      .setSubmission({
        filename: 'test.yaml',
        slug: 'test',
        schemaVersion: 1,
        upstreamRepository: 'owner/repo',
        upstreamBranch: 'main',
      })
      .setGitHub({
        repositoryFound: true,
        repositoryArchived: false,
        repositoryDisabled: false,
        repositoryPrivate: false,
        branchFound: true,
        resolvedCommitSha: 'abc123',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
      })
      .setSource({
        sourceAcquired: true,
        sourcePath: '/tmp/source',
        fileCount: 100,
        phpFileCount: 10,
        hasPluginYml: true,
        hasComposerJson: false,
        symlinkCount: 0,
        totalSizeBytes: 1000000,
      })
      .setReviewSignals([
        {
          category: SignalCategory.NETWORK,
          severity: SignalSeverity.MEDIUM,
          message: 'Network usage detected',
          file: 'src/HttpClient.php',
        },
      ])
      .build();

    const json = generateJsonOutput(result);
    const parsed = JSON.parse(json);

    expect(parsed.reviewSignals).toHaveLength(1);
    expect(parsed.reviewSignals[0].category).toBe('network');
    expect(parsed.summary.signalCount).toBe(1);
  });
});
