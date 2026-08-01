# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-08-01 · sessie 06
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).
> Geen geschiedenis hier — die staat in `sessions/`. Houd dit kort.

---

## In één alinea

De app dekt het hele bouwtraject én het begin van het woningdossier. Blokken **A t/m D zijn
af**, en van blok E staan **E1 (woningpaspoort + `woningStatus`) en E2 (onderdelenregister)**
er nu ook. Wat nog komt is **E3 t/m E8** — het onderhoudsschema en verder — plus live gaan
(bewust uitgesteld) en de documentparser. Er staat nog niets in productie.

## De kernlus, in één zin

Een bouwmoment verschuiven laat alle afspraken die eraan hangen meeschuiven, waarna iedereen
met een verouderde datum op de actielijst komt, gesorteerd op wat er kapotgaat als je niets
doet — met een kant-en-klaar bericht en een knop die vastlegt dat je het hebt doorgegeven.

## Wat er staat

| Scherm | Doet |
| --- | --- |
| `/` Dashboard | De actielijst met urgentie, zekerheid, concept-bericht en doorgegeven-knop. Daaronder: oplevering, bouwmomenten, geld, betrokkenen |
| `/tijdlijn` | Zeven fases met status, streefdatum, aandachtspunten en eigen taken |
| `/ankers` | De zeven bouwmomenten met datum, hardheid en bron, plus een wat-als vóór het opslaan |
| `/afspraken` | Per betrokkene: bouwmoment + dagen ervóór/erna, met live voorbeeld van de datum |
| `/betrokkenen` | Partijen met aanlooptijd, annuleertermijn, communicatieregel en contactgegevens |
| `/meerwerk` | Sluitingsdatums in drie vormen (ADR-0011) en het budget ertegenaan |
| `/bouwdepot` | Termijnen: gefactureerd → gedeclareerd → betaald, met wat jíj nog moet indienen |
| `/oplevering` | Opleverpunten, het 5%-depot en vier garantieklokken |
| `/na-oplevering` | Vloer, gordijnen, tuin: geraamd naast werkelijk |
| `/woning` | Fase (in aanbouw / opgeleverd), woningpaspoort en de energielabelklok |
| `/onderdelen` | Wat er in huis zit: merk, type, serienummer, specs, garantie, meldplicht |
| `/project` | Opleverdatum, projectgegevens en het project verwijderen |

**Blok A** kernlus afmaken · **B** technische schuld (B4 live gaan uitgesteld) ·
**C** bouwtraject compleet · **D** oplevering en garantie · **E1 + E2** woningpaspoort en
onderdelenregister. Details per punt staan in `2026-07-31-bouwplan-en-backlog.md`.

## Cijfers

| | |
| --- | --- |
| Unit tests | **283** in 16 bestanden (was 220), geen emulator nodig |
| Rules-tests | **116** (was 79), apart met `npm run rules:test` |
| ADR's | 13, met index in `decisions/README.md` |
| Verify-scripts | tokens (50) · headers (10 + 14 CSP) · rules-pariteit (24 enums, 119 waarden) |

## ⚠️ `npm run typecheck` heeft nooit iets gecontroleerd — opgelost op 1 augustus

Dit is de belangrijkste vondst van sessie 06. Het script stond op `tsc --noEmit`, maar
`tsconfig.json` heeft `"files": []` met project references. In die opzet **controleert
`tsc --noEmit` niets en geeft hij exit 0**. De typecheck-stap in `npm run verify` was dus
sinds sessie 01 een lege huls, en heeft de TypeScript van blok A t/m E nooit gezien.

Aangetoond door een harde typefout (`const kapot: number = "tekst"`) in te voegen:
`tsc --noEmit` gaf exit 0, `tsc --build --force` gaf exit 2. Het script staat nu op
`tsc --build --force`, dat beide projecten (`app` en `node`) wél doorloopt.

Wat er daardoor onopgemerkt in stond, alle drie nu weg:

| Fout | Waar | Sinds |
| --- | --- | --- |
| TS2379 × 2 — `ProjectInvoer` niet toewijsbaar aan `Partial<ProjectData>` onder `exactOptionalPropertyTypes` | `lib/projecten.ts:130` en `:163` | commit `d67d0df` |
| TS5101 — `baseUrl` is deprecated in TS 6 en stopt in 7 | `tsconfig.app.json` | sessie 01 |

De TS2379 is opgelost met een gedeeld `Invoer<T>`-type in `converters.ts`; `baseUrl` is
verwijderd (`paths` werkt zonder).

## Laatste verificatie — 1 augustus, sessie 06

