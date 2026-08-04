# Executive Summary

**Overall health:** Needs corrective work before the website can be considered architecture-compliant. The plugin, version, and author detail features have a recognizable layered structure and the only runtime `fetch()` is centralized in the Website Data SDK client. However, the Registry Generator-to-website pipeline is disconnected, the generated SDK is manually duplicated, and several Design System and page-boundary rules are violated.

**Architecture compliance:** Low-to-moderate. The implementation follows the intended shape in parts, but the critical data-flow and ownership issues prevent the documented static website architecture from functioning as a coherent whole.

# Positive Findings

- Detail routes are thin parameter adapters: `PluginPage`, `VersionPage`, and `AuthorPage` read route parameters and instantiate their corresponding feature component.
- Plugin, version, and author UI is organized into feature modules with `components/`, `hooks/`, `utils/`, and public `index.ts` barrels. Cross-feature imports were not found; shared domain presentation is consumed through `features/_shared`.
- Generated JSON access is centralized in `src/services/generated/client.ts`; no direct JSON imports or `fetch()` calls were found elsewhere in `apps/website/src`.
- Services do not import React. Feature hooks consistently own loading, error, not-found, and retry state, while calling the service boundary for data.
- Design System primitives are mostly in individual component directories and have a consolidated `components/ui/index.ts` barrel.
- `apps/website` TypeScript validation passes with `npm run typecheck`.

# Critical Issues

## Generated data is produced outside the website's runtime input and is not integrated into the build

- **Location:** `package.json:15`; `packages/registry-generator/src/cli.ts:17-18`; `apps/website/public/generated/`; `packages/apps/website/public/generated/`.
- **Description:** The root `generate` script only prints that the generator is not implemented. The generator CLI resolves `../../apps/website/public/generated` from `packages/registry-generator/src`, which resolves to `packages/apps/website/public/generated`, not `apps/website/public/generated`. The website's own generated directory contains only `manifest.json` and `plugins/index.json`, while its SDK requests author, search, plugin-detail, and version files. A second, separate generated-output tree exists under `packages/apps/website/`.
- **Why it violates the architecture:** `WEBSITE_DESIGN.md` requires the fixed flow Registry -> Generator -> generated JSON in `apps/website/public/generated` -> generated SDK. It also requires static data to be available to the deployed website. The current pipeline neither populates the website's public directory nor participates in the root build workflow, so the website cannot consume the contract it declares.
- **Recommended correction:** Restore one authoritative generation command and make it write the generator output to `apps/website/public/generated`; invoke it before the website build. Remove or stop producing the duplicate `packages/apps/website/public/generated` artifact after confirming it has no owner.

## The Website Data SDK is hand-maintained and duplicates the generator contract

- **Location:** `apps/website/src/services/generated/{types,client,manifest,plugins,versions,authors,search,index}.ts`; `packages/registry-generator/src/models/generated.ts`.
- **Description:** `src/services/generated` is labelled as generated SDK code, yet it is source-authored and contains independently maintained types, JSON paths, caching, and search behavior. The generator produces JSON only; no process generates or copies this SDK/type contract. `types.ts` declares that it is derived from the generator models but is a separate implementation.
- **Why it violates the architecture:** `WEBSITE_DESIGN.md` identifies `services/generated` as an owning-process-generated SDK that must not be manually patched. Duplicating its data contract permits the generator and consumer to diverge and breaks the required SDK ownership boundary.
- **Recommended correction:** Establish a single owning SDK-generation/export process from the Registry Generator contract, and treat `services/generated` as generated output. Keep website-specific service adaptation outside that generated artifact if additional stable application operations are needed.

## Homepage and search route implementations do not satisfy their documented responsibilities

- **Location:** `apps/website/src/pages/HomePage.tsx`; `apps/website/src/pages/SearchPage.tsx`; absence of `src/features/home/` and `src/features/search/`.
- **Description:** Both routes render placeholder headings and paragraphs. They do not compose feature components, invoke hooks, load generated data, implement the primary discovery/search flow, or represent search query state. They use route-page-local markup instead of the documented feature layer.
- **Why it violates the architecture:** The architecture defines `/` as the primary search/discovery entry point and `/search` as query-driven discovery. `FEATURE_ARCHITECTURE.md` requires pages to be thin wrappers that instantiate features, and `COMPONENT_ARCHITECTURE.md` prohibits pages from implementing presentation primitives directly.
- **Recommended correction:** Implement the approved home and search feature modules, with hooks delegating to services and pages remaining route adapters. Reuse shared plugin presentation and Design System primitives rather than copying page-local markup.

