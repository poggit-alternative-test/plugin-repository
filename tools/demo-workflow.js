#!/usr/bin/env node
/**
 * =============================================================================
 * POC DEMO SCRIPT
 * =============================================================================
 *
 * This script simulates the GitHub Actions workflow locally.
 * Use this to demonstrate the workflow without needing GitHub.
 *
 * Usage:
 *   node tools/demo-workflow.js
 *
 * =============================================================================
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, BLUE);
  log(`${BOLD}${message}${RESET}`, BLUE);
  log('='.repeat(60), BLUE);
}

function logStep(step, message) {
  log(`\n${step}. ${BOLD}${message}${RESET}`);
}

function logSuccess(message) {
  log(`   ${GREEN}✓${RESET} ${message}`, GREEN);
}

function logInfo(message) {
  log(`   ${BLUE}ℹ${RESET} ${message}`, BLUE);
}

function logWarning(message) {
  log(`   ${YELLOW}⚠${RESET} ${message}`, YELLOW);
}

function logError(message) {
  log(`   ${RED}✗${RESET} ${message}`, RED);
}

// =============================================================================
// DEMO: Dev Build Simulation
// =============================================================================

function simulateDevBuild() {
  logHeader('SIMULATING: Dev Build Workflow');

  const buildDir = '.demo-build';
  const pluginName = 'ExamplePlugin';
  const version = '1.0.0';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const devVersion = `${version}-dev.${timestamp.split('T')[0]}`;

  // Step 1: Checkout
  logStep(1, 'Checkout code');
  logInfo('Downloading source from GitHub repository...');
  logInfo('Using commit SHA: abc1234def567890abc1234def567890abc1234');
  logSuccess('Code checked out');

  // Step 2: Setup PHP
  logStep(2, 'Setup PHP');
  logInfo('PHP version: 8.2.10');
  logInfo('Extensions: zip, phar');
  logSuccess('PHP configured');

  // Step 3: Install dependencies
  logStep(3, 'Install Composer dependencies');
  if (existsSync('composer.json')) {
    logInfo('Found composer.json - installing...');
    logInfo('  - Installing pocketmine/pocketmine-mp: ^5.0.0');
    logInfo('  - Installing some/dependency: ^1.0.0');
    logSuccess('Dependencies installed (2 packages)');
  } else {
    logInfo('No composer.json found - skipping');
  }

  // Step 4: Download Pharynx
  logStep(4, 'Download Pharynx PHAR Builder');
  logInfo('Downloading from GitHub releases...');
  logInfo('URL: https://github.com/SOF3/Pharynx/releases/latest/download/pharynx.phar');
  logSuccess('Pharynx downloaded');

  // Step 5: Build PHAR
  logStep(5, 'Build PHAR with Pharynx');

  // Create demo build directory
  mkdirSync(buildDir, { recursive: true });

  // Simulate PHAR creation
  const pharContent = `
<?php
/**
 * Simulated PHAR file for demo
 * In real workflow, this is built by Pharynx
 */
$plugin = [
    'name' => '${pluginName}',
    'version' => '${devVersion}',
    'main' => 'ExamplePlugin\\Main',
    'api' => ['5.0.0'],
];
echo "PHAR built successfully\\n";
echo "Plugin: {$plugin['name']}\\n";
echo "Version: {$plugin['version']}\\n";
`;

  const pharPath = join(buildDir, `${pluginName}-dev.phar`);
  writeFileSync(pharPath, pharContent);
  logInfo(`PHAR created: ${pharPath}`);
  logSuccess('PHAR built');

  // Step 6: Calculate checksums
  logStep(6, 'Calculate checksums');
  const sha256 = createHash('sha256').update(pharContent).digest('hex');
  const size = pharContent.length;
  logInfo(`SHA-256: ${sha256}`);
  logInfo(`Size: ${size} bytes`);

  // Create checksums file
  const checksumsContent = `${sha256}  ${pluginName}-dev.phar\n`;
  writeFileSync(join(buildDir, 'checksums.txt'), checksumsContent);
  logSuccess('Checksums generated');

  // Step 7: Create release
  logStep(7, 'Create Dev Release');
  logInfo('Tag: dev/abc1234');
  logInfo('Name: Dev Build ${timestamp.split("T")[0]}');
  logInfo('Draft: true');
  logInfo('Prerelease: true');
  logSuccess('Dev release created');
  log(`\n   Release URL: https://github.com/developer/${pluginName}/releases/tag/dev/abc1234`);

  // Cleanup
  logStep(8, 'Cleanup');
  logInfo('Removing temporary files...');
  logSuccess('Build directory cleaned');

  return {
    success: true,
    version: devVersion,
    sha256,
    size,
    tag: 'dev/abc1234',
  };
}

// =============================================================================
// DEMO: Release Build Simulation
// =============================================================================

