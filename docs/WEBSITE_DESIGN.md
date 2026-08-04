# Website Design

**Status:** Approved Architecture  
**Version:** 1.0  
**Owner:** Axolotl PM Frontend Architecture  
**Last Updated:** 2026-08-02

## Purpose

This document is the normative visual and frontend architecture specification for the Axolotl PM website. Future frontend work MUST conform to its boundaries, dependency direction, and approved visual design.

It records long-lived decisions rather than implementation steps. Where a conflict exists, this document takes precedence for website architecture; the approved Figma Make project takes precedence for visual appearance.

## Scope

This specification covers the React website in `apps/website`, including its visual system, component structure, routing, static data consumption, state boundaries, accessibility, and performance requirements.

It does not define Registry schemas, generation algorithms, publication workflows, or backend domain behavior.

## Goals

- Present Registry-derived plugin data as a fast, accessible static website.
- Preserve clear separation between Registry, generator, SDK, React state, and presentation.
- Implement the approved design consistently across routes, screen sizes, and themes.
- Make reusable UI predictable, composable, and maintainable.
- Keep the website deployable without a runtime backend.

## Non Goals

The website MUST NOT:

- Parse Registry YAML or access Registry internals.
- Duplicate Registry models, validation, parsing, lifecycle, or provenance logic.
- Generate JSON or otherwise implement Registry Generator responsibilities.
- Implement search algorithms or ranking rules inside hooks.
- Fetch GitHub directly for Registry, release, author, or provenance data.
- Contain backend, publication, review, materialization, or build logic.
- Mutate generated data.
- Redesign approved layouts, visual hierarchy, or interaction patterns during implementation.

## Source Of Truth

The approved Figma Make project is the authoritative visual source:

<https://window-resin-92466268.figma.site/>

Figma defines the approved layouts, visual hierarchy, responsive compositions, component states, typography treatment, color application, spacing, and icon usage. An implementation MUST reproduce those decisions rather than substitute an independently designed solution.

The authoritative data source is the generated JSON dataset. Its contract is defined by the Registry Generator and exposed to the website through the generated SDK. Registry YAML is authoritative only to backend and generator domains; it is not a website input.

## Technology Stack

| Technology | Responsibility | Rationale |
| --- | --- | --- |
| React | Declarative UI composition | Supports reusable, stateful interfaces with a mature ecosystem. |
| TypeScript | Application and SDK typing | Makes data-contract and component-boundary errors visible before runtime. |
| Vite | Development server and production bundling | Provides fast local feedback and efficient static production output without server runtime requirements. |
| Tailwind CSS | Token-based styling implementation | Enables consistent application of approved design values while keeping styles close to presentation components. |
| React Router | Client-side route composition | Maps stable public URLs to focused pages without coupling routes to data access. |
| Lucide React | Icon library | Provides accessible, consistent, tree-shakeable interface icons. |

The website remains a static consumer. Vite is selected because no server-side application behavior is required by this architecture.

## Frontend Architecture

The website follows this fixed dependency flow:

```text
Registry
  -> Registry Generator
  -> Generated JSON
  -> Generated SDK (services/)
  -> Hooks
  -> Pages
  -> Reusable Components
  -> UI
```

Each layer has one responsibility. This direction prevents presentation code from acquiring knowledge of Registry implementation details and keeps data behavior testable outside React.

### Dependency Direction

- Registry and Registry Generator are upstream systems. The website MUST NOT import from them.
- Generated JSON is read-only input served from `public/generated/`.
- `services/` is the only website layer that reads generated JSON and interprets its generated SDK contract.
- Hooks MAY import services and expose React-compatible loading, error, and local interaction state.
- Pages MAY import hooks, layouts, and reusable components.
- Components MAY import UI primitives and presentation-only utilities; they MUST NOT import generated JSON or services directly.
- UI primitives MUST NOT depend on feature, route, Registry, or SDK concerns.

Dependencies MUST NOT point upward in this diagram. In particular, services never import React, and generated SDK modules never import pages, hooks, or components.

## Folder Structure

The website uses the following responsibility-oriented structure. Exact file names may evolve, but ownership boundaries MUST remain intact.

