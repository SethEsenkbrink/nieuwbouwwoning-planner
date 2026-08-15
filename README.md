# Woningdossier

**100% lokaal, end-to-end versleuteld dossier voor het complete leven van een woning — van aankoop tot overdracht en het beheer daarna.**

Geschikt voor zowel **nieuwbouwwoningen** (van koop-/aannemingsovereenkomst tot oplevering, meerwerk en garanties) als **bestaande bouw** (van bod en bouwkundige keuring tot notarieel transport en meerjarenonderhoud).

---

## Kernprincipes

1. **Geen server, geen account, geen netwerk (Zero-network)**
   - Nul uitgaande netwerkverzoeken tijdens gebruik. De Content-Security-Policy blokkeert elk netwerkcontact (`connect-src 'none'`).
   - Geen servers die kunnen lekken, geen accounts, geen tracking.
   - Alle lettertypen, iconen en assets zijn self-hosted. De app werkt direct en gegarandeerd in vliegtuigmodus.

2. **Desktop & Mobiel Model**
   - **Desktop (Chromium: Chrome/Edge):** De volledige beheeromgeving, bron van waarheid en automatische backup via de File System Access API.
   - **Mobiel (iOS/Android):** Companion-modus. Read-only weergave op basis van geïmporteerde snapshots, plus een quick-capture inbox voor bonnen/foto's die als versleutelde inbox-delta geëxporteerd wordt naar de desktop.
   - Geen live synchronisatie over internet: één schrijfrichting per apparaat, dus nooit merge-conflicten.

3. **Alles versleuteld at rest (AES-256-GCM)**
   - Data Encryption Key (DEK) gegenereerd in Web Crypto als non-extractable sleutel, leeft uitsluitend in werkgeheugen.
   - Vergrendeld met Argon2id (wachtwoordzin) en HKDF (128-bit herstelcode).
   - Documenten en foto's worden per stuk in OPFS versleuteld in 1 MiB chunks met unieke IV's.

4. **De Eeuwige Backupbelofte**
   - Streaming `.woningdossier` zip-formaat via `fflate`.
   - Onversleutelde manifest met cryptoparameters (zonder persoonsgegevens) zodat een backup uit 2027 in 2032 nog exact weet hoe hij geopend moet worden.
   - Additief datamodel met onsterfelijke migratieketens en gouden fixtures (`verify:backup`).

5. **Lokale Deterministische Regelmotor**
   - Geen onvoorspelbare LLM's of externe API's. De regelmotor rekent zuiver lokaal termijnen, 5%-opschortingsrechten, garantie-einddatums en onderhoudsintervallen door.
   - De drie wetten: nooit stil muteren (altijd voorstellen met overnemen/aanpassen/wegklikken), traceerbare herkomst per datapunt, en heldere uitleg.

---

## Disclaimer

> **Geen juridisch of financieel advies:**
> Woningdossier berekent termijnen, rentes, stelposten, opschortingsrechten en energielabels op basis van algemene juridische kaders (zoals art. 7:768 BW, Woningborg/SWK regelingen en NTA 8800 richtlijnen) en de door u ingevoerde data.
> Deze berekeningen zijn uitsluitend informatief en indicatief. Uw eigen koop-, aannemings- of hypotheekovereenkomst en het advies van uw notaris of gecertificeerd adviseur zijn te allen tijde leidend en juridisch bindend.

---

## Ontwikkeling & Commando's

```bash
npm install          # installeer dependencies
npm run dev          # start Vite dev server lokaal
npm run build        # bouw productiebundel naar dist/
npm run verify       # typecheck + lint + tests + tokens + headers + verify:offline + build
```

## Licentie

De code is gelicenseerd onder de **AGPL-3.0-only** (zie `LICENSE`).
Merknamen, beeldmerken en de brink-ui styling zijn beschermd en vallen onder `TRADEMARK.md`.
