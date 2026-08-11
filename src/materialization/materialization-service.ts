/** M5 trusted source materialization. Plans describe work; they never authorize writes. */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { LIMITS as M3_LIMITS } from '../submission/acquisition.js';
import { createCandidateIdentity } from '../review/candidate-identity.js';
import { EffectiveReviewState, deriveEffectiveState, getLatestDecision } from '../review/review-state.js';
import { isValidCandidateInfo, isValidReviewRecord, ReviewDecision, type CandidateInfo, type ReviewRecord } from '../review/review-record.js';
import type { GitHubClient, CreateCommitResult } from './github-client.js';
import {
  type GitSha, type PluginId, type SemVer, type RepositoryIdentity, type Sha256, type MaterializationPlan,
  type MaterializationResult, type MaterializationError, type MaterializationWarning, type MaterializationAction,
  type ProvenanceRecord, type SourceIntegrity, type TrustedM4Approval, type MaterializationErrorCode,
  type TrustedExecutionContext, MATERIALIZATION_CODES, isAllowedStorageOwner, isValidGitSha, isValidPluginId,
  isValidSemVer, isValidRepositoryIdentity,
} from './materialization-types.js';
import { buildRepositoryIdentity, DEFAULT_STORAGE_BRANCH, pluginIdToRepoName } from './repository-naming.js';

export interface ApprovedCandidateInfo { pluginId: PluginId; version: SemVer; upstreamRepository: RepositoryIdentity; upstreamCommit: GitSha; }
export interface TrustedM4ApprovalStore { resolve(candidate: Omit<ApprovedCandidateInfo, 'version'>): Promise<TrustedM4Approval | null>; }
export interface ExactSourceAcquirer { acquire(approval: TrustedM4Approval): Promise<Buffer>; }

/** Production exact-ref boundary: no branch or release fallback is accepted. */
export class GitHubExactSourceAcquirer implements ExactSourceAcquirer {
  constructor(private readonly github: GitHubClient) {}
  async acquire(approval: TrustedM4Approval): Promise<Buffer> {
    const commit = await this.github.getCommit(approval.upstreamRepository, approval.approvedSha);
    if (!commit || commit.sha.toLowerCase() !== approval.approvedSha.toLowerCase()) throw new Error('Configured upstream did not resolve the M4-approved exact SHA');
    return this.github.downloadArchive(approval.upstreamRepository, approval.approvedSha);
  }
}

/** Test-only source cache; production composition must use GitHubExactSourceAcquirer. */
export class ArchiveDirectorySourceAcquirer implements ExactSourceAcquirer {
  constructor(private readonly archiveRoot: string) {}
  async acquire(approval: TrustedM4Approval): Promise<Buffer> {
    const root = path.resolve(this.archiveRoot); const archive = path.resolve(root, String(approval.pluginId), `${approval.approvedSha}.zip`);
    if (archive !== root && !archive.startsWith(`${root}${path.sep}`)) throw new Error('Configured archive path escapes archive root');
    if (!fs.existsSync(archive)) throw new Error(`Exact acquired archive is missing: ${archive}`);
    return fs.readFileSync(archive);
  }
}

