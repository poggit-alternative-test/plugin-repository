# Search Experience

**Status:** Normative UX Specification
**Version:** 1.0
**Owner:** Axolotl PM Product Experience
**Last Updated:** 2026-08-02

## Purpose

This document is the normative product and user-experience specification for Search on the Axolotl Plugin Manager website. It defines the complete Search experience so that an implementing engineer can build it without making independent UX decisions.

This document describes **experience**, not implementation. It does not specify React components, hooks, services, or code. Where this document and the approved Figma source conflict on visual appearance, Figma is authoritative for appearance and this document is authoritative for behavior and information design.

This document conforms to and must not contradict:

- `docs/WEBSITE_DESIGN.md`
- `docs/FEATURE_ARCHITECTURE.md`
- `docs/COMPONENT_ARCHITECTURE.md`

## Scope

The specification covers the `/search` route and every entry point that leads to it: how users initiate search, how the query and view state map to the URL, how results are displayed and refined through filtering and sorting, how every state is presented, and how the experience behaves across desktop and mobile with full accessibility.

The specification does not define search ranking algorithms, index construction, data-access contracts, or any behavior owned by the Registry, Registry Generator, SDK, services, or Design System. It references data fields only to describe what the user sees, never how it is fetched or computed.

## Definitions

- **Query** — the free-text term a user is searching for, represented by `q`.
- **Result** — a single plugin that matches the current query and active filters.
- **Result set** — the ordered collection of results for the current query, filters, and sort.
- **View state** — everything that changes what the user sees without changing the query: active filters, sort order, page, and layout mode.
- **Canonical URL** — the single normalized URL that fully represents the current query and view state and can be shared, bookmarked, or reloaded to reproduce the same experience.

---

# Goals

## User Goals

- Find a specific plugin quickly by name or author.
- Discover plugins within a topic, category, or capability area.
- Judge quickly whether a result is trustworthy and current, using status, verification, author, latest version, downloads, and release recency.
- Refine a broad result set down to relevant plugins using filters and sorting.
- Return to, share, or bookmark a search and see the same results.
- Complete all of the above comfortably on a phone or a desktop, including with a keyboard or screen reader.

## Product Goals

- Make discovery a primary, obvious path from the homepage and from every page via the header.
- Keep the query and refinement state fully represented in the URL so search is shareable, linkable, and reload-safe.
- Present accurate trust and status information without implying guarantees beyond the generated data.
- Preserve the approved visual system and information hierarchy across all breakpoints and themes.
- Keep search fast and responsive to interaction, with clear feedback for every state.

## Non-Goals

- No account-based, personalized, or history-based ranking.
- No server-side search, autocomplete backend, or query logging service.
- No saved searches, alerts, or notifications in the MVP.
- No fuzzy natural-language querying beyond the approved matching behavior.

---

# Search Entry Points

Search can be initiated from four entry points. All of them converge on the canonical `/search` experience.

## Homepage

The homepage presents a primary search affordance as a central discovery action. Submitting a query from the homepage navigates the user to the `/search` route with that query applied.

- The homepage search field is a starting point only; it does not display results in place.
- Submitting an empty or too-short query from the homepage does not navigate; instead it gives the same inline validation feedback described under Search Behavior.
- The homepage may present discovery shortcuts (for example, popular or recently updated plugins). Activating such a shortcut navigates to `/search` with the corresponding query or filter pre-applied, so the user lands in a normal, refinable search state rather than a dead-end view.

## Header

A persistent search affordance is available in the site header on every route, so search is reachable from anywhere without returning to the homepage.

- On desktop, the header search is an always-visible input.
- On mobile, the header exposes search through a search action that opens the search input; it must be reachable within one tap and must not be hidden behind an unrelated menu.
- Submitting a query from the header navigates to `/search` with that query applied. If the user is already on `/search`, submitting updates the current search in place rather than creating a redundant navigation.
- The header search field reflects the active query when the user is on `/search`, so the header and the results always agree.

## Direct URL

Users may arrive at `/search` directly through a shared link, bookmark, or typed URL.

- Any valid canonical URL reproduces the exact query, filters, sort, page, and layout it encodes.
- Arriving with only a query and no view-state parameters applies the documented defaults for filters, sort, page, and layout.
- Arriving with no query (a bare `/search`) presents the **empty (no query yet)** state described under States, not an error.

