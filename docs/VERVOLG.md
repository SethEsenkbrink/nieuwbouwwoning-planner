# VERVOLG.md — waar we gebleven zijn en wat er nog moet

> **Doel van dit bestand:** de audit van 15 augustus 2026 en de reparatieronde die
> erop volgde, samengevat tot iets waarmee een volgende sessie direct verder kan.
> Plak de prompt onderaan in een nieuwe sessie.
>
> **Peildatum:** 2026-08-16 · **Branch:** `main` · **HEAD:** `959eb4a` · working tree schoon
> **Gates:** `npm run verify` groen — **652 tests in 38 bestanden**, build groen

---

## 1. Wat er gebeurd is

Een eerdere agent bouwde de app om van Firebase naar 100% lokaal. Die oplevering stond
**ongecommit** in de werkmap. Die is als baseline vastgelegd (`5d484bf`), daarna volledig
geauditeerd tegen de specificatie (fase A t/m C), en vervolgens gerepareerd (fase D).

Het volledige rapport staat in **`docs/AUDIT.md`**: een conformiteitstabel over B1 t/m B9
met bewijsverwijzing per punt, en 21 genummerde bevindingen ingedeeld naar ernst.

**De kern van wat de audit vond:** `npm run verify` was groen, en dat betekende weinig.
Drie bevindingen waren blokkerend, en `scripts/verify-crypto.mjs` bleek een *zelfvervullende
gate* — het script bouwde de crypto zelf na en toetste zijn eigen kopie, waardoor
`extractable: true` in de echte app-code gewoon op exit 0 bleef staan.

---

## 2. Wat er AF is (13 van 21 bevindingen)

Elke reparatie heeft een test die de fout in het vervolg afvangt.

| # | Bevinding | Commit | Wat er nu staat |
|---|---|---|---|
| **A-01** | Data stond plat in IndexedDB | `82d9cb9` | Elk record versleuteld met AES-256-GCM onder eigen verse IV. Alleen `id` en `projectId` leesbaar als indexsleutel |
| **A-02** | Bijlagen gingen nooit mee in de backup | `458271b` | Export leest OPFS uit, schrijft `files/<uuid>.enc`; import zet ze terug |
| **A-03** | Geen schemaVersie, geen migratieketen | `458271b` | `src/migrations/` met sluitendheidscontrole; import weigert een nieuwere versie |
| **A-05** | Documenten niet in chunks | `8f3d489` | Formaat `WDCHUNK1`, 1 MiB per blok, verse IV én eigen GCM-tag per chunk |
| **A-07** | Backup niet teruggelezen | `458271b` | `controleerArchief()` pakt het archief opnieuw uit en valideert checksums |
| **A-08** | Geen roulerend schema, geen bewaarde map | `fd97399` | 23 slots (7/4/12), map in IndexedDB, permissie herbevestigd bij elke start |
| **A-11** | Geen `persist()`, geen paniekknop | `8d80167`, `867a0a8` | Persistentie aangevraagd en getoond; paniekknop wist sleutel + OPFS + database |
| **A-12** | Energie-disclaimer onvolledig | `8d80167` | NTA 8800, BRL 9500 én EP-Online, vastgepind met tests |
| **A-14** | `verify-crypto` toetste zichzelf | `39643b0` | Leest nu `src/crypto/`; negatief getest op drie schendingen |
| **A-18** | 14 `.fuse_hidden`-restanten | `42b3e69` | Verwijderd na controle dat het geen originelen waren |
| **A-19** | `.gitignore` miste backups | `aa3e28b` | `*.woningdossier` genegeerd, fixtures uitgezonderd |
| **A-20** | `console.error` in `src/` | `8d80167` | Uit VaultContext; `main.tsx` bewust behouden als laatste vangnet |

**Fase 1 (kluis) en fase 2 (backup) staan daarmee op afgerond in `docs/STATE.md`** — voor het
eerst terecht, met bewijs.

### Nieuwe modules die hieruit ontstaan zijn

```
src/db/sleutelregister.ts     actieve DEK in een moduleclosure; gewist bij vergrendelen
src/db/kluisopslag.ts         versleutelde opslaglaag boven Dexie
src/migrations/index.ts       migratieketen voor het backupformaat
src/lib/backup/rotatie.ts     roulerend schema, pure logica
src/lib/backup/doel.ts        backupmap + permissie (File System Access API)
src/lib/backup/roulerend.ts   brengt schema, doel en export samen
src/lib/paniek.ts             alles lokaal wissen
```

### Twee dingen om te weten voor je verder bouwt

1. **`enc` is base64, geen `Uint8Array`.** Een `Uint8Array` overleeft `JSON.stringify` niet
   (hij wordt `{"0":12,...}`) en de backup serialiseert hele tabellen naar JSON. Met ruwe
   bytes kwam een hersteld record er corrupt uit. Verander dit niet terug.
