# ADR-0016 — Het overdrachtsdossier is een printweergave, geen gegenereerde PDF

**Status:** Geaccepteerd
**Datum:** 2026-08-01

## Context

E8 uit het bouwplan staat er in één regel: *"Overdrachtsdossier — alles in één client-side
gegenereerde PDF."* Dat zegt waar het bestand vandaan komt (de browser, niet de server) maar
niet waarmee. En dat is hier de keuze, want dit project heeft tot nu toe **nul
runtime-dependencies** buiten `firebase`, `react` en `react-router`.

### Wat het dossier moet zijn

De eis van gebruiker #1, letterlijk: *volledig in de stijl van de applicatie, netjes en mooi,
en zeer stabiel.* Die drie zijn niet inwisselbaar — ze wijzen alle drie dezelfde kant op, en
dat is niet de kant die "genereer een PDF" normaal opgaat.

### Wat er al ligt

Alles wat het dossier nodig heeft bestaat al na E1 t/m E7:

| Bron | Wat het bijdraagt |
| --- | --- |
| `woningpaspoort` op het project | adres, type, bouwjaar, oppervlakte, energielabel met EP-online-registratie |
| `onderdelen`, gefilterd op `blijftBijWoning` | merk, type, serienummer, specs, installatiedatum, garantie, meldplicht |
| `onderhoudslogboek` | wat er wanneer is gedaan, door wie, wat het kostte |
| `meters` + `meterstanden` | de laatste stand per meter op de overdrachtsdatum |
| `betrokkenen` | wie wat heeft geïnstalleerd |

**Er komt dus geen veld, geen collectie en geen rule bij.** E8 is een lees- en
weergavefeature. Dat is een prettige eigenschap: geen `firebase deploy` nodig, en
`rules:test` blijft optioneel.

## Beslissing

**Het dossier is een eigen route (`/overdrachtsdossier`) met een printweergave. De browser
maakt er via "Opslaan als PDF" een bestand van. Er komt geen PDF-bibliotheek in het project.**

### 1. Waarom geen jsPDF of pdfmake

De drie eisen, tegen elkaar afgezet:

| Eis | Printweergave | PDF-bibliotheek |
| --- | --- | --- |
| **In de stijl** | Gebruikt `bg-clay`, `text-ink`, `rounded-card` rechtstreeks — dezelfde CSS die de app gebruikt, bewaakt door `verify:tokens` | De huisstijl met de hand namaken in coördinaten en hexwaarden. Een tweede kopie die geen enkel script controleert, en die `AGENTS.md` regel 4 (nooit losse hex-kleuren) meteen breekt |
| **Mooi** | Echte typografie, tekst breekt vanzelf af, tabellen splitsen over pagina's met `break-inside: avoid` | Zelf regels afbreken en zelf uitrekenen waar een pagina eindigt |
| **Stabiel** | Geen dependency, geen versiedrift, 0 kB bundle | Bij data van onvoorspelbare lengte — een specs-map van 30 velden, een logboek van 200 regels — is handmatig pagineren precies de plek waar het breekt |

Daar komt de bundel bij. `App-*.js` staat op 290 kB en groeit per scherm; route-based code
splitting staat nog open (`STATE.md`). jsPDF zou daar ~150 kB gzip bovenop leggen voor een
document dat iemand in tien jaar een handvol keer opent.

### 2. De prijs, en waarom die acceptabel is

Twee dingen leveren we in:

- **Je kiest zelf "Opslaan als PDF"** in het printdialoog. Eén handeling extra.
- **De browser zet zijn eigen kop- en voettekst erop** (URL, datum, paginanummer). CSS-
  paginanummers via `@page { @bottom-right { … } }` worden door Chrome niet ondersteund, dus
  die zijn er niet als alternatief.

Voor een document dat je een paar keer per decennium maakt, weegt dat niet op tegen een
permanente dependency plus een tweede, onbewaakte kopie van de huisstijl.

### 3. Het ontwerp mag niet van achtergrondkleuren afhangen

Dit is de belangrijkste ontwerpregel die hieruit volgt, en de reden dat "stabiel" hier iets
anders betekent dan bij een gegenereerde PDF.

**Browsers printen achtergrondkleuren standaard niet.** Een ontwerp met gevulde vlakken komt
er kaal uit tenzij de gebruiker "Achtergrondafbeeldingen" aanzet — een vinkje dat verstopt zit
onder "Meer instellingen" en dat niemand kent.

Daarom: de printweergave draagt de huisstijl via **lijnen, kaders en accentkleur op tekst**, en
niet via gevulde blokken. `print-color-adjust: exact` staat er wél bij zodat het mét die
instelling nóg beter oogt, maar het ontwerp mag er niet van afhangen.

Dat is dezelfde redenering als elders in dit project: **niet vertrouwen op een instelling die
je niet kunt controleren.** Een dossier dat er bij de helft van de gebruikers kaal uitkomt is
niet stabiel, hoe mooi het bij de andere helft ook is.

### 4. Wat er wél en níét in komt

**Wel:**

