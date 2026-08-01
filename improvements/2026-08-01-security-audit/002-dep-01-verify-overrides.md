# Plan 002: Verify necessity of package dependency overrides

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- package.json`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

`package.json` contains explicit overrides for `brace-expansion` and `sharp`. Overrides are usually added to patch specific audit vulnerabilities. If the root dependencies have been updated since then, the overrides might be stale or downgrade current packages, causing unexpected behavior or blocking future security patches.

## Current state

- `package.json:27` contains an `overrides` block.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Audit     | `npm audit`              | 0 vulnerabilities   |

## Scope

**In scope**:
- `package.json`
- `package-lock.json`

## Steps

### Step 1: Remove overrides and check audit
1. Remove the `"overrides"` block from `package.json`.
2. Run `npm install` to regenerate `package-lock.json`.
3. Run `npm audit`.

### Step 2: Revert or keep changes
- If `npm audit` returns 0 vulnerabilities, keep the changes (leave overrides removed).
- If `npm audit` returns vulnerabilities, put the overrides back and document exactly which dependency causes it in a comment in `package.json`.

**Verify**: `npm audit` → 0 vulnerabilities.

## Done criteria
- [ ] `npm audit` exits 0
- [ ] `improvements/2026-08-01-security-audit/README.md` status row updated
