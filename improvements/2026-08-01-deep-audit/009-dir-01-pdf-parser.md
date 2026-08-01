# Plan 009: PDF Document Parser (Netlify + LLM)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step.
>
> **Drift check (run first)**: `git diff --stat 2ee664e..HEAD -- netlify.toml`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `2ee664e`, 2026-08-01

## Why this matters

The "Woningdossier" core feature requires automated data extraction from legal documents (C5). Currently, this is missing, forcing users into a highly manual flow.

## Current state

- The feature is described in `PROJECT.md` but not implemented. No PDF libraries or Netlify functions exist for this.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run typecheck`      | exit 0, no errors   |

## Scope

**In scope**:
- `src/lib/pdf.ts` (new)
- `netlify/functions/parse.mts` (new)
- `src/routes/ProjectWizard.tsx` (or where the upload occurs)

## Steps

### Step 1: Client-side PDF extraction
1. Add `pdfjs-dist` (or similar) to extract text client-side.
2. Implement a helper in `src/lib/pdf.ts` that takes a File and returns a string.

### Step 2: Netlify Function for LLM
1. Create `netlify/functions/parse.mts` that accepts the raw text, uses the Anthropic API (via Netlify Env vars), and returns structured JSON (validated by Zod).

**Verify**: `npm run typecheck` → passes completely.

## Done criteria
- [ ] Client-side PDF extraction works.
- [ ] Netlify function deployed locally and returns structured data.
- [ ] `improvements/2026-08-01-deep-audit/README.md` status row updated
