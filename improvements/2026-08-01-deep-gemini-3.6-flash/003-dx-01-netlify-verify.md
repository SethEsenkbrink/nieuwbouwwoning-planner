# Plan 003: Netlify Build Verification

> **Executor instructions**: Volg dit plan stap voor stap.
> **Drift check**: `git diff --stat 2ee664e..HEAD -- netlify.toml`

## Status
- **Priority**: P1 | **Effort**: S | **Risk**: LOW | **Depends on**: none | **Category**: dx

## Why this matters
Borg dat TypeScript en Lint checks altijd slagen op Netlify voordat een build live gaat.

## Scope
- `netlify.toml`

## Steps
### Step 1: Pas build commando aan
1. Verander in `netlify.toml` het commando `npm run build` naar `npm run verify`.

**Verify**: `npm run verify` -> exits 0.
