# Plan 003: Netlify Build Verification

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- netlify.toml`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

The Netlify build currently executes `npm run build` directly. If a developer pushes code that compiles in Vite but fails TypeScript or Lint checks (which `npm run verify` catches), it will still deploy to production, degrading codebase health.

## Current state

- `netlify.toml:7` reads: `command = "npm run build"`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Verify    | `npm run verify`         | exit 0              |

## Scope

**In scope**:
- `netlify.toml`

## Steps

### Step 1: Update Netlify command
1. In `netlify.toml`, change `[build] command = "npm run build"` to `command = "npm run verify"`.

**Verify**: `npm run verify` locally passes. The real verification is on the next Netlify deploy.

## Done criteria
- [ ] `netlify.toml` updated
- [ ] `improvements/2026-08-01-deep-audit/README.md` status row updated
