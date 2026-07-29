# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-07-29 · sessie 02
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).
> Geen geschiedenis hier — die staat in `sessions/`. Houd dit onder één scherm.

---

## Waar staan we

Het **fundament staat, is geverifieerd en draait echt**. Firebase is ingericht, de
security-rules staan live, en de app toont het inlogscherm in de huisstijl op
`localhost:5173`. `npm run verify` (typecheck, lint, tokenpariteit, headers, build) is
groen.

Er is nog **geen functionaliteit**: geen projecten, geen betrokkenen, geen tijdlijn.
Dat is opzet — eerst een fundament dat klopt.

**De productrichting is in sessie 02 scherper geworden.** De eerste echte feature is niet
de fase-tijdlijn maar de **betrokkenen- en schuif-impactmodule**: het probleem dat een
indicatieve opleverdatum voortdurend schuift en dat elke verschuiving handmatig moet worden
doorvertaald naar alle ingehuurde partijen. Volledig uitgewerkt in **ADR-0008**.

## Klaar

- Docs- en continuïteitssysteem (`PROJECT.md`, `WORKFLOW.md`, `CONTEXT.md`, 8 ADR's)
- Configs: Vite 8, TypeScript 6 (strict), ESLint 10 flat met type-aware regels, Prettier
- Security: Firestore-rules met default-deny en veldvalidatie, CSP + security headers,
  `.gitignore` die `.env*` blokkeert
- Huisstijl in Tailwind v4 CSS-first, met pariteitstest tegen `tokens.js` (50 tokens)
- Eigen logo: gevel-mark met satelliet + vinkje, 6 SVG-varianten met outlined wordmark
- Auth-flow: registreren, inloggen, uitloggen, wachtwoord-reset, `ProtectedRoute`
- `netlify/functions/health.mts` op `/api/health`
- Opstartfout-scherm bij ontbrekende config, in plaats van een witte pagina
- Twee eigen checks in `npm run verify`: `verify:tokens` en `verify:headers`
- **Firebase live**: project `nieuwbouwplanner`, Firestore in production mode,
  rules + indexes gedeployed, `.env.local` gevuld
- **App draait**: inlogscherm zichtbaar en correct opgemaakt
- Git: gepusht naar `SethEsenkbrink/nieuwbouwwoning-planner`, `main` volgt `origin/main`
- Netlify-project `nieuwbouwplanner` aangemaakt
  (`04f692cf-ce81-4cb6-8c9d-cf0c9ffefb66`, <https://nieuwbouwplanner.netlify.app>)
- Verhuisd uit Google Drive naar `C:\dev\projecten\Brink Multimedia - main folder\`

## Direct volgende stap

**Bouwen: het datamodel voor betrokkenen en schuif-impact (ADR-0008).**

Concreet, in deze volgorde:

1. **`src/types/model.ts` uitbreiden** — `Anker`, `Betrokkene`, `Afspraak`, plus de
   opleverdatum-band en `opleverStatus` op `Project`. Zie `PROJECT.md` §5 voor het schema.
2. **`firebase/firestore.rules` uitbreiden** met de drie nieuwe subcollecties, met dezelfde
   striktheid als de bestaande (types, toegestane waarden, lengtes, size limit).
3. **`firebase/rules.test.ts` uitbreiden** met tests voor die collecties.
4. **`src/data/betrokkenen-standaard.ts`** — de standaardbibliotheek uit
   `docs/2026-07-29-betrokkenen-standaardlijst.md` als typed data.
5. **`src/lib/planning.ts`** — de pure rekenfuncties, zonder Firestore:
   `berekenDatum(anker, offset)`, `bepaalUrgentie(afspraak, betrokkene, vandaag)`,
   `bouwActielijst(project, ankers, betrokkenen, afspraken)`.
   **Deze krijgen unit tests vóórdat er UI omheen komt** — dit is de eerste echte
   businesslogica, en de trigger uit ADR-0006 om te gaan testen.

Pas daarna UI. Het model eerst aan Seth voorleggen vóór de rekenmotor: klopt het model
niet, dan bouw je de rest scheef (zie ADR-0008, "Terugdraaien").

## Open vragen / wacht op Seth

- **Aanlooptijden en annuleertermijnen valideren.** De standaardlijst bevat startwaarden
  die ik heb ingeschat. Heeft Seth concrete cijfers van zijn eigen leveranciers (keuken,
  vloer, waterontharder, busverhuur), dan vervangen die de gok.
- **Welke ankerpunten kent zijn project?** Weet hij wanneer de dekvloer gestort wordt, of
  alleen de opleverdatum? Dat bepaalt of de meerdere-ankers-opzet nu al waarde heeft of
  pas later.
- **Rules-tests draaien** (`npm run rules:test`, 19 tests, vereist JDK 21+). Nog steeds
  nooit uitgevoerd. Doe dit vóórdat de nieuwe collecties erbij komen — dan weet je zeker
  dat een falende test aan het nieuwe werk ligt.
- **Netlify koppelen aan de repo** + de vier `VITE_FIREBASE_*` env vars + het
  Netlify-domein toevoegen aan Firebase Authorized domains.
- **CSP-melding verifiëren op de deploy preview.** In de dev-console stond een
  `blocks the use of 'eval'`-issue. Lokaal geldt de CSP niet meer (`stripCspInDev`), dus
  dat was mogelijk een restant van vóór die fix. Controleer op de eerste deploy preview of
  het daar ook speelt — zo ja, uitzoeken wat `eval` gebruikt vóórdat je de CSP verzwakt.

## Bekende valkuilen

- **Sla nooit een afspraakdatum op.** Alleen `ankerType` + `offsetDagen`; de datum is
  afgeleid. Dit is de kern van ADR-0008 — sla je hem wel op, dan is elke verschuiving een
  migratie en verdwijnt de reden van de app.
- **De productie-CSP mag niet in dev gelden.** `@netlify/vite-plugin` past de headers uit
  `netlify.toml` ook lokaal toe, en onze CSP blokkeert dan Vite's inline React-preamble en
  de HMR-websocket → lege pagina zonder melding. Opgelost met `stripCspInDev` in
  `vite.config.ts`. De plugin-optie `headers: { enabled: false }` staat wél in de types
  maar dóét niets (v2.12.9, geverifieerd met curl). **Test CSP-wijzigingen op een Netlify
  deploy preview, niet lokaal.**
- **HTTP-headers in `netlify.toml` mogen geen newlines bevatten.** Een gewone TOML
  multiline string (`"""..."""`) behoudt die wél; zet een `\` aan elk regeleinde.
  `npm run verify:headers` vangt dit af.
- **`npm audit fix --force` niet gebruiken.** Dat downgradet `@netlify/vite-plugin` van
  2.12.9 naar 2.1.4. Meldingen zijn opgelost met `overrides` (ADR-0007). Nieuwe melding?
  Eerst `npm ls --omit=dev --all | grep <pakket>` om te zien of het productiecode raakt.
- **Nooit terugverhuizen naar Google Drive.** `node_modules` is 606 MB / 33.966 bestanden;
  Drive sync't dat, vreet quota, en houdt file handles open waardoor `npm install` en `git`
  willekeurige `EPERM`/`EBUSY`-fouten geven.
- **Vite 8 draait op Rolldown.** `manualChunks` moet een *functie* zijn; de object-vorm uit
  Vite ≤7 faalt met "manualChunks is not a function".
- **`vite.config.ts` heeft de TypeScript-parser nodig in ESLint.** Anders struikelt ESLint
  over de eerste type-annotatie.
- **Importeer uit `react-router`, niet `react-router-dom`.** ESLint blokkeert het laatste,
  maar internetvoorbeelden staan er vol mee.
- **Firestore-emulator vereist JDK 21+**, en **single-field indexes horen niet in
  `firestore.indexes.json`** — die maakt Firestore automatisch en de deploy weigert ze.
