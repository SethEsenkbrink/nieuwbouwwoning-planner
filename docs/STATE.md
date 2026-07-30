# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-07-30 · sessie 03
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).
> Geen geschiedenis hier — die staat in `sessions/`. Houd dit onder één scherm.

---

## Waar staan we

Het fundament stond al; **nu staat ook de kern van de eerste feature**. Het datamodel voor
betrokkenen en schuif-impact is uitgewerkt, de Firestore-rules dekken de drie nieuwe
subcollecties af, de standaardbibliotheek met 38 partijen is typed data geworden, en de
rekenmotor draait met **37 groene unit tests**.

Er is nog **geen UI** voor deze feature. Je kunt dus nog geen project of betrokkene
aanmaken in de browser — dat is de volgende stap. De logica eronder is af en getest.

## Klaar

- Alles uit sessie 01 en 02 (fundament, Firebase live, auth-flow, huisstijl, security)
- **`src/types/model.ts`**: `Anker`, `Betrokkene`, `Afspraak`, `AnkerType` (8 bouwmomenten),
  plus de opleverdatum als band met staat op `Project`
- **`firebase/firestore.rules`**: `ankers`, `betrokkenen`, `afspraken` met dezelfde
  striktheid als de bestaande collecties (enum-whitelists, int-bereiken, lengtelimieten).
  Projectlimiet van 20 naar 25 velden omdat de opleverband er zes bij deed
- **`firebase/rules.test.ts`**: 34 tests erbij (was 19, nu 53) voor de nieuwe collecties en
  de opleverband. **53/53 groen** en de rules zijn gedeployed — wat live staat is nu de
  geteste versie
- **Bug gevonden en gefixt: de size-limiet in de rules deed niets.**
  `request.resource.size()` telt de eigenschappen van het Resource-object, niet de velden
  van het document — daarvoor moet je `request.resource.data.size()` gebruiken. De check
  stond er sinds sessie 01 en heeft nooit iets geweigerd. Gevonden op het moment dat de
  rules-tests voor het eerst draaiden
- **`src/data/betrokkenen-standaard.ts`**: 38 standaardpartijen met afspraken, ankers,
  offsets en de zes waarschuwingsteksten uit de standaardlijst
- **`src/lib/planning.ts`** + **`planning.test.ts`**: `berekenDatum`, `bepaalUrgentie`,
  `bouwActielijst`, `laatsteGratisSchuifdatum` — puur, zonder Firestore, 37 tests groen
- **ADR-0009**: zekerheid en herkomst als expliciete velden
- `npm run test` toegevoegd aan `npm run verify`; rules-tests afgesplitst naar
  `vitest.rules.config.ts` zodat `verify` ook zonder Java draait

## Twee conventies die in deze sessie zijn vastgelegd

1. **Aanlooptijd en annuleertermijn staan op de betrokkene, één paar per partij.** Heeft een
   partij meerdere afspraken met verschillende termijnen (keuken: inmeten 14 dagen, levering
   70), dan staat de langste in de bibliotheek. Gevolg: het inmeten wordt eerder als urgent
   gemarkeerd dan strikt nodig. Bewuste ruil — te vroeg waarschuwen kost aandacht, te laat
   kost een afspraak.
2. **Bij een range in de standaardlijst wordt de bovenkant genomen.** "56–70 dagen" wordt 70.

## Direct volgende stap

**De UI voor de betrokkenen- en schuif-impactmodule.** In deze volgorde:

1. **Datalaag** (`src/lib/projecten.ts` of vergelijkbaar) — CRUD op projecten, ankers,
   betrokkenen en afspraken via Firestore-converters die `Timestamp` ⇄ `Date` omzetten.
   `planning.ts` blijft SDK-vrij; de conversie hoort in deze laag.
   **Let op:** hier hoort ook de regel dat `waardenBron` naar `"eigen"` gaat zodra een
   gebruiker een termijn aanpast — vergeet je dat in de opslaglaag, dan blijft de
   disclaimer hangen op cijfers die hij zelf heeft ingevoerd.
