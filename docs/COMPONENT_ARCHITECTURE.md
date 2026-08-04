# Component Architecture

This document defines the normative architecture for frontend components in the Axolotl Plugin Registry.

---

## Component Hierarchy

```
@/components/
├── ui/              # Design System primitives (REUSABLE)
│   ├── Button/
│   ├── Card/
│   ├── Badge/
│   └── ...
│
├── layout/           # Layout components
│   ├── Header/
│   └── Footer/
│
├── theme/            # Design tokens (TypeScript constants)
│   ├── colors.ts
│   ├── spacing.ts
│   └── ...
│
├── plugin/           # Feature: Plugin components
├── version/          # Feature: Version components
├── search/           # Feature: Search components
└── author/           # Feature: Author components
```

### Ownership Layers

| Layer | Owner | Reusable | Examples |
|-------|-------|----------|----------|
| **Design System** | Architecture | Anywhere | `Button`, `Card`, `Badge` |
| **Layout** | Architecture | Across pages | `Header`, `Footer` |
| **Theme** | Architecture | Everywhere | Colors, spacing, typography |
| **Feature** | Feature team | Within feature | `PluginCard`, `VersionList` |

---

## Import Rules

### 1. Design System Imports

Design system components are imported from `@/components/ui`:

```typescript
import { Button, Card, Badge } from '@/components/ui';
```

### 2. Feature Component Imports

Feature components are imported from their feature path:

```typescript
import { PluginCard } from '@/components/plugin';
import { SearchBar } from '@/components/search';
```

### 3. Service Imports

Services are imported from `@/services/generated`:

```typescript
import { getPlugin } from '@/services/generated';
```

### 4. Hook Imports

Hooks are imported from `@/hooks`:

```typescript
import { usePlugin } from '@/hooks';
```

---

## Folder Conventions

### Design System (`@/components/ui/`)

Each component lives in its own directory:

```
ui/
├── Button/
│   └── index.tsx       # Component implementation
├── Card/
│   └── index.tsx       # Card + CardHeader + CardTitle + etc.
└── index.ts            # Barrel export
```

### Feature Components (`@/components/{feature}/`)

Feature components follow the same pattern:

```
plugin/
├── PluginCard/
│   └── index.tsx
├── PluginList/
│   └── index.tsx
├── PluginMetadata/
│   └── index.tsx
└── index.ts            # Barrel export
```

---

## Naming Conventions

### Components

- **PascalCase**: `Button`, `CardHeader`, `PluginCard`
- **Descriptive**: `EmptyState`, `LoadingState`, `ErrorState`

### Props

- **camelCase**: `variant`, `size`, `isLoading`
- **Boolean prefixes**: `isLoading`, `hasError`, `isDisabled`

### Variants and Sizes

Use union types for variants:

```typescript
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';
```

### Sub-components

Sub-components share the parent's name:

```typescript
export function Card() {}
export function CardHeader() {}
export function CardTitle() {}
export function CardContent() {}
export function CardFooter() {}
```

---

## Composition Rules

### 1. Primitives Compose Features

Feature components compose design system primitives:

```typescript
// GOOD: Feature composes primitives
function PluginCard({ plugin }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{plugin.name}</CardTitle>
        <StatusBadge status={plugin.status} />
      </CardHeader>
    </Card>
  );
}

// BAD: Feature contains primitive implementation
function PluginCard({ plugin }) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <h3 className="text-lg font-semibold">{plugin.name}</h3>
    </div>
  );
}
```

### 2. Pages Compose Features

Pages compose feature components:

```typescript
// GOOD: Page composes features
function PluginPage() {
  return (
    <Container>
      <PluginHeader plugin={plugin} />
      <PluginVersions versions={versions} />
    </Container>
  );
}

// BAD: Page composes primitives directly
function PluginPage() {
  return (
    <Container>
      <Card>
        <CardHeader>
          <Heading level="h1">{plugin.name}</Heading>
        </CardHeader>
      </Card>
    </Container>
  );
}
```

