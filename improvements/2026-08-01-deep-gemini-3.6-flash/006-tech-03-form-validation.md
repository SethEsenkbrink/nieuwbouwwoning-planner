# Plan 006: Zod Formuliervalidatie Schema's

> **Executor instructions**: Volg dit plan stap voor stap.
> **Drift check**: `git diff --stat 2ee664e..HEAD -- src/routes/Afspraken.tsx`

## Status
- **Priority**: P2 | **Effort**: M | **Risk**: LOW | **Depends on**: none | **Category**: tech-debt

## Why this matters
Vervang handmatige `if`-checks door Zod schema's om type-safety tussen formulieren en Firestore te garanderen.

## Scope
- `src/lib/schemas.ts` (nieuw)
- Formulieren in `src/routes/`

## Steps
### Step 1: Voeg Zod schema's toe
1. Maak Zod schema's in `src/lib/schemas.ts` voor `Afspraak`, `Onderdeel`, etc.
2. Gebruik `schema.safeParse()` bij de submit handlers van formulieren.

**Verify**: `npm run verify` -> exits 0.
