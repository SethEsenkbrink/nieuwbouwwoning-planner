# Herontwerpplan ronde 9 — van correct naar bruikbaar

> **Status:** voorstel. Wacht op akkoord van Seth vóór uitvoering.
> **Aanleiding:** de tweede live test (2 augustus 2026), twaalf schermafbeeldingen plus
> commentaar. Vult `2026-08-01-bevindingen-live-test.md` aan en vervangt die niet.
> **Reikwijdte:** dit is de grootste ronde sinds blok A. Hij raakt de wizard, het dashboard,
> elk bedragveld en de taal van de hele app.

---

## 1. De diagnose, in één alinea

De app is gebouwd vanuit het datamodel. Elk veld uit `model.ts` heeft een invoerveld gekregen,
elke nuance uit een ADR heeft een uitlegtekst gekregen, en elke collectie heeft een eigen
scherm gekregen. Dat is hoe je een correcte app bouwt, en het is ook hoe je een app bouwt die
je gebruiker niet kan lezen. Wat er nu misgaat is niet dat de app het verkeerde doet — het is
dat er te veel tegelijk staat, dat de belangrijkste getallen onderaan staan, en dat de app
vraagt om invoer zonder te zeggen waar die invoer straks vandaan komt of waar hij toe leidt.

**De tweede bevinding is nieuw en zwaarder dan die van 1 augustus:** de wizard gaat ervan uit
dat je aan het begin van je bouwtraject staat. Seth staat in de eindfase — de woning staat er
al. De app vraagt hem dus dingen die niet meer relevant zijn, en vraagt níét naar de dingen die
dat wél zijn. Een wizard die niet weet waar je staat, kan geen goede vragen stellen.

## 2. Drie regels waaraan elke beslissing hieronder getoetst is

**R1 — Toon eerst het getal, dan pas de uitleg.** Nu staat het omgekeerd: elke sectie opent met
twee zinnen context en eindigt met de cijfers. Wie de app dagelijks gebruikt kent die context
al en scrollt eroverheen. De uitleg verdwijnt niet, hij gaat achter een uitklap of naar een
tweede regel in kleiner grijs.

**R2 — Eén regel per ding, details op aanvraag.** Veertien partijen op het dashboard zijn nu
veertien kaarten van ruim tien regels. Datzelfde overzicht past op veertien regels. De details
blijven bestaan, maar je kiest zelf wanneer je ze ziet.

**R3 — Vraag alleen wat je nú nodig hebt, en zeg waarom.** Elk invoerveld dat blijft, krijgt
één korte zin die vertelt wat de app ermee gaat doen. Elk veld dat die zin niet verdient,
verdwijnt of verhuist naar de instellingen.

---

## 3. Blok W — De wizard

### W1. Nieuwe eerste stap: "Hoe ver is de bouw?"

**Het probleem:** de wizard begint bij projectnaam en aannemer, en gaat er impliciet van uit
dat de bouw nog moet beginnen. Bij een woning in de eindfase klopt de helft van wat er daarna
gevraagd en voorgesteld wordt niet meer.

**Het voorstel:** een nieuwe stap vóór alles, met de bestaande zeven bouwmomenten als keuze.

```
Waar staat de bouw nu?
  ○ De bouw moet nog beginnen
  ○ De bouw is begonnen
  ○ De begane grondvloer ligt
  ○ De ruwbouw staat            ← wanden staan, inmeten kan
  ○ Wind- en waterdicht
  ○ De dekvloer is gestort
  ○ De woning is opgeleverd     → dit is een woningdossier, geen bouwproject
```

**Wat die keuze doet — dit is de kern van de dynamiek:**

| Keuze | Gevolg |
| --- | --- |
| Alle momenten vóór de keuze | Krijgen status `gepasseerd`. De datums mag je later invullen, niet nu |
| De partijen in stap Betrokkenen | Wie al geweest is, wordt niet meer voorgesteld. Bij "ruwbouw staat" verdwijnt de keukeninmeter uit het voorstel niet, maar krijgt hij het label "kan nu" in plaats van "later" |
| De vraag naar de opleverdatum | Bij `dekvloer gestort` of later is "indicatief" onwaarschijnlijk; de wizard zet de keuze dan standaard op *bandbreedte* en legt uit waarom |
| Bij "al opgeleverd" | De wizard slaat de betrokkenen-stap over, zet `woningStatus: "opgeleverd"` en gaat door naar het woningpaspoort. Het bouwtraject is dan geschiedenis, geen planning |

