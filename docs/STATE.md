# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-08-16 · sessie 12 (**audit volledig afgewerkt** — zie `docs/AUDIT.md`)
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).

---

## Stand: de audit is afgewerkt

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

`npm run verify` groen: **686 tests in 42 bestanden**. `npm audit`: nul kwetsbaarheden.

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
| **Verificatie** | ✅ Groen | `npm run verify` doorloopt typecheck (`tsc --build --force`), lint (`eslint .`), unit tests (**686 tests in 42 bestanden**), token-pariteit (50 tokens), headers (10 headers + 14 CSP directives), cryptografie-verificatie (`verify:crypto`), backup-verificatie (`verify:backup`), productiebuild (Vite + Rolldown), en offline validatie |

---

## Cijfers

| Meting | Waarde |
| --- | --- |
| Unit tests | **686 passed** in 42 testbestanden |
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

1. **FASE 0 — FUNDAMENT & REPO-HYGIËNE:** ✅ **VOLTOOID**
2. **FASE 1 — KLUIS (Cryptografie & Sleutelhiërarchie):** ✅ **VOLTOOID**
3. **FASE 2 — BACKUP & RESTORE:** ✅ **VOLTOOID**
4. **FASE 3 — KERN-DATAMODEL + REGELMOTOR-FUNDAMENT:** ✅ **VOLTOOID**
5. **FASE 4 — DOMEINMODULES:** ✅ **VOLTOOID**
6. **FASE 5 — ENERGIE:** ✅ **VOLTOOID**
7. **FASE 6 — MOBIEL + COMFORT:** ✅ **VOLTOOID**
8. **EXTRA — DIAGNOSTIEK & ONTWIKKELAARSAUDIT:** ✅ **VOLTOOID**