## Empty Repository

When the underlying dataset contains no plugins at all, search must still behave predictably.

- Entry points remain visible and operable; search is never hidden because data is absent.
- Submitting any query in an empty repository leads to the **no results** state, with copy that communicates that the repository currently has no plugins rather than implying the user's query was at fault.
- Filters and sort controls that would have no effect are either hidden or presented as disabled with an accessible explanation; they must never appear active but non-functional.

---

# URL Design

The URL is the single source of truth for the search experience. Everything the user can see or reproduce must be expressible in the URL.

## Parameters

| Parameter | Meaning | Omitted when |
| --- | --- | --- |
| `q` | The search query text | No active query |
| `page` | 1-based result page number | On page 1 |
| `sort` | Active sort order | Using the default sort |
| `category` | Active category filter | No category filter |
| `author` | Active author filter | No author filter |
| `status` | Active status filter | No status filter |
| `view` | Layout mode (grid or list) | Using the default layout |

## Examples

```
/search?q=topstats
/search?q=economy&page=2
/search?q=economy&sort=downloads
/search?q=world&category=world-management&sort=recently-updated
/search?q=&status=published        → normalizes to /search?status=published
/search?q=Economy                  → normalizes to /search?q=economy (see below)
```

## Canonical URL Behavior

- The canonical URL contains **only** parameters that differ from their defaults. Default page (1), default sort, default layout, and empty filters are omitted.
- Query text is normalized consistently (trimmed of leading and trailing whitespace; case is not significant to matching). The canonical URL reflects the normalized query so that equivalent searches share one URL.
- Parameter order in the canonical URL is stable and deterministic, so identical searches always produce byte-identical URLs and are cacheable and de-duplicable.
- Unknown or unsupported parameters are ignored and dropped from the canonical URL.
- Invalid parameter values (for example, a non-numeric `page`, a `page` beyond the last page, or an unrecognized `sort`, `status`, `category`, or `view`) are corrected to the nearest valid default rather than producing an error. Correction updates the URL to the canonical form so the address bar always reflects the true state.
- Changing the query resets `page` to 1. Changing any filter resets `page` to 1. Changing sort preserves the current query and filters and resets `page` to 1. Changing layout (`view`) preserves everything else including `page`.
- A bare `/search` with no parameters is itself canonical and represents the **empty (no query yet)** state.

---

# Search Behavior

## Minimum Query Length

- The minimum query length is **two characters** after normalization.
- A one-character or empty query does not execute a search. Instead it shows the appropriate empty or validation state and does not populate `q` in a way that would produce an empty result set.
- Whitespace-only input is treated as empty.

## Instant Search vs Submit

Search combines instant feedback with explicit submission:

- **Typing** in a search field updates results **instantly** once the query meets the minimum length, subject to debounce. The user does not need to press Enter to see results while actively refining a query on the `/search` route.
- **Pressing Enter** (or activating the search control) commits the current query immediately, bypassing the remaining debounce delay.
- Entry points **outside** `/search` (homepage and header on other routes) act on **submit**: the user completes their query and submits to navigate to `/search`. They do not stream results into a non-search page.

## Debounce Behavior

- Instant-search updates are debounced so that rapid typing does not flood the interface with intermediate result sets.
- The debounce interval is short enough to feel responsive and long enough to avoid visible thrash; the target is roughly a quarter of a second and must remain in a range that feels immediate (150–300 ms).
- Debounce applies to the **result update and URL synchronization**, not to what the user sees in the input. The input always reflects keystrokes instantly.
- Pressing Enter cancels any pending debounce and commits immediately.

## URL Synchronization

- Committed query and all view state are reflected in the canonical URL.
- While the user is actively typing, the URL updates on the same debounced cadence as results, so the address bar tracks the query without a separate keystroke-by-keystroke rewrite.
- Filter, sort, layout, and page changes update the URL immediately upon the interaction (these are discrete actions, not streamed input).

## Browser History

