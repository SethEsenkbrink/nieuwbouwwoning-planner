# ADR-0013 — Het onderdelenregister: specs, montagevorm, registratieplicht en energielabel

**Status:** Geaccepteerd
**Datum:** 2026-08-01

## Context

ADR-0010 legde het woningdossier vast en schetste de collectie `onderdelen` met de velden
merk, type, serienummer, installatiedatum, garantietermijn en `documentUrl`. Bij het uitwerken
van blok E, ronde 6, bleek die opzet op vier punten te kort te schieten. Alle vier komen ze uit
dezelfde vraag van gebruiker #1 op 2026-08-01: *"zet er meerdere merken en types in zodat men
niet zelf hoeft te bedenken wat er moet worden ingevuld."*

De woning van gebruiker #1 krijgt een **Nibe warmtepomp**, een **Brink WTW-systeem**,
**zonnepanelen met omvormer**, een **waterontharder** en een **drinkwaterfilter**, en er wordt
een **thuisbatterij** overwogen — waarschijnlijk plug-and-play.

Wat er bij het uitwerken naar boven kwam:

**1. Merk en type zijn niet genoeg om een apparaat te herkennen.** Bij een storing zoek je
niet naar "Nibe" maar naar het vermogen, het koudemiddel of de SCOP. Die velden verschillen
volledig per categorie: een warmtepomp heeft vermogen, SCOP en koudemiddel; een omvormer
AC-vermogen en aantal MPPT-ingangen; een batterij capaciteit in kWh, laadvermogen en
cyclusgarantie; een WTW-unit een debiet in m³/h en een filterklasse. Vaste kolommen dwingen
of tot een tabel met dertig lege velden, of tot een notitieveld waar niets uit te halen valt.

**2. Een plug-and-play batterij is een fundamenteel ander ding dan een vaste installatie.**
Dit kwam als terloopse opmerking binnen en bleek de scherpste scheidslijn in het hele
register:

| | Plug-and-play | Vast geïnstalleerd |
| --- | --- | --- |
| Juridisch | roerende zaak | nagelvast, onderdeel van de onroerende zaak |
| Bij verkoop | verhuist mee, tenzij op de lijst | blijft achter |
| Verzekering | inboedel | opstal |
| Installateur | geen, je steekt hem in het stopcontact | erkend installateur vereist |
| Garantie | fabrieksgarantie op het product | product plus installatiegarantie |

Zonder dat onderscheid genereert het overdrachtsdossier (E8) straks een lijst met apparatuur
die de verkoper heeft meegenomen, en staat de aftelklok voor installatiegarantie op een
apparaat waar nooit een installateur aan te pas kwam.

**3. Sommige onderdelen kennen een wettelijke registratie- of keuringsplicht met een
deadline.** Ontdekt bij het onderzoek naar thuisbatterijen: sinds 7 mei 2024 moet elke batterij
vanaf **0,8 kW** die terug kan leveren worden aangemeld bij de netbeheerder via
Energieleveren.nl — **ook plug-and-play modellen**, en vrijwel elke plug-in batterij zit boven
die grens. Meld je het niet aan, dan mag de netbeheerder je teruglevering weigeren of je
aansluiting beperken. Dat is precies het soort termijn waar deze app voor bestaat, en het zou
zonde zijn als het register de gegevens wél kent maar de verplichting niet.

**4. Het energielabel is geen tekstje maar een document met een houdbaarheidsdatum.**
ADR-0010 zette `energielabel` als los veld in het woningpaspoort. Een energielabel is echter
**tien jaar geldig vanaf de opnamedatum**, heeft een registratie in **EP-online**, en verloopt
stil: is het verlopen, dan is het ook uit EP-online en MijnOverheid verdwenen, en bij verkoop
heb je een geldig label nodig. Voor nieuwbouw komt het label voort uit de BENG-berekening bij
oplevering. Dat is dezelfde mechaniek als de garantieklokken uit blok D.

## Beslissing

### 1. Specs zijn een vrije sleutel-waardelijst met een voorgestelde veldenlijst per categorie

Op `Onderdeel` komt:

```ts
specs?: Record<string, string>;
```

De **standaardbibliotheek** levert per onderdeeltype een lijst van voorgestelde specsleutels
mét eenheid en, waar zinnig, een keuzelijst. Bij het aanmaken van een warmtepomp staan de
velden "Vermogen (kW)", "SCOP", "Koudemiddel" en "Type bron" er dus al klaar; de gebruiker
vult alleen waarden in. Eigen sleutels toevoegen mag.