**Waarom dit geen nieuw modelveld nodig heeft:** de ankers bestaan al, met `status`
(`verwacht` / `bevestigd` / `gepasseerd`). Deze stap vult ze alleen sneller in dan het
ankerscherm dat nu doet.

> **Te verifiëren vóór het bouwen:** hoe `planning.ts` omgaat met een anker dat `gepasseerd`
> is maar geen `verwachtOp` heeft. Als de rekenkern daarop terugvalt op de opleverdatum, is dat
> precies goed; valt hij op `undefined`, dan moet de wizard de datum wél vragen. Dit staat als
> eerste taak in de uitvoering, want het bepaalt hoe stap W1 eruitziet.

### W2. Nieuwe stap: "Geld"

**Het probleem:** de wizard vraagt niet naar geld. Koopsom en meerwerkbudget staan nu alleen op
`/project`, verstopt onder de projectgegevens — Seth heeft ze bij het aanmaken nooit gezien.
Gevolg: het geldblok op het dashboard toont `€ 0` en `€ 0`, en dat ziet eruit als een kapotte
app in plaats van als een leeg veld.

**Het voorstel:** een eigen stap met drie velden, alle drie optioneel, alle drie met een zin
die zegt waar het getal terechtkomt.

| Veld | Uitleg in de UI | Waar het naartoe gaat |
| --- | --- | --- |
| Koopsom | "Wat er in de koop-/aannemingsovereenkomst staat. De app rekent hiermee uit of je bouwdepot toereikend is." | `koopsom` |
| Meerwerkbudget | "Wat je maximaal aan meerwerk wilt uitgeven. Zodra je daaroverheen gaat, waarschuwt het dashboard." | `meerwerkbudget` |
| Bouwdepot | "Wat de bank in depot heeft gezet. Hiertegen zet de app de termijnen af." | **nieuw veld — zie beslispunt B3** |

Plus, alleen zichtbaar bij `dekvloer gestort` of later: **"Zijn er al termijnen gefactureerd?"**
met een enkel getal. Dat vult het bouwdepot niet, maar het zorgt dat het dashboard bij een
project in de eindfase niet als leeg opstart.

### W3. De opleverdatum-stap herschrijven

**Het probleem, letterlijk uit de test:** *"veel tekst en best wel vaag."* De stap opent met
een alinea van drie regels, gevolgd door een keuzeveld met een toelichting van nog eens vier
regels, gevolgd door een veld "Waar komt deze datum vandaan?" dat niet uitlegt waarom je dat
zou invullen. Seth vulde er `?` in.

**Het voorstel — dezelfde informatie, een derde van de tekst:**

| Nu | Wordt |
| --- | --- |
| Alinea van 3 regels boven het formulier | Weg. De vraag zelf legt het uit |
| "Hoe zeker is de datum?" + 4 regels toelichting per optie | "Hoe hard is deze datum?" · per optie één regel van maximaal 12 woorden |
| "Indicatief — een schatting" | "Een schatting — bijv. 'ergens in week 45'" |
| "Bandbreedte — tussen twee datums" | "Tussen twee datums — je weet vroegst en laatst" |
| "Aangezegd — formeel vastgelegd" | "Officieel aangezegd door de aannemer" |
| "Waar komt deze datum vandaan?" + 2 regels | "Waar heb je deze datum gelezen of gehoord?" · *"Bij de derde verschuiving wil je dit terug kunnen zien."* · met invulvoorbeeld in de placeholder |

De langere toelichting per optie verdwijnt niet uit het product — hij verhuist naar een
uitklap "Wat betekent dit voor mijn planning?" die de gevolgen laat zien in plaats van de
definitie te herhalen: *bij een schatting boekt de app niemand definitief in.*

### W4. De betrokkenen-stap: van 38 kaarten naar een leesbare lijst

