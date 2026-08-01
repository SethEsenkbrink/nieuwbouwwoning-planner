# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-08-01 · sessie 07 (E7 en E8 — **blok E is af**)
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).
> Geen geschiedenis hier — die staat in `sessions/`. Houd dit kort.

---

## In één alinea

De app dekt het hele traject: van de koopovereenkomst tot en met het overdragen van de woning
aan de volgende eigenaar. **Blok A t/m E is af** — E8 (het overdrachtsdossier) was het laatste
punt.

**Maar de eerste live test heeft de volgorde omgegooid (ADR-0017).** Blok F en C5 schuiven op;
**ronde 9 gaat over bruikbaarheid en bugs**. De app doet het juiste, maar hij werkt niet
prettig: te veel tekst, te veel invulvelden, geen totaaloverzicht, en het bouwdepot slaat
bedragen met centen niet op. Zie `2026-08-01-bevindingen-live-test.md`.

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
| `/meterstanden` | Meters en opnames, met verbruik per periode en per dag. Een gedaalde stand of een dubbele dag wordt gemeld, niet weggerekend |
| `/overdrachtsdossier` | Het hele dossier als printbaar document: paspoort, wat er blíjft, logboek, meterstanden. Browser maakt de PDF |
| `/project` | Opleverdatum, projectgegevens en het project verwijderen |

**Blok A** kernlus afmaken · **B** technische schuld (B4 live gaan uitgesteld) ·
**C** bouwtraject compleet · **D** oplevering en garantie · **E1 t/m E8** het volledige
woningdossier, van paspoort tot overdracht. Details per punt staan in
`2026-07-31-bouwplan-en-backlog.md`.

## Cijfers

| | |
| --- | --- |
| Unit tests | **~480** in 19 bestanden (was 337) — exacte telling na `npm run verify` |
| Rules-tests | **~189** (was 141), apart met `npm run rules:test` |
| ADR's | 16, met index in `decisions/README.md` |
| Schermen | 15 achter login, plus de wizard en drie auth-schermen |
| Runtime-dependencies | **3** — firebase, react, react-router. E8 voegde er geen toe (ADR-0016) |
| Verify-scripts | tokens (50) · headers (10 + 14 CSP) · rules-pariteit (28 enums, 136 waarden, **3 gesloten veldenlijsten**) |

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

**In de sandbox groen (sessie 07):** `tsc --build --force` (exit 0, tsbuildinfo gecontroleerd)
en de drie verify-scripts. De `verify:rules`-uitbreiding is **negatief getest op vijf
scenario's** — veld uit een whitelist halen, verzonnen veld toevoegen, hulpfunctie hernoemen,
enumwaarde weghalen — en faalde alle vijf keer met een bruikbare melding.

De verificatiepass vond **tien bevindingen**, waarvan één met dezelfde vorm als de twee bugs
uit sessie 06. Alle relevante zijn hersteld, met regressietests.

### Wat er op 1 augustus daadwerkelijk gedraaid is

| Stap | Uitkomst |
| --- | --- |
| `npm run lint` | 2 fouten (`prefer-optional-chain`), hersteld in `8925328` |
| `npm run test` | **470 van 472** — beide fouten zaten in de tests, hersteld in `b3d3a87` |
| `npm run rules:test` | **188 van 189** — de test liep achter op een aanscherping, hersteld in `d07f2ae` |

> ### ⚠️ NOG TE BEVESTIGEN — begin de volgende sessie hiermee
>
> Na `d07f2ae` zijn `npm run verify` en `npm run rules:test` **niet opnieuw volledig
> gedraaid**, en de build al helemaal niet. Zet de **werkelijke** aantallen daarna in de tabel
> hierboven; de cijfers onder "Cijfers" zijn tot die tijd een schatting.
>
> Ook onbekend: of `firebase deploy --only firestore` gedraaid is. Dat is **verplicht** —
> `meters` en `meterstanden` zijn nieuwe collecties, en zonder deploy weigert élke write erop
> in productie. Bij `Authentication Error`: `firebase login --reauth`, níét `login:ci`.
>
> **Vraag Seth dit expliciet**, en neem het antwoord op in `STATE.md`. Een sessie die dit
> overslaat bouwt door op de aanname dat het goed staat.

