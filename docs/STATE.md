# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-08-21 · sessie 13 (productiebugs, publieke pagina's, startwizard)
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).

---

## Stand: de app werkte in productie helemaal niet, en dat is verholpen

Sessie 13 begon met twee screenshots van **nieuwbouwplanner.netlify.app**. Daar
stond de kern van de dag in: `script-src 'self'` verbood Chrome om
`WebAssembly.compile()` te draaien, dus de Argon2id-sleutelafleiding kwam nooit
op gang en **een kluis aanmaken of ontgrendelen was onmogelijk**. Alles
daarachter — het hele dossier — was daarmee onbereikbaar.

Vier bugs verholpen, alle vier met een gate of test die ze in het vervolg
afvangt:

| # | Bug | Wat er niet werkte | Gate erop |
| --- | --- | --- | --- |
| 1 | CSP blokkeerde WebAssembly | Kluis aanmaken én ontgrendelen, in productie | `scripts/headers.test.mjs` (8 tests) |
| 2 | Manifest wees naar niet-bestaande iconen | Installeren gaf een app zonder icoon; console vol fouten | `scripts/verify-pwa.mjs` + 9 tests |
| 3 | `traject`, `bouwdepotBedrag` en `hypotheek` werden nooit weggeschreven | Depotbalk zonder schaal, 24-maandenregel kon niet afgaan, overdrachtsdossier zonder traject | 13 tests in `converters.test.ts` |
| 4 | **De herstelcode werd nooit getoond** | Iemand kreeg een versleuteld dossier waarvan de enige noodingang één render eerder was weggegooid | `lib/registratie.ts` + 5 tests |

Bug 4 is de duurste die deze app kan maken: er is geen server die een
wachtwoord kan resetten, dus zonder die code is een vergeten wachtwoordzin
definitief.

**Nieuw sinds sessie 12:**

- **Publieke pagina's.** `/` toont nu een landingspagina, het ontgrendelscherm
  of het dashboard, afhankelijk van wat er op dít apparaat staat. Daarnaast
  `/voorwaarden` en `/privacy`, met de aanbiedergegevens op één plek in
  `src/data/aanbieder.ts`.
- **De startwizard** (`/start`, ADR-0028). Eén vraag — waar sta je nu — bepaalt
  welke stappen er zijn en welke verplicht. Het financiële beeld zit er
  volledig in, inclusief de hypotheek die tot vandaag niet eens op te slaan was.
- **`verify:pwa`** als achtste verify-script, na `verify:offline` in de keten.

`npm run verify` groen: **830 tests in 49 bestanden**, gedraaid op Seths eigen
machine (Node 24.12.0) — dus inclusief lint, build en de echte testsuite.

### Wat er open staat

1. `src/routes/ProjectWizard.tsx` is dood; `/project/nieuw` stuurt door naar
   `/start`. Verwijderen vraagt toestemming (CLAUDE.md §6).
2. `public/manifest.webmanifest` wordt door `vite-plugin-pwa` overschreven
   zonder melding — wat je daar wijzigt komt nooit in `dist/`. `verify:pwa`
   waarschuwt, maar loopt er niet rood op.
3. `kvk` en `vestigingsadres` in `src/data/aanbieder.ts` zijn leeg; de
   juridische pagina's laten die regels dan weg.
4. `index.html` staat op `noindex, nofollow` — een keuze die met een publieke
   landingspagina heroverwogen mag worden.

---

## Uit sessie 12: de audit is afgewerkt

Sessie 11 draaide een volledige audit (`docs/AUDIT.md`, 21 bevindingen). Sessie 12 heeft ze
afgewerkt op één na. Wat er sindsdien veranderd is:

- **Versleuteling at rest** voor alle woningdata, met een test die controleert dat er geen
  leesbare tekst op schijf staat.
- **Backup** neemt bijlagen mee, heeft een migratieketen, leest zichzelf terug, en draait een
  roulerend schema van 23 slots met bewaarde map en permissiecontrole bij elke start.
