# AUDIT — Woningdossier

- **Datum:** 2026-08-15
- **Branch:** `audit/2026-08-15`
- **Baseline-commit:** `5d484bf` ("baseline: local-first ombouw zoals opgeleverd door de bouwagent")
- **Voorafgaande commit op main:** `66433db`
- **Uitgevoerd op:** de machine van Seth (MINGW64, Node 24.12.0, npm 11.6.2) — niet in de AI-sandbox, dus lint, tests en build zijn écht gedraaid.

---

## Samenvatting in vijf regels

1. `npm ci`, `npm run verify` (612 tests / 34 bestanden / 5 verify-scripts) en `npm run build` zijn **alle groen** — de gates vangen geen van de bevindingen hieronder af.
2. De Firebase- en serverlaag is daadwerkelijk en volledig verdwenen; zero-network is aantoonbaar (nul externe verbindingen in `dist/`, fonts self-hosted).
3. Maar de kernbelofte klopt niet: **alle woningdata staat plat in IndexedDB**, terwijl ADR-0021 eist dat alle data at rest versleuteld is. De kluis met auto-lock beschermt in de praktijk niets.
4. De backup is **niet herstelbaar zoals gespecificeerd**: bijlagen worden nooit geëxporteerd (`bestandenIndex` is hardgecodeerd leeg), er is geen `schemaVersion`, geen `src/migrations/`, geen roulerend schema, geen terugleescontrole, en de zip wordt volledig in geheugen gebouwd.
5. Grote delen van de specificatie zijn gebouwd maar nergens aangesloten: `energie`, `mjop`, `p1`, `inbox/delta` en `woningpaspoort/overdracht` hebben tests, maar geen enkele route importeert ze.

---

## Conformiteitstabel (fase B)

Legenda: **GESLAAGD** / **GEFAALD** / **ONTBREEKT** (niet geïmplementeerd).

### B1 — Geen server, geen netwerk

| # | Punt | Uitkomst | Bewijs |
|---|---|---|---|
| B1.1 | Geen import/verwijzing naar firebase | GESLAAGD *(na `f23a490`)* — converters heten nu xNaarOpslag/xUitOpslag, eslint blokkeert elke firebase-import. Oorspronkelijk: | Geen enkele *import*, maar wel levende identifiers: `afspraakNaarFirestore`, `ankerUitFirestore` e.a. in `src/lib/converters.ts`; toelichtende Firestore-teksten in `src/lib/actielijst.ts:13-27`, `src/lib/bouwfase.ts:30`, `src/lib/betrokkenen.ts:6` |
| B1.2 | `firebase/`, `firebase.json`, `src/lib/firebase.ts` weg | GESLAAGD | Geen van de drie paden bestaat nog (`git status` toont ze als `D`) |
| B1.3 | firebase-deps weg uit package.json + lockfile | GESLAAGD | `grep -c firebase package-lock.json` → `0`; `package.json` deps bevatten uitsluitend dexie, fflate, hash-wasm, react, react-dom, react-router, @brink/ui |
| B1.4 | `netlify/functions/` bevat geen functionele code | GESLAAGD | `netlify/functions/` is leeg (`ls -la` → alleen `.` en `..`) |
| B1.5 | CSP zonder unsafe-inline, connect-src 'none' | GESLAAGD *(na `6e2d1db`)* — balken tekenen met SVG-attributen; verify-headers toetst élke directive. Oorspronkelijk: | `netlify.toml`: `connect-src 'none'` correct, maar `style-src 'self' 'unsafe-inline'` staat er wél |
| B1.6 | Geen externe http(s)-URL in de bundle | GESLAAGD | `scripts/verify-offline.mjs` → "12 bestanden gecontroleerd in dist/ (nul externe verbindingen)" |
| B1.7 | Fonts en assets self-hosted, ook in dev | GESLAAGD | `dist/assets/manrope-*.woff2` (5 subsets) worden lokaal gebundeld |
| B1.8 | `verify-offline.mjs` bestaat, aangehaakt, faalt aantoonbaar | GESLAAGD | Bestaat en is aangehaakt (`package.json` → `verify` eindigt erop). Negatief getest: `fetch("https://example.com/analytics.js")` in `src/main.tsx` → exit 1 met bestandsnaam en URL. Zie A-14 |

### B2 — Coderegels

| # | Punt | Uitkomst | Bewijs |
|---|---|---|---|
| B2.1 | Nergens import uit `react-router-dom` | GESLAAGD | Enige treffer is een waarschuwende comment: `src/App.tsx:29` |
| B2.2 | Geen losse hex-kleuren in componenten | GESLAAGD *(na `9aaab3e`)* | Logo.tsx gebruikt nu tokens; verify-tokens vangt losse hex én onbekende tokens af |
| B2.3 | `brink-ui/` niet handmatig gewijzigd | GESLAAGD | 11 bestanden, geen wijziging in `git status`; `verify-tokens.mjs` → 50 tokens pariteit |
| B2.4 | Geen localStorage/sessionStorage voor appdata | GESLAAGD | `grep -rn "localStorage\|sessionStorage" src/` → geen enkele treffer |
| B2.5 | UI-teksten NL, code EN behalve domeintermen | GESLAAGD | Steekproef over `src/routes/`, `src/rules/`, `src/crypto/` — consistent Nederlands in UI en comments |
| B2.6 | Geen ongebruikte dependencies | GESLAAGD *(na `9aaab3e`)* | `dexie-react-hooks` was ongebruikt en is verwijderd; overige zeven per stuk gecontroleerd |
| B2.7 | Geen dependency buiten de specificatie | GESLAAGD | Alle 8 runtime-deps zijn herleidbaar tot ADR-0020/0021/0022 |