```text
apps/website/
├── public/
│   └── generated/             # Read-only generator output
├── src/
│   ├── components/
│   │   ├── ui/                # Design-system primitives
│   │   ├── layout/            # Shared page frames and navigation
│   │   └── features/          # Reusable domain presentation
│   ├── hooks/                 # React state adapters around services
│   ├── layouts/               # Route-level structural layouts
│   ├── pages/                 # Route composition only
│   ├── routes/                # Router definition
│   ├── services/
│   │   └── generated/         # Generated SDK; do not hand-edit
│   ├── styles/                # Global tokens and base styles
│   └── main.tsx               # Application entry point
├── tailwind.config.js         # Tailwind token mapping
└── vite.config.ts             # Build configuration
```

Generated SDK files are implementation artifacts of the Website Data SDK. They MUST be regenerated by their owning process, never manually patched to compensate for missing data or behavior.

## Component Hierarchy

```text
Application
├── Router
│   └── RootLayout
│       ├── Page
│       │   ├── Layout Components
│       │   └── Feature Components
│       │       └── UI Components
│       └── Shared Footer
└── Hooks
    └── Services / Generated SDK
```

### UI Components

UI components are generic primitives such as buttons, links, inputs, badges, cards, dialogs, menus, loading indicators, and empty states. They define accessible behavior and approved visual variants, but have no plugin, version, author, route, or data-fetching knowledge.

### Layout Components

Layout components establish shared structural regions such as the application shell, header, footer, content container, route frame, and responsive navigation. They are responsible for placement, not feature decisions.

### Feature Components

Feature components render reusable registry concepts, including plugin cards, plugin headers, version lists, author summaries, installation commands, provenance indicators, search result rows, and status notices. They receive already-prepared data through props and contain presentation only.

Components MUST be reused when the same visual and behavioral pattern occurs in more than one route. Copying equivalent markup into pages is prohibited because it causes visual drift from the approved system.

## Routing

Routes provide stable public locations and select pages. The current route model is:

| Route | Responsibility |
| --- | --- |
| `/` | Homepage and primary discovery entry point. |
| `/search` | Search results and query-driven discovery. |
| `/plugins/:slug` | Plugin detail. |
| `/versions/:slug/:version` | Version detail. |
| `/authors/:owner` | Author detail. |
| `*` | Not-found response within the shared application shell. |

Route parameters identify resources; they do not contain decoded Registry models. Query parameters represent navigable UI state, such as a search query, when the approved design requires it. Pages MUST handle missing generated records through the routed not-found or approved empty/error presentation, never by querying GitHub or Registry sources.

## Design System

The design system is the implementation vocabulary for the approved Figma design. It exists to prevent visual divergence, not to create a separate visual language.

### Design Tokens

Tokens MUST be semantic. Components MUST use semantic tokens or approved Tailwind mappings rather than introducing one-off colors, dimensions, shadows, or fonts.

| Token Family | Required Use |
| --- | --- |
| Color | Canvas, surface, text, border, action, focus, status, and overlay roles. |
| Typography | Font family, size, line height, weight, letter spacing, and text hierarchy. |
| Spacing | Layout gaps, padding, margins, section rhythm, and control density. |
| Radius | Approved control, card, panel, and overlay corner treatments. |
| Elevation | Approved surface separation and overlay depth. |
| Motion | Approved transition duration and easing, with reduced-motion alternatives. |

Exact token values MUST match the approved Figma variables and styles. Tailwind configuration and global CSS are the implementation mapping for those values; they are not independent design authorities.

### Color Palette

The palette MUST be expressed by semantic roles, including canvas, elevated surface, primary and secondary text, muted text, border, primary action, hover, focus, success, warning, danger, and informational status. A color's meaning MUST remain stable across components and themes.

Primary blue values currently mapped in Tailwind are implementation tokens only. Any adjustment MUST be derived from the approved Figma palette and applied centrally, never introduced as an arbitrary per-component value.

### Typography

The approved sans-serif interface typeface and monospace code typeface MUST be used consistently. The current implementation maps `Inter` as sans-serif and `JetBrains Mono` as monospace. Typography levels MUST communicate the Figma-defined hierarchy; headings, body text, labels, metadata, links, and code MUST not be sized or weighted ad hoc.

Monospace typography is reserved for commands, checksums, versions where appropriate, and other machine-readable values. It MUST not replace the interface typeface for ordinary prose.

