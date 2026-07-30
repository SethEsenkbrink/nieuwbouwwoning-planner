# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-07-30 · sessie 04
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).
> Geen geschiedenis hier — die staat in `sessions/`. Houd dit onder één scherm.

---

## Waar staan we

**De app werkt end-to-end.** De wizard is in de browser doorlopen tegen de
Firestore-emulator: project aangemaakt, opleverdatum als band ingevuld, en **17 partijen met
19 afspraken** in één batch weggeschreven. Het dashboard toont de opleverband met zijn staat
en bron; `/betrokkenen` toont alle partijen met het label _voorstel — controleer bij je
leverancier_.

Alle writes kwamen zonder aanpassing langs de security-rules. `npm run verify` is groen:
typecheck, lint, **60 unit tests**, tokenpariteit, headers en build. De 53 rules-tests zijn
apart groen en de rules staan live.

Wat er nog niet is: **de actielijst**. `bouwActielijst()` is af en getest, maar er is nog
geen scherm dat hem toont. Dat is de volgende stap, en het punt waar de feature zich moet
bewijzen.

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

### Sessie 04 — de laag ertussen en de eerste schermen

- **`src/lib/converters.ts`**: de enige plek waar `Timestamp` en `Date` elkaar raken.
  Leest defensief: onbekende enum-waarden worden `undefined` in plaats van doorgegeven
- **`src/lib/betrokkenen.ts`**: `bepaalWaardenBron`, puur en met tests. Staat bewust níét in
  `projecten.ts`, want dat bestand laadt de Firebase-SDK en is daardoor niet testbaar
- **`src/lib/projecten.ts`**: alle Firestore-toegang. Componenten praten hier tegenaan en
  nooit rechtstreeks met de SDK
- **Wizard** op `/project/nieuw`: projectgegevens → opleverdatum → betrokkenen aanvinken.
  Hervatbaar: het project wordt na stap 1 aangemaakt en de wizard springt bij het openen
  naar de eerste onafgeronde stap
- **`/betrokkenen`**: overzicht per categorie, termijnen aanpasbaar, met het
  voorstel-label zolang `waardenBron` op `"voorstel"` staat
- **Dashboard**: opleverband met staat en bron, aantal partijen en afspraken
- Nieuwe componenten: `Keuzeveld`, `Datumveld`, `Stapindicator`; navigatie in `AppShell`
- **`src/lib/datum.ts`**: `toonDatum`, `alsInvoerwaarde`, `uitInvoerwaarde` — alles in UTC,
  op één plek. Stond eerst in `Datumveld.tsx`, maar een bestand dat naast componenten ook
  functies exporteert breekt Fast Refresh
- **De hele keten is in de browser getest** tegen de emulator: 17 partijen, 19 afspraken,
  alle writes langs de rules zonder aanpassing

## Twee conventies die in deze sessie zijn vastgelegd

1. **Aanlooptijd en annuleertermijn staan op de betrokkene, één paar per partij.** Heeft een
   partij meerdere afspraken met verschillende termijnen (keuken: inmeten 14 dagen, levering
   70), dan staat de langste in de bibliotheek. Gevolg: het inmeten wordt eerder als urgent
   gemarkeerd dan strikt nodig. Bewuste ruil — te vroeg waarschuwen kost aandacht, te laat
   kost een afspraak.
2. **Bij een range in de standaardlijst wordt de bovenkant genomen.** "56–70 dagen" wordt 70.

## Direct volgende stap

**Ankers, dan de actielijst.** In deze volgorde, want zonder ankers is de actielijst overal
"teruggevallen" en dus niet overtuigend.

1. **Ankerscherm** (`/ankers` of op het dashboard). De acht bouwmomenten uit `AnkerType`, elk
   met een datum en een status (verwacht / bevestigd / gepasseerd) en een bronveld.
   `haalAnkers`, `voegAnkerToe` en `werkAnkerBij` staan al klaar in `projecten.ts`; er is
   alleen nog geen UI. Niet elk anker hoeft ingevuld — een leeg anker telt gewoon niet mee.