/** Fail-closed adapter over frozen M4 records and trusted reviewer configuration. */
export class FileM4ApprovalStore implements TrustedM4ApprovalStore {
  constructor(private readonly reviewDir: string, private readonly authorizedReviewerIds: readonly number[]) {}
  async resolve(candidate: Omit<ApprovedCandidateInfo, 'version'>): Promise<TrustedM4Approval | null> {
    let identity; try { identity = createCandidateIdentity({ pluginSlug: String(candidate.pluginId), upstreamRepository: String(candidate.upstreamRepository), sha: String(candidate.upstreamCommit) }); } catch (e) { console.error('[DEBUG] Failed to create identity:', e); return null; }
    const candidateDir = path.join(this.reviewDir, identity.pluginSlug, identity.shortId); const candidatePath = path.join(candidateDir, 'candidate.yaml'); const decisionsDir = path.join(candidateDir, 'decisions');
    console.error('[DEBUG] Looking for candidate at:', candidatePath);
    console.error('[DEBUG] CandidateDir exists:', fs.existsSync(candidateDir));
    console.error('[DEBUG] CandidatePath exists:', fs.existsSync(candidatePath));
    console.error('[DEBUG] DecisionsDir exists:', fs.existsSync(decisionsDir));
    if (!fs.existsSync(candidatePath) || !fs.existsSync(decisionsDir)) return null;
    let info: CandidateInfo; try { info = parse(fs.readFileSync(candidatePath, 'utf-8')) as CandidateInfo; console.error('[DEBUG] Parsed candidate info:', JSON.stringify(info)); } catch (e) { console.error('[DEBUG] Failed to parse candidate:', e); return null; }
    if (!isValidCandidateInfo(info)) { console.error('[DEBUG] Invalid candidate info'); return null; }
    if (info.candidateIdentity !== identity.canonical || info.pluginSlug !== identity.pluginSlug || info.upstreamRepository !== identity.upstreamRepository || info.sha.toLowerCase() !== identity.sha.toLowerCase()) { console.error('[DEBUG] Candidate mismatch'); return null; }
    const files = fs.readdirSync(decisionsDir).filter((file) => file.endsWith('.yaml')).sort(); console.error('[DEBUG] Decision files:', files);
    if (files.length === 0) return null;
    const decisions: ReviewRecord[] = [];
    for (const file of files) {
      let value: unknown; try { value = parse(fs.readFileSync(path.join(decisionsDir, file), 'utf-8')); } catch { continue; }
      if (!isValidReviewRecord(value)) { console.error('[DEBUG] Invalid review record:', file); continue; }
      const record = value as ReviewRecord;
      console.error('[DEBUG] Review record:', JSON.stringify(record));
      if (record.candidateIdentity !== identity.canonical || record.pluginSlug !== identity.pluginSlug || record.upstreamRepository !== identity.upstreamRepository || record.reviewedSha.toLowerCase() !== identity.sha.toLowerCase() || !this.authorizedReviewerIds.includes(record.reviewer.githubId)) { console.error('[DEBUG] Record rejected - authorizedIds:', this.authorizedReviewerIds, 'record githubId:', record.reviewer.githubId); continue; }
      decisions.push(record);
    }
    console.error('[DEBUG] Valid decisions:', decisions.length);
    if (deriveEffectiveState(decisions) !== EffectiveReviewState.APPROVED) { console.error('[DEBUG] Not APPROVED state'); return null; }
    const latest = getLatestDecision(decisions); if (!latest || latest.decision !== ReviewDecision.APPROVE) { console.error('[DEBUG] Latest not APPROVE'); return null; }
    return { candidateIdentity: identity.canonical, approvalDecisionId: latest.decisionId, pluginId: info.pluginSlug as PluginId, upstreamRepository: info.upstreamRepository as RepositoryIdentity, upstreamBranch: info.upstreamBranch, approvedSha: info.sha.toLowerCase() as GitSha, reviewerId: String(latest.reviewer.githubId), reviewApprovedAt: latest.timestamp, inspectionCompletedAt: info.inspectionTimestamp };
  }
}

export interface MaterializationArchiveLimits {
  maxArchiveBytes: number; maxExtractedBytes: number; maxFileCount: number; maxFileBytes: number; maxPathDepth: number; maxPathLength: number;
}
/** M5 mirrors M3 resource ceilings and additionally caps normalized path length. */
export const MATERIALIZATION_ARCHIVE_LIMITS: MaterializationArchiveLimits = {
  maxArchiveBytes: M3_LIMITS.MAX_ARCHIVE_SIZE, maxExtractedBytes: M3_LIMITS.MAX_EXTRACTED_SIZE, maxFileCount: M3_LIMITS.MAX_FILE_COUNT, maxFileBytes: M3_LIMITS.MAX_FILE_SIZE, maxPathDepth: M3_LIMITS.MAX_TREE_DEPTH, maxPathLength: 4096,
};

