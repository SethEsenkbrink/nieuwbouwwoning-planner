# Bevindingen uit de eerste live test — 1 augustus 2026

> **Wat dit is:** de eerste keer dat gebruiker #1 de app met echte gegevens heeft gebruikt in
> plaats van hem te bouwen. Dat leverde meer op dan acht sessies verificatiepasses, en het
> gaat over iets anders dan waar die passes naar keken.
>
> **Status:** dit is de wachtrij voor ronde 9. Zie ADR-0017 voor waarom deze vóór blok F gaat.
>
> De bugs 1 en 2 hieronder heb ik in de code teruggevonden; die zijn concreet. De rest is
> Seths waarneming en moet in de volgende sessie eerst gereproduceerd worden.

---

## 1. De rode draad

> *"Ik vind de interface zelf niet prettig werken. Heel veel tekst, heel veel moeten invullen.
> Dat snap ik wel, maar het is soms onduidelijk, soms heel onoverzichtelijk, super veel
> blokken."*

Acht sessies lang is er gecontroleerd of de app het **juiste** doet. Er is nooit gecontroleerd
of hij **prettig** is. Dat verschil is nu zichtbaar geworden, en het is niet met een paar
bugfixes op te lossen — het is een ontwerpprobleem dat door het hele product loopt.

De app is gebouwd vanuit het datamodel: elk scherm toont een collectie, elk veld uit het model
heeft een invoerveld gekregen, en elke nuance uit de ADR's heeft een uitlegtekst gekregen. Dat
is precies hoe je een correcte app bouwt en precies hoe je een vermoeiende app bouwt.

---

## 2. Bugs — concreet, in de code teruggevonden

### BUG-01 — Een bedrag met een komma wordt geweigerd

**Ernst: hoog.** Dit verklaart waarschijnlijk *"de kosten worden niet overal netjes
opgeslagen"*.

Vijf schermen schonen een ingetypt bedrag zo op:

```ts
const schoon = tekst.trim().replace(/[.\s]/g, "");
const bedrag = Number(schoon);
```

Dat haalt de **punt** weg (duizendtalscheiding) maar laat de **komma** staan. Gevolg:

| Wat je typt | Wat eruit komt | Resultaat |
| --- | --- | --- |
| `1250` | `1250` | ✅ |
| `1.250` | `1250` | ✅ |
| `1250,50` | `Number("1250,50")` = `NaN` | ❌ afgewezen |
| `1.250,50` | `Number("1250,50")` = `NaN` | ❌ afgewezen |

Wie een bedrag met centen intypt — wat bij een depottermijn of een meerwerkpost heel normaal
is — krijgt *"Vul het bedrag in als een getal, zonder euroteken"* en snapt niet waarom. Het
bedrag wordt niet opgeslagen.

**Waar:** `Bouwdepot.tsx:170`, `Meerwerk.tsx:207` en `:233`, `Nabudget.tsx:65`,
`Oplevering.tsx:170`, `Projectinstellingen.tsx:141`.

**Dit is exact dezelfde klasse fout als `leesStandInvoer()` in blok E7**, waar `"12.345"` als
12,345 gelezen werd. Daar is hij opgelost met één gedeelde functie plus negen tests. Hier
staat dezelfde logica zes keer gekopieerd, en zes keer half.

**Oplossing:** één `leesBedragInvoer()` in `src/lib/bedrag.ts`, met tests, en alle zes de
plekken erop aansluiten. Meteen beslissen of centen bewaard blijven — nu doet
`Math.round(bedrag)` ze weg, ook als ze wél doorkomen.

### BUG-02 — Een aangevinkte datum kan een dag terugspringen

**Ernst: middel.** Dit is waarschijnlijk (deel van) *"bugs in datum invullen"*.

Twee plekken zetten een datum met `new Date()` in plaats van `opDag(new Date())`:

- `Bouwdepot.tsx:133` — bij het aanvinken van gefactureerd / gedeclareerd / betaald
- `Dashboard.tsx:180` — `gecommuniceerdOp` bij de doorgegeven-knop

`new Date()` levert het huidige moment op inclusief kloktijd in lokale tijd. `toonDatum()`
leest bewust in **UTC** (zie `lib/datum.ts`). In de Nederlandse zomertijd (UTC+2) betekent dat:
vink je iets af tussen 00:00 en 02:00 's nachts, dan is het in UTC nog de vorige dag en toont
de app die vorige dag.

