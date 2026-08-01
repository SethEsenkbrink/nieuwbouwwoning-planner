# ADR-0014 — Terugkerend onderhoud: interval, voorkeursmaand, logboek, en uitgestelde herinneringen

**Status:** Geaccepteerd
**Datum:** 2026-08-01
**Verhoudt zich tot ADR-0010:** vult §2 aan en **herziet §4**

## Context

ADR-0010 §2 stelde vast dat terugkerend onderhoud de enige plek is waar de bestaande
mechaniek niet volstaat. Een bouwafspraak gebeurt één keer; onderhoud herhaalt zich. Het
voorstel was `intervalDagen` + `laatstUitgevoerdOp`, met de volgende beurt altijd afgeleid.

Bij het uitwerken van blok E3 bleken drie dingen die die schets openliet. Alle drie zijn ze
met Seth doorgenomen op 2026-08-01.

### 1. Een interval alleen is niet genoeg voor seizoenswerk

Dakgoten schoonmaken hoort in het najaar, radiatoren ontluchten vóór het stookseizoen,
buitenschilderwerk in de zomer. Met alleen `intervalDagen: 365` bepaalt het *moment van
afvinken* de rest van de reeks: vink je de goten een keer in maart af, dan staat de volgende
beurt in maart — precies de verkeerde maand, en die fout plant zich voort.

ADR-0010 noemde een `seizoen`-veld maar werkte niet uit wat het met de berekening doet.

### 2. Afvinken zonder historie maakt van een feit een getal

ADR-0010 zette het logboek in E6, ná het onderhoudsschema. Maar `laatstUitgevoerdOp` wordt
bij elke beurt **overschreven**. Zonder logboek is de vorige beurt dus onherroepelijk weg:
je ziet dat er "iets" is gebeurd op een datum, maar niet wat, door wie of wat het kostte.

Dat is precies het deel dat bij verkoop het waardevolst is — en het is niet achteraf te
reconstrueren. Elke beurt die tussen E3 en E6 wordt afgevinkt, is historie die permanent
verdwijnt.

### 3. De herinnering die ADR-0010 als voorwaarde stelde, kan nog niet gebouwd worden

ADR-0010 §4 stelde onomwonden: *"Een herinnering die je moet komen halen, is geen
herinnering"*, en maakte de scheduled Netlify Function met e-mail een **voorwaarde** voor
blok E.

Die voorwaarde botst met een ander besluit. Het bouwplan (deel 4, besluit 3) stelt live gaan
uit tot ronde 8, met als reden dat eerst alles lokaal tegen de emulator getest moet worden.
Een scheduled Netlify Function vereist een deploy. De twee besluiten kunnen niet allebei
gelden.

## Beslissing

### 1. `voorkeursmaand` naast `intervalDagen`

Op de onderhoudstaak komt een optioneel veld:

```ts
voorkeursmaand?: number; // 1–12
```

Is die gezet, dan wordt de berekende datum verschoven naar **de dichtstbijzijnde voorkomen
van die maand**. Dus: goten voor het laatst gedaan in maart 2026, interval 365 dagen →
berekend maart 2027 → dichtstbijzijnde oktober is oktober 2026 → dát wordt de datum.

**Waarom de dichtstbijzijnde en niet de eerstvolgende erna.** "Eerstvolgende erna" zou
oktober 2027 opleveren: negentien maanden zonder schoonmaak, omdat je één keer in de
verkeerde maand hebt afgevinkt. De fout zou zichzelf in stand houden. Bij onderhoud is
eerder-dan-nodig nooit fout en later-dan-nodig wel, dus de correctie mag naar voren.

**Waarom een maandnummer en niet een seizoen.** "Najaar" moet alsnog naar een maand vertaald
worden, en dan doet die vertaling stilzwijgend het echte werk. Een maandnummer is
ondubbelzinnig, sorteerbaar en direct te tonen.

