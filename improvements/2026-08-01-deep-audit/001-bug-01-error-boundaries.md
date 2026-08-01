# Plan 001: Global Error Boundaries

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/App.tsx`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

The React application currently lacks a global Error Boundary. Any unhandled render error in a deep component will crash the entire component tree, resulting in an unrecoverable "White Screen of Death" for the user. A global boundary catches these, logs them, and displays a user-friendly recovery UI.

## Current state

- `src/App.tsx` renders the React Router `<Routes>` directly without an Error Boundary wrapper.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Verify    | `npm run verify`         | exit 0              |

## Scope

**In scope**:
- `src/components/ErrorBoundary.tsx` (new)
- `src/App.tsx`

## Steps

### Step 1: Create the Error Boundary
1. Create `src/components/ErrorBoundary.tsx` implementing a class-based React component with `getDerivedStateFromError` and `componentDidCatch`.
2. Provide a fallback UI that matches the Brink styling (e.g. `bg-clay`, `text-ink`) with a "Reload page" button.

### Step 2: Wrap the application
1. In `src/App.tsx`, wrap the `<Routes>` block in the new `<ErrorBoundary>`.

**Verify**: `npm run verify` → passes completely.

## Done criteria
- [ ] `npm run typecheck` exits 0
- [ ] `improvements/2026-08-01-deep-audit/README.md` status row updated