- Committing a **new query** (pressing Enter, submitting from an entry point, or the debounce commit of a meaningfully changed query) creates a **new history entry**, so Back returns to the previous search.
- Intermediate keystrokes while typing must **not** each create history entries; only the committed query does. Debounced typing replaces the current history entry until commit.
- Filter and sort changes create history entries so users can step back through refinements with Back.
- **Pagination** creates history entries so Back returns to the previously viewed page.
- **Layout (grid/list) toggling** does **not** create a history entry; it replaces the current entry, because it is a view preference rather than a navigation.
- Using Back or Forward restores the exact query, filters, sort, page, and layout from that history entry, and the visible controls update to match.

## Refresh Behavior

- Reloading `/search` reproduces the exact experience encoded in the current URL: same query, filters, sort, page, and layout.
- A reload shows the **loading** state until results are ready, then the corresponding results, empty, no-results, or error state.
- Reload must never silently drop the query or reset refinements.

## Direct Linking

- Any canonical `/search` URL is fully shareable. A recipient opening the link sees the same query, the same active filters and sort, the same page, and the same layout the sender saw (data permitting).
- If a linked filter value no longer exists in the data (for example, a category or author that is gone), that filter is dropped, the URL is normalized, and the user sees a non-blocking notice that a filter was removed, followed by the still-valid remainder of the search.

---

# Search Layout

The search page composes, from top to bottom, a search bar, a results toolbar (result count, sort control, and layout switch), the filter surface, the results region, and pagination. The approved Figma composition governs exact placement, spacing, and proportions.

## Desktop

- A two-region layout: a **filter sidebar** on one side and the **results content** occupying the remaining width.
- The **search bar** spans the top of the content region and remains prominent.
- A **results toolbar** sits above the results and contains the **result count**, the **sort control**, and the **grid/list switch**, aligned on a single row.
- The **filter panel** is persistently visible in the sidebar; users refine without opening or closing anything.
- **Pagination** appears below the results, centered within the content region.

## Mobile

- A single-column, stacked layout.
- The **search bar** is at the top and remains easily reachable.
- The **filter panel** is not persistently visible; it is reached through a clearly labeled **Filters** control that opens a filter drawer (see Mobile Experience). The Filters control shows how many filters are currently active.
- The **result count** and **sort control** remain visible above the results; the **grid/list switch** may be presented compactly but must remain reachable.
- **Pagination** appears below the results, full width and touch-friendly.

## Responsive Breakpoints

- Breakpoints follow the approved Figma responsive composition. The layout transitions between the mobile single-column form and the desktop sidebar form at the approved breakpoint; an intermediate (tablet) composition, if defined in Figma, is honored.
- The persistent sidebar appears only at widths where it does not compress results below a comfortable reading measure; below that width, filters collapse into the drawer.
- Reflow must preserve information hierarchy: search bar, then result count and controls, then results, then pagination. Mobile must not bury the result count or sort behind the filter drawer.

## Search Bar

- Always shows the current active query.
- Provides a clear/reset affordance to empty the query in one action; clearing returns the page to the **empty (no query yet)** state and normalizes the URL.
- Has a visible, programmatic label and communicates the minimum-length and validation feedback inline.

## Result Count

- States how many results match the current query and active filters (for example, a total count and, where paginated, the range shown on the current page).
- Reflects filters: the count is the filtered total, not the unfiltered total.
- Is announced to assistive technology when it changes as a result of a query, filter, or sort change, without interrupting typing excessively.

## Filter Panel

- Presents the available filter groups (see Filtering). Each group communicates which options are selected.
- Shows the count of currently active filters and provides a single **Clear all filters** action.
- On desktop it is the persistent sidebar; on mobile it is the drawer.

## Sort Controls

- A single control that selects the active sort order from the supported options (see Sorting).
- Always shows the currently active sort.
- Changing sort reorders results in place and updates the URL; it does not change which results match.

## Grid/List Switch

- A control that toggles between the grid and list presentations of the same results.
- Shows which layout is active.
- Purely a view preference: it changes presentation density and arrangement, never which results appear or their order.

## Pagination

- Appears when the result set exceeds one page.
- Communicates the current page and allows moving to adjacent pages and, where the approved design supports it, jumping to a specific page.
- Moving pages preserves query, filters, sort, and layout and updates the URL and history as specified.
- On page change, the results region scrolls to a consistent position (the top of the results) and moves focus appropriately (see Accessibility).

