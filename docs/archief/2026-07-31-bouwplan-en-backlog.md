# Totaaloverzicht — van de eerste regel code tot wat er nog komt

**Datum:** 2026-07-31 · **Status:** werkdocument

> **Rol van dit bestand:** het complete beeld in één document. Deel 1 en 2 zijn de
> geschiedenis en de huidige stand; deel 3 is de wachtrij. Alles is genummerd zodat er per
> punt over te praten valt.
>
> `PROJECT.md` blijft de vaste waarheid en `STATE.md` de levende status. Zodra een blok
> hieronder definitief is, verhuist het naar `PROJECT.md` §6 en verdwijnt het hier.

---

# DEEL 1 — Wat er gebouwd is

Vijf sessies, 29 t/m 31 juli 2026.

## Sessie 01 — 29 juli · Het fundament

**Doel:** alles neerzetten waarop gebouwd wordt. Geen features.

Vooraf zijn alle versies live tegen de npm-registry gecontroleerd in plaats van uit het
hoofd. Dat leverde meteen vier correcties op de projectbrief op:

| Uit de brief | Werkelijkheid | Gevolg |
|---|---|---|
| `react-router-dom` | EOL op 7.18.2 | Overgestapt op `react-router` 8 (ADR-0004) |
| Tailwind 3.4 | 4.3.3 is stabiel | Huisstijl geport naar CSS-first (ADR-0002) |
| Node 20 | 24 is de actieve LTS | `.nvmrc` en `netlify.toml` aangepast |
| `exports.handler` | Netlify gebruikt web-standaard `Request`/`Response` | `health.mts` in de nieuwe vorm |

TypeScript 7 bleek onbruikbaar: `typescript-eslint` ondersteunt het niet, waardoor alle
type-aware lintregels zouden vervallen — inclusief `no-floating-promises`, precies de regel
die vergeten `await`s op Firebase-calls vangt. Daarom TypeScript 6 (ADR-0003).

**Opgeleverd:** het docs-systeem (`PROJECT.md`, `STATE.md`, `CONTEXT.md`, `WORKFLOW.md`,
ADR-0001 t/m 0006), alle configs, Firestore-rules met default-deny en veldvalidatie,
de huisstijl in Tailwind v4 met een `verify:tokens`-script dat faalt bij drift, het logo
(gevel-silhouet, wordmark als outlines zodat het niet van een geïnstalleerd font afhangt),
en de auth-flow met beschermde routes.

**Twee vangnetten in ESLint** die de projectconstraints bewaken: importeren van
`firebase/storage` of `react-router-dom` geeft een error met verwijzing naar de ADR.

**Wat niet lukte:** de rules-tests konden niet draaien (JDK-versie + geblokkeerde download),
en git liep vast op een `.git/index.lock` die niet verwijderd kon worden op de Drive-mount.

## Sessie 02 — 29 juli (avond) · Aan de praat krijgen, en de koers bepalen

