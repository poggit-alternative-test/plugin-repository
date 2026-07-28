/**
 * M5 GitHub Client Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FakeGitHubClient,
  type FakeGitHubClientConfig,
} from '../../src/materialization/github-client.js';

describe('M5: GitHub Client', () => {
  describe('FakeGitHubClient', () => {
    let client: FakeGitHubClient;

    describe('basic operations', () => {
      beforeEach(() => {
        client = new FakeGitHubClient({
          writeEnabled: false,
          latency: 0,
        });

        // Add test repositories
        client.addRepository({
          fullName: 'example/my-plugin' as any,
          isPrivate: false,
          isArchived: false,
        });

        client.addCommit(
          'example/my-plugin' as any,
          'abc123def456789012345678901234567890abcd' as any,
          {
            message: 'Initial commit',
            author: { name: 'Test', email: 'test@example.com', date: '2024-01-01T00:00:00Z' },
          }
        );
      });

      afterEach(() => {
        client.close();
      });

      it('should report write mode status', () => {
        expect(client.isWriteEnabled()).toBe(false);

        const writeClient = new FakeGitHubClient({ writeEnabled: true, latency: 0 });
        expect(writeClient.isWriteEnabled()).toBe(true);
        writeClient.close();
      });

      it('should return repository info', async () => {
        const repo = await client.getRepository('example/my-plugin' as any);
        expect(repo).not.toBeNull();
        expect(repo?.name).toBe('my-plugin');
        expect(repo?.owner).toBe('example');
        expect(repo?.fullName).toBe('example/my-plugin');
        expect(repo?.isPrivate).toBe(false);
        expect(repo?.isArchived).toBe(false);
      });

      it('should return null for non-existent repository', async () => {
        const repo = await client.getRepository('example/nonexistent' as any);
        expect(repo).toBeNull();
      });

      it('should check repository existence', async () => {
        expect(await client.repositoryExists('example/my-plugin' as any)).toBe(true);
        expect(await client.repositoryExists('example/nonexistent' as any)).toBe(false);
      });

      it('should return branch info', async () => {
        const branch = await client.getBranch('example/my-plugin' as any, 'main');
        expect(branch).not.toBeNull();
        expect(branch?.name).toBe('main');
        expect(branch?.isProtected).toBe(false);
      });

      it('should return null for non-existent branch', async () => {
        const branch = await client.getBranch('example/my-plugin' as any, 'nonexistent');
        expect(branch).toBeNull();
      });

      it('should return commit info', async () => {
        const commit = await client.getCommit(
          'example/my-plugin' as any,
          'abc123def456789012345678901234567890abcd' as any
        );
        expect(commit).not.toBeNull();
        expect(commit?.message).toBe('Initial commit');
        expect(commit?.author.name).toBe('Test');
      });

      it('should return null for non-existent commit', async () => {
        const commit = await client.getCommit(
          'example/my-plugin' as any,
          '0000000000000000000000000000000000000000' as any
        );
        expect(commit).toBeNull();
      });

      it('should download archive', async () => {
        const archive = await client.downloadArchive('example/my-plugin' as any, 'main');
        expect(Buffer.isBuffer(archive)).toBe(true);
      });
    });

    describe('write operations', () => {
      it('should create repository when write mode enabled', async () => {
        const writeClient = new FakeGitHubClient({ writeEnabled: true, latency: 0 });

        const result = await writeClient.createRepository({
          name: 'new-plugin',
          description: 'A new plugin',
          private: false,
          owner: 'axolotl-pm-plugins',
        });

        expect(result.success).toBe(true);
        expect(result.repository).toBe('axolotl-pm-plugins/new-plugin');

        writeClient.close();
      });

      it('should fail to create repository without write mode', async () => {
        const readClient = new FakeGitHubClient({ writeEnabled: false, latency: 0 });

        const result = await readClient.createRepository({
          name: 'new-plugin',
          description: 'A new plugin',
          private: false,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('WRITE_MODE_NOT_ENABLED');

        readClient.close();
      });

      it('should fail to create duplicate repository', async () => {
        const writeClient = new FakeGitHubClient({ writeEnabled: true, latency: 0 });

        // Create repository first
        await writeClient.createRepository({
          name: 'existing-plugin',
          description: 'Already exists',
          private: false,
        });

        // Try to create again
        const result = await writeClient.createRepository({
          name: 'existing-plugin',
          description: 'Already exists',
          private: false,
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GITHUB_REPOSITORY_EXISTS');

        writeClient.close();
      });

      it('should upload files when write mode enabled', async () => {
        const writeClient = new FakeGitHubClient({ writeEnabled: true, latency: 0 });

        // Create repository first
        await writeClient.createRepository({
          name: 'upload-plugin',
          description: 'Test',
          private: false,
          owner: 'axolotl-pm-plugins',
        });

        const result = await writeClient.uploadFiles({
          repository: 'axolotl-pm-plugins/upload-plugin' as any,
          branch: 'main',
          files: [
            {
              path: 'plugin.yml',
              content: Buffer.from('name: Test\nversion: 1.0.0').toString('base64'),
              encoding: 'base64',
            },
          ],
          message: 'Initial commit',
          author: { name: 'Test', email: 'test@example.com' },
        });

        expect(result.success).toBe(true);
        expect(result.commitSha).toBeDefined();

        writeClient.close();
      });

      it('should fail to upload files without write mode', async () => {
        const readClient = new FakeGitHubClient({ writeEnabled: false, latency: 0 });

        readClient.addRepository({ fullName: 'example/test' as any });

        const result = await readClient.uploadFiles({
          repository: 'example/test' as any,
          branch: 'main',
          files: [{ path: 'test.txt', content: 'test', encoding: 'utf-8' }],
          message: 'Test',
          author: { name: 'Test', email: 'test@example.com' },
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('WRITE_MODE_NOT_ENABLED');

        readClient.close();
      });

      it('should fail to upload to non-existent repository', async () => {
        const writeClient = new FakeGitHubClient({ writeEnabled: true, latency: 0 });

        const result = await writeClient.uploadFiles({
          repository: 'example/nonexistent' as any,
          branch: 'main',
          files: [{ path: 'test.txt', content: 'test', encoding: 'utf-8' }],
          message: 'Test',
          author: { name: 'Test', email: 'test@example.com' },
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GITHUB_REPOSITORY_NOT_FOUND');

        writeClient.close();
      });

      it('should create commit when write mode enabled', async () => {
        const writeClient = new FakeGitHubClient({ writeEnabled: true, latency: 0 });

        // Create repository first
        await writeClient.createRepository({
          name: 'commit-plugin',
          description: 'Test',
          private: false,
          owner: 'axolotl-pm-plugins',
        });

        const result = await writeClient.createCommit({
          repository: 'axolotl-pm-plugins/commit-plugin' as any,
          branch: 'main',
          expectedParent: '0000000000000000000000000000000000000000' as any,
          message: 'Test commit',
          files: [{ path: 'README.md', content: '# Test', encoding: 'utf-8' }],
          author: { name: 'Test', email: 'test@example.com' },
        });

        expect(result.success).toBe(true);
        expect(result.commitSha).toBeDefined();

        writeClient.close();
      });

      it('should reject a stale expected branch head', async () => {
        const writeClient = new FakeGitHubClient({ writeEnabled: true, latency: 0 });
        await writeClient.createRepository({ name: 'cas-plugin', description: 'Test', private: false, owner: 'axolotl-pm-plugins' });
        const first = await writeClient.createCommit({ repository: 'axolotl-pm-plugins/cas-plugin' as any, branch: 'main', expectedParent: '0000000000000000000000000000000000000000' as any, message: 'first', files: [], author: { name: 'Test', email: 'test@example.com' } });
        expect(first.success).toBe(true);
        const stale = await writeClient.createCommit({ repository: 'axolotl-pm-plugins/cas-plugin' as any, branch: 'main', expectedParent: '0000000000000000000000000000000000000000' as any, message: 'stale', files: [], author: { name: 'Test', email: 'test@example.com' } });
        expect(stale.success).toBe(false);
        expect(stale.error?.code).toBe('CONCURRENCY_CONFLICT');
        writeClient.close();
      });

      it('should create branch when write mode enabled', async () => {
        const writeClient = new FakeGitHubClient({ writeEnabled: true, latency: 0 });

        // Create repository first
        await writeClient.createRepository({
          name: 'branch-plugin',
          description: 'Test',
          private: false,
          owner: 'axolotl-pm-plugins',
        });

        const result = await writeClient.createBranch({
          repository: 'axolotl-pm-plugins/branch-plugin' as any,
          branch: 'v1.0',
          fromSha: 'abc123def456789012345678901234567890abcd' as any,
        });

        expect(result.success).toBe(true);

        writeClient.close();
      });
    });

    describe('simulated latency', () => {
      it('should add latency to operations', async () => {
        const client = new FakeGitHubClient({
          writeEnabled: false,
          latency: 50,
        });

        client.addRepository({ fullName: 'example/test' as any });

        const start = Date.now();
        await client.getRepository('example/test' as any);
        const duration = Date.now() - start;

        expect(duration).toBeGreaterThanOrEqual(50);

        client.close();
      });
    });

    describe('getRepositories', () => {
      it('should return all simulated repositories', () => {
        const client = new FakeGitHubClient({ writeEnabled: false, latency: 0 });

        client.addRepository({ fullName: 'example/plugin1' as any });
        client.addRepository({ fullName: 'example/plugin2' as any });

        const repos = client.getRepositories();
        expect(repos.size).toBe(2);
        expect(repos.has('example/plugin1' as any)).toBe(true);
        expect(repos.has('example/plugin2' as any)).toBe(true);

        client.close();
      });
    });
  });
});
