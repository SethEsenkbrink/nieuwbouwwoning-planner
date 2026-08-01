# Plan 002: Anker type as Document ID

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- src/lib/projecten.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

Currently, `haalAnkers()` in `lib/projecten.ts` deduplicates anchors by type in memory. If two tabs create the same anchor concurrently, two documents are written. By enforcing the document ID to be equal to the anchor type, Firestore will naturally overwrite the existing document instead of creating a duplicate, providing a structural guarantee.

## Current state

- `src/lib/projecten.ts` — Contains `haalAnkers` and `zetAnker`. `zetAnker` currently searches for an existing anchor type to find its ID.
- The `STATE.md` mentions: "Een harde garantie zou het document-id gelijkstellen aan het ankertype; dat is een migratie waard zodra er productiedata is."

```ts
// src/lib/projecten.ts:282-290
  for (const d of resultaat.docs) {
    const anker = ankerUitFirestore(d.id, d.data());
    if (gezien.has(anker.type)) continue;
    gezien.add(anker.type);
    ankers.push(anker);
  }
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Verify    | `npm run verify`         | exit 0              |

## Scope

**In scope**:
- `src/lib/projecten.ts`
- Migrations script (to be run manually) or just updating the write logic since there's no production data yet.

**Out of scope**:
- Any other Firestore models.

## Steps

### Step 1: Update `zetAnker` logic

Modify `zetAnker` in `src/lib/projecten.ts`:
1. Use `anker.type` directly as the document ID when saving.
2. Remove `vindAnkerIdVanType` completely, as the ID is now deterministic.

### Step 2: Remove deduplication from `haalAnkers`

Modify `haalAnkers` in `src/lib/projecten.ts` to directly map documents without the `Set` deduplication logic, since duplicates can no longer exist.

**Verify**: `npm run verify` → passes completely.

## Test plan

- Existing tests for anchors in `projecten.ts` should be updated if they mock random IDs for anchors.
- Verification: `npm run test` → all pass.

## Done criteria

- [ ] `npm run verify` exits 0
- [ ] No more in-memory deduplication in `haalAnkers`.
- [ ] `improvements-2026-08-01/README.md` status row updated

## STOP conditions

- If tests in `vitest` fail extensively due to the changed ID logic.
