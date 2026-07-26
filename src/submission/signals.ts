/**
 * Review Signals
 *
 * Static analysis signals for human review prioritization.
 * NOT automatic malware detection - signals are prioritization aids.
 *
 * SECURITY: These signals are heuristics only. A plugin with no signals
 * may still be malicious. A plugin with signals may be legitimate.
 */

import {
  SUBMISSION_CODES,
  reviewSignal,
  type SubmissionDiagnostic,
  type SubmissionDiagnosticCode,
} from './diagnostics.js';

// ============================================================
// Signal Definitions
// ============================================================

export interface ReviewSignal {
  category: SignalCategory;
  severity: SignalSeverity;
  message: string;
  file?: string;
  location?: {
    line?: number;
    column?: number;
  };
  evidence?: string;
}

export enum SignalCategory {
  NETWORK = 'network',
  PROCESS_EXECUTION = 'process_execution',
  FILESYSTEM_SENSITIVE = 'filesystem_sensitive',
  CODE_EXECUTION = 'code_execution',
  OBFUSCATION = 'obfuscation',
  COMPOSER = 'composer',
  BINARY = 'binary',
  ARCHIVE = 'archive',
}

export enum SignalSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

// ============================================================
// Pattern Definitions
// ============================================================

interface SignalPattern {
  category: SignalCategory;
  severity: SignalSeverity;
  patterns: RegExp[];
  message: string;
}

