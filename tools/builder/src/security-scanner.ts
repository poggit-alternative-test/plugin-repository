/**
 * Build Security Scanner
 *
 * Scans plugin source for security-relevant patterns in PHP files.
 * Informational only - signals are for review, not automatic rejection.
 *
 * SECURITY: This scanner is a heuristic tool. It cannot prove code is safe
 * or malicious. All signals require human interpretation.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';
import type { BuildSecuritySignal } from './types.js';
import {
  BUILD_WARNING_CODES,
  SecuritySignalType as SignalType,
  SecuritySignalSeverity as SignalSeverity,
  buildWarning,
} from './types.js';

// ============================================================
// Resource Limits
// ============================================================

export const SCANNER_MAX_FILES = 100;
export const SCANNER_MAX_FILE_SIZE = 512 * 1024; // 512 KB per file
export const SCANNER_MAX_SIGNALS_PER_FILE = 50;
export const SCANNER_MAX_SIGNALS_TOTAL = 200;

// ============================================================
// Scanner Result Types
// ============================================================

export interface SecurityScanResult {
  /** Total files scanned */
  filesScanned: number;
  /** Total signals found */
  signalCount: number;
  /** All detected signals */
  signals: BuildSecuritySignal[];
  /** Diagnostics from scanning */
  diagnostics: ReturnType<typeof buildWarning>[];
  /** Whether scan was truncated due to limits */
  truncated: boolean;
}

// ============================================================
// Signal Pattern Definitions
// ============================================================

interface SignalPattern {
  type: SecuritySignalType;
  severity: SecuritySignalSeverity;
  patterns: RegExp[];
  message: string;
}