### Spacing System

All spacing MUST use the approved token scale. The system establishes consistent rhythm between page sections, component internals, result rows, and responsive layouts. Arbitrary pixel values are prohibited unless they represent a documented Figma exception that cannot be expressed by the scale.

### Border Radius And Elevation

Radius and elevation communicate component hierarchy. Controls, cards, panels, dialogs, and popovers MUST use their approved tokenized treatments. Elevation MUST be restrained and used only to distinguish interactive overlays or layered surfaces, not as decorative noise.

### Icons

Lucide React icons MUST be used for standard interface affordances unless Figma specifies an approved asset. Icons MUST have an accessible name when they are the only meaningful content of a control. Decorative icons MUST be hidden from assistive technology. Icon choice, size, stroke weight, and alignment MUST follow the approved design.

## Layout Principles

- Preserve the content hierarchy and section ordering established in Figma.
- Use shared containers and approved maximum widths to maintain alignment across routes.
- Favor readable content measure, deliberate whitespace, and scan-friendly registry metadata.
- Keep primary actions visible and unambiguous, especially download, installation, navigation, and verification actions.
- Present trust, status, checksum, and provenance information accurately without implying security guarantees beyond the generated data.
- Do not introduce marketing sections, decorative treatments, dashboard patterns, or data visualizations absent from the approved design.

## Responsive Design

The interface MUST be responsive, not merely scaled down. Desktop, tablet, and mobile compositions MUST follow the approved Figma breakpoints and layout changes.

- Content remains readable and actionable from narrow mobile widths through large desktop widths.
- Navigation, sidebars, multi-column content, filters, and dense metadata MUST reflow or collapse according to the approved responsive composition.
- Interactive targets MUST remain usable on touch devices.
- Horizontal scrolling is prohibited except for intentional, accessible overflow regions such as long code or checksum values.
- Responsive changes MUST retain information hierarchy; mobile layouts may reorder visual groups only when approved by Figma.

## Accessibility

Accessibility is a required architectural property, not a finishing pass.

- Use semantic HTML before adding ARIA.
- Every interactive control MUST be keyboard operable, visibly focusable, and have an accessible name.
- Focus order MUST follow the visual and reading order.
- Color MUST NOT be the sole carrier of status, validation, or trust information.
- Text and interactive states MUST meet applicable contrast requirements in both themes.
- Forms and search inputs MUST have programmatic labels and understandable validation or error feedback.
- Dialogs, menus, and other overlays MUST manage focus correctly and support escape behavior where appropriate.
- Dynamic results, loading states, and errors MUST be announced or represented in an accessible manner without excessive interruption.
- Respect `prefers-reduced-motion`; motion MUST not be required to understand content or complete a task.

## Light And Dark Theme

The website MUST support the approved light and dark themes. Theme differences MUST be implemented through semantic tokens, not duplicated component styles.

- Both themes MUST preserve hierarchy, contrast, status meaning, and interactive affordances.
- Theme selection and persistence, if exposed by the approved design, are React state concerns implemented through hooks or a dedicated theme provider.
- Components MUST consume semantic foreground, surface, border, and action tokens so that they remain correct in both themes.
- A component-specific dark-mode override is permitted only for a documented token gap and must be eliminated once the token system supports the role.

## Service Responsibilities

Services provide the website's data and domain-operation boundary.

- Services read generated JSON exclusively through the generated Website Data SDK.
- Services may select data, coordinate generated SDK calls, normalize SDK-level failures, and expose stable application-facing operations.
- Search behavior, including any client-side index usage, filtering semantics, ranking, normalization, and result construction, belongs in services or the generated SDK contract, never in hooks or components.
- Services return typed values and MUST be independently usable without React.
- Services MUST NOT import React, access component state, render UI, parse Registry YAML, or fetch GitHub directly.

This boundary keeps business behavior reusable and prevents React lifecycle code from becoming a second implementation of Registry behavior.

## Hook Responsibilities

Hooks adapt services to React.

- Hooks manage request lifecycle state, local UI state, memoization where justified, and subscription or cancellation behavior where required.
- Hooks expose typed loading, success, empty, and error states suitable for pages and components.
- Hooks MAY synchronize approved navigable UI state with route parameters or query parameters.
- Hooks MUST delegate data operations and search behavior to services.
- Hooks MUST NOT parse generated files, implement ranking or filtering policy, duplicate SDK types, call GitHub, or contain backend logic.

