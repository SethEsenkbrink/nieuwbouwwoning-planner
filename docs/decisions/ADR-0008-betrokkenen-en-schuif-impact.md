# ADR-0008 — Betrokkenen en schuif-impact als kernfunctie

**Status:** Geaccepteerd
**Datum:** 2026-07-29

## Context

De projectbrief noemde de documentparser als het onderscheidende stuk. Tijdens sessie 02
bleek uit het eigen traject van de bouwer een probleem dat urgenter is en dieper zit.

De situatie: er is een **indicatieve** opleverdatum, geen definitieve. Die schuift
regelmatig. Elke verschuiving veroorzaakt een cascade naar de partijen die de koper zélf
heeft ingeschakeld — keuken, tegels, vloer, stukadoor, waterontharder, verhuizing. Gevolg:
veel mailverkeer, handmatig omrekenen van datums, en het risico dat iemand met een
verouderde datum blijft zitten.

### Wat het probleem écht is

Het is geen planningsprobleem. Het is een **synchronisatieprobleem**: er bestaan twee
soorten waarheid naast elkaar.

1. De datum die de koper weet.
2. De datum die elke partij afzonderlijk denkt te weten.

Bij elke verschuiving lopen die uit elkaar, en de koper moet handmatig reconstrueren wie
wat weet. Daar zit het werk, en daar zit het risico.

Een generieke planner of agenda lost dit niet op: die kent alleen jouw kalender, niet wie
er nog een oude datum in zíjn agenda heeft staan. Het verschil tussen "de datum" en "de
laatst gecommuniceerde datum" is precies de informatie die nergens wordt bijgehouden.

### De tweede fout: te vaak communiceren

Een naïeve implementatie mailt bij elke wijziging iedereen. Dat maakt het erger. Schuift de
oplevering drie keer, dan heb je drie keer iedereen lastiggevallen met een datum die
opnieuw niet klopte — en na de derde keer neemt niemand je planning nog serieus.

Wie je moet informeren hangt niet af van *of* er iets wijzigde, maar van *of het voor die
partij nu al uitmaakt*.

## Beslissing

De **betrokkenen- en schuif-impactmodule** wordt de eerste echte feature, vóór de
fase-tijdlijn en vóór de documentparser. Het ontwerp rust op vijf principes.

### 1. Een opleverdatum heeft een staat, geen enkele waarde

| Staat | Betekenis | Gedrag |
|---|---|---|
| `indicatief` | "ergens in week 45" | Niemand definitief boeken |
| `bandbreedte` | vroegst week 44 – laatst week 50 | Alleen lange aanlooptijden waarschuwen |
| `aangezegd` | formele aanzegging van de aannemer | Nu pas iedereen definitief inplannen |

In Nederland zegt de aannemer de opleverdatum formeel aan, meestal enkele weken van
tevoren. Alles daarvóór is een schatting. De app moet dat onderscheid kennen, want het
bepaalt wie je wel en niet benadert.

Daarom slaan we drie datums op — `opleverVroegst`, `opleverVerwacht`, `opleverLaatst` —
plus de staat en de bron ("mail aannemer 12-07"). Die bron is belangrijk: bij de derde
verschuiving wil je terug kunnen zien wie wat wanneer beweerde.

### 2. Afspraken hangen aan een anker, niet aan een datum

Een afspraak wordt opgeslagen als **ankerpunt + offset in dagen**, nooit als vaste datum.
De datum is altijd afgeleid.

Dat is de hele truc: verschuift het anker, dan verschuift alles mee zonder dat iemand iets
hoeft om te rekenen. Sla je de datum wél op, dan heb je bij elke schuif een migratie —
precies het handwerk dat we willen wegnemen.

Ankerpunten zijn niet alleen de oplevering, maar ook bouwmomenten: `dekvloer_gestort`,
`wind_waterdicht`, `ruwbouw_gereed`. Reden: de keuken-inmeter komt niet "zes weken vóór
oplevering", hij komt zodra de wanden staan. Die twee lopen uiteen zodra de bouw
ongelijkmatig schuift, en dat is nou juist wat er gebeurt.

### 3. Twee eigenschappen per betrokkene bepalen wanneer je moet handelen

- **Aanlooptijd** — hoeveel tijd heeft deze partij nodig tussen "ik weet het" en
  "ik sta er"? Keuken 8–10 weken, vloerenlegger 2–4 weken, verhuisbus een week.
- **Annuleertermijn** — tot wanneer kan hun afspraak kosteloos verzet worden? Een bus
  annuleren kan tot 48 uur van tevoren gratis. Een keuken die in productie is, niet meer.

Het snijpunt van die twee levert het getal dat er werkelijk toe doet: **de laatste dag
waarop je nog gratis kunt schuiven**. Dat hoort op het dashboard te staan, niet de
opleverdatum zelf.

### 4. Elke betrokkene krijgt een communicatieregel

| Regel | Wanneer informeren |
|---|---|
| `direct` | bij élke wijziging — voor partijen met een lange aanlooptijd |
| `bij_aanzegging` | pas als de opleverdatum definitief is |
| `handmatig` | nooit automatisch voorstellen; jij beslist |