Overal elders in de app wordt `opDag()` gebruikt, dat op UTC-middernacht klemt. Deze twee zijn
de uitzondering.

**Oplossing:** `opDag(new Date())` op beide plekken. Daarna nalopen of er meer van dit soort
zitten — `grep -rn "new Date()" src/routes/` geeft er nu precies deze twee.

> **Let op:** dit verklaart niet noodzakelijk álle datumproblemen die Seth zag. Zie de open
> vragen onderaan.

---

## 3. Wat Seth verder meldde — nog te reproduceren

### OPEN-01 — "Het bouwdepot werkt niet"

BUG-01 verklaart waarschijnlijk het niet-opslaan van bedragen. Maar de melding was breder
(*"de kosten worden niet overal netjes opgeslagen ofzo"*), dus dit moet eerst nagespeeld
worden vóórdat we aannemen dat het daarmee klaar is.

**Wat de volgende sessie nodig heeft:** welk veld, op welk scherm, wat ingetypt, wat er daarna
stond. Eén concreet geval is genoeg om het te vinden.

### OPEN-02 — Andere datumbugs

BUG-02 dekt het aanvinken. Als het probleem ook optreedt bij het gewone `Datumveld`
(`<input type="date">`), is er iets anders aan de hand.

### OPEN-03 — Onduidelijk voor een leek

> *"Vooral niet helemaal duidelijk voor een leek."*

Concreet maken: welke schermen, welke termen. Kandidaten die opvallen bij het teruglezen:
"anker", "offset", "waardenBron", "opschortingsrecht", "bandbreedte", "aanlooptijd". Dat zijn
allemaal termen uit de ADR's die rechtstreeks in de UI zijn beland.

---

## 4. Het dashboard — het staat er, en het werkt niet als overzicht

> *"Er is geen dashboard waarin je bijvoorbeeld meldingen hebt met wat grafieken en kosten
> enz, een soort totaaloverzicht."*

**Dit is de scherpste bevinding van de dag, want het is feitelijk onjuist én volledig terecht.**

`PROJECT.md` §6 heeft sinds sessie 05 een vinkje bij *"Grafieken en totaalbeeld over budget,
meerwerk en depot"*. Het dashboard heeft acht secties, waaronder een blok "Geld" met vastgelegd
meerwerk, betaald depot en een waarschuwing bij budgetoverschrijding. Er is een
`Voortgangsbalk`-component.

Het staat er dus. En de gebruiker die de app zelf heeft laten bouwen, ziet het niet.

Dat betekent dat het vinkje meet of iets **gebouwd** is, niet of het **werkt**. De reden is
waarschijnlijk de volgorde: het dashboard opent met de actielijst (het werk), en het geldblok
staat als zevende sectie onderaan, tussen "Bouwmomenten" en "Betrokkenen". Acht secties onder
elkaar is geen overzicht maar een stapel.

**Voor ronde 9:** dit is geen "grafieken toevoegen" maar "beslissen wat er bovenaan hoort".
Een totaalbeeld dat je moet scrollen om te vinden, bestaat niet.

---

## 5. Wat dit betekent voor de aanpak

Drie dingen die ik zou meenemen naar ronde 9:

**1. Beginnen met kijken, niet met bouwen.** De vorige acht rondes begonnen met een ADR en
eindigden met een verificatiepass. Deze ronde hoort te beginnen met Seth die het scherm deelt
en hardop vertelt wat hij ziet — anders bouwen we wat wij denken dat onduidelijk is.

**2. Minder is de feature.** De verleiding is om een dashboard met grafieken erbovenop te
bouwen. Maar de klacht is "super veel blokken"; er komt dan een negende bij. De eerste vraag
per scherm is wat er wég kan of ingeklapt.

**3. De bugs eerst, want ze zijn goedkoop.** BUG-01 en BUG-02 zijn samen een halve sessie
werk met tests erbij, en ze halen twee concrete frustraties weg. Dat is een beter startpunt dan
een herontwerp.

---

## 6. Wat er níét in deze lijst hoort

- **De `improvements/`-wachtrij** (~29 auditplannen uit Antigravity). Die gaat over
  code-kwaliteit — error boundaries, code splitting, caching. Waardevol, maar het is niet wat
  Seth hier meldt en het mag deze ronde niet opeten.
- **Blok F** (live gaan, export, toegankelijkheid, mobiel). Zie ADR-0017: die schuift op.
- **C5 (documentparser).** Een nieuwe feature op een interface die nu al te vol is, is de
  verkeerde volgorde.