**Het probleem:** achtendertig kaarten in acht categorieën, elk met naam, aanlooptijd,
annuleertermijn en soms een toelichting. Dat is vier schermen scrollen vóórdat je op "Verder"
kunt. Seth: *"de opzet is op zich wel mooi, alleen het zijn zoveel kaarten."*

**Het voorstel — drie wijzigingen samen:**

1. **Compacte regels in plaats van kaarten.** Per partij één regel: checkbox + naam. De
   aanlooptijd en annuleertermijn verschijnen pas *nadat* je aanvinkt, als grijze subregel.
   Ongekozen partijen kosten dan één regel in plaats van vier.
2. **Voorselectie op fase en op gangbaarheid.** Standaard staan de partijen open die bij jouw
   bouwfase horen; de rest zit achter *"Toon alle 38"*. Nutsvoorzieningen (energie, water,
   internet, gemeente) staan standaard aangevinkt — die heeft iedereen.
3. **Zelf toevoegen, in de wizard.** Per categorie een regel *"+ Zelf een partij toevoegen"*
   met naam en categorie. Aanlooptijd en annuleertermijn hoeven daar niet: die krijgen een
   veilige standaard van 14 / 7 dagen met `waardenBron: "voorstel"`, precies zoals de
   bibliotheekpartijen. **Dit ontbreekt nu volledig in de wizard** — het kan alleen achteraf op
   `/betrokkenen`, en dat is niet vindbaar op het moment dat je eraan denkt.

---

## 4. Blok D — Het dashboard

**Het probleem, letterlijk:** *"dat wordt helemaal vaag en niet overzichtelijk, allemaal
kaarten en dingen moeten doorgeven enz, de manier van opbouw geen idee? datums die mij niks
zeggen."*

Wat er nu staat, in volgorde: kop → tot vijf losse waarschuwingssecties → de actielijst met
veertien kaarten van elk tien regels → vier snelkoppelingskaarten. Het geldblok, het enige
totaalbeeld dat de app heeft, staat als zevende sectie helemaal onderaan. Wie het dashboard
opent ziet dus: een kop, en dan meteen werk. Nooit een overzicht.

### D1. De nieuwe opbouw — vijf lagen, van beeld naar detail

```
┌──────────────────────────────────────────────────────────────┐
│ 1. KOP        Akkerland 71 · Nijhuis                         │
│               Oplevering over 12 weken — 28 okt 2026         │
│               nog een schatting                              │
├──────────────────────────────────────────────────────────────┤
│ 2. VIER CIJFERS   [ 12 weken ] [ 6 acties ] [ €  ] [ €  ]    │
│                    tot sleutel  open        meerwerk  depot  │
├──────────────────────────────────────────────────────────────┤
│ 3. TWEE GRAFIEKEN                                            │
│    Bouwvoortgang            │   Geld                         │
│    ▓▓▓▓▓▓▓░░░ 4 van 7       │   ▓▓▓▓░░░░ meerwerk / budget   │
│    momenten gepasseerd      │   ▓▓░░░░░░ depot betaald       │
├──────────────────────────────────────────────────────────────┤
│ 4. WAT MOET ER GEBEUREN   — één lijst, één regel per ding    │
│    ● Verzekeraar — opstalverzekering    over 11 wk  [✓ door] │
│    ● Keukenleverancier — inmeten        over 12 wk  [✓ door] │
│    ● Energielabel verlopen              ← urgent             │
│    ▸ toon de 8 die kunnen wachten                            │
├──────────────────────────────────────────────────────────────┤
│ 5. SNEL NAAR    Bouwmomenten · Meerwerk · Bouwdepot · Partijen│
└──────────────────────────────────────────────────────────────┘
```

### D2. Laag 2 — de vier cijfers

Vier tegels, breed en rustig, met het getal groot en het label klein. Dit is wat Seth mist als
hij zegt "een soort totaaloverzicht".

| Tegel | Toont | Waarschuwt bij |
| --- | --- | --- |
| Tot de sleutel | "12 weken" · daaronder de datum en de hardheid | — |
| Open acties | Aantal partijen dat op een datum wacht | Rood zodra er één urgent is |
| Meerwerk | `€ vastgelegd` van `€ budget` | Rood boven budget |
| Bouwdepot | `€ betaald` van `€ totaal` | Oranje bij facturen die nog niet ingediend zijn |

