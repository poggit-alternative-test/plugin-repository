/**
 * Registry Generator
 *
 * Main entry point for the Registry Generator package.
 * Transforms Registry YAML into static JSON for the Website.
 */

import { loadRegistry } from './utils/registry.js';
import { ensureDirectory } from './utils/file.js';
import {
  generateManifest,
} from './generators/manifest.js';
import {
  generateAllPlugins,
} from './generators/plugins.js';
import {
  generateAllVersions,
} from './generators/versions.js';
import {
  generateAllAuthors,
} from './generators/authors.js';
import {
  generateAllCategories,
} from './generators/categories.js';
import {
  generateAllSearch,
} from './generators/search.js';
import {
  generateAllReadmes,
} from './generators/readmes.js';
import type { GeneratorOptions } from './models/generated.js';

export interface GeneratorResult {
  success: boolean;
  manifest: {
    pluginCount: number;
    versionCount: number;
    authorCount: number;
    categoryCount: number;
  };
  errors: {
    registry: { plugin?: string; file: string; error: string }[];
    generation: string[];
  };
  duration: number;
}

/**
 * Generate all static files for the Website
 */
export function generate(options: GeneratorOptions): GeneratorResult {
  const startTime = Date.now();
  const errors = {
    registry: [] as { plugin?: string; file: string; error: string }[],
    generation: [] as string[],
  };

  try {
    // Ensure output directory exists
    ensureDirectory(options.outputPath);

    console.log(`Loading registry from: ${options.registryPath}`);
    const { plugins, errors: loadErrors } = loadRegistry(options.registryPath);
    errors.registry = loadErrors;

    if (loadErrors.length > 0) {
      console.warn(`Registry load had ${loadErrors.length} errors`);
      for (const error of loadErrors) {
        console.warn(`  ${error.file}: ${error.error}`);
      }
    }

    console.log(`Loaded ${plugins.length} plugins`);

    // Generate manifest
    console.log('Generating manifest...');
    const manifest = generateManifest({
      registryPath: options.registryPath,
      outputPath: options.outputPath,
      pluginCount: plugins.length,
      versionCount: plugins.reduce((sum, p) => sum + p.versions.length, 0),
      authorCount: new Set(plugins.map(p => p.identity.upstream.repository.split('/')[0])).size,
      categoryCount: 8, // Default categories
    });

    // Generate plugins
    console.log('Generating plugins...');
    const { pluginList, generatedPlugins } = generateAllPlugins(
      options.registryPath,
      options.outputPath
    );
    console.log(`Generated ${pluginList.plugins.length} plugin entries`);

    // Generate versions
    console.log('Generating versions...');
    const { totalVersions } = generateAllVersions(plugins, options.outputPath);
    console.log(`Generated ${totalVersions} version files`);

    // Generate authors
    console.log('Generating authors...');
    const { authorList } = generateAllAuthors(plugins, options.outputPath);
    console.log(`Generated ${authorList.count} author profiles`);

    // Generate categories
    console.log('Generating categories...');
    const { categoryList } = generateAllCategories(plugins, options.outputPath);
    console.log(`Generated ${categoryList.count} categories`);

    // Generate search index
    console.log('Generating search index...');
    const { searchIndex, popularPlugins } = generateAllSearch(
      plugins,
      options.outputPath
    );
    console.log(`Generated search index with ${searchIndex.plugins.length} entries`);

    // Generate READMEs
    console.log('Generating READMEs...');
    const { totalReadmes } = generateAllReadmes(plugins, options.outputPath);
    console.log(`Generated ${totalReadmes} README entries`);

    const duration = Date.now() - startTime;

    console.log(`\n✓ Generation complete in ${duration}ms`);
    console.log(`  Plugins: ${plugins.length}`);
    console.log(`  Versions: ${totalVersions}`);
    console.log(`  Authors: ${authorList.count}`);
    console.log(`  Categories: ${categoryList.count}`);
    console.log(`  Search entries: ${searchIndex.plugins.length}`);
    console.log(`  READMEs: ${totalReadmes}`);

    return {
      success: errors.registry.length === 0 && errors.generation.length === 0,
      manifest: {
        pluginCount: plugins.length,
        versionCount: totalVersions,
        authorCount: authorList.count,
        categoryCount: categoryList.count,
      },
      errors,
      duration,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    errors.generation.push(errorMessage);
    console.error(`Generation failed: ${errorMessage}`);

    return {
      success: false,
      manifest: {
        pluginCount: 0,
        versionCount: 0,
        authorCount: 0,
        categoryCount: 0,
      },
      errors,
      duration: Date.now() - startTime,
    };
  }
}

// Re-export types
export type { GeneratorOptions } from './models/generated.js';
