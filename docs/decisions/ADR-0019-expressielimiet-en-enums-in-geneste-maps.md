# ADR-0019 — Geen enumvalidatie in geneste maps, vanwege de expressielimiet

**Status:** geaccepteerd
**Datum:** 2026-08-02
**Verzwakt bewust:** de model-/rules-pariteit die `scripts/verify-rules.mjs` bewaakt

---

## Context

Firestore staat maximaal **1000 expressie-evaluaties per regelcontrole** toe. Overschrijd je
dat, dan komt er geen validatiefout terug maar een generieke `PERMISSION_DENIED` met de tekst
*"Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been
reached"*.

Op 2 augustus 2026 bleek de projectregel daar overheen te gaan. Ontdekt bij toeval: één nieuwe
test schreef twee keer naar hetzelfde document, waardoor de tweede write een `update` werd — en
die faalde.

**Dit was geen nieuwe bug.** De ladder in `firebase/rules.test.ts` (blok "expressielimiet op de
projectregel") heeft de grens opgemeten:

| Trede | Inhoud | Uitkomst |
| --- | --- | --- |
| 1 | Losse velden | ✅ |
| 2 | + opschorting | ✅ |
| 3 | + opleverband | ✅ |
| 4a | + paspoort **zonder** `woningtype` en `energielabel` (10 velden) | ✅ |
| 4b | + `woningtype` (8 waarden) | ❌ |
| 4c | + `energielabel` (12 waarden) | ❌ |

**Niet de hoeveelheid velden is duur, maar de `isOneOf`-enumchecks.** Er zaten er al drie in de
treden 1–3 (`garantiewaarborg`, `opschortingStatus`, `opleverStatus`); de vierde duwt de regel
eroverheen.

Dat betekent dat een volledig gevuld project **sinds blok E** (toen het woningpaspoort erbij
kwam) niet meer opgeslagen kon worden. Het viel niet op omdat geen enkele test een project met
álle velden tegelijk aanmaakte: de bestaande paspoorttest gebruikt alleen de projectnaam plus
het paspoort, zonder koopsom, opschorting of opleverdatum.

## Wat er eerst is geprobeerd

Twee optimalisaties, allebei zonder meetbaar effect:

1. **`create` en `update` samengevoegd** tot één `geldigProject(data)`, zodat
   `request.resource.data` één keer geëvalueerd wordt in plaats van ~20×.
2. **De geneste maps één keer evalueren** en als parameter doorgeven
   (`paspoortInhoud(data.woningpaspoort)` in plaats van dertien keer
   `optionalString(data.woningpaspoort, …)`).

Beide zijn behouden — de rules zijn er leesbaarder van geworden — maar trede 4 bleef falen.

> **Waarom één enumcheck zo duur is, is niet achterhaald.** Een lijst van acht strings zou tien
> expressies moeten kosten, geen honderden. Er zit iets multiplicatiefs in hoe Firestore
> functies expandeert dat alleen in de emulator te meten valt. Wat vaststaat is het gedrag.

## Beslissing

**In geneste maps staat geen enumvalidatie meer.** Concreet vervalt de waardecontrole op:

| Veld | Waar | Wat de rules nog wél doen |
| --- | --- | --- |
| `woningtype` | `woningpaspoort` | string, max 30 tekens |
| `energielabel` | `woningpaspoort` | string, max 10 tekens |
| `vorm` | `hypotheek` | string, max 20 tekens |

De drie lijstfuncties `woningtypes()`, `energielabels()` en `hypotheekvormen()` zijn uit
`firestore.rules` verwijderd; ze waren dode code geworden.

**Enums op het project zélf blijven wel gevalideerd**: `garantiewaarborg`, `opschortingStatus`,
`opleverStatus` en `woningStatus`. Die zitten niet in een geneste map en passen binnen het
budget.

## Wat dit kost, en wat het niet kost

**Wat overeind blijft — dit is het belangrijkste punt.** Constraint C2 gaat erover dat een veld
geen opslagplek mag worden. Die bescherming is volledig intact:

- de map moet een map zijn;
- met een maximum aantal velden (13 voor het paspoort, 7 voor de hypotheek);
- en elke waarde is een string of getal binnen een lengte- of waardebereik.

Er staan tests op alle drie (`weigert een woningtype dat geen string is`, `weigert een
woningtype dat als opslagplek wordt misbruikt`, en dezelfde twee voor de hypotheekvorm).

**Wat vervalt** is de controle óf de waarde in de lijst voorkomt. Iemand die de rules
rechtstreeks aanroept — buiten de app om, met een eigen Firestore-client — kan
`woningtype: "tuinkabouter"` wegschrijven. Dat is:

- **geen veiligheidsprobleem** — het is zijn eigen document, in zijn eigen map;
- **wel een datakwaliteitsprobleem** — de app leest het terug als `Woningtype` terwijl het dat
  niet is, en dan kan een `Record<Woningtype, string>`-lookup `undefined` opleveren.

De verdediging ligt nu bij TypeScript en het formulier. Voor de eigen gebruiker is dat genoeg;
het is per slot van rekening zijn eigen data die hij dan bederft.

## Gevolgen

- `npm run verify:rules` daalt van 29 naar **26 enums** en van 139 naar **116 waarden**. Dat is
  geen regressie maar het gevolg van deze beslissing, en het staat als waarschuwing in het
  script zelf.
- De ladder in `rules.test.ts` blijft staan als **regressietest op de limiet**. Wie een veld of
  een enum toevoegt aan de projectregel, moet hem draaien.
- **Het budget is nu bijna vol.** Komt er nog een groep gegevens bij het project, dan is dit
  trucje op. Dan hoort die groep een eigen subcollectie te worden, met een eigen match-blok en
  dus een eigen budget van 1000 — precies zoals `meters` en `meterstanden` (ADR-0015).

## Alternatieven die zijn afgevallen

**Het woningpaspoort naar een eigen subcollectie.** Structureel de betere oplossing: eigen
budget, en het project kan weer groeien. Maar het raakt `model.ts`, `projecten.ts`, de
converters, `/woning`, het overdrachtsdossier en het dashboard, plus een migratie van bestaande
data. Bewaard voor het moment dat het budget écht op is — dan is de ingreep onvermijdelijk en
kan hij in één keer goed.

**`isOneOf` inline schrijven** in plaats van via een hulpfunctie. Scheelt twee functie-aanroepen
per enum, maar er was geen enkele grond om aan te nemen dat dat genoeg zou zijn — en elke
poging kost een emulatorrun bij de enige die hem kan draaien.

**De limiet accepteren en het paspoort inkorten.** Dan verdwijnt functionaliteit om een
technische reden, en dat is de verkeerde volgorde.

## De les die breder geldt

> **Een validatie die je niet op een volledig gevuld document test, is een validatie waarvan je
> hoopt dat hij werkt.**

Er stonden 191 rules-tests, en geen enkele maakte een project aan met alle velden tegelijk. Elke
test vulde precies het stukje dat hij onderzocht. Daardoor heeft deze bug wekenlang in de rules
gezeten zonder dat één test hem raakte.