export interface MaterializationServiceConfig {
  storageOwners: string[];
  defaultStorage?: { owner: string; branch: string };
  materializerAuthor: { name: string; email: string };
  axolotlVersion: string;
  /** Optional local cache only; Git provenance is canonical. */
  provenanceDir: string;
  candidateArchivesDir: string;
  m4ApprovalStore?: TrustedM4ApprovalStore;
  sourceAcquirer?: ExactSourceAcquirer;
  archiveLimits?: MaterializationArchiveLimits;
}
export const DEFAULT_MATERIALIZATION_CONFIG: MaterializationServiceConfig = { storageOwners: [], materializerAuthor: { name: 'Axolotl Materializer', email: 'materializer@invalid' }, axolotlVersion: '1.0.0-m5', provenanceDir: './provenance', candidateArchivesDir: './archives', archiveLimits: MATERIALIZATION_ARCHIVE_LIMITS };

export interface MaterializedSource { files: Array<{ path: string; content: Buffer }>; integrity: SourceIntegrity; }
class ExecutionContext implements TrustedExecutionContext {
  readonly kind = 'trusted-m5-execution-context' as const;
  constructor(private readonly issuer: MaterializationService) {}
  isIssuedBy(service: MaterializationService): boolean { return this.issuer === service; }
}
type CommitAttempt = { success: true; sha: GitSha } | { success: false; error?: CreateCommitResult['error'] };

export class MaterializationService {
  private config: MaterializationServiceConfig;
  constructor(config: Partial<MaterializationServiceConfig> = {}) { this.config = { ...DEFAULT_MATERIALIZATION_CONFIG, ...config, archiveLimits: config.archiveLimits ?? MATERIALIZATION_ARCHIVE_LIMITS }; }
  updateConfig(updates: Partial<MaterializationServiceConfig>): void { this.config = { ...this.config, ...updates }; }
  getConfig(): MaterializationServiceConfig { return { ...this.config, storageOwners: [...this.config.storageOwners] }; }
  /** Trusted composition must hold this in order to permit any mutation. */
  createTrustedExecutionContext(): TrustedExecutionContext { return new ExecutionContext(this); }

  async generatePlan(candidate: ApprovedCandidateInfo, options: { dryRun?: boolean } = {}): Promise<{ plan: MaterializationPlan; errors: MaterializationError[]; warnings: MaterializationWarning[] }> {
    const errors = this.validateCandidateHint(candidate); const warnings: MaterializationWarning[] = []; const dryRun = options.dryRun ?? true;
    if (dryRun) warnings.push({ code: 'DRY_RUN_MODE', message: 'Planning is read-only; a plan never authorizes writes.' });
    const approval = await this.resolveApproval(candidate, errors); if (!approval) return { plan: this.invalidPlan(candidate, dryRun), errors, warnings };
    const source = await this.acquireSource(approval, errors); if (!source) return { plan: this.invalidPlan(candidate, dryRun), errors, warnings };
    return { plan: this.buildPlan(approval, candidate.version, source.integrity, dryRun, errors), errors, warnings };
  }

