import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  createMaterializationService, FakeGitHubClient, FileM4ApprovalStore, GitHubExactSourceAcquirer,
  materializeArchive, type ApprovedCandidateInfo, type ExactSourceAcquirer, type TrustedM4ApprovalStore,
  type TrustedM4Approval, type GitSha, type PluginId, type RepositoryIdentity, type SemVer,
  type MaterializationArchiveLimits, MATERIALIZATION_ARCHIVE_LIMITS,
} from '../../src/materialization/index.js';
import { createCandidateIdentity } from '../../src/review/candidate-identity.js';

const AAA = 'a'.repeat(40) as GitSha;
const BBB = 'b'.repeat(40) as GitSha;
const ZERO = '0'.repeat(40) as GitSha;
const upstream = 'developer/example' as RepositoryIdentity;
const storageOwner = 'test-storage';

async function zip(files: Record<string, string>, root: string = `upstream-${AAA.slice(0, 7)}`): Promise<Buffer> {
  const { default: AdmZip } = await import('adm-zip'); const archive = new AdmZip();
  for (const [file, content] of Object.entries(files)) archive.addFile(root ? `${root}/${file}` : file, Buffer.from(content));
  return archive.toBuffer();
}
/** Creates a ZIP with potentially dangerous raw entry names (bypasses AdmZip normalization). */
function createRawZip(entries: Array<{ name: string; content: string; symlink?: boolean }>): Buffer {
  const parts: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let dataOffset = 0;
  for (const { name, content, symlink: isSymlink } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const contentBytes = Buffer.from(content, 'utf8');
    const crc = crc32(contentBytes) >>> 0; // Ensure unsigned
    // External attrs: upper 16 bits = Unix mode (mode << 16), lower 16 bits = DOS attrs
    // For symlink: mode = 0o120000; for regular: mode = 0o100644
    const mode = isSymlink ? 0o120000 : 0o100644;
    const externalAttrs = (mode << 16) >>> 0;
    // Local file header
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // compression (store)
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14); // crc32
    localHeader.writeUInt32LE(contentBytes.length, 18); // compressed size
    localHeader.writeUInt32LE(contentBytes.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBytes.length, 26); // name length
    localHeader.writeUInt16LE(0, 28); // extra field length
    nameBytes.copy(localHeader, 30);
    parts.push(Buffer.concat([localHeader, contentBytes]));
    const entryOffset = dataOffset;
    dataOffset += 30 + nameBytes.length + contentBytes.length;
    // Central directory entry
    const cdEntry = Buffer.alloc(46 + nameBytes.length);
    cdEntry.writeUInt32LE(0x02014b50, 0); // signature
    cdEntry.writeUInt16LE(20, 4); // version made by
    cdEntry.writeUInt16LE(20, 6); // version needed
    cdEntry.writeUInt16LE(0, 8); // flags
    cdEntry.writeUInt16LE(0, 10); // compression
    cdEntry.writeUInt16LE(0, 12); // mod time
    cdEntry.writeUInt16LE(0, 14); // mod date
    cdEntry.writeUInt32LE(crc, 16); // crc32
    cdEntry.writeUInt32LE(contentBytes.length, 20); // compressed size
    cdEntry.writeUInt32LE(contentBytes.length, 24); // uncompressed size
    cdEntry.writeUInt16LE(nameBytes.length, 28); // name length
    cdEntry.writeUInt16LE(0, 30); // extra field length
    cdEntry.writeUInt16LE(0, 32); // comment length
    cdEntry.writeUInt16LE(0, 34); // disk number
    cdEntry.writeUInt16LE(0, 36); // internal attrs
    cdEntry.writeUInt32LE(externalAttrs, 38); // external attrs
    cdEntry.writeUInt32LE(entryOffset >>> 0, 42); // relative offset
    nameBytes.copy(cdEntry, 46);
    centralDirectory.push(cdEntry);
  }
  const cdOffset = dataOffset;
  const cdData = Buffer.concat(centralDirectory);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with cd
  eocd.writeUInt16LE(entries.length, 8); // entries on disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(cdData.length, 12); // cd size
  eocd.writeUInt32LE(cdOffset, 16); // cd offset
  eocd.writeUInt16LE(0, 20); // comment length
  return Buffer.concat([...parts, cdData, eocd]);
}
/** CRC-32 calculation for ZIP format (returns unsigned 32-bit). */
function crc32(data: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
async function symlinkZip(): Promise<Buffer> { const { default: AdmZip } = await import('adm-zip'); const archive = new AdmZip(); archive.addFile('root/link', Buffer.from('target')); const entry = archive.getEntry('root/link')!; entry.header.attr = 0o120000 << 16; return archive.toBuffer(); }
function approval(sha: GitSha = AAA): TrustedM4Approval { return { candidateIdentity: `plugin@developer/example#${sha}`, approvalDecisionId: `approval-${sha.slice(0, 8)}`, pluginId: 'plugin' as PluginId, upstreamRepository: upstream, upstreamBranch: 'main', approvedSha: sha, reviewerId: '123', reviewApprovedAt: '2026-01-01T00:00:00.000Z', inspectionCompletedAt: '2025-12-31T00:00:00.000Z' }; }
class M4 implements TrustedM4ApprovalStore { constructor(private readonly approvals: Map<string, TrustedM4Approval>) {} async resolve(candidate: Omit<ApprovedCandidateInfo, 'version'>): Promise<TrustedM4Approval | null> { return this.approvals.get(String(candidate.upstreamCommit)) ?? null; } }
class Sources implements ExactSourceAcquirer { constructor(private readonly archives: Map<string, Buffer>) {} async acquire(current: TrustedM4Approval): Promise<Buffer> { const archive = this.archives.get(current.approvedSha); if (!archive) throw new Error('missing exact archive'); return archive; } }
function candidate(sha: GitSha = AAA): ApprovedCandidateInfo { return { pluginId: 'plugin' as PluginId, version: '1.2.3' as SemVer, upstreamRepository: upstream, upstreamCommit: sha }; }

describe('M5 trusted source materialization', () => {
  let github: FakeGitHubClient; let m4: M4; let sources: Sources;
  beforeEach(async () => { github = new FakeGitHubClient({ writeEnabled: true, latency: 0 }); m4 = new M4(new Map([[AAA, approval()], [BBB, approval(BBB)]])); sources = new Sources(new Map([[AAA, await zip({ 'plugin.yml': 'name: Plugin\n', 'src/Main.php': '<?php echo 1;' })], [BBB, await zip({ 'plugin.yml': 'name: Plugin\n', 'src/Main.php': '<?php echo 2;' })]])); });
  function service(limits?: MaterializationArchiveLimits) { return createMaterializationService({ storageOwners: [storageOwner], defaultStorage: { owner: storageOwner, branch: 'main' }, m4ApprovalStore: m4, sourceAcquirer: sources, provenanceDir: '.test-provenance', archiveLimits: limits }); }
  async function writablePlan(sha: GitSha = AAA) { const materializer = service(); const generated = await materializer.generatePlan(candidate(sha), { dryRun: false }); expect(generated.errors).toEqual([]); return { materializer, plan: generated.plan, context: materializer.createTrustedExecutionContext() }; }

  it('plans deterministically with no mutation', async () => { const materializer = service(); const first = await materializer.generatePlan(candidate()); const second = await materializer.generatePlan(candidate()); expect(first.plan.materializationId).toBe(second.plan.materializationId); expect(github.getRepositories().size).toBe(0); });
  it('acquires only the M4-approved GitHub exact SHA', async () => { const archive = await zip({ 'plugin.yml': 'name: Plugin' }); github.addRepository({ fullName: upstream }); github.addCommit(upstream, AAA, { message: 'approved', author: { name: 't', email: 't@x', date: '2026-01-01T00:00:00Z' } }); github.addArchive(`${upstream}:${AAA}`, archive); expect((await new GitHubExactSourceAcquirer(github).acquire(approval())).equals(archive)).toBe(true); await expect(new GitHubExactSourceAcquirer(github).acquire(approval(BBB))).rejects.toThrow('exact SHA'); });
  it('rejects caller state missing from M4 and mismatched M4 SHA', async () => { expect((await service().generatePlan(candidate('c'.repeat(40) as GitSha))).errors.map((error) => error.code)).toContain('CANDIDATE_NOT_APPROVED'); const lying: TrustedM4ApprovalStore = { resolve: async () => approval() }; expect((await createMaterializationService({ storageOwners: [storageOwner], defaultStorage: { owner: storageOwner, branch: 'main' }, m4ApprovalStore: lying, sourceAcquirer: sources }).generatePlan(candidate(BBB))).errors.map((error) => error.code)).toContain('APPROVED_SHA_MISMATCH'); });
  it('resolves only identity-consistent allowlisted M4 records', async () => { const root = path.join(process.cwd(), '.test-m4-materialization', Date.now().toString()); const identity = createCandidateIdentity({ pluginSlug: 'plugin', upstreamRepository: 'developer/example', sha: AAA }); const directory = path.join(root, 'plugin', identity.shortId); fs.mkdirSync(path.join(directory, 'decisions'), { recursive: true }); fs.writeFileSync(path.join(directory, 'candidate.yaml'), `schemaVersion: 1\ncandidateIdentity: ${identity.canonical}\npluginSlug: plugin\nupstreamRepository: developer/example\nupstreamBranch: main\nsha: ${AAA}\ninspectionTimestamp: 2025-12-31T00:00:00.000Z\n`); fs.writeFileSync(path.join(directory, 'decisions', 'decision01.yaml'), `schemaVersion: 1\ndecisionId: decision01\ncandidateIdentity: ${identity.canonical}\npluginSlug: plugin\nupstreamRepository: developer/example\nreviewedSha: ${AAA}\ndecision: APPROVED\nreviewer:\n  githubId: 123\ntimestamp: 2026-01-01T00:00:00.000Z\n`); try { expect((await new FileM4ApprovalStore(root, [123]).resolve(candidate()))?.approvedSha).toBe(AAA); expect(await new FileM4ApprovalStore(root, [999]).resolve(candidate())).toBeNull(); } finally { fs.rmSync(root, { recursive: true, force: true }); } });
  it('rejects source and storage plan substitutions before mutation', async () => { const materializer = service(); const generated = await materializer.generatePlan(candidate(), { dryRun: false }); const badSha = structuredClone(generated.plan); badSha.source.commitSha = BBB; const badStorage = structuredClone(generated.plan); badStorage.storageRepository = 'test-storage/other' as RepositoryIdentity; const context = materializer.createTrustedExecutionContext(); expect((await materializer.executePlan(badSha, github, context)).success).toBe(false); expect((await materializer.executePlan(badStorage, github, context)).success).toBe(false); expect(github.getRepositories().size).toBe(0); });
  it('requires a separate trusted context even when a plan is tampered from dry-run to write', async () => { const materializer = service(); const generated = await materializer.generatePlan(candidate()); const tampered = structuredClone(generated.plan); tampered.dryRun = false; const result = await materializer.executePlan(tampered, github); expect(result.errors.map((error) => error.code)).toContain('WRITE_MODE_NOT_ENABLED'); expect(github.getRepositories().size).toBe(0); });
  it('dry-run invokes zero mutation methods even with a trusted context', async () => { const materializer = service(); const plan = (await materializer.generatePlan(candidate())).plan; const result = await materializer.executePlan(plan, github, materializer.createTrustedExecutionContext()); expect(result.success).toBe(true); expect(github.getRepositories().size).toBe(0); });
  it('proves the exact SHA invariant in canonical provenance', async () => { const { materializer, plan, context } = await writablePlan(); const result = await materializer.executePlan(plan, github, context); expect(result.success).toBe(true); expect(result.provenance?.upstreamCommit).toBe(AAA); expect(result.provenance?.sourceIntegrity.acquiredSha).toBe(AAA); expect((await github.listFiles(plan.storageRepository, 'main', plan.sourcePath)).length).toBe(2); });
  it('returns ALREADY_MATERIALIZED only when provenance and source both match', async () => { const { materializer, plan, context } = await writablePlan(); expect((await materializer.executePlan(plan, github, context)).success).toBe(true); const retry = await materializer.executePlan(plan, github, context); expect(retry.alreadyMaterialized).toBe(true); });
  it('fails closed for matching provenance with missing immutable source', async () => { const { materializer, plan, context } = await writablePlan(); expect((await materializer.executePlan(plan, github, context)).success).toBe(true); github.mutateHeadFilesForTest(plan.storageRepository, 'main', (tree) => { for (const file of [...tree.keys()]) if (file.startsWith(plan.sourcePath)) tree.delete(file); }); const result = await materializer.executePlan(plan, github, context); expect(result.success).toBe(false); expect(result.errors.map((error) => error.code)).toContain('MATERIALIZATION_CONFLICT'); });
  it('fails closed for matching provenance with modified immutable source', async () => { const { materializer, plan, context } = await writablePlan(); expect((await materializer.executePlan(plan, github, context)).success).toBe(true); github.mutateHeadFilesForTest(plan.storageRepository, 'main', (tree) => tree.set(`${plan.sourcePath}/src/Main.php`, { content: Buffer.from('malicious').toString('base64'), encoding: 'base64' })); expect((await materializer.executePlan(plan, github, context)).success).toBe(false); });
  it('retries source-only recovery without ever changing immutable source bytes', async () => { const { materializer, plan, context } = await writablePlan(); await github.createRepository({ name: 'plugin', description: 'test', private: true, owner: storageOwner }); const extracted = await materializeArchive(await sources.acquire(approval()), AAA); await github.createCommit({ repository: plan.storageRepository, branch: 'main', expectedParent: ZERO, message: 'partial source', author: { name: 't', email: 't@x' }, files: extracted.files.map((file) => ({ path: `${plan.sourcePath}/${file.path}`, content: file.content.toString('base64'), encoding: 'base64' })) }); const original = await github.listFiles(plan.storageRepository, 'main', plan.sourcePath); github.failNextCreateCommit(2); expect((await materializer.executePlan(plan, github, context)).success).toBe(false); expect((await materializer.executePlan(plan, github, context)).success).toBe(false); expect(await github.listFiles(plan.storageRepository, 'main', plan.sourcePath)).toEqual(original); expect((await materializer.executePlan(plan, github, context)).success).toBe(true); });
  it('fails closed for conflicting canonical provenance', async () => { const { materializer, plan, context } = await writablePlan(); await github.createRepository({ name: 'plugin', description: 'test', private: true, owner: storageOwner }); await github.createCommit({ repository: plan.storageRepository, branch: 'main', expectedParent: ZERO, message: 'bad', author: { name: 't', email: 't@x' }, files: [{ path: plan.provenancePath, content: Buffer.from('{"schemaVersion":2,"materializationId":"wrong"}').toString('base64'), encoding: 'base64' }] }); expect((await materializer.executePlan(plan, github, context)).errors.map((error) => error.code)).toContain('MATERIALIZATION_CONFLICT'); });
  it('makes concurrent stale writers conflict and a retry reconcile safely', async () => { const first = await writablePlan(); const second = await writablePlan(); const results = await Promise.all([first.materializer.executePlan(first.plan, github, first.context), second.materializer.executePlan(second.plan, github, second.context)]); expect(results.some((result) => result.success)).toBe(true); const retry = await second.materializer.executePlan(second.plan, github, second.context); expect(retry.success).toBe(true); expect(retry.alreadyMaterialized).toBe(true); });
  it('preserves AAA and BBB independently', async () => { const aaa = await writablePlan(AAA); const bbb = await writablePlan(BBB); expect((await aaa.materializer.executePlan(aaa.plan, github, aaa.context)).success).toBe(true); expect((await bbb.materializer.executePlan(bbb.plan, github, bbb.context)).success).toBe(true); expect(aaa.plan.materializationId).not.toBe(bbb.plan.materializationId); });
});

describe('M5 bounded archive processing', () => {
  const tiny: MaterializationArchiveLimits = { ...MATERIALIZATION_ARCHIVE_LIMITS, maxArchiveBytes: 1024, maxExtractedBytes: 20, maxFileCount: 2, maxFileBytes: 10, maxPathDepth: 3, maxPathLength: 32 };
  it('accepts a valid archive within all limits', async () => expect((await materializeArchive(await zip({ 'a.txt': 'ok' }), AAA, tiny)).integrity.fileCount).toBe(1));
  it('rejects oversized compressed bytes before ZIP parsing', async () => await expect(materializeArchive(Buffer.alloc(1025), AAA, tiny)).rejects.toThrow('compressed-byte'));
  it('rejects excessive expanded bytes', async () => await expect(materializeArchive(await zip({ 'a.txt': 'a'.repeat(21) }), AAA, tiny)).rejects.toThrow('limit'));
  it('rejects too many files', async () => await expect(materializeArchive(await zip({ 'a.txt': 'a', 'b.txt': 'b', 'c.txt': 'c' }), AAA, tiny)).rejects.toThrow('file count'));
  it('rejects an oversized individual file', async () => await expect(materializeArchive(await zip({ 'a.txt': 'a'.repeat(11) }), AAA, tiny)).rejects.toThrow('file exceeds'));
  it('rejects traversal paths', async () => await expect(materializeArchive(createRawZip([{ name: 'root/../evil.txt', content: 'x' }]), AAA, tiny)).rejects.toThrow('unsafe path'));
  it('rejects absolute paths', async () => await expect(materializeArchive(createRawZip([{ name: '/evil.txt', content: 'x' }]), AAA, tiny)).rejects.toThrow('unsafe path'));
  it('rejects symbolic-link entries', async () => await expect(materializeArchive(createRawZip([{ name: 'link', content: 'target', symlink: true }]), AAA, tiny)).rejects.toThrow('symbolic link'));
  it('rejects excessive depth and path length', async () => { await expect(materializeArchive(await zip({ 'a/b/c/d.txt': 'x' }), AAA, tiny)).rejects.toThrow('unsafe path'); await expect(materializeArchive(await zip({ [`${'a'.repeat(33)}.txt`]: 'x' }), AAA, tiny)).rejects.toThrow('unsafe path'); });
});
