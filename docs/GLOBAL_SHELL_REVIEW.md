# Global Shell Review

**Reviewed:** Header, Footer, RootLayout  
**Review Date:** 2026-08-03  
**Reviewer:** Architecture Review  

---

## Executive Summary

The Global Shell implementation provides a functional foundation for the website navigation. The shell includes desktop and mobile navigation, search entry, and semantic HTML structure. Most core requirements are met. Several issues require attention before Phase 2.

**Overall Score: 7/10**

---

## Strengths

### Semantic Structure
- ✅ Proper `<header>`, `<nav>`, `<main>`, `<footer>` landmark usage
- ✅ Main content area with skip-link capability (`tabIndex={-1}`)
- ✅ Descriptive ARIA labels on navigation elements

### Accessibility Foundation
- ✅ `aria-expanded` and `aria-controls` on mobile menu toggle
- ✅ `aria-label` on navigation regions
- ✅ `aria-hidden` on decorative icons
- ✅ Keyboard-navigable links and buttons

### Design System Reuse
- ✅ Input component used for search fields
- ✅ Lucide icons used consistently
- ✅ Tailwind spacing tokens applied correctly

### Responsive Architecture
- ✅ Desktop: Horizontal nav with persistent search
- ✅ Mobile: Hamburger menu with drawer navigation
- ✅ Breakpoints follow standard conventions (`lg:`)

### Navigation UX
- ✅ Active route indication via NavLink
- ✅ Mobile menu closes on navigation
- ✅ Search clears after submission

---

## Issues

### Issue 1: Logo/Brand Positioning

**Severity:** Medium  
**Location:** Header line 48-57

The logo links to `/` but the visual brand name reads "Axolotl Plugins" which conflicts with the registry name "Poggit" in the footer attribution.

**Figma Alignment:** Unknown - brand name should match approved Figma design.

**Recommendation:** Confirm brand name with design team. Current implementation may need update.

---

### Issue 2: Search UX Inconsistency

**Severity:** Medium  
**Location:** Header lines 60-75, 134-151

The search input clears after submission (`setSearchQuery('')`) which is good, but the input type is `search` which provides native clear button in some browsers that may conflict with manual clearing.

**Figma Alignment:** Unknown - clear affordance design should match approved Figma.

**Recommendation:** Test native clear button vs manual clear button behavior.

---

### Issue 3: Mobile Menu Animation

**Severity:** Low  
**Location:** Header

The mobile menu appears/disappears without animation. The VISUAL_IMPLEMENTATION_PLAN Phase 7 mentions animations, but reduced-motion compliance is noted.

**Figma Alignment:** N/A for Phase 1

**Recommendation:** Add transition animation in Phase 7 with `prefers-reduced-motion` support.

---

### Issue 4: Missing Skip Link

**Severity:** Low  
**Location:** RootLayout line 14

The main element has `tabIndex={-1}` for focus management but no visible skip link to bypass navigation exists.

**WCAG Requirement:** 2.4.1 Bypass Blocks

**Recommendation:** Add visually hidden skip link before header:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-white focus:text-primary-700">
  Skip to main content
