# Plan 010: E-mailherinneringen voor Onderhoud

> **Executor instructions**: Volg dit plan stap voor stap.
> **Drift check**: `git diff --stat 2ee664e..HEAD -- netlify.toml`

## Status
- **Priority**: P3 | **Effort**: M | **Risk**: MED | **Depends on**: none | **Category**: direction

## Why this matters
Stuur automatische e-mailherinneringen via een Netlify Scheduled Function (cron) voor verstreken of naderende onderhoudstaken.

## Scope
- `netlify/functions/send-maintenance-reminders.mts` (nieuw)
- `netlify.toml`

## Steps
### Step 1: Maak Scheduled Function
1. Bouw een cron functie die dagelijks Firestore doorzoekt op taken en e-mails verstuurt via een gratis e-mail API.

**Verify**: `npm run verify` -> exits 0.