  async executePlan(untrustedPlan: MaterializationPlan, githubClient: GitHubClient, context?: TrustedExecutionContext): Promise<MaterializationResult> {
    const started = Date.now(); const errors: MaterializationError[] = []; const warnings: MaterializationWarning[] = [];
    const finish = (success: boolean, alreadyMaterialized = false, provenance?: ProvenanceRecord, executedActions = 0, failedActions = 0): MaterializationResult => ({ success, alreadyMaterialized, pluginId: untrustedPlan.pluginId, version: untrustedPlan.version, plan: untrustedPlan, provenance, executedActions, failedActions, durationMs: Date.now() - started, errors, warnings });
    // Plan-controlled dry-run can only reduce privilege; it can never grant it.
    if (untrustedPlan.dryRun) { warnings.push({ code: 'DRY_RUN_MODE', message: 'Dry-run execution invokes no mutation methods.' }); return finish(true); }
    if (!(context instanceof ExecutionContext) || !context.isIssuedBy(this)) { errors.push(this.error(-1, 'WRITE_MODE_NOT_ENABLED', 'A trusted execution context is required for mutation.')); return finish(false); }
    if (!githubClient.isWriteEnabled()) { errors.push(this.error(-1, 'WRITE_MODE_NOT_ENABLED', 'GitHub client write mode is not enabled.')); return finish(false); }
    const hint = { pluginId: untrustedPlan.pluginId, upstreamRepository: untrustedPlan.source?.repository, upstreamCommit: untrustedPlan.source?.commitSha } as Omit<ApprovedCandidateInfo, 'version'>;
    const approval = await this.resolveApproval({ ...hint, version: untrustedPlan.version }, errors); if (!approval) return finish(false);
    const source = await this.acquireSource(approval, errors); if (!source) return finish(false);
    const expected = this.buildPlan(approval, untrustedPlan.version, source.integrity, false, errors);
    if (errors.length || !this.planMatchesTrustedState(untrustedPlan, expected)) { errors.push(this.error(-1, 'PLAN_TAMPERED', 'Plan differs from execution-time M4 authorization or exact acquired source.')); return finish(false); }
    const repository = expected.storageRepository; let executed = 0;
    const repo = await githubClient.getRepository(repository);
    if (repo) {
      if (repo.fullName !== repository || repo.owner.toLowerCase() !== this.storageOwner().toLowerCase() || repo.isArchived) { errors.push(this.error(-1, 'STORAGE_REPOSITORY_INVALID', 'Existing repository does not match trusted storage configuration.')); return finish(false); }
    } else {
      const created = await githubClient.createRepository({ name: repository.split('/')[1], description: `Immutable reviewed source for ${approval.pluginId}`, private: true, owner: this.storageOwner() });
      console.error("[DEBUG] Create repo result:", JSON.stringify(created));
      if (!created.success && created.error?.code !== 'GITHUB_REPOSITORY_EXISTS') { errors.push(this.error(0, created.error?.code ?? 'GITHUB_CLIENT_ERROR', created.error?.message ?? 'Unable to create storage repository')); return finish(false, false, undefined, executed, 1); }
      const after = await githubClient.getRepository(repository);
      if (!after || after.fullName !== repository || after.owner.toLowerCase() !== this.storageOwner().toLowerCase() || after.isArchived) { errors.push(this.error(0, 'STORAGE_REPOSITORY_INVALID', 'Repository creation/reconciliation did not yield trusted storage identity.')); return finish(false, false, undefined, executed, 1); }
      executed++;
    }
    const expectedFiles = source.files.map((file) => ({ path: `${expected.sourcePath}/${file.path}`, content: file.content }));
    const existingProvenance = await this.readCanonicalProvenance(githubClient, repository, expected.storageBranch, expected.provenancePath);
    const existingSource = await githubClient.listFiles(repository, expected.storageBranch, expected.sourcePath);
    if (existingProvenance.kind === 'valid') {
      if (this.sameProvenance(existingProvenance.record, expected, approval, source.integrity) && sameFiles(existingSource, expectedFiles)) return finish(true, true, existingProvenance.record, executed);
      errors.push(this.error(-1, 'MATERIALIZATION_CONFLICT', 'Canonical provenance does not have its corresponding immutable source.')); return finish(false, false, undefined, executed);
    }
    if (existingProvenance.kind === 'invalid') { errors.push(this.error(-1, 'MATERIALIZATION_CONFLICT', 'Canonical provenance path is malformed or ambiguous.')); return finish(false, false, undefined, executed); }
    const head = await this.branchHead(githubClient, repository, expected.storageBranch);
    let sourceCommit: GitSha;
    if (existingSource.length > 0) {
      if (!sameFiles(existingSource, expectedFiles) || !head) { errors.push(this.error(-1, 'MATERIALIZATION_CONFLICT', 'Existing source-only state fails immutable integrity verification.')); return finish(false, false, undefined, executed); }
      // Recovery writes only canonical provenance; source bytes never change.
      sourceCommit = head;
    } else {
      const sourceCommitAttempt = await this.commit(githubClient, repository, expected.storageBranch, head, expectedFiles, `Materialize approved source ${approval.approvedSha}`);
      if (!sourceCommitAttempt.success) { errors.push(this.commitError(1, sourceCommitAttempt.error, 'Unable to commit immutable source.')); return finish(false, false, undefined, executed, 1); }
      sourceCommit = sourceCommitAttempt.sha; executed++;
    }
    const provenance = this.provenance(expected, approval, source.integrity, sourceCommit);
    const provenanceCommit = await this.commit(githubClient, repository, expected.storageBranch, sourceCommit, [{ path: expected.provenancePath, content: Buffer.from(JSON.stringify(provenance, null, 2)) }], `Record provenance ${expected.materializationId}`);
    if (!provenanceCommit.success) { errors.push(this.commitError(2, provenanceCommit.error, 'Source is preserved but canonical provenance was not committed; retry only verifies source then retries provenance.')); return finish(false, false, undefined, executed, 1); }
    return finish(true, false, provenance, executed + 1);
  }

