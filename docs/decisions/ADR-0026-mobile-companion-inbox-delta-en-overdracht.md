# ADR-0026 — Mobile Companion (Inbox-Delta), Woningpaspoort Overdracht en WebAuthn-PRF

- **Status:** Geaccepteerd
- **Datum:** 2026-08-15
- **Beslissers:** Seth (producteigenaar), Assistent
- **Raakt:** `src/lib/inbox/`, `src/lib/woningpaspoort/`, `src/crypto/webauthn.ts`, `docs/STATE.md`

---

## Context

Bij het ontwerpen van een 100% lokale, zero-network PWA voor woningbeheer spelen drie praktische vraagstukken:
1. **Mobiele interactie zonder cloud sync:** Gebruikers lopen rond op de bouwplaats of in de woning met een smartphone en willen snel foto's, gebreken en meterstanden noteren (Quick Capture), zonder live cloud synchronisatie.
2. **Woningoverdracht bij verkoop:** Bij verkoop van de woning wil de eigenaar een schoon, gestructureerd dossier overhandigen aan de koper/notaris, zonder privégegevens, bankrekeningnummers of persoonsgegevens van de verkoper.
3. **Gebruiksgemak kluis:** Het intypen van een lang hoofdwachtwoord bij elk bezoek kan worden versneld via biometrische ontgrendeling (Touch ID / Face ID / Windows Hello) zonder de zero-network beveiliging te verzwakken.

---

## Besluit

### 1. Desktop & Mobiel Rol-scheiding en Inbox-Delta (`src/lib/inbox/`)
- **Desktop (Chrome/Edge):** De volledige app, de enige bron van waarheid, en verantwoordelijk voor beheer en automatische back-ups.
- **Mobiel (Companion):** Read-only snapshot viewer + Quick Capture.
- Nieuwe mobiele invoer wordt versleuteld weggeschreven naar een `.inbox-delta.woningdossier` pakket onder de lokale DEK (AES-256-GCM).
- De desktop importeert dit deltabestand en voegt de items en foto's (in OPFS) toe aan de hoofddatabase na review door de gebruiker.

### 2. Standalone Woningpaspoort Overdrachtsdossier (`src/lib/woningpaspoort/`)
- Genereert een zelfstandig, printvriendelijk HTML-document met ingesloten gestructureerde data.
- Bevat uitsluitend overdraagbare data:
  - Woningkenmerken (bouwjaar, oppervlakte, energielabel, kadaster)
  - Nagelvaste installaties en apparaten die achterblijven (`blijftBijWoning === true`)
  - Lopende garanties en waarborgcertificaten
  - Kleurcodes, verf- en materiaalspecificaties
  - Uitgevoerde onderhoudshistorie
- 100% offline te openen in elke browser zonder netwerk of accounts.

### 3. WebAuthn-PRF Biometrisch Kluisslot (`src/crypto/webauthn.ts`)
- Gebruikt de WebAuthn PRF (Pseudo-Random Function) extensie om lokaal een hardware-ondersteunde KEK af te leiden uit een biometrische scan (Touch ID / Face ID / Windows Hello).
- De DEK wordt lokaal versleuteld onder deze KEK, zodat de kluis met één vingerafdruk of gezichtsscan geopend kan worden.

---

## Gevolgen

### Positief
- **Zero-network gehandhaafd:** Geen servers, sockets of netwerkverkeer, zelfs niet tussen desktop en mobiel.
- **Privacy bij verkoop:** Schone scheiding tussen woningdata en privégegevens van de eigenaar.
- **Optimaal gebruikerscomfort:** Snelle biometrische ontgrendeling en mobiele invoer met camera-ondersteuning.