**Een drietal lintfixes en testfixes op rij zat in de test, niet in de code.** Twee keer liep
een test achter op een aanscherping die uit de verificatiepass kwam, en één keer ging ik uit
van ASCII-sortering terwijl `localeCompare(…, "nl")` hoofdletterongevoelig is. Dat is een
gezond patroon: het betekent dat die aanscherpingen echt iets veranderen.

**E4 is nog steeds niet lokaal geverifieerd** — dat stond al open aan het eind van sessie 06
en is deze sessie niet ingehaald.

Vorige lokale meting (E1 t/m E3, 1 augustus 13:49): 318 tests, 141 rules-tests, build 164
modules met `App` 290 kB (76 kB gzip).

> **Bij het opstarten van een nieuwe sessie:** controleer eerst of bovenstaande drie stappen
> gedraaid zijn en zet de **werkelijke** uitkomst hier neer. Wijzig je iets aan de rules,
> draai dan `npm run rules:test` vóórdat je verder bouwt — bij `onderhoudstaken`, `meters` en
> `meterstanden` weigert een vergeten veld in de `hasOnly`-lijst élke write.

## ⚠️ De rules van E7 staan NOG NIET in productie

Op 1 augustus 14:02 is er gedeployed (zie hieronder), maar **daarna zijn de rules bij E7
opnieuw gewijzigd**: twee nieuwe match-blokken (`meters`, `meterstanden`), twee nieuwe
hulpfuncties (`metersoorten()`, `metereenheden()`) en een `keys().hasOnly(...)` op beide
nieuwe collecties.

Zonder deploy weigert élke write op `/meterstanden` in productie met een generieke
permissiefout — default deny. Lokaal tegen de emulator werkt alles wél, want die leest het
bestand van schijf. Precies de val waar sessie 06 in liep.

## Rules en indexes stonden in productie — 1 augustus 14:02

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

De vijf collecties uit blok E hebben géén index nodig: ze halen de hele subcollectie op en
sorteren in het geheugen. Bij een woningdossier gaat het om tientallen documenten, niet
duizenden. `meterstanden` haalt bewust álle opnames op en filtert op `meterId` in het
geheugen — een `where` per meter zou een composite index vereisen voor een handvol documenten.

## Direct volgende stap

### Eerst: de drie stappen hierboven (verify, rules:test, deploy)

Zolang die niet gedraaid zijn, weet niemand of E4 en E7 daadwerkelijk kloppen, en werkt
`/meterstanden` niet in productie.

### Dan: ronde 9 — bruikbaarheid en bugs (ADR-0017)

**De volgorde uit het bouwplan is herzien.** Seth heeft de app op 1 augustus voor het eerst met
echte gegevens gebruikt, en dat leverde meer op dan acht verificatiepasses. De volledige lijst
staat in **`docs/2026-08-01-bevindingen-live-test.md`** — lees die als eerste bij het opstarten
van ronde 9.

De kern: *"heel veel tekst, heel veel moeten invullen, soms onduidelijk, super veel blokken,
geen totaaloverzicht, en het bouwdepot werkt niet."*

**Volgorde binnen ronde 9:**

1. **BUG-01 en BUG-02** — allebei in de code teruggevonden, samen een halve sessie inclusief
   tests:
   - **BUG-01:** een bedrag met een komma (`1250,50`) wordt op zes plekken geweigerd, omdat de
     opschoning wél de punt maar níét de komma afvangt. Verklaart waarschijnlijk "de kosten
     worden niet netjes opgeslagen". Dezelfde klasse als `leesStandInvoer()` uit E7 — vraagt om
     één gedeelde `leesBedragInvoer()`.
   - **BUG-02:** `Bouwdepot.tsx:133` en `Dashboard.tsx:180` gebruiken `new Date()` in plaats
     van `opDag(new Date())`, waardoor een aangevinkte datum in de zomertijd een dag kan
     terugspringen.
2. **Kijken vóór bouwen.** Deze ronde begint niet met een ADR maar met Seth die het scherm
   deelt en vertelt wat hij ziet — anders bouwen we wat wíj denken dat onduidelijk is.
3. **Dan pas ontwerpen**, met per scherm eerst de vraag wat er wég kan.

