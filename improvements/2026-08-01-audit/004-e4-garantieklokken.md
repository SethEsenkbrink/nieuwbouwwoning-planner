# Plan 004: E4 — Garantieklokken op het dashboard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/routes/Dashboard.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

The core logic for expiring warranties is already present (`garantiesDieAflopen()` in `lib/onderdelen.ts`), and it shows on the dashboard. However, it lacks a direct connection to taking action. Expiring warranties need to be presented as actionable items on the dashboard (e.g. "Have the heat pump inspected before the warranty expires in 2 weeks") to deliver the core value of the Woningdossier maintenance features.

## Current state

- `STATE.md` states: "E4 — garantieklokken per onderdeel op het dashboard. De basis staat er al (garantiesDieAflopen() in lib/onderdelen.ts, met de lijst op het dashboard); wat ontbreekt is de koppeling met het onderhoud..."

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Verify    | `npm run verify`         | exit 0              |

## Scope

**In scope**:
- `src/routes/Dashboard.tsx`
- `src/components/DashboardActielijst.tsx` (if it exists, or create a similar component)

**Out of scope**:
- Modifying the warranty expiry logic in `lib/onderdelen.ts`.

## Steps

### Step 1: Display actionable warranty tasks on Dashboard
1. On the `Dashboard.tsx`, retrieve the expiring warranties.
2. For each expiring warranty, render a clear action item indicating what part needs checking and how much time is left.
3. Add a button "Onderhoud plannen" or "Afvinken" that redirects to `/onderhoud` or opens a modal to log the check.

**Verify**: `npm run typecheck` → passes completely.

## Test plan

- Test the Dashboard rendering with mock parts that have expiring warranties.
- Verification: `npm run verify` → all pass.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run verify` exits 0
- [ ] `improvements-2026-08-01/README.md` status row updated

## STOP conditions

- If the component structure of Dashboard makes it too complex to insert these action items without a major refactor.
