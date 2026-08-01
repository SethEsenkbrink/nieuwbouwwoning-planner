# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-08-01 · sessie 06 (E1 t/m E4)
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).
> Geen geschiedenis hier — die staat in `sessions/`. Houd dit kort.

---

## In één alinea

De app dekt het hele bouwtraject én het woningdossier tot en met het onderhoud. Blokken
**A t/m D zijn af**, en van blok E staan **E1 (woningpaspoort), E2 (onderdelenregister),
E3 (onderhoudsschema), E4 (garantieklokken per onderdeel), E5 (terugkerende controles) en
E6 (logboek)** er nu ook. Wat nog komt is **E7 (meterstanden)** en **E8 (overdrachtsdossier)**,
plus live gaan met de e-mailherinneringen en de documentparser. De rules staan in productie;
de app draait nog alleen lokaal.

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
| `/onderhoud` | Terugkerend werk met interval en voorkeursmaand, afvinken met logboek. Een aflopende garantie vervroegt de beurt |
| `/project` | Opleverdatum, projectgegevens en het project verwijderen |

**Blok A** kernlus afmaken · **B** technische schuld (B4 live gaan uitgesteld) ·
**C** bouwtraject compleet · **D** oplevering en garantie · **E1 t/m E6**
woningpaspoort, onderdelenregister, onderhoudsschema, garantiekoppeling en logboek. Details
per punt staan in `2026-07-31-bouwplan-en-backlog.md`.

## Cijfers

| | |
| --- | --- |
| Unit tests | **337** in 17 bestanden (was 220), geen emulator nodig |
| Rules-tests | **141** (was 79), apart met `npm run rules:test` |
| ADR's | 14, met index in `decisions/README.md` |
| Verify-scripts | tokens (50) · headers (10 + 14 CSP) · rules-pariteit (25 enums, 121 waarden) |

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

## Laatste verificatie

**E1 t/m E3 — 1 augustus 13:49, lokaal gedraaid en volledig groen.**

| Check | Uitkomst |
| --- | --- |
| `npm run verify` | typecheck (`tsc --build --force`) · lint · **318 tests in 17 bestanden** · tokens (50) · headers (10 + 14 CSP) · rules-pariteit (25 enums / 121 waarden) · build ✅ |
| `npm run rules:test` | **141 tests** ✅ in 8,3 s |
| Build | 164 modules, `App` 290 kB (76 kB gzip), `index` 183 kB (58 kB gzip), `firebase` 567 kB (167 kB gzip) |

De drie tests op de `keys().hasOnly(...)` van `onderhoudstaken` zijn groen, inclusief
**"accepteert elk veld dat het model kent"** — die bewijst dat de whitelist compleet is en
niet per ongeluk een veld mist.

Lint gaf tweemaal een handvol fouten in de nieuwe code, beide keren hersteld zonder
`!`-assertions: `e79c83b` (E1/E2) en `a6a0f9a` (E3).

**E4 — nog te draaien.** In de sandbox groen: `tsc --build --force` en de drie
verify-scripts. De verificatiepass vond vier bugs, alle vier hersteld met regressietests.

> **NOG TE DRAAIEN DOOR SETH:** `npm run verify` (337 tests). De rules zijn bij E4 níét
> gewijzigd, dus `rules:test` is deze keer optioneel.

Werktree is schoon.

Commits deze sessie: `3eed5c5` (docs opruimen), `a6a46de` (E1), `0093810` (E2),
`71a21d1` (typecheck-gate), `e79c83b` (lintfixes E1/E2), `2a6301c` (verify-uitkomst),
`97ac304` (CLAUDE.md), `c84c731` (E3), `5e6553d` (E3-verificatie), `a6a0f9a` (lintfixes E3),
`2ee664e` (rules-deploy), `8ba2e1d` (improvements genoteerd), `82d9002` (E4).

> **Bij het opstarten van een nieuwe sessie:** de laatste commit heeft een volledig groene
> verify én groene rules-tests. Wijzig je iets aan de rules, draai dan `npm run rules:test`
> vóórdat je verder bouwt — zeker bij `onderhoudstaken`, waar een vergeten veld in de
> `hasOnly`-lijst élke write weigert.

## Rules en indexes staan in productie — 1 augustus 14:02

