# Plan 003: Dynamic import of Firestore

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
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

The `firebase-*.js` chunk is 567 kB, which exceeds the Vite warning threshold. By dynamically importing Firestore only when it's needed (which is usually after a user is authenticated or about to fetch project data), we reduce the initial load time for the landing/login pages.

## Current state

- `src/lib/projecten.ts` statically imports `getDocs`, `getDoc`, etc. from `firebase/firestore`.
- `STATE.md` mentions this as a known issue: "`firebase-*.js` is 567 kB... Op te lossen met een dynamische import van Firestore"

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0, reduced chunk size |
| Verify    | `npm run verify`         | exit 0              |

## Scope

**In scope**:
- `src/lib/firebase.ts`
- `src/lib/projecten.ts`

**Out of scope**:
- Firebase Auth initialization (auth must load early).

## Steps

### Step 1: Create a dynamic getter for Firestore
In `src/lib/firebase.ts`, export an async function `getDb()` that dynamically imports `getFirestore` from `firebase/firestore` and initializes it. 

### Step 2: Refactor `lib/projecten.ts`
Update all functions in `lib/projecten.ts` to `await getDb()` instead of using a static `db` instance.

**Verify**: `npm run build` → The chunk size for firebase should drop significantly.

## Test plan

- Run `npm run verify` to ensure the asynchronous initialization doesn't break any existing tests.

## Done criteria

- [ ] `npm run verify` exits 0
- [ ] Initial bundle size is reduced.
- [ ] `improvements-2026-08-01/README.md` status row updated

## STOP conditions

- If dynamically importing Firestore breaks the Firestore Emulator tests in `npm run rules:test`.
