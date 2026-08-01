# Plan 009: Contract Documentparser (PDF + LLM)

> **Executor instructions**: Volg dit plan stap voor stap.
> **Drift check**: `git diff --stat 2ee664e..HEAD -- netlify.toml`

## Status
- **Priority**: P3 | **Effort**: L | **Risk**: MED | **Depends on**: none | **Category**: direction

## Why this matters
Realiseer de "parsen zonder opslaan" AI-feature (C5 uit PROJECT.md) om contracten automatisch in te lezen via een Netlify Function.

## Scope
- `src/lib/pdf.ts` (nieuw)
- `netlify/functions/parse-contract.mts` (nieuw)

## Steps
### Step 1: Text extraction & Netlify Function
1. Gebruik `pdf.js` om tekst client-side uit een PDF te trekken.
2. Stuur de tekst naar `netlify/functions/parse-contract.mts` voor LLM verwerking naar gestructureerde JSON.

**Verify**: `npm run verify` -> exits 0.
