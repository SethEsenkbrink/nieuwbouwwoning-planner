# ADR-0009 — Zekerheid en herkomst als expliciete velden

**Status:** Geaccepteerd
**Datum:** 2026-07-30

## Context

ADR-0008 legde vast dat afspraken als **anker + offset** worden opgeslagen en dat de datum
altijd wordt afgeleid. Bij het uitwerken van het datamodel in sessie 03 kwamen drie gaten
naar boven die ADR-0008 open liet. Alle drie gaan over hetzelfde: **de app weet dingen met
verschillende mate van zekerheid, en dat verschil verdween in het model.**

### Gat 1 — de gebruiker van dag één kent maar één anker

Bij het valideren van de aanpak bleek dat gebruiker #1 op dit moment **uitsluitend een
indicatieve opleverdatum** heeft. Geen `dekvloer_gestort`, geen `ruwbouw_gereed`. De
standaardbibliotheek hangt afspraken juist bewust aan die bouwmomenten (ADR-0008,
principe 2) — precies de ankers die hij niet heeft.

De standaardlijst schrijft voor dat een ontbrekend anker terugvalt op `oplevering` "met een
waarschuwing dat de berekening minder precies is". Maar er was geen veld waarin die
waarschuwing kon leven. Zonder dat veld levert `berekenDatum()` een `Date` op die er precies
zo uitziet als een datum die wél op een bevestigd anker rust — en dan is de vloerenlegger
uit ADR-0008 weer aan de opleverdatum gehangen, alleen nu onzichtbaar, verstopt in een
fallback.

### Gat 2 — startwaarden zijn niet te onderscheiden van eigen cijfers

De standaardbibliotheek levert aanlooptijden en annuleertermijnen die ik heb ingeschat, geen
normwaarden. Constraint C5 en uitgangspunt 1 van de standaardlijst eisen dat de UI die als
_voorstel_ toont, nooit als feit. Zodra zo'n waarde in Firestore staat als een kaal getal,
is niet meer te zien of het een gok van de app is of het cijfer dat de keukenleverancier
zelf noemde. De disclaimer zou dan óf altijd blijven staan (waardoor niemand hem nog leest)
óf altijd verdwijnen (waardoor een gok als feit wordt gepresenteerd).

De gebruiker heeft bij het bepalen van de sessiescope expliciet bevestigd dat hij geen
concrete cijfers van zijn leveranciers heeft en dat de waarden **invulbaar moeten zijn met
algemene suggesties**. Dat maakt dit onderscheid geen randgeval maar de normale toestand van
elk nieuw project.

### Gat 3 — een band levert geen enkele datum op

ADR-0008 principe 1 stelt dat de opleverdatum een band is met een staat. Een functie die
één `Date` teruggeeft, moet dus kiezen welke van de drie — en die keuze verdwijnt daarna uit
beeld. Terwijl juist de breedte van de band bepaalt of je iemand al kunt boeken.

## Beslissing

Zekerheid en herkomst worden **expliciete velden en returnwaarden**, geen impliciete
aannames. Concreet drie toevoegingen bovenop `PROJECT.md` §5:

### 1. `waardenBron` op `Betrokkene`

```ts
waardenBron: "voorstel" | "eigen";
```

`"voorstel"` zolang aanlooptijd en annuleertermijn uit de standaardbibliotheek komen. Zodra
de gebruiker er één aanpast → `"eigen"`. De UI toont bij `"voorstel"` de tekst
_"voorstel — controleer bij je leverancier"_, en laat die weg bij `"eigen"`.

Bewust géén per-veld-herkomst (`aanlooptijdBron` + `annuleertermijnBron` apart). Dat is
preciezer maar verdubbelt het aantal velden voor een onderscheid dat in de UI toch als één
badge landt. Blijkt het later nodig, dan is dat een additieve migratie.

### 2. `berekenDatum()` geeft een zekerheid terug, geen kale datum

```ts
type Zekerheid = "anker_bevestigd" | "anker_verwacht" | "teruggevallen";

interface BerekendeDatum {
  datum: Date;
  zekerheid: Zekerheid;
  gebruiktAnker: AnkerType; // kan afwijken van het gevraagde anker
  gevraagdAnker: AnkerType;
}
```