De rules liepen **vier commits achter**: de console stond nog op de versie van 30 juli 18:04,
terwijl blok D, E1, E2 en E3 de rules alle vier hadden gewijzigd. Opgemerkt doordat Seth ernaar
vroeg, niet doordat iets faalde — de emulator draait tegen het bestand op schijf en had er
geen weet van.

Op 1 augustus gedeployed met `firebase deploy --only firestore` (rules én indexes). De
server-side compilatie kwam schoon door, inclusief de `keys().hasOnly(...)` op
`onderhoudstaken`.

> **De regel die hieruit volgt:** `npm run rules:test` groen is **niet** hetzelfde als
> *gedeployed*. Wijzig je de rules, deploy dan in dezelfde sessie. Geeft de CLI
> `Authentication Error`, dan is `firebase login --reauth` de fix — niet `firebase login:ci`,
> dat is voor headless servers en levert een langlevend geheim op.

**Over de indexes:** de twee composite indexes (`tasks: status + deadline` en
`meerwerk: status + sluitingsdatum`) worden door **geen enkele query** gebruikt. Alle
Firestore-toegang loopt via `lib/projecten.ts`, en daar staat nergens een `where` + `orderBy`
op dezelfde collectie; sorteren gebeurt overal client-side. Vermoedelijk in sessie 01
vooruitlopend aangemaakt op queries die er nooit kwamen.

Niet schadelijk — een ongebruikte index kost wat opslag en schrijftijd — maar wel dood gewicht
dat suggereert dat er queries zijn die er niet zijn. **Bewust laten staan** tot E8 af is; dan
is pas duidelijk of er alsnog een nodig is. E4 heeft er in elk geval geen toegevoegd.

De drie collecties uit blok E hebben géén index nodig: ze halen de hele subcollectie op en
sorteren in het geheugen. Bij een woningdossier gaat het om tientallen documenten, niet
duizenden.

## Direct volgende stap

**E7 — meterstanden.** In volgorde van het bouwplan:

1. **E7 meterstanden** — handmatige opnames met een verbruikstrend. Bewust simpel; geen
   koppeling met slimme meters.
2. **E8 overdrachtsdossier** — client-side PDF. `blijftBijWoning` bepaalt wat erin komt
   (ADR-0013 §2), en het onderhoudslogboek is het waardevolste deel.
3. **C5 documentparser**, **B4/F1 live gaan** met de e-mailherinneringen uit ADR-0014 §3.

> **Toets bij het live gaan (ADR-0014 §3):** kijk dan hoeveel onderhoudstaken er
> achterstallig zijn op het moment dat iemand inlogt. Is dat structureel hoog, dan had
> ADR-0010 §4 gelijk en moet de mailfunctie voorrang krijgen boven de rest van blok F.

## `improvements/` — auditrapporten, af te handelen vóór de live versie

Op 1 augustus heeft Seth via Antigravity de `improve`-skill gedraaid (`.agent/skills/improve/`).
Resultaat: vier rapportmappen in `improvements/` met samen ~29 plannen.

**Afspraak: hier wordt niet aan gewerkt totdat blok E en F uit het bouwplan af zijn.** Daarna
wél, en vóór het live gaan — een deel raakt productie rechtstreeks.

| Map | Inhoud |
| --- | --- |
| `2026-08-01-audit` | 6 plannen: code splitting, anker-document-id, dynamische Firestore-import, E4/E7/E8 |
| `2026-08-01-deep-audit` | 10 plannen: error boundaries, rules-validatie, netlify-verify, caching, routes splitsen, memoisatie |
| `2026-08-01-deep-gemini-3.6-flash` | Dezelfde 10, korter opgeschreven |
| `2026-08-01-security-audit` | 2 plannen: rules-validatie, dependency-overrides |

### Lees ze met deze kanttekeningen

De audits kennen de ADR's niet, dus een paar bevindingen zijn achterhaald of onjuist. Niet
blind uitvoeren:

- **SEC-01 (`keys().hasOnly` ontbreekt)** — deels al gedaan: `onderhoudstaken` heeft het sinds
  `5e6553d`. Voor de andere collecties geldt het nog wél, en het is een reële bevinding: op
  onbekende veldnamen staat geen lengtelimiet. De claim "onbeperkt grote blobs" is wel
  overdreven — `withinSizeLimit()` begrenst het aantal velden.
