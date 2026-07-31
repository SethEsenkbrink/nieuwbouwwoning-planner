# ADR-0010 — Van bouwtraject naar woningdossier: één app, twee fases

**Status:** Geaccepteerd
**Datum:** 2026-07-31

## Context

`PROJECT.md` beschrijft een app die eindigt bij de garantietermijn. Het traject loopt van de
koopovereenkomst tot de oplevering, en daarna dooft de app uit.

Op 2026-07-31 is besloten dat dat het verkeerde eindpunt is. Op het moment dat de sleutels
worden overgedragen, is de data in de app juist op zijn waardevolst: wie heeft wat
geïnstalleerd, welke garanties lopen er, welke partijen ken je al, en wanneer is er voor het
laatst iets aan geraakt. Die kennis verdwijnt normaal gesproken in een ordner die niemand
meer openslaat — en tien jaar later, bij verkoop of bij een storing, is het weg.

De app moet dus na de oplevering **van vorm veranderen zonder van plek te veranderen**: van
"loods me door de bouw" naar "beheer mijn woning".

### Waarom dit geen tweede product wordt

De mechaniek die er sinds ADR-0008 staat, past er bijna één-op-één op:

| Bouwtraject | Woningdossier |
| --- | --- |
| anker (bouwmoment) | installatiedatum of laatste onderhoudsbeurt |
| offset in dagen | onderhoudsinterval |
| betrokkene met aanlooptijd | servicepartij of installateur |
| `gecommuniceerdeDatum` | "de afspraak staat gepland" |
| actielijst op urgentie | onderhoudslijst op urgentie |
| standaardbibliotheek met voorstel-waarden | onderhoudsintervallen per onderdeeltype |

Een apart product zou die hele laag dupliceren én de continuïteit weggooien die de waarde
uitmaakt: de keukenleverancier uit je bouwtraject is dezelfde partij die over acht jaar je
scharnieren komt afstellen.

## Beslissing

### 1. Eén applicatie, twee fases, één veld

Op het project komt:

```ts
woningStatus: "in_aanbouw" | "opgeleverd";
```

De sleuteloverdracht is de omslag. Het dashboard verandert van **inhoud**, niet van plek: in
`in_aanbouw` staat de schuif-impact-actielijst bovenaan, in `opgeleverd` de onderhoudslijst.
De gebruiker zet dit zelf om; er is geen automatische overgang op basis van een datum, want
een oplevering kan mislukken en een sleuteloverdracht kan uitgesteld worden.

Het project blijft één document. Er komt geen aparte `woningen`-collectie — dat zou betekenen
dat betrokkenen, ankers en afspraken uit het bouwtraject aan de verkeerde kant van de scheiding
komen te staan.

### 2. Terugkerend onderhoud is een uitbreiding van het model, geen hergebruik

Dit is het enige punt waar de bestaande mechaniek niet volstaat. Een bouwafspraak gebeurt
één keer; onderhoud herhaalt zich. Daarvoor komen er drie subcollecties bij:

```
users/{uid}/projects/{projectId}
  - woningStatus (in_aanbouw | opgeleverd)
  - woningpaspoort: adres, postcode, plaats, woningtype, bouwjaar,
                    oppervlakte, energielabel, waarborgpolisnummer
  ├── onderdelen/{onderdeelId}
  │     - naam, categorie (verwarming | ventilatie | water | elektra
  │                       | zonwering | dak | gevel | sanitair | overig)
  │     - merk, type, serienummer
  │     - installatieDatum, installateurBetrokkeneId
  │     - garantieMaanden
  │     - documentUrl        // een LINK, nooit een bestand — zie punt 3
  │     - notitie
  ├── onderhoudstaken/{taakId}
  │     - onderdeelId (optioneel — niet alles hangt aan een apparaat)
  │     - titel, omschrijving
  │     - intervalDagen              // 365 = jaarlijks, 30 = maandelijks
  │     - seizoen (optioneel)        // "najaar" voor dakgoten
  │     - laatstUitgevoerdOp
  │     - waardenBron (voorstel | eigen)   // zelfde patroon als ADR-0009
  │     - waarschuwing
  └── onderhoudslogboek/{logId}
        - taakId, onderdeelId, uitgevoerdOp
        - doorWie, kosten, notitie
```

De rekenkern krijgt er één pure functie bij naast `berekenDatum()`:
`berekenVolgendeOnderhoud(taak, vandaag)` → `laatstUitgevoerdOp + intervalDagen`, met dezelfde
urgentiebepaling eromheen. Nooit uitgevoerd? Dan telt de installatiedatum van het onderdeel
als startpunt, en anders de opleverdatum.

**De regel uit ADR-0008 blijft onverkort gelden: er wordt geen onderhoudsdatum opgeslagen.**
Alleen `laatstUitgevoerdOp` + `intervalDagen`; de volgende keer is altijd afgeleid.
`laatstUitgevoerdOp` is — net als `gecommuniceerdeDatum` — geen planning maar een feit over
het verleden.