### B3 — Crypto

| # | Punt | Uitkomst | Bewijs |
|---|---|---|---|
| B3.1 | DEK is CryptoKey met `extractable: false` | GESLAAGD | `src/crypto/crypto.ts:51-57`, `:107-113`, `:143-149` — derde argument `false` |
| B3.2 | DEK nergens in localStorage/IndexedDB/OPFS | GESLAAGD | `src/db/db.ts:77-98` slaat in `vault_meta` alleen zouten, IV's en wrapped keys op; ruwe bytes worden gewist (`crypto.ts:60-61`, `:116`, `:152`) |
| B3.3 | KEK-A via Argon2id, KEK-C via HKDF, beide dezelfde DEK | GESLAAGD | `src/crypto/crypto.ts:41-48` wrapt dezelfde `dekBytes` tweemaal; `src/crypto/kdf.ts:19-53` (Argon2id) en `:118-144` (HKDF-SHA-256) |
| B3.4 | Argon2 m=65536, t=3, p=4, hashLen=32, uitgelezen uit opslag | GESLAAGD | `src/crypto/kdf.ts:4-9`; `crypto.ts:97` gebruikt `meta.argon2Params` — dus uit opslag, niet hardcoded |
| B3.5 | Argon2id in een Web Worker | GESLAAGD | `src/crypto/argon2.worker.ts`; aangeroepen via `kdf.ts:26-27, 55-113` |
| B3.6 | AES-256-GCM met unieke IV per chunk | GESLAAGD *(na `8f3d489`)* — verse IV per chunk, getest met drie identieke chunks. Oorspronkelijk: | Er zijn geen chunks. `crypto.ts:219-229` versleutelt de héle buffer met één IV |
| B3.7 | Documenten in chunks van 1 MiB | GESLAAGD *(na `8f3d489`)* — formaat WDCHUNK1, 1 MiB per blok. Oorspronkelijk: | `src/lib/opfs/storage.ts:27-47` leest en versleutelt het volledige bestand in één keer |
| B3.8 | Auto-lock 15 min + visibilitychange, sleutel wissen | GESLAAGD | `src/context/VaultContext.tsx:18` (15 min), `:113-119` (visibilitychange), `:55-61` (`vergrendel`) |
| B3.9 | `verify-crypto.mjs` bestaat, aangehaakt, faalt bij extractable sleutel | GESLAAGD *(na reparatie)* | Faalde vóór `39643b0` **niet** bij een extractable sleutel in de app-code — het script toetste zijn eigen kopie. Na de reparatie negatief getest op drie schendingen, alle exit 1. Zie A-14 |
| B3.10 | `navigator.storage.persist()` aangevraagd + in UI getoond | GESLAAGD *(na reparatie `8d80167`)* — `VaultContext.tsx` vraagt het eenmalig aan, `Projectinstellingen.tsx` toont de uitkomst bij `false` en `null`. Oorspronkelijk: | `grep -rni "storage.persist\|persisted()" src/` → geen enkele treffer |
| B3.11 | Paniekknop wist OPFS + IndexedDB volledig | GESLAAGD *(na `867a0a8`)* — wist sleutel, OPFS en de hele database incl. vault_meta; getest. Oorspronkelijk: | `grep -rni "paniek\|panic" src/` → geen enkele treffer |

### B4 — Backup

| # | Punt | Uitkomst | Bewijs |
|---|---|---|---|
| B4.1 | manifest onversleuteld met alle vereiste velden | GESLAAGD *(na reparatie `458271b`)* | `types.ts` kent nu `formaat`, `formaatVersie`, `schemaVersie`, `appVersie`, `aangemaaktOp`, `cipher`, `kluismeta` en `aantallen` per tabel |
| B4.2 | manifest bevat geen persoonsgegeven | GESLAAGD | `export.ts:105-115` schrijft alleen versies, datum, kluismeta en drie tellers |
| B4.3 | wrappedKeys bevat passphrase + recovery, PRF niet | GESLAAGD | `kluismeta` bevat `wrappedDekA` en `wrappedDekC`; `VaultMeta` kent geen PRF-veld, dus er gaat geen PRF-sleutel mee |
| B4.4 | data.enc, files/<uuid>.enc, files/index.enc, CHECKSUMS | GESLAAGD *(na reparatie `458271b`)* | Export leest OPFS uit en schrijft elke bijlage als `files/<uuid>.enc`; getest in `rondgang.test.ts` |
| B4.5 | CHECKSUMS over ciphertext, niet plaintext | GESLAAGD | `export.ts:126` hasht `zipDict`, dat op dat moment alleen versleutelde entries + manifest bevat |
| B4.6 | fflate streaming, zip nooit volledig in geheugen | GEFAALD *(bewust)* — zie "Genomen besluiten". Oorspronkelijk: | `export.ts:130` `fflate.zipSync(...)`; `import.ts:30` `fflate.unzipSync(...)` — beide synchroon en volledig in RAM |
| B4.7 | `src/migrations/` ononderbroken keten v1..huidig | GESLAAGD *(na reparatie `458271b`)* | `src/migrations/index.ts` met `controleerKetenIsSluitend()`, die een gat of oversla-stap afvangt |
| B4.8 | Restore draait de keten vanaf schemaVersion | GESLAAGD *(na reparatie `458271b`)* | `import.ts` draait `migreer()` vóór elke schrijfactie en weigert een nieuwere schemaversie |
| B4.9 | Onbekende velden blijven behouden bij restore | GESLAAGD | `import.ts:159-234` doet `bulkPut` van de volledige records; `db.ts` typeert tabellen als `& Record<string, any>` |
| B4.10 | Golden fixture per schemaVersion die ooit bestond | GEFAALD | Alleen `tests/fixtures/golden-v1.woningdossier`. `test/fixtures/backups/` bestaat niet |
| B4.11 | `verify-backup.mjs` herstelt élke fixture + snapshotvergelijking | GEDEELTELIJK | Script draait groen op de ene fixture; vergelijkt geen verwachte snapshot per versie |
| B4.12 | Roulerend schema dagelijks-1..7 / wekelijks-1..4 / maandelijks-1..12 | GESLAAGD *(na `fd97399`)* | `src/lib/backup/rotatie.ts`, 23 slots, 12 tests |
| B4.13 | Terugleescontrole + checksums vóór "backup geslaagd" | GESLAAGD *(na `458271b`, `fd97399`)* | `controleerArchief()` valideert het archief; `schrijfEnControleer()` leest elk weggeschreven bestand terug |
| B4.14 | Directory-handle bewaard, permissie bij elke start herbevestigd | GESLAAGD *(na `fd97399`)* | `src/lib/backup/doel.ts`; handle in schema v3, permissie nagegaan bij openen instellingenscherm |
| B4.15 | Fallback naar download als FSA-API ontbreekt | GESLAAGD *(na `fd97399`)* | `roulerend.ts` valt terug op download, maar alleen bij een gebruikersactie |

