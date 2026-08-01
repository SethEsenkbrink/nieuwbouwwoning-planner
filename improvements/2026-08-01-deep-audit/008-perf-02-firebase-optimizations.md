# Plan 008: Concurrent Subcollection Reads & Offline Persistence

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/lib/projecten.ts src/lib/firebase.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

When deleting a project, all 12 subcollections are fetched sequentially, taking 12x the network roundtrip time. Additionally, Firebase offline persistence is not enabled, so data is never cached locally between reloads.

## Current state

- `src/lib/projecten.ts` iterates over subcollections with `for (const naam of SUBCOLLECTIES) { await getDocs(...) }`.
- `src/lib/firebase.ts` initializes Firestore without persistence.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |

## Scope

**In scope**:
- `src/lib/projecten.ts`
- `src/lib/firebase.ts`

## Steps

### Step 1: Enable Offline Persistence
1. In `src/lib/firebase.ts`, import `enableMultiTabIndexedDbPersistence` and call it after initializing `getFirestore`.

### Step 2: Use Promise.all for Delete
1. In `src/lib/projecten.ts`, refactor the project deletion logic to map `SUBCOLLECTIES` to an array of `getDocs` promises.
2. `await Promise.all(promises)` and chunk the results into batch deletes.

**Verify**: `npm run typecheck` → passes completely.

## Done criteria
- [ ] Subcollections fetched concurrently during deletion.
- [ ] Offline persistence enabled.
- [ ] `improvements/2026-08-01-deep-audit/README.md` status row updated