### 3. Geen bestandsopslag, ook hier niet

Constraint C2 (ADR-0005) blijft volledig van kracht. Dit is de plek waar hij het hardst gaat
knellen: een woningdossier zonder handleidingen, facturen en foto's voelt incompleet, en de
verleiding om "heel even" Firebase Storage aan te zetten is hier groter dan waar dan ook.

Wat wél mag, en wat het grootste deel van de behoefte afdekt:

- **Alle gegevens gestructureerd overnemen.** Merk, type, serienummer en installatiedatum zijn
  waar je bij een storing daadwerkelijk naar zoekt — niet de PDF zelf.
- **Een `documentUrl` per onderdeel**: een link naar waar het bestand bij de gebruiker staat
  (Drive, OneDrive, de site van de fabrikant). De app bewaart de vindplaats, niet de inhoud.
- **Later, optioneel:** een handleiding client-side inlezen met `pdf.js` en er gestructureerde
  velden uit halen — precies de flow uit `PROJECT.md` §4, waarbij het bestand het
  browsergeheugen nooit verlaat.

Wat níét mag, en waar een volgende sessie niet op mag terugkomen: Firebase Storage, base64 in
Firestore-documenten, of een externe opslagdienst. De veldlimiet in de rules (die sinds
sessie 03 werkt) is er mede om dat af te dwingen.

### 4. Een herinnering die je moet komen halen, is geen herinnering

Onderhoud dat over acht maanden moet gebeuren, werkt alleen als de app zich meldt. Daarmee
verschuift de **scheduled Netlify Function met e-mail** van "fase 3, ooit" naar een
voorwaarde voor blok E. Netlify heeft scheduled functions in het gratis plan, dus dit past
binnen constraint C3. De mailprovider is nog niet gekozen; die keuze krijgt een eigen ADR.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
| --- | --- | --- | --- |
| Apart product voor het dossier | Schone scheiding, elk product één verhaal | Dupliceert betrokkenen, standaardbibliotheek, urgentiebepaling en auth; de gebruiker moet zijn gegevens twee keer invoeren | Gooit precies de continuïteit weg die de waarde uitmaakt |
| Onderhoud als gewone `Afspraak` met een anker | Geen modeluitbreiding nodig | Een afspraak is eenmalig; herhaling zou betekenen dat je bij elke uitvoering een nieuwe afspraak aanmaakt en de historie in de collectie zelf opslaat | Maakt de actielijst onleesbaar en de historie onvindbaar |
| Onderhoudsdatums wél opslaan | Simpeler te tonen | Bij een verzette beurt schuift de hele reeks niet mee | Zelfde fout als vaste afspraakdatums (ADR-0008) |
| Firebase Storage voor handleidingen | Wat iedereen verwacht | Breekt C2, en kost geld bij volume | Niet onderhandelbaar (ADR-0005) |
| Automatisch omzetten naar `opgeleverd` op de opleverdatum | Eén handeling minder | Een oplevering kan mislukken of uitgesteld worden; de app zou dan van vorm veranderen op een moment dat er juist nog van alles moet | Handmatig omzetten is één klik en altijd correct |

## Gevolgen

**Positief.** De app krijgt een levensduur van tien jaar in plaats van één. De bestaande
mechaniek wordt hergebruikt in plaats van gedupliceerd, en het onderdelenregister maakt de
garantie-aftelklokken uit blok D (`PROJECT.md` fase 3) pas echt bruikbaar: zonder te weten
welke warmtepomp erin zit, kun je niet waarschuwen dat de fabrieksgarantie afloopt.

**Negatief.** De scope wordt aanzienlijk groter, en het datamodel groeit met drie
subcollecties plus een woningpaspoort op het project. De veldlimiet in de rules moet daarvoor
opnieuw bekeken worden — die staat nu op 25 voor `projects`, en het paspoort voegt er zeven
tot tien toe. Daarnaast introduceert dit een tweede standaardbibliotheek die onderhouden moet
worden, met dezelfde disclaimer-plicht als de eerste (ADR-0009).

**Terugdraaien.** Goedkoop zolang er niets gebouwd is; duur zodra er onderdelen en logboeken
in staan. `woningStatus` is één veld dat genegeerd kan worden, maar de drie subcollecties zijn
dat niet. Daarom eerst het model vastleggen en voorleggen, dán bouwen — dezelfde volgorde als
bij ADR-0008.

## Wat dit níét verandert

- Constraint C1 t/m C5 uit `PROJECT.md` §3. Alle vijf blijven onaangetast; C2 en C3 worden
  hierboven expliciet herbevestigd.
- De regel dat afgeleide datums nooit worden opgeslagen (ADR-0008).
- Het onderscheid tussen voorstel en eigen cijfers (ADR-0009). De onderhoudsintervallen uit de
  standaardbibliotheek zijn schattingen en krijgen hetzelfde label als de aanlooptijden.