1. **Voorblad** — adres, overdrachtsdatum, waarborg en polisnummer. De **opleverdatum alleen
   bij `opleverStatus: "aangezegd"`**: `opleverVerwacht` is de middelste waarde van een band
   met een staat ernaast (ADR-0008), en bij `indicatief` is dat een schatting. Een schatting
   hoort niet als feit op een overdrachtsdocument. Het model kent geen veld voor de wérkelijke
   opleverdatum; dat toevoegen zou een modelwijziging zijn en dus een eigen ADR
2. **Woningpaspoort** — inclusief het energielabel met registratienummer, opnamedatum en de
   afgeleide vervaldatum (tien jaar, ADR-0013 §4)
3. **Onderdelen die bij de woning blijven** — gefilterd op `blijftBijWoning`, mét specs,
   serienummer, installatiedatum, garantiestatus en een openstaande meldplicht
4. **Onderhoudslogboek** — chronologisch, met datum, wat, door wie en de kosten
5. **Meterstanden** — de laatste stand per meter op of vóór de overdrachtsdatum, in de volgorde
   van de bibliotheek. Staan er twee opnames op dezelfde dag, dan wordt dat **gemeld** in
   plaats van er stil één te kiezen: welke van de twee wint hangt af van het
   Firestore-document-id, en hierop wordt afgerekend met de energieleverancier. Dezelfde regel
   als in ADR-0015 §4, maar hier weegt hij zwaarder
6. **Betrokkenen** — bedrijfsnaam en rol, zie punt 5
7. **Disclaimer** — constraint C5

**Niet:**

- **Onderdelen die meeverhuizen.** Die staan er bewust niet in, en dat is precies waar
  ADR-0013 §2 voor gemaakt is: zonder het onderscheid tussen `montage` en `blijftBijWoning`
  zou het dossier een lijst apparatuur bevatten die de verkoper heeft meegenomen.

  **Dat geldt ook voor hun logboekregels.** De verificatiepass vond dat het onderdelenblok een
  vertrekkend apparaat wél weglaat, maar dat het via het logboek alsnog met naam en al op
  papier stond — inclusief de kosten, die meetelden in "wat dit huis kost aan onderhoud". Een
  belofte die langs de zijkant gebroken wordt is nog steeds gebroken. Regels van een
  vertrekkend onderdeel vallen dus weg.

  Een regel van een **verwijderd** onderdeel is iets anders en blijft wél staan, onder de
  neutrale noemer "Onderhoud": dat is geen belofte aan de koper maar een gat in de
  administratie, en het apparaat kan er nog gewoon hangen.

- **`documentUrl`.** Dat veld wijst naar waar het bestand bij de **verkoper** staat — een
  Drive- of OneDrive-link, vaak met een deeltoken erin en vaak naar een map waar ook de
  factuur en de hypotheekstukken liggen (ADR-0010 §3). Op een document dat naar een onbekende
  koper gaat hoort dat niet, om dezelfde reden als het 06-nummer in §5.

- **Gegevens over de verkoper in het paspoort.** `Woningpaspoort` bevat ook `notaris` en
  `hypotheekverstrekker`. Het dossier krijgt daarom een eigen `Dossierpaspoort` met alleen de
  velden die de wóning beschrijven — een projectie, geen doorgeefluik. `lib/woning.ts` rekent
  die twee om dezelfde reden al niet mee in zijn kernvelden.
- **Het bouwtraject** — ankers, afspraken, meerwerk, bouwdepot, opleverpunten. Dat is de
  administratie van de kóper met zijn aannemer, niet iets wat bij de woning hoort.
- **Bedragen uit het bouwtraject.** Koopsom, meerwerkbudget en depottermijnen gaan een nieuwe
  eigenaar niets aan. De kosten in het onderhoudslogboek gaan er wél in: die zeggen wat het
  onderhoud van dit huis kost, en dat is informatie over de wóning.

### 5. Van betrokkenen alleen de bedrijfsnaam en de rol

Geen contactpersoon, geen e-mailadres, geen telefoonnummer.

"Keukenstudio Van Dijk — keuken, geïnstalleerd 12-03-2027" is wat de koper nodig heeft: wie
het gedaan heeft, zodat hij ze kan opzoeken. De naam, het 06-nummer en het mailadres van een
contactpersoon zijn **persoonsgegevens van een derde**, en die geef je niet ongevraagd door aan
een onbekende koper omdat het toevallig handig is.

Dat is geen juridisch advies (C5) maar dezelfde terughoudendheid die de rest van de app kent:
het bedrijf is de partij, de contactpersoon is een mens.

**Structureel afgedwongen, niet alleen in de weergave.** `Dossierbetrokkene` heeft geen veld
voor een contactpersoon, e-mail of telefoon — er valt niets te renderen. Een test pint de
veldenlijst vast, zodat het toevoegen van zo'n veld een bewuste keuze wordt in plaats van een
onopgemerkte uitbreiding. Datzelfde geldt voor `Dossierkop` en `Dossierpaspoort`.