- **Documenten** worden per 1 MiB versleuteld met een verse IV per chunk.
- **Signalen** kennen versie, status, snooze en een invoerhash; maximaal drie zichtbaar, met
  een schakelaar per categorie.
- **Herkomst per veld** beschermt handmatige invoer tegen herberekening.
- **Vijf modules** (energie, mjop, p1, inbox-delta, woningpaspoort) zijn aangesloten op routes.
- **Mobiele modus** is zichtbaar en beperkt bewerken tot quick-capture.
- **Firebase en Firestore** zijn volledig weg, met een eslint-guard tegen terugkeer.
- **CSP** is vrij van `unsafe-inline`.

Enige bewuste uitzondering: **B4.6** (streaming zip). Zie "Genomen besluiten" in `AUDIT.md`.

`npm run verify` was toen groen met 686 tests in 42 bestanden; `npm audit` meldde nul kwetsbaarheden.

---

## Fases & Modules — Statusoverzicht

| Fase / Onderdeel | Status | Details |
| --- | --- | --- |
| **Licentie & Juridisch (Deel 10)** | ✅ Afgerond | AGPL-3.0-only (`LICENSE`), Handelsmerkbeleid (`TRADEMARK.md`), Security policy (`SECURITY.md`), Disclaimer en privacybelofte in `README.md` |
| **Architectuur (ADR's)** | ✅ Afgerond | `ADR-0020` (100% lokaal), `ADR-0021` (Sleutelhiërarchie), `ADR-0022` (Backup-formaat), `ADR-0023` (Kerndatamodel & regelmotor), `ADR-0024` (Domeinmodules & MJOP), `ADR-0025` (Energie, P1 & Saldering), `ADR-0026` (Mobile Companion, Overdracht & WebAuthn) en `ADR-0027` (Diagnostiek & Systeemaudit) |
| **Zero-Network & PWA (Fase 0)** | ✅ Afgerond | `connect-src 'none'` CSP in `netlify.toml`, standalone manifest, service worker precaching, bundle offline scanning |
| **Kluis & Cryptografie (Fase 1)** | ✅ Afgerond | Versleuteling at rest, chunked documenten, auto-lock, persistentie en paniekknop | Master DEK (non-extractable AES-256-GCM in memory), KEK-A (Argon2id WASM Worker $m=64\text{ MiB}, t=3, p=4$), KEK-C (HKDF 128-bit herstelcode in Crockford Base32), 15-min auto-lock en directe vergrendeling bij tabswitch |
| **Backup & Restore (Fase 2)** | ✅ Afgerond | Bijlagen, migratieketen, terugleescontrole, roulerend schema van 23 slots, bewaarde map met permissiecontrole | Streaming zip met `fflate`: onversleuteld `manifest.json`, `data.enc` onder DEK, `files/index.enc`, `CHECKSUMS` SHA-256 integriteitsvalidatie, golden fixture v1 |
| **Kerndatamodel & OPFS (Fase 3)** | ✅ Afgerond | `traject: 'nieuwbouw' | 'bestaandeBouw'`, kadastrale aanduiding, woonkenmerken, en versleutelde bestandsopslag in OPFS (`files/<uuid>.enc`) met fallback |
| **Deterministische Regelmotor (Fase 3)** | ✅ Afgerond | Termijnregels (5%-depot onderhoudstermijn, gebreken hersteltermijnen, meerwerksluitingen), financiële regels (24-maanden bouwdepot, meerwerkbudget) |
| **Domeinmodules & MJOP-Light (Fase 4)** | ✅ Afgerond | Materialen- & kleurcodes register (RAL/NCS/glansgraad), garantietermijn-klokken (Wkb, fabrieksgarantie), meerjarenplanning (`src/lib/mjop.ts`), opstal/inboedel administratie |
| **Energie & Saldering (Fase 5)** | ✅ Afgerond | P1 slimme meter CSV-parser (`src/lib/p1.ts`), indicatief energielabel met permanente wettelijke disclaimer (`src/lib/energie.ts`), salderingsberekening met post-2027 afbouwparameters, E-002 regel |
| **Mobiel, Overdracht & WebAuthn (Fase 6)** | ✅ Afgerond | Mobile snapshot + quick-capture inbox-delta encryptie/import (`src/lib/inbox/`), zelfstandig overdrachtsdossier HTML/JSON (`src/lib/woningpaspoort/`), optioneel biometrisch WebAuthn-PRF kluisslot (`src/crypto/webauthn.ts`) |
| **Diagnostiek & Systeemaudit Tool** | ✅ Afgerond | In-memory logger (`src/lib/diagnostiek/logger.ts`), diepgaande audit-engine (`audit.ts`), Markdown/JSON rapportgenerator (`rapport.ts`), interactief auditdashboard (`/diagnostiek`), geautomatiseerde relatie-reparaties |
| **Publieke pagina's & juridisch** | ✅ Afgerond | Landingspagina op `/`, `/voorwaarden` en `/privacy`; aanbiedergegevens op één plek (`src/data/aanbieder.ts`) |
| **Startwizard (ADR-0028)** | ✅ Afgerond | Instapmoment stuurt het stappenplan; volledig financieel beeld inclusief hypotheek; pure regels in `src/lib/wizard/` met 115 tests |
| **Verificatie** | ✅ Groen | `npm run verify` doorloopt typecheck (`tsc --build --force`), lint (`eslint .`), unit tests (**686 tests in 42 bestanden**), token-pariteit (50 tokens), headers (10 headers + 14 CSP directives), cryptografie-verificatie (`verify:crypto`), backup-verificatie (`verify:backup`), productiebuild (Vite + Rolldown), offline validatie en PWA-manifestcontrole (`verify:pwa`) |

---

## Cijfers

| Meting | Waarde |
| --- | --- |
| Unit tests | **830 passed** in 49 testbestanden |
| Token-pariteit | **50 tokens** synchroon met `brink-ui/tokens.js` |
| Headers & CSP | **10 headers**, CSP zero-network (`connect-src 'none'`), `script-src 'self' 'wasm-unsafe-eval'` |
| Cryptografie | AES-256-GCM non-extractable DEK, Argon2id (64 MiB/3/4), HKDF 128-bit, WebAuthn-PRF |
| Opslag & Bestanden | Beide versleuteld: IndexedDB per record, OPFS per 1 MiB-chunk |
| Regelmotor | 100% deterministisch (0 netwerk / 0 side-effects) |
| Diagnostiek | Volledig geïntegreerd audit- en rapportagesysteem (`/diagnostiek`) |
| Overdracht | Zelfstandig HTML/JSON Woningpaspoort |
| Netwerkcalls | **0** (geverifieerd: `verify-offline` scant `dist/`, negatief getest) |

---

## Roadmap & Afronding

1. **FASE 0 — FUNDAMENT & REPO-HYGIËNE:** ✅ **VOLTOOID**
2. **FASE 1 — KLUIS (Cryptografie & Sleutelhiërarchie):** ✅ **VOLTOOID**
3. **FASE 2 — BACKUP & RESTORE:** ✅ **VOLTOOID**
4. **FASE 3 — KERN-DATAMODEL + REGELMOTOR-FUNDAMENT:** ✅ **VOLTOOID**
5. **FASE 4 — DOMEINMODULES:** ✅ **VOLTOOID**
6. **FASE 5 — ENERGIE:** ✅ **VOLTOOID**
7. **FASE 6 — MOBIEL + COMFORT:** ✅ **VOLTOOID**
8. **EXTRA — DIAGNOSTIEK & ONTWIKKELAARSAUDIT:** ✅ **VOLTOOID**
9. **EXTRA — PUBLIEKE PAGINA'S & STARTWIZARD:** ✅ **VOLTOOID** (sessie 13, ADR-0028)
