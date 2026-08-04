# Feature Architecture

**Status:** Frozen

This document is the normative specification for all features in the application. Every feature must conform to these rules.

---

## Overview

```
Generated JSON
      ↓
  Services
      ↓
Shared Feature Components (if needed)
      ↓
    Hooks
      ↓
Feature Components
      ↓
  Page
      ↓
    UI
```

---

## Architecture Layers

The application is organized into distinct layers, each with specific responsibilities:

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Pages Layer                                   │
│               (thin routing wrappers only)                            │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ renders
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Feature Layer                                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │               Shared Feature Components (_shared)              │   │
│  │                                                               │   │
│  │  plugin/ → PluginCard, PluginList, PluginGrid                │   │
│  │  version/ → (future)                                        │   │
│  │  author/ → (future)                                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │ composed by                           │
│  ┌──────────────────────────┼───────────────────────────────────┐  │
│  │                          ▼                                    │  │
│  │  Feature A          Feature B          Feature C              │  │
│  │  ├── components/    ├── components/    ├── components/     │  │
│  │  ├── hooks/         ├── hooks/         ├── hooks/          │  │
│  │  └── utils/         └── utils/         └── utils/          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │ orchestrated by                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                       Hooks Layer                              │   │
│  │         (orchestration only, no business logic)               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │ uses                                  │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Services Layer                              │   │
│  │              (all business logic lives here)                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                              │ consumed by
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Design System                                   │
│                                                                      │
│  Container  Grid  Card  Button  Badge  Avatar  Link  etc.          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

| Layer | Responsibility | Can Import |
|-------|---------------|------------|
| **Pages** | Route params, render Feature | Features |
| **Shared Components** | Reusable domain components | Design System, Services |
| **Feature Components** | Feature-specific UI | Design System, Shared Components, Types |
| **Hooks** | State orchestration only | Services |
| **Utils** | Presentation formatting only | - |
| **Services** | Business logic, data access | Generated JSON |
| **Design System** | UI primitives | - |

---

## Feature Structure

Each feature follows this structure:

```
src/features/{feature}/
│
├── components/
│   ├── {ComponentName}/
│   │   └── index.tsx
│   └── index.ts
│
├── hooks/
│   ├── use{Feature}Feature.ts
│   └── index.ts
│
├── utils/
│   └── index.ts
│
├── {Feature}Feature.tsx
│
└── index.ts
```

### Directory Responsibilities

| Directory | Purpose |
|-----------|---------|
| `components/` | Feature-specific UI (NOT shared with other features) |
| `hooks/` | React hooks for state management |
| `utils/` | Pure formatting functions |
| `{Feature}Feature.tsx` | Main composition component |
| `index.ts` | Public API barrel export |

---

## Shared Feature Components Layer

Reusable domain components live in `src/features/_shared/`.

```
src/features/_shared/
├── plugin/
│   ├── PluginCard/
│   │   └── index.tsx
│   ├── PluginList/
│   │   └── index.tsx
│   ├── PluginGrid/
│   │   └── index.tsx
│   ├── VersionItem/
│   │   └── index.tsx
│   ├── VersionList/
│   │   └── index.tsx
│   └── index.ts
│
├── index.ts
```

### When to Use Shared Components

Use shared components when:
- ✅ The same display pattern appears in multiple features
- ✅ The component represents a domain concept (Plugin, Version, Author)
- ✅ The component is data-driven, not feature-specific

### When NOT to Use Shared Components

Create feature-specific components when:
- ❌ The component is only used in one feature
- ❌ The component has feature-specific logic
- ❌ The component couples to a specific feature's state

---

## Dependency Rules

### Features MUST NOT Import

```
❌ Pages
❌ Other Features (feature-to-feature coupling)
❌ Generated JSON directly
❌ Direct fetch calls
```

### Features MAY Import

```
✅ Design System              @/components/ui/*
✅ Services                   @/services/generated/*
✅ Types                      @/services/generated/types
✅ Shared Components          @/features/_shared/*
✅ Own Components             ./components/*
✅ Own Hooks                 ./hooks/*
✅ Own Utils                 ./utils/*
```

### Import Hierarchy

```
Page → Feature → Shared Components → Design System
                  ↓
              Services → Generated JSON
```

---

## Hook Responsibilities

Feature hooks **only** orchestrate data loading. Business logic belongs in services.

