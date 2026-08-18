# ADR-0015 — Meterstanden: de meter en de opname zijn twee dingen

**Status:** Geaccepteerd
**Datum:** 2026-08-01

## Context

Blok E7 uit `docs/archief/2026-07-31-bouwplan-en-backlog.md` is één regel lang: *"handmatige opnames met
een verbruikstrend. Bewust simpel: geen koppeling met slimme meters."* Dat zegt wat het niet
wordt, maar niet hoe het model eruitziet — en juist daar zit de keuze.

### Wat een Nederlandse nieuwbouwwoning te meten heeft

Meer dan "stroom, gas, water", en dat is precies het probleem:

| Wat | Eenheid | Bijzonderheid |
| --- | --- | --- |
| Stroom levering normaal (1.8.2) en dal (1.8.1) | kWh | Twee registers bij een dubbeltarief-aansluiting, één bij enkeltarief |
| Stroom **teruglevering** normaal (2.8.2) en dal (2.8.1) | kWh | Alleen met zonnepanelen. Loopt op, net als de rest |
| Gas | m³ | Bij een all-electric nieuwbouwwoning is er geen gasaansluiting |
| Water | m³ | Aparte meter, aparte leverancier, ander opnamemoment |
| Warmte (stadsverwarming) | GJ | In plaats van gas, niet ernaast |
| Tussenmeter warmtepomp, laadpaal, thuisbatterij | kWh | Niet standaard, wel precies wat je wilt weten |

Seths woning is all-electric met zonnepanelen en waarschijnlijk een thuisbatterij (ADR-0013).
Een vaste lijst met "stroom / gas / water" zou bij hém al twee van de zes registers missen.

### Waarom teruglevering apart bijhouden nu meer waard is dan vorig jaar

De **salderingsregeling stopt op 1 januari 2027**, in één keer en zonder afbouwpad. Vanaf dat
moment worden afname en teruglevering apart afgerekend in plaats van tegen elkaar weggestreept.
Wie zijn eigen registers niet bijhoudt, kan de afrekening van de leverancier vanaf 2027 niet
meer controleren — en heeft geen basis om te beoordelen of een thuisbatterij zich terugverdient.

Dat is geen reden om er een rekentool van te maken. Het is wel de reden dat
`teruglevering_normaal` en `teruglevering_dal` volwaardige meters zijn en geen bijzaak.

### De vraag die dit ADR beslecht

Een meteropname is onmiskenbaar een feit over de buitenwereld, dus hij wordt opgeslagen
(ADR-0008). Maar bij welk ding hoort de opname? Twee vormen zijn mogelijk, en de goedkoopste
is niet de goede.

## Beslissing

**Er komen twee subcollecties: `meters` beschrijft wát je meet, `meterstanden` wat de meter
aanwees.** Het verbruik daartussen wordt nooit opgeslagen.

```
users/{uid}/projects/{projectId}
  ├── meters/{meterId}
  │     - soort (stroom_enkel | stroom_normaal | stroom_dal
  │             | teruglevering_enkel | teruglevering_normaal | teruglevering_dal
  │             | gas | water | warmte | overig)
  │     - naam?             // eigen naam; bij `overig` verplicht
  │     - eenheid (kWh | m3 | GJ)
  │     - meternummer?, notitie?
  │     - waardenBron       // ADR-0009 — de eenheid komt uit de bibliotheek
  └── meterstanden/{opnameId}
        - meterId
        - opgenomenOp       // een feit: wanneer je gekeken hebt
        - stand             // een feit: wat er stond
        - notitie?
```

### 1. De meter is een eigen document, geen tekstveld op de opname

De verleiding is één collectie met `meternaam` als string op elke opname. Dat scheelt een
collectie en een scherm, en het gaat mis op de manier die in dit project vaker is
langsgekomen: stil.

Eén typefout — `"tussenmeter WP"` naast `"tussenmeter wp"` — splitst de reeks in twee halve
reeksen. De trend over de gesplitste helft klopt niet meer, er staat geen foutmelding, en de
enige manier om het te merken is dat het getal raar aanvoelt. Dezelfde vorm als de
`undefined === undefined`-koppeling uit sessie 06: geen crash, wel onzin.