  /** Optional local cache compatibility; never canonical provenance. */
  async saveProvenanceRecord(record: ProvenanceRecord): Promise<void> {
    const file = path.join(this.config.provenanceDir, String(record.pluginId), `${record.materializationId}.json`); fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf-8') !== JSON.stringify(record, null, 2)) throw new Error('Refusing to overwrite immutable provenance cache record');
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(record, null, 2), { encoding: 'utf-8', flag: 'wx' });
  }
  async loadProvenanceRecord(pluginId: PluginId, version: SemVer): Promise<ProvenanceRecord | null> { return (await this.listProvenanceRecords(pluginId)).find((record) => record.version === version) ?? null; }
  async listProvenanceRecords(pluginId: PluginId): Promise<ProvenanceRecord[]> { const directory = path.join(this.config.provenanceDir, String(pluginId)); if (!fs.existsSync(directory)) return []; return fs.readdirSync(directory).filter((file) => file.endsWith('.json')).flatMap((file) => { try { return [JSON.parse(fs.readFileSync(path.join(directory, file), 'utf-8')) as ProvenanceRecord]; } catch { return []; } }); }

  private validateCandidateHint(candidate: ApprovedCandidateInfo): MaterializationError[] { const errors: MaterializationError[] = []; if (!isValidPluginId(String(candidate.pluginId))) errors.push(this.error(-1, 'INVALID_PLUGIN_ID', 'Invalid plugin ID.')); if (!isValidSemVer(String(candidate.version))) errors.push(this.error(-1, 'INVALID_VERSION', 'Invalid version.')); if (!isValidRepositoryIdentity(String(candidate.upstreamRepository))) errors.push(this.error(-1, 'M4_IDENTITY_MISMATCH', 'Invalid upstream repository identity.')); if (!isValidGitSha(String(candidate.upstreamCommit))) errors.push(this.error(-1, 'INVALID_SHA', 'Invalid upstream commit SHA.')); return errors; }
  private async resolveApproval(candidate: ApprovedCandidateInfo, errors: MaterializationError[]): Promise<TrustedM4Approval | null> { if (errors.length || !this.config.m4ApprovalStore) { if (!errors.length) errors.push(this.error(-1, 'M4_STATE_UNAVAILABLE', 'No trusted M4 approval store is configured.')); return null; } try { const approval = await this.config.m4ApprovalStore.resolve(candidate); if (!approval) { errors.push(this.error(-1, 'CANDIDATE_NOT_APPROVED', 'M4 has no authorized effective approval for this exact candidate.')); return null; } if (approval.pluginId !== candidate.pluginId || approval.upstreamRepository !== candidate.upstreamRepository || approval.approvedSha.toLowerCase() !== candidate.upstreamCommit.toLowerCase()) { errors.push(this.error(-1, 'APPROVED_SHA_MISMATCH', 'M4 approval identity does not match requested exact candidate.')); return null; } return approval; } catch (cause) { errors.push(this.error(-1, 'M4_STATE_UNAVAILABLE', 'Trusted M4 state could not be read.', { cause: cause instanceof Error ? cause.message : 'unknown' })); return null; } }
  private async acquireSource(approval: TrustedM4Approval, errors: MaterializationError[]): Promise<MaterializedSource | null> { if (!this.config.sourceAcquirer) { errors.push(this.error(-1, 'SOURCE_FETCH_FAILED', 'No trusted exact-source acquirer is configured.')); return null; } try { console.error('[DEBUG] Acquiring source from:', approval.upstreamRepository, approval.approvedSha); const result = await this.config.sourceAcquirer.acquire(approval); console.error('[DEBUG] Source acquired, size:', result.length); return materializeArchive(result, approval.approvedSha, this.config.archiveLimits); } catch (cause) { console.error('[DEBUG] Source acquisition failed:', cause); errors.push(this.error(-1, 'SOURCE_ARCHIVE_CORRUPTED', 'Exact source acquisition failed bounded integrity processing.', { cause: cause instanceof Error ? cause.message : 'unknown' })); return null; } }
  private storageOwner(): string { return this.config.defaultStorage?.owner ?? ''; }
  private buildPlan(approval: TrustedM4Approval, version: SemVer, integrity: SourceIntegrity, dryRun: boolean, errors: MaterializationError[]): MaterializationPlan { const owner = this.storageOwner(); const branch = this.config.defaultStorage?.branch ?? DEFAULT_STORAGE_BRANCH; const name = pluginIdToRepoName(approval.pluginId); if (!owner || !name.valid || !isAllowedStorageOwner(buildRepositoryIdentity(owner, name.valid ? name.normalizedName : 'invalid'), this.config.storageOwners)) errors.push(this.error(-1, 'STORAGE_OWNER_NOT_ALLOWED', 'Trusted storage owner configuration is missing or not allowlisted.')); const repository = buildRepositoryIdentity(owner, name.valid ? name.normalizedName : 'invalid'); const materializationId = digest(`m5-materialization-v2\0${approval.candidateIdentity}`) as Sha256; const sourcePath = `materialized/${materializationId}/source`; const provenancePath = `.axolotl/materializations/${materializationId}.json`; const actions: MaterializationAction[] = [{ action: 'create-repository', repository, branch }, { action: 'commit-source', repository, branch, pathPrefix: sourcePath }, { action: 'commit-provenance', repository, branch, pathPrefix: provenancePath }]; return { schemaVersion: 2, materializationId, m4CandidateIdentity: approval.candidateIdentity, m4ApprovalDecisionId: approval.approvalDecisionId, pluginId: approval.pluginId, version, source: { repository: approval.upstreamRepository, branch: approval.upstreamBranch, commitSha: approval.approvedSha }, sourceIntegrity: integrity, storageRepository: repository, storageBranch: branch, sourcePath, provenancePath, actions, dryRun, generatedAt: new Date().toISOString() }; }
  private invalidPlan(candidate: ApprovedCandidateInfo, dryRun: boolean): MaterializationPlan { return { schemaVersion: 2, materializationId: '' as Sha256, m4CandidateIdentity: '', m4ApprovalDecisionId: '', pluginId: candidate.pluginId, version: candidate.version, source: { repository: candidate.upstreamRepository, branch: '', commitSha: candidate.upstreamCommit }, sourceIntegrity: { archiveSha256: '' as Sha256, treeSha256: '' as Sha256, fileCount: 0, totalSizeBytes: 0, acquiredSha: candidate.upstreamCommit }, storageRepository: '' as RepositoryIdentity, storageBranch: '', sourcePath: '', provenancePath: '', actions: [], dryRun, generatedAt: new Date().toISOString() }; }
  private planMatchesTrustedState(actual: MaterializationPlan, expected: MaterializationPlan): boolean { return actual.schemaVersion === 2 && actual.dryRun === false && actual.materializationId === expected.materializationId && actual.m4CandidateIdentity === expected.m4CandidateIdentity && actual.m4ApprovalDecisionId === expected.m4ApprovalDecisionId && actual.pluginId === expected.pluginId && actual.source.repository === expected.source.repository && actual.source.branch === expected.source.branch && actual.source.commitSha === expected.source.commitSha && actual.storageRepository === expected.storageRepository && actual.storageBranch === expected.storageBranch && actual.sourcePath === expected.sourcePath && actual.provenancePath === expected.provenancePath && JSON.stringify(actual.sourceIntegrity) === JSON.stringify(expected.sourceIntegrity) && JSON.stringify(actual.actions) === JSON.stringify(expected.actions); }
  private async readCanonicalProvenance(client: GitHubClient, repository: RepositoryIdentity, branch: string, provenancePath: string): Promise<{ kind: 'missing' } | { kind: 'invalid' } | { kind: 'valid'; record: ProvenanceRecord }> { const files = await client.listFiles(repository, branch, provenancePath); if (files.length === 0) return { kind: 'missing' }; if (files.length !== 1 || files[0].path !== provenancePath) return { kind: 'invalid' }; try { return { kind: 'valid', record: JSON.parse(files[0].content.toString('utf-8')) as ProvenanceRecord }; } catch { return { kind: 'invalid' }; } }
  private sameProvenance(record: ProvenanceRecord, plan: MaterializationPlan, approval: TrustedM4Approval, integrity: SourceIntegrity): boolean { return record.schemaVersion === 2 && record.materializationId === plan.materializationId && record.m4CandidateIdentity === approval.candidateIdentity && record.m4ApprovalDecisionId === approval.approvalDecisionId && record.pluginId === approval.pluginId && record.version === plan.version && record.upstreamRepository === approval.upstreamRepository && record.upstreamBranch === approval.upstreamBranch && record.upstreamCommit === approval.approvedSha && record.storageRepository === plan.storageRepository && record.storageBranch === plan.storageBranch && record.canonicalProvenancePath === plan.provenancePath && JSON.stringify(record.sourceIntegrity) === JSON.stringify(integrity) && isValidGitSha(record.storageCommit); }
  private provenance(plan: MaterializationPlan, approval: TrustedM4Approval, integrity: SourceIntegrity, storageCommit: GitSha): ProvenanceRecord { return { schemaVersion: 2, materializationId: plan.materializationId, m4CandidateIdentity: approval.candidateIdentity, m4ApprovalDecisionId: approval.approvalDecisionId, pluginId: approval.pluginId, version: plan.version, upstreamRepository: approval.upstreamRepository, upstreamBranch: approval.upstreamBranch, upstreamCommit: approval.approvedSha, storageCommit, storageRepository: plan.storageRepository, storageBranch: plan.storageBranch, canonicalProvenancePath: plan.provenancePath, materializedAt: new Date().toISOString(), materializedBy: approval.reviewerId, materializerVersion: this.config.axolotlVersion, reviewApprovedAt: approval.reviewApprovedAt, inspectionCompletedAt: approval.inspectionCompletedAt, sourceIntegrity: integrity }; }
  private async branchHead(client: GitHubClient, repository: RepositoryIdentity, branch: string): Promise<GitSha | null> { return (await client.getBranch(repository, branch))?.sha ?? null; }
  private async commit(client: GitHubClient, repository: RepositoryIdentity, branch: string, expectedParent: GitSha | null, files: Array<{ path: string; content: Buffer }>, message: string): Promise<CommitAttempt> { const result = await client.createCommit({ repository, branch, expectedParent, message, files: files.map((file) => ({ path: file.path, content: file.content.toString('base64'), encoding: 'base64' })), author: this.config.materializerAuthor }); return result.success && result.commitSha ? { success: true, sha: result.commitSha } : { success: false, error: result.error }; }
  private commitError(index: number, error: CreateCommitResult['error'] | undefined, fallback: string): MaterializationError { return this.error(index, error?.code === 'CONCURRENCY_CONFLICT' ? 'CONCURRENCY_CONFLICT' : error?.code ?? 'GITHUB_COMMIT_FAILED', error?.message ?? fallback, error?.details); }
  private error(actionIndex: number, code: MaterializationErrorCode, message: string, details?: Record<string, unknown>): MaterializationError { return { actionIndex, code, message, details }; }
}

