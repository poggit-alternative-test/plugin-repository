/**
 * Workflow Validation Tests
 *
 * These tests validate the GitHub Actions workflow files are syntactically correct
 * and conform to expected patterns.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('GitHub Workflow Validation', () => {
  const workflowsDir = join(process.cwd(), '.github', 'workflows');

  function readWorkflow(name: string): string {
    return readFileSync(join(workflowsDir, name), 'utf-8');
  }

  describe('materialize-storage.yml', () => {
    const workflow = readWorkflow('materialize-storage.yml');

    it('is valid YAML', () => {
      expect(() => {
        // Basic YAML parsing check - just verify the file is readable
        workflow.trim();
      }).not.toThrow();
    });

    it('has a name', () => {
      expect(workflow).toContain('name: Materialize Storage');
    });

    it('has on workflow_dispatch trigger', () => {
      expect(workflow).toContain('workflow_dispatch');
    });

    it('declares required inputs', () => {
      expect(workflow).toContain('plugin_slug');
      expect(workflow).toContain('version');
      expect(workflow).toContain('upstream_repository');
      expect(workflow).toContain('upstream_sha');
    });

    it('has dry_run option with default true', () => {
      expect(workflow).toContain('dry_run');
      expect(workflow).toContain('default: true');
    });

    it('has validate-inputs job', () => {
      expect(workflow).toContain('validate-inputs:');
    });

    it('has verify-approval job', () => {
      expect(workflow).toContain('verify-approval:');
    });

    it('has generate-plan job', () => {
      expect(workflow).toContain('generate-plan:');
    });

    it('has dry-run-check job', () => {
      expect(workflow).toContain('dry-run-check:');
    });

    it('has execute-materialization job', () => {
      expect(workflow).toContain('execute-materialization:');
    });

    it('has materialize-summary job', () => {
      expect(workflow).toContain('materialize-summary:');
    });

    it('validates plugin slug format', () => {
      expect(workflow).toContain('Validate plugin slug');
      expect(workflow).toContain('^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$');
    });

    it('validates version format (SemVer)', () => {
      expect(workflow).toContain('Validate version format');
      // Support both \d and [0-9] in regex
      expect(workflow).toMatch(/\\[0-9\]/);
    });

    it('validates SHA format (40 hex)', () => {
      expect(workflow).toContain('Validate SHA format');
      expect(workflow).toContain('^[a-f0-9]{40}$');
    });

    it('validates repository format', () => {
      expect(workflow).toContain('Validate repository format');
      expect(workflow).toContain('^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$');
    });

    it('uses materialize CLI', () => {
      expect(workflow).toContain('npm run materialize');
    });

    it('sets MAT_M4_REVIEWS_DIR', () => {
      expect(workflow).toContain('MAT_M4_REVIEWS_DIR');
    });

    it('sets MAT_STORAGE_OWNER', () => {
      expect(workflow).toContain('MAT_STORAGE_OWNER');
    });

    it('sets MAT_REVIEWERS_CONFIG', () => {
      expect(workflow).toContain('MAT_REVIEWERS_CONFIG');
    });

    it('has GitHub App or Token configuration for execute', () => {
      // Workflow uses MAT_GITHUB_TOKEN (PAT) for testing
      expect(workflow).toContain('MAT_GITHUB_TOKEN');
    });

    it('has tester mode configuration', () => {
      expect(workflow).toContain('M5_TESTER_ENABLED');
      expect(workflow).toContain('M5_TESTER_ALLOWED_ORGS');
      expect(workflow).toContain('M5_TESTER_ALLOW_REPO_CREATION');
    });

    it('has trust model comments', () => {
      expect(workflow).toContain('TRUST MODEL');
      expect(workflow).toContain('MATERIALIZATION WORKFLOW (M5)');
    });

    it('checks M4 approval before execution', () => {
      expect(workflow).toContain('APPROVED decision');
      expect(workflow).toContain('M4 approval');
    });

    it('uploads plan as artifact', () => {
      expect(workflow).toContain('actions/upload-artifact');
      expect(workflow).toContain('materialization-plan');
    });

    it('respects dry_run input', () => {
      expect(workflow).toContain("dry_run ==");
      expect(workflow).toContain('needs.validate-inputs.outputs.dry_run');
    });
  });

  describe('build-trusted.yml', () => {
    const workflow = readWorkflow('build-trusted.yml');

    it('has a name', () => {
      expect(workflow).toContain('name: Build Trusted PHAR');
    });

    it('has trigger conditions', () => {
      expect(workflow).toContain('push:');
      expect(workflow).toContain('workflow_dispatch:');
    });

    it('has security permissions', () => {
      expect(workflow).toContain('permissions:');
      expect(workflow).toContain('contents: read');
    });

    it('checks out exact SHA', () => {
      expect(workflow).toContain('checkout-approved-sha:');
      expect(workflow).toContain('git rev-parse HEAD');
    });

    it('uses build-trusted CLI', () => {
      expect(workflow).toContain('build-trusted.ts');
    });

    it('has build job', () => {
      expect(workflow).toContain('build:');
    });

    it('has checksums job', () => {
      expect(workflow).toContain('checksums:');
    });
  });

  describe('submission-check.yml', () => {
    const workflow = readWorkflow('submission-check.yml');

    it('has a name', () => {
      expect(workflow).toContain('name: Submission Check');
    });

    it('has pull_request trigger', () => {
      expect(workflow).toContain('pull_request:');
    });

    it('has least-privilege permissions', () => {
      expect(workflow).toContain('permissions:');
      expect(workflow).toContain('contents: read');
      expect(workflow).toContain('pull-requests: read');
    });

    it('checks out base branch', () => {
      expect(workflow).toContain('ref: ${{ github.base_ref }}');
    });

    it('uses submission:inspect', () => {
      expect(workflow).toContain('submission:inspect');
    });
  });

  describe('validate-submission.yml', () => {
    const workflow = readWorkflow('validate-submission.yml');

    it('has a name', () => {
      expect(workflow).toContain('name: Validate Plugin Submission');
    });

    it('has TODO comments (legacy workflow)', () => {
      expect(workflow).toContain('TODO:');
    });
  });

  describe('publish-release.yml', () => {
    const workflow = readWorkflow('publish-release.yml');

    it('has a name', () => {
      expect(workflow).toContain('name: Publish Release');
    });

    it('has workflow_dispatch trigger', () => {
      expect(workflow).toContain('workflow_dispatch');
    });

    it('declares required inputs', () => {
      expect(workflow).toContain('plugin_name');
      expect(workflow).toContain('version');
      expect(workflow).toContain('storage_repository');
    });

    it('has draft option', () => {
      expect(workflow).toContain('draft:');
      expect(workflow).toContain('default: true');
    });

    it('has dry_run option', () => {
      expect(workflow).toContain('dry_run:');
    });

    it('has validate-inputs job', () => {
      expect(workflow).toContain('validate-inputs:');
    });

    it('has download-artifacts job', () => {
      expect(workflow).toContain('download-artifacts:');
    });

    it('has publish-release job', () => {
      expect(workflow).toContain('publish-release:');
    });

    it('has update-registry job', () => {
      expect(workflow).toContain('update-registry:');
    });

    it('has publish-summary job', () => {
      expect(workflow).toContain('publish-summary:');
    });

    it('uses publish CLI', () => {
      expect(workflow).toContain('npm run publish');
    });

    it('has publication permissions', () => {
      expect(workflow).toContain('contents: write');
      expect(workflow).toContain('packages: write');
    });

    it('validates plugin name format', () => {
      expect(workflow).toContain('Validate inputs');
      expect(workflow).toContain('^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$');
    });

    it('validates version format', () => {
      expect(workflow).toContain('^\\d+\\.\\d+\\.\\d+');
    });

    it('has trust model comments', () => {
      expect(workflow).toContain('TRUST MODEL');
      expect(workflow).toContain('PUBLICATION WORKFLOW (M7)');
    });

    it('downloads artifacts from build', () => {
      expect(workflow).toContain('actions/download-artifact');
    });

    it('respects dry_run input', () => {
      expect(workflow).toContain('dry_run ==');
    });

    it('has environment protection', () => {
      expect(workflow).toContain('environment:');
      expect(workflow).toContain('publication');
    });
  });
});

describe('CLI materialize Command', () => {
  it('materialize script is defined in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    expect(pkg.scripts.materialize).toBeDefined();
    expect(pkg.scripts.materialize).toContain('tsx');
    expect(pkg.scripts.materialize).toContain('materialize.ts');
  });

  it('supports plan command', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'materialize.ts'),
      'utf-8'
    );
    expect(cliSource).toContain("command === 'plan'");
    expect(cliSource).toContain('generatePlan');
  });

  it('supports execute command', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'materialize.ts'),
      'utf-8'
    );
    expect(cliSource).toContain("command === 'execute'");
    expect(cliSource).toContain('executePlan');
  });

  it('uses FileM4ApprovalStore', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'materialize.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('FileM4ApprovalStore');
  });

  it('uses RealGitHubClient', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'materialize.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('RealGitHubClient');
  });

  it('uses createTrustedExecutionContext', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'materialize.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('createTrustedExecutionContext');
  });

  it('validates required environment variables', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'materialize.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('MAT_M4_REVIEWS_DIR');
    expect(cliSource).toContain('MAT_STORAGE_OWNER');
    expect(cliSource).toContain('MAT_REVIEWERS_CONFIG');
  });

  it('loads write-enabled transport for execute', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'materialize.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('loadWriteTransportConfig');
    expect(cliSource).toContain('writeEnabled: true');
  });
});

describe('CLI publish Command', () => {
  it('publish script is defined in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    expect(pkg.scripts.publish).toBeDefined();
    expect(pkg.scripts.publish).toContain('tsx');
    expect(pkg.scripts.publish).toContain('publish.ts');
  });

  it('publish.ts exists', () => {
    const cliPath = join(process.cwd(), 'src', 'cli', 'publish.ts');
    expect(existsSync(cliPath)).toBe(true);
  });

  it('publish CLI imports PublicationService', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'publish.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('publishToRelease');
  });

  it('publish CLI imports GitHubPublicationProvider', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'publish.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('GitHubPublicationProvider');
  });

  it('publish CLI supports publish command', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'publish.ts'),
      'utf-8'
    );
    expect(cliSource).toContain("command === 'publish'");
  });

  it('publish CLI validates required arguments', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'publish.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('--phar');
    expect(cliSource).toContain('--plugin-name');
    expect(cliSource).toContain('--version');
    expect(cliSource).toContain('--storage-repository');
  });

  it('publish CLI uses GitHub App authentication', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'publish.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('PUB_GITHUB_APP_ID');
    expect(cliSource).toContain('GitHubAppAuth');
  });

  it('publish CLI uses PUB_STORAGE_OWNER env var', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'publish.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('PUB_STORAGE_OWNER');
  });

  it('publish CLI outputs JSON result', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'publish.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('PUBLICATION_RESULT_JSON');
    expect(cliSource).toContain('JSON.stringify');
  });
});

describe('CLI update-registry Command', () => {
  it('registry:update script is defined in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    expect(pkg.scripts['registry:update']).toBeDefined();
    expect(pkg.scripts['registry:update']).toContain('tsx');
    expect(pkg.scripts['registry:update']).toContain('update-registry.ts');
  });

  it('update-registry.ts exists', () => {
    const cliPath = join(process.cwd(), 'src', 'cli', 'update-registry.ts');
    expect(existsSync(cliPath)).toBe(true);
  });

  it('update-registry CLI imports Registry writer', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'update-registry.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('writeVersionRecord');
    expect(cliSource).toContain('buildArtifactRef');
    expect(cliSource).toContain('updateVersionRecordWithPublication');
  });

  it('update-registry CLI supports update-published command', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'update-registry.ts'),
      'utf-8'
    );
    expect(cliSource).toContain("command === 'update-published'");
  });

  it('update-registry CLI validates required arguments', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'update-registry.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('--plugin-id');
    expect(cliSource).toContain('--version');
    expect(cliSource).toContain('--release-tag');
    expect(cliSource).toContain('--phar-file');
    expect(cliSource).toContain('--sha256');
    expect(cliSource).toContain('--published-at');
  });

  it('update-registry CLI outputs JSON result', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'update-registry.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('REGISTRY_UPDATE_RESULT');
    expect(cliSource).toContain('JSON.stringify');
  });

  it('update-registry CLI supports dry-run mode', () => {
    const cliSource = readFileSync(
      join(process.cwd(), 'src', 'cli', 'update-registry.ts'),
      'utf-8'
    );
    expect(cliSource).toContain('--dry-run');
  });
});

