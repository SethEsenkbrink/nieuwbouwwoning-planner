# ADR-0006 — Bewust uitgestelde keuzes (React Compiler, App Check, PWA, testlaag)

**Status:** Geaccepteerd
**Datum:** 2026-07-29

## Context

Bij het opzetten van een fundament is de verleiding groot om alles wat "goed" is meteen aan
te zetten. Elke extra laag maakt het echter moeilijker om te zien waaróm iets niet werkt,
juist in de fase waarin het meeste kapotgaat.

Tegelijk moet vastliggen dát we deze dingen bewust hebben overwogen — anders komt een
volgende sessie ze "even" alsnog invoeren zonder afweging, of blijven ze voor altijd liggen.

## Beslissing

De volgende vier zaken worden **nu niet** ingevoerd, met per stuk een concreet
trigger-moment.

### 1. React Compiler (`babel-plugin-react-compiler` v1)

**Wat het is:** een build-time Babel-plugin die memoization automatisch injecteert, zodat
`useMemo`/`useCallback` overbodig worden.

**Waarom nu niet:** dit is een formulier- en lijstjes-app; er is geen renderdruk die dit
rechtvaardigt. En bij het debuggen van een vers fundament wil je zo min mogelijk lagen tussen
"wat ik schreef" en "wat er draait". De compiler slaat bovendien componenten stilzwijgend
over die de Rules of React schenden, wat verwarrend is als je nog niet weet of je code klopt.

**Trigger om alsnog aan te zetten:** de fase-tijdlijn of het dashboard voelt merkbaar traag
bij realistische hoeveelheden data (± 100 taken / 50 meerwerkitems), en profiling wijst
re-renders aan als oorzaak.

**Hoe:**

```bash
npm i -D babel-plugin-react-compiler @rolldown/plugin-babel
```

```ts
// vite.config.ts
react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } })
```

Draai daarna `eslint-plugin-react-hooks` in strict mode om Rules-of-React-schendingen te
vinden die de compiler zou overslaan.

### 2. Firebase App Check (reCAPTCHA v3)

**Wat het is:** verifieert dat requests naar Firestore van jóuw app komen, niet van een
script dat de publieke web-config uit de bundle heeft geplukt.

**Waarom nu niet:** de Firestore-rules zijn de echte beveiligingslaag en die staan er wel
vanaf dag 1. App Check beschermt vooral tegen quota-misbruik en geautomatiseerde
account-aanmaak — beide pas relevant zodra de app publiek bereikbaar is. In development
vereist het een debug-token dat de setup nodeloos ingewikkeld maakt.

**Trigger:** vóór de eerste publieke launch, of zodra er ongewone leesvolumes in de
Firebase-console verschijnen.

**Hoe:** `initializeAppCheck` toevoegen in `src/lib/firebase.ts`; er staat een gemarkeerde
plek klaar in dat bestand.

### 3. PWA / offline-modus (`vite-plugin-pwa`)

**Waarom nu niet:** een service worker die de verkeerde build cachet is een klassieke bron van
"waarom zie ik mijn wijziging niet". Dat wil je niet terwijl je het fundament nog omgooit.
Offline-schrijven naar Firestore vraagt bovendien een conflictstrategie die we nog niet
hebben doordacht.

**Trigger:** zodra de app op de bouwplaats gebruikt gaat worden (slecht bereik) of er een
concrete wens is om hem op het beginscherm te zetten.

**Let op:** Firestore heeft eigen offline-persistence; die is los van een PWA in te schakelen
en is waarschijnlijk de eerste stap, niet de service worker.

### 4. Uitgebreide testlaag

**Waarom nu niet:** Vitest 4 staat geconfigureerd en `npm run verify` draait typecheck + lint
+ build. Voor een fundament zonder businesslogica is dat de juiste dekking; unit tests op
componenten die volgende week weer wijzigen zijn weggegooid werk.

**Trigger:** bij de eerste echte businesslogica — concreet de meerwerk-deadlineberekening en
de bouwdepot-statuslogica. Die krijgen tests vóórdat ze af zijn, niet erna.

**Wél al aanwezig:** `npm run verify:tokens`, de pariteitstest tussen `tokens.js` en
`brink-theme.css` (zie ADR-0002).

## Gevolgen

**Positief:** het fundament blijft leesbaar en debugbaar. Elke uitgestelde keuze heeft een
concreet moment waarop hij terugkomt, dus niets verdwijnt stilletjes.

**Negatief:** vier stukjes werk staan open. Bij App Check betekent dat een reëel — zij het
klein — venster van quota-misbruik zodra de app publiek staat. Zet die dus echt vóór de
launch aan.

**Terugdraaien:** n.v.t. — dit is een uitstel, geen richtingkeuze. Wordt er één ingevoerd,
dan komt daar een eigen ADR voor.
