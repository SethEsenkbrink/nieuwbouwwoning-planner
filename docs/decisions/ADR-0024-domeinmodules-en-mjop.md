# ADR-0024 — Domeinmodules (Materialen, Garanties, Verzekeringen & MJOP-Light)

- **Status:** Geaccepteerd
- **Datum:** 2026-08-15
- **Beslissers:** Seth (producteigenaar), Assistent
- **Raakt:** `src/types/model.ts`, `src/db/db.ts`, `src/lib/mjop.ts`, `src/rules/`, `docs/STATE.md`

---

## Context

Een woningdossier is pas compleet wanneer niet alleen het bouwtraject, maar ook het bezit en beheer van de woning gestructureerd worden vastgelegd:
1. **Materialen en kleurcodes:** Verf, vloeren, tegels en sanitair moeten bij latere herstelwerkzaamheden exact terug te vinden zijn.
2. **Garanties & waarborgen:** Verlooptermijnen (Wkb, fabrieksgarantie, SWK/Woningborg) moeten proactief worden gesignaleerd vóórdat de termijn verstrijkt en defecten voor eigen rekening komen.
3. **Meerjarenonderhoud (MJOP-light):** Cyclische onderhoudsplanning en kostenraming over een 10-15 jaars horizon.
4. **Verzekeringen & inboedel:** Bewijs van opstal, inboedel, aankoopbonnen en serienummers bij eventuele schadeclaims.

---

## Besluit

### 1. Datamodel & Dexie Tabellen
Vier nieuwe entiteiten zijn toegevoegd aan het datamodel en Dexie:
- `materialen`: Categorisering per ruimte (`verf`, `vloer`, `tegel`, `sanitair`, `gevel`, `kozijn`), inclusief kleurcodes (RAL/NCS), glansgraad, leverancier en reserve-aantallen.
- `garanties`: Type garantie (`wettelijk_wkb`, `waarborgcertificaat`, `fabrieksgarantie`, `installatiegarantie`, `uitvoerdersgarantie`), polis-/certificaatnummers, ingangsdatum en looptijd in jaren.
- `verzekeringen`: Opstal, inboedel, aansprakelijkheid, glas, herbouwwaarde en premie.
- `inboedel`: Waardevolle inboedel-items met serienummers, aankoopbedrag en gekoppelde OPFS bijlagen.

### 2. MJOP-Light Kostenraming (`src/lib/mjop.ts`)
- Pure deterministische calculator die cyclische taken projecteert over een horizon van N jaren (standaard 10 jaar).
- Berekent verwachte onderhoudskosten per kalenderjaar op basis van taakintervallen en historische of geschatte kosten.

### 3. Regelmotor Integratie
- **G-001 (Garantievervaldatum):** Signaleert garanties die binnen 60 dagen (`attentie`) of 14 dagen (`waarschuwing`) aflopen.
- **G-002 (Onderdeel installatiegarantie):** Waarschuwt voor het aflopen van fabrieksgaranties op nagelvaste installaties (bijv. warmtepomp, omvormer).
- **O-001 (Periodiek onderhoud):** Signaleert achterstallig onderhoud (`waarschuwing`) en naderend onderhoud (`attentie`).

---

## Gevolgen

### Positief
- **Dossier compleetheid:** Volledig overdraagbaar dossier bij woningverkoop.
- **Financiële bescherming:** Geen gemiste garantietermijnen of onvoorziene onderhoudskosten.
- **Privacy & Encryptie:** Alle bijlagen en foto's worden via OPFS versleuteld onder de lokale DEK.
