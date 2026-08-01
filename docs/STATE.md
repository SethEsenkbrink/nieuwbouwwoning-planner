# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-07-31 · sessie 05
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).
> Geen geschiedenis hier — die staat in `sessions/`. Houd dit kort.

---

## In één alinea

De app is functioneel compleet voor het hele bouwtraject: van koop tot en met de garantie­
termijnen. Blokken **A t/m D uit het bouwplan zijn af**, inclusief de navigatie-herindeling.
Wat nog komt is **blok E — het woningdossier** (ADR-0010), plus live gaan (bewust uitgesteld)
en de documentparser. Alles is lokaal getest tegen de emulator; er staat nog niets in
productie.

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
| `/project` | Opleverdatum, projectgegevens en het project verwijderen |

**Blok A** kernlus afmaken · **B** technische schuld (B4 live gaan uitgesteld) ·
**C** bouwtraject compleet · **D** oplevering en garantie — alle vier af. Details per punt
staan in `2026-07-31-bouwplan-en-backlog.md`.

## Cijfers

| | |
| --- | --- |
| Unit tests | **220** in 14 bestanden, geen emulator nodig |
| Rules-tests | **79**, apart met `npm run rules:test` |
| ADR's | 12, met index in `decisions/README.md` |
| Verify-scripts | tokens · headers · rules-pariteit (19 enums, 81 waarden) |

## Laatste verificatie — 31 juli, 23:22

Alles groen, lokaal gedraaid, en **gecommit + gepusht als `7b80825`**
("Blok A t/m D: kernlus, meerwerk, bouwdepot, oplevering en navigatie").

| Check | Uitkomst |
| --- | --- |
| `npm run verify` | typecheck · lint · **220 tests in 14 bestanden** · tokens (50) · headers (10 + 14 CSP) · rules-pariteit (19 enums / 81 waarden) · build ✅ |
| `npm run rules:test` | **79 tests** ✅ (gedraaid vóór de laatste twee wijzigingen; er is daarna niets aan de rules veranderd) |
| Build | 155 modules, `App` 209 kB (55 kB gzip), `firebase` 566 kB (167 kB gzip) |

Werktree is schoon en gelijk met `origin/main`.

> **Bij het opstarten van een nieuwe sessie:** je kunt er dus van uitgaan dat de laatste commit
> een groene verify heeft. Ga je iets wijzigen aan de rules, draai dan `npm run rules:test`
> vóórdat je verder bouwt.

## Direct volgende stap

**Blok E — het woningdossier** (ADR-0010). In deze volgorde:

1. `woningStatus` op het project (`in_aanbouw` / `opgeleverd`) + woningpaspoort
2. Onderdelenregister: merk, type, serienummer, installatiedatum, garantie, `documentUrl`
3. Onderhoudsschema met `intervalDagen` + `laatstUitgevoerdOp` — de enige echte
   modeluitbreiding, want onderhoud herhaalt zich en bouwafspraken niet
4. Terugkerende controles, logboek, meterstanden

Daarna: de documentparser (C5), live gaan (B4/F1) en de rest van blok F.

## Open vragen / wacht op Seth

- **Aanlooptijden valideren.** De 38 startwaarden zijn schattingen; echte cijfers van keuken,
  vloer of busverhuur vervangen de gok. Kan op `/betrokkenen`, waarna het voorstel-label
  vanzelf verdwijnt.
- **Welke bouwmomenten kent het project echt?** Nu gevuld met testdata.
- **Onderdelen voor blok E.** Welke installaties zitten er in de woning (warmtepomp of
  cv-ketel, WTW, zonnepanelen, waterontharder), zodat de standaardbibliotheek daarop aansluit?
- **Mailprovider** voor de herinneringen uit blok E. Krijgt een eigen ADR.

## Bekende valkuilen

**Wat een AI-sessie in de sandbox wél en níét kan draaien.** Vastgesteld op 31 juli, nadat
`npm run verify` lokaal twee lintproblemen vond die de sessie als "schoon" had gemeld:

| Commando | In de sandbox | Waarom |
| --- | --- | --- |
| `tsc --noEmit` | ✅ ~40 s | Past binnen de tijdslimiet per opdracht |
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

**Over de code:**

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
