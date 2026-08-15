# PROJECT.md — Woningdossier

> **Rol van dit bestand:** de _vaste waarheid_. Scope, constraints, datamodel en stack.
> Wijzig dit alleen bij een fundamentele koerswijziging en leg die altijd vast als ADR in `docs/decisions/`.
> Voor de actuele status zie `STATE.md`.

---

## 1. In één zin

Een 100% lokale, end-to-end versleutelde Progressive Web App (PWA) voor het complete leven van een
woning — zowel **nieuwbouw** (van koop-/aannemingsovereenkomst tot oplevering en garanties) als
**bestaande bouw** (van bod en keuring tot notarieel transport en beheer).

## 2. Doel & Afbakening

Woningdossier dekt de levenscyclus van een woning via twee trajecten die uitmonden in hetzelfde beheer:
1. **Nieuwbouw:** Koop-/aannemingsovereenkomst → grondtermijn → bouwtermijnen → ruwbouw → oplevering → onderhoudstermijn → garantietermijnen.
2. **Bestaande bouw:** Bod → koopovereenkomst → ontbindende voorwaarden (financiering, bouwkundige keuring) → taxatie → notarieel transport → sleuteloverdracht → beheer.

Beide trajecten delen vervolgens het doorlopende beheer: onderhoud (MJOP-light), installaties & materialen, garanties, verzekeringen, inboedel/lijst van zaken, en energieverbruik & energielabels.

## 3. Onwrikbare Kaders

| # | Kader | Consequentie |
|---|---|---|
| C1 | **Geen server, geen account, geen netwerk** | Nul uitgaande requests tijdens gebruik. CSP dwingt `connect-src 'none'` af. Alle assets/fonts self-hosted. Netlify uitsluitend statische hosting. |
| C2 | **Desktop is bron van waarheid, mobiel is companion** | Desktop (Chromium) biedt volledige CRUD en automatische backup via File System Access API. Mobiel biedt read-only weergave via snapshot en quick-capture via inbox-delta. Geen live sync. |
| C3 | **Alles versleuteld at rest (AES-256-GCM)** | Eén master DEK in geheugen, ingepakt met KEK-A (Argon2id passphrase) en KEK-C (128-bit herstelcode). OPFS voor chunks van 1 MiB. |
| C4 | **Eeuwige backupbelofte** | `.woningdossier` streaming zip (fflate) met onversleutelde manifest.json, data.enc, chunked files. Additief datamodel met onsterfelijke migraties en golden fixtures. |
| C5 | **Deterministische regelmotor** | Pure functies tonen redenering en signalen. Drie wetten: nooit stil muteren (voorstellen), herkomst per veld (`bron`), en verplichte uitleg. |
| C6 | **Geen juridisch/financieel advies** | Berekeningen en termijnen zijn indicatief; eigen contracten en officiële instanties zijn leidend. Permanente disclaimers. |

## 4. Datamodel

### Kernentiteit `Woning`
- `id`: UUID
- `traject`: `'nieuwbouw' | 'bestaandeBouw'`
- `woningStatus`: `'in_aanbouw' | 'opgeleverd' | 'in_eigendom' | 'overgedragen'`
- `paspoort`: adres, postcode, plaats, woningtype, bouwjaar, woonoppervlakte, perceeloppervlakte, energielabel, waarborgpolisnummer, notaris, hypotheekverstrekker.
- Elk datapunt draagt: `bron: 'ingevoerd' | 'afgeleid' | 'geïmporteerd' | 'voorstel'`. Handmatig ingevoerde waarden zijn gepind en worden nooit stil overschreven.

### Financieel Model
Drie kolommen: **begroot / werkelijk / nog verplicht**.
- **Nieuwbouw:** Grondkosten, aanneemsom, termijnstaat, meerwerk, minderwerk, bouwrente, bouwdepot (opnames + rente), notaris, hypotheekadvies, keuken, badkamer, tuin, vloeren.
- **Bestaande bouw:** Koopsom, overdrachtsbelasting, makelaar, taxatie, bouwkundige keuring, verbouwbudget.
- **Gedeeld:** Hypotheek (bedrag, rentevaste periode, NHG, maandlast), eigen geld, subsidies, maandelijkse cashflowprognose.

### Juridische Ankers & Termijnen
- **5%-opschortingsrecht (art. 7:768 BW):** Depot bij notaris/bankgarantie (max 5% van aanneemsom). Valt 3 maanden na oplevering vrij, tenzij koper schriftelijk blokkeert wegens gebreken. Waarschuwing in maand 2 over ontbrekende ondernemersbrief.
- **Onderhoudstermijn:** 6 maanden na oplevering.
- **Garantietermijnen (Woningborg/SWK):** 6 jaar algemeen, 10 jaar ernstige gebreken, aflopende tellers per bouwdeel.

### Materialen & Installaties (As-built dossier)
Merk, type, serienummer, locatie, installatiedatum, installateur, leverancier, document-uuid's (factuur, handleiding, typeplaatje), garantie-einddatum, specificaties.

### Onderhoud & MJOP-light
Terugkerende taken gekoppeld aan installaties/bouwdelen, intervallen, seizoensvoorkeur, logboek met kosten, plus 10-jaars kostenprognose per bouwdeel en aanbevolen maandreservering.

### Verzekeringen & Inboedel
Opstal, inboedel, aansprakelijkheid, rechtsbijstand. Inboedel en vaste voorzieningen met aankoopprijs, datum, factuur, serienummer (lijst van zaken / claimbewijs).

### Energie & Label
- Verbruik (handmatig / P1 CSV-import) voor elektra, gas, teruglevering, warmtepompuren.
- Feitelijk energielabel (10 jaar geldig vanaf afmelding EP-Online, EPBD IV compliant).
- Indicatief label (NTA 8800 indicatie met permanente, niet-wegklikbare disclaimer).
- Terugleververgoeding na salderen (post-2027 instelbare parameter).

## 5. Technische Stack

| Laag | Technologie |
|---|---|
| Frontend | React 19, Vite 8, TypeScript 6, Tailwind CSS v4, react-router |
| Database | Dexie ^4.4.5 + dexie-react-hooks (IndexedDB) |
| Blob-opslag | Origin Private File System (OPFS) via navigator.storage.getDirectory() |
| Cryptografie | Web Crypto (AES-256-GCM, HKDF, SHA-256), Argon2id (WASM/SIMD) in Web Worker |
| Backup & Zip | `fflate` (streaming zip) |
| PWA | `vite-plugin-pwa` (offline app-shell, manifest, geen runtime remote caching) |
| Grafieken | `recharts` |
| PDF Extractie / Viewer | `pdfjs-dist` |
| Huisstijl | `@brink/ui` tokens (`src/styles/brink-theme.css`) |
| Hosting | Netlify (uitsluitend statische bestanden) |
