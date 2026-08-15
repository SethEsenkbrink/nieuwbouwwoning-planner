# ADR-0022 — Backup- en herstelformaat (.woningdossier)

- **Status:** Geaccepteerd
- **Datum:** 2026-08-15
- **Beslissers:** Seth (producteigenaar), Assistent
- **Raakt:** `src/lib/backup/`, `scripts/verify-backup.mjs`, `tests/fixtures/`, `Projectinstellingen.tsx`, `Inloggen.tsx`

---

## Context

Woningdossier slaat alle gegevens lokaal op in de browser via IndexedDB (Dexie). Omdat browsers opslag kunnen wissen bij schijfruimtegebrek of browser-resets, is een robuust, betrouwbaar en versleuteld export-/importmechanisme van levensbelang.
De backup moet bovendien overgedragen kunnen worden bij woningverkoop of hersteld worden op een nieuw apparaat, zonder dat een externe server of clouddienst betrokken is.

---

## Besluit

We definiëren het `.woningdossier` bestandsformaat als een streaming zip-archief (gemaakt en gelezen met `fflate`):

### 1. Bestandsstructuur van `.woningdossier`

```
.woningdossier (ZIP)
├── manifest.json       # Onversleuteld: formaatversie, app-versie, kluis-metadata, statistieken
├── data.enc            # Versleuteld onder DEK: 12-byte IV + AES-256-GCM ciphertext + 16-byte tag van alle Dexie-tabellen
├── files/
│   ├── index.enc       # Versleuteld onder DEK: index van gekoppelde documenten en bijlagen
│   └── <uuid>.enc      # Versleutelde binaire documenten
└── CHECKSUMS           # Onversleuteld: SHA-256 hashes van alle entries ter integriteitscontrole vóór ontsleuteling
```

### 2. Beveiliging en Integriteit
- **Geen plaintext data:** Alle gevoelige woningdata en documenten bevinden zich in de met AES-256-GCM versleutelde bestanden `data.enc` en `files/*.enc`.
- **Zelfvoorzienend kluisherstel:** `manifest.json` bevat uitsluitend de publieke kluisparameters (`saltA`, `ivA`, `wrappedDekA`, `saltC`, `ivC`, `wrappedDekC`). Een gebruiker kan een backup dus altijd openen met de oorspronkelijke wachtwoordzin óf de 128-bit herstelcode.
- **Integriteitscontrole:** Vóórdat er ook maar één decryptie-poging plaatsvindt, controleert de importeur het `CHECKSUMS` bestand met SHA-256 hashes van alle zip-entries.

### 3. Golden Fixture en Geautomatiseerde Verificatie
- Er is een vaste golden fixture `tests/fixtures/golden-v1.woningdossier` aanwezig.
- `scripts/verify-backup.mjs` test vóór elke commit (`npm run verify`) dat:
  1. De golden fixture correct kan worden uitgepakt;
  2. Alle checksums kloppen;
  3. Zowel KEK-A (wachtwoord) als KEK-C (herstelcode) de DEK correct ontsleutelen;
  4. Datamanipulatie of onjuiste wachtwoorden betrouwbaar worden afgewezen.

---

## Gevolgen

### Positief
- **Draagbaarheid:** De gebruiker heeft 100% eigenaarschap over een enkel, compact bestand dat overal lokaal kan worden opgeslagen (USB-stick, eigen NAS, schijf).
- **Herstelbaar:** Een nieuw apparaat of browser kan direct starten vanaf een `.woningdossier` bestand.
- **Geen datalekken:** Zelfs als het backupbestand in verkeerde handen valt, is het beschermd door AES-256-GCM en Argon2id.