Bij een leeg veld staat er niet `€ 0` maar een streepje met *"nog niet ingevuld"* en een link
die je er direct heen brengt. Het verschil tussen "nul euro" en "niets ingevuld" is precies
waar de verwarring van vandaag zat.

### D3. Laag 3 — de grafieken

Twee, niet meer. Beide gebouwd op de bestaande `Voortgangsbalk` — **er komt geen
chart-bibliotheek bij** (ADR-0016 en de drie-dependencies-regel blijven staan).

- **Bouwvoortgang:** de zeven bouwmomenten als segmenten. Gepasseerd = gevuld, verwacht =
  gearceerd, onbekend = leeg. Dit is meteen het antwoord op "waar sta ik".
- **Geld:** een gestapelde balk per stroom — meerwerk (overwogen / besteld / bevestigd) tegen
  het budget, en depot (gefactureerd / gedeclareerd / betaald) tegen het totaal. De logica
  hiervoor bestaat al in `telMeerwerk()` en `telDepot()`; er is geen nieuwe rekenkern nodig.

### D4. Laag 4 — één meldingenlijst in plaats van zes secties

Nu zijn er zes plekken die om aandacht vragen: energielabel, openstaande registraties,
onderhoud, garanties, meterstanden en de actielijst. Elk met een eigen kop, eigen inleiding en
eigen kaartvorm. Ze worden **één lijst**, gesorteerd op urgentie, met per regel:

```
● Verzekeraar — Opstal- en inboedelverzekering    over 11 weken · 21 okt   [Doorgegeven] ▸
```

Klikken op de regel klapt uit wat nu altijd zichtbaar is: de herkomst van de datum, wat die
partij nu weet, tot wanneer kosteloos verzetten kan, de inhoudelijke uitleg en "Bericht
opstellen". De zin *"Doorgegeven legt vast dat deze partij … van je heeft gehoord"* staat één
keer boven de lijst en niet veertien keer eronder.

**Wat er standaard zichtbaar is:** alleen wat urgent is of binnen dertig dagen speelt. De rest
zit achter *"toon de 8 die kunnen wachten"*. Veertien regels waarvan er twaalf "kan nog even"
zijn, is geen werklijst.

### D5. Datums die iets zeggen

Overal waar nu een kale datum staat, komt eerst de afstand in tijd:

| Nu | Wordt |
| --- | --- |
| `21 okt 2026` | `over 11 weken — 21 okt 2026` |
| `28 okt 2026` | `over 12 weken — 28 okt 2026` |
| binnen een week | `over 5 dagen — 7 aug` |
| verstreken | `3 dagen te laat — 30 jul` (in clay-deep) |

Eén hulpfunctie in `lib/datum.ts`, overal hergebruikt. Dit is de goedkoopste wijziging in het
hele plan en waarschijnlijk de meest merkbare.

---

## 5. Blok G — Geld wordt geld (lost BUG-01 op)

**Wat er nu gebeurt:** `1250,50` wordt geweigerd op zes schermen, met de melding *"Vul het
bedrag in als een getal, zonder euroteken"*. Het veld ziet er bovendien uit als elk ander
tekstveld — niets zegt dat het om geld gaat.

**Jouw keuze, vastgelegd:** er staat altijd een euroteken bij, en er wordt afgerond op hele
euro's. Het moet aanvoelen als geld invullen, niet als een getal invullen.

**Het voorstel:**

1. **`leesBedragInvoer()` in `src/lib/bedrag.ts`** — dezelfde vorm als `leesStandInvoer()` uit
   E7. Accepteert `1250`, `1.250`, `1250,50`, `1.250,50`, `€ 1.250`, met en zonder spaties.
   Rondt af op hele euro's. Weigert negatieve bedragen en tekst. Met tests.
2. **Component `<Bedragveld>`** — een tekstveld met een vast `€` links in het veld,
   `inputMode="decimal"` zodat een telefoon het numerieke toetsenbord opent, en formattering
   bij het verlaten van het veld: je typt `1250,50` en ziet `€ 1.251` staan zodra je verder
   klikt. Dat is de bevestiging dat het goed geland is, precies wat er nu ontbreekt.