**Waarom een map en geen subcollectie of vaste kolommen.** Een map telt in
`request.resource.data.size()` als **één veld**, dus de veldlimiet in de rules blijft
hanteerbaar. Een subcollectie zou een extra read per onderdeel kosten voor gegevens die je
altijd samen met het onderdeel wilt zien. Vaste kolommen per categorie zouden betekenen dat
elke nieuwe categorie een modelwijziging is.

**De waarden zijn strings, ook de getallen.** "7,5 kW", "R290" en "4,8" staan in hetzelfde
veld. Er wordt niet met specs gerekend — ze zijn er om te vinden en over te typen bij een
storing of een offerte. Zodra er wel mee gerekend moet worden, is dat een nieuwe ADR en geen
sluipende typewijziging. De rules begrenzen sleutel- en waardelengte en het aantal sleutels.

### 2. `montage` en `blijftBijWoning` zijn twee aparte velden

```ts
montage: "vast_geinstalleerd" | "plug_and_play" | "nvt";
blijftBijWoning: boolean;
```

**Bewust niet afgeleid van elkaar.** De regel "plug-and-play ⇒ verhuist mee" klopt meestal
maar niet altijd: een plug-in batterij kan bij de woning verkocht worden, en een vaste
zonwering kan in de onderhandeling meegaan. Twee velden waarvan de bibliotheek er één
voorstelt is eerlijker dan één veld dat stilzwijgend het andere bepaalt. Hetzelfde patroon als
`sluiting` in ADR-0011: expliciet vastleggen wélk geval het is, in plaats van het afleiden uit
welk ander veld gevuld is.

`blijftBijWoning` voedt het overdrachtsdossier (E8) en de scheiding inboedel/opstal.
`montage` bepaalt of er een installateur en een installatiegarantie bij horen.

### 3. Een registratieplicht is een veld op het onderdeel, geen los taaktype

```ts
registratieplicht?: {
  instantie: string;        // "Netbeheerder via Energieleveren.nl"
  aangemeldOp?: Timestamp;  // een feit, dus wél opgeslagen
  referentie?: string;      // het meldnummer
  toelichting?: string;
};
```

De standaardbibliotheek zet dit klaar bij de onderdeeltypes waar het speelt — nu de
thuisbatterij (beide montagevormen, vanaf 0,8 kW) en de PV-installatie. Zolang
`aangemeldOp` leeg is, komt het onderdeel op de actielijst; daarna niet meer. Exact hetzelfde
mechanisme als `gecommuniceerdeDatum` uit ADR-0008: het verschil tussen wat de app weet en wat
de buitenwereld weet ís de actielijst.

**Geen aparte collectie.** Een registratieplicht zonder het apparaat waar hij bij hoort is
betekenisloos, en een los taaktype zou de gebruiker dwingen zelf de koppeling te leggen.

### 4. Het energielabel krijgt drie velden en één afgeleide klok

In het woningpaspoort:

```ts
energielabel?: string;              // "A++++"
energielabelRegistratie?: string;   // het EP-online registratienummer
energielabelOpnameDatum?: Timestamp;
```

De einddatum is **opnamedatum + 10 jaar** en wordt **niet opgeslagen** — ADR-0008 onverkort.
De klok komt naast de vier garantieklokken uit blok D te staan, met dezelfde
markering-bij-90-dagen. `overMaanden()` in `lib/oplevering.ts` doet het maandrekenen al goed,
inclusief de klem op de laatste dag van de maand.

### 5. Het woningpaspoort is één genest map-veld op het project

```ts
woningpaspoort?: Woningpaspoort;
```

`Project` telt nu 18 velden; de rules staan op `withinSize(25)`. Het paspoort voegt er elf toe
en zou de limiet dus breken. Als geneste map kost het **één** veld, blijven `woningStatus` en
`woningpaspoort` samen binnen de 25, en hoeft de limiet niet omhoog. De map krijgt een eigen
groottecheck in de rules, zodat de bescherming uit ADR-0005 §C2 — een document mag geen
opslagplek worden — niet via een omweg vervalt. Dit is precies wat ADR-0010 §2 al schetste,
nu met de reden erbij.

### 6. De bibliotheek noemt merken en typen, met dezelfde disclaimerplicht als ADR-0009

De onderdelenbibliotheek bevat per categorie een lijst van in Nederland gangbare merken en
modelseries, zodat de gebruiker kiest in plaats van typt. Dat brengt twee risico's mee die
expliciet afgedekt worden:

- **Het is geen advies en geen aanbeveling** (constraint C5). De lijst is alfabetisch, kent
  geen volgorde van voorkeur, geen beoordelingen en geen prijzen. Een merk in de lijst is een
  merk dat bestaat, niet een merk dat wij aanraden.