2. **Actielijst op het dashboard**: `bouwActielijst()` renderen, gesorteerd op urgentie, met
   per regel de reden, de zekerheid van de berekening (bij `teruggevallen` expliciet melden
   wélk anker ontbreekt) en een **"doorgegeven"-knop**. Die knop is essentieel: zonder dat de
   gebruiker hem indrukt lopen berekend en gecommuniceerd niet gelijk en wordt de lijst ruis
   (ADR-0008). Hij schrijft `gecommuniceerdeDatum` + `gecommuniceerdOp` via
   `werkAfspraakBij`.
3. **Anker verschuiven** → de lijst herberekent, met een diff ten opzichte van de vorige
   versie.

Punt 2 is waar de feature zich bewijst. Bouw hem vroeg, ook lelijk.

**Praktisch bij het starten:** `.env.local` staat nu op `VITE_USE_FIREBASE_EMULATOR=true`.
Laat dat staan zolang je bouwt — de emulator geeft bruikbare foutmeldingen en je vervuilt je
productiedata niet. Terugzetten op `false` als je tegen het echte project wilt werken.
Emulator starten: `firebase emulators:start --only firestore,auth` in een tweede terminal.

## Open vragen / wacht op Seth

- **Aanlooptijden valideren.** De 38 startwaarden zijn schattingen. Heeft Seth concrete
  cijfers van keuken, vloer, waterontharder of busverhuur, dan vervangen die de gok. Kan nu
  rechtstreeks in de app op `/betrokkenen`; het voorstel-label verdwijnt vanzelf.
- **Welke ankerpunten kent zijn project?** Bij het testen bleek de opleverdatum voorlopig het
  enige bekende moment. Weet hij inmiddels wanneer de dekvloer wordt gestort of de ruwbouw
  gereed is, dan wordt de actielijst meteen een stuk scherper.
- **Netlify koppelen aan de repo** + de vier `VITE_FIREBASE_*` env vars + het
  Netlify-domein toevoegen aan Firebase Authorized domains.
- **CSP-melding verifiëren op de deploy preview** (`blocks the use of 'eval'`).
- **Overweging:** een `verify:rules`-script naar het model van `verify:tokens`, dat
  controleert of de enum-waarden in `firestore.rules` gelijk lopen met `model.ts`. De acht
  ankertypes staan nu op drie plekken (model, rules, standaardlijst) en kunnen stil uit
  elkaar lopen.

## Bekende valkuilen

- **Java staat niet vanzelf op de PATH na `winget install`.** De emulator vindt hem dan niet,
  ook al draaide hij eerder wél. `JAVA_HOME` en `...\bin` staan nu als user-variabele op
  `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`. Na een wijziging aan de PATH
  moet de IDE opnieuw starten — een nieuw terminal-tabje erft de oude omgeving.
- **Zet geen state synchroon in een effect-body.** ESLint blokkeert het (`set-state-in-effect`)
  en het veroorzaakt een extra renderronde. Patroon: effect met een async IIFE die begint met
  een `await`, en herladen via een teller in de dependency-array.
- **Een bestand dat naast componenten ook functies exporteert breekt Fast Refresh.**
  Hulpfuncties horen in `src/lib/`, niet naast een component.
- **Wijzigen gaat via `updateDoc`, nooit via `setDoc` zonder merge.** De rules eisen dat
  `aangemaaktOp` onveranderd blijft; een volledige overschrijving wist dat veld en wordt
  geweigerd — met een foutmelding die niets over de oorzaak zegt.
- **`aangemaaktOp` moet `serverTimestamp()` zijn bij het aanmaken.** De rules controleren
  `== request.time`; een clientklok die een seconde afwijkt is al genoeg om te falen.
- **Reken datums uit `<input type="date">` als UTC.** De string "2026-11-16" door
  `new Date()` halen geeft UTC-middernacht, precies wat `planning.ts` verwacht. Lokale tijd
  schuift in de zomer een dag op.
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
