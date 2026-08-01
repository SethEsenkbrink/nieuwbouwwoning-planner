# Plan 001: Firestore Schema Validation

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- firebase/firestore.rules`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

Firestore rules check for `withinSizeLimit` but lack strict field name validation (`keys().hasOnly()`) on most collections. This allows arbitrary large strings to be stored in unvalidated fields, bypassing the storage constraints and inflating Firebase costs.

## Current state

- `firebase/firestore.rules` applies `.keys().hasOnly([...])` strictly for `onderhoudstaken`, but omits it for `projecten`, `ankers`, etc.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Test Rules| `npm run rules:test`     | exit 0, all pass    |

## Scope

**In scope**:
- `firebase/firestore.rules`
- `firebase/rules.test.ts`

## Steps

### Step 1: Add hasOnly to rules
1. In `firebase/firestore.rules`, identify all document writes (create, update).
2. Append `&& request.resource.data.keys().hasOnly(['field1', 'field2'])` matching the TypeScript types from `src/types/model.ts`.

### Step 2: Ensure tests cover the new rules
1. Add cases in `firebase/rules.test.ts` where writes with unexpected fields are denied.

**Verify**: `npm run rules:test` → passes completely.

## Done criteria
- [ ] `npm run rules:test` exits 0
- [ ] `improvements/2026-08-01-security-audit/README.md` status row updated
