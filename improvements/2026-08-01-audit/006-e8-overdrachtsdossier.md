# Plan 006: E8 — Overdrachtsdossier (PDF)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/routes/Onderdelen.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 005
- **Category**: direction
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

When selling the house, the user needs to hand over a dossier containing information on parts and maintenance. This PDF is generated client-side and includes everything flagged with `blijftBijWoning` (ADR-0013), alongside the maintenance logbook.

## Current state

- `STATE.md` states: "E8 overdrachtsdossier — client-side PDF. blijftBijWoning bepaalt wat erin komt (ADR-0013 §2), en het onderhoudslogboek is het waardevolste deel."

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Verify    | `npm run verify`         | exit 0              |

## Scope

**In scope**:
- `src/components/OverdrachtsdossierExport.tsx` (New component)
- `src/routes/Projectinstellingen.tsx` or wherever the export button belongs.

**Out of scope**:
- Server-side PDF generation (violation of constraints).

## Steps

### Step 1: Implement PDF generation
1. Add a client-side PDF library (like `jspdf` or rely on the browser's native window.print with custom print stylesheets). Given the constraints, a print-stylesheet approach (`@media print`) on a dedicated hidden or popup route is the most robust and zero-dependency way.
2. Create a component `Overdrachtsdossier.tsx` that aggregates:
   - Parts where `blijftBijWoning` is true.
   - The maintenance logbook entries for those parts.
   - The `Woningpaspoort`.

### Step 2: Add Export button
1. Add a "Genereer Overdrachtsdossier" button to `Woning.tsx` or `Projectinstellingen.tsx`.
2. This button triggers the print dialogue for the dossier layout.

**Verify**: `npm run verify` → passes completely.

## Test plan

- Visual inspection of the print layout.
- Verification: `npm run verify` → all pass.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run verify` exits 0
- [ ] `improvements-2026-08-01/README.md` status row updated

## STOP conditions

- If `@media print` is insufficient and requires a heavy third-party library that violates the project's dependency constraints.