const SIGNALS: SignalPattern[] = [
  // Network APIs
  {
    category: SignalCategory.NETWORK,
    severity: SignalSeverity.MEDIUM,
    patterns: [
      /\bfsockopen\b/,
      /\bfsockopen\s*\(/,
      /\bpfsockopen\b/,
      /\bstream_socket_client\b/,
      /\bstream_socket_server\b/,
      /\bcurl_exec\b/,
      /\bcurl_setopt\b/,
      /\bfile_get_contents\s*\(\s*['"]https?:\/\//,
      /\bfile_get_contents\s*\(\s*\$_(GET|POST|REQUEST)/,
      /\bHttpRequest\b/,
      /\bGuzzleHttp\b/,
      /\bSymfony\\Component\\HttpClient\b/,
      /\bsocket_create\b/,
    ],
    message: 'Network API usage detected',
  },

  // Process Execution
  {
    category: SignalCategory.PROCESS_EXECUTION,
    severity: SignalSeverity.HIGH,
    patterns: [
      /\bexec\s*\(/,
      /\bpassthru\s*\(/,
      /\bsystem\s*\(/,
      /\bshell_exec\s*\(/,
      /\b`[^`]+`/,
      /\bpopen\s*\(/,
      /\bproc_open\s*\(/,
      /\bproc_close\s*\(/,
      /\bpcntl_exec\b/,
      /\bposix_kill\b/,
      /\bproc_get_status\b/,
      /\bescapeshellcmd\b/,
      /\bescapeshellarg\b/,
      /\bmail\s*\(.*[,;].*(?:Subject|Headers)/i,
    ],
    message: 'Process execution API usage detected',
  },

  // Dynamic Code Execution
  {
    category: SignalCategory.CODE_EXECUTION,
    severity: SignalSeverity.HIGH,
    patterns: [
      /\beval\s*\(/,
      /\bassert\s*\(/,
      /\bcreate_function\b/,
      /\bfunction_exists\s*\(\s*['"]/,
      /\bcall_user_func\b/,
      /\bcall_user_func_array\b/,
      /\bpreg_replace_callback\b/,
      /\bpreg_replace\b.*\/e\b/,
      /\bmb_parse_str\s*\(/,
      /\bparse_str\s*\(/,
      /\bextract\s*\(\s*\$_/,
      /\bparse_ini_file\b/,
    ],
    message: 'Dynamic code execution patterns detected',
  },

  // Sensitive Filesystem Operations
  {
    category: SignalCategory.FILESYSTEM_SENSITIVE,
    severity: SignalSeverity.MEDIUM,
    patterns: [
      /\bchmod\s*\(\s*0{3,4}/,
      /\bchmod\s*\(\s*7{3,4}/,
      /\bchown\b/,
      /\bchgrp\b/,
      /\bunlink\s*\(\s*['"]\/etc\//,
      /\brmdir\s*\(\s*['"]\/etc\//,
      /\bfile_put_contents\s*\(\s*['"]\/etc\//,
      /\bfile_put_contents\s*\(\s*['"]\/var\//,
      /\bfile_put_contents\s*\(\s*['"]\/tmp\//,
      /\bfile_put_contents\s*\(\s*\$_(GET|POST|REQUEST)/,
      /\bmove_uploaded_file\b/,
      /\bcopy\b.*\$_/,
    ],
    message: 'Sensitive filesystem operations detected',
  },

  // Obfuscation Indicators
  {
    category: SignalCategory.OBFUSCATION,
    severity: SignalSeverity.MEDIUM,
    patterns: [
      /\bbase64_decode\s*\(\s*['"][A-Za-z0-9+\/=]{50,}/,
      /\bstr_rot13\s*\(/,
      /\burldecode\s*\(/,
      /\bgzinflate\s*\(/,
      /\bgzuncompress\s*\(/,
      /\bstrrev\s*\(/,
      /\bchr\s*\(\s*\d+\s*\)\s*\.\s*chr/i,
      /\bchr\s*\(\s*\d+\s*\)\s*\$/,
      /\b\\x[0-9a-f]{2}/i,
      /eval\s*\(\s*\$(?:l|l10n|opt|cfg)/i,
      /\$_SERVER\s*\[\s*['"]HTTP_/,
      /\$_SERVER\s*\[\s*['"]argv/,
    ],
    message: 'Code obfuscation patterns detected',
  },

  // Archive Files
  {
    category: SignalCategory.ARCHIVE,
    severity: SignalSeverity.LOW,
    patterns: [
      /\.zip\s*$/,
      /\.tar\s*$/,
      /\.tar\.gz\s*$/,
      /\.tgz\s*$/,
      /\.rar\s*$/,
      /\.7z\s*$/,
    ],
    message: 'Archive files present in repository',
  },

  // Binary Files
  {
    category: SignalCategory.BINARY,
    severity: SignalSeverity.MEDIUM,
    patterns: [
      /\.dll\s*$/,
      /\.so\s*$/,
      /\.dylib\s*$/,
      /\.exe\s*$/,
      /\.bin\s*$/,
      /\.dat\s*$/,
      /\.pak\s*$/,
      /\.blob\s*$/,
    ],
    message: 'Binary files detected',
  },

  // Native Libraries
  {
    category: SignalCategory.BINARY,
    severity: SignalSeverity.MEDIUM,
    patterns: [
      /\.a\s*$/,
      /\.o\s*$/,
      /\.obj\s*$/,
      /\.lib\s*$/,
      /\.wasm\s*$/,
      /\.dylib\s*$/,
    ],
    message: 'Native library files detected',
  },
];

// ============================================================
// Signal Generator
// ============================================================

export interface FileSignalResult {
  signals: ReviewSignal[];
  diagnostics: SubmissionDiagnostic[];
}

/**
 * Analyze a PHP file for review signals.
 *
 * @param content PHP file content
 * @param filePath Path to the file (for context)
 * @returns Generated signals and diagnostics
 */
export function analyzePhpFile(content: string, filePath?: string): FileSignalResult {
  const signals: ReviewSignal[] = [];
  const diagnostics: SubmissionDiagnostic[] = [];

  const lines = content.split(/\r?\n/);

  for (const signalDef of SIGNALS) {
    for (const pattern of signalDef.patterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split(/\r?\n/).length;

        // Get evidence (surrounding context)
        const evidence = getEvidence(content, match.index, pattern);

        const signal: ReviewSignal = {
          category: signalDef.category,
          severity: signalDef.severity,
          message: signalDef.message,
          file: filePath,
          location: { line: lineNumber },
          evidence,
        };

        signals.push(signal);

        // Add as diagnostic
        diagnostics.push(
          reviewSignal(
            mapCategoryToCode(signalDef.category),
            `${signalDef.message} in ${filePath || 'unknown'}:`,
            {
              file: filePath,
              context: {
                category: signalDef.category,
                severity: signalDef.severity,
                line: lineNumber,
                evidence,
              },
            }
          )
        );

        // Avoid too many matches from the same pattern
        if (signals.filter((s) => s.category === signalDef.category).length > 20) {
          break;
        }
      }

      // Limit total signals per file
      if (signals.length > 50) {
        break;
      }
    }
  }

  return { signals, diagnostics };
}

/**
 * Check for PHAR files committed to repository.
 */
export function checkForCommittedPhar(files: string[]): SubmissionDiagnostic[] {
  const diagnostics: SubmissionDiagnostic[] = [];
  const pharFiles = files.filter((f) => f.toLowerCase().endsWith('.phar'));

  for (const file of pharFiles) {
    diagnostics.push(
      reviewSignal(
        SUBMISSION_CODES.REVIEW_SIGNAL_PHAR_COMMITTED,
        `PHAR file committed to repository: ${file}`,
        { file }
      )
    );
  }

  return diagnostics;
}

/**
 * Check for large encoded blobs.
 */
export function checkForLargeEncodedBlobs(
  content: string,
  filePath?: string
): SubmissionDiagnostic[] {
  const diagnostics: SubmissionDiagnostic[] = [];

  // Check for large base64 strings (potential data exfiltration)
  const base64Pattern = /['"]([A-Za-z0-9+\/]{5000,}=*)['"]/g;
  let match;

  while ((match = base64Pattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split(/\r?\n/).length;

    diagnostics.push(
      reviewSignal(
        SUBMISSION_CODES.REVIEW_SIGNAL_LARGE_ENCODED_BLOB,
        `Large encoded string detected (${match[1].length} chars) at line ${lineNumber}`,
        {
          file: filePath,
          context: {
            length: match[1].length,
            line: lineNumber,
          },
        }
      )
    );
  }

  return diagnostics;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get evidence string around a match.
 */
function getEvidence(content: string, index: number, pattern: RegExp): string {
  const contextStart = Math.max(0, index - 40);
  const contextEnd = Math.min(content.length, index + 80);

  let evidence = content.substring(contextStart, contextEnd);
  if (contextStart > 0) {
    evidence = '...' + evidence;
  }
  if (contextEnd < content.length) {
    evidence = evidence + '...';
  }

  return evidence.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Map signal category to diagnostic code.
 */
function mapCategoryToCode(category: SignalCategory): SubmissionDiagnosticCode {
  switch (category) {
    case SignalCategory.NETWORK:
      return SUBMISSION_CODES.REVIEW_SIGNAL_NETWORK_API;
    case SignalCategory.PROCESS_EXECUTION:
      return SUBMISSION_CODES.REVIEW_SIGNAL_PROCESS_EXECUTION;
    case SignalCategory.CODE_EXECUTION:
      return SUBMISSION_CODES.REVIEW_SIGNAL_EVAL_EXEC;
    case SignalCategory.FILESYSTEM_SENSITIVE:
      return SUBMISSION_CODES.REVIEW_SIGNAL_FILESYSTEM_SENSITIVE;
    case SignalCategory.OBFUSCATION:
      return SUBMISSION_CODES.REVIEW_SIGNAL_OBFUSCATION;
    case SignalCategory.COMPOSER:
      return SUBMISSION_CODES.REVIEW_SIGNAL_COMPOSER_SCRIPT;
    case SignalCategory.BINARY:
      return SUBMISSION_CODES.REVIEW_SIGNAL_BUNDLED_BINARY;
    case SignalCategory.ARCHIVE:
      return SUBMISSION_CODES.REVIEW_SIGNAL_BUNDLED_BINARY;
    default:
      return SUBMISSION_CODES.REVIEW_SIGNAL_NETWORK_API;
  }
}

/**
 * Aggregate signals from multiple files.
 */
export function aggregateSignals(results: FileSignalResult[]): {
  signals: ReviewSignal[];
  diagnostics: SubmissionDiagnostic[];
} {
  const allSignals: ReviewSignal[] = [];
  const allDiagnostics: SubmissionDiagnostic[] = [];

  for (const result of results) {
    allSignals.push(...result.signals);
    allDiagnostics.push(...result.diagnostics);
  }

  // Deduplicate similar signals
  const uniqueDiagnostics = deduplicateDiagnostics(allDiagnostics);

  return {
    signals: allSignals,
    diagnostics: uniqueDiagnostics,
  };
}

/**
 * Deduplicate similar diagnostics.
 */
function deduplicateDiagnostics(
  diagnostics: SubmissionDiagnostic[]
): SubmissionDiagnostic[] {
  const seen = new Set<string>();
  const unique: SubmissionDiagnostic[] = [];

  for (const diag of diagnostics) {
    const key = `${diag.code}:${diag.file || ''}:${diag.context?.category || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(diag);
    }
  }

  return unique;
}
