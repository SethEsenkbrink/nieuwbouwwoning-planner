# ADR-0018 — Het dashboard als overzicht, niet als werklijst

**Status:** geaccepteerd
**Datum:** 2026-08-02
**Vervangt gedeeltelijk:** ADR-0008, principe 5 (zie §4)

---

## Context

ADR-0008 principe 5 zegt: het verschil tussen de berekende datum en wat een partij als laatste
van je hoorde is *"het enige dat werk voor je oplevert"*. Daaruit volgde dat de actielijst het
dashboard opent. Acht sessies lang is dat de opbouw geweest.

Op 2 augustus 2026 heeft de gebruiker het scherm met echte gegevens bekeken en gezegd:

> *"Dan kom je in het dashboard en dat wordt helemaal vaag en niet overzichtelijk, allemaal
> kaarten en dingen moeten doorgeven enz, de manier van opbouw geen idee? Datums die mij niks
> zeggen. Dit is een dashboard die niet overzichtelijk is."*

En, een dag eerder al:

> *"Er is geen dashboard waarin je bijvoorbeeld meldingen hebt met wat grafieken en kosten enz,
> een soort totaaloverzicht."*

**Die tweede opmerking is feitelijk onjuist en volledig terecht tegelijk.** Het geldblok
bestónd, met vastgelegd meerwerk, betaald depot en een budgetwaarschuwing. Het stond als
zevende sectie onderaan, tussen "Bouwmomenten" en "Betrokkenen". `PROJECT.md` §6 had er sinds
sessie 05 een vinkje bij staan.

De opbouw was: kop → tot vijf losse waarschuwingssecties → veertien actiekaarten van elk ruim
tien regels → vier snelkoppelingen. Wie het dashboard opende zag dus een kop en dan meteen
werk, zonder ooit te zien hoe het project ervoor stond.

## Beslissing

**Het dashboard opent met de stand van zaken. De actielijst zakt naar de vierde laag.**

| Laag | Wat | Waarom daar |
| --- | --- | --- |
| 1 | Kop: naam, aannemer | waar gaat dit over |
| 2 | Vier kerncijfers | hoe sta je ervoor, in één oogopslag |
| 3 | Twee grafieken: bouwvoortgang en geld | het beeld achter de cijfers |
| 4 | Wat er moet gebeuren | het werk — urgent zichtbaar, de rest ingeklapt |
| 5 | Snel naar | de rest van de app |

Vier bijbehorende regels:

1. **Rekenen gebeurt in `lib/dashboard.ts`, niet in de render.** De oude component was 621
   regels waarin acht secties elk hun eigen filter en telling deden. Daar valt niets aan te
   testen zonder de hele component te monteren, en dus is er acht sessies lang niets aan
   getest. De nieuwe rekenkern is puur en heeft 31 tests.

2. **"Niets ingevuld" is niet hetzelfde als "nul".** Elk kerncijfer heeft een `ingevuld`-vlag.
   Een leeg meerwerkbudget toont een streepje met de handeling die het oplost, niet `€ 0` —
   dat las als een kapotte app in plaats van als een leeg veld.

3. **Elke datum krijgt zijn afstand mee.** `over 12 weken — 28 okt 2026` in plaats van
   `28 okt 2026`. Bij de veertiende regel rekent niemand meer zelf uit of dat ver weg is.

4. **Alleen wat urgent is of binnen dertig dagen speelt staat open.** Van de veertien partijen
   bij de live test stonden er twaalf op "kan nog even". Veertien regels waarvan er twaalf
   kunnen wachten is geen werklijst maar een archief.

## Waarom dit ADR-0008 principe 5 niet tegenspreekt

Principe 5 gaat over **wat** de app moet opleveren: het verschil tussen berekend en
gecommuniceerd. Dat blijft ongewijzigd — de actielijst is nog steeds de kern van het product,
en de doorgegeven-knop staat nog steeds in de dichte regel en niet achter een uitklap.

Wat er verandert is de **volgorde op één scherm**. Principe 5 zei iets over prioriteit in de
functionaliteit, en dat is stilzwijgend vertaald naar prioriteit in de verticale positie. Dat
is een andere claim, en die bleek niet te kloppen: een lijst met werk waar je geen context bij
hebt is geen werklijst maar een stapel.

**De les die breder geldt:** een vinkje in `PROJECT.md` meet of iets gebouwd is, niet of het
werkt. "Grafieken en totaalbeeld over budget, meerwerk en depot" stond afgevinkt terwijl de
gebruiker die de app zelf had laten bouwen het niet kon vinden.

## Gevolgen

**Goed:**

- Het dashboard beantwoordt nu de vraag "hoe staat het ervoor" vóór de vraag "wat moet ik doen".
- De rekenkern is testbaar en getest.
- Zes losse waarschuwingssecties zijn één aandachtslijst geworden.
- Een actieregel is van ruim tien regels naar één regel gegaan, met de details op één klik.

**Kosten en risico's:**

- **De doorgegeven-knop staat lager op het scherm.** Als die minder wordt ingedrukt, lopen
  berekend en gecommuniceerd verder uit elkaar en wordt de lijst binnen twee verschuivingen
  ruis. Dat is het reële risico van deze beslissing. **Te toetsen bij het live gaan:** hoeveel
  afspraken hebben na een maand nog nooit een `gecommuniceerdeDatum`?
- Wie gewend was aan de oude opbouw moet één keer opnieuw zoeken.
- Vier kerncijfers en twee grafieken is nieuwe weergavecode; die is niet in unit tests te
  vangen. Alleen de rekenkern eronder is getest.

## Alternatieven die zijn afgevallen

**De actielijst bovenaan houden en de cijfers eronder.** Dan blijft "geen totaaloverzicht"
staan: je moet nog steeds langs veertien kaarten scrollen om te zien hoe je ervoor staat.

**Twee kolommen: cijfers links, acties rechts.** Ziet er vol uit en valt op mobiel alsnog onder
elkaar, waarmee het probleem terugkomt zonder dat iemand het gekozen heeft.

**Een chart-bibliotheek toevoegen voor de grafieken.** Recharts kost ~100 kB in een bundle die
al op 334 kB staat, voor twee grafieken die met CSS exact te maken zijn. Zelfde afweging als in
ADR-0016; de drie runtime-dependencies blijven drie.