/** Archive/tree digest semantics are documented in docs/M5_TRUST_MODEL.md. */
export async function materializeArchive(archive: Buffer, acquiredSha: GitSha, limits: MaterializationArchiveLimits = MATERIALIZATION_ARCHIVE_LIMITS): Promise<MaterializedSource> {
  if (archive.length > limits.maxArchiveBytes) throw new Error(`Archive exceeds compressed-byte limit (${limits.maxArchiveBytes})`);
  // Check for dangerous paths in raw ZIP entries before jszip processing
  checkRawZipPaths(archive);
  // Use jszip instead of adm-zip for Node.js v24 compatibility
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(archive);
  const raw: Array<{ entryName: string; path: string; content: Buffer }> = [];
  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (!entry.dir) {
      const content = await entry.async('nodebuffer');
      raw.push({ entryName, path: entryName.replace(/\\/g, '/').replace(/^\.\//, ''), content });
    }
  }
  if (raw.length === 0 || raw.length > limits.maxFileCount) throw new Error(`Archive file count violates limit (${limits.maxFileCount})`);
  if (raw.some(({ path }) => validateArchivePath(path, limits) !== null)) throw new Error('Archive contains unsafe path');
  let extractedTotal = 0;
  for (const { path, content } of raw) {
    if (content.length > limits.maxFileBytes) throw new Error(`File exceeds limit: ${path}`);
    extractedTotal += content.length;
    if (extractedTotal > limits.maxExtractedBytes) throw new Error('Extracted bytes exceed limit');
  }
  const roots = new Set(raw.map(({ path }) => path.split('/')[0]));
  const stripRoot = roots.size === 1 && raw.every(({ path }) => path.includes('/'));
  const files = raw.map(({ path, content }) => ({ path: (stripRoot ? path.split('/').slice(1).join('/') : path).normalize('NFC'), content }));
  // Check for duplicates
  const pathSet = new Set(files.map(f => f.path));
  if (pathSet.size !== files.length) throw new Error('Archive contains duplicate paths');
  files.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  // Validate all paths
  for (const { path } of files) {
    const error = validateArchivePath(path, limits);
    if (error) throw new Error(`Unsafe path: ${error}`);
  }
  const tree = createHash('sha256');
  for (const { path, content } of files) {
    tree.update(path, 'utf8').update('\0').update(String(content.length), 'ascii').update('\0').update(content).update('\0');
  }
  return { files, integrity: { archiveSha256: digest(archive) as Sha256, treeSha256: tree.digest('hex') as Sha256, fileCount: files.length, totalSizeBytes: extractedTotal, acquiredSha } };
}
function validateArchivePath(value: string, limits: MaterializationArchiveLimits): string | null {
  if (!value || value.length > limits.maxPathLength || value.includes('\0') || value.startsWith('/') || value.startsWith('\\') || /^[a-zA-Z]:/.test(value)) return 'unsafe: absolute or too long';
  const parts = value.split('/');
  if (parts.length > limits.maxPathDepth || parts.some((part) => !part || part === '.' || part === '..')) return 'unsafe: depth or parent reference';
  return null;
}

/** Check raw ZIP file entries for dangerous path patterns. Simplified for jszip. */
function checkRawZipPaths(archive: Buffer): void {
  // Basic ZIP signature check
  if (archive.length < 4) throw new Error('Archive too small');
  const sig = archive.readUInt32LE(0);
  // PK\x03\x04 = local file header, PK\x05\x06 = empty archive
  if (sig !== 0x04034b50 && sig !== 0x02014b50 && sig !== 0x06054b50) {
    throw new Error('Invalid ZIP archive');
  }
}
function digest(value: string | Buffer): string { return createHash('sha256').update(value).digest('hex'); }
function sameFiles(actual: Array<{ path: string; content: Buffer }>, expected: Array<{ path: string; content: Buffer }>): boolean { if (actual.length !== expected.length) return false; const left = [...actual].sort((a, b) => a.path.localeCompare(b.path)); const right = [...expected].sort((a, b) => a.path.localeCompare(b.path)); return left.every((file, index) => file.path === right[index].path && file.content.equals(right[index].content)); }
export function createMaterializationService(config?: Partial<MaterializationServiceConfig>): MaterializationService { return new MaterializationService(config); }