Bijkomend: `eenheid` en `meternummer` zijn eigenschappen van de méter, niet van de opname. Op
elke opname meesturen is duplicatie die scheef groeit zodra iemand er één corrigeert.

De prijs is eerlijk: één subcollectie meer (12 → 14), een extra formulier, en een lees-ronde
extra bij het openen van het scherm. Bij een woningdossier gaat het om enkele meters en
tientallen opnames per jaar, dus dat weegt niet.

### 2. Vaste lijst én vrij toevoegen — de bibliotheek stelt voor, hij dwingt niet

`src/data/meters-standaard.ts` levert per soort een label, de eenheid, het aantal decimalen en
een toelichting. Kiest de gebruiker `overig`, dan vult hij naam en eenheid zelf in.

Dit is hetzelfde patroon als bij de merken in `onderdelen-standaard.ts` (ADR-0013): **een lijst
die veroudert mag geen harde regel worden.** De rules valideren daarom wel de enum `soort` en
de enum `eenheid` — die twee zijn eindig en beheersbaar — maar nooit de naam.

`waardenBron` staat op `voorstel` zolang de eenheid uit de bibliotheek komt, en op `eigen`
zodra de gebruiker hem aanpast. Zonder dat onderscheid is een aanname van de app niet te
onderscheiden van iets wat de gebruiker heeft nagekeken (ADR-0009, constraint C5).

### 3. Verbruik wordt berekend, nooit opgeslagen

Tussen twee opeenvolgende standen van dezelfde meter volgt het verbruik, het aantal dagen en
het gemiddelde per dag. Alle drie zijn afgeleid en horen dus niet in Firestore — dezelfde regel
als bij de afspraakdatums (ADR-0008) en `laatstUitgevoerdOp` (ADR-0014).

Dat is hier geen dogma maar direct nut: corrigeer je een verkeerd overgetypte stand, dan
kloppen de periodes ervóór én erná meteen weer. Was het verbruik opgeslagen, dan stond er na
die correctie een periode met een getal dat niet meer bij de standen past, en zou elke
correctie een migratie zijn.

**Beide collecties krijgen daarom `keys().hasOnly([...])` in de rules** — na `onderhoudstaken`
de tweede en derde met een gesloten veldenlijst, en om dezelfde reden: zonder die whitelist kan
een client doodleuk een `verbruik` meesturen en staat de afgeleide waarde alsnog in de
database. De veldlimiet alleen houdt dat niet tegen; die laat bij `meters` dertien vrije
veldnamen met onbegrensde lengte toe, en dan is een `meterFoto` met base64 erin gewoon
toegestaan — precies wat constraint C2 uitsluit.

`npm run verify:rules` vergelijkt beide whitelists met de interfaces in `model.ts`, zodat een
vergeten veld opvalt zónder emulator. Dat is nieuw: tot nu toe was de enige bewaking een
rules-test, en die draait niet mee in `npm run verify`.

### 4. Een dalende stand is een gebeurtenis, geen negatief verbruik

> **Aangevuld tijdens de bouw, vóór acceptatie.** De verificatiepass vond twee gaten in de
> onderstaande redenering: een datum in de toekomst, en twee opnames op dezelfde dag. Allebei
> vallen ze onder dezelfde regel, dus ze staan hieronder in plaats van in een eigen ADR.

Een meterstand loopt op. Staat er toch een lagere stand dan de vorige, dan is er iets gebeurd:

| Oorzaak | Hoe vaak |
| --- | --- |
| Typefout bij het invoeren | Het vaakst |
| Meter vervangen — de nieuwe begint bij 0 | Bij een storing of een slimme-meterupgrade |
| Mechanische meter loopt om (99999 → 00000) | Zeldzaam, maar niet nooit |