**Wat we níét kunnen afdwingen:** de vrije notitievelden bij onderdelen en logregels. Die gaan
mee, want ze bevatten vaak precies wat een koper nodig heeft ("filters maat 400"). Maar iemand
kan er ook een telefoonnummer of een bedrag uit het bouwtraject in geschreven hebben. Het
scherm zegt daarom vóór het printen dat de notities meegaan. Filteren zou raden zijn.

### 6. De overdrachtsdatum wordt niet opgeslagen

Het scherm vraagt om een datum en gebruikt die om de meterstanden af te kappen en het voorblad
te vullen. Die datum gaat **niet** naar Firestore.

Reden: het is een parameter van dít ene document, geen feit over het project. Een woning kan
meerdere keren overgedragen worden, en een concept-dossier van vorige maand hoort de gegevens
van het project niet te veranderen. Zou de datum wél opgeslagen worden, dan was het een veld
dat alleen bestaat omdat een scherm het toevallig nodig had — en dat is precies het soort veld
dat drie sessies later niemand meer kan plaatsen.

### 7. Constraint C2 blijft overeind, en dit is de scherpste test ervan

Er wordt geen bestand opgeslagen. De printweergave is HTML in browsergeheugen; de PDF die
eruit komt zet de browser op de schijf van de gebruiker, buiten de app om. Firestore ziet er
niets van.

Dat is meteen de reden dat dit dossier waarde heeft ondanks C2: **de app bewaart geen
handleidingen en facturen, maar levert wel het document dat je zonder die ordner nodig hebt.**
Gestructureerde gegevens plus een `documentUrl` bleken genoeg (ADR-0010 §3), en dit is het
bewijs daarvan.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
| --- | --- | --- | --- |
| **jsPDF** (~150 kB gzip) | Eén klik = één bestand, vaste bestandsnaam, paginanummers, identieke output overal | Huisstijl handmatig namaken buiten het bereik van `verify:tokens`; handmatige paginabreuk bij data van onvoorspelbare lengte; +50% bundel | De drie eisen (stijl, mooi, stabiel) wijzen alle drie de andere kant op |
| **pdfmake** | Declaratieve lay-out, tabellen die zelf afbreken | ~1 MB met fonts; nog steeds een tweede huisstijldefinitie | Bundelomvang is niet te verdedigen voor dit gebruik |
| **pdf-lib** | Sterk in bestaande PDF's bewerken | Geen lay-outmotor; alles met de hand positioneren | Lost het verkeerde probleem op |
| **Serverside PDF** in een Netlify Function | Volledige controle, identieke output | Alle projectdata zou naar de server moeten — dat botst frontaal met de privacybelofte en met C2 | Niet onderhandelbaar |
| **Printen vanaf de bestaande schermen** | Nul extra code | De schermen zijn interactief opgebouwd: knoppen, formulieren, uitklapbare historie. Dat print niet als document | Een dossier is een ander document dan een beheerscherm |
| **Ontwerp mét gevulde achtergrondvlakken** | Mooier op het scherm | Komt kaal uit de printer bij iedereen die het vinkje niet kent | Zie punt 3 |

## Gevolgen

**Positief.** Nul bundelgroei, nul dependencies, en de huisstijl blijft op één plek staan —
wijzigt `brink-ui/tokens.js`, dan verandert het dossier mee en bewaakt `verify:tokens` dat.
E8 raakt de rules niet, dus er hoeft na deze feature niet gedeployed te worden. En het
dossier is meteen ook een gewone webpagina: je kunt hem doorsturen of op een tablet laten zien
zonder er eerst een bestand van te maken.

**Negatief.** De output verschilt per browser in marges en in de kop- en voettekst. Er zijn
geen eigen paginanummers. De gebruiker moet in het printdialoog zelf "Opslaan als PDF" kiezen,
en dat moet het scherm dus uitleggen. En het printresultaat is **niet automatisch te testen** —
`vitest` kan de rekenkern controleren, maar of het er op papier goed uitziet moet met de hand.

**Terugdraaien.** Goedkoop, en dat is bewust zo ingericht. De rekenkern
(`src/lib/overdracht.ts`) stelt het dossier samen als gewone datastructuur en weet niets van
HTML; alleen de weergavelaag zou vervangen worden. Blijkt de output per browser te veel te
verschillen, of blijkt een vaste bestandsnaam echt nodig, dan kan er een bibliotheek achter
diezelfde structuur — zonder dat het samenstellen opnieuw moet.

**Wanneer we hierop terugkomen:** zodra iemand het dossier bij een notaris of makelaar moet
aanleveren met eisen aan de vorm, of zodra blijkt dat gebruikers struikelen over het
printdialoog. Beide zijn te merken zodra er echte gebruikers zijn (B4/F1).

## Wat dit níét verandert

- Constraint C2: er wordt geen bestand opgeslagen. De PDF ontstaat buiten de app.
- Constraint C3: geen enkele betaalde dienst, geen serverside rendering.
- Constraint C5: de disclaimer staat op het dossier zelf, niet alleen in de app.
- ADR-0013 §2: `blijftBijWoning` — en níét `montage` — bepaalt wat er in het dossier komt.
- ADR-0008: de vervaldatum van het energielabel en de garantie-einddatums worden ook hier
  berekend en niet opgeslagen.
