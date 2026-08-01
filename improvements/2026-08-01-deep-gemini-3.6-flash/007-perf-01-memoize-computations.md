# Plan 007: Memoïzatie van Zware Berekeningen

> **Executor instructions**: Volg dit plan stap voor stap.
> **Drift check**: `git diff --stat 2ee664e..HEAD -- src/routes/Dashboard.tsx`

## Status
- **Priority**: P2 | **Effort**: S | **Risk**: LOW | **Depends on**: none | **Category**: perf

## Why this matters
Voorkom dat datumberekeningen en lijst-sorteringen op het Dashboard op elke render opnieuw draaien.

## Scope
- `src/routes/Dashboard.tsx`

## Steps
### Step 1: Pas `useMemo` toe
1. Omwikkel `maakActielijst` en `garantiesDieAflopen` met `useMemo`.

**Verify**: `npm run verify` -> exits 0.
