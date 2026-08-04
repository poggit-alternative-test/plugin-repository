/**
 * Category Generator
 *
 * Generates category.json files for the Website.
 * Categories are derived from plugin metadata.
 */

import { ensureDirectory, writeJson } from '../utils/file.js';
import { loadRegistry, type LoadedPlugin } from '../utils/registry.js';
import type {
  Category,
  CategoryList,
  CategoryListItem,
  PluginListItem,
  VersionStatus,
} from '../models/generated.js';

/**
 * Default category definitions
 * These provide the category structure even without plugin-level categorization
 */
const DEFAULT_CATEGORIES: CategoryListItem[] = [
  {
    id: 'admin',
    name: 'Admin Tools',
    slug: 'admin',
    description: 'Server administration and management plugins',
    icon: 'shield',
    pluginCount: 0,
  },
  {
    id: 'economy',
    name: 'Economy',
    slug: 'economy',
    description: 'Economy, shops, and currency plugins',
    icon: 'coins',
    pluginCount: 0,
  },
  {
    id: 'gameplay',
    name: 'Gameplay',
    slug: 'gameplay',
    description: 'Game mechanics and custom gameplay features',
    icon: 'gamepad',
    pluginCount: 0,
  },
  {
    id: 'teleport',
    name: 'Teleport',
    slug: 'teleport',
    description: 'Warps, portals, homes, and teleportation plugins',
    icon: 'map',
    pluginCount: 0,
  },
  {
    id: 'chat',
    name: 'Chat',
    slug: 'chat',
    description: 'Chat formatting, channels, and messaging plugins',
    icon: 'message',
    pluginCount: 0,
  },
  {
    id: 'protection',
    name: 'Protection',
    slug: 'protection',
    description: 'Anti-grief, permissions, and protection plugins',
    icon: 'lock',
    pluginCount: 0,
  },
  {
    id: 'world',
    name: 'World',
    slug: 'world',
    description: 'World management, generators, and editing plugins',
    icon: 'globe',
    pluginCount: 0,
  },
  {
    id: 'misc',
    name: 'Miscellaneous',
    slug: 'misc',
    description: 'Other plugins that do not fit other categories',
    icon: 'box',
    pluginCount: 0,
  },
];

/**
 * Extract author from upstream repository
 */
function extractAuthor(upstreamRepository: string): string {
  const parts = upstreamRepository.split('/');
  return parts[0] ?? 'unknown';
}

/**
 * Convert version status
 */
function convertStatus(status: string): VersionStatus {
  switch (status) {
    case 'approved':
    case 'materialized':
    case 'published':
    case 'deprecated':
    case 'revoked':
    case 'removed':
      return status;
    default:
      return 'published';
  }
}

/**
 * Get the latest published version for a plugin
 */
function getLatestPublishedVersion(versions: LoadedPlugin['versions']) {
  let latest = versions[0];
  for (const v of versions) {
    if (v.status === 'published') {
      if (!latest || v.version > latest.version) {
        latest = v;
      }
    }
  }
  return latest;
}

/**
 * Generate category index
 */
export function generateCategoryIndex(
  outputPath: string,
  pluginCountByCategory: Map<string, number> = new Map()
): CategoryList {
  const categories = DEFAULT_CATEGORIES.map(cat => ({
    ...cat,
    pluginCount: pluginCountByCategory.get(cat.id) ?? 0,
  }));

  const list: CategoryList = {
    categories,
    count: categories.length,
  };

  // Write category index
  const indexPath = `${outputPath}/categories/index.json`;
  ensureDirectory(`${outputPath}/categories`);
  writeJson(indexPath, list);

  return list;
}

/**
 * Generate individual category files
 */
export function generateCategories(
  plugins: LoadedPlugin[],
  outputPath: string
): Category[] {
  // Group plugins by category
  // For now, assign all plugins to 'misc' as we don't have category metadata yet
  const categoryPlugins = new Map<string, LoadedPlugin[]>();

  for (const plugin of plugins) {
    // Placeholder: assign to misc category until we have proper categorization
    const categoryId = 'misc';
    if (!categoryPlugins.has(categoryId)) {
      categoryPlugins.set(categoryId, []);
    }
    categoryPlugins.get(categoryId)!.push(plugin);
  }

  const generatedCategories: Category[] = [];

  for (const [categoryId, categoryPluginList] of categoryPlugins) {
    const categoryDef = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
    if (!categoryDef) continue;

    // Create plugin list items
    const pluginItems: PluginListItem[] = categoryPluginList.map(plugin => {
      const latestVersion = getLatestPublishedVersion(plugin.versions);
      return {
        id: plugin.identity.id,
        name: latestVersion?.artifact?.file?.replace('.phar', '') ?? plugin.identity.id,
        summary: '',
        latestVersion: latestVersion?.version ?? '',
        status: latestVersion ? convertStatus(latestVersion.status) : 'published',
        author: extractAuthor(plugin.identity.upstream.repository),
        updatedAt: latestVersion?.artifact?.publishedAt ?? '',
      };
    });

    const category: Category = {
      id: categoryDef.id,
      name: categoryDef.name,
      slug: categoryDef.slug,
      plugins: pluginItems,
      metadata: {
        description: categoryDef.description,
        icon: categoryDef.icon,
      },
    };

    // Write category file
    const categoryPath = `${outputPath}/categories/${categoryDef.slug}.json`;
    ensureDirectory(`${outputPath}/categories`);
    writeJson(categoryPath, category);

    generatedCategories.push(category);
  }

  return generatedCategories;
}

/**
 * Generate all category data
 */
export function generateAllCategories(
  plugins: LoadedPlugin[],
  outputPath: string
): {
  categoryList: CategoryList;
  categories: Category[];
} {
  // Count plugins by category
  const pluginCountByCategory = new Map<string, number>();

  for (const plugin of plugins) {
    // Placeholder: all plugins go to misc
    const categoryId = 'misc';
    pluginCountByCategory.set(
      categoryId,
      (pluginCountByCategory.get(categoryId) ?? 0) + 1
    );
  }

  const categoryList = generateCategoryIndex(outputPath, pluginCountByCategory);
  const categories = generateCategories(plugins, outputPath);

  return { categoryList, categories };
}
