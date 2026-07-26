/**
 * Composer Metadata Parser
 *
 * Statically inspects composer.json for review signals.
 * NO execution of composer or scripts.
 */

import { z } from 'zod';
import {
  SUBMISSION_CODES,
  submissionWarning,
  reviewSignal,
  type SubmissionDiagnostic,
} from './diagnostics.js';

// ============================================================
// Resource Limits
// ============================================================

export const COMPOSER_JSON_MAX_SIZE = 64 * 1024; // 64 KB

// ============================================================
// Composer JSON Schema
// ============================================================

const ComposerSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  type: z.string().optional(),
  license: z.union([z.string(), z.array(z.string())]).optional(),
  require: z.record(z.string()).optional(),
  'require-dev': z.record(z.string()).optional(),
  autoload: z.record(z.unknown()).optional(),
  'autoload-dev': z.record(z.unknown()).optional(),
  scripts: z.record(z.union([z.string(), z.array(z.string())])).optional(),
  extra: z.record(z.unknown()).optional(),
  repositories: z.array(z.record(z.unknown())).optional(),
  'minimum-stability': z.string().optional(),
  config: z.record(z.unknown()).optional(),
  'composer-exposer': z.record(z.string()).optional(),
});

// ============================================================
// Parsed Composer Metadata
// ============================================================

export interface ParsedComposerMetadata {
  name?: string;
  description?: string;
  version?: string;
  type?: string;
  license?: string | string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  autoload: Record<string, unknown>;
  scripts: Record<string, string | string[]>;
  hasComposerPlugins: boolean;
  hasComposerScripts: boolean;
}

export interface ComposerParseResult {
  present: boolean;
  success: boolean;
  metadata?: ParsedComposerMetadata;
  diagnostics: SubmissionDiagnostic[];
}

// ============================================================
// Parser Implementation
// ============================================================

/**
 * Parse composer.json content safely.
 *
 * @param content Raw composer.json content
 * @param sourcePath Source path for diagnostics
 * @returns Parsed metadata or diagnostics
 */
export function parseComposerJson(
  content: string,
  sourcePath?: string
): ComposerParseResult {
  const diagnostics: SubmissionDiagnostic[] = [];

  // Check if file is present
  if (!content || content.trim() === '') {
    return { present: false, success: false, diagnostics: [] };
  }

  // Size check
  if (content.length > COMPOSER_JSON_MAX_SIZE) {
    diagnostics.push(
      submissionWarning(
        SUBMISSION_CODES.COMPOSER_JSON_TOO_LARGE,
        `composer.json exceeds maximum size of ${COMPOSER_JSON_MAX_SIZE} bytes`,
        { file: sourcePath, context: { size: content.length } }
      )
    );
    // Still try to parse if possible
  }

  // Parse JSON safely
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (e) {
    diagnostics.push(
      submissionWarning(
        SUBMISSION_CODES.COMPOSER_JSON_INVALID,
        `Failed to parse composer.json: ${e instanceof Error ? e.message : 'Unknown error'}`,
        { file: sourcePath }
      )
    );
    return { present: true, success: false, diagnostics };
  }

  // Validate structure
  if (typeof data !== 'object' || data === null) {
    diagnostics.push(
      submissionWarning(
        SUBMISSION_CODES.COMPOSER_JSON_INVALID,
        'composer.json must be a JSON object',
        { file: sourcePath }
      )
    );
    return { present: true, success: false, diagnostics };
  }

  // Validate with Zod
  const parseResult = ComposerSchema.safeParse(data);
  if (!parseResult.success) {
    // Log warnings but continue with what we have
    for (const issue of parseResult.error.issues) {
      const path = issue.path.join('.');
      diagnostics.push(
        submissionWarning(
          SUBMISSION_CODES.COMPOSER_JSON_INVALID,
          `composer.json: ${path ? path + ': ' : ''}${issue.message}`,
          { file: sourcePath, field: path || undefined }
        )
      );
    }
  }

  // Parse scripts and plugins
  const metadata = parseResult.success ? parseResult.data : {};
  const scripts = metadata.scripts || {};
  const extra = metadata.extra || {};
  const config = metadata.config || {};

  // Detect composer plugins
  const hasComposerPlugins = detectComposerPlugins(extra, config);

  // Detect scripts
  const hasComposerScripts = Object.keys(scripts).length > 0;
  if (hasComposerScripts) {
    diagnostics.push(
      reviewSignal(
        SUBMISSION_CODES.REVIEW_SIGNAL_COMPOSER_SCRIPT,
        'Composer scripts detected - manual review recommended',
        { file: sourcePath, context: { scripts: Object.keys(scripts) } }
      )
    );
  }

  // Detect dangerous patterns in scripts
  const dangerousScripts = detectDangerousScripts(scripts);
  for (const danger of dangerousScripts) {
    diagnostics.push(
      reviewSignal(
        SUBMISSION_CODES.REVIEW_SIGNAL_PROCESS_EXECUTION,
        `Potentially dangerous composer script: ${danger}`,
        { file: sourcePath, context: { script: danger } }
      )
    );
  }

  // Check for composer plugins (these can execute code)
  if (hasComposerPlugins) {
    diagnostics.push(
      reviewSignal(
        SUBMISSION_CODES.REVIEW_SIGNAL_COMPOSER_PLUGIN,
        'Composer plugins detected - these can execute code during composer operations',
        { file: sourcePath }
      )
    );
  }

  return {
    present: true,
    success: true,
    metadata: {
      name: metadata.name,
      description: metadata.description,
      version: metadata.version,
      type: metadata.type,
      license: metadata.license,
      dependencies: metadata.require || {},
      devDependencies: metadata['require-dev'] || {},
      autoload: metadata.autoload || {},
      scripts,
      hasComposerPlugins,
      hasComposerScripts,
    },
    diagnostics,
  };
}

