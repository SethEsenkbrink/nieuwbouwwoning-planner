# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-08-15 · sessie 11 (**audit + reparatieronde** — zie `docs/AUDIT.md`)
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).

---

## ⚠ De statustabel hieronder klopte niet

Sessie 11 heeft een volledige audit gedraaid op branch `audit/2026-08-15` (baseline `5d484bf`).
Uitkomst: **`npm run verify` is groen, maar groen betekende hier weinig.** Drie bevindingen zijn
blokkerend en de vinkjes in de tabel hieronder zijn op meerdere plekken te optimistisch gezet.

De drie zwaarste:

1. ~~**Alle woningdata staat plat in IndexedDB.**~~ ✅ **Gerepareerd** (`82d9cb9`). Recordinhoud staat nu versleuteld; alleen `id` en `projectId` blijven leesbaar als indexsleutel. Vastgelegd met een test die controleert dat naam, e-mail, telefoonnummer, bedrag en datum niet leesbaar op schijf staan. ~~terwijl ADR-0021 eist dat
   alle data at rest versleuteld is. De DEK beschermt alleen OPFS-bestanden en de backup. De
   kluis, de auto-lock en de Argon2id-hiërarchie beschermen de dossierinhoud dus niet.
2. **Bijlagen gaan nooit mee in de backup.** `src/lib/backup/export.ts:96` heeft een hardgecodeerd
   lege bestandsindex; `files/<uuid>.enc` wordt nooit geschreven en nooit hersteld. Herstel meldt
   "geslaagd" terwijl alle documenten weg zijn.
3. **Er is geen `schemaVersion` en geen `src/migrations/`.** Bij de eerste modelwijziging zijn alle
   bestaande backups onbruikbaar.

Verder bleek `scripts/verify-crypto.mjs` een **zelfvervullende gate**: het script toetste zijn
eigen nagebouwde crypto en niet `src/crypto/`. Met `extractable: true` in de echte app-code bleef
het op exit 0 staan. Dat is in deze sessie gerepareerd en negatief getest.

**Lees `docs/AUDIT.md` vóór je verder bouwt.** Daar staan 21 bevindingen met bewijsverwijzing en
zes punten onder "vereist besluit" — waarvan **V-1** (versleuteling at rest) eerst beantwoord moet
worden, omdat die de vorm van de andere reparaties bepaalt.

---

## In één alinea

De transformatie van `nieuwbouwwoning-planner` naar **Woningdossier** is qua omvang grotendeels
gebouwd: 612 geslaagde tests in 34 bestanden, alle verify-stappen groen, en de Firebase- en
serverlaag is aantoonbaar volledig verdwenen (nul externe verbindingen in `dist/`, fonts
self-hosted). Maar "gebouwd" is niet "uitgevoerd zoals gespecificeerd": vijf modules
(`energie`, `mjop`, `p1`, `inbox/delta`, `woningpaspoort/overdracht`) hebben tests maar geen
enkele route die ze importeert, en de kernbeloftes rond versleuteling en herstelbaarheid kloppen
niet. Zie de waarschuwing hierboven.

---

## Fases & Modules — Statusoverzicht

