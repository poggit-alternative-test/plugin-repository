# Figma DOM Structure Specification

**Generated from:** `design/figma-export/`
**Date:** 2026-08-04

---

## Page — Home

```
section#page-home
└── div (Container)
    │
    ├── div (Header)
    │   └── div (flex)
    │       ├── div (Logo Group)
    │       │   ├── S (Logo Icon - size:20)
    │       │   └── span "Axolotl PM"
    │       │
    │       ├── div (Navigation - flex)
    │       │   ├── span "Plugins"
    │       │   ├── span "Authors"
    │       │   └── span "Docs"
    │       │
    │       └── div (Auth - flex, marginLeft:auto)
    │           ├── span "Sign in"
    │           └── span "Register"
    │
    ├── div (Hero - padding:80px 40px 60px, radial-gradient, textAlign:center)
    │   ├── div (Badge - inline-flex, borderRadius:999)
    │   │   ├── span (●)
    │   │   └── text " 1,247 plugins available · API 4.0.0 compatible"
    │   │
    │   ├── h1 (fontSize:52)
    │   │   └── span "The open plugin registry for PocketMine-MP"
    │   │       └── span (gradient text)
    │   │
    │   ├── p (Description)
    │   │   └── text "Discover, install, and publish plugins. Cryptographically verified. Community maintained."
    │   │
    │   ├── div (Search Bar - maxWidth:580)
    │   │   ├── div (Search Input - flex:1, borderRadius:12)
    │   │   │   ├── span (⌕)
    │   │   │   └── text " Search plugins, authors, categories…"
    │   │   └── button "Search"
    │   │
    │   └── div (Category Chips - flex, justifyContent:center, flexWrap:wrap)
    │       ├── span "Economy"
    │       ├── span "Anti-Cheat"
    │       ├── span "World"
    │       ├── span "Chat"
    │       ├── span "UI"
    │       └── span "Admin"
    │
    ├── div (Statistics Row - grid, gridTemplateColumns:repeat(4, 1fr))
    │   ├── div (Stat)
    │   │   ├── div "1,247"
    │   │   └── div "Plugins"
    │   ├── div (Stat)
    │   │   ├── div "3.2M"
    │   │   └── div "Downloads"
    │   ├── div (Stat)
    │   │   ├── div "892"
    │   │   └── div "Authors"
    │   └── div (Stat)
    │       ├── div "4.1k"
    │       └── div "Stars"
    │
    └── div (Content - padding:48px 40px)
        │
        ├── div (Featured Section)
        │   ├── div (Section Header - flex, space-between)
        │   │   ├── h2 "Featured Plugins"
        │   │   └── span "View all →"
        │   │
        │   └── div (Plugin Grid - grid, gridTemplateColumns:repeat(3, 1fr), gap:12)
        │       ├── div (Plugin Card)
        │       │   ├── div (Card Header - flex)
        │       │   │   ├── div (Icon - 32x32)
        │       │   │   ├── div (Info)
        │       │   │   │   ├── div (Name)
        │       │   │   │   └── div (Author)
        │       │   │   └── div (Tag)
        │       │   ├── p (Description)
        │       │   └── div (Footer - flex)
        │       │       ├── code (Version)
        │       │       └── span (Downloads)
        │       │
        │       ├── div (Plugin Card) - repeat 6 times
        │       └── ...
        │
        └── div (Browse Section - padding:0 40px 48px)
            ├── h2 "Browse by Category"
            └── div (Category Grid - grid, gridTemplateColumns:repeat(4, 1fr), gap:10)
                ├── div (Category Card)
                │   ├── span (Icon)
                │   └── div (Info)
                │       ├── div (Category Name)
                │       └── div (Plugin Count)
                │
                ├── div (Category Card) - repeat 8 times
                └── ...
```

---

## Page — Plugin