- **De lijst veroudert.** Modelseries verschijnen en verdwijnen. Daarom is de keuzelijst
  **nooit gesloten**: een eigen merk of type invullen moet altijd kunnen, en de opgeslagen
  waarde is een vrije string en geen enum. Er komt dus ook géén `verify:rules`-koppeling op
  merknamen — dat zou van een momentopname een harde regel maken.

De onderhoudsintervallen uit de bibliotheek krijgen `waardenBron: "voorstel"` conform ADR-0009,
met dezelfde zichtbare disclaimer als de aanlooptijden van de betrokkenen. Het interval van de
fabrikant wint altijd van onze schatting.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
| --- | --- | --- | --- |
| Vaste speckolommen per categorie | Type-veilig, doorzoekbaar, valideerbaar in de rules | Elke nieuwe categorie is een modelwijziging plus een rules-wijziging; de meeste kolommen blijven leeg | Het register moet uitbreidbaar zijn zonder migratie |
| Specs als subcollectie | Onbeperkt, per spec een eigen document | Een extra read per onderdeel voor gegevens die je nooit los bekijkt | Kosten en complexiteit zonder opbrengst |
| Specs als vrij notitieveld | Nul modelwerk | Niets doorzoekbaar, en de gebruiker moet zelf bedenken wat relevant is — precies wat de vraag was | Lost het probleem niet op |
| `blijftBijWoning` afleiden uit `montage` | Eén veld minder | De regel kent uitzonderingen in beide richtingen | Dezelfde fout als een impliciete `sluiting` in ADR-0011 |
| Registratieplicht als gewone `Task` | Bestaand mechanisme, geen modelwerk | De koppeling met het apparaat gaat verloren; bij het invoeren van de batterij moet de gebruiker zélf bedenken dat er een meldplicht is | De app hoort dit te weten, niet de gebruiker |
| Energielabel als los tekstveld (ADR-0010) | Simpel | Mist de vervaldatum, en juist het verlopen is het probleem: een verlopen label verdwijnt stil uit EP-online en blokkeert een verkoop | Een datum die stil verstrijkt is precies wat deze app moet vangen |
| Woningpaspoort als losse velden op het project | Rechtstreeks te valideren in de rules | Breekt `withinSize(25)`, of dwingt de limiet omhoog en verzwakt daarmee C2 | Een map kost één veld en houdt de bescherming intact |
| Merken als gesloten enum met `verify:rules` | Consistente data, geen typefouten | De lijst veroudert en een ontbrekend merk blokkeert de gebruiker volledig | Een momentopname mag geen harde regel worden |

## Gevolgen

**Positief.** Het invullen van een onderdeel wordt kiezen in plaats van bedenken — de vraag
waar deze ADR uit voortkwam. Het overdrachtsdossier (E8) klopt straks, omdat het onderscheid
roerend/onroerend vanaf dag één in de data zit in plaats van achteraf gereconstrueerd te
moeten worden. De registratieplicht bij de netbeheerder is een concrete verplichting met een
consequentie die de app nu kan bewaken. En de garantieklokken uit blok D worden pas echt
bruikbaar, precies zoals ADR-0010 voorspelde.

**Negatief.** Er komt een tweede standaardbibliotheek bij die onderhouden moet worden, en
deze veroudert sneller dan de eerste: aanlooptijden van een keukenleverancier veranderen
langzaam, modelseries van omvormers niet. `specs` als `Record<string,string>` is bewust
zwak getypeerd — er valt niet mee te rekenen en niet op te sorteren zonder eerst te parsen.
Het geneste `woningpaspoort` maakt de rules-validatie omslachtiger dan losse velden, omdat
elke veldcheck door de map heen moet.

**Terugdraaien.** Nu goedkoop, later duur — hetzelfde patroon als ADR-0010. `specs` en
`registratieplicht` zijn optionele velden die genegeerd kunnen worden. `montage` en
`blijftBijWoning` niet: zodra er onderdelen in staan is dat een migratie, want de waarde is
niet achteraf af te leiden. Vandaar dat het nú in het model gaat en niet in ronde 8.

## Wat dit níét verandert

- Constraint C1 t/m C5 uit `PROJECT.md` §3. C2 wordt hier opnieuw bevestigd: `documentUrl`
  blijft een link, `specs` blijft tekst, en er komt geen base64 in een Firestore-document.
- De regel dat afgeleide datums nooit worden opgeslagen (ADR-0008). `aangemeldOp` en
  `energielabelOpnameDatum` zijn feiten over het verleden, net als `gecommuniceerdeDatum` en
  `laatstUitgevoerdOp` — geen planning.
- Het onderscheid voorstel/eigen uit ADR-0009. De onderhoudsintervallen uit de nieuwe
  bibliotheek vallen er onverkort onder.
- De structuur uit ADR-0010 §2. Deze ADR vult `onderdelen` aan en vervangt hem niet.
