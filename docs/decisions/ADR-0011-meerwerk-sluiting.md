# ADR-0011 — Meerwerk sluit op een vaste datum, met een bouwmoment als uitzondering

**Status:** Geaccepteerd
**Datum:** 2026-07-31

## Context

`PROJECT.md` §5 gaf `MeerwerkItem` een `sluitingsdatum` als vaste `Timestamp`. Bij het
bouwen van de meerwerk-tracker (backlog C3) kwam de vraag op of dat niet in strijd is met
ADR-0008, dat voorschrijft dat datums worden afgeleid van een bouwmoment en nooit worden
opgeslagen. De formulering in `PROJECT.md` §6 wees die kant op: "meerwerk-tracker met
sluitingsdatums gekoppeld aan de bouwfase".

Doorslaggevend was de domeinkennis van gebruiker #1:

> Meerwerkdatums worden vrijwel altijd vóór de start van de bouw gesloten. Zodra de bouw
> start kun je niet meer even meerwerk kiezen uit de keuzelijst van de aannemer. Soms komt
> er tijdens de bouw alsnog meerwerk beschikbaar, vanwege iets wat aan de voorkant nog niet
> bekend was — dat moet dan op dat moment meegenomen kunnen worden.

Dat verandert de analyse wezenlijk. Er zijn twee soorten meerwerk-deadlines, en ze gedragen
zich tegengesteld.

### Soort 1 — de administratieve sluitingsdatum (het normale geval)

De aannemer stelt één of enkele harde data waarop de keuzelijst dichtgaat: "meerwerkopties
inleveren vóór 15 september". Die datum staat in de koopstukken, ligt vóór de start van de
bouw, en is **een afspraak met de verkooporganisatie, geen bouwmoment**. Schuift de bouw
een maand op, dan schuift deze datum niet mee — de administratie is dan allang gesloten.

Zou je hem als anker + offset opslaan, dan gebeurt precies het omgekeerde van wat ADR-0008
beoogt: bij elke verschuiving van de bouw beweegt een deadline mee die in werkelijkheid
vaststaat. Je zou dus te laat gewaarschuwd worden, over de duurste categorie beslissingen
die er in het hele traject zijn.

### Soort 2 — meerwerk dat tijdens de bouw opkomt (de uitzondering)

Blijkt tijdens de bouw dat iets nog kan of moet, dan is de deadline wél een bouwmoment:
"extra loze leiding, maar wel vóórdat de dekvloer wordt gestort." Hier geldt ADR-0008
onverkort — schuift het storten, dan schuift de beslismomentdatum mee.

## Beslissing

`MeerwerkItem` krijgt een expliciet veld dat zegt welk van de twee het is:

```ts
export type MeerwerkSluiting = "vaste_datum" | "bouwmoment" | "onbekend";

sluiting: MeerwerkSluiting;      // verplicht
sluitingsdatum?: Timestamp;      // alleen bij "vaste_datum"
sluitingAnkerType?: AnkerType;   // alleen bij "bouwmoment"
sluitingOffsetDagen?: number;    // alleen bij "bouwmoment"
```

**`vaste_datum` is de standaard in de UI**, want dat is het normale geval. `bouwmoment` is
één klik weg voor de uitzondering. `onbekend` bestaat omdat je een meerwerkwens kunt
noteren voordat je weet wanneer hij dichtgaat — en een verzonnen datum is erger dan geen.

### Waarom een expliciet veld en geen afleiding uit "welk veld is ingevuld"

Dat was het alternatief: staat er een `sluitingAnkerType`, dan is het een bouwmoment,
anders een datum. Goedkoper in velden, maar het herhaalt de fout die op het ankerscherm
juist is vermeden: twee bronnen van waarheid waarvan er stilzwijgend één wint. Bij het
bewerken van een item van bouwmoment naar vaste datum blijft het oude ankerveld staan
(`zonderLegeVelden()` strippt `undefined`), en dan bepaalt de volgorde in een `if` wat de
gebruiker ziet. Met een expliciet veld is dat onmogelijk, en kunnen de Firestore-rules het
bovendien valideren.

### Gevolg voor de rekenkern

`berekenDatum()` uit `planning.ts` wordt hergebruikt voor `bouwmoment`, inclusief de
terugval en de `zekerheid` uit ADR-0009. Voor `vaste_datum` is er niets te rekenen — die
datum is wat hij is. De UI toont bij een vaste datum dus géén zekerheidsmelding, en bij een
bouwmoment wél.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
| --- | --- | --- | --- |
| Alleen een vaste datum (het huidige model) | Simpelst, en dekt het normale geval | Meerwerk dat tijdens de bouw opkomt krijgt een datum die niet meeschuift; precies het handwerk dat de app wegneemt | Laat de uitzondering vallen die geld kost |
| Alleen anker + offset | Consistent met ADR-0008 | De administratieve sluitingsdatum gaat meeschuiven met een bouw die verschuift, terwijl hij in werkelijkheid vaststaat. Je wordt te laat gewaarschuwd | Fout in het normale geval, en dat is negentig procent |
| Beide velden, soort afleiden uit wat is ingevuld | Eén veld minder | Twee bronnen van waarheid; een achtergebleven ankerveld bepaalt stilzwijgend het gedrag; niet te valideren in de rules | Precies de fout die op `/ankers` is vermeden |
| **Expliciet `sluiting`-veld** | Eén waarheid, valideerbaar, UI kan de juiste velden tonen | Eén extra veld en drie rule-regels | Gekozen |

## Gevolgen

**Positief.** Het normale geval klopt (een harde datum die niet meeschuift) én de
uitzondering klopt (een deadline die aan de bouw hangt). De UI kan bij `vaste_datum` waarschuwen
zodra de datum nadert of gepasseerd is, zonder de suggestie van een berekening die er niet is.

**Negatief.** `MeerwerkItem` heeft nu vier velden voor één begrip. De rules moeten drie
voorwaardelijke checks doen, en `verify:rules` moet de nieuwe enum kennen. En de
`sluitingsdatum` in `PROJECT.md` §5 moest herschreven worden — dat schema was al gepubliceerd
in de documentatie.

**Terugdraaien.** Goedkoop zolang er geen meerwerk in staat. `sluiting` op `"vaste_datum"`
zetten en de twee ankervelden negeren levert het oude model op.

## Relatie tot ADR-0008

Dit is geen uitzondering op ADR-0008 maar een verfijning van de reikwijdte. ADR-0008 gaat over
**afspraken met partijen die je zelf inschakelt**: die hangen aan de bouw, dus hun datum hoort
afgeleid te zijn. Een administratieve sluitingsdatum van de aannemer is een andere soort feit
— een contractuele termijn, zoals de bedenktijd of de geldigheidsduur van een hypotheekofferte.
Die horen wél gewoon als datum opgeslagen te worden.

De onderliggende regel blijft dus overeind: **sla een datum alleen op als hij een feit over de
buitenwereld is, niet als hij uit de planning volgt.** Dezelfde redenering die
`gecommuniceerdeDatum` rechtvaardigt (ADR-0008, principe 5).