---

# Search Results

Each result is presented using the approved reusable plugin card/row presentation. The same plugin presentation is reused across grid and list layouts; only arrangement and density differ. Result content is limited to data available for a result and must not imply information the data does not contain.

## Plugin Card Contents

A result presents the following, subject to the approved visual design:

- **Name** — the plugin name, as the primary, prominent, actionable element. Activating it opens the plugin detail route.
- **Status** — the plugin's lifecycle status (for example approved, materialized, published, deprecated, revoked, removed), shown as a status indicator that does not rely on color alone.
- **Author** — the plugin's author, presented as identifying metadata. Where the approved design allows, the author is a path into the author's page.
- **Latest Version** — the latest version identifier, presented as a machine-readable value.
- **Summary** — a concise one- or two-line description; truncated gracefully when long, never breaking the layout.
- **Categories** — the plugin's categories, shown when present; used for scanning and as a discovery affordance where the approved design permits.
- **Downloads** — the download count when available, shown in an abbreviated, human-readable form; omitted entirely when the datum is absent (never shown as zero-as-unknown).
- **Verification** — a verification indicator when the plugin carries an attestation/verified signal; its presence communicates verification and its absence must not be presented as a warning. It must not imply security guarantees beyond the generated data and must not rely on color alone.
- **Release date / recency** — a release or update recency signal (for example, "updated" recency) presented in a human-readable, relative or absolute form consistent with the approved design; used to judge currency.

## Field Presence and Fallbacks

- Optional fields (downloads, categories, verification) are shown only when present and are omitted cleanly otherwise; their absence must not create empty placeholders or misalignment.
- Required fields (name, status, author, latest version, summary) are always present; if a summary is empty, an approved neutral fallback is shown rather than blank space.
- No field may be fabricated or estimated for display.

## Grid vs List

- **Grid** emphasizes scanning many plugins at once with a denser, card-based arrangement.
- **List** emphasizes readability and comparison with a wider, row-based arrangement that may surface slightly more metadata per result.
- Both present the same fields defined above; the difference is arrangement and density, not information content.

---

# Filtering