```
section#page-plugin
└── div (Container)
    │
    ├── div (Breadcrumb Header - height:56)
    │   └── div (flex)
    │       ├── div (Breadcrumb Items - flex)
    │       │   ├── span "Plugins"
    │       │   ├── span "/"
    │       │   ├── span "devkira"
    │       │   └── span "/"
    │       │       └── span "economycore"
    │       │
    │       └── div (Actions - marginLeft:auto, flex)
    │           ├── span "⭐ Star (412)"
    │           └── span "Report"
    │
    └── div (Content Grid - display:grid, gridTemplateColumns:1fr 296px)
        │
        ├── div (Main Content - padding:40, borderRight)
        │   │
        │   ├── div (Plugin Header - flex, gap:16)
        │   │   ├── div (Plugin Icon - 64x64, borderRadius:14)
        │   │   └── div (Info - flex:1)
        │   │       ├── div (Title Row - flex, flexWrap:wrap)
        │   │       │   ├── h1 "EconomyCore"
        │   │       │   ├── Badge "v2.4.1"
        │   │       │   ├── Badge "latest"
        │   │       │   └── Badge "✓ Verified"
        │   │       ├── p (Description)
        │   │       └── div (Tags - flex, flexWrap:wrap)
        │   │           ├── Badge "Economy"
        │   │           ├── Badge "PM 5.x"
        │   │           ├── Badge "PHP 8.2+"
        │   │           └── Badge "MIT"
        │   │
        │   ├── div (Tabs - flex, borderBottom)
        │   │   ├── button "Overview"
        │   │   ├── button "Versions"
        │   │   ├── button "Dependencies"
        │   │   ├── button "Config"
        │   │   └── button "License"
        │   │
        │   └── div (Tab Content - flexDirection:column, gap:20)
        │       │
        │       ├── h2 "Installation"
        │       │
        │       ├── div (Code Block - composer.json)
        │       │   ├── div (Header - flex)
        │       │   │   ├── span "composer.json"
        │       │   │   └── button "⧉ Copy"
        │       │   └── div (Code)
        │       │       └── text '"devkira/economycore": "^2.4"'
        │       │
        │       ├── div (Terminal Block)
        │       │   ├── div (Header)
        │       │   │   └── span "Terminal"
        │       │   └── div (Command)
        │       │       └── text '$ composer require devkira/economycore'
        │       │
        │       ├── h2 "Overview"
        │       ├── p (Full Description)
        │       │
        │       └── div (Feature Grid - grid, gridTemplateColumns:1fr 1fr, gap:10)
        │           ├── div (Feature Item - flex)
        │           │   ├── span (✓)
        │           │   └── text "Multi-currency support"
        │           ├── div (Feature Item)
        │           │   ├── span (✓)
        │           │   └── text "Async DB operations"
        │           ├── div (Feature Item)
        │           │   ├── span (✓)
        │           │   └── text "Redis caching"
        │           └── ... (8 items total)
        │
        └── div (Sidebar - padding:24, flexDirection:column, gap:24)
            │
            ├── button (Install - gradient, full width)
            │   └── text "↓ Install Plugin"
            │
            ├── div (Metadata List - flex:column, gap:16)
            │   ├── div (Metadata Item - flex, space-between)
            │   │   ├── span "Version"
            │   │   └── span "2.4.1"
            │   ├── div (Metadata Item)
            │   │   ├── span "Published"
            │   │   └── span "2 days ago"
            │   ├── div (Metadata Item)
            │   │   ├── span "Author"
            │   │   └── span "devkira"
            │   ├── div (Metadata Item)
            │   │   ├── span "License"
            │   │   └── span "MIT"
            │   ├── div (Metadata Item)
            │   │   ├── span "PHP"
            │   │   └── span "≥ 8.2"
            │   ├── div (Metadata Item)
            │   │   ├── span "PM API"
            │   │   └── span "4.0.0, 5.x"
            │   ├── div (Metadata Item)
            │   │   ├── span "Downloads"
            │   │   └── span "248,341"
            │   └── div (Metadata Item)
            │       ├── span "Dependents"
            │       └── span "47 plugins"
            │
            └── div (Links Section)
                ├── div (Label) "Links"
                └── div (Link List - flexDirection:column, gap:6)
                    ├── a "GitHub Repository ↗"
                    ├── a "Issue Tracker ↗"
                    ├── a "Changelog ↗"
                    └── a "Wiki ↗"
```

---

## Page — Version

