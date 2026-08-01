# ADR-0017 — Bruikbaarheid gaat vóór nieuwe features

**Status:** Geaccepteerd
**Datum:** 2026-08-01

## Context

Op 1 augustus 2026 is blok E afgerond en heeft gebruiker #1 de app voor het eerst met echte
gegevens gebruikt in plaats van hem te bouwen. De vastgestelde volgorde uit
`docs/2026-07-31-bouwplan-en-backlog.md` zette daarna **ronde 8** klaar: C5 (documentparser),
blok F (live gaan, export, toegankelijkheid, mobiel) en de `improvements/`-wachtrij.

Die live test leverde iets op wat acht verificatiepasses niet hadden gevonden. Letterlijk:

> *"Ik vind de interface zelf niet prettig werken. Heel veel tekst, heel veel moeten invullen.
> Dat snap ik wel, maar het is soms onduidelijk, soms heel onoverzichtelijk, super veel
> blokken. Er is geen dashboard waarin je bijvoorbeeld meldingen hebt met wat grafieken en
> kosten enz, een soort totaaloverzicht. Ook andere onderdelen zijn niet overzichtelijk en
> vooral niet helemaal duidelijk voor een leek. Daarnaast werken sommige onderdelen niet
> waaronder het bouwdepot."*

De volledige bevindingenlijst staat in `docs/2026-08-01-bevindingen-live-test.md`.

### Waarom dit niet eerder is opgevallen

De verificatiepassen aan het eind van elke ronde hebben drie sessies op rij echte bugs
gevonden — een dode typecheck-gate, twee ontbrekende ondergrenzen, een lek in het
overdrachtsdossier. Ze controleerden of de app het **juiste** doet.

Geen van die passes heeft ooit gevraagd of de app **prettig** is, want dat is niet met `tsc`,
`vitest` of een subagent vast te stellen. Het vraagt een mens die hem gebruikt.

### Het scherpste signaal

`PROJECT.md` §6 heeft sinds sessie 05 een vinkje bij *"Grafieken en totaalbeeld over budget,
meerwerk en depot"*. Het dashboard heeft acht secties, waaronder een blok "Geld". Het staat er
dus — en de gebruiker die deze app zelf heeft laten bouwen, zegt dat het er niet is.

Dat vinkje meet of iets gebouwd is, niet of het werkt. Het geldblok staat als zevende sectie
onderaan een stapel van acht.

## Beslissing

**Ronde 9 gaat over bruikbaarheid en bugs. C5, blok F en de `improvements/`-wachtrij
schuiven op naar ronde 10.**

De volgorde binnen ronde 9:

1. **BUG-01 en BUG-02 eerst.** Beide zijn in de code teruggevonden, samen een halve sessie werk
   inclusief tests, en ze halen twee concrete frustraties weg. Dat is een beter startpunt dan
   een herontwerp.
2. **Daarna kijken vóór bouwen.** Deze ronde begint niet met een ADR maar met Seth die het
   scherm deelt en vertelt wat hij ziet. Anders bouwen we wat wíj denken dat onduidelijk is.
3. **Pas dan ontwerpen**, met een expliciete opdracht: per scherm bepalen wat er wég kan of
   ingeklapt, vóórdat er iets bijkomt.

### De regel die hier onder ligt

> **Een feature die af is maar niet gevonden wordt, is niet af.**

`PROJECT.md` §6 blijft de vinkjes houden — een ADR of een vinkje wordt niet met terugwerkende
kracht herschreven. Maar er komt een aantekening bij het punt over grafieken en totaalbeeld,
zodat een volgende sessie niet denkt dat dat onderwerp gesloten is.

### Wat dit níét is

**Geen herontwerp van het datamodel.** De ADR's 0008 t/m 0016 blijven staan; het probleem zit
in de weergave, niet in wat er wordt opgeslagen. Het onderscheid tussen feit en afgeleide
waarde, de anker-plus-offset-mechaniek en de gesloten veldenlijsten zijn geen van alle de
oorzaak van "te veel blokken".

**Geen vrijbrief om uitleg te schrappen.** Constraint C5 (geen juridisch of financieel advies)
en ADR-0009 (voorstel versus eigen cijfer) vragen om zichtbare disclaimers. Die mogen korter
en beter geplaatst, maar niet verdwijnen. Het risico van deze ronde is dat "minder tekst"
uitmondt in "minder eerlijkheid over wat de app wel en niet weet".

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
| --- | --- | --- | --- |
| **Doorgaan met ronde 8 zoals gepland** | De afspraak van 31 juli blijft staan; blok F brengt de app live | Live gaan met een interface die gebruiker #1 zelf niet prettig vindt, betekent dat de eerste échte gebruiker hetzelfde vindt — en die komt niet terug | De hele opzet is dat het eigen traject de volgorde bepaalt (`PROJECT.md` §2) |
| Alleen de bugs fixen, UX later | Snel, laag risico | De klacht is niet "er zit een bug in" maar "het werkt niet prettig". Twee bugfixes lossen dat niet op | Behandelt het symptoom |
| Alleen de UX, bugs later | Grootste effect op de beleving | Een mooi scherm waar je geen bedrag met centen in kunt typen, is nog steeds stuk | De bugs zijn goedkoop; ze eerst doen kost bijna niets |
| Eerst de `improvements/`-wachtrij | Staat al klaar, ~29 plannen | Die gaat over code-kwaliteit (error boundaries, code splitting, caching) — waardevol maar onzichtbaar voor de gebruiker | Lost niets op van wat er gemeld is |
| Een dashboard met grafieken erbovenop | Precies wat er gevraagd is | De klacht is "super veel blokken"; er komt dan een negende bij | Vraag eerst wat er wég kan |

## Gevolgen

**Positief.** De app wordt getoetst aan de enige maatstaf die er uiteindelijk toe doet: of
iemand hem wil gebruiken. En het gebeurt op het goedkoopste moment — vóór de eerste deploy, dus
zonder productiedata en zonder gebruikers die last hebben van een verbouwing.

**Negatief.** Live gaan schuift op, en daarmee ook de e-mailherinneringen uit ADR-0014 §3. De
onderhoudslijst op het dashboard blijft langer de enige herinnering, en dat was al een
geaccepteerd risico. Daarnaast is een UX-ronde slecht af te bakenen: er is geen `verify` die
zegt dat hij klaar is. Daarom staat de volgorde hierboven expliciet, en begint de ronde met
kijken in plaats van bouwen.

**Terugdraaien.** Goedkoop — het is een volgordekeuze, geen architectuur. Blijkt na de eerste
sessie dat de bugs het hele verhaal waren, dan pakken we ronde 8 weer op.

## Wat dit níét verandert

- De harde constraints C1 t/m C5 uit `PROJECT.md` §3.
- ADR-0005: nog steeds geen Firebase Storage en geen Cloud Functions.
- ADR-0008 en de vier ADR's die daaruit volgen: een afgeleide waarde wordt niet opgeslagen,
  hoe het scherm er ook uit komt te zien.
- ADR-0009: een voorstelwaarde blijft zichtbaar als voorstel. Korter mag, weglaten niet.
- De bijwerkplicht uit `WORKFLOW.md` §2.
