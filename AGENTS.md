# AGENTS.md — Nieuwbouwplanner

**Lees dit als eerste. Ga niet bouwen voordat je de leesvolgorde hieronder hebt gevolgd.**

Dit project wordt over veel losse chatsessies gebouwd. Alle kennis die anders in een
gespreksgeschiedenis zou zitten, staat in `docs/`. Sla die niet over — je mist dan de
constraints die het project bij elkaar houden.

## Leesvolgorde (verplicht)

1. **`docs/PROJECT.md`** — scope, harde constraints, datamodel, stack
2. **`docs/STATE.md`** — waar we nu staan en wat de direct volgende stap is
3. **`docs/WORKFLOW.md`** — spelregels, inclusief je bijwerkplicht aan het eind
4. **`docs/decisions/`** — de ADR's die raken aan waar je mee bezig gaat
5. **`docs/sessions/`** — het laatste sessielog
6. **`../AGENTS.md`** — de onwrikbare huisstijlregels van de werkruimte

**Ga je zelf commando's uitvoeren? Lees dan eerst `CLAUDE.md` in deze map.** Daar staat welke
commando's in een AI-sandbox wél werken en welke alleen op de machine van Seth — plus waarom
`tsc --noEmit` in dit project niets controleert.

`docs/CONTEXT.md` bevat een startprompt die dit in één keer afdwingt in een nieuwe chat.

## De vijf dingen die het vaakst misgaan

1. **Firebase Storage of Cloud Functions toevoegen.** Beide zijn verboden (ADR-0005).
   Storage breekt de privacybelofte, Cloud Functions vereisen het betaalde Blaze-plan.
   Alle serverside logica hoort in `netlify/functions/`.
2. **Importeren uit `react-router-dom`.** Dat pakket is EOL. Importeer uit `react-router`
   (ADR-0004). De meeste voorbeelden op internet zijn op dit punt verouderd.
3. **Tailwind v3-syntax gebruiken.** Dit project draait Tailwind v4 CSS-first (ADR-0002).
   Er is géén `tailwind.config.js`; de tokens staan in `src/styles/brink-theme.css`.
4. **Losse hex-kleuren in componenten.** Alles via de huisstijl-classes (`bg-clay`,
   `text-ink`, `rounded-card`, `shadow-e2`). Zie `../AGENTS.md`.
5. **De sessie afsluiten zonder `docs/STATE.md` bij te werken.** Dan kan de volgende chat
   niet overnemen. Dit is de enige regel die nooit mag sneuvelen.

## Werken in `brink-ui/`

`brink-ui/` in deze map is een **kopie** van het fundament. Wijzig hem nooit rechtstreeks —
hij wordt overschreven zodra iemand `node sync-huisstijl.mjs` draait vanuit de werkruimte-root.
Wil je de huisstijl aanpassen, doe dat in `../Huisstijl/brink-ui/` en sync daarna.

Let op: `src/styles/brink-theme.css` is de v4-vertaling van `../Huisstijl/brink-ui/tokens.js`.
Wijzigt het fundament, draai dan `npm run verify:tokens` — die faalt zodra de twee uit elkaar
lopen.

## Commando's

```bash
npm install          # binnen deze map
npm run dev          # Vite + Netlify Functions lokaal
npm run build        # productiebuild naar dist/
npm run verify       # typecheck + lint + tokenpariteit + build — vóór elke commit
```

## Geheimen

Alles met `VITE_`-prefix belandt in de browserbundle. De Firebase web-config hoort daar thuis
(publiek by design, beveiliging zit in de Firestore-rules). Een LLM- of mailkey hoort daar
nooit — die gaan in Netlify environment variables zónder prefix en worden alleen in
`netlify/functions/` gelezen via `Netlify.env.get()`.
