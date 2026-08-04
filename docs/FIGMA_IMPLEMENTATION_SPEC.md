# Figma Implementation Specification

**Generated from:** `design/figma-export/`
**Date:** 2026-08-04

---

## 1. Overall Hierarchy

```
Root
├── Design System Sidebar (Documentation)
│   ├── Foundation
│   │   ├── Brand
│   │   ├── Colors
│   │   ├── Typography
│   │   └── Spacing & Elevation
│   ├── Components
│   │   ├── Buttons
│   │   ├── Badges & Tags
│   │   ├── Inputs & Forms
│   │   ├── Cards & Lists
│   │   └── Navigation
│   └── Pages
│       ├── Home
│       ├── Plugin
│       ├── Version
│       ├── Search
│       └── Author
│
└── Application Pages (Previews)
    ├── page-home
    ├── page-plugin
    ├── page-version
    ├── page-search
    └── page-author
```

---

## 2. Per-Page Hierarchy

### Page — Home

```
page-home
└── Container (border-radius:16, overflow:hidden)
    ├── Header
    │   ├── Logo (size:20)
    │   ├── Nav: Plugins | Authors | Docs
    │   └── Auth: Sign in | Register
    │
    ├── Hero Section (padding:80px 40px 60px, radial-gradient)
    │   ├── Badge: ● 1,247 plugins available · API 4.0.0 compatible
    │   ├── H1: "The open plugin registry for PocketMine-MP" (fontSize:52, fontWeight:800)
    │   ├── Description: "Discover, install, and publish plugins..." (fontSize:16)
    │   ├── Search Bar (maxWidth:580, gap:10)
    │   │   ├── Search Input (borderRadius:12, padding:14px 18px)
    │   │   └── Search Button (gradient, borderRadius:12)
    │   └── Category Chips: Economy | Anti-Cheat | World | Chat | UI | Admin
    │
    ├── Statistics Row (display:grid, gridTemplateColumns:repeat(4, 1fr))
    │   ├── 1,247 / Plugins
    │   ├── 3.2M / Downloads
    │   ├── 892 / Authors
    │   └── 4.1k / Stars
    │
    └── Content Section (padding:48px 40px)
        ├── Featured Plugins Section
        │   ├── Section Title: "Featured Plugins" (fontSize:18)
        │   ├── View All Link
        │   └── Plugin Grid (gridTemplateColumns:repeat(3, 1fr), gap:12)
        │       └── Plugin Cards (padding:16, borderRadius:12)
        │
        └── Recently Updated Section
            ├── Section Title
            └── Plugin List
```

### Page — Plugin

```
page-plugin
└── Container (border-radius:16)
    ├── Breadcrumb (height:56, padding:0 40px)
    │   └── Plugins / {author} / {plugin} | Star (412) | Report
    │
    └── Content Grid (display:grid, gridTemplateColumns:1fr 296px)
        ├── Main Content (padding:40, borderRight:1px solid border)
        │   ├── Plugin Header
        │   │   ├── Icon (width:64, height:64, borderRadius:14)
        │   │   ├── Title (fontSize:26, fontWeight:700)
        │   │   ├── Badges: v2.4.1 | latest | ✓ Verified
        │   │   ├── Description
        │   │   └── Tags: Economy | PM 5.x | PHP 8.2+ | MIT
        │   │
        │   ├── Tabs (borderBottom)
        │   │   └── Overview | Versions | Dependencies | Config | License
        │   │
        │   └── Tab Content (Installation | Overview | etc.)
        │       ├── Installation Section
        │       │   ├── composer.json block
        │       │   └── Terminal block
        │       └── Overview Section
        │
        └── Sidebar (padding:24)
            ├── Install Button (gradient, full width)
            ├── Metadata List (8 items)
            └── Links Section
```

### Page — Version

```
page-version
└── Container
    ├── Breadcrumb
    │   └── Plugins / {author} / {plugin} / Versions
    │
    └── Content (padding:40)
        ├── Version Header
        │   ├── Title: "{plugin} — Version History"
        │   └── Stats: 24 releases · 248,341 total downloads
        │
        └── Content Grid (display:grid, gridTemplateColumns:360px 1fr)
            ├── Releases List (flexDirection:column, gap:1)
            │   └── Release Items (padding:14px 16px)
            │
            └── Version Content
                ├── Changelog Section
                └── Dependencies Section
```

### Page — Search

