# Plan 005: Opsplitsen van God-object Routes

> **Executor instructions**: Volg dit plan stap voor stap.
> **Drift check**: `git diff --stat 2ee664e..HEAD -- src/routes/Onderdelen.tsx`

## Status
- **Priority**: P2 | **Effort**: L | **Risk**: LOW | **Depends on**: none | **Category**: tech-debt

## Why this matters
Grote bestanden (zoals `Onderdelen.tsx` van ~900 regels) combineren formulier-state, lijsten en layouts. Splits dit op in herbruikbare feature-componenten.

## Scope
- `src/features/onderdelen/*` (nieuw)
- `src/routes/Onderdelen.tsx`

## Steps
### Step 1: Splits componenten uit
1. Maak `OnderdelenList.tsx` en `OnderdeelForm.tsx`.
2. Reduceer `Onderdelen.tsx` tot de hoofdlayout.

**Verify**: `npm run verify` -> exits 0.
