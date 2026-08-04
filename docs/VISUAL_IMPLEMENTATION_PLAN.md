# Visual Implementation Plan

**Status:** Approved for Implementation  
**Version:** 1.0  
**Last Updated:** 2026-08-03  

---

## Overview

This document translates the approved Figma design into a practical implementation roadmap. It identifies visual areas, maps components to the existing architecture, sequences implementation phases, and documents risks.

**No code is written in this document.** All visual decisions are derived from the approved Figma design and existing architecture documents.

---

## Visual Areas

### 1. Global Shell

| Area | Responsibility |
|------|---------------|
| **RootLayout** | Application shell wrapping all routes |
| **Header** | Persistent navigation with search entry |
| **Footer** | Site-wide links and attribution |

**Dependencies:**
- Design System: Container, Grid
- Layout: Header, Footer (new)
- Tokens: colors.canvas, colors.surface, typography.*, spacing.*

**Implementation Order:** Phase 1

---

### 2. Home Page

| Area | Responsibility |
|------|---------------|
| **Hero** | Search entry with large input and CTA |
| **Stats Bar** | Repository-wide plugin/version counts |
| **Featured Section** | Curated or popular plugins grid |
| **Recent Section** | Recently updated plugins list |
| **Empty State** | Shown when repository has no plugins |

**Dependencies:**
- Feature: HomeFeature
- Shared: PluginGrid, PluginList
- Design System: Container, Card, Grid, Skeleton
- Existing: HomeHero, HomeStats, HomeFeatured, HomeRecent, HomeEmptyState

**Implementation Order:** Phase 2

---

### 3. Search Experience

| Area | Responsibility |
|------|---------------|
| **Search Bar** | Persistent input with clear affordance |
| **Filters Sidebar** | Status, category, author filters |
| **Results Toolbar** | Sort control, view toggle, result count |
| **Results Grid/List** | Plugin cards in responsive layout |
| **Pagination** | Page navigation with controls |
| **Empty/No-Query States** | Appropriate messaging per state |
| **Error State** | Retry affordance |

**Dependencies:**
- Feature: SearchFeature, SearchController
- Shared: PluginGrid, PluginList
- Design System: Container, Grid, Card, Skeleton, Badge, Input
- Existing: SearchBar, SearchToolbar, SearchFilters, SearchResults, SearchPagination

**Implementation Order:** Phase 3

---

### 4. Plugin Detail

| Area | Responsibility |
|------|---------------|
| **PluginHeader** | Name, author, status badge, description |
| **PluginSidebar** | Download button, external links |
| **PluginMetadata** | Downloads, license, categories |
| **PluginVersions** | Version list with status |
| **PluginStatus** | Lifecycle status display |
| **PluginReadmePreview** | README excerpt |

**Dependencies:**
- Feature: PluginFeature
- Shared: VersionList
- Design System: Container, Card, Button, Badge, Avatar, Link, Grid, Stack

**Implementation Order:** Phase 4

---

### 5. Version Detail

| Area | Responsibility |
|------|---------------|
| **VersionHeader** | Version number, plugin link, status |
| **VersionArtifacts** | Download button, file info |
| **VersionMetadata** | Review info, dates, PR link |
| **VersionChecksums** | SHA256/SHA512/MD5 display with copy |
| **VersionDependencies** | Runtime and suggested dependencies |
| **VersionProvenance** | GitHub attestation status |
| **VersionChangelog** | Release notes display |
| **VersionManifest** | plugin.yml display |

**Dependencies:**
- Feature: VersionFeature
- Design System: Container, Card, Button, Badge, Code, Grid, Stack, Divider

**Implementation Order:** Phase 5

---

### 6. Author Detail

| Area | Responsibility |
|------|---------------|
| **AuthorHeader** | Avatar, name, bio, verification |
| **AuthorStatistics** | Plugin count, downloads, dates |
| **AuthorPlugins** | List of author's plugins |
| **AuthorSidebar** | GitHub link, verified badge |