| Zekerheid         | Wanneer                                                       | Wat de UI toont                                                              |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `anker_bevestigd` | het anker bestaat en heeft status `bevestigd` of `gepasseerd` | de datum, zonder voorbehoud                                                  |
| `anker_verwacht`  | het anker bestaat, status `verwacht`                          | de datum met "verwacht"                                                      |
| `teruggevallen`   | het gevraagde anker ontbreekt; gerekend vanaf `oplevering`    | de datum met een expliciete waarschuwing dat het gevraagde anker onbekend is |

Het type dwingt de aanroeper de zekerheid te zien. Een kale `Date` liet toe hem te negeren.

`gebruiktAnker` en `gevraagdAnker` staan er beide in, zodat de melding concreet kan zijn:
"gerekend vanaf oplevering — `dekvloer_gestort` is nog niet bekend" in plaats van een vaag
uitroeptekentje.

### 3. Rekenen over de band, niet over één datum

`berekenDatum()` rekent op alle drie de opleverdatums en levert een `vroegst / verwacht /
laatst`-drieluik. Bij `opleverStatus = "aangezegd"` vallen die samen en toont de UI één
datum; daarvoor toont hij een bereik.

## Alternatieven

| Optie                                                        | Voor                                               | Tegen                                                                                                                                   | Waarom niet                                                          |
| ------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Kale `Date` teruggeven, waarschuwing in de UI-laag bepalen   | Simpelste signatuur; rekenfunctie blijft klein     | De UI moet de fallback-logica dupliceren om te wéten dát er teruggevallen is. Twee plekken die het eens moeten blijven                  | De fallback is businesslogica, geen presentatie                      |
| Ontbrekend anker → geen datum (`null`)                       | Maximaal eerlijk: onbekend is onbekend             | Gebruiker #1 heeft één anker, dus vrijwel de hele actielijst wordt leeg. De app is dan precies nutteloos op het moment dat hij nodig is | Onbruikbaar voor de enige echte gebruiker                            |
| Herkomst per veld (`aanlooptijdBron`, `annuleertermijnBron`) | Preciezer bij gedeeltelijk bijgewerkte betrokkenen | Twee extra velden per betrokkene voor een onderscheid dat in één UI-badge eindigt                                                       | Niet genoeg waarde voor de modelcomplexiteit; additief toe te voegen |
| Alleen `opleverVerwacht` gebruiken in de rekenmotor          | Eenvoudige signatuur                               | Gooit principe 1 van ADR-0008 meteen weg: de breedte van de band bepaalt of je iemand mag boeken                                        | Ondermijnt de vorige ADR                                             |

## Gevolgen

**Positief:** de drie plekken waar de app iets níet zeker weet — ontbrekend anker,
geschatte startwaarde, onzekere opleverdatum — zijn nu alle drie zichtbaar in het type. Een
volgende sessie kan ze niet per ongeluk wegwerken, want de compiler dwingt af dat de
returnwaarde wordt uitgepakt. Dat sluit constraint C5 op modelniveau in plaats van op
UI-niveau.

**Negatief:** `berekenDatum()` is omslachtiger in gebruik dan een functie die een `Date`
teruggeeft; elke aanroep moet destructureren. En `waardenBron` is een veld dat de UI
consequent moet bijwerken bij elke edit — vergeet je dat, dan blijft de disclaimer hangen
op cijfers die de gebruiker zelf heeft ingevoerd. Dat hoort in de opslaglaag te zitten, niet
in het formulier.

**Terugdraaien:** goedkoop. `waardenBron` is één optioneel veld dat genegeerd kan worden;
`BerekendeDatum` is een returntype van een pure functie zonder opgeslagen data. Beide zijn
te verwijderen zonder migratie — in tegenstelling tot de anker-en-offset-structuur uit
ADR-0008, waar dat wél zou moeten.

## Relatie tot ADR-0008

Dit is een **verfijning**, geen wijziging. ADR-0008 blijft volledig van kracht: afspraken
hangen aan een anker met een offset, de datum wordt afgeleid, en het verschil tussen
berekend en gecommuniceerd is de actielijst. ADR-0009 voegt alleen toe dat de app eerlijk is
over hoe zeker die afgeleide datum is.