> **De scherpste bevinding:** `PROJECT.md` §6 heeft sinds sessie 05 een vinkje bij "grafieken
> en totaalbeeld". Het dashboard heeft acht secties, waaronder een geldblok. Het staat er dus —
> en de gebruiker die de app zelf heeft laten bouwen ziet het niet, want het staat als zevende
> onderaan. **Een vinkje meet of iets gebouwd is, niet of het werkt.**

### Nog te doen bij E8 zelf

Het dossier is nooit daadwerkelijk afgedrukt. `vitest` controleert de rekenkern; of het er op
papier goed uitziet moet met de hand:

- Loopt de adrestitel netjes op één regel?
- Begint elke sectie op een nieuwe pagina, en staat de disclaimer níét op een lege laatste?
- Herhaalt de tabelkop van het logboek zich bovenaan pagina 2?
- Is het leesbaar **zonder** "Achtergrondafbeeldingen" aan te zetten? Dat is de hele opzet van
  ADR-0016 §3, en het is niet in code te bewijzen.

### Daarna (ronde 10): blok F en de wachtrij

- **De `improvements/`-wachtrij** (zie hieronder) — vóór het live gaan.
- **C5 documentparser** en **B4/F1 live gaan** met de e-mailherinneringen uit ADR-0014 §3.

> **Toets bij het live gaan (ADR-0014 §3):** kijk dan hoeveel onderhoudstaken er
> achterstallig zijn op het moment dat iemand inlogt. Is dat structureel hoog, dan had
> ADR-0010 §4 gelijk en moet de mailfunctie voorrang krijgen boven de rest van blok F.

## `improvements/` — auditrapporten, af te handelen vóór de live versie

Op 1 augustus heeft Seth via Antigravity de `improve`-skill gedraaid (`.agent/skills/improve/`).
Resultaat: vier rapportmappen in `improvements/` met samen ~29 plannen.

**Blok E is nu af, dus de helft van deze afspraak is ingelost.** De wachtrij komt aan de beurt
zodra blok F loopt — en een deel ervan (DX-01, code splitting) hóórt vóór de eerste deploy.

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

- **SEC-01 (`keys().hasOnly` ontbreekt)** — deels al gedaan: `onderhoudstaken` sinds `5e6553d`,
  `meters` en `meterstanden` sinds E7. Voor de overige tien collecties geldt het nog wél, en
  het is een reële bevinding: op onbekende veldnamen staat geen lengtelimiet. De claim
  "onbeperkt grote blobs" is wel overdreven — `withinSizeLimit()` begrenst het aantal velden.
  **`verify:rules` controleert de whitelists nu automatisch**, dus uitbreiden naar de rest is
  goedkoper geworden: één regel in de rules plus één regel in `WHITELISTS`.
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

## Bekende bugs — open, gevonden bij de live test van 1 augustus

Volledige beschrijving in `2026-08-01-bevindingen-live-test.md`. Kort:

| # | Wat | Waar |
| --- | --- | --- |
| BUG-01 | Een bedrag met een komma (`1250,50`) wordt geweigerd: de opschoning strippt de punt maar niet de komma, dus `Number()` geeft `NaN` | `Bouwdepot.tsx:170`, `Meerwerk.tsx:207`/`:233`, `Nabudget.tsx:65`, `Oplevering.tsx:170`, `Projectinstellingen.tsx:141` |
| BUG-02 | Een aangevinkte datum kan in de zomertijd een dag terugspringen: `new Date()` in plaats van `opDag(new Date())` | `Bouwdepot.tsx:133`, `Dashboard.tsx:180` |

Nog te reproduceren: of het bouwdepot verder nog iets mist, en of er datumbugs zijn buiten
BUG-02 om.

## Open vragen / wacht op Seth

- **Reproductie van de bouwdepot-melding.** Welk veld, welk scherm, wat ingetypt, wat er daarna
  stond. Eén concreet geval is genoeg. BUG-01 verklaart het waarschijnlijk, maar dat is een
  aanname tot het nagespeeld is.
- **Welke termen zijn onduidelijk voor een leek?** Kandidaten uit de UI die rechtstreeks uit de
  ADR's komen: "anker", "offset", "waardenBron", "opschortingsrecht", "bandbreedte",
  "aanlooptijd".
- **Is `firebase deploy --only firestore` gedraaid?** Zie de waarschuwing hierboven.
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

