/**
 * Unit tests for Build Security Scanner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import {
  scanForSecuritySignals,
  checkForCommittedPhar,
  scanForCommittedPhar,
  SCANNER_MAX_FILES,
  SCANNER_MAX_FILE_SIZE,
} from '../src/security-scanner.js';
import { SecuritySignalType, SecuritySignalSeverity } from '../src/types.js';

describe('scanForSecuritySignals', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-scanner-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('dangerous function detection', () => {
    it('detects eval()', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php eval($code);');

      const result = scanForSecuritySignals(testDir);

      expect(result.signalCount).toBeGreaterThan(0);
      expect(result.signals.some(s => s.type === SecuritySignalType.DANGEROUS_FUNCTION)).toBe(true);
    });

    it('detects system()', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php system($_GET["cmd"]);');

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.SYSTEM_EXECUTION)).toBe(true);
    });

    it('detects shell_exec()', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php $output = shell_exec($cmd);');

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.SYSTEM_EXECUTION)).toBe(true);
    });

    it('detects exec()', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php exec("ls");');

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.SYSTEM_EXECUTION)).toBe(true);
    });

    it('detects backtick execution', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php $output = `ls -la`;');

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.SYSTEM_EXECUTION)).toBe(true);
    });
  });

  describe('base64 detection', () => {
    it('detects large base64 strings', () => {
      const phpFile = join(testDir, 'test.php');
      const largeBase64 = 'A'.repeat(60);
      writeFileSync(phpFile, `<?php $data = base64_decode("${largeBase64}");`);

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.BASE64_CONTENT)).toBe(true);
    });

    it('ignores small base64 strings', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php $data = base64_decode("SGVsbG8=");'); // "Hello" in base64

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.BASE64_CONTENT)).toBe(false);
    });
  });

  describe('filesystem operations', () => {
    it('detects sensitive file_put_contents', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php file_put_contents("/etc/passwd", $data);');

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.PATH_ESCAPE)).toBe(true);
    });
  });

  describe('network operations', () => {
    it('detects curl_exec', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php curl_exec($ch);');

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.EXTERNAL_NETWORK)).toBe(true);
    });

    it('detects file_get_contents with URL', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php $data = file_get_contents("https://example.com/data");');

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.EXTERNAL_NETWORK)).toBe(true);
    });

    it('detects fsockopen', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php $fp = fsockopen("example.com", 80);');

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.EXTERNAL_NETWORK)).toBe(true);
    });
  });

  describe('obfuscation patterns', () => {
    it('detects str_rot13', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php $decoded = str_rot13($encoded);');

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.OBFUSCATION)).toBe(true);
    });

    it('detects strrev', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php $reversed = strrev($string);');

      const result = scanForSecuritySignals(testDir);

      expect(result.signals.some(s => s.type === SecuritySignalType.OBFUSCATION)).toBe(true);
    });
  });

  describe('clean code', () => {
    it('returns no signals for clean PHP code', () => {
      const phpFile = join(testDir, 'clean.php');
      writeFileSync(phpFile, `
<?php
class MyPlugin {
    private string $name;

    public function onEnable(): void {
        $this->getLogger()->info("Plugin enabled");
    }
}
`);

      const result = scanForSecuritySignals(testDir);

      expect(result.signalCount).toBe(0);
      expect(result.signals).toHaveLength(0);
    });

    it('handles empty directory', () => {
      const emptyDir = join(testDir, 'empty');
      mkdirSync(emptyDir);

      const result = scanForSecuritySignals(emptyDir);

      expect(result.filesScanned).toBe(0);
      expect(result.signalCount).toBe(0);
    });

    it('handles non-existent directory', () => {
      const result = scanForSecuritySignals(join(testDir, 'nonexistent'));

      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.signalCount).toBe(0);
    });
  });

  describe('file limits', () => {
    it('respects maxFiles limit', () => {
      // Create many files
      for (let i = 0; i < 150; i++) {
        const phpFile = join(testDir, `test${i}.php`);
        writeFileSync(phpFile, '<?php echo "test";');
      }

      const result = scanForSecuritySignals(testDir, { maxFiles: 10 });

      expect(result.filesScanned).toBeLessThanOrEqual(10);
    });

    it('skips files exceeding maxFileSize', () => {
      const largeFile = join(testDir, 'large.php');
      // Create a file larger than default 512KB limit
      writeFileSync(largeFile, '<?php ' + 'x'.repeat(SCANNER_MAX_FILE_SIZE + 1000));

      const result = scanForSecuritySignals(testDir);

      expect(result.diagnostics.some(d =>
        d.message.includes('exceeds size limit')
      )).toBe(true);
    });
  });

  describe('signal metadata', () => {
    it('includes file path in signals', () => {
      const phpFile = join(testDir, 'dangerous.php');
      writeFileSync(phpFile, '<?php eval($code);');

      const result = scanForSecuritySignals(testDir);

      const evalSignal = result.signals.find(s => s.type === SecuritySignalType.DANGEROUS_FUNCTION);
      expect(evalSignal?.file).toContain('dangerous.php');
    });

    it('includes line number in signals', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, `<?php
// Line 2
// Line 3
eval($code); // Line 4
`);

      const result = scanForSecuritySignals(testDir);

      const evalSignal = result.signals.find(s => s.type === SecuritySignalType.DANGEROUS_FUNCTION);
      expect(evalSignal?.line).toBe(4);
    });

    it('includes severity in signals', () => {
      const phpFile = join(testDir, 'test.php');
      writeFileSync(phpFile, '<?php system($cmd);');

      const result = scanForSecuritySignals(testDir);

      const systemSignal = result.signals.find(s => s.type === SecuritySignalType.SYSTEM_EXECUTION);
      expect(systemSignal?.severity).toBe(SecuritySignalSeverity.CRITICAL);
    });
  });

  describe('multiple files', () => {
    it('scans multiple PHP files', () => {
      writeFileSync(join(testDir, 'file1.php'), '<?php system($cmd);');
      writeFileSync(join(testDir, 'file2.php'), '<?php eval($code);');
      writeFileSync(join(testDir, 'file3.php'), '<?php curl_exec($ch);');

      const result = scanForSecuritySignals(testDir);

      expect(result.filesScanned).toBe(3);
      expect(result.signalCount).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('checkForCommittedPhar', () => {
  it('detects .phar files', () => {
    const files = [
      'src/Main.php',
      'resources/config.yml',
      'plugin.phar',
    ];

    const result = checkForCommittedPhar(files);

    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].type).toBe(SecuritySignalType.COMMITTED_PHAR);
    expect(result.signals[0].file).toBe('plugin.phar');
  });

  it('handles multiple .phar files', () => {
    const files = [
      'old.phar',
      'src/Main.php',
      'release.phar',
    ];

    const result = checkForCommittedPhar(files);

    expect(result.signals).toHaveLength(2);
  });

  it('returns empty for no .phar files', () => {
    const files = [
      'src/Main.php',
      'resources/config.yml',
      'README.md',
    ];

    const result = checkForCommittedPhar(files);

    expect(result.signals).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const files = [
      'plugin.PHAR',
      'release.Phar',
    ];

    const result = checkForCommittedPhar(files);

    expect(result.signals).toHaveLength(2);
  });
});

describe('scanForCommittedPhar', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-phar-scan-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('scans directory for .phar files', () => {
    writeFileSync(join(testDir, 'release.phar'), 'fake phar content');
    writeFileSync(join(testDir, 'Main.php'), '<?php echo "test";');

    const result = scanForCommittedPhar(testDir);

    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].type).toBe(SecuritySignalType.COMMITTED_PHAR);
  });

  it('returns empty for clean directory', () => {
    writeFileSync(join(testDir, 'Main.php'), '<?php echo "test";');

    const result = scanForCommittedPhar(testDir);

    expect(result.signals).toHaveLength(0);
  });

  it('skips vendor directories', () => {
    mkdirSync(join(testDir, 'vendor'), { recursive: true });
    writeFileSync(join(testDir, 'vendor', 'library.phar'), 'fake phar');
    writeFileSync(join(testDir, 'plugin.phar'), 'fake phar');

    const result = scanForCommittedPhar(testDir);

    // Only the plugin.phar should be found, vendor is skipped
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].file).toContain('plugin.phar');
  });
});

describe('resource limits constants', () => {
  it('SCANNER_MAX_FILES is defined', () => {
    expect(SCANNER_MAX_FILES).toBe(100);
  });

  it('SCANNER_MAX_FILE_SIZE is defined as 512KB', () => {
    expect(SCANNER_MAX_FILE_SIZE).toBe(512 * 1024);
  });
});
