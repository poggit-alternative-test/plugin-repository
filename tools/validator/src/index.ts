/**
 * Axolotl Plugin Repository - Validator
 *
 * Validation tools for plugin submissions.
 *
 * SECURITY NOTE:
 * These tools process UNTRUSTED input from plugin developers.
 * All input must be validated and sanitized before use.
 */

import { z } from 'zod';

// ============================================================
// Plugin.yml Schema
// ============================================================

export const PluginYmlSchema = z.object({
  name: z.string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid plugin name format'),
  version: z.string()
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/, 'Invalid version format (use semver)'),
  api: z.array(z.string().regex(/^\d+\.\d+\.\d+$/)),
  main: z.string()
    .min(1)
    .regex(/^[A-Za-z_][A-Za-z0-9_\\]*$/, 'Invalid main class path'),
  author: z.string().optional(),
  authors: z.array(z.string()).optional(),
  description: z.string().optional(),
  website: z.string().url().optional(),
  prefix: z.string().optional(),
  commands: z.record(z.any()).optional(),
  permissions: z.record(z.any()).optional(),
  dependencies: z.record(z.any()).optional(),
  load: z.string().optional(),
  php: z.string().optional(),
  extensions: z.array(z.string()).optional(),
  mainFile: z.string().optional(),
  creationDate: z.number().optional(),
});

export type PluginYml = z.infer<typeof PluginYmlSchema>;

// ============================================================
// Validation Result Types
// ============================================================

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  metadata?: PluginYml;
}

// ============================================================
// Security Pattern Detection
// ============================================================

export interface SecurityPattern {
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  requiresHumanReview: boolean;
}

export const DANGEROUS_PATTERNS: SecurityPattern[] = [
  {
    pattern: /\beval\s*\(/,
    severity: 'critical',
    description: 'Dynamic code execution detected',
    requiresHumanReview: true,
  },
  {
    pattern: /\bassert\s*\(/,
    severity: 'high',
    description: 'Assertion with dynamic code',
    requiresHumanReview: true,
  },
  {
    pattern: /base64_decode\s*\(/,
    severity: 'high',
    description: 'Base64 decoding (possible obfuscation)',
    requiresHumanReview: true,
  },
  {
    pattern: /base64_encode\s*\(/,
    severity: 'low',
    description: 'Base64 encoding',
    requiresHumanReview: false,
  },
  {
    pattern: /\bsystem\s*\(/,
    severity: 'critical',
    description: 'Shell command execution via system()',
    requiresHumanReview: true,
  },
  {
    pattern: /\bexec\s*\(/,
    severity: 'high',
    description: 'Shell command execution via exec()',
    requiresHumanReview: true,
  },
  {
    pattern: /\bshell_exec\s*\(/,
    severity: 'critical',
    description: 'Shell command execution via shell_exec()',
    requiresHumanReview: true,
  },
  {
    pattern: /\bpassthru\s*\(/,
    severity: 'high',
    description: 'Shell command execution via passthru()',
    requiresHumanReview: true,
  },
  {
    pattern: /\bproc_open\s*\(/,
    severity: 'high',
    description: 'Process creation',
    requiresHumanReview: true,
  },
  {
    pattern: /\bpfsockopen\s*\(/,
    severity: 'medium',
    description: 'Raw socket connection',
    requiresHumanReview: true,
  },
  {
    pattern: /\bstream_socket_client\s*\(/,
    severity: 'medium',
    description: 'Network socket connection',
    requiresHumanReview: true,
  },
  {
    pattern: /\bgzinflate\s*\(/,
    severity: 'high',
    description: 'Compressed data decompression',
    requiresHumanReview: true,
  },
  {
    pattern: /\bgzuncompress\s*\(/,
    severity: 'medium',
    description: 'Zlib decompression',
    requiresHumanReview: true,
  },
];

/**
 * IMPORTANT: Pattern matches do NOT automatically reject plugins.
 * All matches are flagged for HUMAN review.
 * Many patterns have legitimate uses.
 */

// ============================================================
// Validator Functions
// ============================================================

/**
 * Validate plugin.yml content
 *
 * SECURITY: Input is untrusted developer content.
 * All parsing errors should be caught and reported.
 */
export function validatePluginYml(content: string): ValidationResult {
  const issues: ValidationIssue[] = [];

  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch (error) {
    return {
      valid: false,
      issues: [{
        severity: 'error',
        code: 'INVALID_YAML',
        message: `YAML parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    };
  }

  const result = PluginYmlSchema.safeParse(parsed);

  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push({
        severity: 'error',
        code: 'SCHEMA_VALIDATION',
        message: `${issue.path.join('.')}: ${issue.message}`,
      });
    }
    return { valid: false, issues };
  }

  return {
    valid: true,
    issues: [],
    warnings: [],
    metadata: result.data,
  };
}

/**
 * Scan PHP code for security patterns
 *
 * SECURITY: Input is untrusted developer code.
 * All matches are reported, not automatically rejected.
 */
export function scanSecurityPatterns(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const pattern of DANGEROUS_PATTERNS) {
    const matches = code.match(pattern.pattern);
    if (matches) {
      issues.push({
        severity: pattern.severity === 'critical' ? 'error' :
                  pattern.severity === 'high' ? 'error' :
                  pattern.severity === 'medium' ? 'warning' : 'info',
        code: 'SECURITY_PATTERN',
        message: pattern.description,
      });
    }
  }

  return issues;
}

/**
 * Validate repository URL format
 *
 * SECURITY: Input is untrusted developer input.
 * Only accept valid GitHub repository formats.
 */
export function validateRepositoryUrl(url: string): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Only allow GitHub URLs
  const githubPattern = /^https:\/\/github\.com\/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9._-]+\/?$/;

  if (!githubPattern.test(url)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_REPOSITORY_URL',
      message: 'Repository URL must be a public GitHub repository',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate plugin name for filesystem safety
 *
 * SECURITY: Input becomes part of file paths.
 * Must prevent path traversal attacks.
 */
export function validatePluginName(name: string): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Prevent path traversal
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    issues.push({
      severity: 'error',
      code: 'PATH_TRAVERSAL',
      message: 'Plugin name cannot contain path separators',
    });
  }

  // Prevent special characters that could cause issues
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_NAME',
      message: 'Plugin name can only contain letters, numbers, underscores, and hyphens',
    });
  }

  // Reserved names
  const reserved = ['.', '..', 'CON', 'PRN', 'AUX', 'NUL'];
  if (reserved.includes(name.toUpperCase())) {
    issues.push({
      severity: 'error',
      code: 'RESERVED_NAME',
      message: 'This name is reserved by the operating system',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// Placeholder YAML parser (use real library in implementation)
const YAML = {
  parse: (content: string) => {
    // TODO: Use yaml package
    throw new Error('YAML parser not implemented - use @yaml package');
  },
};