```
section#page-version
└── div (Container)
    │
    ├── div (Breadcrumb Header - height:56)
    │   └── div (flex)
    │       ├── span "Plugins"
    │       ├── span "/"
    │       ├── span "devkira"
    │       ├── span "/"
    │       ├── span "economycore"
    │       └── span "/"
    │           └── span "Versions"
    │
    └── div (Content - padding:40)
        │
        ├── div (Version Header - flex, gap:8, marginBottom:32)
        │   └── div
        │       ├── h1 "EconomyCore — Version History"
        │       └── p "24 releases · 248,341 total downloads"
        │
        └── div (Content Grid - display:grid, gridTemplateColumns:360px 1fr, gap:32)
            │
            ├── div (Releases Sidebar)
            │   ├── div (Label) "Releases"
            │   └── div (Release List - flexDirection:column, gap:1)
            │       ├── div (Release Item - padding:14px 16px, borderRadius:10)
            │       │   ├── div (flex:1)
            │       │   │   ├── div (flex, gap:8)
            │       │   │   │   ├── code "v2.4.1"
            │       │   │   │   ├── Badge "latest"
            │       │   │   │   └── Badge "patch"
            │       │   │   └── div "2026-07-31 · ↓ 12.4k"
            │       │   └── span "›" (highlighted)
            │       │
            │       ├── div (Release Item)
            │       │   └── ...
            │       └── ... (5 releases)
            │
            └── div (Version Content)
                │
                ├── div (Version Header - flex, gap:12, marginBottom:20)
                │   ├── code "v2.4.1"
                │   ├── Badge "latest"
                │   ├── Badge "patch"
                │   └── span "Released 2026-07-31" (marginLeft:auto)
                │
                ├── div (Download Row - flex, gap:10, marginBottom:24)
                │   ├── button "↓ Download .phar"
                │   └── button "⧉ Copy install command"
                │
                ├── div (Changelog Section)
                │   ├── div (Label) "Changelog"
                │   └── div (Changelog List - flexDirection:column, gap:6)
                │       ├── div (Changelog Item - flex, gap:10)
                │       │   ├── Badge "fix"
                │       │   └── text "Fixed race condition..."
                │       ├── div (Changelog Item)
                │       │   ├── Badge "fix"
                │       │   └── text "Resolved NaN balance..."
                │       ├── div (Changelog Item)
                │       │   ├── Badge "perf"
                │       │   └── text "Reduced Redis round-trips..."
                │       └── div (Changelog Item)
                │           ├── Badge "fix"
                │           └── text "Corrected shopkeeper..."
                │
                └── div (Dependencies Section)
                    ├── div (Label) "Dependencies"
                    └── div (Table - grid, borderRadius:10)
                        ├── div (Header - grid, gridTemplateColumns:1fr 120px 80px)
                        │   ├── span "Package"
                        │   ├── span "Constraint"
                        │   └── span "Status"
                        │
                        └── div (Row - grid, gridTemplateColumns:1fr 120px 80px)
                            ├── code "pocketmine/pocketmine-mp"
                            ├── code "^5.0"
                            └── Badge "✓ ok"
```

---

## Page — Search

```
section#page-search
└── div (Container)
    │
    ├── div (Header - height:56)
    │   └── div (flex)
    │       └── div (Logo)
    │           ├── S (Logo Icon - size:20)
    │           └── span "Axolotl PM"
    │
    └── div (Content - padding:40px 40px 20px)
        │
        ├── div (Search Section)
        │   ├── div (Search Row - flex, gap:10, marginBottom:16)
        │   │   ├── div (Search Input - flex:1, borderRadius:12)
        │   │   │   ├── span (⌕)
        │   │   │   └── span "economy"
        │   │   └── button "Search"
        │   │
        │   ├── div (Filter Chips - flex, gap:8, flexWrap:wrap, marginBottom:8)
        │   │   ├── div (Active Filter - background:brandBg)
        │   │   │   ├── text "Category: Economy"
        │   │   │   └── text "×"
        │   │   ├── div (Inactive Filter)
        │   │   │   ├── text "API: 4.0.0+"
        │   │   │   └── text "▾"
        │   │   ├── div (Inactive Filter)
        │   │   │   ├── text "License: MIT"
        │   │   │   └── text "▾"
        │   │   └── div (Inactive Filter)
        │   │       ├── text "Sort: Downloads ↓"
        │   │       └── text "▾"
        │   │
        │   └── div (Results Count - marginBottom:24)
        │       ├── text "Showing "
        │       ├── strong "47 results"
        │       └── text " for "economy" in Economy"
        │
        ├── div (Results List - flexDirection:column, gap:8)
        │   │
        │   ├── div (Result Card - highlighted, background:brandBg)
        │   │   ├── div (Icon - 44x44, borderRadius:10)
        │   │   ├── div (Content - flex:1)
        │   │   │   ├── div (Header - flex, flexWrap:wrap)
        │   │   │   │   ├── span "EconomyCore"
        │   │   │   │   ├── code "devkira"
        │   │   │   │   ├── Badge "✓ Verified"
        │   │   │   │   ├── Badge "Economy"
        │   │   │   │   └── Badge "v2.4.1"
        │   │   │   └── p (Description)
        │   │   └── div (Stats - flexDirection:column, alignItems:flex-end)
        │   │       ├── span "↓ 248k"
        │   │       └── span "★ 412"
        │   │
        │   ├── div (Result Card)
        │   │   └── ...
        │   ├── div (Result Card)
        │   │   └── ...
        │   └── div (Result Card)
        │       └── ...
        │
        └── div (Pagination - flex, justifyContent:center, gap:6, padding:32px 0)
            ├── button "←"
            ├── button "1"
            ├── button "2"
            ├── button "3"
            ├── button "…"
            ├── button "8"
            └── button "→"
```

---

## Page — Author

