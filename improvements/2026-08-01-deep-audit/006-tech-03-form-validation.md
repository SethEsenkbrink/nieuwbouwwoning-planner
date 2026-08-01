# Plan 006: Standardized Form Validation

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/routes/Afspraken.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

Form validation is done manually with `if` statements across the app, leading to duplicated and inconsistent logic that can easily diverge from the Firestore constraints.

## Current state

- `src/routes/Afspraken.tsx` uses a manual `controleer()` function.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |

## Scope

**In scope**:
- Form implementations in `src/routes/*.tsx`
- `src/lib/schemas.ts` (new)

## Steps

### Step 1: Define Schemas
1. Add `zod` to the project if not present.
2. Define Zod schemas in `src/lib/schemas.ts` for entities like `Afspraak`, `Onderdeel`, mirroring `src/types/model.ts`.

### Step 2: Implement Schemas in Forms
1. Replace manual `controleer()` checks with `schema.safeParse(data)` logic in the form submit handlers.

**Verify**: `npm run typecheck` → passes completely.

## Done criteria
- [ ] Manual validation removed in favor of schema parsing.
- [ ] `improvements/2026-08-01-deep-audit/README.md` status row updated