function simulateReleaseBuild() {
  logHeader('SIMULATING: Release Build Workflow');

  const buildDir = '.demo-build';
  const pluginName = 'ExamplePlugin';
  const version = 'v1.0.0';

  // Step 1: Extract version
  logStep(1, 'Extract version from tag');
  logInfo(`Tag: ${version}`);
  logInfo(`Version: 1.0.0`);
  logSuccess('Version extracted');

  // Step 2: Validate plugin.yml
  logStep(2, 'Validate plugin.yml');

  const pluginYml = `
name: ${pluginName}
version: 1.0.0
api: 5.0.0
main: ${pluginName}\\Main
author: Developer Name
description: An example plugin
`;

  const pluginYmlPath = join(buildDir, 'plugin.yml');
  writeFileSync(pluginYmlPath, pluginYml);
  logInfo('plugin.yml found');
  logInfo(`  name: ${pluginName}`);
  logInfo(`  version: 1.0.0`);
  logInfo(`  api: 5.0.0`);
  logInfo(`  main: ${pluginName}\\Main`);
  logSuccess('plugin.yml valid');

  // Step 3: Build PHAR
  logStep(3, 'Build PHAR');

  const pharContent = `
<?php
/**
 * Production PHAR for ${pluginName} v1.0.0
 */
class Main extends PluginBase {
    public function onEnable(): void {
        $this->getLogger()->info("Plugin enabled!");
    }
}
`;

  const pharPath = join(buildDir, `${pluginName}-1.0.0.phar`);
  writeFileSync(pharPath, pharContent);

  const sha256 = createHash('sha256').update(pharContent).digest('hex');
  const size = pharContent.length;

  logInfo(`PHAR created: ${pharPath}`);
  logInfo(`SHA-256: ${sha256.substring(0, 16)}...`);
  logInfo(`Size: ${size} bytes`);
  logSuccess('PHAR built');

  // Step 4: Generate checksums
  logStep(4, 'Generate checksums');
  writeFileSync(join(buildDir, 'checksums.txt'), `${sha256}  ${pluginName}-1.0.0.phar\n`);
  logSuccess('Checksums generated');

  // Step 5: Generate metadata.json
  logStep(5, 'Generate metadata.json');

  const metadata = {
    schema_version: 1,
    plugin_name: pluginName,
    version: '1.0.0',
    api_version: '5.0.0',
    author: 'Developer Name',
    built_at: new Date().toISOString(),
    source_sha256: sha256,
    repository: 'developer/example-plugin',
    commit: 'abc1234def567890abc1234def567890abc1234',
  };

  writeFileSync(join(buildDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  logInfo(`metadata.json created`);
  logSuccess('Metadata generated');

  // Step 6: Create release
  logStep(6, 'Create GitHub Release');
  logInfo(`Tag: ${version}`);
  logInfo(`Name: ${pluginName} 1.0.0`);
  logInfo(`Draft: false`);
  logInfo(`Prerelease: false`);
  logSuccess('Release created');
  log(`\n   Release URL: https://github.com/developer/${pluginName}/releases/tag/v1.0.0`);

  // Cleanup
  logStep(7, 'Cleanup');
  logSuccess('Build directory cleaned');

  return {
    success: true,
    version: '1.0.0',
    sha256,
    size,
    tag: version,
  };
}

// =============================================================================
// DEMO: Submission Simulation
// =============================================================================

function simulateSubmission() {
  logHeader('SIMULATING: Plugin Submission');

  const submission = {
    schema_version: 1,
    upstream: {
      repository: 'developer/example-plugin',
      branch: 'main',
    },
    submitted_at: new Date().toISOString(),
    submitted_by: 'developer',
  };

  logStep(1, 'Create submission Issue');
  logInfo('Issue title: [SUBMIT] Example Plugin v1.0.0');
  logInfo('Issue body: Plugin submission template filled');
  logSuccess('Issue created');

  logStep(2, 'GitHub App receives webhook');
  logInfo('Event: issues.opened');
  logInfo('Repository: axolotl-pm/registry');
  logSuccess('Webhook received');

  logStep(3, 'Parse submission data');
  logInfo(JSON.stringify(submission, null, 2));
  logSuccess('Submission parsed');

  logStep(4, 'Create submission file');
  const submissionPath = 'submissions/demo-submission.yaml';
  const submissionContent = `# Plugin Submission
# Generated by GitHub App

${YAML.stringify(submission)}
`;
  logInfo(`File: ${submissionPath}`);
  logSuccess('Submission file created');

  logStep(5, 'Comment on Issue');
  logInfo('Adding automated comment...');
  logSuccess('Comment added');

  log(`\n   ${BOLD}Comment:${RESET}`);
  log('   ```');
  log('   ✅ Submission Received!');
  log('');
  log('   Plugin: Example Plugin');
  log('   Repository: developer/example-plugin');
  log('   Branch: main');
  log('');
  log('   Next Steps:');
  log('   1. Automated checks will run shortly');
  log('   2. Our review team will evaluate your plugin');
  log('   3. You\'ll be notified of the decision');
  log('   ```');

  return submission;
}

// =============================================================================
// DEMO: Registry Update Simulation
// =============================================================================

function simulateRegistryUpdate() {
  logHeader('SIMULATING: Registry Update');

  const registryDir = '.demo-registry/plugins';

  logStep(1, 'Read release information');
  logInfo('Tag: v1.0.0');
  logInfo('SHA-256: abc123def456...');
  logInfo('Assets: *.phar, checksums.txt, metadata.json');
  logSuccess('Release info read');

  logStep(2, 'Update registry');
  logInfo(`Registry path: ${registryDir}`);

  const pluginData = {
    schema_version: 1,
    version: '1.0.0',
    source: {
      upstream_commit: 'abc1234def567890abc1234def567890abc1234',
    },
    review: {
      pull_request: 42,
      reviewer: 'reviewer',
      approved_at: new Date().toISOString(),
    },
    storage: {
      repository: 'axolotl-pm-pl/example-plugin',
      commit: 'def567890abc1234def567890abc1234def5678',
    },
    artifact: {
      release_tag: 'v1.0.0',
      file: 'ExamplePlugin-1.0.0.phar',
      sha256: 'abc123def456789...',
      published_at: new Date().toISOString(),
    },
    status: 'published',
  };

  logInfo('Version record:');
  logInfo(JSON.stringify(pluginData, null, 2).substring(0, 200) + '...');
  logSuccess('Registry updated');

  logStep(3, 'Create pull request');
  logInfo('PR title: Add ExamplePlugin v1.0.0');
  logInfo('PR body: Automated submission for ExamplePlugin v1.0.0');
  logSuccess('PR created');
  log(`\n   PR URL: https://github.com/axolotl-pm/registry/pull/XX`);

  return pluginData;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  console.clear();

  log(`\n${BOLD}${CYAN}`, '');
  log('╔══════════════════════════════════════════════════════════╗');
  log('║', '');
  log(`${CYAN}  🎯 ${BOLD}Axolotl Plugin Repository - POC Demo${RESET}${CYAN}`, '');
  log('║', '');
  log('╚══════════════════════════════════════════════════════════╝');
  log(RESET);

  log(`\n${BOLD}This demo simulates the GitHub Actions workflow${RESET}`);
  log(`without needing a real GitHub repository.\n`);

  // Run demos
  const devBuild = simulateDevBuild();
  console.log('\n');
  const releaseBuild = simulateReleaseBuild();
  console.log('\n');
  const submission = simulateSubmission();
  console.log('\n');
  const registryUpdate = simulateRegistryUpdate();

  // Summary
  logHeader('DEMO SUMMARY');

  log(`\n${BOLD}What we demonstrated:${RESET}\n`);

  logSuccess('Dev Build Workflow');
  log('   - Auto-triggers on push to main/dev');
  log(`   - Creates draft releases with "dev/" tags`);
  log(`   - Version: ${devBuild.version}`);
  log('');

  logSuccess('Release Build Workflow');
  log('   - Triggers on version tags (v*.*.*)');
  log('   - Creates public releases');
  log('   - Generates checksums & metadata');
  log(`   - Version: ${releaseBuild.version}`);
  log('');

  logSuccess('Submission Workflow');
  log('   - GitHub Issue as submission form');
  log('   - Webhook receives and parses');
  log('   - Automated commenting');
  log('');

  logSuccess('Registry Update');
  log('   - Updates registry on approval');
  log('   - Creates PR for review');
  log('   - Tracks plugin versions');
  log('');

  log(`\n${BOLD}GitHub-Only Architecture:${RESET}`);
  log(`   ✅ GitHub Actions (CI/CD)`);
  log(`   ✅ GitHub Releases (Storage)`);
  log(`   ✅ GitHub Issues (Submissions)`);
  log(`   ✅ GitHub Repository (Registry)`);
  log(`   ✅ Cloudflare Workers (Webhooks)`);
  log('');

  log(`\n${GREEN}${BOLD}Total infrastructure cost: $0/month 💰${RESET}\n`);

  log(`\n${BOLD}Next steps to make this production-ready:${RESET}\n`);
  log(`   1. Fix TypeScript errors in src/`);
  log(`   2. Deploy GitHub App webhook handler`);
  log(`   3. Setup GitHub repository for registry`);
  log(`   4. Connect GitHub Pages for website`);
  log(`   5. Add reviewer authentication`);
  log(`\n`);
}

// YAML stringify (simple implementation)
const YAML = {
  stringify: (obj) => Object.entries(obj)
    .map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return `${key}:\n${Object.entries(value).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`;
      }
      return `${key}: ${value}`;
    })
    .join('\n'),
};

// Run demo
main();
