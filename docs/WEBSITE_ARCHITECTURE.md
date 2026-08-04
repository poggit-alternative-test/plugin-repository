# Website Architecture — M8 Design Review

**Milestone:** M8 — Website
**Status:** Architecture Review
**Last Updated:** 2026-08-02

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Reference Analysis](#reference-analysis)
3. [Technology Stack](#technology-stack)
4. [Folder Structure](#folder-structure)
5. [Data Architecture](#data-architecture)
6. [Static Site Generation](#static-site-generation)
7. [Search Architecture](#search-architecture)
8. [Page Specifications](#page-specifications)
9. [Routing Architecture](#routing-architecture)
10. [Component Hierarchy](#component-hierarchy)
11. [State Management](#state-management)
12. [Build & Deployment](#build--deployment)
13. [Future Roadmap](#future-roadmap)
14. [Implementation Order](#implementation-order)

---

## Executive Summary

The Website is a **read-only consumer** of the Registry. It must never contain business logic that belongs in backend domains.

**Core Principles:**
- Registry is the source of truth
- Website is purely presentational
- Static generation for performance
- Client-side interactivity for search/filtering

---

## Reference Analysis

### crates.io (Rust Package Registry)

**Strengths to Emulate:**
- Clean, minimal design focused on search
- Version history and changelog display
- Download statistics and trend indicators
- Clear trust/provenance indicators

**Technology:** Rust + server-side rendering (more complex than needed)

### packagist.org (PHP Package Registry)

**Strengths to Emulate:**
- Simple URL structure: `packagist.org/packages/{vendor}/{package}`
- Version listing with easy installation commands
- Dependency visualization
- Maintainer profiles with package counts

**Technology:** Symfony (PHP server-rendered)

### npmjs.com (JavaScript Registry)

**Strengths to Emulate:**
- Powerful search with filters
- Version timeline and deprecation notices
- Readme rendering with syntax highlighting
- Downloads over time charts

**Technology:** Node.js + client-side React

### plugins.gradle.org (Gradle Plugin Portal)

**Strengths to Emulate:**
- Plugin ID-based URLs
- Quick installation snippets
- Category browsing
- Version compatibility matrix

**Technology:** Grails (JVM-based)

### Key Patterns for PocketMine Plugin Registry

| Pattern | Implementation |
|---------|---------------|
| Search-first | Homepage is search, not marketing |
| Version history | Clear version timeline with release notes |
| Installation snippets | One-click copy for composer require / wget |
| Trust indicators | GitHub attestation badges, verification status |
| Dependencies | Visual dependency graph (PocketMine API versions) |

---

## Technology Stack

### Recommended: Vite + React + TypeScript

| Technology | Choice | Rationale |
|-----------|--------|-----------|
| **Build Tool** | Vite | Fast HMR, optimized builds, modern ecosystem |
| **Framework** | React 18 | Component model, ecosystem maturity, TypeScript support |
| **Language** | TypeScript | Type safety, better DX, catch errors early |
| **Styling** | Tailwind CSS | Utility-first, consistent design, fast iteration |
| **Icons** | Lucide React | Clean, MIT licensed, tree-shakeable |
| **MDX/Markdown** | react-markdown | Render plugin READMEs |
| **Syntax Highlighting** | Prism.js or Shiki | Code block rendering in READMEs |
| **Search** | Fuse.js | Client-side fuzzy search, no server needed |

### Why Not Alternatives

| Alternative | Why Not |
|------------|---------|
| Next.js | Overkill for read-only site; SSG adds complexity without benefit |
| Nuxt.js | Vue-based; React ecosystem is larger |
| Astro | Good for content sites, but React integration adds complexity |
| Svelte | Smaller ecosystem; React has better tooling |

---

## Folder Structure

```
website/
├── public/                     # Static assets
│   ├── favicon.svg
│   ├── og-image.png
│   └── fonts/
├── src/
│   ├── assets/                 # Source assets
│   │   └── logo.svg
│   ├── components/             # Shared components
│   │   ├── ui/                # Primitive components (Button, Input, Card)
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Badge/
│   │   │   ├── Card/
│   │   │   └── Modal/
│   │   ├── layout/            # Layout components
│   │   │   ├── Header/
│   │   │   ├── Footer/
│   │   │   ├── Sidebar/
│   │   │   └── Container/
│   │   ├── search/             # Search components
│   │   │   ├── SearchBar/
│   │   │   ├── SearchResults/
│   │   │   └── SearchFilters/
│   │   ├── plugin/            # Plugin-specific components
│   │   │   ├── PluginCard/
│   │   │   ├── PluginHeader/
│   │   │   ├── VersionList/
│   │   │   ├── VersionBadge/
│   │   │   ├── InstallCommand/
│   │   │   ├── DependencyList/
│   │   │   └── ProvenanceBadge/
│   │   ├── version/           # Version-specific components
│   │   │   ├── VersionInfo/
│   │   │   ├── Changelog/
│   │   │   └── Checksums/
│   │   ├── author/           # Author-specific components
│   │   │   ├── AuthorCard/
│   │   │   └── AuthorPlugins/
│   │   └── common/           # Common components
│   │       ├── LoadingSpinner/
│   │       ├── ErrorMessage/
│   │       └── EmptyState/
│   ├── features/              # Feature modules (co-located)
│   │   ├── home/
│   │   │   ├── HomePage.tsx
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── search/
│   │   │   ├── SearchPage.tsx
│   │   │   └── hooks/useSearch.ts
│   │   ├── plugin/
│   │   │   ├── PluginPage.tsx
│   │   │   ├── hooks/
│   │   │   │   └── usePlugin.ts
│   │   │   └── components/
│   │   ├── version/
│   │   │   ├── VersionPage.tsx
│   │   │   └── components/
│   │   └── author/
│   │       ├── AuthorPage.tsx
│   │       └── components/
│   ├── hooks/                 # Shared hooks
│   │   ├── useRegistry.ts
│   │   ├── useSearch.ts
│   │   └── useFilters.ts
│   ├── lib/                   # Utilities
│   │   ├── registry.ts        # Registry data access
│   │   ├── search.ts          # Search utilities
│   │   ├── formatters.ts     # Date, version formatters
│   │   └── validators.ts      # Validation helpers
│   ├── pages/                 # Route components (thin wrappers)
│   │   ├── index.tsx          # /
│   │   ├── search.tsx         # /search
│   │   ├── plugins/
│   │   │   ├── index.tsx     # /plugins
│   │   │   └── $slug.tsx      # /plugins/:slug
│   │   ├── versions/
│   │   │   └── $slug.$version.tsx  # /versions/:slug/:version
│   │   └── authors/
│   │       └── $owner.tsx     # /authors/:owner
│   ├── routes/                # Route definitions
│   │   └── index.tsx
│   ├── styles/                # Global styles
│   │   ├── globals.css
│   │   └── variables.css
│   ├── types/                 # TypeScript types
│   │   ├── registry.ts        # Registry types
│   │   ├── plugin.ts         # Plugin types
│   │   └── search.ts          # Search types
│   ├── data/                  # Build-time generated data
│   │   ├── plugins.json      # Generated from registry
│   │   ├── search-index.json # Generated search index
│   │   └── authors.json       # Generated author list
│   ├── App.tsx
│   └── main.tsx
├── scripts/
│   └── generate-data.ts       # Data generation script
├── tests/
│   ├── components/
│   └── e2e/
├── public/                    # Built output
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── index.html
```

### Structure Rationale

| Directory | Purpose |
|-----------|---------|
| `components/ui` | Primitive UI components (design system) |
| `components/features` | Feature-specific, highly cohesive |
| `features/` | Co-located with its components, hooks, tests |
| `data/` | Build-time generated, read-only at runtime |
| `lib/` | Pure utility functions |
| `hooks/` | Shared React hooks |
| `types/` | TypeScript type definitions |

---

## Data Architecture

### Data Flow

```
Registry (YAML)
      │
      ▼
Build-time Data Generation (scripts/generate-data.ts)
      │
      ├──► plugins.json       (all plugin data)
      ├──► search-index.json   (search-optimized index)
      └──► authors.json       (author index)
      │
      ▼
Static Site (website/public/data/)
      │
      ▼
Runtime (client downloads and uses)
```

### Data Generation

The data generation script runs at build time:

```typescript
// scripts/generate-data.ts
// Input: registry/plugins/*
// Output: public/data/plugins.json, search-index.json, authors.json
```

### Generated Files

**1. plugins.json**
```json
{
  "plugins": [
    {
      "id": "topstats",
      "name": "TopStats",
      "description": "Server statistics plugin",
      "upstream": {
        "repository": "nicholass003/TopStats",
        "branch": "main"
      },
      "latestVersion": "2.1.0",
      "versions": [
        {
          "version": "2.1.0",
          "status": "published",
          "publishedAt": "2026-08-01T10:00:00Z",
          "apiVersion": "5.0.0",
          "sha256": "abc123...",
          "provenance": { "type": "github-attestation" }
        }
      ],
      "downloads": 15234,
      "author": "nicholass003"
    }
  ]
}
```

**2. search-index.json**
```json
{
  "plugins": [
    {
      "id": "topstats",
      "name": "TopStats",
      "description": "Server statistics plugin",
      "tags": ["stats", "economy", "analytics"],
      "author": "nicholass003",
      "versionCount": 5
    }
  ]
}
```

**3. authors.json**
```json
{
  "authors": [
    {
      "login": "nicholass003",
      "pluginCount": 2,
      "plugins": ["topstats", "economyapi"]
    }
  ]
}
```

### Why This Approach

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Read YAML directly | Single source of truth | Slow parsing, no optimization | ❌ |
| Generate JSON at build | Fast, optimized, searchable | Build step required | ✅ |
| Generate search index | Instant search | Index maintenance | ✅ |
| Server-side API | Real-time, dynamic | Infrastructure needed | ❌ |

---

## Static Site Generation

### Vite + React (SPA with Pre-rendering)

**Architecture:**
- Client-side React SPA
- Pre-rendered HTML shells for SEO
- Data loaded from static JSON files
- Client-side routing

### Why This Approach

| Factor | Analysis |
|--------|----------|
| **Complexity** | Simple deployment to GitHub Pages |
| **Performance** | Lazy loading, code splitting |
| **SEO** | Pre-rendered meta tags, Open Graph |
| **Hosting** | Free, no server needed |
| **Maintenance** | Minimal infrastructure |

### Alternative: Astro

**Why Not:**
- Better for content-heavy sites with less interactivity
- React integration adds complexity
- Learning curve for component islands pattern

### Alternative: Next.js

**Why Not:**
- SSG adds complexity without benefit
- API routes not needed (read-only)
- Larger bundle size

---

## Search Architecture

### Recommended: Fuse.js (Client-Side Fuzzy Search)

```typescript
// lib/search.ts
import Fuse from 'fuse.js';

const fuseOptions = {
  keys: [
    { name: 'name', weight: 0.4 },
    { name: 'description', weight: 0.3 },
    { name: 'tags', weight: 0.2 },
    { name: 'author', weight: 0.1 }
  ],
  threshold: 0.3,
  includeScore: true,
  minMatchCharLength: 2
};

export function createSearchIndex(plugins: Plugin[]) {
  return new Fuse(plugins, fuseOptions);
}
```

### Search Features

| Feature | Implementation |
|---------|---------------|
| Fuzzy matching | Fuse.js |
| Field boosting | name > description > tags |
| Instant results | Debounced input (300ms) |
| URL sync | Query params (`?q=topstats`) |
| Empty state | Show trending/recent |
| No results | Suggest similar terms |

### Future: Pagefind (Optional Enhancement)

For large registries, Pagefind provides:
- Static search index built at build time
- Web Worker-based search
- No external dependencies
- Good for 1000+ plugins

**Recommendation:** Start with Fuse.js, migrate to Pagefind if needed.

---

## Page Specifications

### 1. Home Page (`/`)

**Primary Goal:** Discovery through search

**Sections:**

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]  Axolotl Plugin Registry          [Submit]     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         🔍 Search plugins...                            │
│                                                         │
│    ┌──────────────────────────────────────────────┐   │
│    │  Total: 156 plugins | 423 versions            │   │
│    └──────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Featured Plugins                        [View All →]    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │ TopStats│ │EconomyAPI│ │Portal   │ │EconomyL │     │
│  │ 2.1.0   │ │ 3.0.0   │ │ 1.5.0   │ │ 2.2.0   │     │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Recently Updated                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ TopStats 2.1.0  •  2 hours ago                  │   │
│  │ EconomyAPI 3.0.0 •  5 hours ago                  │   │
│  │ Portal 1.5.0    •  1 day ago                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Footer: About | Submit Plugin | GitHub | License       │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- `HeroSearch` - Large search input
- `StatsBar` - Plugin/version counts
- `FeaturedPlugins` - Curated or popular
- `RecentUpdates` - Latest published versions

---

### 2. Plugin Page (`/plugins/:slug`)

**Primary Goal:** Information and installation

**Information Hierarchy:**

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to search                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Icon]  TopStats                         [⭐ 234]     │
│          by nicholass003                                │
│          Server statistics with web dashboard           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [Install]  [GitHub]  [Donate]                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────┬───────────────────────────────────┐   │
│  │ Overview    │                                    │   │
│  │ Versions    │  # TopStats                        │   │
│  │ Installation│                                    │   │
│  │ Dependencies│  Server statistics plugin for      │   │
│  │ Repository  │  PocketMine-MP with web dashboard  │   │
│  │ License     │  and Discord integration.         │   │
│  │ Checksums   │                                    │   │
│  │ Provenance  │  ## Features                       │   │
│  └─────────────┴───────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Versions (5)                            [View All →]    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ v2.1.0  •  Latest  •  2 days ago   [Download]  │   │
│  │ v2.0.0  •           •  1 month ago  [Download]  │   │
│  │ v1.5.0  •           •  3 months ago [Download]  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Verified Build                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✓ GitHub Artifact Attestation                    │   │
│  │   Provenance verified for this release           │   │
│  │   [Verify with GitHub CLI →]                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Sidebar Sections:**
1. **Overview** - Rendered README
2. **Versions** - Version timeline
3. **Installation** - Copy command
4. **Dependencies** - API version requirements
5. **Repository** - Link to upstream
6. **License** - License type
7. **Checksums** - SHA-256 verification
8. **Provenance** - Attestation status

---

### 3. Version Page (`/versions/:slug/:version`)

**Primary Goal:** Specific version details

**Sections:**

```
┌─────────────────────────────────────────────────────────┐
│  ← TopStats                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  TopStats v2.1.0                                       │
│  Published August 1, 2026                              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [Download TopStats.phar]  [Copy Checksum]      │   │
│  │                                                  │   │
│  │  SHA-256: abc123...def456                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Installation                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ $ wget https://.../TopStats-v2.1.0.phar        │   │
│  │                                                  │   │
│  │ Require via PocketMine:                         │   │
│  │  → Copy command for plugin manager              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Changelog                                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ## v2.1.0                                       │   │
│  │ - Added web dashboard                          │   │
│  │ - Fixed memory leak                            │   │
│  │                                                │   │
│  │ ## v2.0.0                                       │   │
│  │ - Breaking: API version 5.0                   │   │
│  │ - Added Discord webhooks                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Provenance                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✓ GitHub Artifact Attestation                   │   │
│  │                                                  │   │
│  │ Build verified from:                            │   │
│  │ - Source: nicholass003/TopStats@abc123         │   │
│  │ - Reviewer: axolotl-reviewer                   │   │
│  │ - Storage: axolotl-pm-pl/TopStats@abc123        │   │
│  │ - Built: 2026-08-01 by build-trusted.yml       │   │
│  │                                                  │   │
│  │ [Verify on GitHub →]                           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Technical Details                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ API Version: 5.0.0                              │   │
│  │ PHAR Size: 245 KB                              │   │
│  │ Published: 2026-08-01T10:00:00Z               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 4. Author Page (`/authors/:owner`)

**Primary Goal:** Author profile and their plugins

**Sections:**

```
┌─────────────────────────────────────────────────────────┐
│  ← Back                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Avatar]  nicholass003                                │
│            Member since 2024                           │
│            3 plugins                                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Plugins by nicholass003                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ TopStats         2.1.0  ⭐ 234                   │   │
│  │ Server statistics with web dashboard            │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ EconomyAPI       3.0.0  ⭐ 156                   │   │
│  │ Full economy system with shops                  │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ Portal           1.5.0  ⭐ 89                    │   │
│  │ Warp/teleport plugin with GUI                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 5. Search Results Page (`/search?q=query`)

**Sections:**

```
┌─────────────────────────────────────────────────────────┐
│  🔍 "statistics"                                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Filter: [API 5.0] [API 4.0] [All Versions]     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  12 results • 0.023s                                   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ TopStats                                        │   │
│  │ Server statistics with web dashboard            │   │
│  │ v2.1.0 • nicholass003 • ⭐ 234                 │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ StatsPlus                                       │   │
│  │ Basic stats collection plugin                   │   │
│  │ v1.2.0 • anotherauthor • ⭐ 45                 │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ BStatsCharts                                    │   │
│  │ bStats integration for custom charts            │   │
│  │ v0.5.0 • thirdauthor • ⭐ 78                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Load More]                                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Routing Architecture

### URL Structure

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Search-focused homepage |
| `/search` | Search | Search results |
| `/search?q=query` | Search | Search with query |
| `/plugins` | Browse | All plugins (paginated) |
| `/plugins/:slug` | Plugin | Plugin detail |
| `/versions/:slug/:version` | Version | Version detail |
| `/authors` | Authors | Author index |
| `/authors/:owner` | Author | Author profile |
| `/about` | About | About page |
| `/submit` | Submit | Submission guidelines |

### Route Structure

```typescript
// routes/index.tsx
const routes = {
  '/': HomePage,
  '/search': SearchPage,
  '/plugins': BrowsePage,
  '/plugins/:slug': PluginPage,
  '/versions/:slug/:version': VersionPage,
  '/authors': AuthorsPage,
  '/authors/:owner': AuthorPage,
  '/about': AboutPage,
};
```

### Nested Layout Routes

```
<RootLayout>           // Header, Footer
  <HomeLayout>         // Hero search
    <HomePage />
  </HomeLayout>

  <PluginLayout>       // Sidebar navigation
    <PluginPage />
  </PluginLayout>

  <VersionLayout>
    <VersionPage />
  </VersionLayout>

  <AuthorLayout>
    <AuthorPage />
  </AuthorLayout>
</RootLayout>
```

---

## Component Hierarchy

### Design System (Atomic)

```
Atoms (Primitive)
├── Button
├── Input
├── Badge
├── Card
├── Icon
├── Link
├── Text (Heading, Paragraph, Code)
└── Spinner

Molecules (Combinations)
├── SearchBar (Input + Icon + Button)
├── PluginCard (Card + Badge + Link)
├── VersionRow (Badge + Link + Date)
├── AuthorChip (Avatar + Name)
├── InstallCommand (Code + CopyButton)
└── ProvenanceBadge (Icon + Text + Link)

Organisms (Full Sections)
├── Header (Logo + Search + Nav)
├── Footer (Links + Copyright)
├── PluginHeader (Icon + Title + Meta + Actions)
├── VersionList (VersionRows)
├── DependenciesList (DependencyChips)
└── ChangelogViewer (Markdown)

Templates (Page Layouts)
├── HomeLayout
├── PluginLayout
├── VersionLayout
└── AuthorLayout

Pages (Routes)
├── HomePage
├── SearchPage
├── PluginPage
├── VersionPage
└── AuthorPage
```

### Component Communication

```
Props (Parent → Child)
├── <PluginCard plugin={plugin} />
└── <SearchBar onSearch={handleSearch} />

Context (Cross-cutting)
├── RegistryContext (plugin data)
├── ThemeContext (dark/light mode)
└── SearchContext (query, filters, results)

Custom Hooks (Logic)
├── usePlugin(slug) → plugin data
├── useSearch(query) → search results
├── useVersion(slug, version) → version data
└── useAuthor(owner) → author data
```

---

## State Management

### Recommended: React Context + Custom Hooks

**Why React Context is Sufficient:**

| Factor | Analysis |
|--------|----------|
| Data Type | Read-only, static JSON |
| Update Frequency | Rare (build-time updates) |
| Complexity | Low (no nested state) |
| Provider Count | 2-3 contexts max |

### State Architecture

```typescript
// contexts/RegistryContext.tsx
// Provides plugin data to entire app
const RegistryContext = createContext<RegistryData | null>(null);

// contexts/SearchContext.tsx
// Manages search state
const SearchContext = createContext<{
  query: string;
  setQuery: (q: string) => void;
  results: Plugin[];
  isSearching: boolean;
} | null>(null);

// contexts/ThemeContext.tsx
// Optional: Dark/light mode
const ThemeContext = createContext<ThemeContextType | null>(null);
```

### When NOT to Use Context

- **Component-local state:** Use `useState`
- **Derived state:** Use `useMemo`
- **Async data:** Use custom hooks with loading/error states

### Alternative: Zustand (If Needed)

If state complexity grows (e.g., filters, pagination):

```typescript
import { create } from 'zustand';

interface SearchStore {
  query: string;
  filters: FilterState;
  results: Plugin[];
  setQuery: (q: string) => void;
  setFilters: (f: FilterState) => void;
}
```

**Recommendation:** Start with Context, migrate to Zustand only if needed.

---

## Build & Deployment

### Build Process

```bash
# 1. Generate data from registry
npm run generate          # runs scripts/generate-data.ts

# 2. Build the site
npm run build             # Vite build

# 3. Output to dist/
dist/
├── index.html
├── assets/
├── data/
│   ├── plugins.json
│   ├── search-index.json
│   └── authors.json
└── [routes]
```

### Deployment Architecture

```
GitHub Actions
      │
      ▼
┌─────────────────────────────────────┐
│  CI Pipeline                        │
│  1. npm ci                          │
│  2. npm run generate                │
│  3. npm run build                   │
│  4. Deploy to GitHub Pages          │
└─────────────────────────────────────┘
      │
      ▼
GitHub Pages
(https://axolotl-pm.github.io/plugins/)
      │
      ▼
CDN (GitHub's CDN)
      │
      ▼
Users
```

### CI Configuration

```yaml
# .github/workflows/deploy-website.yml
name: Deploy Website

on:
  push:
    branches: [main]
    paths: ['website/**', 'registry/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install & Build
        run: |
          cd website
          npm ci
          npm run generate
          npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./website/dist
```

---

## Future Roadmap

### Phase 1: MVP (This Milestone)
- [x] Homepage with search
- [x] Plugin pages
- [x] Version pages
- [x] Author pages
- [x] Basic search (Fuse.js)

### Phase 2: Enhanced Discovery (v2)
- [ ] Categories/Tags system
- [ ] Advanced filters (API version, downloads, date)
- [ ] Sort options (recent, popular, alphabetical)
- [ ] Related plugins suggestions

### Phase 3: Trust & Verification (v3)
- [ ] Verified maintainer badges
- [ ] Security vulnerability tracking
- [ ] Deprecation notices
- [ ] Alternative download mirrors

### Phase 4: Community (v4)
- [ ] Organizations support
- [ ] Plugin ratings/reviews (curated)
- [ ] Favorite/watch plugins
- [ ] Weekly digest emails

### Phase 5: Analytics (v5)
- [ ] Download statistics
- [ ] Version adoption charts
- [ ] Plugin health metrics
- [ ] API documentation

### Extensibility Points

| Feature | Implementation Location |
|---------|------------------------|
| Categories | Add to `generate-data.ts`, add filter in SearchContext |
| Organizations | New `orgs/:name` route, new data file |
| Verified badges | Add to plugin.json, render in PluginHeader |
| Download stats | New `downloads.json` file, charts component |
| API docs | New `/api` section with OpenAPI spec |

---

## Implementation Order

### Recommended Sequence

**Week 1-2: Foundation**
1. Set up Vite + React + TypeScript project
2. Configure Tailwind CSS
3. Create design system components (Button, Input, Card, Badge)
4. Set up routing (React Router)
5. Create layouts (RootLayout, HomeLayout)

**Week 3-4: Core Pages**
1. Implement data generation script
2. Create HomePage with search
3. Create PluginPage with sidebar navigation
4. Create VersionPage with provenance display
5. Create AuthorPage

**Week 5-6: Search & Polish**
1. Implement Fuse.js search
2. Add URL query sync
3. Create search results page
4. Add loading states and error handling
5. Implement responsive design

**Week 7-8: Integration & Deploy**
1. Connect to generated JSON data
2. Set up GitHub Actions deployment
3. Configure GitHub Pages
4. Add SEO meta tags
5. Performance optimization

---

## Appendix: Technology Reference

### Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "fuse.js": "^7.0.0",
    "react-markdown": "^9.0.0",
    "prism-react-renderer": "^2.3.0",
    "lucide-react": "^0.300.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

### Type Definitions

```typescript
// types/registry.ts
interface Registry {
  plugins: Plugin[];
}

interface Plugin {
  id: string;
  name: string;
  description: string;
  upstream: {
    repository: string;
    branch: string;
  };
  storage?: {
    repository: string;
  };
  latestVersion: string;
  versions: Version[];
  downloads: number;
  author: string;
}

interface Version {
  version: string;
  status: 'published' | 'deprecated' | 'revoked';
  publishedAt: string;
  apiVersion?: string;
  sha256: string;
  provenance?: {
    type: 'github-attestation';
  };
  releaseTag: string;
  file: string;
}

interface Author {
  login: string;
  pluginCount: number;
  plugins: string[];
}
```

---

## Summary

| Aspect | Recommendation |
|--------|----------------|
| **Framework** | React 18 + TypeScript |
| **Build Tool** | Vite |
| **Styling** | Tailwind CSS |
| **Routing** | React Router v6 |
| **Search** | Fuse.js (client-side) |
| **State** | React Context + Custom Hooks |
| **Data** | Build-time JSON generation |
| **Hosting** | GitHub Pages |
| **Deployment** | GitHub Actions |

---

**Next Steps:**
1. Review and approve this architecture
2. Create GitHub project/board for implementation
3. Begin Phase 1: Project setup