### 3. Feature Components May Consume Hooks

Feature components can use hooks for data fetching:

```typescript
function PluginVersions({ pluginId }) {
  const { data, loading } = useVersions(pluginId);

  if (loading) return <LoadingState />;

  return (
    <Stack>
      {data?.map(v => <VersionItem key={v.version} version={v} />)}
    </Stack>
  );
}
```

### 4. Design System NEVER Consumes Feature Logic

Design system components must not:

- Import from feature directories
- Import from hooks
- Import from services
- Know about domain models

```typescript
// GOOD: Design system is generic
function Badge({ variant, children }) {
  return <span className={variantClasses[variant]}>{children}</span>;
}

// BAD: Design system knows about features
function Badge({ status }) {
  return <span className={statusColors[status]}>{status}</span>;
}
```

---

## Forbidden Dependencies

### Design System May NOT Import

| Forbidden | Reason |
|-----------|--------|
| `@/components/plugin` | Feature knowledge |
| `@/components/search` | Feature knowledge |
| `@/components/version` | Feature knowledge |
| `@/components/author` | Feature knowledge |
| `@/hooks` | React hook coupling |
| `@/services` | Data fetching logic |
| `@/types` | Domain types |

### Feature Components May NOT Import

| Forbidden | Reason |
|-----------|--------|
| Other feature directories | Cross-feature coupling |
| `react-router-dom` | Routing belongs in pages/routes |

### Pages May Import

| Allowed | Reason |
|---------|--------|
| `@/components/ui` | Design system |
| `@/components/{feature}` | Feature components |
| `@/layouts` | Layouts |
| `@/hooks` | State management |
| `@/services` | Data fetching |
| `react-router-dom` | Routing |

---

## File Structure

### Each Component in Own Directory

```
// PREFERRED
components/ui/Button/index.tsx

// NOT
components/ui/Button.tsx
```

### Index.ts for Barrel Export

```typescript
// components/ui/Button/index.tsx
export function Button() { ... }

// components/ui/index.ts
export { Button } from './Button';
```

---

## API Design

### Prefer Composability Over Configuration

```typescript
// PREFERRED: Composable
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// AVOID: Over-configured
<Card
  header="Title"
  content="Content"
  showFooter
/>
```

### Simple Prop Types

```typescript
// PREFERRED: Simple props
function Button({ variant = 'primary', children }) {
  return <button className={variants[variant]}>{children}</button>;
}

// AVOID: Complex prop drilling
function Button({ colors, fonts, sizes, shadows, className, style }) {
  return <button className={`${colors.primary} ${fonts.sans}`}>{children}</button>;
}
```

### Consistent Return Types

Hooks should return consistent shapes:

```typescript
// Consistent hook return
function usePlugin(id: string) {
  return {
    data: Plugin | null,
    loading: boolean,
    error: Error | null,
    notFound: boolean,
  };
}
```

---

## Migration Guide

### Moving Code to Design System

If code is used in multiple features, it may belong in the design system.

1. Identify the generic pattern
2. Create a new component in `@/components/ui/`
3. Ensure it accepts props, not domain models
4. Update feature components to use it

### Moving Code to Feature Directory

If page-specific code is getting complex:

1. Create a new component in `@/components/{feature}/`
2. Keep it focused on one concern
3. Import design system primitives
4. Import hooks for data fetching

---

## Verification

Before committing, verify:

- [ ] Design system components don't import features
- [ ] Components are in their own directories
- [ ] Props use consistent naming
- [ ] No `any` types exposed
- [ ] Barrel exports are organized
- [ ] Composition over configuration

---

## Architecture Violations

Report violations to the architecture team. Common violations:

1. **Primitive + Feature coupling**: Using `plugin.status` in design system
2. **Cross-feature imports**: Importing from `plugin/` in `search/`
3. **Page + Primitive coupling**: Pages importing from `@/components/ui` directly
4. **Hook in design system**: Using `useState` or data fetching in UI components
