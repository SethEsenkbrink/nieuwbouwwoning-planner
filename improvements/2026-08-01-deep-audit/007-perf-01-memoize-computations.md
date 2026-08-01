# Plan 007: Memoize Heavy Computations

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/routes/Dashboard.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

The dashboard calculates expiring warranties and task schedules on every render. Toggling a UI element like a loader spinner causes these arrays to be completely re-processed, which will eventually block the main thread as data scales.

## Current state

- `src/routes/Dashboard.tsx:192` — `maakActielijst` runs without memoization.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |

## Scope

**In scope**:
- `src/routes/Dashboard.tsx`

## Steps

### Step 1: Wrap in useMemo
1. Wrap the list derivation logic (`maakActielijst`, `garantiesDieAflopen`) in `useMemo` hooks.
2. Ensure the dependency array correctly includes the raw Firestore collections.

**Verify**: `npm run typecheck` → passes completely.

## Done criteria
- [ ] Dashboard lists are memoized.
- [ ] `improvements/2026-08-01-deep-audit/README.md` status row updated