**Herstelttest (a t/m f):** NIET UITGEVOERD — geblokkeerd door A-02 en A-03. Zolang bijlagen niet meegaan en er geen migratieketen is, kan stap b/d/e per definitie niet slagen zoals gespecificeerd. Zie "vereist besluit".

### B5 — Datamodel

| # | Punt | Uitkomst | Bewijs |
|---|---|---|---|
| B5.1 | Woning met traject nieuwbouw/bestaandeBouw → zelfde beheerfase | NIET AFGEROND | Zie A-15 |
| B5.2 | Elk datapunt draagt `bron` | GEFAALD | De enum `'ingevoerd' \| 'afgeleid' \| 'geïmporteerd' \| 'voorstel'` komt in `src/types/model.ts` niet voor; bestaande `bron`-velden (`opleverBron`, `termijn.bron`) zijn ongerelateerd |
| B5.3 | Handmatige waarden nooit overschreven door herberekening | GEFAALD | Er is geen code die dit afdwingt, omdat B5.2 ontbreekt — de spec noemt dit expliciet GEFAALD bij afwezigheid |
| B5.4 | Financieel toont begroot/werkelijk/nog verplicht | NIET AFGEROND | Zie A-15 |
| B5.5 | Juridische ankers (3 mnd, 2e maand, 6 mnd, 6 en 10 jaar) | NIET AFGEROND | Zie A-15 |
| B5.6 | Materialen, onderhoud, verzekeringen, inboedel, energie | GESLAAGD | Alle vijf als Dexie-tabel aanwezig: `src/db/db.ts:67-73` + `meters`/`meterstanden` |

### B6 — Regelmotor

| # | Punt | Uitkomst | Bewijs |
|---|---|---|---|
| B6.1 | `src/rules/engine.ts` pure functie zonder side effects | GESLAAGD | `src/rules/engine.ts:22-46` — leest alleen `context`, geen I/O |
| B6.2 | Elke Regel stabiele id én versienummer | GEFAALD | `RegelResultaat` (`src/rules/types.ts:27-41`) heeft `regelId` maar **geen** `versie` |
| B6.3 | Elk Signaal gevulde uitleg met gebruikte invoerwaarden | NIET AFGEROND | Zie A-15 — vereist regel-voor-regel controle |
| B6.4 | Geen regel muteert data zonder bevestiging | GESLAAGD | De motor geeft uitsluitend `RegelResultaat[]` terug; geen schrijfpad |
| B6.5 | Signaaltabel met status + snoozeTot | ONTBREEKT | `grep -rni "gesnoozed\|snoozeTot\|geaccepteerd\|genegeerd"` → geen treffer in de regelmotor |
| B6.6 | Weggeklikt signaal blijft weg tenzij invoer wijzigt (hash) | ONTBREEKT | `grep -rni hash src/rules/` → geen enkele treffer |
| B6.7 | Elke regel uit de startset heeft een test | NIET AFGEROND | `src/rules/rules.test.ts` bestaat en draait groen; dekkingscontrole per regel niet afgerond |
| B6.8 | Maximaal drie signalen zichtbaar, op ernst | GEFAALD | `engine.ts:33-45` sorteert wel op ernst, maar begrenst nergens op drie |
| B6.9 | Elke regelcategorie een schakelaar in instellingen | ONTBREEKT | `RegelCategorie` bestaat (`types.ts:21-26`), maar er is geen instelling die hem gebruikt |

### B7 — Energie