## UI primitives depend on route and domain concerns

- **Location:** `apps/website/src/components/ui/Link/index.tsx:8`; `apps/website/src/components/ui/Badge/index.tsx:53-73`.
- **Description:** The Design System `Link` imports `react-router-dom` and decides router navigation. `StatusBadge` is also defined inside the generic Badge primitive and hard-codes plugin/version lifecycle statuses such as `published`, `revoked`, and `removed`.
- **Why it violates the architecture:** `WEBSITE_DESIGN.md` requires UI primitives to have no route, plugin, version, or SDK knowledge. `COMPONENT_ARCHITECTURE.md` explicitly identifies a status-aware badge as forbidden domain coupling in the Design System.
- **Recommended correction:** Keep the UI layer generic (for example, presentational anchor/button and variant primitives). Place route-aware link selection and lifecycle-status-to-variant mapping in reusable domain presentation components outside `components/ui`.

## Feature components repeatedly bypass the Design System and semantic-token boundary

- **Location:** Representative examples include `apps/website/src/features/plugin/PluginFeature.tsx:123-125`, `apps/website/src/features/_shared/plugin/PluginCard/index.tsx:33-53`, `apps/website/src/features/version/components/VersionMetadata/index.tsx:23-115`, and `apps/website/src/features/author/components/AuthorHeader/index.tsx:19-65`.
- **Description:** Feature and shared components directly implement headings, body text, layout rows, panels, visual status colors, borders, and spacing with raw elements and Tailwind palette classes such as `text-gray-900`, `bg-gray-50`, and `text-green-600`. Existing primitives such as `Heading`, `Text`, `Stack`, `Inline`, `Section`, `Code`, and `List` are frequently bypassed.
- **Why it violates the architecture:** The frozen component and feature documents require feature components to compose existing Design System primitives, and `WEBSITE_DESIGN.md` requires semantic tokens or approved mappings rather than one-off colors, dimensions, and typography decisions. This makes the theme and visual system ineffective outside the primitive layer.
- **Recommended correction:** Compose the existing primitives for the represented layout and typography, and extend the approved Design System only where a documented gap exists. Replace palette-specific feature classes with centrally defined semantic token mappings.

# Medium Issues

## Shared layout exposes routes that the router does not implement

- **Location:** `apps/website/src/components/layout/Header.tsx:17-25`; `apps/website/src/components/layout/Footer.tsx:10-15`; `apps/website/src/routes/index.tsx:18-50`.
- **Description:** Header links to `/authors` and Footer links to `/about` and `/submit`; none has a matching route. All lead to the wildcard not-found page.
- **Why it violates the architecture:** Navigation is part of the shared route frame and must select the stable public locations defined by the route model. Shipping shell navigation to not-found destinations breaks the routing boundary.
- **Recommended correction:** Align shared navigation with implemented routes, or implement the approved route pages before exposing the links.

## Theme token modules are unused while styling relies on raw palette classes and inline styles

- **Location:** `apps/website/src/components/theme/*.ts`; `apps/website/tailwind.config.js`; `apps/website/src/styles/globals.css`; `apps/website/src/features/plugin/components/PluginReadmePreview/index.tsx:60-66`; `apps/website/src/features/version/components/VersionChangelog/index.tsx:33-39`.
- **Description:** The TypeScript token modules have no consumers. Tailwind defines only a primary palette, global CSS provides two unused black variables, and the feature layer uses raw gray/status classes plus inline typography values.
- **Why it violates the architecture:** The website design requires semantic color, typography, spacing, radius, elevation, and motion tokens to be the implementation vocabulary for light and dark themes. The current tokens are not an enforced or consumed boundary.
- **Recommended correction:** Centralize approved semantic mappings in Tailwind/global styles and consume them through primitives. Remove or consolidate token definitions that are not authoritative to avoid two competing design vocabularies.

## Duplicated hooks and formatting utilities create parallel ownership

