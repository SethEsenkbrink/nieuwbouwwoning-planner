# Plan 004: Centralized Data Caching

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/routes/Dashboard.tsx src/lib/projecten.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

Navigating between routes currently forces the app to re-fetch the entire project and all 12 subcollections from the server because data loading is tied to `useEffect` on each route component. Centralizing this state (via a context/hook or React Query) avoids redundant latency and reads.

## Current state

- Each route (e.g. `src/routes/Dashboard.tsx`) has its own `useEffect` managing `fout`, `bezigMetLaden`, and calling `Promise.all([haalAnkers(...), ...])`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |

## Scope

**In scope**:
- `src/hooks/useProjectData.ts` (new)
- All `src/routes/*.tsx` files that fetch project data.

## Steps

### Step 1: Create centralized hook
1. Create `src/hooks/useProjectData.ts` that provides the project context and subcollections using a caching library (if added) or a global context.
2. Alternatively, implement Firebase `onSnapshot` listeners in a context provider.

### Step 2: Refactor routes
1. Replace the `useEffect` boilerplate in all routes with `const { project, ankers, loading, error } = useProjectData()`.

**Verify**: `npm run typecheck` → passes completely.

## Done criteria
- [ ] Boilerplate removed from all route files.
- [ ] `improvements/2026-08-01-deep-audit/README.md` status row updated
