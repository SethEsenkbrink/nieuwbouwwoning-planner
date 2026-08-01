# Plan 005: E7 — Meterstanden

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/types/model.ts src/lib/converters.ts src/lib/projecten.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 004
- **Category**: direction
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

As part of the Woningdossier, homeowners need a way to track their utility usage (Meterstanden). This is a manual entry system that will show a usage trend. It provides ongoing value to the user after they have moved in.

## Current state

- `STATE.md` states: "E7 meterstanden — handmatige opnames met een verbruikstrend. Bewust simpel; geen koppeling met slimme meters."
- No models or routes currently exist for meterstanden.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Verify    | `npm run verify`         | exit 0              |

## Scope

**In scope**:
- `src/types/model.ts` (Data model for Meterstand)
- `src/lib/converters.ts` (Firestore converters)
- `src/lib/projecten.ts` (DB access layer)
- `src/routes/Meterstanden.tsx` (New route)
- `firebase/firestore.rules` (Security rules)

**Out of scope**:
- Smart meter integrations or API calls to external services.

## Steps

### Step 1: Update Data Model and Converters
1. Add `MeterstandData` to `src/types/model.ts` (date, electricity, gas, water, note).
2. Create `meterstandNaarFirestore` and `meterstandUitFirestore` in `src/lib/converters.ts`.
3. Add `haalMeterstanden`, `zetMeterstand`, `verwijderMeterstand` to `src/lib/projecten.ts`.

### Step 2: Add Route and Component
1. Create `src/routes/Meterstanden.tsx` to list and add meter readings.
2. Implement a simple chart or trend indicator comparing the current reading to the previous one.
3. Add the route to `src/App.tsx`.

### Step 3: Update Firestore Rules
1. Add rules for `meterstanden` collection under `projects` in `firebase/firestore.rules`.
2. Add a `keys().hasOnly(...)` if necessary, or just standard `size()` limits.

**Verify**: `npm run verify` and `npm run rules:test` → passes completely.

## Test plan

- Write a rule test in `firebase/rules.test.ts` for meterstanden.
- Verification: `npm run rules:test` → all pass.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run rules:test` exits 0
- [ ] `npm run verify` exits 0
- [ ] `improvements-2026-08-01/README.md` status row updated

## STOP conditions

- If implementing the trend chart requires an overly complex charting library.
