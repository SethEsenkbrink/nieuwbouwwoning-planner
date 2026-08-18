# Setup-checklist — Nieuwbouwplanner

Eenmalig, in deze volgorde. Reken op ± 30 minuten.

---

## 1. Lokaal draaien

```bash
cd "09 - Brink Multimedia/Nieuwbouwplanner"
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
```

`npm run dev` werkt pas nadat stap 2 klaar is en `.env.local` gevuld is — de app
faalt bewust hard bij ontbrekende Firebase-config, met een melding die vertelt
wat er mist.

> **Node-versie:** dit project vereist Node 24. Check met `node -v`. Heb je nvm,
> dan pakt `nvm use` de versie uit `.nvmrc`.

> **Locatie:** `C:\dev\projecten\Brink Multimedia - main folder\Nieuwbouwplanner`.
> Bewust buiten Google Drive — zie stap 5.

---

## 2. Firebase-project aanmaken

1. Ga naar <https://console.firebase.google.com> → **Project toevoegen**.
2. Naam: `nieuwbouwplanner` (of eigen keuze). **Google Analytics: uit** — niet
   nodig en scheelt een consent-vraagstuk.
3. Wacht tot het project klaar is.

### 2a. Web-app registreren

1. Projectoverzicht → **`</>`** (web) → app-naam `nieuwbouwplanner-web`.
2. **Firebase Hosting NIET aanvinken** — wij hosten op Netlify.
3. Kopieer de `firebaseConfig`-waarden naar `.env.local`:

   | Firebase-veld | .env.local |
   |---|---|
   | `apiKey` | `VITE_FIREBASE_API_KEY` |
   | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId` | `VITE_FIREBASE_PROJECT_ID` |
   | `appId` | `VITE_FIREBASE_APP_ID` |

   `storageBucket` bewust overslaan — Firebase Storage wordt niet gebruikt
   (ADR-0005).

### 2b. Authentication aanzetten

1. **Build → Authentication → Get started**
2. Tabblad **Sign-in method** → **E-mail/wachtwoord** → inschakelen.
   *E-maillink (passwordless) laten staan op uit.*
3. Tabblad **Settings → Authorized domains**: `localhost` staat er al. Voeg na
   de eerste Netlify-deploy je Netlify-domein toe, anders werkt inloggen daar niet.

### 2c. Firestore aanmaken

1. **Build → Firestore Database → Create database**
2. Locatie: **`eur3 (europe-west)`** of `europe-west4`. Dit is **definitief** —
   je kunt de regio later niet wijzigen.
3. Start in **production mode** (alles dicht). Onze eigen rules komen in stap 4.

### 2d. Controle: Blaze-plan niet nodig

Blijf op het **Spark**-plan. Word je gevraagd te upgraden, dan probeer je iets
te gebruiken dat in dit project niet hoort (Cloud Functions of Storage) — zie
ADR-0005.

---

## 3. Firebase CLI koppelen

```bash
npm i -g firebase-tools
firebase login
firebase use --add          # kies je project, alias: default
```

Dit maakt `.firebaserc`. Dat bestand staat in `.gitignore` omdat het je
project-id bevat en per ontwikkelaar kan verschillen.

---

## 4. Security rules deployen — niet overslaan

De rules zijn de **enige** laag tussen jouw data en die van iemand anders.
Firestore staat na stap 2c dicht, maar dan werkt de app ook niet.

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Controleer daarna in de console (Firestore → Rules) dat de regels er staan en
dat de datum klopt.

### Rules testen — doe dit vóór de eerste echte data

Er staat een testsuite klaar in `firebase/rules.test.ts` die controleert dat
gebruikers echt niet bij elkaars data kunnen, en dat de veldvalidatie werkt.

```bash
npm run rules:test
```

> **Vereist JDK 21 of hoger.** De Firestore-emulator draait op Java en
> firebase-tools weigert oudere versies. Check met `java -version`; installeer
> anders bijvoorbeeld Temurin 21.
>
> Deze testsuite is nog niet uitgevoerd — in de bouwomgeving kon de emulator niet
> starten (geen toegang tot de download van de emulator-JAR). **Dit is de eerste
> taak van de volgende sessie.** Zolang dat niet gebeurd is, zijn de rules wel
> geschreven en handmatig nagelopen, maar niet bewezen.

Handmatig tegen de emulator werken:

```bash
firebase emulators:start --only firestore,auth
# tweede terminal, met VITE_USE_FIREBASE_EMULATOR=true in .env.local:
npm run dev
```

---

## 5. Git — ✅ klaar

Eerste commit `64e3208` staat en is gepusht naar
`SethEsenkbrink/nieuwbouwwoning-planner`. Branch `main` volgt `origin/main`.

Het project is verhuisd uit Google Drive naar
`C:\dev\projecten\Brink Multimedia - main folder\`. **Verhuis het daar niet vandaan
terug naar Drive:** `node_modules` is 606 MB verdeeld over bijna 34.000 bestanden, en
Drive houdt file handles open waardoor `npm install` en `git` willekeurige
`EPERM`/`EBUSY`-fouten geven. GitHub is je backup, niet Drive.

Vanaf nu is de normale flow:

```powershell
git add -A
git status --short | Select-String "env"     # mag ALLEEN .env.example tonen
git commit -m "Korte beschrijving"
git push
```

---

## 6. Netlify

De site is al aangemaakt:

| | |
|---|---|
| Project | `nieuwbouwplanner` |
| Team | `izaak-esenkbrink` |
| Site-ID | `04f692cf-ce81-4cb6-8c9d-cf0c9ffefb66` |
| URL | <https://nieuwbouwplanner.netlify.app> |
| Dashboard | <https://app.netlify.com/projects/nieuwbouwplanner> |

Wat jij nog doet:

1. **Site configuration → Build & deploy → Link repository** → koppel
   `SethEsenkbrink/nieuwbouwwoning-planner`, branch `main`.
   **Base directory leeg laten** — de repo-root ís de projectmap.
2. Controleer de build-instellingen. Die komen uit `netlify.toml` en overrulen de UI,
   dus normaal hoef je niets te wijzigen:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
   - Node: 24
3. **Environment variables** → voeg de vier `VITE_FIREBASE_*`-waarden toe (dezelfde als
   in `.env.local`). Deze zijn bewust nog niet aangemaakt: met een placeholder erin zou
   de build slagen maar de app pas in de browser stukgaan, met een veel vagere fout.
   Nu faalt de build meteen met een duidelijke melding.
4. Na de eerste deploy: `nieuwbouwplanner.netlify.app` toevoegen aan **Firebase →
   Authentication → Settings → Authorized domains** (stap 2b). Zonder dit werkt
   inloggen op de live site niet.

---

## 7. Eindcontrole

```bash
npm run verify      # typecheck + lint + tokenpariteit + build
```

Daarna handmatig, op de deploy preview:

- [ ] Account aanmaken lukt
- [ ] Uitloggen en weer inloggen lukt
- [ ] Pagina verversen houdt je ingelogd (geen flits naar het inlogscherm)
- [ ] `/api/health` geeft `{"status":"ok",…}`
- [ ] Browserconsole is leeg — met name geen CSP-violations
- [ ] Een niet-bestaande URL toont de 404-pagina, geen serverfout

---

## Veelvoorkomende problemen

| Symptoom | Oorzaak |
|---|---|
| "Firebase-configuratie onvolledig" | `.env.local` ontbreekt of is niet gevuld. Op Netlify: env vars niet gezet. |
| `auth/operation-not-allowed` | E-mail/wachtwoord staat uit in Firebase (stap 2b). |
| `auth/unauthorized-domain` | Netlify-domein staat niet bij Authorized domains (stap 2b). |
| `Missing or insufficient permissions` | Rules niet gedeployed (stap 4). |
| CSP-fout in de console | Nieuw extern domein toegevoegd zonder het in `netlify.toml` toe te staan. |
| Wijziging in `.env.local` doet niets | Vite leest env alleen bij het starten — herstart `npm run dev`. |