**Dependencies:**
- Feature: AuthorFeature
- Shared: PluginList
- Design System: Container, Card, Avatar, Badge, Grid, Stack

**Implementation Order:** Phase 6

---

### 7. Responsive Behavior

| Area | Responsibility |
|------|---------------|
| **Sidebar Collapse** | Filters move to drawer on mobile |
| **Grid/List Reflow** | Column count adjusts per breakpoint |
| **Navigation** | Header adapts for mobile |
| **Touch Targets** | All controls meet 44px minimum |

**Dependencies:**
- All features
- Tailwind: sm:, md:, lg: breakpoints
- Figma: Mobile composition

**Implementation Order:** Phase 7 (parallel to other phases)

---

### 8. Loading States

| Area | Responsibility |
|------|---------------|
| **Plugin Skeleton** | Card-shaped placeholder |
| **List Skeleton** | Multiple card placeholders |
| **Toolbar Skeleton** | Count and control placeholders |

**Dependencies:**
- Design System: Skeleton
- Existing: SearchLoadingState

**Implementation Order:** Phase 7 (integrated with each feature)

---

### 9. Empty States

| Area | Responsibility |
|------|---------------|
| **No Results** | Query-specific messaging with clear action |
| **No Query** | Prompt to search with suggestions |
| **Empty Repository** | "No plugins yet" message |

**Dependencies:**
- Design System: Card, Button
- Existing: SearchEmptyState, SearchNoQuery, HomeEmptyState

**Implementation Order:** Phase 7 (integrated with each feature)

---

### 10. Error States

| Area | Responsibility |
|------|---------------|
| **Network Error** | Retry affordance, preserves query |
| **Not Found** | 404-style message per route |

**Dependencies:**
- Design System: Card, Button
- Existing: ErrorState, SearchErrorState

**Implementation Order:** Phase 7 (integrated with each feature)

---

## Component Mapping

### Existing Design System Components (Sufficient)

| Component | Status | Notes |
|-----------|--------|-------|
| Button | ✅ Complete | All variants implemented |
| IconButton | ✅ Complete | For icon-only actions |
| Card | ✅ Complete | With padding variants |
| Badge | ✅ Complete | StatusBadge for version status |
| StatusBadge | ✅ Complete | Maps VersionStatus |
| Avatar | ✅ Complete | With fallback initials |
| Input | ✅ Complete | With icons |
| Container | ✅ Complete | Responsive max-widths |
| Grid | ✅ Complete | Responsive columns |
| Stack | ✅ Complete | Vertical spacing |
| Divider | ✅ Complete | Section separation |
| Link | ✅ Complete | Internal + external |
| Skeleton | ✅ Complete | Multiple variants |
| Spinner | ✅ Complete | Loading indicator |
| LoadingState | ✅ Complete | Icon + message |
| ErrorState | ✅ Complete | Title + message + retry |
| EmptyState | ✅ Complete | Icon + message |

### Components Needing Visual Enhancement

| Component | Enhancement Needed | Priority |
|-----------|-------------------|----------|
| Pagination | Add page range display | High |
| List | Row variant for search results | Medium |
| Select | Native fallback already in place | Low |

### Shared Feature Components (Available)

| Component | Location | Used By |
|-----------|----------|---------|
| PluginCard | @/features/_shared/plugin | Home, Search, Author |
| PluginList | @/features/_shared/plugin | Home, Author, Search |
| PluginGrid | @/features/_shared/plugin | Home, Search |
| VersionItem | @/features/_shared/plugin | Plugin versions |
| VersionList | @/features/_shared/plugin | Plugin, Search |

---

## Feature Mapping

### Feature Components Ready for Visual Implementation