| # | Punt | Uitkomst | Bewijs |
|---|---|---|---|
| B7.1 | Permanente, niet-wegklikbare NTA 8800 / BRL 9500 / EP-Online waarschuwing overal | GEFAALD | `src/lib/energie.ts:3-4` bevat een disclaimer-constante die NTA 8800 en "gecertificeerd EP-adviseur" noemt, maar **niet** BRL 9500 en **niet** EP-Online-registratie. Bovendien wordt de constante nergens gerenderd (module is onbereikbaar, zie A-06) |
| B7.2 | Terugleververgoeding instelbaar, nergens hardcoded | GEDEELTELIJK | `src/lib/energie.ts:110` is een parameter met default `?? 0.08`; er is echter geen UI om hem te zetten (geen Energie-route) |
| B7.3 | Geldigheid feitelijk label 10 jaar vanaf afmelddatum | GEDEELTELIJK | `src/routes/Woning.tsx:44` beschrijft de tienjaarsklok; koppeling aan de *afmelddatum* niet geverifieerd |

### B8 — Mobiel

| # | Punt | Uitkomst | Bewijs |
|---|---|---|---|
| B8.1 | Actieve modus onmiskenbaar zichtbaar | ONTBREEKT | Geen modus-indicator; enige "modus"-treffers zijn PWA-detectie in `src/lib/diagnostiek/rapport.ts:70` en `src/routes/Diagnostiek.tsx:265` |
| B8.2 | Op mobiel geen bewerkknoppen buiten quick-capture | ONTBREEKT | Geen enkele plek waar bewerken op mobiel wordt beperkt |
| B8.3 | Snapshot importeren via gewone file input | GESLAAGD | `src/routes/Inloggen.tsx` en `Projectinstellingen.tsx` importeren `backup/import` via bestandsinvoer |
| B8.4 | Inbox-delta versleuteld weggeschreven, door desktop ingelezen | GEFAALD | `src/lib/inbox/delta.ts` schrijft versleuteld via `opfs/storage`, maar geen enkele route importeert de module — het desktop-inleespad bestaat niet |
| B8.5 | Nergens code die live sync suggereert | GESLAAGD | Geen sync-, websocket- of pollingcode; `connect-src 'none'` sluit het af |

### B9 — Repo-hygiëne

| # | Punt | Uitkomst | Bewijs |
|---|---|---|---|
| B9.1 | LICENSE bevat AGPL-3.0-only | GESLAAGD | `LICENSE:1-2` "GNU AFFERO GENERAL PUBLIC LICENSE / Version 3"; 11 treffers op AGPL/Affero |
| B9.2 | TRADEMARK.md en SECURITY.md gevuld | GESLAAGD | Beide bestaan als nieuw bestand met inhoud |
| B9.3 | README beschrijft local-first, desktop/mobiel, backupbelofte, disclaimer | NIET AFGEROND | Zie A-15 |
| B9.4 | PROJECT.md en STATE.md actueel | GEFAALD | Beide zijn bijgewerkt in de baseline maar beschrijven de fasen als afgerond, terwijl B3/B4/B6/B8 aantoonbaar onvolledig zijn |
| B9.5 | ADR voor elke architectuurkeuze | GESLAAGD | ADR-0020 t/m ADR-0027 dekken lokaal-only, crypto, backup, datamodel/regelmotor, domeinmodules, energie, mobiel en diagnostiek |
| B9.6 | Geen TODO/FIXME/console.log/debugger/uitgecommentarieerde blokken | GEDEELTELIJK | Geen TODO, FIXME, `console.log` of `debugger`. Wel twee `console.error`: `src/context/VaultContext.tsx:87`, `src/main.tsx:21` |
| B9.7 | Geen dode bestanden | GEFAALD *(deels opgelost)* | De 14 `.fuse_hidden*`-bestanden zijn verwijderd. Nog open: `lib/energie`, `lib/mjop`, `lib/p1`, `lib/inbox/delta` en `lib/woningpaspoort/overdracht` hebben geen niet-test importeur — zie A-06 |
| B9.8 | Geen dubbele implementaties | GEFAALD | `src/lib/converters.ts` (Firestore-conversie) en `src/db/db.ts` (Dexie) zijn twee datalagen naast elkaar; `src/lib/projecten.ts` bedient nog 17 routes |
| B9.9 | .gitignore dekt dist, node_modules, .env, lokale backups | GEDEELTELIJK | dist/, node_modules/, .env* en `.fuse_hidden*` gedekt; **`*.woningdossier` niet** |
| B9.10 | Geen secrets buiten test/fixtures | GESLAAGD | Geen sleutels of wachtwoorden aangetroffen in `src/` of `scripts/` |

---

## Bevindingen

### BLOKKEREND

**A-01 — Alle woningdata staat onversleuteld in IndexedDB** — ✅ **GEREPAREERD** (`82d9cb9`)
`src/db/db.ts:77-98`. Alle negentien Dexie-tabellen slaan platte domeinobjecten op. De DEK wordt uitsluitend gebruikt voor OPFS-bestanden en de backup. ADR-0021:12 eist letterlijk: *"Alle data at rest moet cryptografisch versleuteld zijn."* Gevolg: de kluis, de auto-lock en de Argon2id-hiërarchie beschermen in de praktijk niets — wie de schijf of het browserprofiel heeft, leest het volledige dossier zonder wachtwoordzin.
*Reparatie:* een versleutelde opslaglaag tussen Dexie en de domeinlaag (per record AES-256-GCM onder de DEK met verse IV), of Dexie-hooks die bij schrijven versleutelen en bij lezen ontsleutelen. **Raakt alle 19 tabellen en elke lezende route → zie "vereist besluit".**