**Drie collecties hebben `keys().hasOnly(...)` in de rules:** `onderhoudstaken`, `meters` en
`meterstanden`. Overal elders begrenzen de rules alleen het aantal velden, waardoor een
onbekende veldnaam erdoorheen glipt. Bij deze drie woog dat zwaarder: zonder de whitelist kan
iemand een `volgendeOp` of een `verbruik` meesturen en is de afgeleide waarde ineens
opgeslagen — precies wat ADR-0008 uitsluit.

**Komt er een veld bij in `model.ts`, dan moet het ook in die lijst**, anders weigert elke
write met een generieke permissiefout. Sinds E7 controleert `npm run verify:rules` dat
automatisch, zónder emulator: hij leest de interfaces uit `model.ts` en vergelijkt ze met de
`hasOnly`-lijsten. Negatief getest op beide richtingen (veld te weinig, veld te veel).

**Een dalende meterstand of een datum in de toekomst wordt gemeld, niet rechtgerekend.** De
datum is de gevaarlijkere van de twee: een fout jaartal deelt het verbruik door een veel te
groot aantal dagen en levert een getal op dat er plausibel uitziet, zónder melding — 0,76 per
dag in plaats van 9,68. Daarom is een toekomstdatum geweigerd op drie lagen (formulier, rules
met twee dagen marge, en afkapping in de rekenkern). Gevonden bij de verificatiepass.

**Twee opnames op dezelfde dag maken óók de vólgende periode onbetrouwbaar.** De vervolgperiode
begint bij één van die twee, en welke dat is hangt af van het Firestore-document-id — dat is
willekeurig. Zonder die markering kiest de app stil een waarde. Hetzelfde geldt op het
overdrachtsdossier, waar dat getal de eindafrekening met de leverancier voedt.

**Een filter dat op één scherm klopt, kan via een ander scherm alsnog lekken.** Het
overdrachtsdossier liet onderdelen met `blijftBijWoning: false` terecht weg uit het
onderdelenblok — maar het lógboek toonde ze alsnog met naam én kosten. De belofte aan de koper
was daarmee via de zijdeur gebroken. **Bij een filter: loop na of álle secties die door
dezelfde regel gedekt worden hem ook toepassen**, niet alleen de sectie waar hij is bedacht.

**Een structuur die gegevens doorgeeft die de weergave toevallig niet toont, is een lek dat
wacht.** `Overdrachtsdossier` gaf eerst het hele `woningpaspoort` door, inclusief `notaris` en
`hypotheekverstrekker`. Er werd niets van gerenderd, dus er lekte niets — tot de volgende
weergavelaag. Nu een expliciete projectie (`Dossierpaspoort`) met een test die de veldenlijst
vastpint. Zelfde patroon als bij `Dossierbetrokkene`: **wat er niet in de structuur zit, kan
niet per ongeluk op papier komen.**

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
  (76 kB gzip)** na E3, en E4 en E7 kwamen daar nog bij. Elk nieuw scherm zit in dezelfde
  chunk, en drie bibliotheken (17 onderdelen met merken en specvelden, 30 onderhoudstaken,
  10 metersoorten) zitten nu in de bundle van iedereen die inlogt — ook wie nog midden in de
  bouw zit en `/onderhoud` pas over een jaar opent. **Route-based code splitting is inmiddels
  meer waard dan het opsplitsen van de firebase-chunk.** Doen zodra blok E af is, vóór het
  live gaan. Een grafiek op `/meterstanden` is om dezelfde reden uitgesteld (ADR-0015).
- **`Meterkaart` krijgt twaalf inline callbacks en een nieuw gefilterde array per render.**
  Bij een handvol meters irrelevant, maar het is de plek om naar te kijken zodra die grafiek
  er alsnog komt.
- **Sourcemaps worden meegebouwd** (~4,7 MB). Prima om te debuggen, maar vóór een publieke
  deploy een bewuste keuze maken.
- **`SOURCEMAP_BROKEN`-waarschuwing** van `@tailwindcss/vite`. Cosmetisch.
- **Eén anker per type is afgevangen bij het lezen, niet structureel.** Een harde garantie zou
  het document-id gelijkstellen aan het ankertype; dat is een migratie waard zodra er
  productiedata is.
