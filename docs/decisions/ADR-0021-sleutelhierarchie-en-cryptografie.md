# ADR-0021 — Sleutelhiërarchie en lokale cryptografie

- **Status:** Geaccepteerd
- **Datum:** 2026-08-15
- **Beslissers:** Seth (producteigenaar), Assistent
- **Raakt:** `src/crypto/`, `src/context/VaultContext.tsx`, `src/db/db.ts`, `scripts/verify-crypto.mjs`

---

## Context

Woningdossier is 100% lokaal (ADR-0020) en zero-network. Alle data at rest moet cryptografisch versleuteld zijn.
De gebruiker moet de kluis kunnen ontgrendelen met een gekozen wachtwoordzin én moet altijd toegang kunnen herstellen via een 128-bit herstelcode wanneer de wachtwoordzin verloren is gegaan.

Wachtwoordhashes moeten bestand zijn tegen brute-force GPU-aanvallen en mogen de browser UI-thread niet blokkeren tijdens afleiding.

---

## Besluit

We implementeren een drielaags cryptografische sleutelhiërarchie:

### 1. Data Encryption Key (DEK)
- **Algoritme:** AES-256-GCM.
- **Eigenschappen:** De DEK is een `CryptoKey` met `extractable: false` in het browsergeheugen (RAM).
- **Levensduur:** De DEK bestaat uitsluitend in het geheugen tijdens een ontgrendelde sessie. De raw key bytes worden nooit weggeschreven naar schijf, localStorage, IndexedDB of OPFS.
- **Auto-lock:** Na 15 minuten inactiviteit of bij tabbladwissel / minimaliseren (`visibilitychange === "hidden"`) wordt de DEK gewist uit het geheugen (`vergrendel()`).

### 2. Key Encryption Keys (KEK's)

- **KEK-A (Wachtwoordzin):**
  - Afgeleid via **Argon2id** ($m=65536\text{ KiB} = 64\text{ MiB}, t=3, p=4, \text{hashLength}=32$) met een cryptografisch zout van 16 bytes.
  - Draait in een dedicated **Web Worker** (`src/crypto/argon2.worker.ts`) zodat de UI-thread responsief blijft.
  - Wordt gebruikt om de DEK te wrappen/unwrappen met AES-256-GCM onder een unieke 12-byte IV.

- **KEK-C (128-bit Herstelcode):**
  - 128-bit cryptografische willekeurige bytes, gecodeerd in 26 karakters Crockford Base32 (`XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-X`).
  - Afgeleid via **HKDF-SHA-256** met een 16-byte zout en context-string `"woningdossier-kek-c-v1"`.
  - Wordt gebruikt als fallback ontgrendelsleutel voor de DEK.

### 3. Kluis-metadata (`vault_meta` in IndexedDB)
In IndexedDB wordt uitsluitend de publieke metadata opgeslagen:
- `saltA`, `ivA`, `wrappedDekA` (base64)
- `saltC`, `ivC`, `wrappedDekC` (base64)
- `argon2Params` (`{ m: 65536, t: 3, p: 4 }`)
- `recoveryCodeHint` (gemaskeerde hint)

---

## Gevolgen

### Positief
- **Zero-knowledge:** Niemand behalve de houder van de wachtwoordzin of de herstelcode kan de kluis ontsleutelen.
- **Hardware-beveiliging:** De DEK kan niet via JavaScript-inspectie uit het `CryptoKey`-object geëxtraheerd worden (`extractable: false`).
- **Niet-blokkerende UI:** Argon2id draait in een worker thread.
- **Testbaarheid:** Standalone testbaar in Vitest en via `scripts/verify-crypto.mjs` in Node.js.

### Aandachtspunten
- **Verloren sleutels zijn onherstelbaar:** Als een gebruiker zowel de wachtwoordzin als de 128-bit herstelcode verliest, is de data definitief verloren. De app dwingt daarom bij registratie af dat de herstelcode wordt opgeslagen.
