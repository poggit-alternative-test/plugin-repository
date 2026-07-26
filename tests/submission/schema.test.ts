/**
 * Submission Schema Tests
 *
 * Tests for submission schema validation.
 */
import { describe, test, expect } from 'vitest';
import {
  validateSubmissionFilename,
  parseSubmission,
  parseRepositoryIdentity,
  validateBranch,
  findForbiddenFields,
} from '../../src/submission/schema.js';

describe('validateSubmissionFilename', () => {
  test('valid filename passes', () => {
    const result = validateSubmissionFilename('topstats.yaml');
    expect(result.valid).toBe(true);
    expect(result.slug).toBe('topstats');
  });

  test('valid yml extension passes', () => {
    const result = validateSubmissionFilename('my-plugin.yml');
    expect(result.valid).toBe(true);
    expect(result.slug).toBe('my-plugin');
  });

  test('filename with dashes and underscores passes', () => {
    const result = validateSubmissionFilename('my_awesome-plugin123.yaml');
    expect(result.valid).toBe(true);
    expect(result.slug).toBe('my_awesome-plugin123');
  });

  test('path traversal fails', () => {
    const result = validateSubmissionFilename('../evil.yaml');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('traversal');
  });

  test('nested path fails', () => {
    const result = validateSubmissionFilename('foo/bar.yaml');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('traversal');
  });

  test('hidden file fails', () => {
    const result = validateSubmissionFilename('.hidden.yaml');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Hidden');
  });

  test('wrong extension fails', () => {
    const result = validateSubmissionFilename('plugin.txt');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.yaml');
  });

  test('uppercase extension fails', () => {
    const result = validateSubmissionFilename('plugin.YAML');
    expect(result.valid).toBe(false);
  });

  test('case sensitivity for extension', () => {
    // .yml and .yaml lowercase should work
    expect(validateSubmissionFilename('a.yml').valid).toBe(true);
    expect(validateSubmissionFilename('a.yaml').valid).toBe(true);
  });
});

describe('parseRepositoryIdentity', () => {
  test('valid repository passes', () => {
    const result = parseRepositoryIdentity('nicholass003/TopStats');
    expect(result.valid).toBe(true);
    expect(result.owner).toBe('nicholass003');
    expect(result.name).toBe('TopStats');
  });

  test('repository with dots in name passes', () => {
    const result = parseRepositoryIdentity('owner/repo.name');
    expect(result.valid).toBe(true);
    expect(result.name).toBe('repo.name');
  });

  test('URL fails', () => {
    const result = parseRepositoryIdentity('https://github.com/owner/repo');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('URL');
  });

  test('github.com in string fails', () => {
    const result = parseRepositoryIdentity('github.com/owner/repo');
    expect(result.valid).toBe(false);
  });

  test('empty string fails', () => {
    const result = parseRepositoryIdentity('');
    expect(result.valid).toBe(false);
  });

  test('single part fails', () => {
    const result = parseRepositoryIdentity('justone');
    expect(result.valid).toBe(false);
  });

  test('three parts fails', () => {
    const result = parseRepositoryIdentity('a/b/c');
    expect(result.valid).toBe(false);
  });

  test('starts with hyphen fails', () => {
    const result = parseRepositoryIdentity('-owner/repo');
    expect(result.valid).toBe(false);
  });

  test('ends with hyphen fails', () => {
    const result = parseRepositoryIdentity('owner-/repo');
    expect(result.valid).toBe(false);
  });
});

describe('validateBranch', () => {
  test('valid branch passes', () => {
    expect(validateBranch('main').valid).toBe(true);
    expect(validateBranch('develop').valid).toBe(true);
    expect(validateBranch('feature/my-plugin').valid).toBe(true);
    expect(validateBranch('release-1.0.0').valid).toBe(true);
  });

  test('empty branch fails', () => {
    const result = validateBranch('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  test('whitespace-only branch fails', () => {
    const result = validateBranch('   ');
    expect(result.valid).toBe(false);
  });

  test('leading/trailing whitespace fails', () => {
    const result = validateBranch(' main ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('whitespace');
  });

  test('double dots fails', () => {
    const result = validateBranch('feature..main');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('..');
  });

  test('ends with lock fails', () => {
    const result = validateBranch('feature.lock');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.lock');
  });

  test('ends with slash fails', () => {
    const result = validateBranch('feature/');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('/');
  });

  test('control characters fail', () => {
    const result = validateBranch('feature\x00test');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('control');
  });
});

describe('parseSubmission', () => {
  test('valid submission parses', () => {
    const yaml = `schema_version: 1
upstream:
  repository: owner/repo
  branch: main
`;
    const result = parseSubmission(yaml);
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.schemaVersion).toBe(1);
      expect(result.data.repository).toBe('owner/repo');
      expect(result.data.branch).toBe('main');
    }
  });

  test('submission with URL fails', () => {
    const yaml = `schema_version: 1
upstream:
  repository: https://github.com/owner/repo
  branch: main
`;
    const result = parseSubmission(yaml);
    expect(result.success).toBe(false);
  });

  test('submission missing schema_version fails', () => {
    const yaml = `upstream:
  repository: owner/repo
  branch: main
`;
    const result = parseSubmission(yaml);
    expect(result.success).toBe(false);
  });

  test('submission wrong schema_version fails', () => {
    const yaml = `schema_version: 999
upstream:
  repository: owner/repo
  branch: main
`;
    const result = parseSubmission(yaml);
    expect(result.success).toBe(false);
  });

  test('submission missing repository fails', () => {
    const yaml = `schema_version: 1
upstream:
  branch: main
`;
    const result = parseSubmission(yaml);
    expect(result.success).toBe(false);
  });
});

describe('findForbiddenFields', () => {
  test('no forbidden fields returns empty', () => {
    const data = {
      schema_version: 1,
      upstream: { repository: 'a/b', branch: 'main' },
    };
    expect(findForbiddenFields(data)).toHaveLength(0);
  });

  test('forbidden field detected', () => {
    const data = {
      schema_version: 1,
      upstream: { repository: 'a/b', branch: 'main' },
      status: 'approved',
    };
    const found = findForbiddenFields(data);
    expect(found).toContain('status');
  });

  test('multiple forbidden fields detected', () => {
    const data = {
      schema_version: 1,
      upstream: { repository: 'a/b', branch: 'main' },
      status: 'approved',
      storage: {},
      artifact: {},
    };
    const found = findForbiddenFields(data);
    expect(found).toContain('status');
    expect(found).toContain('storage');
    expect(found).toContain('artifact');
  });
});