### Allowed Pattern

```typescript
// hooks/use{Feature}Feature.ts ✓ CORRECT

export function use{Feature}Feature(id: string) {
  // State management only
  // Service calls only
  // Return state to components
}
```

### Forbidden Pattern

```typescript
// hooks/use{Feature}Feature.ts ✗ WRONG

export function use{Feature}Feature(id: string) {
  // ❌ Business logic calculations
  // ❌ Data transformation beyond UI needs
  // ❌ Validation
}
```

---

## Utils Responsibilities

Feature utils may only contain **presentation formatting**.

### Allowed

```typescript
// ✅ Pure formatting functions

export function formatDate(dateString: string): string { ... }
export function formatBytes(bytes: number): string { ... }
export function formatDownloads(count: number): string { ... }
```

### Forbidden

```typescript
// ❌ Business logic - goes in services

export function calculatePopularity(plugin: Plugin): number { ... }
export function validateVersion(version: string): boolean { ... }
```

---

## Page Responsibilities

Pages should only:
- Read route parameters
- Instantiate Feature components

### Required Pattern

```typescript
// pages/{Feature}Page.tsx

import { useParams } from 'react-router-dom';
import { Feature } from '@/features/{feature}';

export function {Feature}Page() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return null;
  return <Feature featureId={slug} />;
}
```

### Forbidden

```typescript
// pages/{Feature}Page.tsx ✗ WRONG

export function {Feature}Page() {
  // ❌ Fetch data directly
  // ❌ Import services
  // ❌ Create custom hooks
  // ❌ Contain business logic
}
```

---

## Shared Component API

### PluginCard

```typescript
import { PluginCard } from '@/features/_shared/plugin';

interface PluginCardProps {
  plugin: PluginListItem;
  className?: string;
}

<PluginCard plugin={plugin} />
```

### PluginList

```typescript
import { PluginList } from '@/features/_shared/plugin';

interface PluginListProps {
  plugins: PluginListItem[];
  title?: string;
  showCount?: boolean;
  emptyMessage?: string;
  className?: string;
}

<PluginList plugins={plugins} title="Plugins" showCount />
```

### PluginGrid

```typescript
import { PluginGrid } from '@/features/_shared/plugin';

interface PluginGridProps {
  plugins: PluginListItem[];
  columnsMobile?: 1 | 2;
  columnsTablet?: 2 | 3 | 4;
  columnsDesktop?: 2 | 3 | 4 | 6;
  className?: string;
}

<PluginGrid plugins={plugins} columnsDesktop={4} />
```

### VersionItem

```typescript
import { VersionItem } from '@/features/_shared/plugin';

interface VersionItemProps {
  version: VersionSummary;
  pluginId: string;
  isCurrent?: boolean;
  isLatest?: boolean;
  onSelect?: (version: string) => void;
  className?: string;
}

<VersionItem version={v} pluginId="my-plugin" />
```

### VersionList

```typescript
import { VersionList } from '@/features/_shared/plugin';

interface VersionListProps {
  plugin: Plugin;
  currentVersion?: string;
  onVersionSelect?: (version: string) => void;
  title?: string;
  showCount?: boolean;
  className?: string;
}

<VersionList plugin={plugin} currentVersion={selected} />
```

---

## Design System Boundaries

Features may only use existing Design System components.

### If a Component is Missing

1. **Do NOT** create a new primitive in the feature
2. **Document** the gap in the feature implementation report
3. **Propose** the component for Design System addition separately

### Existing Components

| Category | Components |
|----------|------------|
| Layout | Container, Grid, Stack, Inline |
| Content | Card, Section, Divider |
| Typography | Text, Heading, Code |
| Actions | Button, IconButton, Link |
| Data | Badge, Avatar, List |
| Feedback | LoadingState, ErrorState, EmptyState, Skeleton, Spinner |
| Navigation | Pagination |
| Forms | Input |

---

## Summary

| Layer | Responsibility | Imports |
|-------|---------------|---------|
| **Pages** | Route params | Features |
| **Shared Components** | Reusable domain UI | Design System, Types |
| **Feature Components** | Feature-specific UI | Design System, Shared, Types |
| **Hooks** | State orchestration | Services |
| **Utils** | Formatting | - |
| **Services** | Business logic, data access | Generated JSON |
| **Design System** | UI primitives | - |

---

**This document is frozen. All features must conform.**
