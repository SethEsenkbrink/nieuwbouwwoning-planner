# STATE.md — waar staan we nu

> **Bijgewerkt:** 2026-07-29 · sessie 01
> **Rol van dit bestand:** de levende status. Elke sessie bijwerken (`WORKFLOW.md` §2).
> Geen geschiedenis hier — die staat in `sessions/`. Houd dit onder één scherm.

---

## Waar staan we

Het **fundament staat en is geverifieerd**. Er is een draaiend project met werkende
authenticatie, de huisstijl in Tailwind v4, dichtgetimmerde Firestore-rules, een
serverside health-endpoint, en een git-repo met een eerste commit. `npm run verify`
(typecheck + lint + tokenpariteit + build) is groen.

Er is nog **geen functionaliteit**: geen projecten, geen tijdlijn, geen taken. Dat is
opzet — eerst een fundament dat klopt.

## Klaar

- Docs- en continuïteitssysteem (`PROJECT.md`, `WORKFLOW.md`, `CONTEXT.md`, 6 ADR's)
- Configs: Vite 8, TypeScript 6 (strict), ESLint 10 flat met type-aware regels, Prettier
- Security: Firestore-rules met default-deny en veldvalidatie, CSP + security headers in
  `netlify.toml`, `.gitignore` die `.env*` blokkeert
- Huisstijl geport naar Tailwind v4 CSS-first, met een pariteitstest tegen `tokens.js`
  (50 tokens, groen)
- Eigen logo: gevel-mark met satelliet + vinkje, 6 SVG-varianten met outlined wordmark,
  PNG-exports, favicon en app-iconen
- Auth-flow: registreren, inloggen, uitloggen, wachtwoord-reset, `ProtectedRoute`,
  lege dashboard-shell
- `netlify/functions/health.mts` op `/api/health`
- Git: eerste commit (`64e3208`) gezet en gepusht naar
  `SethEsenkbrink/nieuwbouwwoning-planner`, branch `main` volgt `origin/main`
- Netlify-project `nieuwbouwplanner` aangemaakt
  (`04f692cf-ce81-4cb6-8c9d-cf0c9ffefb66`, <https://nieuwbouwplanner.netlify.app>)
- **Project verhuisd uit Google Drive** naar
  `C:\dev\projecten\Brink Multimedia - main folder\` — de hele werkruimte staat nu lokaal

## Direct volgende stap

**1. Rules-tests draaien.** `firebase/rules.test.ts` bestaat (19 tests: isolatie tussen
gebruikers, veldvalidatie, subcollecties) maar is **nog nooit uitgevoerd** — in de
bouwomgeving kon de Firestore-emulator niet starten (de download van de emulator-JAR is
daar geblokkeerd). De testrunner zelf werkt: hij vindt en laadt alle 19 tests. Draai
lokaal:

```bash
npm run rules:test      # vereist JDK 21+
```

Alles groen? Dan zijn de rules bewezen. Faalt er iets, dan is dat een echte bug in de
rules — repareer die vóórdat er data in staat.

**2. Daarna: project aanmaken en de fase-tijdlijn** (`PROJECT.md` §6, MVP). Concreet:

- `src/lib/projecten.ts` — CRUD tegen `users/{uid}/projects`, met converters die tegen
  `src/types/model.ts` valideren
- Formulier "nieuw project" (naam, bouwnummer, aannemer, garantiewaarborg, koopsom)
- `src/data/fases.ts` — de vaste fases van het nieuwbouwtraject met per fase de
  standaard-actiepunten en valkuilen. **Inhoudelijk het belangrijkste bestand van de
  MVP**; hier zit de domeinkennis.
- Dashboard vullen met het echte project

## Open vragen / wacht op Seth

- **Setup-checklist afwerken** (`docs/2026-07-29-setup-checklist.md`): Firebase-project
  aanmaken, `.env.local` vullen, rules deployen, repo koppelen aan Netlify, env vars
  zetten. Zonder stap 2 en 4 start de app niet. Git (§5) is klaar.
- **`npm install` is nog niet gedraaid** op de nieuwe locatie. `node_modules` ontbreekt,
  dus `npm run dev` en `npm run verify` werken nog niet.
- **Inhoud van de fase-tijdlijn**: welke fases en valkuilen precies? Dit is
  domeinkennis uit het eigen traject. Zonder input wordt het generiek — en dan is het
  net zo waardeloos als de bestaande apps.

## Bekende valkuilen

- **`npm audit fix --force` niet gebruiken.** Dat downgradet `@netlify/vite-plugin` van
  2.12.9 naar 2.1.4. De audit-meldingen zijn opgelost met `overrides` in `package.json`
  (ADR-0007). Komt er een nieuwe melding: eerst checken of het dev- of productiecode is
  met `npm ls --omit=dev --all | grep <pakket>`.
- **Nooit terugverhuizen naar Google Drive.** `node_modules` is 606 MB / 33.966
  bestanden; Drive sync't dat allemaal, vreet quota, en houdt file handles open waardoor
  `npm install` en `git` willekeurige `EPERM`/`EBUSY`-fouten geven. Dit heeft in sessie 01
  al een vastgelopen `.git/index.lock` opgeleverd. Werk lokaal, gebruik GitHub als backup.
- **Vite 8 draait op Rolldown.** `manualChunks` moet een *functie* zijn; de object-vorm
  uit Vite ≤7 faalt met "manualChunks is not a function". Kostte deze sessie een
  build-fout.
- **`vite.config.ts` heeft de TypeScript-parser nodig in ESLint.** Staat het bestand in
  een blok met alleen `js.configs.recommended`, dan struikelt ESLint over de eerste
  type-annotatie.
- **Importeer uit `react-router`, niet `react-router-dom`.** ESLint blokkeert het
  laatste, maar internetvoorbeelden staan er vol mee.
- **Firestore-emulator vereist JDK 21+.** firebase-tools weigert oudere Java-versies met
  een misleidende foutmelding.
