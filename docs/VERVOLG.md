# VERVOLG.md — waar we gebleven zijn en wat er nog moet

> **Doel van dit bestand:** de audit van 15 augustus 2026 en de reparatieronde die
> erop volgde, samengevat tot iets waarmee een volgende sessie direct verder kan.
> Plak de prompt onderaan in een nieuwe sessie.
>
> **Peildatum:** 2026-08-16 · **Branch:** `main` · working tree schoon
> **Gates:** `npm run verify` groen — **686 tests in 42 bestanden**, build groen, `npm audit` nul kwetsbaarheden

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

## 2. Wat er AF is (20 van 21 bevindingen)

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
| **A-17** | Firestore-restanten in code en docs | `f23a490` | Converters heten xNaarOpslag/xUitOpslag; eslint blokkeert elke firebase-import |
| **A-06** | Vijf modules zonder importeur | `833f902` | Routes /energie, /mjop en /snel; woningpaspoort in het dossier |
| **A-13** | Geen mobiele modus | `833f902` | Zichtbare modus; buiten quick-capture staat de inhoud op `inert` |
| **A-09** | Signalen zonder status of hash | `0048f56` | Versie, status, snooze, invoerhash, max drie, schakelaar per categorie |
| **A-10** | Geen herkomst per veld | `925aae7` | `bron` per veld; handmatige invoer wordt nooit overschreven |
| **A-04** | `unsafe-inline` in de CSP | `6e2d1db` | Balken tekenen met SVG-attributen; CSP is nu volledig schoon |
| **A-15** | Niet-afgetoetste punten | `9aaab3e` | Hexkleuren weg, ongebruikte dependency weg, financiële drieslag toegevoegd |
| **A-16** | Eén fixture zonder versiecontrole | `9aaab3e` | verify-backup eist een fixture voor élke schemaversie |

**Alle fasen staan daarmee op afgerond in `docs/STATE.md`** — voor het eerst terecht, met bewijs.

### Nieuwe modules die hieruit ontstaan zijn

```
src/db/sleutelregister.ts     actieve DEK in een moduleclosure; gewist bij vergrendelen
src/db/kluisopslag.ts         versleutelde opslaglaag boven Dexie
src/migrations/index.ts       migratieketen voor het backupformaat
src/lib/backup/rotatie.ts     roulerend schema, pure logica
src/lib/backup/doel.ts        backupmap + permissie (File System Access API)
src/lib/backup/roulerend.ts   brengt schema, doel en export samen
src/lib/paniek.ts             alles lokaal wissen
src/lib/signalen.ts           signaalstatus, snooze en categorieschakelaars
src/lib/bron.ts               herkomst per veld en de grendel op handmatige invoer
src/context/useModus.ts       desktop- of mobiele modus
scripts/verify-bereikbaarheid.mjs  vangt dode modules en dode routes af
```

### Drie dingen om te weten voor je verder bouwt

1. **`enc` is base64, geen `Uint8Array`.** Een `Uint8Array` overleeft `JSON.stringify` niet
   (hij wordt `{"0":12,...}`) en de backup serialiseert hele tabellen naar JSON. Met ruwe
   bytes kwam een hersteld record er corrupt uit. Verander dit niet terug.
2. **Schrijf nooit rechtstreeks via `db.<tabel>.put()`.** Gebruik `bewaar`/`haal`/
   `haalVanProject` uit `src/db/kluisopslag.ts`, anders staat de data weer plat op schijf.
3. **Elk signaal in `src/rules/` moet `invoerwaarden` meeleveren.** Er is een test die faalt
   als een regel dat vergeet — zonder die waarden is er geen uitleg en geen betrouwbare hash.

---

## 3. Wat er NIET af is

**Eén punt, bewust.**

**B4.6 — de zip wordt niet streaming gebouwd.** `fflate` biedt een streaming-API, maar het
archief wordt hoe dan ook in één keer weggeschreven en direct teruggelezen ter controle
(A-07). Streaming zou het geheugengebruik verlagen bij dossiers van honderden megabytes,
maar zou die terugleescontrole — die aantoonbaar dataverlies voorkomt — complexer maken.
Voor een huishoudensdossier is dat een slechte ruil. Herzien zodra bijlagen in de honderden
megabytes lopen.

Alle overige 20 bevindingen zijn afgewerkt, elk met een test en waar mogelijk een gate die
negatief bewezen is.

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

Ik wil verder met het Woningdossier-project in deze map. Lees eerst `docs/VERVOLG.md`,
`docs/AUDIT.md` en `docs/STATE.md`, plus `AGENTS.md` en `CLAUDE.md` voor de werkwijze.

De audit van augustus 2026 is afgewerkt: 20 van de 21 bevindingen zijn gerepareerd, elk met
test. Alleen B4.6 (streaming zip) staat bewust open, met motivering in AUDIT.md.
`npm run verify` is groen met 686 tests in 42 bestanden en `npm audit` meldt nul
kwetsbaarheden.

Werk op een branch, niet op `main`. Eén wijziging = één commit met een Nederlandse
commitmessage. Elke reparatie krijgt een test die de fout afvangt — een reparatie zonder test
is niet af. Repareer nooit een falende test door hem te versoepelen. Verwijder nooit een
migratie, een golden fixture of een verify-script, en verlaag nooit de Argon2id-parameters of
een CSP-directive. Draai `npm run verify` na elke wijziging en meld de werkelijke uitkomst.

Drie dingen die je moet weten voordat je code schrijft:

- Schrijf nooit rechtstreeks via `db.<tabel>.put()`. Gebruik `bewaar`, `haal` en
  `haalVanProject` uit `src/db/kluisopslag.ts`, anders staat de data onversleuteld op schijf.
- Het veld `enc` is bewust base64 en geen `Uint8Array`, omdat een `Uint8Array`
  `JSON.stringify` niet overleeft en de backup hele tabellen naar JSON serialiseert.
- Elk signaal in `src/rules/` moet `invoerwaarden` meeleveren. Er is een test die faalt als een
  regel dat vergeet, want zonder die waarden is er geen uitleg en geen betrouwbare hash.

Zeg me wat je wilt bouwen, dan begin ik daar.

---

*Laatst bijgewerkt: 2026-08-16*
