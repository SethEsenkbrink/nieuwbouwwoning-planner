# Plan 002: Firestore Veld-validatie

> **Executor instructions**: Volg dit plan stap voor stap.
> **Drift check**: `git diff --stat 2ee664e..HEAD -- firebase/firestore.rules`

## Status
- **Priority**: P1 | **Effort**: M | **Risk**: MED | **Depends on**: none | **Category**: security

## Why this matters
Voorkom dat kwaadwillende clients onbekende velden met grote hoeveelheden data opslaan in Firestore.

## Scope
- `firebase/firestore.rules`
- `firebase/rules.test.ts`

## Steps
### Step 1: Voeg `keys().hasOnly()` toe
1. Voeg op alle `create` en `update` match regels `request.resource.data.keys().hasOnly([...])` toe.

**Verify**: `npm run rules:test` -> exits 0.