</a>
```

---

### Issue 5: GitHub URL Mismatch

**Severity:** Low  
**Location:** Header line 107, Footer line 44

Header links to `axolotl-pm/plugin-repository` while Footer links to `poggit.pmmp.io` and `pmmp`.

**Recommendation:** Confirm repository ownership and URLs are intentional.

---

### Issue 6: Focus Ring Visibility

**Severity:** Medium  
**Location:** Header navigation

NavLink uses background color changes for active state but does not include explicit focus ring for keyboard navigation.

**WCAG Requirement:** 2.4.11 Focus Appearance

**Recommendation:** Ensure focus styles are visible in both light and dark themes. Add `focus-visible:ring-2 focus:ring-primary-500` to interactive elements.

---

## Missing Visual Details

The following items are not yet defined in the implementation but are mentioned in WEBSITE_DESIGN.md:

| Item | Status |
|------|---------|
| Theme toggle (dark/light) | Not implemented |
| Logo asset (SVG) | Using Lucide Package icon |
| favicon | Using default |

**Recommendation:** Confirm favicon and logo assets match Figma before launch.

---

## Responsive Behavior Review

| Breakpoint | Behavior | Issues |
|-------------|----------|---------|
| Desktop (lg+) | Full nav, persistent search | None |
| Tablet (md-lg) | Collapsed nav | ✓ OK |
| Mobile (<lg) | Hamburger menu | Missing focus trap |

### Focus Trap

**Severity:** Medium  
**Issue:** Mobile menu does not trap focus when open.

**Impact:** Keyboard users can tab outside the menu while it's open.

**Recommendation:** Implement focus trap for mobile drawer in Phase 7.

---

## Design System Compliance

| Component | Usage | Compliance |
|-----------|-------|-------------|
| Input | Search fields | ✅ Compliant |
| Package icon | Logo | ✅ Compliant |
| Search icon | Search affordance | ✅ Compliant |
| Menu/X icons | Mobile toggle | ✅ Compliant |
| Github icon | GitHub link | ✅ Compliant |
| Heart icon | Attribution | ✅ Compliant |

### Token Usage

| Token | Used Correctly |
|--------|---------------|
| primary-600 | Brand color | ✅ |
| gray-* | Text and surfaces | ✅ |
| backdrop-blur | Header background | ✅ |
| lg: | Responsive breakpoint | ✅ |

---

## Figma Compliance Check

| Figma Element | Implementation | Status |
|---------------|-----------------|---------|
| Header layout | Sticky, z-50 | ✅ |
| Logo | Package icon + text | ⚠️ (verify brand name) |
| Search bar | Persistent on desktop | ✅ |
| Nav links | Browse, Authors, GitHub | ✅ |
| Mobile hamburger | Menu icon toggle | ✅ |
| Footer layout | Two-row stacked | ✅ |
| Footer links | About, Submit, Source | ⚠️ (links vary) |

---

## Recommendations Priority Order

### Phase 1 Completion (Before Phase 2)

1. **Add skip link** to RootLayout for keyboard accessibility
2. **Verify brand name** matches Figma ("Axolotl Plugins" vs "Poggit")
3. **Add focus-visible ring** to navigation items

### Phase 7 (Polish)

4. **Implement focus trap** for mobile drawer
5. **Add transition animations** with reduced-motion support
6. **Verify logo asset** matches Figma
7. **Confirm favicon** is correct

### Pre-Launch

8. Theme toggle implementation (if specified in Figma)
9. Dark mode color verification
10. Cross-browser testing

---

## Implementation Readiness

| Requirement | Status |
|-------------|--------|
| Semantic HTML | ✅ Complete |
| Keyboard navigation | ⚠️ Partial (skip link missing) |
| ARIA labels | ✅ Complete |
| Responsive layout | ✅ Complete |
| Search UX | ✅ Functional |
| Mobile menu | ⚠️ Missing focus trap |
| Design tokens | ✅ Complete |
| Dark mode support | ⚠️ Background colors present |

---

## Overall Score

| Category | Score | Notes |
|----------|-------|-------|
| Semantic Structure | 9/10 | Minor: skip link missing |
| Accessibility | 7/10 | Good foundation, needs skip link and focus trap |
| Responsive Behavior | 8/10 | Functional, focus trap needed |
| Design System | 9/10 | Correct token usage |
| Figma Compliance | 7/10 | Brand name verification needed |
| Code Quality | 8/10 | Clean, minor unused imports risk |

**Final Score: 7/10**

---

## Conclusion

The Global Shell implementation is **ready for Phase 2 with caveats**. Critical accessibility gaps (skip link) and brand verification should be addressed before production. Mobile menu focus trap is a Phase 7 item per the visual implementation plan.

**Approval:** Conditional - address skip link and focus-visible styles before Phase 2.
