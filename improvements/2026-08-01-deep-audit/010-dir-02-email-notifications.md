# Plan 010: Maintenance Email Notifications

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- netlify.toml`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

Users currently only see maintenance reminders when they actively log in. For long-term home maintenance, proactive push notifications via email are essential to prevent missed tasks.

## Current state

- The Dashboard shows tasks, but no backend job emails the user.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |

## Scope

**In scope**:
- `netlify/functions/cron-reminders.mts` (new)
- `netlify.toml` (cron scheduling)

## Steps

### Step 1: Create Cron Function
1. Implement a Netlify Scheduled Function (`cron-reminders.mts`).
2. The function should query Firestore for all overdue or expiring tasks across all projects.

### Step 2: Integrate Email Provider
1. Use an external provider (like Resend or Postmark) triggered from the Netlify function.
2. Configure the schedule in `netlify.toml`.

**Verify**: `npm run typecheck` → passes completely.

## Done criteria
- [ ] Scheduled function created.
- [ ] `improvements/2026-08-01-deep-audit/README.md` status row updated