2. **Schrijf nooit rechtstreeks via `db.<tabel>.put()`.** Gebruik `bewaar`/`haal`/
   `haalVanProject` uit `src/db/kluisopslag.ts`, anders staat de data weer plat op schijf.

---

## 3. Wat er NIET af is (8 bevindingen)

Geen van deze raakt de vertrouwelijkheid of herstelbaarheid van opgeslagen data. Het is
ontbrekende functionaliteit en opruimwerk.

### HOOG — ontbrekende functionaliteit

**A-06 — Vijf modules zijn gebouwd maar nergens aangesloten.**
`src/lib/energie.ts`, `mjop.ts`, `p1.ts`, `inbox/delta.ts` en `woningpaspoort/overdracht.ts`
hebben alle vijf tests die groen draaien, maar **geen enkele route importeert ze**. De
bijbehorende specificatiepunten zijn dus feitelijk niet uitgevoerd, terwijl de testsuite de
indruk wekt van wel. Vraagt per module een route, navigatie-ingang en UI. Ruim boven de
200-regelgrens; verdient een eigen ronde per module.

**A-09 — Signalen kennen geen status, snooze of invoerhash.**
`src/rules/types.ts` → `RegelResultaat` heeft geen `versie`, geen status
(`nieuw|geaccepteerd|genegeerd|gesnoozed`), geen `snoozeTot` en geen hash van de
invoerwaarden. Een weggeklikt signaal komt daardoor bij elke herberekening terug. Ook
ontbreekt de begrenzing op maximaal drie zichtbare signalen (`engine.ts` sorteert wel, maar
begrenst niet) en de schakelaar per categorie in de instellingen.

**A-10 — `bron` ontbreekt op datapunten.**
De enum `'ingevoerd' | 'afgeleid' | 'geïmporteerd' | 'voorstel'` bestaat niet in
`src/types/model.ts`. Daarmee ontbreekt ook de code die voorkomt dat een herberekening een
handmatig ingevoerde waarde overschrijft. Raakt het datamodel, alle schrijfroutes en de
golden fixture — die dan een migratiestap nodig heeft. **Gebruik de migratieketen die er nu
ligt.** Ruim boven de 200-regelgrens.

**A-13 — Mobiele modus bestaat niet in de UI.**
Geen zichtbare modus-indicator, geen beperking van bewerkknoppen op mobiel. B8.1 en B8.2 zijn
niet uitgevoerd. Hangt deels samen met A-06 (`inbox/delta` is de quick-capture-module).

### MIDDEL / LAAG — opruimwerk

**A-04 — `unsafe-inline` in de CSP.** `netlify.toml`, `style-src 'self' 'unsafe-inline'`.
Drie plekken hebben hem nodig: twee inline styles in `index.html` (risicoloos te verplaatsen)
en `src/components/Voortgangsbalk.tsx` — een gestapelde balk met continue segmentbreedtes.
Volledige verwijdering vraagt óf discretisering (afrondingen stapelen op, balk verandert
zichtbaar) óf een SVG-herschrijving die Tailwind-achtergrondklassen naar `fill` moet
vertalen. **Dit is een productkeuze, geen mechanische fix.** Meegewogen: met
`script-src 'self'` en `connect-src 'none'` kan CSS hier niets naar buiten sturen.

**A-15 — Zes conformiteitspunten niet afgetoetst.** B2.2 (losse hex-kleuren), B2.6
(ongebruikte dependencies per stuk), B5.1 (traject nieuwbouw/bestaande bouw), B5.4
(begroot/werkelijk/nog verplicht), B5.5 (juridische ankers: depot 3 mnd, brief 2e maand,
onderhoud 6 mnd, garantie 6 en 10 jaar), B6.3 (uitleg per signaal), B6.7 (testdekking per
regel), B9.3 (README-inhoud). Tellen volgens de opdracht als GEFAALD tot het tegendeel is
aangetoond.

**A-16 — Eén golden fixture, geen snapshot per schemaversie.** Er is
`tests/fixtures/golden-v1.woningdossier`. Zodra `HUIDIGE_SCHEMA_VERSIE` naar 2 gaat, hoort er
een fixture voor v1 én een verwachte snapshot bij. Volgt uit A-03.

**A-17 — Firestore-restanten in levende code.** `src/lib/converters.ts` exporteert
`afspraakNaarFirestore`, `ankerUitFirestore` en soortgelijke. De functies zijn in gebruik,
maar de naamgeving verwijst naar een datalaag die niet meer bestaat. Ook toelichtende
Firestore-teksten in `actielijst.ts`, `bouwfase.ts` en `betrokkenen.ts`.