| Feature | Components | Status |
|---------|------------|--------|
| **HomeFeature** | HomeHero, HomeStats, HomeFeatured, HomeRecent, HomeEmptyState | ✅ Architecture complete |
| **SearchFeature** | SearchBar, SearchToolbar, SearchFilters, SearchResults, SearchPagination, SearchEmptyState, SearchNoQuery, SearchErrorState, SearchLoadingState | ✅ Architecture complete |
| **PluginFeature** | PluginHeader, PluginMetadata, PluginVersions, PluginSidebar, PluginStatus, PluginReadmePreview | ✅ Architecture complete |
| **VersionFeature** | VersionHeader, VersionArtifacts, VersionMetadata, VersionChecksums, VersionDependencies, VersionProvenance, VersionChangelog, VersionManifest | ✅ Architecture complete |
| **AuthorFeature** | AuthorHeader, AuthorStatistics, AuthorPlugins, AuthorSidebar | ✅ Architecture complete |

### Pages (Thin Wrappers)

| Page | Implementation |
|------|---------------|
| HomePage | 18 lines - renders HomeFeature |
| SearchPage | 17 lines - renders SearchFeature |
| PluginPage | 24 lines - renders PluginFeature |
| VersionPage | 24 lines - renders VersionFeature |
| AuthorPage | 24 lines - renders AuthorFeature |

---

## Implementation Phases

### Phase 1: Global Shell

**Goal:** Establish the application frame that wraps all routes.

**Deliverables:**
1. RootLayout with Header and Footer
2. Header with:
   - Logo and site name
   - Persistent search input (mobile: icon trigger)
   - Navigation links
3. Footer with:
   - About link
   - Submit link
   - GitHub link
   - License/copyright

**Validation:**
- Header visible on all routes
- Footer visible on all routes
- Responsive collapse on mobile

**Risks:**
- None identified

---

### Phase 2: Home Page Visuals

**Goal:** Implement the approved homepage layout.

**Deliverables:**
1. Hero section with search bar styling
2. Stats bar (plugins/versions counts)
3. Featured plugins section (4-column grid)
4. Recently updated section (list)
5. Empty state when repository is empty

**Validation:**
- Matches Figma desktop and mobile layouts
- Search bar navigates to /search
- Plugin cards link to plugin detail

**Risks:**
- None identified

---

### Phase 3: Search Experience Visuals

**Goal:** Implement the full search page with filters.

**Deliverables:**
1. Search bar with clear affordance
2. Filters sidebar (desktop) / drawer (mobile)
3. Results toolbar with sort and view toggle
4. Grid/List views using PluginGrid/PluginList
5. Pagination controls
6. Empty, no-query, error states
7. Loading skeletons

**Validation:**
- URL-driven state (q, page, sort, view, filters)
- Debounced instant search
- Filter sidebar visible on desktop
- Filter drawer on mobile
- Matches Figma layouts

**Risks:**
- Mobile filter drawer focus management
- URL sync during typing

---

### Phase 4: Plugin Detail Visuals

**Goal:** Implement the plugin detail page.

**Deliverables:**
1. Plugin header with avatar, name, status
2. Two-column layout (content + sidebar)
3. Version list using VersionList
4. Download button in sidebar
5. External links (GitHub, homepage, issues)
6. Status card with lifecycle info
7. Metadata panel
8. README preview section

**Validation:**
- Matches Figma plugin detail layout
- StatusBadge shows correct variant per status
- All links functional

**Risks:**
- None identified

---

### Phase 5: Version Detail Visuals

**Goal:** Implement the version detail page.

**Deliverables:**
1. Version header with plugin link
2. Download button with SHA256 display
3. Checksums section with copy functionality
4. Dependencies list
5. Provenance/attestation section
6. Changelog rendering
7. plugin.yml manifest display

**Validation:**
- Matches Figma version detail layout
- Checksum copy works
- Provenance badge displays correctly

**Risks:**
- Markdown rendering for changelog

---

### Phase 6: Author Detail Visuals

**Goal:** Implement the author profile page.

**Deliverables:**
1. Author header with avatar and bio
2. Statistics panel
3. Author's plugins list
4. GitHub profile link