**In de sandbox gedraaid en groen:** `tsc --build --force` (de echte typecheck, zie hierboven),
`verify:tokens`, `verify:headers`, `verify:rules` (24 enums / 119 waarden, negatief getest op
twee scenario's).

> **NOG TE DRAAIEN DOOR SETH, LOKAAL — dit is geen groene verify.**
> `npm run verify` (voor lint, de 283 unit tests en de build) en `npm run rules:test`
> (voor de 116 rules-tests, waarvan 37 nieuw). De rules zijn deze sessie op drie plekken
> gewijzigd, dus `rules:test` is hier niet optioneel.
>
> **Reken op lintmeldingen die er altijd al waren.** De typecheck-gate stond zes sessies
> open; het is aannemelijk dat `eslint .` nu dingen vindt die nooit langs een werkende poort
> zijn gekomen.
>
> Lint, vitest en de emulator kunnen niet in de sandbox draaien — zie de tabel onder
> "Bekende valkuilen". Een sessie die "lint is groen" meldt zonder dat het lokaal gedraaid
> heeft, liegt.

Commits deze sessie: `3eed5c5` (docs opruimen), `a6a46de` (E1), `0093810` (E2),
`71a21d1` (typecheck-gate + convertertests + twee UI-fixes).

## Direct volgende stap

**Blok E3 — het onderhoudsschema.** Dit is de enige echte modeluitbreiding uit ADR-0010 §2,
want onderhoud herhaalt zich en bouwafspraken niet:

1. `onderhoudstaken` met `intervalDagen` + `laatstUitgevoerdOp` + `waardenBron`
2. `berekenVolgendeOnderhoud(taak, vandaag)` in de rekenkern, naast `berekenDatum()`.
   Nooit uitgevoerd? Dan telt de installatiedatum van het onderdeel als startpunt, anders
   de opleverdatum
3. Een standaardbibliotheek met intervallen per onderdeeltype. Het meeste voorwerk staat al
   in `data/onderdelen-standaard.ts`: de filterintervallen van de WTW, het RO-membraan en
   de anode van de boiler zijn daar als spec-hint genoteerd
4. `onderhoudslogboek` (E6), terugkerende controles (E5)

Daarna: garantieklokken per onderdeel op het dashboard uitbreiden (E4 — de basis staat er),
de documentparser (C5), live gaan (B4/F1) en de rest van blok F.

## Open vragen / wacht op Seth

- **Aanlooptijden valideren.** De 38 startwaarden zijn schattingen; echte cijfers van keuken,
  vloer of busverhuur vervangen de gok. Kan op `/betrokkenen`, waarna het voorstel-label
  vanzelf verdwijnt.
- **Welke bouwmomenten kent het project echt?** Nu gevuld met testdata.
- **Type warmtepomp en WTW.** Merken zijn bekend (NIBE en Brink), de typenummers nog niet.
  Zodra die er zijn kunnen de onderhoudsintervallen uit het fabrikantvoorschrift de
  voorstelwaarden vervangen.
- **Batterij: AC- of DC-gekoppeld?** Bepaalt of de omvormer en de batterij één onderdeel met
  één garantie zijn of twee losse met elk hun eigen termijn. Seth neigt naar plug-and-play,
  wat AC-gekoppeld betekent en dus twee losse onderdelen.
- **Mailprovider** voor de herinneringen uit blok E. Krijgt een eigen ADR. Wordt urgent bij
  E3: een onderhoudsbeurt over acht maanden werkt alleen als de app zich meldt.

## Bekende valkuilen

**Wat een AI-sessie in de sandbox wél en níét kan draaien.** Vastgesteld op 31 juli, nadat
`npm run verify` lokaal twee lintproblemen vond die de sessie als "schoon" had gemeld:

| Commando | In de sandbox | Waarom |
| --- | --- | --- |
| `tsc --build --force` | ✅ ~40 s | Past binnen de tijdslimiet. **Niet `tsc --noEmit`** — dat controleert niets bij project references; zie de waarschuwing hierboven |
| `eslint .` | ❌ **nooit** | Duurt >40 s, ook op zes losse bestanden. Achtergrondprocessen worden afgekapt zodra de opdracht terugkeert, dus een leeg logbestand betekent *niet klaar*, niet *schoon* |
| `vitest` / `vite build` | ❌ | `node_modules` bevat de Windows-binaries van rolldown |
| Firestore-emulator | ❌ | Java 11 in plaats van de vereiste nieuwere JDK, en de emulator-JAR is geblokkeerd door de netwerk-allowlist |

**Laat een sessie dus nooit "lint is groen" beweren.** Alleen `tsc` telt daar, en dan met een
sentinel (`; echo "EXIT=$?" >> log`) zodat zichtbaar is dát het proces klaar is.

**Wat de emulator niet dekt**, ook als je hem lokaal draait:

- **Composite indexes worden niet afgedwongen.** Een query die lokaal werkt kan in productie
  falen met "The query requires an index". Elke nieuwe `where` + `orderBy`-combinatie moet dus
  ook in `firestore.indexes.json`.
- **De productie-CSP en security headers gelden lokaal niet** (`stripCspInDev`). Alleen te
  controleren op een deploy preview — inclusief de openstaande `eval`-melding.
- **Netlify Functions draaien via `@netlify/vite-plugin`**, niet via de echte runtime.

**`.git/index.lock` kan achterblijven op de FUSE-mount.** Op 1 augustus stond er een lege lock
van twaalf uur oud, achtergebleven na de laatste commit van sessie 05. Symptoom: elke `git
add`/`commit` faalt met "Another git process seems to be running". `rm` gaf eerst *Operation
not permitted* — de mount blokkeert delete tot dat expliciet is toegestaan. Controleer altijd
eerst de tijdstempel en de grootte (0 bytes + uren oud = stale) voordat je hem weghaalt.

**Een geneste map telt in de rules als ÉÉN veld.** `withinSize(25)` beschermt de inhoud van
`woningpaspoort`, `specs` en `registratieplicht` dus niet. Elke map heeft daarom een eigen
`.size()`-check. Vergeet je die, dan is de map een vrij beschrijfbare opslagbak en sneuvelt
constraint C2 in stilte — precies dezelfde vorm als het `.data`-gat uit sessie 03. Er staat
een test op die het bewijst (`weigert een specs-map met te veel velden`).

**Over de code:**

- **`updateDoc` met een map als waarde vervangt die map integraal.** Alleen met dot-notation
  (`"woningpaspoort.adres"`) werk je één veld bij. Dat is bij het paspoort precies goed — zo
  kan een veld leeggemaakt worden — maar het betekent wel: **stuur altijd de hele map mee.**
  Een halve map wist de rest.
- **`MetDatums<T>` is niet recursief.** Een `Timestamp` in een geneste map wordt niet naar
  `Date` gemapt. Bij `ProjectData` en `OnderdeelData` is dat expliciet met een `Omit` opgelost;
  komt er een derde geneste map met een datum, doe daar hetzelfde.
- **Java staat niet vanzelf op de PATH na `winget install`.** `JAVA_HOME` en `...\bin` staan
  als user-variabele op `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`. Na een
  PATH-wijziging moet de IDE opnieuw starten.
- **Zet geen state synchroon in een effect-body** (`set-state-in-effect`). Patroon: effect met
  een async IIFE, herladen via een teller in de dependency-array.
- **Een bestand dat naast componenten ook waarden exporteert breekt Fast Refresh.** Types mogen
  wel; constanten niet. Zie `src/lib/projectgegevens.ts` — die staat daar om die reden apart.
- **Wijzigen gaat via `updateDoc`, behalve waar een veld gewist moet kunnen worden.**
  `zonderLegeVelden()` strippt `undefined`, dus een `updateDoc` kan niets leegmaken. Waar dat
  nodig is (ankers, afspraken, meerwerk, termijnen, gebreken, nabudget) gebruiken we `setDoc`
  — dat mag omdat die documenten geen `aangemaaktOp` kennen. **Bij een volledige overschrijving
  moet je velden die niet in het formulier staan expliciet meenemen**, zoals
  `gecommuniceerdeDatum`.
- **`aangemaaktOp` moet `serverTimestamp()` zijn bij het aanmaken.** De rules controleren
  `== request.time`.
- **Reken datums uit `<input type="date">` als UTC.** Lokale tijd schuift in de zomer een dag.
- **Maandrekenen klemt op de laatste dag.** `setMonth` maakt van 31 augustus plus zes maanden
  3 maart; `overMaanden()` in `lib/oplevering.ts` vangt dat af.
- **In Firestore-rules is het `request.resource.data.size()`, niet `request.resource.size()`.**
  Zonder `.data` weigert de check nooit iets en blijven alle andere tests groen.
- **Rules die niet gedraaid zijn, zijn rules waarvan je hoopt dat ze werken.**
- **Sla nooit een afspraakdatum op.** Alleen `ankerType` + `offsetDagen`. Zie
  `decisions/README.md` voor de vier ADR's die deze regel vormen.
- **`planning.ts` blijft puur.** Geen Firestore, geen React, geen `new Date()` die niet als
  parameter binnenkomt.
- **`npm audit fix --force` niet gebruiken.** Downgradet `@netlify/vite-plugin` elf versies.
- **Nooit terugverhuizen naar Google Drive.** `node_modules` is 606 MB / 33.966 bestanden.
- **Vite 8 draait op Rolldown.** `manualChunks` moet een _functie_ zijn.
- **Importeer uit `react-router`, niet `react-router-dom`.**
- **Firestore-emulator vereist JDK 21+**, en **single-field indexes horen niet in
  `firestore.indexes.json`**.

## Bekende aandachtspunten voor later

- **`firebase-*.js` is 566 kB (167 kB gzip)** en overschrijdt de waarschuwingsgrens van 500 kB.
  Op te lossen met een dynamische import van Firestore; nu geen probleem.
- **Sourcemaps worden meegebouwd** (~4,7 MB). Prima om te debuggen, maar vóór een publieke
  deploy een bewuste keuze maken.
- **`SOURCEMAP_BROKEN`-waarschuwing** van `@tailwindcss/vite`. Cosmetisch.
- **Eén anker per type is afgevangen bij het lezen, niet structureel.** Een harde garantie zou
  het document-id gelijkstellen aan het ankertype; dat is een migratie waard zodra er
  productiedata is.