- **DEP-01 (dependency-overrides)** — dat is **ADR-0007**, een bewuste keuze. `npm audit fix
  --force` downgradet `@netlify/vite-plugin` elf versies. Niet zomaar weghalen.
- **DIR-01 (documentparser) en DIR-02 (e-mail)** — geen bevindingen maar bekende, geplande
  features: C5 en ADR-0014 §3. Ze staan al in het bouwplan voor ronde 8.
- **PERF-01 (code splitting)** — bevestigt wat hieronder al als aandachtspunt staat.

### Wat er wél nieuw uit kwam

- **BUG-01: geen React Error Boundary.** Een fout in een diepe component geeft nu een wit
  scherm. Nergens eerder genoteerd, en het is goedkoop op te lossen.
- **DX-01: `netlify.toml` bouwt met `npm run build`, niet met `npm run verify`.** Code met
  lint- of typefouten kan zo ongemerkt naar productie. **Dit hoort bij B4/F1 en moet dus
  opgelost zijn vóór de eerste deploy.**
- **PERF-02: geen offline persistence, en de twaalf subcollecties worden bij het verwijderen
  sequentieel opgehaald.**

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
- **Mailprovider** voor de herinneringen. Krijgt een eigen ADR. Bewust uitgesteld tot ronde 8
  (ADR-0014 §3): tot die tijd is de onderhoudslijst op het dashboard de enige herinnering, en
  dat is een geaccepteerd risico — geen opgelost probleem.

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

**`voorkeursmaand` mag nooit tot vóór de laatste beurt schuiven.** Bij een interval korter
dan een jaar koos de correctie de dichtstbijzijnde voorkomen van de maand, en dat kon de dag
van de beurt zelf zijn — de taak was dan meteen achterstallig en bleef dat. `naarMaand()`
heeft daarom een `nietVoor`-ondergrens, met twee regressietests. Gevonden bij de
verificatiepass, niet bij het bouwen.

**Onderhoudstaken zijn de enige collectie met `keys().hasOnly(...)` in de rules.** Overal
elders begrenzen de rules alleen het aantal velden, waardoor een onbekende veldnaam
erdoorheen glipt. Bij onderhoud woog dat zwaarder: zonder de whitelist kan iemand een
`volgendeOp` meesturen en is de afgeleide datum ineens opgeslagen — precies wat ADR-0008
uitsluit. **Komt er een veld bij in `model.ts`, dan moet het ook in die lijst**, anders
weigert elke write.

**Een `undefined === undefined`-vergelijking koppelt alles aan alles.** Bij E4 vervangen we
een lookup die `""` teruggaf door één die `undefined` teruggeeft. In
`s.onderdeelSleutel === standaardOnderdeelVoor(o.naam)?.sleutel` matchte daardoor elke taak
zonder onderdeelsleutel op elk zelfverzonnen onderdeel — "Meterstanden noteren" hing aan
"Tuinverlichting". Bij een refactor van `""` naar `undefined`: loop de vergelijkingen na.

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

- **`firebase-*.js` is 567 kB (167 kB gzip)** en overschrijdt de waarschuwingsgrens van 500 kB.
  Op te lossen met een dynamische import van Firestore; nu geen probleem.
- **`App-*.js` groeit gestaag mee:** 209 kB in sessie 05 → 260 kB na E1/E2 → **290 kB
  (76 kB gzip)** na E3. Elk nieuw scherm zit in dezelfde chunk, en twee bibliotheken (17
  onderdelen met merken en specvelden, 30 onderhoudstaken) zitten nu in de bundle van
  iedereen die inlogt — ook wie nog midden in de bouw zit en `/onderhoud` pas over een jaar
  opent. **Route-based code splitting is inmiddels meer waard dan het opsplitsen van de
  firebase-chunk.** Doen zodra blok E af is, vóór het live gaan.
- **Sourcemaps worden meegebouwd** (~4,7 MB). Prima om te debuggen, maar vóór een publieke
  deploy een bewuste keuze maken.
- **`SOURCEMAP_BROKEN`-waarschuwing** van `@tailwindcss/vite`. Cosmetisch.
- **Eén anker per type is afgevangen bij het lezen, niet structureel.** Een harde garantie zou
  het document-id gelijkstellen aan het ankertype; dat is een migratie waard zodra er
  productiedata is.