**Verhuisd uit Google Drive** naar `C:\dev\projecten\`. Aanleiding: `node_modules` is
606 MB over 33.966 bestanden; Drive houdt file handles open en veroorzaakt willekeurige
`EPERM`/`EBUSY`-fouten.

**Firebase ingericht** — project live, rules en indexes gedeployed. Bewust weggelaten uit de
config: `storageBucket` (Storage gebruiken we nooit) en `measurementId` (Analytics ook niet).

**Vier bugs, alle vier fundamenteel:**

1. **15 `npm audit`-meldingen** uit één devDependency. `npm audit fix --force` zou
   `@netlify/vite-plugin` elf minor versies downgraden. Opgelost met `overrides` (ADR-0007).
2. **CSP met newlines liet de dev-server bij élke request crashen.** HTTP-headers mogen geen
   newlines bevatten. Opgelost, plus een nieuw `verify:headers`-script dat elke header door
   Node's eigen `Headers.set()` haalt.
3. **Witte pagina bij ontbrekende config** — `firebase.ts` gooide bij het laden van de module
   een fout, vóórdat React kon renderen. Nu een dynamische import met een `OpstartFout`-scherm.
4. **De productie-CSP gold ook lokaal** en blokkeerde Vite's inline preamble en de
   HMR-websocket. Élke component-module faalde, en het foutscherm uit bug 3 kon zichzelf
   daardoor ook niet tonen. Opgelost met een eigen tien-regelige Vite-plugin `stripCspInDev`.

**En het belangrijkste van de hele sessie: de productrichting.** Uit het eigen traject bleek
een probleem dat urgenter is dan de documentparser. Er is een *indicatieve* opleverdatum die
steeds schuift, en elke verschuiving veroorzaakt een cascade naar de partijen die je zelf hebt
ingehuurd. De kern is geen planningsprobleem maar een **synchronisatieprobleem**: het verschil
tussen de datum die jij weet en de datum die elke partij afzonderlijk denkt te weten.

Vastgelegd in **ADR-0008** met vijf principes:

1. Een opleverdatum heeft een **staat** (indicatief / bandbreedte / aangezegd) en is een
   **band**, geen enkele waarde.
2. Afspraken hangen aan een **anker + offset**, nooit aan een vaste datum.
3. Per betrokkene: **aanlooptijd** × **annuleertermijn** → de laatste dag waarop je nog
   gratis kunt schuiven.
4. Per betrokkene een **communicatieregel** — dit haalt het grootste deel van het mailverkeer
   weg.
5. Het verschil tussen berekende en **gecommuniceerde** datum ís de actielijst.

## Sessie 03 — 30 juli · Datamodel en rekenkern

**ADR-0009** kwam hieruit voort. Bij het uitwerken bleken drie gaten die ADR-0008 openliet,
alle drie over hetzelfde: *de app weet dingen met verschillende mate van zekerheid, en dat
verschil verdween in het model.* Opgelost met `waardenBron` op de betrokkene, een
`zekerheid`-veld op de returnwaarde van `berekenDatum()`, en rekenen over de hele band.

**Opgeleverd:** het datamodel (`ankers`, `betrokkenen`, `afspraken` + de opleverband op
`Project`), de bijbehorende Firestore-rules, de standaardbibliotheek met 38 partijen, en de
rekenmotor `planning.ts` — puur TypeScript, geen Firestore, geen React, 37 tests.

**De rules-tests draaiden voor het eerst — en vonden meteen iets ernstigs.**
`request.resource.size()` telt de eigenschappen van het Resource-object, niet de velden van
het document; daarvoor moet je `request.resource.data.size()` gebruiken. De check stond er
sinds sessie 01 en **heeft nooit iets geweigerd**. Een document van vijfhonderd velden was in
álle collecties toegestaan — ook een gat in constraint C2, want die limiet is er juist om te
voorkomen dat iemand een document als opslagplek gebruikt.

Het compileert zonder klacht, `firebase deploy` accepteert het, en de andere 51 tests bleven
groen omdat die met kleine documenten werken. De enige manier om het te vinden was de test die
er expliciet op controleerde — precies de test die anderhalve sessie niet was uitgevoerd.

Na de fix 53/53 groen en gedeployed.

## Sessie 04 — 30 juli (avond) · De laag ertussen, en de eerste schermen

**Datalaag in drie bestanden met een bewuste scheiding:**

| Bestand | Kent Firebase? | Testbaar zonder emulator |
|---|---|---|
| `converters.ts` | alleen `Timestamp` | ja |
| `betrokkenen.ts` | nee | ja |
| `projecten.ts` | ja, volledig | nee |

De converters lezen defensief: een onbekende enum-waarde wordt `undefined` in plaats van
doorgegeven. Eén test gaat verder dan mapping: `slaat geen afspraakdatum op` telt de
`Timestamp`-velden in een geschreven afspraak en eist dat het er nul zijn — een vangnet onder
ADR-0008 dat niet van oplettendheid afhangt.

**Opgeleverd:** de wizard op `/project/nieuw` (hervatbaar: het project wordt na stap 1
aangemaakt), `/betrokkenen` met aanpasbare termijnen en het voorstel-label, en een dashboard
met de opleverband.

**In de browser getest** tegen de emulator: 17 partijen en 19 afspraken in één batch, alle
writes langs de rules zonder aanpassing.

## Sessie 05 — 31 juli · Blok A tot en met D

De grootste sessie tot nu toe. Begonnen met de bouwmomenten en de actielijst, geëindigd met een
app die het hele bouwtraject dekt. Het volledige verhaal staat in
`sessions/2026-07-31-sessie-05.md`; hier de kern:

- **Blok A** — `/ankers`, de actielijst, `/afspraken`, betrokkenen volledig beheren,
  `/project`, concept-berichten en de wat-als
- **Blok B** — `verify:rules` (vijf scenario's negatief getest), één anker per type, project
  verwijderen, foutafhandeling
- **Blok C** — `/tijdlijn`, `/meerwerk` (ADR-0011), `/bouwdepot` en de grafieken
- **Blok D** — `/oplevering` met het 5%-depot en de garantieklokken (ADR-0012),
  `/na-oplevering`
- **De navigatie** van elf losse links naar vijf groepen
- **Drie ADR's erbij** (0010, 0011, 0012) plus een index in `decisions/README.md`

**Twee dingen gingen mis en staan als les vastgelegd.** De sessie meldde de hele dag "lint is
groen" terwijl eslint nooit gedraaid had — achtergrondprocessen worden in de sandbox afgekapt,
en een leeg logbestand werd gelezen als "geen fouten". En de emulator bleek daar niet te
draaien; dat is uitgezocht in plaats van aangenomen. Beide staan nu als tabel in `STATE.md`.

# DEEL 2 — Waar we nu staan

## De app in cijfers

| | |
|---|---|
| Schermen | 10 achter login, plus de wizard en de auth-schermen |
| Unit tests | **220** in 14 bestanden, geen emulator nodig |
| Rules-tests | **79**, apart met `npm run rules:test` |
| ADR's | 12, met index in `docs/decisions/README.md` |
| Sessies | 5 |

## Wat er af is

**Blok A t/m D**, plus de navigatie-herindeling. De app dekt het hele bouwtraject: van de
koopovereenkomst tot en met de garantietermijnen.

| Blok | Stand |
|---|---|
| **A** — kernlus afmaken | ✅ af |
| **B** — technische schuld | ✅ af, behalve B4 (live gaan, bewust uitgesteld) |
| **C** — bouwtraject compleet | ✅ af, behalve C5 (documentparser, staat in ronde 8) |
| **D** — oplevering en garantie | ✅ af |
| **E** — woningdossier | ⬜ volgende |
| **F** — fundament en kwaliteit | ⬜ na het lokale testen |

## De kernlus draait

Bouwmoment schuift → alle afspraken die eraan hangen schuiven mee → wie een verouderde datum
heeft komt op de actielijst, gesorteerd op wat er kapotgaat → concept-bericht kopiëren →
doorgeven → regel verdwijnt. Dat is het hart van ADR-0008, en het werkt end-to-end tegen de
emulator.

## Wat er nu níét kan

- **Niets van blok E**: geen woningpaspoort, geen onderdelenregister, geen onderhoudsschema.
  De app stopt bij de garantietermijnen.
- **Geen documentparser** (C5): alles wordt met de hand ingevoerd.
- **Niet live** (B4): draait alleen lokaal tegen de emulator.
- **Geen herinneringen**: de app meldt zich niet uit zichzelf. Dat wordt een voorwaarde zodra
  blok E er is — onderhoud over acht maanden werkt alleen als iemand het ziet.

# DEEL 3 — Wat er nog gebouwd moet worden

## A. De kernlus afmaken

Zonder deze punten is de module technisch af maar praktisch onbruikbaar.

**~~A1. Afsprakenscherm.~~** ✅ **Klaar (31 juli).** `/afspraken` — overzicht per betrokkene
met de afgeleide datum en de zekerheid, en een formulier voor bouwmoment + dagen ervóór/erna +
duur + status + waarschuwing + notitie, met een live voorbeeld van de datum die eruit komt.

**~~A2. Afspraak toevoegen en verwijderen.~~** ✅ **Klaar (31 juli).** Inclusief bevestiging
vóór het verwijderen.

**~~A3. Betrokkene toevoegen en verwijderen.~~** ✅ **Klaar (31 juli).** Compleet formulier
inclusief contactpersoon, e-mail en telefoon. Verwijderen neemt de bijbehorende afspraken mee
in één atomaire batch, want een afspraak zonder partij is onzichtbaar.

**~~A4. Opleverdatum aanpassen buiten de wizard.~~** ✅ **Klaar (31 juli).** `/project`, met de
opleverdatum bovenaan. De formulieren zijn uitgetrokken naar `components/` zodat de wizard en
dit scherm dezelfde velden gebruiken; de omzetting naar de drie opgeslagen datums staat in
`src/lib/opleverband.ts` met tests, inclusief een nieuwe volgordecontrole op de band.

**~~A5. Concept-berichten.~~** ✅ **Klaar (31 juli).** Uitklapbaar en bewerkbaar per regel, met
kopieerknop en `mailto:`-link. De tekst past zich aan de situatie aan (eerste melding of
wijziging, punt of bereik) en bevat altijd een voorbehoud dat meebeweegt met de zekerheid van
de berekening — een schatting mag in een mail niet als afspraak overkomen. Er wordt niets
vanuit de app verstuurd.

**~~A6. Wat-als bij het verschuiven van een anker.~~** ✅ **Klaar (31 juli).** Op `/ankers` en
`/project`, vóór het opslaan: welke afspraken verschuiven en hoeveel dagen, wie er buiten de
kosteloze annuleertermijn valt (gerekend op de **huidige** datum, want dat is de afspraak die
verzet moet worden) en wie het meteen moet weten om het nog te halen.

> **Blok A is hiermee af.** Invoeren, bijsturen, signaleren, communiceren en vooruitkijken:
> de kernlus is compleet.

**~~A7. Projectgegevens bewerken.~~** ✅ **Klaar (31 juli).** Onderaan `/project`. Koopsom en
meerwerkbudget waren nergens invulbaar en staan er nu bij — bewust niet in de wizard, want bij
het aanmaken weet je ze vaak nog niet.

## B. Gaten in wat er al staat

**~~B1. `verify:rules`-script.~~** ✅ **Klaar (31 juli).** 15 enums en 63 waarden, plus de
ankertypes in de standaardbibliotheek. Parseert per `match`-blok in plaats van op vaste
tekstankers, en is negatief getest op vijf scenario's. Zit in `npm run verify`.

**~~B2. Eén anker per type.~~** ✅ **Klaar (31 juli).** `haalAnkers()` dedupliceert bij het
lezen en `zetAnker()` overschrijft het bestaande anker van dat type. Een harde garantie
(document-id = ankertype) is een migratie waard zodra er productiedata is.

**~~B3. Project verwijderen.~~** ✅ **Klaar (31 juli).** Onderaan `/project`, achter het
overtypen van de projectnaam. Alle acht subcollecties in batches, projectdocument als laatste
zodat een half mislukte verwijdering geen onbereikbare data achterlaat.

**B4. Netlify live zetten.** Repo koppelen, env vars, authorized domain, en de
CSP-`eval`-melding verifiëren op de deploy preview. **Bewust uitgesteld tot ronde 8.**

**~~B5. Opruimen.~~** ✅ **Klaar (31 juli).** `voegAnkerToe`, `werkAnkerBij` en
`werkBetrokkeneBij` zijn verwijderd.

**~~B6. Foutafhandeling.~~** ✅ **Klaar (31 juli).** `src/lib/opslagFouten.ts` onderscheidt
offline, geweigerde invoer (`permission-denied` — opnieuw proberen helpt niet) en de rest.
Een automatische retry is er nog niet; `isTijdelijk()` staat klaar voor wie dat wil bouwen.

**B7. Meerdere afspraken per partij met verschillende termijnen.** Bewuste ruil uit sessie 03
(de langste termijn staat op de partij), maar het blijft een compromis.

## C. Het bouwtraject compleet maken

**~~C1. Fase-tijdlijn~~** ✅ **Klaar (31 juli).** `/tijdlijn` — de zeven fases met status en
streefdatum, elk met de aandachtspunten die er in die fase toe doen. De actiepunten worden
bewust géén taken: ze staan als suggestie, met één klik om er een eigen taak van te maken.

**~~C2. Taken met deadlines~~** ✅ **Klaar (31 juli).** Per fase, met deadline, afvinken en
verwijderen. Verlopen taken staan bovenaan, afgevinkte onderaan.

**~~C3. Meerwerk-tracker~~** ✅ **Klaar (31 juli).** `/meerwerk`, met **ADR-0011**: de
sluitingsdatum is standaard een **vaste datum** — de keuzelijst van de aannemer gaat dicht vóór
de start van de bouw en schuift dus níét mee als de bouw verschuift. Meerwerk dat tijdens de
bouw opkomt kan wél aan een bouwmoment gehangen worden. Inclusief budgetoverzicht tegen het
meerwerkbudget van het project.

**~~C4. Bouwdepot~~** ✅ **Klaar (31 juli).** `/bouwdepot`, met de drie stappen los van
elkaar. Bovenaan staat wat jíj moet doen — facturen die nog niet bij de bank zijn ingediend —
in plaats van wat er al betaald is.

**~~Grafieken / totaalbeeld~~** ✅ **Klaar (31 juli).** `Voortgangsbalk` op `/bouwdepot` en
`/meerwerk`, plus een Geld-kaart op het dashboard. Bewust zonder chart-bibliotheek.

**C5. Documentparser.** `pdf.js` client-side → platte tekst naar een Netlify Function → LLM
haalt termijnen, bedragen en bouwmomenten eruit → jij controleert → pas dán naar Firestore.
Het bestand wordt nooit opgeslagen. Dit was ooit de kernfeature en is waardevoller geworden,
omdat er nu een datamodel is om naartoe te schrijven.

## D. Oplevering en garantie

**~~D1. Opleverchecklist~~** ✅ **Klaar (31 juli).** `/oplevering` — opleverpunten met locatie,
meldatum en hersteltermijn. Verstreken termijnen bovenaan; herstelde punten blijven staan, want
ze horen bij het proces-verbaal. Geen foto's: constraint C2 blijft gelden.

**~~D2. 5%-opschortingsregeling~~** ✅ **Klaar (31 juli).** Bovenaan `/oplevering`, met
**ADR-0012**: de keuze en het bedrag worden opgeslagen, de uiterste datum wordt afgeleid uit de
onderhoudstermijn en schuift dus mee. Het bedrag wordt bewust níét uit de koopsom gerekend — de
5% geldt over de aanneemsom, en de koopsom bevat ook de grond.

**~~D3. Onderhoudstermijn~~** ✅ **Klaar (31 juli).** Aftelklok op `/oplevering`, afgeleid uit
het anker `einde_onderhoudstermijn` of anders uit de oplevering plus 90 dagen — met de bron
erbij, zodat een standaardtermijn niet voor een contract wordt aangezien.


**~~D4. Garantietermijnen~~** ✅ **Klaar (31 juli).** Vier aftelklokken onderaan
`/oplevering`, allemaal afgeleid van de opleverdatum en dus niet opgeslagen. Wat binnen 90
dagen afloopt wordt gemarkeerd. Fabrieksgaranties per apparaat horen bij het onderdelenregister
(blok E) — zonder te weten wélke ketel erin zit is elke termijn een gok.

**~~D5. Budget na oplevering~~** ✅ **Klaar (31 juli).** `/na-oplevering`, met vijftien
standaardposten om aan te vinken en twee bedragen per post: geraamd en werkelijk. Bewust geen
richtbedragen — de spreiding is te groot en een verzonnen getal blijft als anker hangen.

> **Blok D is hiermee af.**

## E. Het woningdossier — de tweede helft van de app

> **Nieuw. Verandert de scope van `PROJECT.md` en vereist ADR-0010 vóórdat we bouwen.**

Na de sleuteloverdracht houdt de app niet op. Hij wordt het dossier van de woning: wat erin
zit, wanneer het onderhouden moet worden, en wat er al gedaan is.

### Waarom dit past

De mechaniek die er al staat past er bijna één-op-één op:

| Bouwtraject | Woningdossier |
|---|---|
| anker (bouwmoment) | installatiedatum of laatste onderhoudsbeurt |
| offset in dagen | onderhoudsinterval |
| betrokkene met aanlooptijd | servicepartij / installateur |
| `gecommuniceerdeDatum` | "afspraak staat gepland" |
| actielijst op urgentie | onderhoudslijst op urgentie |

Eén wezenlijk verschil, en dat is een echte modeluitbreiding: **onderhoud is terugkerend**,
bouwafspraken zijn eenmalig. Er moet een `interval` + `laatstUitgevoerdOp` bij, plus een regel
die na afvinken de volgende keer berekent.

### De onderdelen

**E1. Woningpaspoort** — adres, bouwnummer, type, bouwjaar, oppervlakte, energielabel,
aannemer, garantiewaarborg + polisnummer, notaris, hypotheekverstrekker.

**E2. Onderdelenregister** — per installatie: merk, type, serienummer, installatiedatum,
installateur, garantietermijn, en waar de handleiding staat. Warmtepomp of cv-ketel, WTW-unit,
zonnepanelen + omvormer, waterontharder, groepenkast, vloerverwarmingsverdeler, boiler,
dakbedekking, kozijnen, hang- en sluitwerk.

**E3. Onderhoudsschema, afgeleid en niet handmatig.** Een standaardbibliotheek per
onderdeeltype, net als bij de betrokkenen: WTW-filters elk half jaar, cv-onderhoud jaarlijks,
zout in de waterontharder maandelijks controleren, rookmelders testen per maand en vervangen
na tien jaar, aardlekschakelaar per kwartaal, dakgoten in het najaar, radiatoren ontluchten
vóór het stookseizoen, kitvoegen badkamer na vijf tot tien jaar, buitenschilderwerk na vijf
tot zeven jaar. Startwaarden met hetzelfde voorstel-label als bij de betrokkenen (ADR-0009).

**E4. Garantie-aftelklokken per onderdeel** — "nog drie maanden fabrieksgarantie op de
warmtepomp, laat hem nu nakijken." Dat is het moment waarop informatie geld waard is.

**E5. Terugkerende controles** — rookmelder, CO-melder, aardlekschakelaar, veiligheidsventiel
cv, waterdruk. Kort af te vinken, met historie.

**E6. Logboek** — wat is er wanneer gedaan, door wie, wat kostte het. Zowel onderhoud als
verbouwingen. Bij verkoop het waardevolste deel van het dossier.

**E7. Meterstanden** — handmatige opnames met een verbruikstrend. Bewust simpel: geen
koppeling met slimme meters.

**E8. Overdrachtsdossier** — alles in één client-side gegenereerde PDF.

### Drie dingen die eerst beslist moeten worden

1. **Eén app of twee?** Voorstel: één app met een `woningStatus`
   (`in_aanbouw` / `opgeleverd`). De sleuteloverdracht is de omslag; het dashboard verandert
   van inhoud, niet van plek. De continuïteit ís de waarde.
2. **Constraint C2 gaat knellen.** Mensen willen handleidingen, facturen en foto's bewaren;
   bestandsopslag mag niet (ADR-0005). Binnen de constraint kan wél: alle gegevens
   gestructureerd overnemen plus een link naar waar het bestand staat. Dit moet expliciet in
   ADR-0010, anders sluipt Storage er over een half jaar alsnog in.
3. **Onderhoud een jaar vooruit werkt alleen als iemand het ziet.** Daarmee wordt de
   scheduled Netlify Function met e-mail (nu fase 3) een voorwaarde in plaats van luxe.
   Netlify heeft scheduled functions in het gratis plan; de mailprovider moet nog gekozen.

## F. Fundament en kwaliteit

**F1. Live zetten** (zie B4) — zonder dit is er geen echte gebruiker.
**F2. Data-export** als JSON. Ook een vangnet tegen lock-in bij een gratis plan.
**F3. Toegankelijkheid** — toetsenbordnavigatie, focusvolgorde, contrast.
**F4. Mobiel** — het meeste hiervan gebruik je met je telefoon in de hand in de bouwput.
**F5. Meerdere woningen per gebruiker.** Uitgesteld in `PROJECT.md` §9, maar bij een dossier
dat tien jaar meegaat komt dit terug.

---

# DEEL 4 — De vastgestelde volgorde

**Afgestemd met Seth op 2026-07-31.** Dit is niet langer een voorstel maar de afspraak.

| Ronde | Wat | Waarom nu |
|---|---|---|
| 1 | A1, A2, A3, A4, A7 | Zonder deze schermen kun je de app niet met echte gegevens vullen |
| 2 | A5, A6 | Maakt de kernlus af: van signaleren naar daadwerkelijk communiceren |
| 3 | B1, B2, B3, B5, B6 | Technische schuld opruimen — **zonder B4** |
| 4 | C1–C4 + grafieken | Tijdlijn, taken, meerwerk, bouwdepot, met een totaalbeeld |
| 5 | D1–D5 | Oplevering en garantie — dit komt in de werkelijkheid eerst |
| 6 | E1, E2 | Het dossier begint bij vastleggen wát er in het huis zit |
| 7 | E3, E4, E5 | Het onderhoudsschema — hier bewijst het dossier zich |
| 8 | C5 (parser), E6–E8, F | De verdieping, en pas hier live gaan |

## De vier besluiten die hierbij horen

**1. Eén app, geen tweede product.** Vastgelegd in ADR-0010. De sleuteloverdracht zet
`woningStatus` om van `in_aanbouw` naar `opgeleverd`; het dashboard verandert van inhoud, niet
van plek.

**2. Geen bestandsopslag, ook niet in het dossier.** Constraint C2 en C3 blijven hard: het moet
op het kosteloze platform blijven draaien en er komt nooit Firebase Storage in. Wat wél mag
staat in ADR-0010 §3 — gestructureerde gegevens plus een link naar waar het bestand staat.

**3. Live gaan is uitgesteld (B4 en F1).** Eerst alles bouwen en door en door testen tegen de
Firestore-emulator. Netlify koppelen komt pas in ronde 8.

> **Let op: de emulator dekt niet alles.** Drie dingen kun je er niet mee vinden:
> composite indexes worden niet afgedwongen (een query die lokaal werkt kan in productie falen
> met "The query requires an index"), de productie-CSP en security headers gelden lokaal niet
> (`stripCspInDev`), en Netlify Functions draaien via de vite-plugin in plaats van de echte
> runtime. Die drie moeten op een deploy preview, hoe laat we ook live gaan.

**4. Blok D gaat vóór blok E.** De oplevering, de opleverpunten en de 5%-opschortingsregeling
komen in de werkelijkheid eerder dan het eerste onderhoud. De 5%-regeling is bovendien geld dat
je op één specifiek moment moet opeisen; dat moment komt maar één keer.

## Nog open richting Seth

- **Onderdelen voor E2.** Welke installaties zitten er in de woning (warmtepomp of cv-ketel,
  WTW, zonnepanelen, waterontharder), zodat de standaardbibliotheek daarop aansluit?
- **Mailprovider** voor de herinneringen uit blok E. Krijgt een eigen ADR.
- **Echte aanlooptijden** van de leveranciers, ter vervanging van de 38 schattingen.