3. **Alle zes de plekken erop aansluiten**, en de gekopieerde opschoonlogica weg:
   `Bouwdepot.tsx:170`, `Meerwerk.tsx:207` en `:233`, `Nabudget.tsx:65`, `Oplevering.tsx:170`,
   `Projectinstellingen.tsx:141`.
4. **Labels aanpassen.** "Koopsom in euro's" met de hint "Hele euro's, zonder punten of
   komma's" wordt "Koopsom" — de hint is overbodig zodra het veld het zelf regelt, en hij
   was bovendien een instructie om de bug heen.

## 6. Blok T — Datum en tijd (lost BUG-02 op)

`opDag(new Date())` op `Bouwdepot.tsx:133` en `Dashboard.tsx:180`, met een regressietest die de
zomertijdgrens afdekt. Daarna `grep` op `new Date()` in `src/routes/` om te bevestigen dat er
geen derde plek bijgekomen is.

## 6b. Blok H — Maandlastenprognose tijdens de bouw

> **Toegevoegd op 2 augustus op verzoek van Seth.** Dit is de enige nieuwe *feature* in ronde 9;
> al het andere is herontwerp of een bugfix. Wacht op akkoord over de plaats in de volgorde —
> zie beslispunt B6.

### H1. Wat de gebruiker eraan heeft

Tijdens de bouw loopt je maandlast op, en bijna niemand weet vooraf hoe hard. Je betaalt vanaf
het passeren van de akte, terwijl de woning er nog niet staat, en met elke aannemersfactuur
wordt die last hoger. Wie dat niet ziet aankomen, komt er per kwartaal achter.

De app heeft de gegevens die daarvoor nodig zijn al grotendeels in huis: de termijnen staan in
`/bouwdepot`, de bouwmomenten in `/ankers`, en de opleverdatum als band op het project. Wat
ontbreekt is de hypotheek zelf.

### H2. Hoe het écht werkt — dit wijkt af van hoe het meestal wordt uitgelegd

Nagezocht op 2 augustus 2026, want hier zit precies de fout die een verkeerde berekening
oplevert. Bij een annuïteiten- of lineaire hypotheek met bouwdepot (verplicht sinds 2013 als je
recht op renteaftrek wilt):

| Onderdeel | Wanneer | Waarover |
| --- | --- | --- |
| **Aflossing** | **direct vanaf dag 1** | over de **volledige** hypotheeksom, ook het deel dat nog in het depot staat |
| **Rente** | direct vanaf dag 1 | over de volledige som, **maar** je ontvangt depotrente over het saldo dat er nog in staat |
| **Netto rente** | — | daardoor effectief alleen over het **opgenomen** deel |

> **De denkfout die hier op de loer ligt** — en die in de vraagstelling zat: je maandlast stijgt
> niet doordat er geld uit het budget verdwijnt, maar doordat de **rentevergoeding** over het
> depot kleiner wordt. De aflossing staat vanaf de eerste maand op het volle bedrag en beweegt
> niet mee. Reken je het als "budget loopt leeg", dan komt de curve er anders uit.

**De formule wordt dus:**

```
maandlast(maand) = aflossing(volledige som)
                 + rente(hypotheekrente, opgenomen deel)
                 − rentevergoeding(depotrente, resterend depot)
```

En bij een depotrente die gelijk is aan de hypotheekrente — de meest voorkomende situatie bij
nieuwbouw — vallen die laatste twee tegen elkaar weg voor het niet-opgenomen deel. Vandaar dat
je bij een vol depot netto alleen de aflossing betaalt.

**Wat er bij het passeren al opgenomen is**, en dus vanaf de eerste maand rente kost:

- de **grond** (die zit niet in het depot);
- **termijnen die al vervallen waren** bij het passeren — bij een woning die al in aanbouw is
  kan dat het grootste deel zijn. Precies Seths situatie.

### H3. Welke gegevens erbij moeten

