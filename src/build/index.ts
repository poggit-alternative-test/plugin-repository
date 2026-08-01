/**
 * Build Domain Module
 *
 * Exports Composer Runner, Pharynx Runner, and build diagnostics.
 *
 * Note: BuildService and workflow integration are not yet implemented.
 */

// Diagnostics
export {
  BUILD_CODES,
  BuildDiagnosticSeverity,
  type BuildDiagnostic,
  type BuildDiagnosticCode,
  buildError,
  buildWarning,
  infrastructureError,
  getErrors,
  getWarnings,
  getInfrastructureErrors,
  hasErrors,
  hasInfrastructureErrors,
  classifyComposerExitCode,
} from './diagnostics.js';

// Composer Runner
export {
  COMPOSER_RUNNER_LIMITS,
  type ComposerRunnerConfig,
  type ComposerInstallResult,
  runComposerInstall,
  checkComposerVersion,
  validateWorkspacePath,
} from './composer-runner.js';

// Pharynx Runner
export {
  PHARYNX_RUNNER_LIMITS,
  type PharynxRunnerConfig,
  type PharynxRunResult,
  runPharynx,
  checkPhpVersion,
} from './pharynx-runner.js';