De naïeve berekening `nieuw - oud` levert in alle drie de gevallen een groot negatief getal op,
dat vervolgens de trend en het gemiddelde vergiftigt. Daarom: **de periode wordt gemarkeerd als
`betrouwbaar: false` met een reden, telt niet mee in de trend, en de UI zegt wat er waarschijnlijk
aan de hand is.**

De app rekent hier bewust niets recht. Automatisch een omloop of een metervervanging
compenseren betekent gokken welke van de drie het was, en bij een typefout is dat gokwerk
schadelijker dan de melding. Dit is dezelfde afweging als bij de ondergrens op `voorkeursmaand`
en op de garantiedeadline: een correctie zonder ondergrens produceert stil een fout getal.

#### De datum is de gevaarlijkere helft

Een fout in de **stand** valt op — hij wordt gemarkeerd. Een fout in de **datum** niet, en dat
is de ergere van de twee:

| | Typefout in de stand | Typefout in het jaartal |
| --- | --- | --- |
| `1000 → 1300` over 30 dagen | 9,7/dag ✓ | — |
| `1000 → 130` (cijfer vergeten) | gemarkeerd als gedaald | — |
| `2026 → 2027` bij dezelfde standen | — | 396 dagen, **0,76/dag** — plausibel, betrouwbaar gemarkeerd, geen melding |

Factor 12 mis, en de meter blijft daarna ruim een jaar als "vers" gelden en verdwijnt van het
dashboard. Daarom is een opname met een datum in de toekomst **geweigerd** in plaats van
gemarkeerd — er is geen legitiem geval waarin je de stand van volgende maand al kent.

Dat gebeurt op drie plekken: in het formulier (meteen zichtbaar), in de rules met een marge van
twee dagen (`opgenomenOp < request.time + 2d`), en in de rekenkern door `dagenSindsOpname` af te
kappen op nul voor data die vóór deze regel is opgeslagen. De marge is nodig omdat
`opgenomenOp` UTC-middernacht is: wie in Nederland om 00:30 zomertijd een stand van "vandaag"
noteert, schrijft een tijdstip weg dat op de server nog in de toekomst ligt.

#### Twee opnames op dezelfde dag maken óók de vólgende periode onbetrouwbaar

De periode tussen twee opnames van dezelfde dag is nul dagen lang en werd al gemarkeerd. Maar
de periode dáárna begint bij één van die twee — en welke dat is, hangt af van de
sorteervolgorde, die bij een gelijke datum terugvalt op het Firestore-document-id. Dat is
willekeurig.

Concreet: iemand noteert 12345, ziet de typefout, voegt dezelfde dag 12354 toe en vergeet de
eerste te verwijderen. Vanaf dat moment is elke volgende periode 50/50 goed of negen kWh mis,
zonder melding. De app zou daar dus stilzwijgend een waarde kiezen — precies wat deze paragraaf
elders afwijst. Beide periodes zijn nu onbetrouwbaar, met de melding "verwijder de overbodige
opname".

### 5. Geen koppeling met slimme meters, en dat blijft zo

Er komt geen P1-poort, geen API van de netbeheerder, geen import uit Energieleveren.nl.
Handmatige opnames, meer niet.

Reden: elke geautomatiseerde bron vraagt een serverside integratie met een credential per
gebruiker, en dat botst met C1 (geen andere backend), C3 (gratis) en het uitgangspunt dat
Netlify Functions stateless zijn. De bestaande onderhoudstaak *"Meterstanden noteren"*
(`voorkeursmaand: 1`) is de herinnering; die stond er al vóór dit ADR.

### 6. Waar het hangt

Een eigen scherm `/meterstanden`, gegate op `woningStatus === "opgeleverd"` — net als
`/onderhoud`. Meterstanden van een woning die nog niet bestaat zijn zinloos, en het scherm zou
tijdens de bouw alleen ruis in de navigatie zijn.