| Veld | Waarom | Standaard |
| --- | --- | --- |
| `hypotheekBedrag` | de noemer van alles | — |
| `hypotheekRente` | percentage | — |
| `hypotheekVorm` | `annuitair` · `lineair` · `aflossingsvrij` | `annuitair` |
| `hypotheekLooptijdMaanden` | 30 jaar is standaard, maar niet altijd | 360 |
| `depotRente` | vaak gelijk aan de hypotheekrente, niet altijd | volgt de hypotheekrente tot je hem aanpast |
| `grondbedrag` | wordt bij het passeren betaald, zit niet in het depot | — |
| `passeerdatum` | vanaf hier lopen de lasten | — |

**Wat er níét bij hoeft:** het termijnschema. Dat staat al in de `termijnen`-collectie met
bedrag en betaalstatus. Wel komt er één veld per termijn bij: **`verwachtBijAnker`**, zodat een
nog niet gefactureerde termijn een geschatte maand krijgt. Zonder dat kan de prognose alleen
het verleden tekenen en niet de toekomst — en juist de toekomst is de vraag.

Percentages worden **afgeleid, niet opgeslagen**: `bedrag / aanneemsom`. Dat volgt ADR-0008 —
een percentage dat je opslaat naast een bedrag gaat bij de eerste wijziging uit de pas lopen.

### H4. Wat het oplevert op het scherm

Een nieuw scherm `/maandlasten` onder de groep Geld, plus één regel op het dashboard:

- **Een lijngrafiek** van de maandlast over de bouwperiode, met de opleverdatum als markering.
  Gebouwd met dezelfde CSS-aanpak als `Voortgangsbalk` — **geen chart-bibliotheek** (ADR-0016).
- **Drie getallen:** wat je nú betaalt, wat je bij oplevering gaat betalen, en het verschil.
- **Een tabel per maand** met de opbouw: aflossing, rente, rentevergoeding, netto.
- **De aannames zichtbaar in beeld**, niet in een voetnoot. Elke regel toont waar hij vandaan
  komt en wat er verandert als je hem bijstelt.

### H4b. De gegevens worden in de wizard uitgevraagd, niet op het rekenscherm

**Vastgelegd op 2 augustus, expliciet door Seth:** de velden uit H3 horen in de **geldstap van
de wizard** (blok W2), niet pas op `/maandlasten`. Anders vult iemand een scherm in dat hij
alleen bereikt als hij al weet dat het bestaat.

Gevolg voor de volgorde: **blok 3 bouwt de invoer, blok 4 bouwt de berekening en het scherm.**
De wizard-geldstap krijgt daarmee twee groepen: wat de woning kost (koopsom, meerwerkbudget,
bouwdepot) en waarmee je hem betaalt (hypotheekbedrag, rente, vorm, looptijd, depotrente,
grondbedrag, passeerdatum). Alles optioneel — wie het nog niet weet, komt later terug, en het
maandlastenscherm zegt dan welk veld er nog mist in plaats van een leeg getal te tonen.

### H5. De grens die dit niet overgaat — constraint C5