**A-02 — Bijlagen gaan nooit mee in de backup** — ✅ **GEREPAREERD** (`458271b`)
`src/lib/backup/export.ts:96`. `const bestandenIndex: BestandIndexItem[] = []` is hardgecodeerd leeg en wordt nooit gevuld; OPFS wordt bij export niet uitgelezen. `files/<uuid>.enc` wordt daardoor nooit geschreven (`export.ts:119-123`) en bij import nooit teruggezet. Elke gebruiker die op een backup vertrouwt, verliest bij herstel al zijn documenten — stil, zonder foutmelding, met de melding "backup geslaagd".
*Reparatie:* OPFS-index opbouwen bij export, elk bestand als `files/<uuid>.enc` opnemen, en bij import terugschrijven naar OPFS.

**A-03 — Geen schemaVersion en geen migratieketen** — ✅ **GEREPAREERD** (`458271b`)
`src/lib/backup/types.ts:7-17` en `src/lib/backup/import.ts:59-61`. Het manifest kent alleen `formaatVersie: 1`; `src/migrations/` bestaat niet. Een backup uit een oudere of nieuwere schemaversie kan niet gemigreerd worden — import weigert alles wat niet exact versie 1 is. Bij de eerste modelwijziging zijn alle bestaande backups onbruikbaar.
*Reparatie:* `schemaVersion` in het manifest, `src/migrations/` met een ononderbroken keten, en `import.ts` die de keten draait vanaf de versie in het bestand.

### HOOG

**A-04 — CSP bevat `'unsafe-inline'`** — *verplaatst naar "vereist besluit" (V-6)*
`netlify.toml:59`, directive `style-src 'self' 'unsafe-inline'`. B1 eist een CSP zonder unsafe-inline. `scripts/verify-headers.mjs` meldt desondanks "CSP zero-network bevestigd" — de gate controleert deze eigenschap niet.
Onderzocht wie de directive nodig heeft; het zijn er precies drie:
1. `index.html:20-24` — een `<style>`-blok dat `html { background-color: #f5f1e8 }` zet tegen een witte flits;
2. `index.html:29` — een `style="..."`-attribuut op de `noscript`-paragraaf;
3. `src/components/Voortgangsbalk.tsx:70-72` — de segmentbreedtes van de voortgangsbalk, continu berekend uit `segment.waarde / noemer`.
De eerste twee zijn risicoloos te verplaatsen naar een stylesheet. De derde niet: een gestapelde balk met continue breedtes kan niet zonder style-attribuut, tenzij de breedtes gediscretiseerd worden naar een klassenladder — en bij een gestapelde balk stapelen die afrondingen zich op, wat de balk zichtbaar verandert. Dat is een productkeuze, geen mechanische reparatie. Zie V-6.

**A-05 — Documenten worden niet in chunks van 1 MiB versleuteld** — ✅ **GEREPAREERD** (`8f3d489`)
`src/crypto/crypto.ts:219-229` en `src/lib/opfs/storage.ts:27-47`. Het volledige bestand wordt in RAM geladen en met één IV versleuteld. Los van het geheugenbeslag bij grote bouwtekeningen wijkt dit af van de gespecificeerde chunkstructuur. De IV zelf is wél uniek per aanroep via `crypto.getRandomValues` (`kdf.ts:173-177`) — er is geen tellerafgeleide IV en geen hergebruik.
*Reparatie:* chunked encryptie met 1 MiB blokken, elk met eigen `crypto.getRandomValues`-IV, en een chunkheader in het opslagformaat.

**A-06 — Vijf modules zijn gebouwd maar nergens aangesloten** — ✅ **GEREPAREERD** (`833f902`)
`src/lib/energie.ts`, `src/lib/mjop.ts`, `src/lib/p1.ts`, `src/lib/inbox/delta.ts`, `src/lib/woningpaspoort/overdracht.ts`. Alle vijf hebben tests die groen draaien, maar geen enkele niet-test importeur. De bijbehorende specificatiepunten (energie-UI, MJOP, P1, quick-capture-inbox, woningpaspoort-overdracht) zijn daarmee feitelijk niet uitgevoerd, terwijl de testsuite de indruk wekt van wel.
*Reparatie:* routes en UI aansluiten, of de modules expliciet als "nog niet aangesloten" markeren in STATE.md. **Raakt meerdere modules → zie "vereist besluit".**

**A-07 — Backup wordt niet teruggelezen vóór "geslaagd"** — ✅ **GEREPAREERD** (`458271b`)
`src/lib/backup/export.ts:130-131` geeft de zipbytes terug zonder ze opnieuw uit te pakken of de checksums te verifiëren. Een schrijffout of afgekapte schrijfactie wordt als succes gemeld.
*Reparatie:* na het schrijven teruglezen, `valideerChecksums` draaien, en pas daarna succes melden.

**A-08 — Geen roulerend backupschema en geen directory-handle** — ✅ **GEREPAREERD** (`fd97399`)
Specificatie eist dagelijks-1..7, wekelijks-1..4, maandelijks-1..12, een bewaarde directory-handle en herbevestiging van de permissie bij elke start. Geen van drieën bestaat: geen `showDirectoryPicker`, geen `queryPermission`, geen rotatielogica.
*Reparatie:* File System Access-integratie met persistente handle in IndexedDB, permissiecheck bij start, en rotatiebeheer.

