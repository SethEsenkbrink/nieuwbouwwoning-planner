# ADR-0027 — Diagnostiek, Systeemaudit en Ontwikkelaarsrapportage

- **Status:** Geaccepteerd
- **Datum:** 2026-08-15
- **Beslissers:** Seth (producteigenaar), Assistent
- **Raakt:** `src/lib/diagnostiek/`, `src/routes/Diagnostiek.tsx`, `docs/STATE.md`

---

## Context

Bij een 100% lokaal, zero-network en versleuteld systeem is er geen externe telemetry-server of cloud-monitoring om fouten te detecteren. Om bugs in de datastructuur, verweesde database-referenties, cryptografische fouten of regressies in de deterministische regelmotor snel op te sporen en structureel op te lossen, is een krachtige interne diagnostiek-tool noodzakelijk.

---

## Besluit

### 1. In-Memory Diagnostische Logger (`src/lib/diagnostiek/logger.ts`)
- Houdt een rollende buffer bij van interne gebeurtenissen, fouten en waarschuwingen (maximaal 200 items).
- Vangt ongehandelde runtime-fouten en promise rejections lokaal op.

### 2. Diepgaande Systeemaudit Engine (`src/lib/diagnostiek/audit.ts`)
- **Database & Relaties:** Controleert alle 18 Dexie-tabellen op integriteit, verweesde ouder-kind referenties (zoals afspraken zonder betrokkene, taken zonder fase, logregels zonder taak, meterstanden zonder meter) en ongeldige waarden (negatieve getallen, ontbrekende verplichte omschrijvingen).
- **Kluis & Beveiliging:** Verifieert of de master DEK actief en non-extractable is in geheugen, controleert kluis-metadata en Argon2id-parameters.
- **Regelmotor Benchmark:** Voert een benchmark uit over alle termijn-, financiële, garantie-, onderhouds- en energieregels en meet evaluatietijd in milliseconden.
- **Zero-Network Invariant:** Scant de actieve DOM op eventuele ongeoorloofde externe scripts of stylesheets.
- **Opslag & Quota:** Meet opslaggebruik en beschikbare browserquota (`navigator.storage.estimate()`).

### 3. Rapportage & Ontwikkeladvies (`src/lib/diagnostiek/rapport.ts`)
- Genereert een gestructureerd Markdown-ontwikkelrapport met concrete aanbevelingen en prioriteiten (hoog, gemiddeld, laag).
- Genereert een machine-leesbare JSON diagnose-payload voor debuggen.

### 4. Interactieve UI (`src/routes/Diagnostiek.tsx`)
- Biedt een realtime dashboard (`/diagnostiek`) met statuskaarten, categoriseerde tabs, JSON context inspector, logboekfilter, one-click copy en downloadknoppen, en geautomatiseerde reparatie-acties voor verweesde relaties.

---

## Gevolgen

### Positief
- **Snelle bugopsporing:** Inconsistente data en foutieve referenties worden direct gedetecteerd vóórdat ze de UI verstoren.
- **Privacy & Zero-Network:** Volledig lokaal uitgevoerd in de browser van de gebruiker; er verlaat nul data het apparaat.
- **Geautomatiseerde reparatie:** Eenvoudig herstellen van losgeraakte relaties met één klik.