2. **Project aanmaken** met de opleverband en de staat (indicatief / bandbreedte /
   aangezegd)
3. **Betrokkenen aanvinken** uit de standaardbibliotheek, per categorie, met de
   voorstelwaarden zichtbaar en aanpasbaar
4. **Actielijst** op het dashboard: `bouwActielijst()` renderen, gesorteerd op urgentie,
   met per regel de reden, de zekerheid van de berekening en een "doorgegeven"-knop
5. **Anker verschuiven** → de lijst herberekent, met een diff ten opzichte van de vorige
   versie

Punt 4 is waar de feature zich bewijst. Bouw hem vroeg, ook lelijk.

## Open vragen / wacht op Seth

- **Aanlooptijden valideren.** De 38 startwaarden zijn schattingen. Heeft Seth concrete
  cijfers van keuken, vloer, waterontharder of busverhuur, dan vervangen die de gok.
  Besloten in sessie 03: de waarden blijven hoe dan ook invulbaar, met een voorstel als
  vertrekpunt.
- **Netlify koppelen aan de repo** + de vier `VITE_FIREBASE_*` env vars + het
  Netlify-domein toevoegen aan Firebase Authorized domains.
- **CSP-melding verifiëren op de deploy preview** (`blocks the use of 'eval'`).
- **Overweging:** een `verify:rules`-script naar het model van `verify:tokens`, dat
  controleert of de enum-waarden in `firestore.rules` gelijk lopen met `model.ts`. De acht
  ankertypes staan nu op drie plekken (model, rules, standaardlijst) en kunnen stil uit
  elkaar lopen.

## Bekende valkuilen

- **In Firestore-rules is het `request.resource.data.size()`, niet
  `request.resource.size()`.** Zonder `.data` tel je de eigenschappen van het
  Resource-object en weigert de check nooit iets. Het compileert, alle overige tests
  blijven groen, en je merkt het pas als je er expliciet op test. Ditzelfde geldt voor
  `resource.data` bij updates.
- **Rules die niet gedraaid zijn, zijn rules waarvan je hoopt dat ze werken.** Dat stond al
  als comment boven `rules.test.ts` en bleek in sessie 03 letterlijk waar.
- **Sla nooit een afspraakdatum op.** Alleen `ankerType` + `offsetDagen`. Enige
  uitzondering is `gecommuniceerdeDatum`, en dat is een feit over de buitenwereld, geen
  planning.
- **`planning.ts` blijft puur.** Geen Firestore, geen React, en geen `new Date()` die niet
  als parameter binnenkomt — anders zijn de tests niet meer betrouwbaar.
- **Reken in UTC, niet in lokale tijd.** Zomertijd maakt dagen 23 of 25 uur lang; bij een
  offset van 42 dagen kom je eind oktober een dag naast de waarheid uit. `opDag()` in
  `planning.ts` vangt dit af, en er staat een test op.
- **De productie-CSP mag niet in dev gelden.** Opgelost met `stripCspInDev` in
  `vite.config.ts`. Test CSP-wijzigingen op een deploy preview, niet lokaal.
- **HTTP-headers in `netlify.toml` mogen geen newlines bevatten.** `npm run verify:headers`
  vangt dit af.
- **`npm audit fix --force` niet gebruiken.** Downgradet `@netlify/vite-plugin` elf minor
  versies. Meldingen zijn opgelost met `overrides` (ADR-0007).
- **Nooit terugverhuizen naar Google Drive.** `node_modules` is 606 MB / 33.966 bestanden;
  Drive houdt file handles open en veroorzaakt `EPERM`/`EBUSY`.
- **Vite 8 draait op Rolldown.** `manualChunks` moet een _functie_ zijn.
- **Importeer uit `react-router`, niet `react-router-dom`.**
- **Firestore-emulator vereist JDK 21+**, en **single-field indexes horen niet in
  `firestore.indexes.json`**.