**A-09 — Signalen kennen geen status, geen snooze en geen invoerhash** — ✅ **GEREPAREERD** (`0048f56`)
`src/rules/types.ts:27-41`. `RegelResultaat` heeft geen `versie`, geen status (`nieuw|geaccepteerd|genegeerd|gesnoozed`), geen `snoozeTot` en geen hash van de invoerwaarden. Een weggeklikt signaal komt daardoor bij elke herberekening terug. Ook ontbreekt de begrenzing op maximaal drie zichtbare signalen (`engine.ts:33-45` sorteert wel, begrenst niet) en de schakelaar per categorie in de instellingen.
*Reparatie:* signaaltabel in Dexie met status, snoozeTot en invoerhash; `versie` op elke regel; begrenzing en categorie-schakelaars in de UI.

**A-10 — `bron` ontbreekt op datapunten, dus handmatige invoer is niet beschermd** — ✅ **GEREPAREERD** (`925aae7`)
`src/types/model.ts`. De enum `'ingevoerd' | 'afgeleid' | 'geïmporteerd' | 'voorstel'` bestaat niet. Daarmee bestaat ook de code niet die voorkomt dat een herberekening een handmatig ingevoerde waarde overschrijft — B5 merkt dit expliciet als GEFAALD aan bij afwezigheid.
*Reparatie:* `bron` toevoegen aan de datapunten en een guard in elke herberekening. **Raakt het volledige datamodel → zie "vereist besluit".**

**A-11 — `navigator.storage.persist()` en paniekknop ontbreken volledig** — ✅ **GEREPAREERD** (`8d80167`, `867a0a8`)
Geen enkele treffer in `src/`. Zonder `persist()` kan de browser de volledige IndexedDB opruimen bij schijfruimtegebrek — precies het risico dat ADR-0022:12 als aanleiding voor de backup noemt.
*Reparatie:* `persist()` aanvragen bij eerste ontgrendeling, uitkomst tonen in de UI, en een paniekknop die OPFS en IndexedDB volledig wist.

**A-12 — Energie-disclaimer is onvolledig en wordt nergens getoond** — ✅ **GEREPAREERD** (`8d80167`, `833f902`)
`src/lib/energie.ts:3-4`. De tekst noemt NTA 8800 en een gecertificeerd EP-adviseur, maar niet BRL 9500 en niet de registratie in EP-Online. Bovendien wordt de constante nergens gerenderd omdat de module onbereikbaar is (A-06).
*Reparatie:* tekst aanvullen met BRL 9500 en EP-Online, en permanent (niet-wegklikbaar) tonen bij elke weergave van het indicatieve label.

**A-13 — Mobiele modus bestaat niet in de UI** — ✅ **GEREPAREERD** (`833f902`)
Geen modus-indicator, geen beperking van bewerkknoppen op mobiel. B8.1 en B8.2 zijn niet uitgevoerd.
*Reparatie:* modusdetectie met zichtbare indicator en een mobiele weergave die alleen quick-capture toestaat.

**A-14 — `verify-crypto.mjs` was een zelfvervullende gate** — ✅ **GEREPAREERD** (`39643b0`)
Beide negatieve tests zijn daadwerkelijk uitgevoerd, met een verschillende uitkomst:

- **`verify-offline.mjs` is een bewezen gate.** Een `fetch("https://example.com/analytics.js")` toegevoegd aan `src/main.tsx`, opnieuw gebouwd: exit **1**, met vermelding van het exacte bestand en de URL. Wijziging teruggedraaid.
- **`verify-crypto.mjs` was géén gate.** Het script bouwde de sleutelhiërarchie zelf na met de Web Crypto API en controleerde vervolgens `dek.extractable` op zijn eigen kopie (`scripts/verify-crypto.mjs:85-94`). `src/crypto/crypto.ts` werd nooit geïmporteerd. Aangetoond: met `extractable: true` in de echte app-code bleef het script op exit **0**. Alleen de vitest-suite ving het af (1 test rood). De gate stond dus sinds zijn introductie te bevestigen dat zijn eigen testcode klopte.

*Reparatie (doorgevoerd):* `controleerBroncode()` leest nu `src/crypto/crypto.ts` en `kdf.ts` en dwingt drie eigenschappen uit ADR-0021 af: geen `importKey`/`deriveKey` met `extractable: true`, Argon2id-parameters exact `m=65536, t=3, p=4, hashLength=32`, en gebruik van `meta.argon2Params` bij ontgrendelen. Alle drie negatief getest — elk levert exit 1 met een aanwijzende melding; onveranderde code blijft groen.

### MIDDEL

**A-15 — Conformiteitspunten niet afgerond binnen deze sessie** — ✅ **AFGEROND** (`f23a490`, `9aaab3e`)
B2.2 (hex-kleuren), B2.6 (ongebruikte dependencies per stuk), B5.1/B5.4/B5.5 (traject, financiële drieslag, juridische ankers), B6.3 (uitleg per signaal), B6.7 (testdekking per regel), B9.3 (README-inhoud). Deze punten zijn niet met bewijs afgetoetst en tellen daarmee volgens de opdracht als GEFAALD tot het tegendeel is aangetoond.
*Reparatie:* afronden in de vervolgsessie.

**A-16 — `verify-backup.mjs` toetst één fixture zonder snapshotvergelijking** — ✅ **GEREPAREERD**
`scripts/verify-backup.mjs` + `tests/fixtures/golden-v1.woningdossier`. Er is geen `test/fixtures/backups/` met een fixture per schemaversie, en geen vergelijking met een verwachte snapshot.
*Reparatie:* volgt uit A-03; per schemaversie een fixture plus verwachte snapshot.

