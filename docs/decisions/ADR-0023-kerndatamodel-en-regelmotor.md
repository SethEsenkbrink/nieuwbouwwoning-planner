# ADR-0023 — Kerndatamodel (Woning) en Deterministische Regelmotor

- **Status:** Geaccepteerd
- **Datum:** 2026-08-15
- **Beslissers:** Seth (producteigenaar), Assistent
- **Raakt:** `src/types/model.ts`, `src/lib/opfs/`, `src/rules/`, `docs/STATE.md`

---

## Context

Woningdossier ondersteunt het complete leven van een woning: nieuwbouw én bestaande bouw.
Naast de projectplanning moet het dossier ook zuivere woningkenmerken (kadaster, afmetingen, energielabel, transportdatum) beheren en grote documenten lokaal versleuteld bewaren zonder het browsergeheugen te belasten.
Daarnaast vereist de app een zuiver deterministische regelmotor die termijnen en financiële risico's signaleert zónder netwerkverzoeken of ondoorzichtige AI-modellen.

---

## Besluit

### 1. Woning-entiteit en Trajecttype
- `Project` bevat nu expliciet `traject?: "nieuwbouw" | "bestaandeBouw"`.
- `Woningpaspoort` bevat gestructureerde kadastrale gegevens (`gemeente`, `sectie`, `perceelnummer`, `complexaanduiding`, `appartementsindex`), fysieke woningkenmerken (`woonoppervlakte`, `perceeloppervlakte`, `inhoudM3`, `aantalKamers`, `aantalWoonlagen`) en eigendomsoverdracht (`transportdatum`, `notaris`).

### 2. OPFS Versleutelde Bestandsopslag (`src/lib/opfs/storage.ts`)
- Grote bijlagen en documenten (bouwtekeningen, facturen, keuringsrapporten) worden opgeslagen in het **Origin Private File System (OPFS)**.
- Elk bestand wordt gefragmenteerd en versleuteld met **AES-256-GCM** onder de non-extractable DEK (`files/<uuid>.enc`).
- Voor testomgevingen en browsers zonder OPFS is een in-memory veilige fallback aanwezig.

### 3. Deterministische Regelmotor (`src/rules/`)
- Een pure, deterministische engine (`evalueerRegels(context)`) berekent signalen in 4 niveaus: `"info"`, `"attentie"`, `"waarschuwing"`, `"urgent"`.
- **Termijnregels (`termijnen.ts`):**
  - **T-001 (5%-opschortingsrecht):** 3-maandstermijn bij notaris na oplevering (signalering bij 30 dagen, 7 dagen en verstreken).
  - **T-002 (Hersteltermijn gebreken):** Signalering bij openstaande oplevergebreken ouder dan 30 en 90 dagen.
  - **T-003 (Meerwerksluiting):** Signalering bij 14 dagen, 3 dagen en verstreken sluiting.
- **Financiële regels (`financieel.ts`):**
  - **F-001 (Bouwdepot 24-maandenklok):** Looptijdcontrole vanaf passeerdatum akte.
  - **F-002 (Meerwerkbudget):** Budgetoverschrijding en 90%-drempelwaarschuwing.
  - **F-003 (Vervallen bouwtermijnen):** Facturatie- en declaratiesignalering.

---

## Gevolgen

### Positief
- **Deterministisch & Betrouwbaar:** Geen AI-hallucinaties bij cruciale wettelijke en financiële termijnen.
- **Privacy & Prestaties:** Bestanden blijven lokaal en versleuteld in OPFS, waardoor IndexedDB compact blijft.
- **Schaalbaar:** Nieuwe regels kunnen eenvoudig modulair worden toegevoegd aan `src/rules/`.