Hooks exist so React-specific state management does not leak into services or presentation components.

## Page Responsibilities

Pages are thin route compositions.

- A page reads route state, invokes hooks, selects the correct layout, and composes reusable feature components.
- A page owns route-level loading, empty, error, and not-found composition.
- A page MUST NOT parse data, calculate business outcomes, perform Registry transformations, or reproduce component internals.
- A page MUST NOT contain a feature implementation that belongs in a reusable component.

This keeps routes understandable and allows the same feature presentation to be reused without coupling it to one URL.

## Implementation Rules

The following rules are mandatory:

- Pages compose components.
- Components compose UI primitives.
- Business logic belongs in services.
- React state belongs in hooks.
- Services never import React.
- Hooks never contain business logic.
- Components contain presentation only.
- Generated JSON is read-only.
- The website never mutates generated data.
- The generated SDK is the data access contract; generated files MUST NOT be hand-edited.
- New dependencies require an architectural rationale and MUST not bypass the established layer boundaries.
- Visual changes require alignment with the approved Figma source before implementation.

## Performance Principles

- Treat generated JSON as static, cacheable data and load only the resource required for the current route or interaction.
- Use the generator-provided indexes and precomputed fields instead of reconstructing indexes or repeatedly joining large datasets in the browser.
- Keep route and feature bundles focused; lazy-load non-critical, route-specific presentation where it improves initial rendering without harming navigation clarity.
- Avoid unnecessary React state, effects, and rerenders. Derived display values belong close to presentation when they are not business decisions.
- Do not fetch data that is already represented by generated SDK output.
- Optimize images and static assets using the project build pipeline while preserving approved visual quality.

The generator produces JSON rather than HTML so the frontend retains accessible, theme-aware, reusable presentation control while the data contract remains static, cacheable, and independently evolvable.

## Future Extension Guidelines

Extensions MUST preserve the established flow. A new data capability starts with Registry and Generator contract design, then generated JSON and SDK exposure, followed by services, hooks, pages, and components. It MUST NOT start with an ad hoc GitHub call or a component-local data model.

- Additive generated fields and endpoints are preferred over breaking existing consumers.
- New visual patterns MUST first be represented in the approved design source and then added as reusable primitives or feature components as appropriate.
- New routes MUST reuse the root layout and design tokens.
- A new global state mechanism is justified only when local hooks and existing providers cannot represent the state clearly.
- A runtime backend, authenticated user features, or server mutation path is outside this architecture and requires an explicit architecture decision before implementation.

## Contribution Rules

Contributors MUST:

- Read this specification and inspect the approved Figma design before modifying frontend behavior or appearance.
- Preserve layer boundaries and import direction.
- Use existing tokens and reusable components before adding variants or new primitives.
- Keep generated artifacts generated; change their owning schema, generator, or SDK process rather than patching output manually.
- Validate responsive, keyboard, focus, and theme behavior for every affected interface.
- Document any approved architectural exception in the relevant change before relying on it.

Pull requests that duplicate Registry behavior, bypass services, embed business logic in hooks or pages, or introduce unapproved visual redesigns MUST NOT be accepted.

## Architecture Decision Summary

| Decision | Rationale |
| --- | --- |
| React with TypeScript | Reusable declarative UI with explicit, safe data contracts. |
| Vite static build | Fast development and low-operational-complexity deployment for a read-only website. |
| Tailwind CSS with semantic tokens | Consistent implementation of Figma decisions without one-off styling. |
| Generated JSON only | Static, cacheable, auditable website input that isolates frontend from Registry internals. |
| Generated SDK as data boundary | Keeps JSON paths, schema details, and access behavior out of React code. |
| Services own business operations | Makes data behavior testable and independent of React lifecycle. |
| Hooks own React state only | Prevents duplicated domain behavior and keeps UI state localized. |
| Pages compose; components present | Promotes reuse and prevents route files from becoming feature implementations. |
| Figma is visual authority | Prevents implementation-time redesign and maintains a coherent product experience. |
| Semantic themes and accessibility | Ensures the approved interface remains usable across color modes, devices, and assistive technologies. |
