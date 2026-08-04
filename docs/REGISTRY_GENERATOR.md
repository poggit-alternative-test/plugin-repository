# Registry Generator Output Architecture — M8.2 Design Review

**Milestone:** M8.2 — Registry Generator
**Status:** Architecture Design
**Last Updated:** 2026-08-02

---

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Directory Structure](#directory-structure)
4. [File Responsibilities](#file-responsibilities)
5. [Data Ownership](#data-ownership)
6. [manifest.json](#manifestjson)
7. [Plugin JSON](#plugin-json)
8. [Version JSON](#version-json)
9. [README Handling](#readme-handling)
10. [Search Index](#search-index)
11. [Author Data](#author-data)
12. [Category Data](#category-data)
13. [Organization Data](#organization-data)
14. [Duplication Strategy](#duplication-strategy)
15. [Future Extensibility](#future-extensibility)
16. [Implementation Order](#implementation-order)

---

## Overview

The Registry Generator transforms the canonical Registry YAML into optimized JSON files for the Website.

```
Registry (YAML)                    Website (Static)
     │                                  ▲
     ▼                                  │
Registry Generator                       │
     │                                  │
     ▼                                  │
public/generated/                       │
     │                                  │
     └──────────────────────────────────┘
           Static JSON consumption
```

### Design Philosophy

1. **Generator is the contract** - The generator defines what data the Website can access
2. **Read-only optimization** - Data is pre-joined and pre-computed for fast consumption
3. **Separation of concerns** - Each file has a clear, single responsibility
4. **Minimal duplication** - Reference by ID where possible, duplicate only for performance
5. **Forward compatibility** - Design supports future fields without schema changes

---

## Design Principles

### Principle 1: Registry YAML is Source of Truth

```
Registry YAML (immutable) → Generator → Generated JSON (optimized)
```

- Registry YAML defines canonical state
- Generator transforms, not modifies
- Generated files are derived, not authoritative

### Principle 2: Website is Read-Only Consumer

```
Generated JSON → Website (static, read-only)
```

- Website never writes to registry
- All mutations happen through backend workflows
- Generator runs at build time, not runtime

### Principle 3: Performance Over DRY

```
Primary goal: Fast Website rendering
Secondary goal: Minimize duplication
```

- Pre-compute expensive operations (search index, aggregations)
- Duplicate data when it improves read performance
- Accept storage overhead for runtime speed

### Principle 4: Extensibility Without Migration

```
Design for addition, not modification
```

- New fields are additive, not breaking
- Deprecated fields marked, not removed
- Version field tracks schema evolution

---

## Directory Structure

```
public/generated/
│
├── manifest.json                 # Global metadata
│
├── plugins/                     # Plugin data
│   ├── index.json              # Plugin list (lightweight)
│   ├── topstats.json          # Individual plugin data
│   ├── economyapi.json
│   └── ...
│
├── versions/                    # Version data (flattened for easy access)
│   ├── topstats/
│   │   ├── 1.0.0.json
│   │   ├── 2.0.0.json
│   │   └── 2.1.0.json
│   └── economyapi/
│       ├── 1.0.0.json
│       └── 3.0.0.json
│
├── authors/                    # Author index and profiles
│   ├── index.json             # Author list with counts
│   └── {owner}.json          # Author profile with plugins
│
├── search/                     # Search optimization
│   ├── index.json             # Full search index
│   └── popular.json           # Popular/trending plugins
│
├── categories/                 # Category taxonomy
│   ├── index.json             # Category list
│   ├── admin.json             # Admin tools
│   ├── economy.json           # Economy plugins
│   └── ...
│
├── readmes/                   # Rendered README content
│   ├── {plugin}/
│   │   ├── latest.json       # Latest version README
│   │   └── 2.1.0.json       # Specific version README
│   └── ...
│
└── stats/                     # Statistics (future)
    ├── downloads.json
    └── trending.json
```

### Directory Purposes

| Directory | Purpose | Update Frequency |
|-----------|---------|------------------|
| `manifest.json` | Global metadata about generation | Every build |
| `plugins/` | Plugin identity and summary | On plugin change |
| `versions/` | Version-specific data | On version publish |
| `authors/` | Author profiles and plugin lists | On plugin change |
| `search/` | Pre-computed search index | Every build |
| `categories/` | Plugin categorization | On category change |
| `readmes/` | Rendered README content | On version publish |
| `stats/` | Download/usage statistics | Daily/hourly |

---

## File Responsibilities

### manifest.json

**Responsibility:** Global metadata about the generated dataset

**Consumers:** Build scripts, cache invalidation, debugging

### plugins/index.json

**Responsibility:** Lightweight list of all plugins for browsing

**Contains:**
- Plugin ID
- Plugin name
- Latest version
- Author
- Status (active/deprecated/revoked)

**Excludes:**
- Full version history
- README content
- Detailed metadata

### plugins/{plugin}.json

**Responsibility:** Complete plugin data for detail pages

**Contains:**
- All plugin metadata
- Version list summary
- Repository references
- Provenance summary
- Author reference

### versions/{plugin}/{version}.json

**Responsibility:** Complete version data for version pages

**Contains:**
- Artifact information
- Checksums
- Provenance details
- Release notes reference
- Dependencies

### search/index.json

**Responsibility:** Optimized for client-side fuzzy search

**Contains:**
- Searchable fields
- Boosted fields
- Metadata for result display

### authors/{owner}.json

**Responsibility:** Author profile and their plugins

**Contains:**
- Author metadata
- Plugin list with versions
- Statistics

---

## Data Ownership

### Ownership Matrix

| Data Element | Owned By | Consumed By |
|-------------|----------|-------------|
| Plugin identity | `plugins/{id}.json` | versions, authors, search |
| Version data | `versions/{id}/{v}.json` | plugins |
| Author info | `authors/{owner}.json` | plugins, versions |
| README content | `readmes/{id}/{v}.json` | versions |
| Search terms | `search/index.json` | (consumed by website) |

### Reference Pattern

```
plugins/topstats.json references:
  - author: "nicholass003" → authors/nicholass003.json
  - latestVersion: "2.1.0" → versions/topstats/2.1.0.json
  - versions: ["1.0.0", "2.0.0", "2.1.0"] → versions/topstats/*.json

versions/topstats/2.1.0.json references:
  - author: "nicholass003" → authors/nicholass003.json
  - readme: "latest" → readmes/topstats/latest.json

authors/nicholass003.json references:
  - plugins: ["topstats", "economyapi"] → plugins/*.json
```

---

## manifest.json

### Design

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-02T10:30:00Z",
  "registryCommit": "a1b2c3d4e5f6...",
  "generatorVersion": "1.0.0",
  "pluginCount": 156,
  "versionCount": 423,
  "authorCount": 89,
  "categoryCount": 12,
  "indexes": {
    "plugins": "2026-08-02T10:30:00Z",
    "versions": "2026-08-02T10:30:00Z",
    "search": "2026-08-02T10:30:00Z",
    "authors": "2026-08-02T10:30:00Z"
  }
}
```

### Field Explanations

| Field | Purpose | Why Needed |
|-------|---------|------------|
| `schemaVersion` | Schema identifier | Detect format changes, cache invalidation |
| `generatedAt` | Generation timestamp | Age of data, cache freshness |
| `registryCommit` | Source commit hash | Traceability, debugging, reproducibility |
| `generatorVersion` | Generator version | Debug generation issues, deprecation warnings |
| `pluginCount` | Total plugins | Quick stats, validation |
| `versionCount` | Total versions | Quick stats, validation |
| `authorCount` | Total authors | Quick stats, validation |
| `categoryCount` | Total categories | Quick stats, validation |
| `indexes` | Individual index timestamps | Incremental regeneration, debugging |

### Future Extensions

```json
{
  "schemaVersion": 2,
  "statistics": {
    "totalDownloads": 12345678,
    "last24h": 5432,
    "last7d": 12345
  },
  "deprecations": {
    "warnings": [],
    "breaking": []
  }
}
```

---

## Plugin JSON

### plugins/index.json (Plugin List)

**Purpose:** Lightweight list for browsing, pagination, filtering

```json
{
  "plugins": [
    {
      "id": "topstats",
      "name": "TopStats",
      "summary": "Server statistics with web dashboard",
      "latestVersion": "2.1.0",
      "status": "published",
      "author": "nicholass003",
      "downloads": 15234,
      "updatedAt": "2026-08-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

### plugins/{plugin}.json (Complete Plugin)

```json
{
  "id": "topstats",
  "name": "TopStats",

  "summary": "Server statistics with web dashboard",
  "description": "Full description for SEO...",

  "upstream": {
    "repository": "nicholass003/TopStats",
    "branch": "main"
  },

  "storage": {
    "repository": "axolotl-pm-pl/TopStats"
  },

  "author": "nicholass003",

  "status": "published",

  "versions": [
    {
      "version": "2.1.0",
      "status": "published",
      "publishedAt": "2026-08-01T10:00:00Z",
      "apiVersion": "5.0.0"
    },
    {
      "version": "2.0.0",
      "status": "published",
      "publishedAt": "2026-07-01T10:00:00Z",
      "apiVersion": "5.0.0"
    }
  ],

  "latestVersion": "2.1.0",

  "latestRelease": {
    "version": "2.1.0",
    "file": "TopStats.phar",
    "sha256": "a1b2c3d4e5f6...",
    "size": 245000,
    "publishedAt": "2026-08-01T10:00:00Z"
  },

  "categories": ["stats", "analytics"],

  "tags": ["stats", "web", "dashboard", "discord"],

  "license": "MIT",

  "homepage": "https://github.com/nicholass003/TopStats",
  "issues": "https://github.com/nicholass003/TopStats/issues",
  "source": "https://github.com/nicholass003/TopStats",

  "downloads": {
    "total": 15234,
    "monthly": 2345,
    "weekly": 543
  },

  "verified": {
    "githubAttestation": true,
    "reviewer": "axolotl-reviewer"
  },

  "metadata": {
    "mainClass": "TopStats\\TopStats",
    "apiVersion": "5.0.0",
    "loadOrder": "STARTUP",
    "dependencies": {
      "poggit/pocketmine-api": "^5.0.0"
    }
  },

  "createdAt": "2026-06-15T10:00:00Z",
  "updatedAt": "2026-08-01T10:00:00Z"
}
```

### Field Categories

#### Identity Fields
- `id`, `name` - Core identity
- `author` - Reference to author file

#### Status Fields
- `status` - `published`, `deprecated`, `revoked`
- `latestVersion` - Current recommended version

#### Content Fields
- `summary` - Short description (SEO)
- `description` - Full description (if provided)
- `categories` - Organized tags
- `tags` - Search keywords

#### Repository Fields
- `upstream` - Developer repository
- `storage` - Axolotl storage repository
- `homepage`, `issues`, `source` - External links

#### Version Fields
- `versions` - Array of version summaries
- `latestRelease` - Complete latest version data (duplicated for performance)

#### Provenance Fields
- `verified.githubAttestation` - Boolean from registry
- `verified.reviewer` - Who approved

#### Statistics Fields
- `downloads` - Download counts (future)

#### Metadata Fields
- `metadata.*` - Extracted from plugin.yml
- `license` - License type
- `dependencies` - PocketMine API version

---

## Version JSON

### versions/{plugin}/{version}.json

```json
{
  "plugin": "topstats",
  "version": "2.1.0",

  "status": "published",
  "apiVersion": "5.0.0",

  "release": {
    "tag": "v2.1.0",
    "publishedAt": "2026-08-01T10:00:00Z",
    "changelog": "readmes/topstats/2.1.0.json"
  },

  "artifact": {
    "file": "TopStats.phar",
    "sha256": "a1b2c3d4e5f6...",
    "size": 245000,
    "downloadUrl": "https://github.com/axolotl-pm-pl/TopStats/releases/download/v2.1.0/TopStats.phar"
  },

  "checksums": {
    "sha256": "a1b2c3d4e5f6...",
    "sha512": "a1b2c3d4e5f6...a1b2c3d4e5f6...",
    "md5": "a1b2c3d4e5f6..."
  },

  "review": {
    "pullRequest": 58,
    "reviewer": "axolotl-reviewer",
    "approvedAt": "2026-07-20T15:30:00Z"
  },

  "storage": {
    "repository": "axolotl-pm-pl/TopStats",
    "commit": "b93f1e987654321..."
  },

  "source": {
    "upstream": "nicholass003/TopStats",
    "commit": "b93f1e987654321..."
  },

  "provenance": {
    "type": "github-attestation",
    "verified": true
  },

  "dependencies": {
    "runtime": {
      "poggit/pocketmine-api": "^5.0.0"
    },
    "suggested": {
      "sof3/await-generator": "^3.0.0"
    }
  },

  "manifest": {
    "name": "TopStats",
    "version": "2.1.0",
    "main": "TopStats\\TopStats",
    "api": "5.0.0",
    "loadOrder": "STARTUP",
    "author": "nicholass003",
    "description": "Server statistics plugin"
  },

  "readme": "readmes/topstats/2.1.0.json"
}
```

### Field Categories

#### Core Identity
- `plugin`, `version` - Unique identifier

#### Status
- `status` - Lifecycle status
- `apiVersion` - PocketMine API version

#### Release Information
- `release.tag` - GitHub release tag
- `release.publishedAt` - Publication timestamp
- `release.changelog` - Reference to changelog

#### Artifact Information
- `artifact.file` - PHAR filename
- `artifact.sha256` - Integrity hash
- `artifact.size` - File size in bytes
- `artifact.downloadUrl` - Direct download URL

#### Checksums
- `checksums.*` - Multiple hash formats

#### Provenance Chain
- `review` - Who approved, when, which PR
- `storage` - Where source is preserved
- `source` - Original upstream reference
- `provenance` - Attestation type

#### Dependencies
- `dependencies.runtime` - Required dependencies
- `dependencies.suggested` - Optional dependencies

#### Content
- `manifest` - Extracted plugin.yml data
- `readme` - Reference to rendered README

---

## README Handling

### Decision: Independent Storage

README content is stored independently from version JSON.

**Reasoning:**

| Approach | Pros | Cons |
|----------|------|------|
| **Independent (recommended)** | Lazy loading, cacheable, version-specific | Extra file, reference needed |
| Embedded in version JSON | Single file, no reference | Large file, slow loading, redundant |

### Structure

```
readmes/
└── {plugin}/
    ├── latest.json      # Symlink or copy of latest
    ├── 2.1.0.json
    ├── 2.0.0.json
    └── 1.0.0.json
```

### readmes/{plugin}/{version}.json

```json
{
  "plugin": "topstats",
  "version": "2.1.0",
  "content": "<h1>TopStats</h1>\n<p>Server statistics...</p>",
  "html": "<div class=\"markdown-body\">...</div>",
  "plaintext": "TopStats\nServer statistics...",
  "wordCount": 542,
  "sections": [
    { "id": "features", "title": "Features", "level": 2 },
    { "id": "installation", "title": "Installation", "level": 2 },
    { "id": "configuration", "title": "Configuration", "level": 2 }
  ],
  "links": [
    { "text": "GitHub", "url": "https://github.com/..." },
    { "text": "Discord", "url": "https://discord.gg/..." }
  ],
  "images": [
    { "alt": "Stats dashboard", "url": "/images/topstats-dashboard.png" }
  ]
}
```

### Rendering Strategy

1. **Lazy load** - Only load README when user scrolls to section
2. **Pre-render** - HTML generated at build time (no client markdown)
3. **Cache aggressively** - READMEs rarely change
4. **Strip dangerous content** - No script tags, no external images (configurable)

---

## Search Index

### search/index.json

**Purpose:** Pre-computed index for client-side fuzzy search

```json
{
  "version": 1,
  "generatedAt": "2026-08-02T10:30:00Z",
  "plugins": [
    {
      "id": "topstats",
      "name": "TopStats",
      "nameNormalized": "topstats",
      "nameKeywords": ["top", "stats", "statistics"],
      "summary": "Server statistics with web dashboard",
      "description": "Full description for deeper search...",
      "author": "nicholass003",
      "authorNormalized": "nicholass003",
      "categories": ["stats", "analytics"],
      "tags": ["stats", "web", "dashboard", "discord"],
      "tagsNormalized": ["stats", "web", "dashboard", "discord"],
      "versionCount": 5,
      "latestVersion": "2.1.0",
      "status": "published",
      "license": "MIT",
      "downloads": 15234,
      "popularity": 0.85,
      "updatedAt": "2026-08-01T10:00:00Z"
    }
  ],
  "metadata": {
    "count": 156,
    "fields": ["name", "summary", "description", "tags", "author"]
  }
}
```

### Search Fields with Weights

| Field | Weight | Reasoning |
|-------|--------|-----------|
| `name` | 0.40 | Exact plugin name is most relevant |
| `nameKeywords` | 0.20 | Alternative names, aliases |
| `summary` | 0.15 | Short description |
| `tags` | 0.15 | Category keywords |
| `description` | 0.05 | Full description (lower weight, more noise) |
| `author` | 0.05 | Find author's plugins |

### Normalization

All text fields are normalized for search:
- Lowercase
- No special characters
- Trimmed whitespace
- Accent folding (é → e)

### Popularity Score

```json
{
  "popularity": 0.85
}
```

Calculated from:
- Download count (weighted recent)
- Version count
- Category prominence

Range: 0.0 to 1.0

### search/popular.json

**Purpose:** Pre-computed trending/popular list

```json
{
  "trending": [
    { "id": "topstats", "score": 95, "delta": "+12%" },
    { "id": "economyapi", "score": 87, "delta": "+8%" }
  ],
  "recentlyUpdated": [
    { "id": "topstats", "version": "2.1.0", "updatedAt": "2026-08-01" }
  ],
  "newPlugins": [
    { "id": "newplugin", "createdAt": "2026-07-30" }
  ]
}
```

---

## Author Data

### authors/index.json

```json
{
  "authors": [
    {
      "login": "nicholass003",
      "pluginCount": 3,
      "latestUpdate": "2026-08-01T10:00:00Z"
    }
  ],
  "count": 89
}
```

### authors/{owner}.json

```json
{
  "login": "nicholass003",

  "profile": {
    "name": "nicholass003",
    "bio": "PocketMine plugin developer",
    "avatar": "https://avatars.githubusercontent.com/u/12345678",
    "github": "https://github.com/nicholass003"
  },

  "plugins": [
    {
      "id": "topstats",
      "name": "TopStats",
      "summary": "Server statistics with web dashboard",
      "latestVersion": "2.1.0",
      "status": "published"
    },
    {
      "id": "economyapi",
      "name": "EconomyAPI",
      "summary": "Full economy system",
      "latestVersion": "3.0.0",
      "status": "published"
    }
  ],

  "statistics": {
    "pluginCount": 3,
    "versionCount": 12,
    "totalDownloads": 45678,
    "firstPluginAt": "2026-06-15"
  },

  "verified": false
}
```

### Author Verification (Future)

```json
{
  "verified": true,
  "verificationMethod": "github-organization",
  "verifiedAt": "2026-08-15T10:00:00Z"
}
```

---

## Category Data

### categories/index.json

```json
{
  "categories": [
    {
      "id": "admin",
      "name": "Admin Tools",
      "slug": "admin",
      "description": "Server administration and management plugins",
      "icon": "shield",
      "pluginCount": 23
    },
    {
      "id": "economy",
      "name": "Economy",
      "slug": "economy",
      "description": "Economy, shops, and currency plugins",
      "icon": "coins",
      "pluginCount": 45
    }
  ]
}
```

### categories/{slug}.json

```json
{
  "id": "admin",
  "name": "Admin Tools",
  "slug": "admin",

  "plugins": [
    {
      "id": "essentialsx",
      "name": "EssentialsX",
      "summary": "Essential commands and features",
      "latestVersion": "2.0.0"
    }
  ],

  "relatedCategories": ["chat", "teleport"],

  "metadata": {
    "description": "...",
    "icon": "shield",
    "color": "#4F46E5"
  }
}
```

### Default Categories

| Category | Slug | Description |
|----------|------|-------------|
| Admin Tools | `admin` | Server administration |
| Economy | `economy` | Economy, shops, banks |
| Gameplay | `gameplay` | Game mechanics |
| Teleport | `teleport` | Warps, portals, homes |
| Chat | `chat` | Chat formatting, channels |
| Protection | `protection` | Anti-grief, permissions |
| World | `world` | World management, generators |
| Misc | `misc` | Other plugins |

---

## Organization Data

### organizations/index.json (Future)

```json
{
  "organizations": [
    {
      "id": "sof3",
      "name": "SOF3 Development",
      "slug": "sof3",
      "memberCount": 1
    }
  ]
}
```

### organizations/{slug}.json (Future)

```json
{
  "id": "sof3",
  "name": "SOF3 Development",
  "slug": "sof3",

  "profile": {
    "description": "Official plugins from SOF3",
    "avatar": "https://...",
    "website": "https://sof3.dev"
  },

  "members": [
    {
      "login": "sof3",
      "role": "owner"
    }
  ],

  "plugins": [
    {
      "id": "await-generator",
      "name": "Await Generator",
      "role": "maintainer"
    }
  ],

  "verified": true
}
```

---

## Duplication Strategy

### Principle

> "Duplicate for performance, reference for consistency."

### What to Duplicate

| Data | Location | Reason |
|------|----------|--------|
| `latestVersion` | plugins/{id}.json | Avoid joining versions list |
| `latestRelease.*` | plugins/{id}.json | Fast homepage rendering |
| `author` | versions/{id}/{v}.json | Avoid joining authors |
| `plugin` | versions/{id}/{v}.json | Avoid joining plugins |
| `status` | versions/{id}/{v}.json | Quick filtering |

### What to Reference

| Data | Reference Pattern | Reason |
|------|-------------------|--------|
| Author profile | `author: "nicholass003"` → `authors/nicholass003.json` | Single source of truth |
| Full version list | `versions` array → `versions/{id}/*.json` | Reduce file size |
| README | `readme: "readmes/..."` | Lazy load, cache separately |

### Example: Plugin with Duplication

```json
// plugins/topstats.json - Contains some duplicated version data
{
  "id": "topstats",
  "latestVersion": "2.1.0",
  "versions": [
    {
      "version": "2.1.0",
      "publishedAt": "2026-08-01",
      "status": "published"
    }
  ],
  "author": "nicholass003"
  // latestRelease.* is duplicated from versions/topstats/2.1.0.json
}
```

```json
// versions/topstats/2.1.0.json - Contains author reference
{
  "plugin": "topstats",
  "version": "2.1.0",
  "author": "nicholass003",  // Reference to authors/nicholass003.json
  // Full artifact, checksums, provenance data
}
```

### Duplication vs Reference Decision Tree

```
Is this data frequently displayed together with this entity?
    │
    ├── YES → Is the entity small (<1KB)?
    │       │
    │       ├── YES → Duplicate it
    │       │
    │       └── NO → Consider partial duplication
    │
    └── NO → Reference by ID only
```

---

## Future Extensibility

### Version Field Pattern

Every generated file includes `schemaVersion` or `generatedVersion`:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-02T10:30:00Z"
}
```

### Adding New Fields (Non-Breaking)

```json
// Original
{
  "name": "TopStats",
  "status": "published"
}

// Additive field (non-breaking)
{
  "name": "TopStats",
  "status": "published",
  "verified": true,           // NEW: Non-breaking addition
  "securityScore": 95        // NEW: Non-breaking addition
}
```

### Deprecation Pattern

```json
{
  "name": "TopStats",
  "deprecatedField": "value",
  "_deprecated": {
    "deprecatedField": {
      "since": "2026-09-01",
      "reason": "Replaced by newField",
      "removalAt": "2027-01-01"
    }
  }
}
```

### Extensibility Matrix

| Future Feature | Implementation | File(s) |
|---------------|---------------|---------|
| Verified maintainers | `verified: true` | `authors/{owner}.json` |
| Download statistics | `downloads: {...}` | `plugins/{id}.json` |
| Security advisories | `securityAdvisories: [...]` | `versions/{id}/{v}.json` |
| Artifact mirrors | `mirrors: [...]` | `versions/{id}/{v}.json` |
| Organizations | `organizations/` directory | New directory |
| Featured plugins | `featured: true` | `plugins/{id}.json` |
| Alternative releases | `alternatives: [...]` | `versions/{id}/{v}.json` |
| API documentation | `docs: {...}` | `plugins/{id}.json` |

### Schema Versioning

```json
// manifest.json - Schema evolution
{
  "schemaVersion": 2,
  "previousSchemaVersion": 1,
  "migrationNotes": "Added verifiedMaintainers field"
}
```

### Future File Additions

```
public/generated/
├── manifest.json
├── plugins/
├── versions/
├── authors/
├── search/
├── categories/
├── organizations/         // FUTURE: Organization data
├── stats/                // FUTURE: Statistics data
│   ├── downloads.json     // FUTURE: Download statistics
│   ├── trending.json     // FUTURE: Trending plugins
│   └── api-versions.json // FUTURE: API version breakdown
├── advisories/           // FUTURE: Security advisories
│   ├── index.json
│   └── {plugin}/
│       └── {version}.json
└── mirrors/              // FUTURE: Download mirrors
    └── index.json
```

---

## Implementation Order

### Phase 1: Core Generation (This Milestone)

1. **manifest.json** - Global metadata structure
2. **plugins/index.json** - Plugin list generation
3. **plugins/{plugin}.json** - Complete plugin data
4. **versions/{plugin}/{version}.json** - Version data
5. **Basic test fixtures** - Verify output format

### Phase 2: Search Optimization

6. **search/index.json** - Search index generation
7. **search/popular.json** - Trending/recent data
8. **Search integration tests** - Verify index quality

### Phase 3: Supporting Data

9. **authors/index.json** - Author list
10. **authors/{owner}.json** - Author profiles
11. **categories/index.json** - Category taxonomy
12. **categories/{slug}.json** - Category plugins

### Phase 4: Content

13. **readmes/{plugin}/{version}.json** - Rendered READMEs
14. **README rendering pipeline** - Markdown → HTML
15. **Content security** - Strip dangerous HTML

### Phase 5: Enhancements

16. **Statistics generation** - Download counts, trending
17. **Verification badges** - Verified author, verified plugin
18. **Deprecation notices** - Warning banners in output

### Phase 6: Future-Ready

19. **Organization data** - Organization profiles
20. **Security advisories** - Advisory data
21. **Mirror information** - Alternative download sources

---

## Summary

### Generated Directory Structure

```
public/generated/
├── manifest.json          # Global metadata
├── plugins/
│   ├── index.json        # Plugin list
│   └── {plugin}.json     # Complete plugin
├── versions/
│   └── {plugin}/
│       └── {version}.json
├── authors/
│   ├── index.json
│   └── {owner}.json
├── search/
│   ├── index.json        # Search index
│   └── popular.json      # Trending
├── categories/
│   ├── index.json
│   └── {slug}.json
├── readmes/
│   └── {plugin}/
│       └── {version}.json
└── stats/                # Future
    └── downloads.json
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Independent README files | Lazy loading, caching, version-specific |
| Duplicated `latestRelease` | Fast homepage, avoid joins |
| Referenced `author` | Single source of truth |
| Normalized search fields | Consistent, fast search |
| Popularity score | Pre-computed ranking |
| Schema version field | Forward compatibility |
| Category directory | Organized, extensible |

### Data Ownership Summary

| Data | Owned By | Consumed By |
|------|---------|-------------|
| Plugin identity | `plugins/` | versions, authors, search |
| Version data | `versions/` | plugins |
| Author profiles | `authors/` | plugins, versions |
| README content | `readmes/` | versions |
| Search data | `search/` | (consumed by website) |

---

**Next Steps:**
1. Review and approve this architecture
2. Implement M8.2: Registry Generator design
3. Generate test fixtures
4. Validate output format