| Fase / Onderdeel | Status | Details |
| --- | --- | --- |
| **Licentie & Juridisch (Deel 10)** | ✅ Afgerond | AGPL-3.0-only (`LICENSE`), Handelsmerkbeleid (`TRADEMARK.md`), Security policy (`SECURITY.md`), Disclaimer en privacybelofte in `README.md` |
| **Architectuur (ADR's)** | ✅ Afgerond | `ADR-0020` (100% lokaal), `ADR-0021` (Sleutelhiërarchie), `ADR-0022` (Backup-formaat), `ADR-0023` (Kerndatamodel & regelmotor), `ADR-0024` (Domeinmodules & MJOP), `ADR-0025` (Energie, P1 & Saldering), `ADR-0026` (Mobile Companion, Overdracht & WebAuthn) en `ADR-0027` (Diagnostiek & Systeemaudit) |
| **Zero-Network & PWA (Fase 0)** | ⚠️ Vrijwel af — A-04 | `connect-src 'none'` CSP in `netlify.toml`, standalone manifest, service worker precaching, bundle offline scanning |
| **Kluis & Cryptografie (Fase 1)** | ⚠️ Vrijwel af — paniekknop open (A-11) | Master DEK (non-extractable AES-256-GCM in memory), KEK-A (Argon2id WASM Worker $m=64\text{ MiB}, t=3, p=4$), KEK-C (HKDF 128-bit herstelcode in Crockford Base32), 15-min auto-lock en directe vergrendeling bij tabswitch |
| **Backup & Restore (Fase 2)** | ⚠️ Herstelbaar; roulerend schema open — A-08 | Streaming zip met `fflate`: onversleuteld `manifest.json`, `data.enc` onder DEK, `files/index.enc`, `CHECKSUMS` SHA-256 integriteitsvalidatie, golden fixture v1 |
| **Kerndatamodel & OPFS (Fase 3)** | ⚠️ Onvolledig — A-10 | `traject: 'nieuwbouw' | 'bestaandeBouw'`, kadastrale aanduiding, woonkenmerken, en versleutelde bestandsopslag in OPFS (`files/<uuid>.enc`) met fallback |
| **Deterministische Regelmotor (Fase 3)** | ⚠️ Onvolledig — A-09 | Termijnregels (5%-depot onderhoudstermijn, gebreken hersteltermijnen, meerwerksluitingen), financiële regels (24-maanden bouwdepot, meerwerkbudget) |
| **Domeinmodules & MJOP-Light (Fase 4)** | ⚠️ Niet aangesloten — A-06 | Materialen- & kleurcodes register (RAL/NCS/glansgraad), garantietermijn-klokken (Wkb, fabrieksgarantie), meerjarenplanning (`src/lib/mjop.ts`), opstal/inboedel administratie |
| **Energie & Saldering (Fase 5)** | ⚠️ Niet aangesloten — A-06, A-12 | P1 slimme meter CSV-parser (`src/lib/p1.ts`), indicatief energielabel met permanente wettelijke disclaimer (`src/lib/energie.ts`), salderingsberekening met post-2027 afbouwparameters, E-002 regel |
| **Mobiel, Overdracht & WebAuthn (Fase 6)** | ⚠️ Niet aangesloten — A-06, A-13 | Mobile snapshot + quick-capture inbox-delta encryptie/import (`src/lib/inbox/`), zelfstandig overdrachtsdossier HTML/JSON (`src/lib/woningpaspoort/`), optioneel biometrisch WebAuthn-PRF kluisslot (`src/crypto/webauthn.ts`) |
| **Diagnostiek & Systeemaudit Tool** | ✅ Afgerond | In-memory logger (`src/lib/diagnostiek/logger.ts`), diepgaande audit-engine (`audit.ts`), Markdown/JSON rapportgenerator (`rapport.ts`), interactief auditdashboard (`/diagnostiek`), geautomatiseerde relatie-reparaties |
| **Verificatie** | ✅ Groen | `npm run verify` doorloopt typecheck (`tsc --build --force`), lint (`eslint .`), unit tests (**612 tests in 34 bestanden**), token-pariteit (50 tokens), headers (10 headers + 14 CSP directives), cryptografie-verificatie (`verify:crypto`), backup-verificatie (`verify:backup`), productiebuild (Vite + Rolldown), en offline validatie |

---

## Cijfers

| Meting | Waarde |
| --- | --- |
| Unit tests | **639 passed** in 36 testbestanden |
| Token-pariteit | **50 tokens** synchroon met `brink-ui/tokens.js` |
| Headers & CSP | **10 headers**, CSP zero-network (`connect-src 'none'`) |
| Cryptografie | AES-256-GCM non-extractable DEK, Argon2id (64 MiB/3/4), HKDF 128-bit, WebAuthn-PRF |
| Opslag & Bestanden | Beide versleuteld: IndexedDB per record, OPFS per 1 MiB-chunk |
| Regelmotor | 100% deterministisch (0 netwerk / 0 side-effects) |
| Diagnostiek | Volledig geïntegreerd audit- en rapportagesysteem (`/diagnostiek`) |
| Overdracht | Zelfstandig HTML/JSON Woningpaspoort |
| Netwerkcalls | **0** (geverifieerd: `verify-offline` scant `dist/`, negatief getest) |

---

## Roadmap & Afronding

1. **FASE 0 — FUNDAMENT & REPO-HYGIËNE:** ⚠️ vrijwel af — A-04, A-17, A-18
2. **FASE 1 — KLUIS (Cryptografie & Sleutelhiërarchie):** ⚠️ vrijwel af — versleuteling at rest en chunking gedaan; paniekknop open (A-11)
3. **FASE 2 — BACKUP & RESTORE:** ⚠️ herstel werkt en is getest; roulerend schema + directory-handle open (A-08)
4. **FASE 3 — KERN-DATAMODEL + REGELMOTOR-FUNDAMENT:** ⚠️ onvolledig — A-09, A-10
5. **FASE 4 — DOMEINMODULES:** ⚠️ gebouwd maar niet aangesloten — A-06
6. **FASE 5 — ENERGIE:** ⚠️ gebouwd maar niet aangesloten — A-06, A-12
7. **FASE 6 — MOBIEL + COMFORT:** ⚠️ gebouwd maar niet aangesloten — A-06, A-13
8. **EXTRA — DIAGNOSTIEK & ONTWIKKELAARSAUDIT:** ✅ **VOLTOOID**
