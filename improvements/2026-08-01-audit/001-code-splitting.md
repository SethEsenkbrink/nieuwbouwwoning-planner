# Plan 001: Route-based code splitting

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/App.tsx`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

The `App.tsx` statically imports all routes, creating a single massive 290kB JS bundle. By switching to `React.lazy()` for route components, users who are early in the building process won't have to download the code for the maintenance phases (which includes large dictionaries of maintenance tasks and parts). This drastically improves load times and was identified as high priority tech debt in `STATE.md`.

## Current state

- `src/App.tsx` — Main router, lines 6-23 contain static imports for all screens.

```tsx
// src/App.tsx:6-10
import Inloggen from "@/routes/Inloggen";
import Registreren from "@/routes/Registreren";
import WachtwoordVergeten from "@/routes/WachtwoordVergeten";
import Dashboard from "@/routes/Dashboard";
import ProjectWizard from "@/routes/ProjectWizard";
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Lint      | `npm run lint`           | exit 0              |
| Verify    | `npm run verify`         | exit 0              |

## Scope

**In scope**:
- `src/App.tsx`

**Out of scope**:
- Modifying any of the individual route files.
- Changing the `react-router` configuration.

## Steps

### Step 1: Implement React.lazy and Suspense

In `src/App.tsx`:
1. Import `lazy` and `Suspense` from `"react"`.
2. Replace all static imports for `src/routes/*` with `lazy(() => import("@/routes/..."))`. Leave `Laadscherm`, `ProtectedRoute`, `useAuth`, etc. as static imports.
3. Wrap the `<Routes>` block with `<Suspense fallback={<Laadscherm />}>`.

**Verify**: `npm run verify` → passes completely.

## Test plan

- No new automated tests are required.
- Verification: `npm run verify` → all pass.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run verify` exits 0
- [ ] `improvements-2026-08-01/README.md` status row updated

## STOP conditions

- If `npm run verify` fails and cannot be easily fixed.
- If the build size actually increases (check vite output).

## Maintenance notes

Future routes should also be added using `React.lazy()` to prevent the main bundle from growing again.