**A-21 — `docs/PROJECT.md` nog niet nagelopen.** `STATE.md` is bijgewerkt, `PROJECT.md` niet
volledig.

---

## 4. Werkafspraken die golden en die je wilt aanhouden

- Werk op een branch, niet rechtstreeks op `main`. Eén fix = één commit, Nederlandse
  commitmessage met het bevindingsnummer (`fix(A-09): ...`).
- **Repareer nooit een falende test door hem te versoepelen of te skippen.** Klopt de test en
  niet de code, repareer de code.
- **Verwijder nooit** een migratie in `src/migrations/`, een golden fixture in
  `tests/fixtures/`, of een verify-script.
- **Verlaag nooit** de Argon2id-parameters, de sleutellengte of een CSP-directive.
- Een reparatie zonder test die de fout afvangt is niet af. Bewijs waar mogelijk dát de test
  de fout vangt door hem tijdelijk terug te zetten.
- Draai `npm run verify` na elke fix. Deze draait op Seths eigen machine (Node 24.12.0), dus
  lint, tests en build kunnen écht.
- Blijkt een fix groter dan ~200 regels of raakt hij meerdere modules: stop, noteer hem onder
  "vereist besluit" in `docs/AUDIT.md`, ga door met de volgende.

---

## 5. Prompt om mee verder te gaan

> Kopieer alles hieronder in een nieuwe sessie.

---

Ik wil verder met het Woningdossier-project in deze map. De context staat in
`docs/VERVOLG.md` — lees dat eerst, samen met `docs/AUDIT.md` (het volledige auditrapport
met 21 bevindingen) en `docs/STATE.md` (de actuele stand). Lees ook `AGENTS.md` en
`CLAUDE.md` voor de werkwijze en de uitvoeringsomgeving.

Korte samenvatting: een eerdere agent bouwde deze app om naar 100% lokaal. Die oplevering is
geauditeerd en gedeeltelijk gerepareerd. 13 van de 21 bevindingen zijn af, inclusief alle
blokkerende: versleuteling at rest, bijlagen in de backup, de migratieketen, chunked
encryptie van documenten, het roulerende backupschema en de paniekknop. `npm run verify` is
groen met 652 tests in 38 bestanden.

Wat nog openstaat, in volgorde van belang:

1. **A-06** — vijf modules (`energie`, `mjop`, `p1`, `inbox/delta`,
   `woningpaspoort/overdracht`) hebben tests maar geen enkele route die ze importeert. Sluit
   ze aan met route, navigatie-ingang en UI. Doe dit **module voor module**, elk met een
   eigen commit; samen is dit ruim boven de 200-regelgrens.
2. **A-09** — signaalsysteem: `versie` per regel, status
   `nieuw|geaccepteerd|genegeerd|gesnoozed`, `snoozeTot`, een hash van de invoerwaarden zodat
   een weggeklikt signaal wegblijft, begrenzing op maximaal drie zichtbare signalen, en een
   schakelaar per regelcategorie in de instellingen.
3. **A-10** — `bron: 'ingevoerd' | 'afgeleid' | 'geïmporteerd' | 'voorstel'` op elk datapunt,
   plus de guard die voorkomt dat een herberekening een handmatig ingevoerde waarde
   overschrijft. Gebruik de migratieketen in `src/migrations/` voor de schemawijziging.
4. **A-13** — mobiele modus: zichtbare modus-indicator en geen bewerkknoppen buiten
   quick-capture.
5. **A-15 t/m A-17, A-04, A-21** — opruimwerk en de niet-afgetoetste conformiteitspunten.

Werk op een branch, niet op `main`. Eén fix = één commit met het bevindingsnummer in een
Nederlandse commitmessage. Elke reparatie krijgt een test die de fout afvangt — een reparatie
zonder test is niet af. Repareer nooit een falende test door hem te versoepelen. Verwijder
nooit een migratie, een golden fixture of een verify-script, en verlaag nooit de
Argon2id-parameters of een CSP-directive. Draai `npm run verify` na elke fix en meld de
werkelijke uitkomst, niet de verwachte.

Twee valkuilen die je moet kennen voordat je code schrijft:
- Schrijf nooit rechtstreeks via `db.<tabel>.put()`. Gebruik `bewaar`, `haal` en
  `haalVanProject` uit `src/db/kluisopslag.ts`, anders staat de data weer onversleuteld op
  schijf.
- Het veld `enc` is bewust base64 en geen `Uint8Array`, omdat een `Uint8Array`
  `JSON.stringify` niet overleeft en de backup hele tabellen naar JSON serialiseert. Verander
  dat niet terug.

Begin met A-06, en vraag me eerst welke van de vijf modules je als eerste moet aansluiten.

---

*Laatst bijgewerkt: 2026-08-16 · HEAD `959eb4a`*