// ============================================================
// Composer Plugin Detection
// ============================================================

/**
 * Detect composer plugins in extra or config.
 */
function detectComposerPlugins(
  extra: Record<string, unknown>,
  config: Record<string, unknown>
): boolean {
  // Check for known composer plugin packages in requirements
  // This is a simplified check - real detection would parse the whole require list
  // For now, we flag the presence of composer plugins configuration

  if (extra && typeof extra === 'object') {
    const extraObj = extra as Record<string, unknown>;
    if (extraObj['composer-plugin'] || extraObj['composer-runtime-api-php']) {
      return true;
    }
  }

  if (config && typeof config === 'object') {
    const configObj = config as Record<string, unknown>;
    if (configObj['allow-plugins'] && Object.keys(configObj['allow-plugins'] as object).length > 0) {
      return true;
    }
  }

  return false;
}

// ============================================================
// Dangerous Script Detection
// ============================================================

const DANGEROUS_SCRIPT_PATTERNS = [
  /^rm\s/,
  /^del\s/,
  /^rmdir\s/,
  /^unlink\s/,
  /^mv\s/,
  /^curl\s/,
  /^wget\s/,
  /^nc\s/,
  /^bash\s/,
  /^sh\s/,
  /^cmd\s/,
  /^powershell\s/,
  /^python\s/,
  /^php\s+eval/,
  /^eval\s/,
  /\|\s*sh/,
  /\$\(/,
  /`.*`/,
  /\b(chmod|chown|chgrp)\s+777\b/,
  /\bwget\b.*\|\s*sh/,
  /\bcurl\b.*\|\s*sh/,
  /\bsudo\s/,
  /www-data/,
  /nohup\s+.*\s+>/,
];

/**
 * Detect potentially dangerous script patterns.
 */
function detectDangerousScripts(
  scripts: Record<string, string | string[]>
): string[] {
  const dangerous: string[] = [];

  for (const [name, content] of Object.entries(scripts)) {
    const scriptContent = Array.isArray(content) ? content.join(' ') : content;

    for (const pattern of DANGEROUS_SCRIPT_PATTERNS) {
      if (pattern.test(scriptContent)) {
        dangerous.push(name);
        break;
      }
    }
  }

  return dangerous;
}

// ============================================================
// Analysis Functions
// ============================================================

/**
 * Check if repository is a WordPress plugin (not relevant for PocketMine but flagged).
 */
export function isWordPressPlugin(composer: ParsedComposerMetadata): boolean {
  if (composer.type === 'wordpress-plugin') {
    return true;
  }
  // Check for WordPress in description or dependencies
  const desc = composer.description?.toLowerCase() || '';
  if (desc.includes('wordpress') || desc.includes('wp ')) {
    return true;
  }
  return false;
}

/**
 * Check for network-related dependencies.
 */
export function hasNetworkDependencies(composer: ParsedComposerMetadata): boolean {
  const networkPackages = [
    'guzzlehttp',
    'requests',
    'symfony/http-client',
    'php-http/client-common',
    'ramsey/http',
    'composer/ca-bundle',
  ];

  const allDeps = { ...composer.dependencies, ...composer.devDependencies };

  for (const pkg of networkPackages) {
    // Check for exact match or package-name/... format
    if (pkg in allDeps || Object.keys(allDeps).some((dep) => dep.startsWith(pkg + '/'))) {
      return true;
    }
  }

  return false;
}

/**
 * Get autoload type.
 */
export function getAutoloadType(autoload: Record<string, unknown>): string {
  if (autoload['psr-4']) return 'psr-4';
  if (autoload['psr-0']) return 'psr-0';
  if (autoload['classmap']) return 'classmap';
  if (autoload['files']) return 'files';
  return 'unknown';
}