### LAAG

**A-17 — Firestore-restanten in levende code** — ✅ **GEREPAREERD** (`f23a490`)
`src/lib/converters.ts` exporteert `afspraakNaarFirestore`, `ankerUitFirestore` e.a.; toelichtende Firestore-teksten in `src/lib/actielijst.ts:13-27`, `src/lib/bouwfase.ts:30`, `src/lib/betrokkenen.ts:6`. De functies zijn nog in gebruik, maar de naamgeving verwijst naar een datalaag die niet meer bestaat.
*Reparatie:* hernoemen naar neutrale termen en de comments bijwerken.

**A-18 — Veertien `.fuse_hidden*`-bestanden in `src/`, waarvan één in git** — ✅ **GEREPAREERD**
`src/lib/.fuse_hidden000000480000000d`, twaalf in `src/routes/`, en `src/styles/.fuse_hidden0000001000000001` — die laatste is getrackt. Samen ruim 300 kB dode kopieën van oude broncode die nog naar het verwijderde `@/lib/projecten` verwijzen. `.gitignore` dekt het patroon inmiddels wél, maar het getrackte bestand blijft.
*Reparatie:* alle veertien verwijderen en het getrackte bestand uit git halen. **Verwijderen van projectbestanden vereist expliciete goedkeuring — zie "vereist besluit".**

**A-19 — `.gitignore` dekt lokale backupbestanden niet** — ✅ **GEREPAREERD** (`aa3e28b`)
`*.woningdossier` ontbrak. Een gebruiker die een backup in de projectmap zet, commit hem mee.
*Reparatie (doorgevoerd):* `*.woningdossier` toegevoegd met uitzondering voor `tests/fixtures/` en `test/fixtures/backups/`. Beide kanten getest met `git check-ignore`: de golden fixture blijft getrackt, een losse backup wordt genegeerd.

**A-20 — Twee `console.error`-aanroepen in `src/`** — ⚠️ **DEELS** (`8d80167`): VaultContext opgeruimd, main.tsx bewust behouden als laatste vangnet bij opstartfouten
`src/context/VaultContext.tsx:87`, `src/main.tsx:21`. Beide zijn legitieme foutafhandeling, maar B9 vraagt een schone `src/`.
*Reparatie:* vervangen door de bestaande foutafhandeling (`OpstartFout`) of expliciet toestaan in de regel.

**A-21 — PROJECT.md en STATE.md geven een te rooskleurig beeld**
Beide beschrijven de fasen als afgerond terwijl B3, B4, B6 en B8 aantoonbaar onvolledig zijn.
*Reparatie:* bijwerken met de werkelijke stand uit dit rapport.

---

## Vereist besluit

Deze punten volgen niet eenduidig uit de specificatie, of overschrijden de grens van ~200 regels / meerdere modules die de opdracht stelt. Ze zijn bewust **niet** gerepareerd.

**V-1 — Versleuteling at rest in IndexedDB (A-01).**
ADR-0021 eist het, de implementatie doet het niet. Het verschil is architectonisch: per-record encryptie maakt Dexie-indexen op inhoud onmogelijk (je kunt niet meer op `status` of `categorie` queryen zonder alles te ontsleutelen), terwijl `db.ts:79-97` juist zestien zulke indexen definieert en de routes erop bouwen. Alternatieven: (a) alleen gevoelige velden versleutelen en indexvelden plat laten, (b) alles versleutelen en indexering in geheugen doen, (c) ADR-0021 aanpassen en expliciet vastleggen dat IndexedDB plat is omdat OPFS+backup de gevoelige laag vormen. Dit is een keuze tussen beveiliging en bruikbaarheid die de producteigenaar moet maken.

**V-2 — Aansluiten van de vijf onbereikbare modules (A-06).**
Energie, MJOP, P1, inbox-delta en woningpaspoort vragen elk een eigen route, navigatie-ingang en UI. Dat is ruim meer dan 200 regels per module en raakt navigatie, routing en het datamodel tegelijk. Vraag: worden deze in deze ronde aangesloten, of expliciet als "fase 2" geparkeerd?

**V-3 — `bron` op elk datapunt (A-10).**
Toevoegen raakt `src/types/model.ts`, alle negentien Dexie-tabellen, elke schrijfroute en de bestaande golden fixture (die dan een migratie nodig heeft — die er niet is, zie A-03). Volgorde-afhankelijk van V-1 en A-03.

**V-4 — Verwijderen van de veertien `.fuse_hidden*`-bestanden (A-18).**
CLAUDE.md §6 en de veiligheidsregels vereisen expliciete goedkeuring van Seth voordat projectbestanden verwijderd worden. Ik heb ze laten staan en vraag toestemming.

**V-5 — De volledige backup-hersteltest (B4 a–f).**
Niet uitvoerbaar zolang A-02 en A-03 openstaan: bijlagen gaan niet mee en er is geen migratieketen, dus stap b, d en e kunnen per definitie niet slagen zoals gespecificeerd. Uit te voeren zodra die twee gerepareerd zijn.

