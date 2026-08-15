# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-08-15 · sessie 10 (Woningdossier — **Volledige Reeks & Diagnostiek-Audit Tool 100% Geverifieerd**)
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).

---

## In één alinea

De transformatie van `nieuwbouwwoning-planner` naar **Woningdossier** is in zijn geheel voltooid, inclusief een uitgebreid **Diagnostiek & Systeemaudit Systeem** (`/diagnostiek`).
Woningdossier is een 100% lokale, end-to-end versleutelde PWA voor het complete leven van een woning — nieuwbouw én bestaande bouw, van aankoop tot overdracht en het beheer daarna.
Het project telt **612 geslaagde unit tests in 34 bestanden** en alle 9 verificatiestappen in `npm run verify` zijn 100% groen.

---

## Fases & Modules — Statusoverzicht

| Fase / Onderdeel | Status | Details |
| --- | --- | --- |
| **Licentie & Juridisch (Deel 10)** | ✅ Afgerond | AGPL-3.0-only (`LICENSE`), Handelsmerkbeleid (`TRADEMARK.md`), Security policy (`SECURITY.md`), Disclaimer en privacybelofte in `README.md` |
| **Architectuur (ADR's)** | ✅ Afgerond | `ADR-0020` (100% lokaal), `ADR-0021` (Sleutelhiërarchie), `ADR-0022` (Backup-formaat), `ADR-0023` (Kerndatamodel & regelmotor), `ADR-0024` (Domeinmodules & MJOP), `ADR-0025` (Energie, P1 & Saldering), `ADR-0026` (Mobile Companion, Overdracht & WebAuthn) en `ADR-0027` (Diagnostiek & Systeemaudit) |
| **Zero-Network & PWA (Fase 0)** | ✅ Afgerond | `connect-src 'none'` CSP in `netlify.toml`, standalone manifest, service worker precaching, bundle offline scanning |
| **Kluis & Cryptografie (Fase 1)** | ✅ Afgerond | Master DEK (non-extractable AES-256-GCM in memory), KEK-A (Argon2id WASM Worker $m=64\text{ MiB}, t=3, p=4$), KEK-C (HKDF 128-bit herstelcode in Crockford Base32), 15-min auto-lock en directe vergrendeling bij tabswitch |
| **Backup & Restore (Fase 2)** | ✅ Afgerond | Streaming zip met `fflate`: onversleuteld `manifest.json`, `data.enc` onder DEK, `files/index.enc`, `CHECKSUMS` SHA-256 integriteitsvalidatie, golden fixture v1 |
| **Kerndatamodel & OPFS (Fase 3)** | ✅ Afgerond | `traject: 'nieuwbouw' | 'bestaandeBouw'`, kadastrale aanduiding, woonkenmerken, en versleutelde bestandsopslag in OPFS (`files/<uuid>.enc`) met fallback |
| **Deterministische Regelmotor (Fase 3)** | ✅ Afgerond | Termijnregels (5%-depot onderhoudstermijn, gebreken hersteltermijnen, meerwerksluitingen), financiële regels (24-maanden bouwdepot, meerwerkbudget) |
| **Domeinmodules & MJOP-Light (Fase 4)** | ✅ Afgerond | Materialen- & kleurcodes register (RAL/NCS/glansgraad), garantietermijn-klokken (Wkb, fabrieksgarantie), meerjarenplanning (`src/lib/mjop.ts`), opstal/inboedel administratie |
| **Energie & Saldering (Fase 5)** | ✅ Afgerond | P1 slimme meter CSV-parser (`src/lib/p1.ts`), indicatief energielabel met permanente wettelijke disclaimer (`src/lib/energie.ts`), salderingsberekening met post-2027 afbouwparameters, E-002 regel |
| **Mobiel, Overdracht & WebAuthn (Fase 6)** | ✅ Afgerond | Mobile snapshot + quick-capture inbox-delta encryptie/import (`src/lib/inbox/`), zelfstandig overdrachtsdossier HTML/JSON (`src/lib/woningpaspoort/`), optioneel biometrisch WebAuthn-PRF kluisslot (`src/crypto/webauthn.ts`) |
| **Diagnostiek & Systeemaudit Tool** | ✅ Afgerond | In-memory logger (`src/lib/diagnostiek/logger.ts`), diepgaande audit-engine (`audit.ts`), Markdown/JSON rapportgenerator (`rapport.ts`), interactief auditdashboard (`/diagnostiek`), geautomatiseerde relatie-reparaties |
| **Verificatie** | ✅ Groen | `npm run verify` doorloopt typecheck (`tsc --build --force`), lint (`eslint .`), unit tests (**612 tests in 34 bestanden**), token-pariteit (50 tokens), headers (10 headers + 14 CSP directives), cryptografie-verificatie (`verify:crypto`), backup-verificatie (`verify:backup`), productiebuild (Vite + Rolldown), en offline validatie |

---

## Cijfers

| Meting | Waarde |
| --- | --- |
| Unit tests | **612 passed** in 34 testbestanden |
| Token-pariteit | **50 tokens** synchroon met `brink-ui/tokens.js` |
| Headers & CSP | **10 headers**, CSP zero-network (`connect-src 'none'`) |
| Cryptografie | AES-256-GCM non-extractable DEK, Argon2id (64 MiB/3/4), HKDF 128-bit, WebAuthn-PRF |
| Opslag & Bestanden | Dexie IndexedDB + OPFS versleuteld at rest |
| Regelmotor | 100% deterministisch (0 netwerk / 0 side-effects) |
| Diagnostiek | Volledig geïntegreerd audit- en rapportagesysteem (`/diagnostiek`) |
| Overdracht | Zelfstandig HTML/JSON Woningpaspoort |
| Netwerkcalls | **0** (Zero-network by design) |

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
