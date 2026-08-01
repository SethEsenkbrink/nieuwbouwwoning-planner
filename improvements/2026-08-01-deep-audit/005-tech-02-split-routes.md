# Plan 005: Split God-object Routes

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/routes/Onderdelen.tsx`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

Route files are extremely long (e.g., `Onderdelen.tsx` is almost 900 lines) because they mix layout, list rendering, form state, and complex domain logic. A change in form state re-renders the entire list and triggers date math recalculations.

## Current state

- `src/routes/Onderdelen.tsx` and others contain everything in one file.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Verify    | `npm run verify`         | exit 0              |

## Scope

**In scope**:
- `src/features/onderdelen/*` (new)
- `src/routes/Onderdelen.tsx` (to be reduced)

## Steps

### Step 1: Extract feature components
1. Create `src/features/onderdelen/OnderdelenList.tsx`.
2. Create `src/features/onderdelen/OnderdeelForm.tsx`.
3. Move domain logic (e.g. `berekenGarantieklok`) to `src/lib/onderdelen.ts` if not already there.

### Step 2: Assemble in Route
1. Update `src/routes/Onderdelen.tsx` to just handle layout and composition of the extracted components.

**Verify**: `npm run verify` → passes completely.

## Done criteria
- [ ] `Onderdelen.tsx` is under 200 lines.
- [ ] `improvements/2026-08-01-deep-audit/README.md` status row updated
