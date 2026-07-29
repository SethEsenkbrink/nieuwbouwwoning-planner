# ADR-0003 — TypeScript als projecttaal

**Status:** Geaccepteerd
**Datum:** 2026-07-29

## Context

De projectbrief laat de taalkeuze open. De rest van de werkruimte is plain JavaScript/JSX,
inclusief `@brink/ui`.

Twee eigenschappen van dit project maken typing zwaarder wegen dan bij de andere apps:

1. **Het wordt over veel losse sessies gebouwd.** Elke nieuwe chat begint zonder geheugen van
   de vorige. De klassieke fout is dan datamodel-drift: een sessie noemt een veld
   `sluitingsdatum`, de volgende `sluitDatum`, en niemand merkt het tot iets in productie
   stil kapotgaat.
2. **De documentparser produceert onbetrouwbare data.** LLM-output is per definitie
   ongevalideerd. Een expliciet type op de grens tussen function-response en applicatie is
   precies waar je die onzekerheid wilt vastpinnen.

Sinds TypeScript 7 (native Go-compiler, GA op 2026-07-08, ~10× sneller dan tsc 5.x) is het
oude "te traag / te veel gedoe"-argument grotendeels vervallen.

### Versiekeuze: waarom 6.0.3 en niet 7.0.2

Bij het opzetten van de tooling bleek TypeScript 7 nog niet bruikbaar in combinatie met de
linter. `typescript-eslint` 8.65.0 heeft als peer `typescript >=4.8.4 <6.1.0` en heeft
TS 7-ondersteuning expliciet als "not planned" gesloten voor de 7.0-lijn: tools die de
compiler programmatisch aanroepen (typescript-eslint, ts-jest, ts-morph) hangen aan een API
die pas in **TypeScript 7.1** stabiel wordt.

Zonder die ondersteuning vervallen de *type-aware* lint-regels. Dat zijn precies de regels
die in dit project het meest opleveren — `no-floating-promises` en `no-misused-promises`
vangen vergeten `await`s op Firestore- en Auth-calls, de meest voorkomende stille bug in een
Firebase-app.

De laatste stabiele versie binnen de ondersteunde range is **TypeScript 6.0.3**.

## Beslissing

Alle applicatie- en functioncode is **TypeScript** (`.ts` / `.tsx` / `.mts`), met
**`typescript@6.0.3`** en **type-aware linting** via `typescript-eslint`.

`src/types/model.ts` bevat de canonieke Firestore-datamodeltypes en is leidend boven elke
andere beschrijving van het model.

`@brink/ui` blijft plain JSX en krijgt een klein `.d.ts`-shim in `src/types/`.

### Trigger om naar TypeScript 7 te gaan

Zodra `typescript-eslint` een versie uitbrengt met een peer-range die TS 7.1 omvat. Dat is
één regel in `package.json` plus een `npm install`; de code zelf hoeft niet te wijzigen.
Controleer dat met:

```bash
npm view typescript-eslint@latest peerDependencies
```

Wie eerder al van de snellere compiler wil profiteren, kan `tsgo` los installeren voor
type-checking in CI, zonder `typescript` zelf te upgraden. Dat is nu bewust niet gedaan:
twee compilers naast elkaar in een vers fundament levert meer verwarring op dan tijdwinst.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
|---|---|---|---|
| Plain JavaScript | Simpelst; volgt de brief letterlijk; consistent met de werkruimte | Geen enkele bescherming tegen datamodel-drift tussen sessies | Precies het risico dat dit project loopt |
| JS + JSDoc | Type-hints zonder buildstap | Zwakker afgedwongen; JSDoc voor generics en unions wordt snel onleesbaar | Halve maatregel voor bijna dezelfde moeite |
| TypeScript 7.0.2 | Nieuwste; native compiler, ~10× sneller | `typescript-eslint` ondersteunt het niet; alle type-aware lint-regels vervallen | Je ruilt de belangrijkste kwaliteitscontrole in voor buildsnelheid die bij deze codebase-omvang niet merkbaar is |
| **TypeScript 6.0.3** | Sterkste bescherming op precies de zwakke plek; volledige type-aware linting | Niet de allernieuwste versie; upgrade naar 7 volgt later | Gekozen |

## Gevolgen

**Positief:** wijzig je een veld in `model.ts`, dan wijst de typechecker meteen elke plek aan
die meemoet. Een nieuwe sessie die het model verkeerd raadt, krijgt direct een fout in plaats
van stille corruptie. `npm run verify` vangt dit vóór elke commit af.

**Negatief:** de werkruimte is niet langer uniform JS. `@brink/ui` levert geen types en
vereist een handgeschreven shim die bij elke fundament-wijziging kan verouderen.

**Terugdraaien:** in principe triviaal (types strippen), maar zinloos — je zou de enige
bescherming weggooien die dit project echt nodig heeft.

## Regels

- Geen `any` zonder `// eslint-disable-next-line` mét reden in dezelfde regel.
- Data die van buiten komt (LLM-response, Firestore-document, formulierinvoer) wordt aan de
  grens gevalideerd, niet blind gecast. Een `as` op ongevalideerde externe data is een bug.
- `strict: true` staat aan en gaat niet uit.