**V-6 — Hoe `'unsafe-inline'` uit de CSP verdwijnt (A-04).**
De directive wordt door precies drie plekken vereist (zie A-04). Twee daarvan zijn risicoloos op te ruimen; de derde is de gestapelde voortgangsbalk, die continue breedtes per segment zet. Drie opties:
- **(a) Klassenladder.** `Voortgangsbalk.tsx` rondt breedtes af naar discrete stappen (bijv. per 1%) met vooraf gegenereerde CSS-klassen. Volledig `style-src 'self'`, maar bij een gestapelde balk stapelen de afrondingen zich op — de balk sluit niet meer exact op 100% en dat is zichtbaar.
- **(b) Splitsen in CSP3-directives.** `style-src-elem 'self'` (blokkeert geïnjecteerde `<style>`-blokken, de gevaarlijke vector) plus `style-src-attr 'unsafe-inline'` (alleen attributen). Reële verscherping, maar het woord `unsafe-inline` blijft staan, dus B1.5 blijft formeel GEFAALD. Bovendien vallen browsers zonder CSP3-ondersteuning terug op `style-src`, waardoor de balk daar breekt.
- **(c) Specificatie aanpassen.** Vastleggen dat `style-src 'unsafe-inline'` aanvaard wordt zolang `script-src 'self'` en `connect-src 'none'` staan, met motivering in een ADR.
Mijn advies is (a) als de afrondingsafwijking acceptabel is, anders (c). Dit is een productkeuze over zichtbaar gedrag en hoort niet bij de auditor.

---

## Genomen besluiten

**Alle 21 bevindingen zijn afgewerkt op één na.** Zie de commit-tabel hieronder.

**A-01 (versleuteling at rest) is opgelost, anders dan eerst geadviseerd.** Het advies was
dit apart te doen omdat het alle routes zou raken. Bij uitwerking bleek de datalaag volledig
uniform — alleen `.where("projectId")`, `.get`, `.put` en `.delete`, met filters die al in het
geheugen gebeurden. Daardoor kon het in één opslaglaag plus een sleutelregister, zonder één
routewijziging.

**A-04 (CSP) is opgelost, anders dan eerst geadviseerd.** Het leek te kiezen tussen een
zichtbare afrondingsfout en een risicovolle herschrijving. De uitweg was een derde optie: de
balken tekenen met een SVG en `<rect>`-presentatieattributen. `width` op een rect is een
XML-attribuut en valt buiten de CSP, dus de proporties blijven exact én `unsafe-inline` kon
weg.

**B4.6 (streaming zip) blijft bewust open.** `fflate` biedt een streaming-API, maar het
archief wordt hoe dan ook in één keer weggeschreven en direct teruggelezen ter controle
(A-07). Streaming zou het geheugengebruik verlagen voor dossiers van honderden megabytes,
maar de terugleescontrole — die aantoonbaar dataverlies voorkomt — zou dan complexer worden.
Voor een huishoudensdossier is dat een slechte ruil. Herzien zodra bijlagen in de honderden
megabytes lopen.

---

## Stand van het werk

- **Fase A** — afgerond. 284 getrackte bestanden buiten `brink-ui/`. `npm ci`, `npm run verify` en `npm run build` groen.
- **Fase B** — afgerond op de hoofdpunten; de punten in A-15 zijn niet afgetoetst.
- **Fase C** — dit document.
- **Fase D** — **20 van de 21 bevindingen gerepareerd**, elk met test en waar mogelijk een negatief bewezen gate. B4.6 blijft bewust open.
- **Fase E** — `npm run verify` groen (686 tests in 42 bestanden), `npm audit` nul kwetsbaarheden, working tree schoon, alles op `main` en gepusht.

### Commits op deze branch

| Commit | Bevinding | Wat |
|---|---|---|
| `5d484bf` | — | baseline: het bouwwerk zoals aangetroffen |
| `39643b0` | A-14 | verify-crypto toetst nu de echte broncode |
| `aa3e28b` | A-19 | .gitignore dekt lokale backups |
| `e0d492c` | — | auditrapport + eerlijke STATE.md |
| `213a65d` | — | merge van de auditbranch naar main |
| `458271b` | A-02, A-03, A-07 | bijlagen in de backup, migratieketen, terugleescontrole |
| `8d80167` | A-11, A-12, A-20 | opslagpersistentie, energie-disclaimer, console weg |
| `82d9cb9` | **A-01** | versleuteling at rest voor alle woningdata |
| `8f3d489` | **A-05** | documenten versleuteld in chunks van 1 MiB |
| `fd97399` | **A-08** | roulerend backupschema, bewaarde map, permissiecontrole |
| `867a0a8` | **A-11** | paniekknop |
| `42b3e69` | A-18 | veertien .fuse_hidden-restanten verwijderd |
| `f23a490` | **A-17** | Firebase en Firestore volledig uit de repo, mapopruiming |
| `833f902` | **A-06, A-13** | vijf modules aangesloten, mobiele modus |
| `0048f56` | **A-09** | signaalversie, status, snooze en invoerhash |
| `925aae7` | **A-10** | herkomst per veld met grendel op handmatige invoer |
| `6e2d1db` | **A-04** | unsafe-inline uit de CSP |
| `9aaab3e` | **A-15** | hexkleuren, ongebruikte dependency, financiële drieslag |

**Hervatten:** alles wat de vertrouwelijkheid en herstelbaarheid van data raakt, is nu af. Wat rest is ontbrekende functionaliteit: **A-06** (vijf modules aansluiten), **A-09** (signaalstatus en snooze), **A-10** (`bron` op elk datapunt) en **A-13** (mobiele modus). A-06 en A-10 zijn elk ruim boven de 200-regelgrens. Daarnaast opruimwerk: A-04, A-15, A-16, A-17, A-18.