Filters narrow the result set. All active filters combine with **AND** logic: a result must satisfy every active filter and the query. Filters never reorder results (that is Sorting's role); they only include or exclude.

## Status

- Filter by plugin lifecycle status.
- Presented as a selectable set of the meaningful statuses for discovery. By default, results are not restricted by status beyond the platform's default visibility rules; the filter lets the user narrow to a specific status.
- Selecting a status updates the result count and the URL and resets to page 1.

## Category

- Filter by one category at a time in the MVP.
- Only categories that exist in the data are offered; each option may show how many plugins it covers where the approved design supports it.
- Selecting a category narrows results to plugins in that category.

## Author

- Filter to a single author.
- The author filter is commonly arrived at by navigating from an author context or by matching an author in the query; it narrows results to that author's plugins.
- Only authors present in the data are valid; an unknown author value is dropped per the direct-linking rules.

## Runtime / API

- Filter by the runtime/API compatibility signal (for example, the API version a plugin targets) so users can find plugins compatible with their server.
- Offered when the data exposes this signal for results; presented as a selectable set of the available API/runtime values.
- If the signal is unavailable for the current dataset, the filter is hidden rather than shown empty.

## Combination and Clearing

- Active filters are always visible and individually removable.
- A single **Clear all filters** action removes every filter at once, preserving the query and sort.
- The active-filter count is surfaced on the filter entry (sidebar header on desktop, Filters control on mobile).

## Future Extensibility

The filter surface is designed to accept additional filter groups over time (for example, license, tags, verified-only, or multi-select variants of existing groups) without changing the interaction model. New filters follow the same rules: AND combination, URL representation, page reset on change, and data-driven option availability. Adding filters must not require redesigning the filter panel's interaction pattern.

---

# Sorting

Sorting reorders the current result set without changing which results match. Exactly one sort is active at a time.

## Supported Orders

- **Relevance** — orders by match quality against the query. Available only when a query is present.
- **Alphabetical** — orders by plugin name in a stable, locale-appropriate order.
- **Recently Updated** — orders by most recent update first.
- **Newest Release** — orders by most recent release first.
- **Downloads** — orders by download count, most downloaded first; results without a download count sort to the end deterministically.

## Default Ordering

- When a **query is present**, the default sort is **Relevance**.
- When **no query is present** (browsing via filters only, or a bare filtered `/search`), Relevance is not meaningful; the default sort is **Recently Updated**.
- The default sort is omitted from the canonical URL; any non-default selection is reflected in `sort`.
- Ties in any sort are broken deterministically (for example, by name) so ordering is stable across reloads and shares.

---

# States

Every search view resolves to exactly one of the following states, each with distinct, approved presentation.

## Empty (No Query Yet)

- Shown at a bare `/search` with no query and no meaningful filters.
- Communicates how to start (prompt to type a query) and may present discovery shortcuts (popular, recently updated) as approved.
- Not an error and not a "no results" state.

## Loading

- Shown while results for the current URL are being prepared, including on first load, reload, and after committing a query or changing filters/sort/page.
- Uses approved skeletons or loading indicators that preserve layout and avoid content jumps.
- Loading must not discard the current query text or control state; controls remain visible and reflect the pending state.
- For instant-search refinements, the loading indication is subtle and must not cause the results region to fully clear on every keystroke; prior results may remain visible until replaced, if the approved design specifies so.

## No Results

- Shown when the query and filters are valid but nothing matches.
- Clearly states that no plugins match, echoes the effective query and active filters, and offers constructive next steps: clear filters, broaden or edit the query.
- Distinguishes "no matches for your query" from "the repository is empty" (empty-repository copy) so the message is accurate.

## Network Error

- Shown when results cannot be loaded due to a data/network failure.
- Explains that results could not be loaded, is not blamed on the user's query, and offers a retry action.
- Retrying re-attempts the same canonical search without losing the query or refinements.

## Invalid Query

- Shown when the query is below the minimum length or otherwise not searchable.
- Presented as inline, non-blocking validation on the search field, telling the user the minimum length.
- Does not present as a hard error page and does not clear what the user typed.

## State Precedence

When multiple conditions could apply, the presented state follows this precedence: Network Error → Loading → Invalid Query → No Results → Empty (No Query Yet) → Results. Errors are surfaced over stale content; validation is surfaced before empty results.

---

# Accessibility

Accessibility is required, not optional, and follows `docs/WEBSITE_DESIGN.md`.

## Keyboard Navigation

- Every control — search field, clear button, each filter option, sort control, layout switch, each result's primary action, and pagination — is fully operable by keyboard.
- Tab order follows visual and reading order: search, then toolbar controls, then filters (or the Filters trigger on mobile), then results, then pagination.
- Enter commits the query from the search field. Standard activation keys operate buttons, toggles, and links.
- The mobile filter drawer traps focus while open, is dismissible with Escape, and returns focus to the control that opened it on close.

## ARIA and Semantics

- Semantic HTML is used first; ARIA supplements only where semantics are insufficient.
- The search field is a labeled search input with a programmatic label and an accessible description for the minimum-length rule.
- The result count is exposed as a status/live region so its changes are announced.
- Filter groups are labeled groups; each option communicates its selected state programmatically.
- The sort control and layout switch expose their current value/state to assistive technology.
- Pagination communicates the current page and the available navigation programmatically.

## Focus Management

- Committing a new query moves focus to a stable, predictable location (for example, the results region heading) so screen-reader users are oriented to new results without losing their place.
- Changing pages moves focus to the top of the results region and scrolls it into view.
- Opening the mobile filter drawer moves focus into it; closing returns focus to the trigger.
- Focus is always visible; focus styles meet the approved contrast requirements in both themes.

## Screen Reader Behavior

- New result counts and state transitions (loading complete, no results, error) are announced concisely and without excessive interruption during typing.
- Status, verification, and other indicators that convey meaning have accessible text; they are never color-only.
- Decorative icons are hidden from assistive technology; meaningful icons have accessible names.

## Reduced Motion

- Respect `prefers-reduced-motion`. Result transitions, drawer animations, and loading motion have reduced or removed motion alternatives.
- No information or interaction requires motion to be understood or completed.

## Contrast

- Text, controls, focus indicators, status, and verification indicators meet the applicable contrast requirements in both light and dark themes.
- Status and verification meaning is carried by text or shape in addition to color.

---

# Mobile Experience

## Filter Drawer

- Filters open in a drawer/overlay from a clearly labeled **Filters** control that shows the active-filter count.
- The drawer presents the same filter groups as the desktop sidebar and provides **Apply** and **Clear all** affordances consistent with the approved design.
- The drawer manages focus (trap, Escape to dismiss, focus return) as specified in Accessibility.
- Applying filters closes the drawer, updates results and the URL, and returns the user to the results with the active-filter count reflected on the Filters control.

## Touch Targets

- All interactive targets (search field actions, filter options, sort control, layout switch, result actions, pagination) meet comfortable minimum touch-target sizing per the approved design and are spaced to prevent mis-taps.

## Spacing

- Uses the approved spacing scale to maintain rhythm and prevent crowding in the single-column layout; result cards, controls, and pagination remain comfortably separated.

## Scrolling

- The page uses natural vertical scrolling. Horizontal scrolling is prohibited except for intentional, accessible overflow regions (for example, long code or checksum values on detail pages, not on search results).
- On pagination or query commit, the results region scrolls to a consistent top position so the user is not left mid-list.

---

# Desktop Experience

## Sidebar

- The filter panel is a persistent sidebar; users refine without opening or closing an overlay.
- The sidebar header shows the active-filter count and the **Clear all filters** action.
- The sidebar does not scroll independently in a way that hides filters; long filter lists follow the approved scrolling behavior.

## Content Width

- The results content uses the approved shared container and maximum widths to maintain alignment with the rest of the site and preserve a comfortable reading measure.
- The sidebar appears only where it does not compress the results below that comfortable measure.

## Grid Behavior

- The results grid uses the approved responsive column counts, increasing columns at wider widths and reducing them as width decreases, without ever producing cramped or overly wide cards.
- Switching to list layout produces a single-column, row-based arrangement suited to comparison and readability.
- Grid and list both present the same result fields; only arrangement and density change.

---

# Future Roadmap

Future ideas are separated from the MVP. Only **v1** is in scope for the initial Search implementation.

## v1 (MVP — In Scope)

- `/search` route with `q`, `page`, `sort`, `category`, `author`, `status`, and `view` parameters and canonical URL behavior.
- Entry points: homepage, header (all routes), direct URL, empty-repository handling.
- Minimum-length, debounced instant search on `/search`, submit-based entry elsewhere, and full URL/history/refresh/direct-link behavior.
- Desktop sidebar layout and mobile drawer layout with the responsive transition.
- Result presentation with name, status, author, latest version, summary, categories, downloads, verification, and release recency.
- Filters: status, category (single), author, runtime/API.
- Sorts: relevance, alphabetical, recently updated, newest release, downloads, with the specified defaults.
- All states, full accessibility, and both themes.

## v2 (Planned — Not In Scope for MVP)

- Multi-select filters and additional filter groups (license, tags, verified-only).
- Query suggestions/autocomplete derived from existing data.
- Highlighting of matched terms within result names and summaries.
- Persisting the user's preferred layout (grid/list) as a local preference.
- Richer empty and no-results guidance (suggested categories, popular fallbacks).

## v3 (Exploratory — Not Committed)

- Saved searches and shareable filter presets.
- Faceted counts that update live as filters are combined.
- Compatibility-aware discovery that pre-fills runtime/API filters from user context.
- Advanced query syntax (field-scoped queries such as author: or category:).

Anything in v2 and v3 is explicitly out of scope for the initial implementation and must not be built without a separate approval.

---

# Success Criteria

After reading this document, an engineer can implement the complete Search experience without inventing UX decisions, because it specifies:

- Every entry point and where it leads.
- The exact URL parameters, canonical form, and normalization rules.
- Query minimum length, debounce, instant-vs-submit behavior, and history/refresh/direct-link behavior.
- The desktop and mobile layouts, the responsive transition, and every control's behavior.
- The exact result fields and their presence/fallback rules.
- The filters, their combination logic, and extensibility.
- The sorts and their defaults.
- Every state and its precedence.
- Full accessibility behavior.
- The MVP scope separated from future roadmap.