De app **structureert, hij adviseert niet**. Dat staat al onder elk scherm ("geen juridisch of
financieel advies"), maar bij een maandlastenberekening is die zin niet genoeg. Drie regels:

1. **Bruto, niet netto.** Geen hypotheekrenteaftrek. Netto rekenen vereist inkomen,
   belastingschijf en eigenwoningforfait, en dan geeft de app een bedrag waar iemand zijn
   begroting op baseert. Dat is de grens over.

   **Wél benoemen dát het bestaat** (Seth, 2 augustus). Onder de uitkomst komt één regel: dat
   de betaalde hypotheekrente in Nederland doorgaans aftrekbaar is, dat het bedrag hierboven
   dus bruto is en je netto waarschijnlijk lager uitkomt, en dat de Belastingdienst en je
   hypotheekadviseur de plek zijn om dat uit te rekenen. Verzwijgen zou de prognose
   somberder maken dan de werkelijkheid — dat is óók misleidend, en dan zonder dat iemand het
   doorheeft.
2. **Geen leencapaciteit, geen advies over vorm of looptijd.** De app rekent door wat jij
   invult; hij vindt er niets van.
3. **Elke uitkomst staat naast zijn aanname.** Een getal zonder zichtbare aanname wordt een
   feit in het hoofd van de lezer.

> Ik ben geen financieel adviseur en deze berekening is er ook geen. **Laat de uitkomst
> naastleggen door je hypotheekadviseur** voordat je er iets op baseert — zeker de eerste keer,
> want dan zie je meteen of de aannames in de app bij jouw offerte passen.

## 7. Blok J — Jargon eruit

De termen uit de ADR's zijn rechtstreeks in de UI beland. Ze verdwijnen uit de interface; in de
code en de documentatie blijven ze staan.

| In de UI nu | Wordt | Waar |
| --- | --- | --- |
| anker | bouwmoment | `/ankers`, dashboard, afspraken |
| offset / offsetDagen | dagen vóór / ná dat moment | `/afspraken` |
| bandbreedte | tussen twee datums | wizard, `/project`, dashboard |
| aanlooptijd | hoe lang van tevoren zij het moeten weten | `/betrokkenen`, wizard |
| annuleertermijn | tot wanneer kosteloos verzetten | idem |
| waardenBron / voorstel | geschat door de app ↔ van jouw leverancier | `/betrokkenen` |
| opschortingsrecht | 5% achterhouden bij de notaris | `/oplevering` |
| woningpaspoort | gegevens van de woning | `/woning` |

## 8. Blok S — De overige schermen

Dezelfde drie regels toegepast op de elf schermen die hier verder niet uitgeschreven zijn. Per
scherm: openingsalinea's inklappen, kaarten naar regels, cijfer vóór uitleg. **Dit gebeurt
expliciet ná de dashboardronde**, zodat het patroon eerst op één plek bewezen is en daarna
herhaald wordt in plaats van elf keer opnieuw bedacht.

Volgorde op basis van hoe vaak een scherm open gaat: `/tijdlijn` → `/afspraken` →
`/betrokkenen` → `/ankers` → `/meerwerk` → `/bouwdepot` → de rest.

---

## 9. Wat dit raakt

| Laag | Wijziging | Risico |
| --- | --- | --- |
| `src/lib/bedrag.ts` | Nieuw: `leesBedragInvoer()` | Laag — pure functie met tests |
| `src/lib/datum.ts` | Nieuw: relatieve datumweergave | Laag — puur |
| `src/components/` | Nieuw: `Bedragveld`, `Meldingregel`, `Kerncijfer`, `Fasekeuze` | Laag |
| `src/routes/Dashboard.tsx` | Grotendeels herschreven (621 regels) | **Middel** — hier zit de meeste kans op regressie |
| `src/routes/ProjectWizard.tsx` | Van 3 naar 5 stappen | **Middel** — de "ga verder waar je gebleven was"-logica moet meegroeien |
| `src/types/model.ts` | Eén veld erbij: `bouwdepotBedrag` (beslispunt B3) | **Hoog** — raakt de rules |
| `firebase/firestore.rules` | Alleen bij B3 | Hoog — vergeten veld weigert élke write |
| `scripts/verify-rules.mjs` | Volgt automatisch bij een modelwijziging | — |

> **Als B3 doorgaat, geldt de regel uit `STATE.md`:** een nieuw veld in `model.ts` moet ook in
> de `hasOnly`-lijst, `npm run rules:test` moet groen zijn, en de rules moeten **in dezelfde
> sessie** gedeployed worden. Groene emulatortests zijn niet hetzelfde als gedeployed.

## 10. Volgorde van uitvoering

Vijf blokken, elk apart afrondbaar en testbaar. Na elk blok een tussenstand, geen
aaneengesloten reeks van zestien wijzigingen.

| # | Blok | Wat | Grootte | Status |
| --- | --- | --- | --- | --- |
| 1 | **G + T** | `leesBedragInvoer`, `Bedragveld`, zes call sites, de twee datumfixes | ½ sessie | ✅ **af** — 2 aug, verify groen |
| 2 | **D** | Dashboard opnieuw opbouwen: vier cijfers, twee grafieken, één meldingenlijst, relatieve datums | 1 sessie | 🔄 bezig — `vandaag()` en de relatieve datums staan er |
| 3 | **W** | Wizard: fasestap, geldstap, opleverdatum herschreven, betrokkenen compact + eigen partij | 1 sessie | |
| 4 | **H** | Maandlastenprognose — zie §6b | 1 sessie | wacht op B6 |
| 5 | **J** | Jargon eruit, app-breed | ¼ sessie | |
| 6 | **S** | De overige elf schermen, in de volgorde van §8 | 1–2 sessies | |

**Blok H staat op plek 4 en niet eerder, om twee redenen.** De prognose heeft de geldgegevens
uit de wizard (blok 3) nodig — bouw je hem daarvóór, dan vraag je die gegevens twee keer op
twee plekken. En het bevindingendocument waarschuwt in §6 expliciet: *"een nieuwe feature op
een interface die nu al te vol is, is de verkeerde volgorde."* Na blok 2 en 3 is die interface
opgeruimd en heeft de prognose een plek om te landen.

Blok 1 eerst omdat het klein en concreet is en twee bestaande frustraties wegneemt. Blok 2 vóór
blok 3, omdat het dashboard bepaalt welke gegevens de wizard eigenlijk moet ophalen — bouw je
de wizard eerst, dan vraag je mogelijk om velden die het nieuwe dashboard niet gebruikt.

**Bij elk blok hoort:** unit tests op nieuwe pure functies, `tsc --build --force` en de drie
verify-scripts in de sandbox, en `npm run verify` lokaal door jou. Bij blok 3 ook
`npm run rules:test` als B3 doorgaat.

**Documentatieplicht per blok:** `STATE.md` bijwerken, sessielog schrijven, en voor het
dashboard een ADR — **ADR-0018: het dashboard als overzicht in plaats van als werklijst**.
Die legt vast waarom de actielijst van de eerste plek naar de vierde laag gaat, want dat is een
omkering van wat ADR-0008 principe 5 voorschreef en dat moet later uit te leggen zijn.

## 11. Wat er in deze ronde níét gebeurt

- **De `improvements/`-wachtrij** (~29 auditplannen). Blijft staan tot vóór het live gaan.
- **C5 documentparser en de e-mailherinneringen.** Ronde 10.
- **Een chart-bibliotheek toevoegen.** De gestapelde balk dekt beide grafieken. Drie
  runtime-dependencies blijven drie.
- **Het datamodel omgooien.** Hooguit één veld erbij, en alleen als jij B3 goedkeurt.

---

## 12. Beslispunten — hierop wil ik akkoord vóór ik begin

| # | Vraag | Mijn voorstel |
| --- | --- | --- |
| **B1** | Gaat de actielijst van laag 1 naar laag 4 op het dashboard? | Ja. Eerst zien waar je staat, dan wat er te doen is. Vastleggen in ADR-0018 |
| **B2** | Verdwijnen de gepasseerde bouwmomenten uit de betrokkenen-voorstellen? | Ja, maar zichtbaar achter "toon alles" — niet stil weglaten |
| **B3** | Komt er een veld `bouwdepotBedrag` op het project? | Ja. Zonder totaal is de depotgrafiek een balk zonder schaal. Kost een modelwijziging plus rules-deploy |
| **B4** | Alleen urgente meldingen standaard tonen? | Ja, met een uitklap. Anders is de lijst weer veertien regels lang |
| **B5** | Volgorde: bugs → dashboard → wizard? | Ja. Zie §10 |

**B1 t/m B5 zijn op 2 augustus goedgekeurd.** Blok 1 is uitgevoerd en lokaal groen.

### B6 — nieuw, hoort bij blok H

| Vraag | Mijn voorstel |
| --- | --- |
| Waar in de volgorde? | **Plek 4**, ná dashboard en wizard. Zie de toelichting onder de tabel in §10 |
| Bruto of netto rekenen? | **Bruto.** Netto vereist inkomen en belastingschijf, en dan geeft de app een bedrag waar iemand zijn begroting op baseert — dat is constraint C5 voorbij |
| Termijnen een verwacht bouwmoment geven? | **Ja**, één veld `verwachtBijAnker` per termijn. Zonder dat kan de prognose alleen het verleden tekenen |
| Eigen ADR? | **Ja — ADR-0019.** Een rekenmodel met aannames over andermans geld moet later uit te leggen zijn |
