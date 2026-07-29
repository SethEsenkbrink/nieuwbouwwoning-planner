# Nieuwbouwplanner

Webapplicatie die kopers van een **nieuwbouwwoning (gekocht van tekening)** door het complete
traject loodst — van koop-/aannemingsovereenkomst tot en met de garantietermijn — met
deadlines, meerwerk-bewaking, bouwdepot-overzicht en een opleverchecklist.

**Documenten worden wél ingelezen, maar nooit opgeslagen.** De PDF blijft in het geheugen van
je browser; alleen de door jou bevestigde gegevens gaan naar de database.

---

## Snel starten

```bash
npm install
cp .env.example .env.local     # en invullen
npm run dev                    # http://localhost:5173
```

Eerste keer? Volg `docs/2026-07-29-setup-checklist.md` — daar staat ook hoe je het
Firebase-project aanmaakt.

## Commando's

| Commando | Doet |
|---|---|
| `npm run dev` | Vite-devserver + Netlify Functions lokaal |
| `npm run build` | Productiebuild naar `dist/` |
| `npm run typecheck` | TypeScript zonder output |
| `npm run lint` | ESLint, inclusief type-aware regels |
| `npm run verify:tokens` | Controleert of de huisstijl-CSS gelijk loopt met `brink-ui/tokens.js` |
| `npm run verify` | Alles hierboven + build. **Draai dit vóór elke commit.** |
| `npm run rules:test` | Firestore-rules tegen de emulator |

## Stack

React 19 · Vite 8 · TypeScript 6 · Tailwind v4 (CSS-first) · Firebase Auth + Firestore
(Spark) · Netlify Functions. Zie `docs/PROJECT.md` §8 voor de volledige tabel en
`docs/decisions/` voor het waarom van elke keuze.

## Structuur

```
Nieuwbouwplanner/
├─ AGENTS.md              ← lees dit eerst bij een nieuwe sessie
├─ docs/                  ← projectkennis die tussen sessies overleeft
│  ├─ PROJECT.md          scope, constraints, datamodel  (vaste waarheid)
│  ├─ STATE.md            waar staan we nu               (elke sessie bijwerken)
│  ├─ CONTEXT.md          startprompt voor een nieuwe chat
│  ├─ WORKFLOW.md         spelregels
│  ├─ decisions/          ADR's — waarom is het zoals het is
│  └─ sessions/           sessielogs
├─ firebase/              security rules + indexes
├─ brink-ui/              kopie van het huisstijlfundament — niet handmatig wijzigen
├─ netlify/functions/     serverside logica (stateless)
├─ public/                logo, iconen, manifest
├─ scripts/               verify-tokens.mjs
└─ src/
   ├─ lib/                firebase.ts, authFouten.ts
   ├─ context/            AuthContext + useAuth
   ├─ components/         herbruikbare UI
   ├─ routes/             pagina's
   ├─ types/              model.ts is het canonieke datamodel
   └─ styles/             brink-theme.css (huisstijl in Tailwind v4)
```

## Werken aan dit project met AI-assistentie

Dit project is opgezet om over veel losse chatsessies gebouwd te worden. Begin een nieuwe
sessie door de startprompt uit `docs/CONTEXT.md` te plakken; die dwingt af dat de juiste
bestanden in de juiste volgorde gelezen worden. Sluit een sessie nooit af zonder
`docs/STATE.md` bij te werken.

## Drie dingen die niet mogen

1. **Firebase Storage of Cloud Functions gebruiken.** Storage breekt de privacybelofte,
   Cloud Functions vereisen het betaalde Blaze-plan. Serverside logica hoort in
   `netlify/functions/`. Zie ADR-0005.
2. **Importeren uit `react-router-dom`.** Dat pakket is EOL; gebruik `react-router`.
3. **Losse hex-kleuren in componenten.** Alles via de huisstijl-classes. Zie `../AGENTS.md`.

## Disclaimer

Deze tool structureert en herinnert. Het is geen juridisch of financieel advies; termijnen
zijn indicatief en je eigen contract blijft leidend.