const SIGNALS: SignalPattern[] = [
  // CRITICAL: Dangerous function calls
  {
    type: SignalType.DANGEROUS_FUNCTION,
    severity: SignalSeverity.HIGH,
    patterns: [/\beval\s*\(/, /\bassert\s*\(/],
    message: 'Dangerous code execution function detected',
  },
  {
    type: SignalType.SYSTEM_EXECUTION,
    severity: SignalSeverity.CRITICAL,
    patterns: [
      /\bexec\s*\(/,
      /\bpassthru\s*\(/,
      /\bsystem\s*\(/,
      /\bshell_exec\s*\(/,
      /`[^`]+`/,
      /\bpopen\s*\(/,
      /\bproc_open\s*\(/,
    ],
    message: 'System command execution detected',
  },
  {
    type: SignalType.BASE64_CONTENT,
    severity: SignalSeverity.MEDIUM,
    patterns: [/\bbase64_decode\s*\(\s*['"][A-Za-z0-9+\/=]{50,}/],
    message: 'Large base64-encoded content detected',
  },
  // PATH_ESCAPE
  {
    type: SignalType.PATH_ESCAPE,
    severity: SignalSeverity.MEDIUM,
    patterns: [
      /\bfile_put_contents\s*\(\s*['"]\/etc\//,
      /\bfile_put_contents\s*\(\s*['"]\/var\//,
      /\bfile_put_contents\s*\(\s*['"]\/root\//,
      /\bfile_put_contents\s*\(\s*\$_(GET|POST|REQUEST)/,
    ],
    message: 'Sensitive filesystem operation detected',
  },
  // EXTERNAL_NETWORK
  {
    type: SignalType.EXTERNAL_NETWORK,
    severity: SignalSeverity.MEDIUM,
    patterns: [
      /\bfsockopen\s*\(/,
      /\bpfsockopen\s*\(/,
      /\bstream_socket_client\s*\(/,
      /\bcurl_exec\s*\(/,
      /\bcurl_setopt\s*\(/,
      /\bfile_get_contents\s*\(\s*['"]https?:\/\//,
      /\bfile_get_contents\s*\(\s*\$_(GET|POST|REQUEST)/,
    ],
    message: 'Network API usage detected',
  },
  // OBFUSCATION
  {
    type: SignalType.OBFUSCATION,
    severity: SignalSeverity.HIGH,
    patterns: [
      /\bstr_rot13\s*\(/,
      /\burgzinflate\s*\(/,
      /\bstrrev\s*\(/,
      /\\x[0-9a-f]{2}/i,
    ],
    message: 'Code obfuscation patterns detected',
  },
];

// ============================================================
// Main Scanner Function
// ============================================================

/**
 * Scan a directory for security-relevant patterns in PHP files.
 *
 * @param sourcePath Path to scan
 * @param options Scanner options
 * @returns Security scan result
 */
export function scanForSecuritySignals(
  sourcePath: string,
  options?: {
    maxFiles?: number;
    maxFileSize?: number;
    maxSignalsPerFile?: number;
    maxSignalsTotal?: number;
  }
): SecurityScanResult {
  const maxFiles = options?.maxFiles ?? SCANNER_MAX_FILES;
  const maxFileSize = options?.maxFileSize ?? SCANNER_MAX_FILE_SIZE;
  const maxSignalsPerFile = options?.maxSignalsPerFile ?? SCANNER_MAX_SIGNALS_PER_FILE;
  const maxSignalsTotal = options?.maxSignalsTotal ?? SCANNER_MAX_SIGNALS_TOTAL;

  const signals: BuildSecuritySignal[] = [];
  const diagnostics: ReturnType<typeof buildWarning>[] = [];
  let filesScanned = 0;
  let truncated = false;

  if (!existsSync(sourcePath)) {
    diagnostics.push(buildWarning(BUILD_WARNING_CODES.SOURCE_NOT_FOUND, `Source path does not exist: ${sourcePath}`));
    return { filesScanned: 0, signalCount: 0, signals: [], diagnostics, truncated: false };
  }

  // Collect PHP files recursively
  const phpFiles = collectPhpFiles(sourcePath, sourcePath, maxFiles);
  filesScanned = phpFiles.length;

  for (const phpFile of phpFiles) {
    if (truncated) break;

    const fileSignals = scanPhpFile(phpFile, sourcePath, maxFileSize, maxSignalsPerFile, maxSignalsTotal - signals.length);
    signals.push(...fileSignals.signals);
    diagnostics.push(...fileSignals.diagnostics);
    if (signals.length >= maxSignalsTotal) {
      truncated = true;
      break;
    }
  }

  return {
    filesScanned,
    signalCount: signals.length,
    signals,
    diagnostics,
    truncated,
  };
}

/**
 * Scan a single PHP file for security signals.
 */
function scanPhpFile(
  filePath: string,
  basePath: string,
  maxFileSize: number,
  _maxSignalsPerFile: number,
  _remainingSignalsBudget: number
): { signals: BuildSecuritySignal[]; diagnostics: ReturnType<typeof buildWarning>[] } {
  const signals: BuildSecuritySignal[] = [];
  const diagnostics: ReturnType<typeof buildWarning>[] = [];
  const relPath = filePath.replace(basePath + '/', '');

  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(filePath);
  } catch {
    return { signals, diagnostics };
  }

  if (stats.size > maxFileSize) {
    diagnostics.push(
      buildWarning(BUILD_WARNING_CODES.LARGE_FILE_DETECTED, `PHP file exceeds size limit: ${relPath} (${stats.size} bytes)`, { file: relPath })
    );
    return { signals, diagnostics };
  }

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return { signals, diagnostics };
  }

  let fileSignalCount = 0;
  for (const signalDef of SIGNALS) {
    if (fileSignalCount >= SCANNER_MAX_SIGNALS_PER_FILE) break;
    if (signals.length >= SCANNER_MAX_SIGNALS_TOTAL) break;

    for (const pattern of signalDef.patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content))) {
        if (fileSignalCount >= SCANNER_MAX_SIGNALS_PER_FILE) break;
        if (signals.length >= SCANNER_MAX_SIGNALS_TOTAL) break;

        const lineNumber = content.substring(0, match.index).split(/\r?\n/).length;
        signals.push({
          type: signalDef.type,
          severity: signalDef.severity,
          message: signalDef.message,
          file: relPath,
          line: lineNumber,
          pattern: pattern.source,
        });
        fileSignalCount++;
      }
    }
  }

  return { signals, diagnostics };
}

/**
 * Collect PHP files recursively from a directory.
 */
function collectPhpFiles(
  dir: string,
  basePath: string,
  maxFiles: number,
  depth = 0
): string[] {
  if (depth > 20) return [];
  if (maxFiles <= 0) return [];

  let entries: ReturnType<typeof readdirSync<boolean>>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (files.length >= maxFiles) break;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['vendor', 'node_modules', '.git', '.github'].includes(entry.name) || entry.name.startsWith('.')) continue;
      files.push(...collectPhpFiles(fullPath, basePath, maxFiles - files.length, depth + 1));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.php') {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check a list of files for committed PHAR archives.
 */
export function checkForCommittedPhar(files: string[]): {
  signals: BuildSecuritySignal[];
  diagnostics: ReturnType<typeof buildWarning>[];
} {
  const signals: BuildSecuritySignal[] = [];
  const diagnostics: ReturnType<typeof buildWarning>[] = [];

  for (const file of files) {
    if (file.toLowerCase().endsWith('.phar')) {
      signals.push({
        type: SignalType.COMMITTED_PHAR,
        severity: SignalSeverity.HIGH,
        message: `PHAR file committed to repository: ${file}`,
        file,
      });
      diagnostics.push(buildWarning(BUILD_WARNING_CODES.SECURITY_SIGNAL_HIGH, `PHAR committed: ${file}`, { file }));
    }
  }

  return { signals, diagnostics };
}

/**
 * Scan directory tree for committed PHAR files.
 */
export function scanForCommittedPhar(sourcePath: string): {
  signals: BuildSecuritySignal[];
  diagnostics: ReturnType<typeof buildWarning>[];
} {
  const files = listAllFiles(sourcePath, sourcePath, 10000);
  return checkForCommittedPhar(files);
}

/**
 * List all files recursively (limited).
 */
function listAllFiles(
  dir: string,
  basePath: string,
  maxFiles: number,
  depth = 0
): string[] {
  if (depth > 20 || maxFiles <= 0) return [];

  let entries: ReturnType<typeof readdirSync<boolean>>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (files.length >= maxFiles) break;
    const fullPath = join(dir, entry.name);
    const relPath = fullPath.replace(basePath + '/', '');

    if (entry.isDirectory()) {
      if (['vendor', 'node_modules', '.git', '.github'].includes(entry.name) || entry.name.startsWith('.')) continue;
      files.push(...listAllFiles(fullPath, basePath, maxFiles - files.length, depth + 1));
    } else if (entry.isFile()) {
      files.push(relPath);
    }
  }

  return files;
}