**De correctie kent één ondergrens, en die is er niet vanaf het begin geweest.** Bij de
verificatie van deze implementatie bleek dat "dichtstbijzijnde" bij een interval korter dan
een jaar naar het verleden kan schuiven:

> Interval 182 dagen, voorkeursmaand oktober, laatst gedaan op 15 oktober. Berekend: 15 april.
> De twee kandidaten zijn oktober vorig jaar (182 dagen terug) en oktober dit jaar (183 dagen
> vooruit). De vroegste wint — en dat is 15 oktober, exact de dag van de beurt zelf.

De taak is dan meteen achterstallig en blijft dat: elke keer afvinken levert dezelfde datum
op. Bij een interval van 30 dagen loopt de reeks zelfs een dag per beurt achteruit. Daarom
geldt: **een kandidaat op of vóór `laatstUitgevoerdOp` valt af.** Er staan twee regressietests
op, en het formulier waarschuwt zodra iemand een voorkeursmaand combineert met een interval
onder de 300 dagen — dan wordt de taak in de praktijk jaarlijks, en dat is bijna nooit de
bedoeling.

### 2. Het logboek komt meteen mee, niet in E6

Er komt een tweede subcollectie `onderhoudslogboek`, en **afvinken schrijft er in dezelfde
batch een regel in**:

```
onderhoudslogboek/{logId}
  - taakId, onderdeelId?
  - uitgevoerdOp        // een feit over het verleden
  - doorWie?, kosten?, notitie?
```

Afvinken doet dus twee dingen atomair: `laatstUitgevoerdOp` bijwerken op de taak, en een
logregel wegschrijven. Dat is één `writeBatch`, zodat er nooit een bijgewerkte taak zonder
logregel kan ontstaan.

**Dit haalt E6 naar voren en dat is bewust.** De volgorde in het bouwplan was gebaseerd op
"eerst de mechaniek, dan de historie". Maar de historie ontstaat op het moment dat de
mechaniek gebruikt wordt; ze later toevoegen betekent dat de eerste maanden gegevens
ontbreken die niet meer terug te halen zijn.

### 3. Herinneringen komen in de app, niet per e-mail — voorlopig

**ADR-0010 §4 wordt hiermee gedeeltelijk herzien.** De e-mailherinnering is geen voorwaarde
meer voor blok E. In plaats daarvan:

- De onderhoudslijst staat **bovenaan het dashboard** zodra `woningStatus` op `opgeleverd`
  staat, op dezelfde plek waar in de bouwfase de schuif-impact-actielijst staat. Achterstallig
  onderhoud staat bovenaan, gesorteerd op hoe lang het al te laat is.
- De e-mailfunctie blijft op de rol voor ronde 8, samen met live gaan (B4/F1).

**Wat we hiermee accepteren, expliciet:** een dossier dat zich niet meldt, wordt mogelijk niet
gebruikt. Dat was het hele argument van ADR-0010 §4 en het is niet weerlegd — het is
uitgesteld. Onderhoud met een interval van een maand (rookmelders, zout bijvullen) overleeft
dat waarschijnlijk wel, want je opent de app dan vaak genoeg. Onderhoud met een interval van
een jaar of langer is het echte risico.

**De toets die dat zichtbaar maakt:** zodra er productiedata is, is te zien hoeveel taken
overschreden zijn op het moment dat iemand inlogt. Blijkt dat structureel hoog, dan is dat het
bewijs dat ADR-0010 §4 gelijk had en dat de mailfunctie alsnog voorrang moet krijgen.

### 4. Het startpunt van een taak die nooit is uitgevoerd

`berekenVolgendeOnderhoud()` heeft een basisdatum nodig. In deze volgorde:

| Bron | Wanneer | `zekerheid` |
| --- | --- | --- |
| `laatstUitgevoerdOp` | er is een keer afgevinkt | `uitgevoerd` |
| `installatieDatum` van het gekoppelde onderdeel | nog nooit afgevinkt | `installatie` |
| de opleverdatum van het project | geen onderdeel of geen installatiedatum | `oplevering` |
| — | geen van alle | `null`, geen datum tonen |