```
section#page-author
└── div (Container)
    │
    ├── div (Header - height:56)
    │   └── div (flex)
    │       └── div (Logo)
    │           ├── S (Logo Icon - size:20)
    │           └── span "Axolotl PM"
    │
    └── div (Content)
        │
        ├── div (Profile Header - padding:40px 40px 0, borderBottom)
        │   └── div (flex, gap:24)
        │       ├── div (Avatar - 80x80, borderRadius:20)
        │       │   └── text "D"
        │       ├── div (Info - flex:1)
        │       │   ├── div (flex)
        │       │   │   ├── h1 "DevKira"
        │       │   │   └── Badge "✓ Verified Author"
        │       │   ├── code "@devkira"
        │       │   ├── p (Bio)
        │       │   └── div (Links - flex, gap:12)
        │       │       ├── span "📍 Berlin, Germany"
        │       │       ├── span "🔗 devkira.dev"
        │       │       └── span "⭐ github.com/devkira"
        │       └── button "Follow"
        │
        ├── div (Stats Row - display:flex, gap:32, paddingBottom:24)
        │   ├── div (Stat)
        │   │   ├── div "24"
        │   │   └── div "Plugins"
        │   ├── div (Stat)
        │   │   ├── div "248k"
        │   │   └── div "Downloads/mo"
        │   ├── div (Stat)
        │   │   ├── div "1.2M"
        │   │   └── div "Total DLs"
        │   └── div (Stat)
        │       ├── div "342"
        │       └── div "Stars"
        │
        └── div (Content - padding:40)
            │
            ├── div (Tabs - flex, borderBottom, marginBottom:32)
            │   ├── button "Plugins (24)"
            │   ├── button "Pinned (3)"
            │   └── button "Activity"
            │
            ├── div (Plugin Grid - grid, gridTemplateColumns:repeat(3, 1fr), gap:12)
            │   ├── div (Plugin Card - padding:16, borderRadius:12)
            │   │   ├── div (flex, gap:10)
            │   │   │   ├── div (Icon - 28x28, borderRadius:7)
            │   │   │   └── div (Info)
            │   │   │       ├── div (Name)
            │   │   │       └── div (Category)
            │   │   └── div (flex)
            │   │       ├── code "v2.4.1"
            │   │       ├── span "↓ 248k" (marginLeft:auto)
            │   │       └── span "★ 412"
            │   │
            │   ├── div (Plugin Card)
            │   │   └── ...
            │   ├── div (Plugin Card)
            │   │   └── ...
            │   ├── div (Plugin Card)
            │   │   └── ...
            │   ├── div (Plugin Card)
            │   │   └── ...
            │   ├── div (Plugin Card)
            │   │   └── ...
            │   └── div (Plugin Card)
            │       └── ...
            │
            └── div (Activity Section)
                ├── div (Label) "Contribution activity — last 12 months"
                │
                ├── div (Graph - flex, gap:3, overflowX:auto)
                │   └── div (Week Column - flexDirection:column, gap:3) x 52
                │       └── div (Day Cell - 10x10, borderRadius:2) x 7
                │
                └── div (Legend - flex, gap:6, marginTop:8)
                    ├── span "Less"
                    ├── div (Cell)
                    ├── div (Cell)
                    ├── div (Cell)
                    ├── div (Cell)
                    └── span "More"
```

---

## Component Reuse Patterns

### Badge Component (T)
```
Badge (T)
├── props: label, color
├── colors: blue, green, zinc, amber, red
└── used in:
    - Version badges
    - Category tags
    - Status indicators
    - Type labels (fix, perf, patch, minor)
```

### Logo Component (S)
```
Logo (S)
├── props: size
└── used in:
    - Header (size:20)
    - Sidebar (size:24)
```

---

## Data Structures

### Plugin Card Data
```javascript
{
  name: string,
  author: string,
  icon: emoji,
  ver: string,
  desc: string,
  cat: string,
  dl: string,
  stars?: number,
  verified?: boolean
}
```

### Release Item Data
```javascript
{
  ver: string,
  date: string,
  type: 'patch' | 'minor' | 'major',
  downloads: string,
  stable: boolean
}
```

### Changelog Item Data
```javascript
{
  type: 'fix' | 'perf',
  msg: string
}
```

### Dependency Row Data
```javascript
{
  package: string,
  constraint: string,
  status: 'green' | 'amber'
}
```

---

## Layout Summary

| Page | Main Grid | Sidebar Width | Content Padding |
|------|----------|---------------|-----------------|
| Home | 4-col stats, 3-col plugins | None | 48px 40px |
| Plugin | 1fr | 296px | 40px |
| Version | 360px 1fr | None | 40px |
| Search | None | None | 40px 40px 20px |
| Author | 3-col plugins | None | 40px |

---

*End of DOM Specification*