```
page-search
└── Container
    ├── Header
    │   └── Logo
    │
    └── Content (padding:40px 40px 20px)
        ├── Search Section
        │   ├── Search Input (flex:1, border:brand, boxShadow:focus)
        │   ├── Search Button
        │   └── Active Filters: Category | API | License | Sort
        │
        ├── Results Count: "Showing 47 results for "economy" in Economy"
        │
        └── Results List (flexDirection:column, gap:8)
            └── Result Cards (display:flex, padding:20, borderRadius:12)
                ├── Icon (width:44, height:44)
                ├── Content (flex:1)
                │   ├── Title + Author + Badges
                │   └── Description
                └── Stats (flexDirection:column, alignItems:flex-end)
                    ├── Downloads
                    └── Stars
        │
        └── Pagination (padding:32px 0)
```

### Page — Author

```
page-author
└── Container
    ├── Header
    │
    ├── Profile Header (padding:40px 40px 0, borderBottom)
    │   ├── Avatar (width:80, height:80, borderRadius:20)
    │   ├── Info
    │   │   ├── Name + Verified Badge
    │   │   ├── @username
    │   │   ├── Bio
    │   │   └── Links: 📍 Berlin | 🔗 devkira.dev | ⭐ github
    │   └── Follow Button
    │
    ├── Stats Row (display:flex, gap:32)
    │   ├── 24 / Plugins
    │   ├── 248k / Downloads/mo
    │   ├── 1.2M / Total DLs
    │   └── 342 / Stars
    │
    └── Content (padding:40)
        ├── Tabs: Plugins (24) | Pinned (3) | Activity
        │
        ├── Plugins Grid (gridTemplateColumns:repeat(3, 1fr))
        │
        └── Contribution Activity
            ├── Title
            └── GitHub-style Contribution Graph (52 weeks × 7 days)
```

---

## 3. Per-Section Hierarchy

### Header Component
- Height: 56px
- Padding: 0 40px
- Border: 1px solid border (bottom)
- Logo: size 20
- Nav items: fontSize 12
- Auth buttons: padding 6px 14px, fontSize 12

### Hero Section
- Padding: 80px 40px 60px
- Background: radial-gradient(ellipse 60% 40% at 50% 0%, brandDark 18%, transparent)
- Text align: center

### Statistics Row
- Grid: 4 columns, equal width
- Padding per stat: 24px 32px
- Font sizes: 28px (value), 12px (label)
- Border: 1px solid border (top and bottom)

### Plugin Card (in grid)
- Padding: 16px
- Border radius: 12px
- Icon: 32x32, borderRadius 8
- Title: fontSize 13, fontWeight 600
- Author: fontSize 10, mono
- Tags/badges inline

### Search Input
- Border radius: 12px
- Padding: 14px 18px
- Gap: 10px
- Border: 1px solid brand (focus)

### Buttons (Primary)
- Padding: 14px 24px
- Border radius: 12px
- Font size: 14px, fontWeight 600
- Background: linear-gradient(135deg, brandLight, brandDark)

### Breadcrumb
- Height: 56px
- Items separated by /
- Current item: brand color
- Other items: textSecondary

### Sidebar Metadata List
- Item padding: 8px 0
- Border: 1px solid borderSubtle (bottom)

### Contribution Graph
- Cell size: 10x10
- Border radius: 2px
- Gap: 3px
- 52 columns (weeks) × 7 rows (days)

---

## 4. Component Mapping

| Figma Component | React Component | File Location |
|-----------------|-----------------|---------------|
| page-home | HomeFeature | src/features/home/HomeFeature.tsx |
| page-home Header | Header | src/components/layout/Header/index.tsx |
| Hero Section | HomeHero | src/features/home/components/HomeHero/index.tsx |
| Statistics | HomeStats | src/features/home/components/HomeStats/index.tsx |
| Featured Plugins | HomeFeatured | src/features/home/components/HomeFeatured/index.tsx |
| Browse by Category | BrowseByCategory | src/features/home/components/BrowseByCategory/index.tsx |
| page-plugin | PluginFeature | src/features/plugin/PluginFeature.tsx |
| Plugin Header | PluginHeader | src/features/plugin/components/PluginHeader/index.tsx |
| Plugin Sidebar | PluginSidebar | src/features/plugin/components/PluginSidebar/index.tsx |
| page-version | VersionFeature | src/features/version/VersionFeature.tsx |
| page-search | SearchFeature | src/features/search/SearchFeature.tsx |
| page-author | AuthorFeature | src/features/author/AuthorFeature.tsx |

