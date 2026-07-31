# ADR-0012 — Het 5%-depot als keuze, met een afgeleide uiterste datum

**Status:** Geaccepteerd
**Datum:** 2026-07-31

## Context

Bij nieuwbouw mag een koper doorgaans 5% van de aanneemsom in depot houden bij de notaris in
plaats van het aan de aannemer te betalen, totdat de opleverpunten hersteld zijn. Het is een
recht dat je actief moet inroepen: doe je niets, dan gaat het bedrag alsnog naar de aannemer.

Dat maakt het een van de weinige plekken in het hele traject waar **niets doen geld kost**, en
precies daarom hoort het in deze app. Maar het brengt twee vragen mee die eerst beslist moeten
worden, omdat ze allebei makkelijk fout gaan op een manier die pas maanden later opvalt.

## Beslissing 1 — de uiterste datum wordt afgeleid, niet opgeslagen

De termijn om te kiezen loopt tot het einde van de onderhoudstermijn, en die begint bij de
oplevering. Beide schuiven mee met de bouw. Een opgeslagen `opschortingDeadline` zou dus na de
eerste verschuiving verkeerd staan — en het is een datum waarvan de gebruiker aanneemt dat de
app hem bewaakt.

Daarom volgt de datum uit wat er al is:

1. het anker `einde_onderhoudstermijn`, als dat is ingevuld;
2. anders de opleverdatum plus de standaard onderhoudstermijn van 90 dagen.

Dat is dezelfde constructie als bij afspraken (ADR-0008) en dezelfde terugval-met-melding als
bij `zekerheid` (ADR-0009): valt de app terug op de standaardtermijn, dan staat dat er expliciet
bij. Wat er wél wordt opgeslagen is de **keuze** (`opschortingStatus`) en het **bedrag** — dat
zijn feiten over de buitenwereld, geen berekeningen.

## Beslissing 2 — het bedrag wordt niet uitgerekend uit de koopsom

De verleiding is groot: er staat een `koopsom` in het project, dus 5% daarvan invullen scheelt
de gebruiker werk. Dat is fout, en op een dure manier.

**De 5% geldt over de aanneemsom, niet over de koopsom.** Bij nieuwbouw bestaat de koopsom uit
grond plus aanneemsom; de grond is al bij de notaris voldaan en valt buiten de regeling. Vijf
procent van de koopsom is dus stelselmatig te hoog — bij een koopsom van € 350.000 met een
grondprijs van € 110.000 scheelt dat € 5.500. Een bedrag dat de app als feit toont en dat te
hoog is, is erger dan een leeg veld: de gebruiker gaat ermee naar de notaris.

Het bedrag is daarom een invoerveld, met in de toelichting waarom het niet automatisch wordt
ingevuld. De app kan het pas uitrekenen als er ooit een apart `aanneemsom`-veld komt; tot die
tijd rekent hij niet.

## Beslissing 3 — gebreken zijn een eigen collectie, geen taken

`gebreken` bestond al in het model maar had nog geen scherm. Ze blijven apart van `tasks`,
want ze gedragen zich anders: een gebrek heeft een **locatie** in de woning, een
**hersteltermijn** die de aannemer moet halen (niet jij), en het is bewijsmateriaal — het staat
in het proces-verbaal van oplevering. Een taak is iets wat jij moet doen; een gebrek is iets
wat een ander moet herstellen. Ze in één lijst gooien maakt van beide een half ding.

## Alternatieven

| Optie | Waarom niet |
| --- | --- |
| Deadline opslaan als datum | Staat verkeerd na de eerste verschuiving, terwijl de gebruiker erop rekent dat de app hem bewaakt |
| 5% automatisch uit de koopsom | Stelselmatig te hoog, want de grond valt erbuiten. Een te hoog bedrag als feit tonen is erger dan geen bedrag |
| Een `aanneemsom`-veld toevoegen en dan wél rekenen | Kan later; nu een extra verplicht veld voor iets wat de gebruiker één keer per traject invult |
| Gebreken als taken met een label | Verliest locatie en hersteltermijn, en vermengt "wat moet ik doen" met "wat moet de aannemer herstellen" |

## Gevolgen

**Positief.** De uiterste datum schuift automatisch mee en meldt wanneer hij op de
standaardtermijn is gebaseerd. Het bedrag klopt of is leeg — nooit stilzwijgend fout.

**Negatief.** Drie velden erbij op `Project` (18 van de 25 toegestane) en een vierde
`isOneOf`-check in de rules. De gebruiker moet het bedrag zelf opzoeken in zijn
aannemingsovereenkomst.

**Wat dit niet is.** Geen juridisch advies (constraint C5). De app noemt de termijn "meestal
drie maanden" en zet het eigen contract voorop; hij vertelt niet of je het depot moet gebruiken.