**Validation:**
- Matches Figma author layout
- PluginList reuses shared component

**Risks:**
- None identified

---

### Phase 7: Responsive, States, and Polish

**Goal:** Ensure all features work across devices and states.

**Deliverables:**
1. Responsive breakpoints for all layouts
2. Mobile filter drawer implementation
3. Loading skeletons for all async operations
4. Empty states for all features
5. Error states with retry actions
6. Focus management for modals/drawers
7. Touch target sizing verification

**Validation:**
- All breakpoints match Figma
- All states implemented per design
- Keyboard navigation works
- Focus visible in all themes

**Risks:**
- Focus trap for mobile drawer
- Reduced motion preferences

---

### Phase 8: Accessibility Verification

**Goal:** Confirm WCAG 2.1 AA compliance.

**Deliverables:**
1. Keyboard navigation audit
2. Screen reader testing
3. Color contrast verification
4. Focus visible in both themes
5. ARIA labels where semantic HTML insufficient

**Validation:**
- All interactive elements keyboard accessible
- No color-only status indicators
- Focus styles visible

**Risks:**
- May require token adjustments

---

### Phase 9: Performance Verification

**Goal:** Confirm fast, efficient rendering.

**Deliverables:**
1. Bundle size audit
2. Lazy loading verification
3. Image optimization check
4. Core Web Vitals assessment

**Validation:**
- Initial load < 3s on 3G
- No layout shift during loading
- Images lazy loaded

**Risks:**
- None identified

---

## Implementation Sequence Summary

| Phase | Focus | Duration Estimate |
|-------|-------|------------------|
| 1 | Global Shell | 1-2 days |
| 2 | Home | 1-2 days |
| 3 | Search | 2-3 days |
| 4 | Plugin | 2-3 days |
| 5 | Version | 2-3 days |
| 6 | Author | 1-2 days |
| 7 | Responsive + States | 2-3 days |
| 8 | Accessibility | 1-2 days |
| 9 | Performance | 1 day |

**Total Estimate:** 11-18 development days

---

## Risks

### Risk 1: Mobile Filter Drawer

**Description:** The filter drawer on mobile requires focus management (trap, escape to close, return focus on close).

**Mitigation:** Use existing focus trap patterns from Radix UI or similar library if needed, or implement manually with React refs.

**Priority:** High

---

### Risk 2: Markdown Rendering

**Description:** Changelog and README content require markdown rendering.

**Mitigation:** Add react-markdown dependency to project.

**Priority:** Medium

---

### Risk 3: Token Gaps

**Description:** The existing Tailwind configuration may not cover all Figma token values.

**Mitigation:** Identify gaps during implementation and add to tailwind.config.js, not ad hoc classes.

**Priority:** Low

---

### Risk 4: Focus Visibility in Dark Mode

**Description:** Focus rings must be visible in both light and dark themes.

**Mitigation:** Verify existing focus ring utilities work in both themes; adjust if needed.

**Priority:** Low

---

## Recommendations

1. **Start with Phase 1 (Global Shell)** before any feature work. This establishes the frame and validates the token system.

2. **Implement one feature phase completely** before moving to the next. This prevents visual drift between features.

3. **Use Figma as the visual authority.** When implementation decisions are unclear, reference Figma rather than inventing solutions.

4. **Validate responsive behavior early.** Test on actual mobile devices, not just browser resize.

5. **Keep shared components shared.** Do not copy PluginCard or VersionList into multiple features; use @/features/_shared/plugin.

6. **Document token gaps** rather than working around them with arbitrary values.

7. **Test accessibility incrementally.** Don't wait until Phase 8 to test keyboard navigation.

---

## Confirmation

This document contains **no code** and **no file modifications**. All visual implementation decisions are documented for handoff to the visual implementation phase.

The architecture (Feature Architecture, Component Architecture, Website Architecture) remains unchanged. Only visual implementation of the approved Figma design is described.