De taak *"Meterstanden noteren"* blijft staan en verwijst hierheen. Het alternatief — het
formulier ophangen aan het afvinken van die taak — is afgevallen: de historie en de trend zijn
het punt van E7, en die passen niet in een afvinkdialoog.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
| --- | --- | --- | --- |
| Eén collectie met `meternaam` als string | Eén collectie, één formulier minder | Een typefout splitst de reeks stil; eenheid en meternummer worden op elke opname gedupliceerd | De fout is onzichtbaar, en dat is in dit project de duurste soort |
| Alleen een vaste lijst met soorten | Simpelste rules, geen `overig` | Tussenmeter warmtepomp, laadpaal en batterij kunnen niet — precies de meters waar iemand met een all-electric woning naar kijkt | Sluit de interessantste toepassing uit |
| Volledig vrije meternamen, geen enum | Maximale vrijheid | Geen eenheid, geen decimalen, geen voorstelwaarden, en de rules kunnen niets valideren | Levert een notitieblok op met extra stappen |
| Verbruik per periode opslaan | Direct te tonen zonder rekenen | Een gecorrigeerde stand maakt elke afgeleide periode ongeldig; elke correctie wordt een migratie | Dezelfde fout als vaste afspraakdatums (ADR-0008) |
| Omloop en metervervanging automatisch compenseren | Geen "onbetrouwbaar" in beeld | De app moet gokken welke van de drie oorzaken het was; bij een typefout verbergt de compensatie de fout | Stil een fout getal is erger dan zichtbaar geen getal |
| Een grafiek in deze ronde | Trend in één oogopslag | `App-*.js` staat al op 290 kB en groeit per scherm; code splitting staat nog open | Uitgesteld tot na de code splitting, niet afgewezen |
| Koppeling met de slimme meter (P1 / netbeheerder-API) | Geen handwerk | Credential per gebruiker serverside, en een stateful integratie | Botst met C1 en C3; expliciet uitgesloten in het bouwplan |

## Gevolgen

**Positief.** Het verbruik is altijd consistent met de standen, want het wordt elke keer
opnieuw gerekend. Een verkeerd overgetypte stand corrigeer je op één plek. De meters zijn
uitbreidbaar zonder codewijziging zodra iemand een tussenmeter of laadpaal heeft. En vanaf de
afschaffing van de saldering in 2027 is de afname/teruglevering-splitsing gewoon aanwezig,
zonder dat het model daarvoor om moet.

**Negatief.** Twee subcollecties erbij (12 → 14), dus twee match-blokken in de rules, twee
converters, een extra ronde in de verwijder-lus van het project, en een scherm dat twee
soorten documenten beheert in plaats van één. De `hasOnly`-lijst op `meterstanden` erft de
bekende valkuil van `onderhoudstaken`: **komt er een veld bij in `model.ts`, dan moet het ook
in die lijst**, anders weigert élke write met een generieke permissiefout.

**Terugdraaien.** Van twee collecties naar één is een migratie zodra er opnames in staan: elke
opname zou de meternaam en eenheid mee moeten krijgen. Andersom (van één naar twee) is duurder,
want dan moeten reeksen die door een typefout gesplitst zijn met de hand samengevoegd worden.
Dat asymmetrische risico is de reden om meteen voor twee te kiezen.

## Wat dit níét verandert

- ADR-0008 blijft onverkort: een afgeleide waarde wordt nooit opgeslagen. Dit ADR breidt die
  regel uit naar het verbruik tussen twee standen.
- ADR-0009: de eenheid uit de bibliotheek is een voorstel en wordt als zodanig gelabeld.
- ADR-0010 §3 en constraint C2: er wordt geen foto van de meterstand opgeslagen. Een `notitie`
  bij de opname mag; een afbeelding niet, ook niet als base64.
- ADR-0014 §3: de herinnering blijft de lijst op het dashboard. Geen e-mail tot ronde 8.

## Bronnen

- [Salderingsregeling stopt in 2027 — Rijksoverheid.nl](https://www.rijksoverheid.nl/themas/klimaat-milieu-en-natuur/energie-thuis/salderingsregeling)
- [Afschaffen salderingsregeling vanaf 2027 — Ondernemersplein](https://ondernemersplein.overheid.nl/wetswijzigingen/afschaffen-salderingsregeling-vanaf-2027/)
