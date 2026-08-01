# Plan 001: Globale Error Boundaries

> **Executor instructions**: Volg dit plan stap voor stap. Voer elke verificatie uit.
> **Drift check**: `git diff --stat 2ee664e..HEAD -- src/App.tsx`

## Status
- **Priority**: P1 | **Effort**: S | **Risk**: LOW | **Depends on**: none | **Category**: bug

## Why this matters
Zonder Error Boundary crasht de gehele applicatie naar een wit scherm bij een onverziene fout. Een Error Boundary vangt de fout op en toont een herstelknop in Huisstijl-stijl.

## Scope
- `src/components/ErrorBoundary.tsx` (nieuw)
- `src/App.tsx`

## Steps
### Step 1: Maak ErrorBoundary component
1. Maak `src/components/ErrorBoundary.tsx` met `getDerivedStateFromError`.
2. Gebruik Huisstijl classes (`bg-clay`, `text-ink`, `rounded-card`).

### Step 2: Omwikkel de Router
1. In `src/App.tsx`, omwikkel de `<Routes>` met `<ErrorBoundary>`.

**Verify**: `npm run verify` -> exits 0.
