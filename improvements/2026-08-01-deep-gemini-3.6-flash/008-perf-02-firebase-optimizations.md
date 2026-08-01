# Plan 008: Concurrent Subcollection Reads & Offline Cache

> **Executor instructions**: Volg dit plan stap voor stap.
> **Drift check**: `git diff --stat 2ee664e..HEAD -- src/lib/projecten.ts src/lib/firebase.ts`

## Status
- **Priority**: P2 | **Effort**: S | **Risk**: LOW | **Depends on**: none | **Category**: perf

## Why this matters
Haal subcollecties gelijktijdig op (`Promise.all`) bij projectverwijdering en schakel Firestore offline persistence in.

## Scope
- `src/lib/projecten.ts`
- `src/lib/firebase.ts`

## Steps
### Step 1: Schakel offline persistence in
1. Aanroepen van `enableMultiTabIndexedDbPersistence` in `src/lib/firebase.ts`.
2. Vervang de sequentiële `for`-loop in `verwijderProject` door `Promise.all`.

**Verify**: `npm run verify` -> exits 0.