Dezelfde eerlijkheid als `zekerheid` bij `berekenDatum()` (ADR-0009): de UI zegt erbij waarop
gerekend is. "Over drie maanden" op basis van een aangenomen opleverdatum is iets anders dan
"over drie maanden" na een echte beurt, en dat verschil mag niet verdwijnen.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
| --- | --- | --- | --- |
| Alleen `intervalDagen`, geen seizoen | Simpelste model en berekening | Seizoenswerk komt structureel in de verkeerde maand terecht, en de fout plant zich voort bij elke beurt | Dakgoten in maart is geen onderhoud maar een vinkje |
| `seizoen` als tekstlabel zonder rekenwerk | Minste code | De gebruiker moet zelf corrigeren; de app toont een datum waarvan hij weet dat hij fout is | Een berekening die je moet negeren is erger dan geen berekening |
| Voorkeursmaand = eerstvolgende voorkomen ná de berekende datum | Nooit eerder dan het interval | Kan negentien maanden opleveren na één keer verkeerd afvinken | Bij onderhoud is te laat het probleem, niet te vroeg |
| Logboek pas in E6 | Volgt de volgorde uit het bouwplan | Elke beurt die je vóór E6 afvinkt is historie die permanent weg is | De data ontstaat nú; het schema kan wachten, de gegevens niet |
| Wachten met E3 tot de mailfunctie er is | Volgt ADR-0010 §4 letterlijk | Haalt live gaan naar voren, wat bewust is uitgesteld tot alles lokaal getest is | Twee besluiten die elkaar uitsluiten; dit is de goedkoopste kant om toe te geven |
| Browser-notificaties in plaats van e-mail | Meldt zich wel, zonder deploy | Vereist een openstaand tabblad of een service worker plus toestemming; werkt niet als de app dicht is — dus lost het niet op | Schijnoplossing met echte complexiteit |

## Gevolgen

**Positief.** Het woningdossier wordt bruikbaar: taken met een interval, een historie die
klopt, en een lijst die zegt wat er nu moet. De `voorkeursmaand` maakt seizoenswerk correct
zonder dat de gebruiker het zelf hoeft bij te sturen. Het logboek maakt van elke afgevinkte
beurt meteen een vastgelegd feit.

**Negatief.** De scope van E3 groeit met een tweede subcollectie en de rekenkern krijgt een
correctiestap die getest moet worden op beide richtingen (naar voren en naar achteren).
Belangrijker: **we accepteren bewust een dossier dat zich niet meldt**, en dat is het risico
dat ADR-0010 §4 juist wilde afdekken.

**Terugdraaien.** `voorkeursmaand` is één optioneel veld dat genegeerd kan worden. Het logboek
is een aparte collectie die blijft staan als hij niet gebruikt wordt. De uitgestelde
mailfunctie is geen terugdraaiing maar een openstaand punt: hij komt in ronde 8, en als de
onderhoudslijst dan structureel achterstallig blijkt, is dat de aanleiding om hem alsnog
voorrang te geven.

## Wat dit níét verandert

- De regel uit ADR-0008: er wordt **geen onderhoudsdatum opgeslagen**. Alleen
  `laatstUitgevoerdOp` (een feit over het verleden) en `intervalDagen`; de volgende keer is
  altijd afgeleid. `voorkeursmaand` is een regel, geen datum.
- Constraint C2 en C3. Het logboek is tekst en getallen, geen bestanden.
- ADR-0009. De intervallen uit de standaardbibliotheek zijn schattingen en krijgen
  `waardenBron: "voorstel"` met dezelfde zichtbare disclaimer als de aanlooptijden.
- ADR-0010 §1, §2 en §3. Alleen §4 wordt herzien, en alleen op het punt van de timing.
