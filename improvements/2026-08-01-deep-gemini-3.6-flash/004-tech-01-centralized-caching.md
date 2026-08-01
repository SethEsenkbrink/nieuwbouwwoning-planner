# Plan 004: Gecentraliseerde Data Caching Hook

> **Executor instructions**: Volg dit plan stap voor stap.
> **Drift check**: `git diff --stat 2ee664e..HEAD -- src/routes/Dashboard.tsx`

## Status
- **Priority**: P2 | **Effort**: M | **Risk**: LOW | **Depends on**: none | **Category**: tech-debt

## Why this matters
Voorkom dat het wisselen van tabbladen steeds opnieuw 12 subcollecties van de server ophaalt.

## Scope
- `src/hooks/useProjectData.ts` (nieuw)
- Route bestanden in `src/routes/`

## Steps
### Step 1: Maak data-hook
1. Bouw `useProjectData.ts` die projectdata gecentraliseerd ophaalt en in de state/context vasthoudt.

**Verify**: `npm run verify` -> exits 0.
