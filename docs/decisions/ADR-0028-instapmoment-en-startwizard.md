# ADR-0028 — Het instapmoment als stuurwiel van de startwizard

- **Status:** Geaccepteerd
- **Datum:** 2026-08-21
- **Beslissers:** Seth (producteigenaar), Assistent
- **Raakt:** `src/lib/wizard/`, `src/routes/Startwizard.tsx`, `src/components/wizard/`, `src/lib/converters.ts`

---

## Context

De oude `ProjectWizard` had drie stappen — projectgegevens, opleverdatum,
betrokkenen — en één impliciete aanname: dat de gebruiker aan het begin van
een nieuwbouwtraject staat.

Die aanname klopt zelden. Een woningdossier is voor het *complete leven* van
een woning (PROJECT.md §1), en mensen stappen op elk punt van dat leven in:

| Wie er binnenkomt | Wat de oude wizard hem vroeg |
| --- | --- |
| Iemand die zich oriënteert | Een aanneemsom die nog niet bestaat |
| Iemand midden in de bouw | Een opleverdatum als losse schatting |
| Iemand met de sleutel in handen | Een opleverdatum die allang geweest was |
| Iemand die er vier jaar woont | Idem — en nul vragen over onderhoud |

Het derde en vierde geval zijn het ergst: dat zijn precies de gebruikers voor
wie de app *onderhoudsdossier* moet zijn, en zij kregen een bouwplanner.

Daar kwam bij dat het financiële beeld verspreid stond over drie schermen, en
dat de hypotheekgegevens uit ADR-0019 helemaal niet weg te schrijven waren —
`projectNaarOpslag` noemde de map niet, dus hij verdween stil bij het opslaan.

---

## Besluit

### 1. Eén vraag stuurt de hele wizard

Naast `traject` (`nieuwbouw` / `bestaandeBouw`) vraagt stap 1 om een
**instapmoment**:

```
orientatie · net_gekocht · in_aanbouw · bijna_oplevering ·
net_opgeleverd · in_beheer
```

Uit dat paar volgt deterministisch:

- **welke stappen er zijn** — `stappenVoor(traject, moment)`
- **welke daarvan verplicht zijn** — een stap is verplicht als de app er
  zonder niets zinnigs kan doen
- **de `woningStatus`** waarmee het dashboard van vorm verandert (ADR-0010 §1)
- **welke ankers al gepasseerd zijn**

`in_beheer` levert acht stappen op zonder planning, meerwerk of betrokkenen,
mét onderhoud als verplichte stap. `orientatie` verplicht niets.

### 2. Bij bestaande bouw bestaat `in_aanbouw` niet

Er wordt niets gebouwd. Die keuze weglaten is eerlijker dan een stap tonen die
leeg blijft. Wisselt iemand halverwege van traject, dan verhuist zijn keuze via
`dichtstbijzijndeMoment()` naar het dichtstbijzijnde moment dat er wél is —
niet naar het begin, want dan verdwijnt zijn werk uit beeld.

### 3. Het instapmoment wordt niet opgeslagen

Het zou een 23e veld op `Project` zijn en, belangrijker, een tweede waarheid
naast `woningStatus`. Die twee lopen uit elkaar zodra iemand zijn status omzet
buiten de wizard om, en dan toont de wizard vragen over een bouw die klaar is.

Bij het hervatten wordt het moment **geraden** uit het dossier zelf
(`raadMoment()`) en als voorselectie getoond. De vraag wordt gewoon opnieuw
gesteld — tussen twee sessies kan er van alles gebeurd zijn, en juist dan wil
je hem stellen.

De voorselectie kiest bij twijfel het moment dat *méér* stappen toont: te veel
tonen kost één klik, te weinig tonen kost de stap waarop iemand zijn 5%-depot
had willen vastleggen.

### 4. Verplicht versus optioneel, en wat "verplicht" mag betekenen

De wens was "een totale wizard waarbij alles ingevuld moet worden". Dat is
gehonoreerd als *volledig in bereik*, niet als *dwingend in elk veld*: wie
oriënteert heeft geen aanneemsom, en die verplicht stellen levert een verzonnen
getal op dat daarna als feit in het dossier staat — precies wat ADR-0009 en
constraint C6 willen voorkomen.

Optionele stappen krijgen een volwaardige knop "Later invullen", geen grijze
link. Een controle op onleesbare invoer geldt óók bij een optionele stap: stil
niets opslaan terwijl de gebruiker denkt dat het gelukt is, is erger dan een
foutmelding.

### 5. De beslissingen staan in pure functies, het scherm voert alleen uit

`src/lib/wizard/` bevat geen React, geen opslag en geen `new Date()`:

| Module | Verantwoordelijkheid |
| --- | --- |
| `instapmoment.ts` | de momenten per traject, en wat elk moment betekent |
| `stappen.ts` | welke stappen, in welke volgorde, welke verplicht |
| `waarden.ts` | formulierwaarden en hun omzetting naar de opslag |
| `voortgang.ts` | wat er al in het dossier staat, en het geraden moment |

`Startwizard.tsx` toont de stap, valideert via `controleerStap()` en schrijft
weg. Het beslist zelf niets. Daardoor is de volledige regelset te testen zonder
browser — 115 tests bij oplevering.

### 6. Er wordt na elke stap opgeslagen

Dat kost een schrijfactie per stap, maar bij negen stappen is dat het verschil
tussen af en afgehaakt. Het project wordt aangemaakt zodra stap 1 verlaten
wordt, niet aan het eind.

---

## Gevolgen

**Wat hierdoor mogelijk werd.** De hypotheekgegevens uit ADR-0019 hebben nu
een invoerpad én een opslagpad; de 24-maandenregel van het bouwdepot in
`rules/financieel.ts` kan voor het eerst afgaan. Het bouwdepotbedrag bereikt
de depotbalk op het dashboard, die tot nu toe zonder schaal stond. Het
`traject`-veld uit PROJECT.md §4 wordt eindelijk bewaard.

**Wat dit kost.** Het stappenplan is nu een functie van twee variabelen, dus
elke nieuwe stap vraagt om een expliciete regel voor twaalf combinaties. De
tests dwingen dat af: er is een test die controleert dat élke combinatie naar
het financiële beeld vraagt, en één die alle combinaties langsloopt om te zien
dat een verplichte stap ook echt in het plan zit.

**Wat er open blijft.** De wizard laat bij de installaties alleen kiezen wát er
in huis zit; merk, type en serienummer vul je daarna per onderdeel in. Dat
bewust: die staan op typeplaatjes en in het opleverdossier, en dat is geen
werk voor een eerste doorloop.

---

## Alternatieven die zijn afgevallen

**Het moment afleiden uit datums.** Verleidelijk — een opleverdatum in het
verleden zou "opgeleverd" betekenen. Maar een oplevering kan afgekeurd worden
en een transport kan uitgesteld. Dan verandert de app van vorm op precies het
moment dat er nog van alles moet gebeuren. Zelfde afweging als bij
`woningStatus` in ADR-0010 §1: gewoon vragen.

**Eén lange wizard voor iedereen, met overslaan.** Dat is wat er feitelijk al
was. Het probleem is niet dat mensen niet kunnen overslaan, maar dat een
scherm vol niet-toepasselijke vragen de indruk wekt dat je iets vergeet.

**Het instapmoment als veld op `Project`.** Zie besluit 3.