---

## 5. Responsive Structure

Based on Figma analysis, the design uses:

**Breakpoints (inferred from grid columns):**
- `repeat(4, 1fr)` - 4 columns (desktop)
- `repeat(3, 1fr)` - 3 columns (tablet)
- `repeat(2, 1fr)` - 2 columns (mobile)
- `1fr` - single column (mobile small)

**Max widths:**
- Container: standard responsive (max-w-7xl equivalent)
- Hero content: maxWidth 640px
- Search input: maxWidth 580px
- Description: maxWidth 480px

---

## 6. Layout Measurements

### Spacing Scale
| Name | Value |
|------|-------|
| xs | 2px |
| sm | 4px |
| md | 6px |
| lg | 8px |
| xl | 10px |
| 2xl | 12px |
| 3xl | 16px |
| 4xl | 20px |
| 5xl | 24px |
| 6xl | 32px |
| 7xl | 40px |
| 8xl | 48px |
| 9xl | 56px |
| 10xl | 60px |

### Typography Scale
| Name | Size | Weight | Line Height |
|------|------|--------|-------------|
| Hero | 52px | 800 | 1.1 |
| H1 | 36px | 700 | 1.1 |
| H2 | 28px | 700 | - |
| H3 | 22px | 700 | - |
| H4 | 18px | 600 | - |
| Body | 15px | 400 | 1.7 |
| Small | 14px | 400 | 1.6 |
| Caption | 12px | 400 | - |
| Label | 11px | 500 | - |
| Micro | 10px | 400 | - |
| Mono | 12px | mono | - |

### Border Radius
| Name | Value |
|------|-------|
| none | 0 |
| sm | 4px |
| md | 6px |
| lg | 8px |
| xl | 10px |
| 2xl | 12px |
| 3xl | 14px |
| 4xl | 16px |
| full | 9999px |

### Colors (Brand)
| Token | Light | Dark |
|-------|-------|------|
| brand | #084DE6 | #084DE6 |
| brandLight | #18B9EE | #18B9EE |
| brandDark | #084DE6 | #010B2E |
| brandBg | #EBF5FF | #010B2E |

---

## 7. Implementation Checklist

### HOME Page
- [ ] Header component with logo (size:20)
- [ ] Navigation: Plugins | Authors | Docs
- [ ] Auth buttons: Sign in | Register
- [ ] Hero section with radial gradient background
- [ ] Plugin count badge with success indicator
- [ ] Hero H1: "The open plugin registry for PocketMine-MP" with gradient text
- [ ] Hero description paragraph
- [ ] Search bar (maxWidth:580, borderRadius:12)
- [ ] Category chips (Economy, Anti-Cheat, World, Chat, UI, Admin)
- [ ] Statistics row (4 columns: Plugins, Downloads, Authors, Stars)
- [ ] Featured Plugins section with 3-column grid
- [ ] Plugin cards with icon, name, author, tags
- [ ] Recently Updated section

### PLUGIN Page
- [ ] Breadcrumb navigation with links
- [ ] Star and Report buttons
- [ ] 2-column layout (1fr 296px)
- [ ] Plugin icon (64x64, borderRadius:14)
- [ ] Plugin title (fontSize:26)
- [ ] Status badges (version, latest, verified)
- [ ] Description and tags
- [ ] Tab navigation (Overview, Versions, Dependencies, Config, License)
- [ ] Installation section with composer.json block
- [ ] Terminal block
- [ ] Overview with feature checklist
- [ ] Sidebar install button (gradient)
- [ ] Sidebar metadata (8 items)
- [ ] Sidebar links (GitHub, Issues, Changelog, Wiki)

### VERSION Page
- [ ] Breadcrumb navigation
- [ ] Version header with title and stats
- [ ] 2-column layout (360px 1fr)
- [ ] Release list with version items
- [ ] Release badges (patch, minor, major)
- [ ] Changelog section
- [ ] Dependencies section

### SEARCH Page
- [ ] Header with logo
- [ ] Search input with focus state
- [ ] Search button
- [ ] Active filter chips
- [ ] Results count text
- [ ] Result cards (icon, title, author, badges, description, stats)
- [ ] Highlighted first result
- [ ] Pagination controls