- **Location:** `apps/website/src/hooks/{useAuthor,usePlugin,useVersion}.ts`; `apps/website/src/features/{author,plugin,version}/hooks/`; `apps/website/src/features/{author,plugin,version}/utils/index.ts`.
- **Description:** Global resource hooks and feature hooks independently implement very similar request-state lifecycles. Formatting functions are duplicated in feature utility modules and again as component-local functions; for example, number formatting exists in the plugin and author utilities and in `PluginMetadata` and `AuthorStatistics`. `PluginFeature` utilities are currently unused.
- **Why it violates the architecture:** Hooks and utilities each have a single, scoped responsibility. Parallel implementations blur whether the shared hook layer or feature layer owns a resource state adapter and make presentation formatting inconsistent.
- **Recommended correction:** Assign each resource hook to one layer and reuse it where appropriate. Keep presentation formatting in the relevant utility boundary and remove duplicate, unused implementations after migration.

## The Design System includes state and hand-authored SVG affordances

- **Location:** `apps/website/src/components/ui/Avatar/index.tsx:7,57`; `apps/website/src/components/ui/{ErrorState,IconButton,Pagination,Spinner}/index.tsx`; feature-local SVGs in `AuthorHeader`, `AuthorSidebar`, and `PluginSidebar`.
- **Description:** `Avatar` directly uses `useState`; several standard interface icons are hand-written SVG paths despite Lucide React being the approved icon system.
- **Why it violates the architecture:** `COMPONENT_ARCHITECTURE.md` lists hook use in the Design System as an architecture violation, and `WEBSITE_DESIGN.md` requires Lucide for standard affordances unless an approved asset is specified.
- **Recommended correction:** Move stateful fallback handling to the allowed hook/component boundary or document a primitive-specific exception. Use Lucide icons for standard interface controls and status affordances, retaining inline SVG only for approved assets.

# Low Issues

## Obsolete component namespaces and inconsistent layout file convention

- **Location:** `apps/website/src/components/{plugin,search,version,author}/index.ts`; `apps/website/src/components/layout/{Header,Footer}.tsx`.
- **Description:** The four feature component barrels are empty placeholders while the active components live under `src/features/`. Header and Footer are single files rather than the documented per-component directory convention.
- **Why it matters:** These paths suggest a second, unused component architecture and make ownership less discoverable.
- **Recommended correction:** Remove obsolete placeholders when safe, and use one documented folder convention for layout components.

## Generated and build artifacts are checked into source-oriented paths

- **Location:** `apps/website/tsconfig.tsbuildinfo`; `packages/registry-generator/tsconfig.tsbuildinfo`; `src/registry/*.{js,d.ts,map}`.
- **Description:** TypeScript build metadata and emitted JavaScript/declaration artifacts coexist with TypeScript source. This makes the repository tree harder to audit and can create uncertainty about which files are authoritative.
- **Why it matters:** It weakens package and artifact ownership clarity, although it does not by itself violate a website runtime boundary.
- **Recommended correction:** Define and enforce generated-artifact locations/ignore rules consistent with each package's build process.

# Observations

- **Files inspected:** all four mandated architecture documents; 109 website source/style files under `apps/website/src`; website configuration and public generated-data files; all 16 Registry Generator source files; root/package configuration; and generated-output artifacts under both `apps/website/public/generated` and `packages/apps/website/public/generated`. The broader repository structure and package boundaries were also inspected; the documented source of truth governs the website, so backend-domain implementation was not assessed against undeclared website rules.
- The source tree has no detected direct JSON module imports and only one executable `fetch()` call, in `services/generated/client.ts`; this is the correct intended access chokepoint.
- The data client is React-free and offers caching, preloading, and typed load operations. Its structure is a sound basis once the generated-data ownership problem is resolved.
- Plugin, version, and author features all use their local hooks correctly for React lifecycle state and return stable loading/error/not-found shapes.
- The repository had pre-existing uncommitted and untracked files before this audit. They were not changed as part of the review.
- TypeScript passed without errors for `apps/website` using `npm run typecheck`; this validates type consistency, not availability of the generated files or route behavior at runtime.

# Recommendations

1. Reconnect the existing Registry Generator, website public output, SDK generation, and build command into the documented static-data pipeline.
2. Treat `services/generated` as generated contract output with one owner; keep any website-specific operations in a clear service adapter layer.
3. Complete the existing home and search feature modules and route them through thin pages, using the established hooks, shared plugin components, and UI primitives.
4. Enforce the existing Design System boundary: generic UI only, domain presentation outside it, semantic tokens centralized, and standard icons supplied by Lucide.
5. Align shell navigation and eliminate unused/duplicated modules only after their active replacements are confirmed.

These recommendations preserve the current React, Vite, Tailwind, Registry Generator, Website Data SDK, Design System, and feature architecture.
