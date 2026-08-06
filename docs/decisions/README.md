# Architecture Decision Records

> **Wat hier staat:** waaróm het project is zoals het is. Eén bestand per keuze, in de vorm
> van `ADR-0000-template.md`.
>
> **ADR's worden nooit met terugwerkende kracht aangepast.** Blijkt een keuze achteraf
> verkeerd, dan komt er een nieuwe ADR die de oude vervangt, en krijgt de oude de status
> "Vervangen door ADR-00xx". Zo blijft zichtbaar wat we op dat moment wisten.
>
> Schrijf er een bij twijfel altijd één. "Het was maar een kleine keuze" is precies de
> redenering waardoor drie sessies later niemand meer weet waarom iets zo is.

## Index

| # | Titel | Status | Waar het over gaat |
|---|---|---|---|
| [0001](ADR-0001-react-vite-in-plaats-van-astro.md) | React + Vite in plaats van Astro | Geaccepteerd | Afwijking van de huisstandaard in de werkruimte; dit is een app, geen site |
| [0002](ADR-0002-tailwind-v4-css-first.md) | Tailwind v4 CSS-first | Geaccepteerd | Huisstijl geport naar `@theme`; geen `tailwind.config.js` |
| [0003](ADR-0003-typescript.md) | TypeScript als projecttaal | Geaccepteerd | Versie 6, niet 7 — anders vervallen de type-aware lintregels |
| [0004](ADR-0004-react-router-v8-declarative.md) | `react-router` v8 declarative | Geaccepteerd | `react-router-dom` is EOL; nooit daaruit importeren |
| [0005](ADR-0005-geen-firebase-storage-geen-cloud-functions.md) | Geen Storage, geen Cloud Functions | Geaccepteerd | Constraints C2 en C3; serverside logica hoort op Netlify |
| [0006](ADR-0006-uitgestelde-keuzes.md) | Bewust uitgestelde keuzes | Geaccepteerd | React Compiler, App Check, PWA, testlaag |
| [0007](ADR-0007-dependency-overrides.md) | Dependency-overrides | Geaccepteerd | `npm audit fix --force` downgradet elf versies; `overrides` in plaats daarvan |
| [0008](ADR-0008-betrokkenen-en-schuif-impact.md) | Betrokkenen en schuif-impact | Geaccepteerd | **De kern van de app.** Opleverdatum als band, afspraken als anker + offset, de actielijst |
| [0009](ADR-0009-zekerheid-en-herkomst-als-velden.md) | Zekerheid en herkomst als velden | Geaccepteerd | `waardenBron` en `zekerheid`: de app weet dingen met verschillende zekerheid en zegt dat |
| [0010](ADR-0010-woningdossier-tweede-fase.md) | Woningdossier als tweede fase | Geaccepteerd | Na de oplevering wordt de app het woningdossier. Eén app, `woningStatus`, nooit bestandsopslag |
| [0011](ADR-0011-meerwerk-sluiting.md) | Meerwerk: sluiting in drie vormen | Geaccepteerd | Vaste datum is de norm en schuift níét mee; bouwmoment is de uitzondering |
| [0012](ADR-0012-opschorting-en-gebreken.md) | 5%-depot als keuze, datum afgeleid | Geaccepteerd | Deadline afgeleid uit de onderhoudstermijn; bedrag niet uit de koopsom rekenen |
| [0013](ADR-0013-onderdelenregister-specs-montage-en-energielabel.md) | Onderdelenregister: specs, montage, energielabel | Geaccepteerd | `specs` als vrije map, plug-and-play vs vast, registratieplicht netbeheerder, energielabel als 10-jaarsklok |
| [0014](ADR-0014-onderhoudsschema-en-uitgestelde-herinneringen.md) | Onderhoudsschema en uitgestelde herinneringen | Geaccepteerd | `voorkeursmaand` naast `intervalDagen`, logboek meteen mee, **herziet ADR-0010 §4**: geen e-mail maar een lijst op het dashboard |
| [0015](ADR-0015-meterstanden-als-losse-collectie.md) | Meterstanden: meter en opname zijn twee dingen | Geaccepteerd | Twee subcollecties i.p.v. een meternaam per opname; verbruik altijd afgeleid; een dalende stand wordt gemarkeerd, niet rechtgerekend |
| [0016](ADR-0016-overdrachtsdossier-als-printweergave.md) | Overdrachtsdossier als printweergave | Geaccepteerd | Geen PDF-bibliotheek: de huisstijl blijft op één plek en de bundel groeit niet. Ontwerp mag niet van achtergrondkleuren afhangen |
| [0017](ADR-0017-bruikbaarheid-voor-nieuwe-features.md) | Bruikbaarheid vóór nieuwe features | Geaccepteerd | **Herziet de volgorde uit het bouwplan.** Ronde 9 gaat over UX en bugs; C5, blok F en de improvements-wachtrij schuiven op |
| [0018](ADR-0018-dashboard-als-overzicht.md) | Dashboard als overzicht, niet als werklijst | Geaccepteerd | **Draait ADR-0008 principe 5 om in de verticale volgorde.** Eerst de stand van zaken, dan het werk. Rekenkern naar `lib/dashboard.ts` |
| [0019](ADR-0019-expressielimiet-en-enums-in-geneste-maps.md) | Geen enumvalidatie in geneste maps | Geaccepteerd | **Verzwakt bewust de model-/rules-pariteit.** Eén `isOneOf` in een geneste map duwt de projectregel over Firestore's limiet van 1000 expressies |

## De vier die je als eerste moet lezen

Begin je nieuw op dit project, lees dan in deze volgorde:

1. **ADR-0008** — waarom afspraken aan bouwmomenten hangen en niet aan datums. Zonder dit
   snap je de helft van de code niet.
2. **ADR-0009** — waarom overal `zekerheid` en `waardenBron` doorheen lopen.
3. **ADR-0005** — de twee constraints die het makkelijkst per ongeluk sneuvelen.
4. **ADR-0017** — waar we nú aan werken, en waarom dat niet is wat het bouwplan zegt.

De rest lees je zodra je aan dat onderwerp komt.

## Terugkerend patroon in 0008, 0009, 0011, 0012 en 0015

Vijf ADR's gaan uiteindelijk over dezelfde regel, telkens in een ander jasje:

> **Sla een datum alleen op als hij een feit over de buitenwereld is, niet als hij uit de
> planning volgt.**

Opgeslagen omdat het feiten zijn: `gecommuniceerdeDatum` (wat weet die partij nu),
`sluitingsdatum` van meerwerk (een administratieve termijn van de aannemer),
`gemeldOp` van een gebrek, `stand` + `opgenomenOp` van een meteropname. Afgeleid omdat ze uit
de planning of uit andere feiten volgen: elke afspraakdatum, de uiterste datum voor het
5%-depot, alle garantietermijnen, en het verbruik tussen twee meterstanden.