### AUTHOR Page
- [ ] Header with logo
- [ ] Author avatar (80x80, borderRadius:20)
- [ ] Author name with verified badge
- [ ] Username (@handle)
- [ ] Bio text
- [ ] Location, website, GitHub links
- [ ] Follow button
- [ ] Stats row (24/Plugins, 248k/Downloads, 1.2M/Total, 342/Stars)
- [ ] Tabs (Plugins, Pinned, Activity)
- [ ] 3-column plugin grid
- [ ] Contribution activity graph (52x7 cells)
- [ ] Graph legend (Less/More)

---

## 8. Components Requiring Complete Rewrite

| Component | Status | Reason |
|-----------|--------|--------|
| HomeHero | 🔴 Needs Complete Reconstruction | Hero structure doesn't match Figma (gradient text, badge, statistics integration) |
| HomeStats | 🔴 Needs Complete Reconstruction | Grid layout differs from Figma (4 columns vs 2) |
| HomeFeatured | 🟡 Needs Layout Rewrite | Section title size and structure need updating |
| BrowseByCategory | 🟡 Needs Layout Rewrite | Title styling needs updating |
| HomeEmptyState | 🟡 Needs Layout Rewrite | Uses hardcoded colors instead of theme |
| Header | 🟡 Needs Layout Rewrite | Navigation items differ from Figma |

---

## 9. Components That Can Be Reused

| Component | Status | Notes |
|-----------|--------|-------|
| Container | ✅ Reusable | Container width matches Figma structure |
| Button | ✅ Reusable | Needs gradient variant |
| Badge | ✅ Reusable | Tag/Badge structure matches |
| Avatar | ✅ Reusable | Can be used for author avatars |
| Link | ✅ Reusable | Standard link styling |
| Divider | ✅ Reusable | Border styling matches |
| Card | ✅ Reusable | Base card styling matches |
| Grid | ✅ Reusable | Can be configured for different columns |
| Spinner | ✅ Reusable | Loading indicator |
| ErrorState | ✅ Reusable | Error display |
| EmptyState | ✅ Reusable | Empty state display |
| Pagination | ✅ Reusable | Basic pagination structure |
| Input | ✅ Reusable | Search input base |

---

## 10. Implementation Order

1. **Theme System** - Verify/update color tokens match Figma
2. **Base Components** - Button (gradient), Badge, Avatar, Card
3. **Layout Components** - Header, Container, Grid, Divider
4. **Home Page**
   - HomeHero (most critical - main visual)
   - HomeStats
   - HomeFeatured
   - BrowseByCategory
   - HomeEmptyState
5. **Plugin Page**
   - PluginHeader
   - PluginSidebar
   - PluginTabs
   - PluginFeature
6. **Version Page**
   - VersionHeader
   - VersionChangelog
   - VersionFeature
7. **Search Page**
   - SearchBar
   - SearchFilters
   - SearchResults
   - SearchFeature
8. **Author Page**
   - AuthorHeader
   - AuthorStats
   - AuthorPlugins
   - AuthorContributionGraph
   - AuthorFeature

---

## 11. Key Visual Differences to Address

### Current vs Figma

| Current | Figma |
|---------|-------|
| Hero heading: 44px | Hero heading: 52px |
| Hero badge: "PocketMine Plugin Registry" | Hero badge: "1,247 plugins available" |
| Hero gradient: none | "PocketMine-MP" text has gradient |
| Stats: 3 columns | Stats: 4 columns |
| Stats labels: "Plugins", "Downloads/mo" | Stats labels: "Plugins", "Downloads", "Authors", "Stars" |
| Featured title: fontSize 15 | Featured title: fontSize 18 |
| Category chips with emoji | Category chips with emoji (same) |
| Search: text-sm | Search: fontSize 14 |
| Search: no focus border | Search: border:brand + boxShadow |

---

## 12. Missing Features

Based on Figma analysis, these features exist in Figma but may be missing from React:

1. **Gradient text effect** - "PocketMine-MP" in hero should have gradient fill
2. **Contribution graph** - GitHub-style activity visualization on Author page
3. **Hover/focus states** - Interactive elements need proper state styling
4. **Dark mode toggle** - Theme switching in header
5. **Star button** - On Plugin page
6. **Report button** - On Plugin page
7. **Follow button** - On Author page
8. **Copy button** - In composer.json block
9. **Filter chips** - Active state indicators
10. **Result highlighting** - First search result highlighted

---

*End of Specification*