Dit ene veld haalt naar verwachting het grootste deel van het mailverkeer weg. De
verhuisbus hoeft niets te weten zolang de datum indicatief is; de keukenleverancier wel.

### 5. Het verschil tussen berekend en gecommuniceerd ís de actielijst

Elke afspraak draagt `gecommuniceerdeDatum`: de datum die deze partij als laatste van jou
heeft gekregen. Wijkt de berekende datum daarvan af, dan staat die afspraak op de
actielijst. Vink je "doorgegeven" aan, dan lopen ze weer gelijk en verdwijnt de regel.

Wat overblijft is je werklijst. Niets meer, niets minder.

## Urgentiebepaling

De actielijst is gesorteerd, niet alfabetisch maar op wat er kapotgaat als je niets doet:

| Niveau | Voorwaarde |
|---|---|
| **Kritiek** | De annuleertermijn wordt binnen 7 dagen gepasseerd, óf de oude gecommuniceerde datum valt al binnen de aanlooptijd — deze partij staat straks voor niets klaar |
| **Hoog** | De nieuwe berekende datum valt binnen de aanlooptijd; ze moeten het nu weten om het te halen |
| **Normaal** | Afwijking, maar ruim op tijd |
| **Wacht** | `communicatieregel = bij_aanzegging` en de opleverdatum is nog niet aangezegd |

Elke regel toont niet alleen *dat* er iets moet, maar *waarom nu*.

## Domeinregels die de app moet kennen

Deze horen in de standaardbibliotheek, niet in de hoofden van gebruikers:

- **Dekvloer moet drogen.** Een cementdekvloer heeft ruwweg een week droogtijd per
  centimeter; bij een gangbare dikte al gauw vijf tot zeven weken. Een vloerenlegger hoort
  daarom aan het anker `dekvloer_gestort` te hangen plus droogtijd, niet aan de
  opleverdatum. Wie dat verkeerd plant, staat met een te vochtige vloer of een
  geannuleerde afspraak.
- **Inmeten kan pas als de wanden staan.** Keuken en tegelwerk hangen aan `ruwbouw_gereed`
  of `wind_waterdicht`, niet aan oplevering.
- **Opzegtermijnen lopen door.** Huur opzeggen van de huidige woning is een maand, en die
  termijn begint pas te lopen op de eerste van de maand. Te vroeg opzeggen is duurder dan
  te laat.
- **Plan afbouw nooit op de opleverdatum zelf.** Er zijn opleverpunten en restwerk. Een
  buffer van minimaal een week is realistisch.

De concrete waarden staan in `docs/archief/2026-07-29-betrokkenen-standaardlijst.md`. Dat zijn
**startwaarden**, geen wetten — de gebruiker overschrijft ze per leverancier.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
|---|---|---|---|
| Vaste datums per afspraak opslaan | Simpelst te bouwen en te begrijpen | Bij elke schuif moet elke datum handmatig om — precies het probleem dat we oplossen | Verplaatst het handwerk in plaats van het weg te nemen |
| Koppelen aan Google Agenda | Vertrouwde omgeving, notificaties gratis | Een agenda kent geen aanlooptijd, geen annuleertermijn, en niet wat een partij denkt te weten. De cascade blijft handwerk | Lost de kern niet op. Kan later als export |
| Automatisch mailen bij elke wijziging | Geen handwerk | Bij drie verschuivingen mail je iedereen drie keer met een datum die niet klopt; je verliest geloofwaardigheid | Erger dan het probleem |
| **Ankers + offsets + communicatieregel** | Eén datumwijziging werkt overal door; je benadert alleen wie het nu aangaat | Meer invulwerk bij het opzetten, en het datamodel is complexer | Gekozen |

## Gevolgen

**Positief:** dit is de eerste feature waarvan de bouwer deze week al profijt heeft. Het
dwingt het datamodel bovendien meteen langs het moeilijkste stuk — afgeleide datums en
statusbeheer — waardoor de fase-tijdlijn erna eenvoudiger wordt in plaats van moeilijker.

**Negatief:** de gebruiker moet per betrokkene een aanlooptijd en annuleertermijn invullen.
Dat is drempelverhogend. Gemitigeerd met een standaardbibliotheek met realistische
startwaarden, zodat invullen neerkomt op bevestigen of bijstellen.

Daarnaast is de correctheid van de actielijst volledig afhankelijk van of de gebruiker
"doorgegeven" aanvinkt. Doet hij dat niet, dan wordt de lijst ruis. Die actie moet dus in
één klik kunnen, direct naast het concept-bericht.

**Terugdraaien:** duur zodra er data in staat. Het datamodel is de kern van deze feature;
komen we erop terug, dan is dat een migratie. Daarom eerst het model vastleggen en
voorleggen, vóórdat de rekenmotor gebouwd wordt.

## Wat dit betekent voor de documentparser

De parser (fase 2 in `PROJECT.md`) wordt hierdoor waardevoller, niet minder waardevol.
Een aannemingsovereenkomst bevat termijnen en bouwfases; die kunnen straks rechtstreeks
ankerpunten en afspraken worden in plaats van losse taken. De volgorde is dus: eerst het
model waar de parser naartoe schrijft, dan de parser.
