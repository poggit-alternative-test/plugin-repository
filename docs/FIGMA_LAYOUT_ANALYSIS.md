# Figma Layout Analysis

**Date:** 2026-08-03
**Phase:** 4A - Layout Analysis
**Source:** design/figma-export/

---

## Overview

This document provides a comprehensive layout analysis of the approved Figma design. It extracts and documents all visual specifications needed for implementation across all pages.

---

## Design System Tokens

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| Font Sans | Inter | All UI text |
| Font Mono | JetBrains Mono | Code, versions, checksums |
| Line Height | 1.5 | Base line height |

#### Type Scale

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 | 36px/48px/60px (responsive) | 700 | tight |
| H2 | 24px | 600 | tight |
| H3 | 18px | 600 | normal |
| Body | 16px | 400 | 1.5 |
| Small | 14px | 400 | 1.5 |
| XS | 12px | 400 | 1.5 |
| Code | 14px mono | 400 | 1.5 |

### Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Primary | sky-600 (#0284c7) | sky-400 | CTAs, links |
| Primary Hover | sky-700 | sky-300 | Hover states |
| Text Primary | gray-900 (#111827) | white | Headings |
| Text Secondary | gray-600 (#4b5563) | gray-400 | Body text |
| Text Muted | gray-500 (#6b7280) | gray-500 | Metadata |
| Background | white (#ffffff) | gray-900 | Canvas |
| Surface | white | gray-800 | Cards |
| Border | gray-200 (#e5e7eb) | gray-700 | Dividers |
| Danger | red-600 (#dc2626) | red-400 | Errors |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| 0 | 0px | Reset |
| 1 | 4px | Tight gaps |
| 2 | 8px | Component internal |
| 3 | 12px | Related items |
| 4 | 16px | Section rhythm |
| 6 | 24px | Card padding |
| 8 | 32px | Section gaps |
| 12 | 48px | Major sections |
| 16 | 64px | Hero padding |
| 20 | 80px | Hero (tablet) |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| sm | 4px | Badges, tags |
| md | 6px | Inputs |
| lg | 8px | Cards, buttons |
| xl | 12px | Modals |
| full | 9999px | Pills, avatars |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| sm | 0 1px 2px rgba(0,0,0,0.05) | Cards default |
| md | 0 4px 6px rgba(0,0,0,0.1) | Cards hover |
| lg | 0 10px 15px rgba(0,0,0,0.1) | Modals |

### Transitions

| Property | Value |
|----------|-------|
| Duration | 150ms |
| Timing | cubic-bezier(0.4, 0, 0.2, 1) |

---

## Global Layout

### Shell Structure

```
┌─────────────────────────────────────────────┐
│  Header (sticky, z-50)                      │
│  ┌─────────────────────────────────────────┐ │
│  │ Logo │ Search (desktop) │ Nav │ Menu   │ │
│  └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│  Main Content (flex-1)                     │
│  ┌─────────────────────────────────────────┐ │
│  │                                         │ │
│  │   Page-specific content                 │ │
│  │                                         │ │
│  └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│  Footer                                    │
└─────────────────────────────────────────────┘
```

### Container

| Breakpoint | Max Width | Padding |
|------------|-----------|---------|
| Mobile | 100% | 16px |
| Tablet | 100% | 24px |
| Desktop | 1280px | 32px |

### Header

| Property | Value |
|----------|-------|
| Height | 64px (desktop), ~106px (mobile with search) |
| Background | white/95 with backdrop-blur |
| Border | 1px bottom gray-200 |
| Position | sticky top-0 |
| Z-index | 50 |

### Footer

| Property | Value |
|----------|-------|
| Background | gray-50 |
| Border | 1px top gray-200 |
| Padding | 32px vertical |
| Layout | flex with space-between |

---

## Page: Home (`/`)

### Layout Hierarchy

```
┌─────────────────────────────────────────────┐
│  Header                                     │
├─────────────────────────────────────────────┤
│  Hero Section (py-16 sm:py-20)             │
│  ┌─────────────────────────────────────────┐│
│  │     H1: PocketMine Plugin Registry     ││
│  │     Description (max-w-2xl)           ││
│  │     ┌─────────────────────────────┐   ││
│  │     │ Search Input │ Search Button│   ││
│  │     └─────────────────────────────┘   ││
│  │     Hint text (text-sm muted)          ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  Stats Bar (py-4)                           │
│  ┌─────────────────────────────────────────┐│
│  │     [0 plugins] │ [0 versions]       ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  Featured Section (space-y-6)              │
│  ┌─────────────────────────────────────────┐│
│  │  Section Header + View All Link         ││
│  │  ┌────┬────┬────┬────┐                 ││
│  │  │Card│Card│Card│Card│  (4 columns)   ││
│  │  └────┴────┴────┴────┘                 ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  Recently Updated Section                   │
│  ┌─────────────────────────────────────────┐│
│  │  Section Header                          ││
│  │  ┌─────────────────────────────────┐     ││
│  │  │ Plugin Row                      │     ││
│  │  │ Plugin Row                      │     ││
│  │  │ Plugin Row                      │     ││
│  │  └─────────────────────────────────┘     ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

### Section Order

1. Hero (centered, prominent)
2. Stats Bar (always visible, centered)
3. Featured Plugins (grid)
4. Recently Updated (list)
5. Footer

### Visual Rhythm

- Hero: 64-80px vertical padding (breathing room)
- Stats: 16px vertical padding (compact)
- Featured: 24px gap between cards
- Recently: 8px gap between rows
- Sections: 48px (space-y-12) between major sections

### Responsive Behavior

| Breakpoint | Hero H1 | Search Layout | Grid |
|------------|---------|---------------|------|
| Mobile | 36px, 2 lines | Stacked | 1 column |
| Tablet | 48px | Inline | 2 columns |
| Desktop | 60px | Inline | 4 columns |

### Empty State

When no plugins exist:
- Hero and Stats still display
- "No Plugins Yet" card in place of Featured/Recent
- Card contains icon, message, and CTA button

---

## Page: Search (`/search`)

### Layout Hierarchy

```
┌─────────────────────────────────────────────┐
│  Header                                     │
├─────────────────────────────────────────────┤
│  Search Bar (py-8)                         │
│  ┌─────────────────────────────────────────┐│
│  │  [Search Input with Clear Button]      ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  ┌──────────┬──────────────────────────────┐│
│  │ Filters  │  Results Area              ││
│  │ (aside)  │                             ││
│  │          │  ┌────────────────────────┐ ││
│  │ Status   │  │ Toolbar                │ ││
│  │ Category  │  │ Count │ Sort │ View   │ ││
│  │ Author    │  └────────────────────────┘ ││
│  │          │                             ││
│  │ [Clear]  │  ┌────┬────┬────┬────┐     ││
│  │          │  │Card│Card│Card│Card│     ││
│  │          │  ├────┼────┼────┼────┤     ││
│  │          │  │Card│Card│Card│Card│     ││
│  │          │  └────┴────┴────┴────┘     ││
│  │          │                             ││
│  │          │  ┌────────────────────────┐ ││
│  │          │  │ Pagination             │ ││
│  │          │  └────────────────────────┘ ││
│  └──────────┴──────────────────────────────┘│
├─────────────────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

### Grid System

| Breakpoint | Layout | Sidebar | Results |
|------------|--------|---------|---------|
| Mobile | 1 column | Hidden (drawer) | Full width |
| Tablet | 1:1 | Visible | 2 columns |
| Desktop | 1:3 | Visible (25%) | 3-4 columns |

### Filters Sidebar

| Property | Value |
|----------|-------|
| Width | 25% (desktop) |
| Position | sticky top-4 |
| Sections | Status, Category, Author |
| Clear All | Visible when filters active |

### Results Toolbar

```
┌─────────────────────────────────────────────┐
│ Showing 1-20 of 150 results    Sort by: [▼] [□][≡] │
└─────────────────────────────────────────────┘
```

| Element | Specification |
|---------|---------------|
| Count | "Showing X-Y of Z results" |
| Sort | Native select, min-w-160px |
| View Toggle | Grid/List icons, segmented control |

### View Modes

**Grid View:**
- 4 columns desktop, 2 tablet, 1 mobile
- Card layout with full metadata
- 16px gap

**List View:**
- Single column
- Row layout with horizontal arrangement
- Expanded metadata

### States

1. **Loading:** Skeleton grid (8 items)
2. **Empty (no query):** "Enter a search term" message
3. **No results:** "No plugins match" with suggestions
4. **Error:** Error card with retry button

---

## Page: Plugin (`/plugins/:slug`)

### Layout Hierarchy

```
┌─────────────────────────────────────────────┐
│  Header                                     │
├─────────────────────────────────────────────┤
│  Plugin Header (py-8)                       │
│  ┌─────────────────────────────────────────┐│
│  │ [Avatar] Plugin Name    [Status Badge] ││
│  │ By: Author │ Version │ Downloads        ││
│  │ Description text...                      ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  ┌──────────────────────┬───────────────────┐│
│  │ Main Content (2/3)  │ Sidebar (1/3)     ││
│  │                     │                   ││
│  │ ┌─────────────────┐ │ ┌───────────────┐ ││
│  │ │ Status Card     │ │ │ Download/Down │ ││
│  │ └─────────────────┘ │ │ Sidebar Card │ ││
│  │                     │ └───────────────┘ ││
│  │ ┌─────────────────┐ │                   ││
│  │ │ Versions List  │ │ ┌───────────────┐ ││
│  │ └─────────────────┘ │ │ Metadata Card│ ││
│  │                     │ └───────────────┘ ││
│  │ ┌─────────────────┐ │                   ││
│  │ │ README Preview  │ │                   ││
│  │ └─────────────────┘ │                   ││
│  └──────────────────────┴───────────────────┘│
├─────────────────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

### Grid System

| Breakpoint | Layout | Main | Sidebar |
|------------|--------|------|---------|
| Mobile | 1 column | Full width | Below content |
| Desktop | 2:1 | 66% | 33% |

### Component Specifications

#### Plugin Header

| Element | Style |
|---------|-------|
| Avatar | 48px, rounded-full |
| Plugin Name | H1, 36px, font-bold |
| Status Badge | Colored pill |
| Author | Link to author page |
| Version | Monospace, gray-500 |
| Downloads | Gray-500 |
| Description | text-gray-600, max-w-2xl |

#### Version List

| Property | Value |
|----------|-------|
| Container | Card with padding-md |
| Items | Flex row with version, status, date |
| Current Version | Highlighted background |

#### Sidebar Cards

| Property | Value |
|----------|-------|
| Padding | 16px |
| Background | white |
| Border | 1px gray-200 |
| Border Radius | 8px |
| Gap | 24px between cards |

### States

1. **Loading:** Skeleton header + cards
2. **Not Found:** Error card with "Plugin not found"
3. **Error:** Error card with retry

---

## Page: Version (`/versions/:slug/:version`)

### Layout Hierarchy

```
┌─────────────────────────────────────────────┐
│  Header                                     │
├─────────────────────────────────────────────┤
│  Version Header (py-8)                      │
│  ┌─────────────────────────────────────────┐│
│  │ [← Plugin Name] v1.0.0    [Status Badge]││
│  │ Published: 2024-01-15 │ API: 5.0.0      ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  ┌──────────────────────┬───────────────────┐│
│  │ Main Content (2/3)  │ Sidebar (1/3)     ││
│  │                     │                   ││
│  │ ┌─────────────────┐ │ ┌───────────────┐ ││
│  │ │ Changelog       │ │ │ Download Card │ ││
│  │ │ (Markdown)     │ │ └───────────────┘ ││
│  │ └─────────────────┘ │                   ││
│  │                     │ ┌───────────────┐ ││
│  │ ┌─────────────────┐ │ │ Metadata Card│ ││
│  │ │ Dependencies    │ │ └───────────────┘ ││
│  │ └─────────────────┘ │                   ││
│  │                     │ ┌───────────────┐ ││
│  │ ┌─────────────────┐ │ │ Manifest Card│ ││
│  │ │ Checksums      │ │ └───────────────┘ ││
│  │ │ SHA256 [copy]  │ │                   ││
│  │ │ SHA512 [copy]  │ │                   ││
│  │ └─────────────────┘ │                   ││
│  │                     │                   ││
│  │ ┌─────────────────┐ │                   ││
│  │ │ Provenance      │ │                   ││
│  │ │ ✓ Verified      │ │                   ││
│  │ └─────────────────┘ │                   ││
│  └──────────────────────┴───────────────────┘│
├─────────────────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

### Component Specifications

#### Checksums Section

| Property | Value |
|----------|-------|
| Container | Card padding-md |
| Labels | Uppercase, gray-500, text-xs |
| Values | Monospace, gray-900, break-all |
| Copy Button | Icon button, appears on hover |

#### Dependencies

| Type | Style |
|------|-------|
| Runtime | Required dependencies list |
| Suggested | Optional dependencies, muted |

#### Manifest

| Property | Value |
|----------|-------|
| Container | Card, code block |
| Format | YAML-like display |
| Font | Monospace |

### States

1. **Loading:** Skeleton layout
2. **Not Found:** "Version not found" message
3. **Error:** Error card with retry

---

## Page: Author (`/authors/:owner`)

### Layout Hierarchy

```
┌─────────────────────────────────────────────┐
│  Header                                     │
├─────────────────────────────────────────────┤
│  Author Header (py-8)                       │
│  ┌─────────────────────────────────────────┐│
│  │ [Avatar] Author Name    [✓ Verified]    ││
│  │ @login                                    ││
│  │ Bio text...                               ││
│  │ [GitHub Profile Link]                    ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  ┌──────────────────────┬───────────────────┐│
│  │ Plugins (2/3)        │ Sidebar (1/3)     ││
│  │                     │                   ││
│  │ ┌─────────────────┐ │ ┌───────────────┐ ││
│  │ │ Statistics Card │ │ │ GitHub Card   │ ││
│  │ │ - X plugins    │ │ └───────────────┘ ││
│  │ │ - X versions   │ │                   ││
│  │ │ - X downloads  │ │                   ││
│  │ └─────────────────┘ │                   ││
│  │                     │                   ││
│  │ ┌─────────────────┐ │                   ││
│  │ │ Plugin List    │ │                   ││
│  │ │ [Plugin Card]  │ │                   ││
│  │ │ [Plugin Card]  │ │                   ││
│  │ │ [Plugin Card]  │ │                   ││
│  │ └─────────────────┘ │                   ││
│  └──────────────────────┴───────────────────┘│
├─────────────────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

### Component Specifications

#### Author Header

| Element | Style |
|---------|-------|
| Avatar | 64px, rounded-full |
| Name | H1, 36px, font-bold |
| Verified Badge | Green checkmark + "Verified" |
| GitHub Link | External link icon |

#### Statistics Card

| Metric | Format |
|--------|--------|
| Plugins | Number |
| Versions | Number |
| Downloads | Abbreviated (e.g., 10K) |
| First Plugin | Relative date |

### States

1. **Loading:** Skeleton header + cards
2. **Not Found:** "Author not found" message
3. **Error:** Error card with retry

---

## Component Patterns

### Cards

| Property | Light | Dark |
|----------|-------|------|
| Background | white | gray-800 |
| Border | 1px gray-200 | 1px gray-700 |
| Border Radius | 8px | 8px |
| Shadow | shadow-sm | none |
| Padding | 16px (md), 24px (lg) | Same |

### Buttons

| Variant | Background | Text | Hover |
|---------|-----------|------|-------|
| Primary | sky-600 | white | sky-700 |
| Secondary | gray-100 | gray-900 | gray-200 |
| Outline | transparent | gray-700 | gray-50 |
| Ghost | transparent | gray-700 | gray-100 |
| Destructive | red-600 | white | red-700 |

| Property | Value |
|----------|-------|
| Border Radius | 8px |
| Padding | 12px 24px (lg), 8px 16px (md), 6px 12px (sm) |
| Transition | 150ms |

### Badges

| Property | Value |
|----------|-------|
| Border Radius | full (pill) |
| Font Size | 12px |
| Padding | 4px 8px |
| Variants | Status colors, info, success |

### Inputs

| Property | Value |
|----------|-------|
| Border | 1px gray-300 |
| Border Radius | 8px |
| Focus Ring | sky-500 |
| Padding | 12px 16px |

### Dividers

| Property | Value |
|----------|-------|
| Border | 1px gray-200 |
| Margin | 24px vertical |

---

## Responsive Breakpoints

| Breakpoint | Width | Classes |
|------------|-------|---------|
| Mobile | < 640px | base, sm:- |
| Tablet | 640px - 1024px | sm:, md: |
| Desktop | > 1024px | lg:, xl: |

### Touch Targets

| Element | Minimum Size |
|---------|-------------|
| Buttons | 44px height |
| Links | 44px touch area |
| Icons | 44px touch area |

---

## Accessibility

### Focus States

| Element | Focus Ring |
|---------|-----------|
| Buttons | 2px sky-500 ring |
| Inputs | 2px sky-500 ring |
| Links | underline |
| Cards | ring on focus-within |

### Screen Reader

| Element | ARIA |
|---------|------|
| Nav | aria-label |
| Search | aria-label |
| Pagination | aria-label, aria-current |
| Filters | role="group", aria-label |

---

## Interaction States

### Hover States

| Element | Hover Effect |
|---------|-------------|
| Buttons | Darken background |
| Cards | shadow-md |
| Links | text-darken |
| Nav items | background gray-100 |

### Active States

| Element | Active Effect |
|---------|--------------|
| Nav items | background primary-50 |
| Buttons | Scale 0.98 (optional) |

### Disabled States

| Element | Disabled Effect |
|---------|----------------|
| Buttons | opacity-50, cursor-not-allowed |
| Inputs | background gray-100 |
| Links | No hover effect |

---

## Animation & Motion

| Animation | Duration | Easing |
|-----------|----------|--------|
| Hover transitions | 150ms | ease |
| Page transitions | 200ms | ease-out |
| Loading skeletons | Pulse | - |
| Focus rings | Instant | - |

### Reduced Motion

Respect `prefers-reduced-motion`:
- Disable all animations
- Show static states
- No motion required for information

---

## Implementation Notes

### Grid Usage

| Page | Desktop | Tablet | Mobile |
|------|---------|--------|--------|
| Home Hero | Full width | Full width | Full width |
| Home Featured | 4 columns | 2 columns | 1 column |
| Search | 1:3 (sidebar:content) | 2 columns | 1 column |
| Plugin | 2:1 (content:sidebar) | 1 column | 1 column |
| Version | 2:1 (content:sidebar) | 1 column | 1 column |
| Author | 2:1 (content:sidebar) | 1 column | 1 column |

### Spacing Rhythm

| Section | Vertical Spacing |
|---------|-----------------|
| Page sections | 48px (space-y-12) |
| Card groups | 24px (space-y-6) |
| Card internal | 16px (space-y-4) |
| Related items | 8px (space-y-2) |

### Typography Hierarchy

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| H1 | 36-60px | 700 | gray-900 |
| H2 | 24px | 600 | gray-900 |
| H3 | 18px | 600 | gray-900 |
| Body | 16px | 400 | gray-600 |
| Small | 14px | 400 | gray-500 |
| Metadata | 12px | 400 | gray-500 |
| Code | 14px mono | 400 | gray-900 |

---

## Validation Checklist

Before declaring a page complete:

- [ ] Header visible on all routes
- [ ] Footer visible on all routes
- [ ] Container max-width respected
- [ ] All breakpoints tested
- [ ] Dark mode functional
- [ ] Hover states work
- [ ] Focus states visible
- [ ] Touch targets ≥ 44px
- [ ] No horizontal overflow
- [ ] Semantic HTML used
- [ ] ARIA labels present
- [ ] Keyboard navigation works
- [ ] Reduced motion respected
