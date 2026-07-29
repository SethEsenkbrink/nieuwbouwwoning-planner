# ADR-0002 — Tailwind v4 CSS-first, huisstijl geport naar `@theme`

**Status:** Geaccepteerd
**Datum:** 2026-07-29

## Context

Op 2026-07-29 is de stabiele Tailwind-versie **4.3.3**. De v3-lijn staat op de `v3-lts`-tag
(3.4.19) en krijgt alleen nog onderhoud.

Het Brink-huisstijlfundament (`Huisstijl/brink-ui/tailwind-preset.js`) is geschreven voor
Tailwind v3: een JS-config die via `presets: [...]` wordt geladen. Alle bestaande apps in de
werkruimte draaien Tailwind 3.4.

Tailwind v4 verplaatst configuratie van JavaScript naar CSS (`@theme`). Legacy JS-configs
kunnen nog geladen worden via de `@config`-directive, maar dat is expliciet een
migratiepad — `corePlugins`, `safelist` en `separator` worden daarin niet meer ondersteund.

De single source of truth voor kleuren en afmetingen is `Huisstijl/brink-ui/tokens.js`. Die
positie mag niet verloren gaan, ongeacht welke Tailwind-versie een app gebruikt.

## Beslissing

De Nieuwbouwplanner gebruikt **Tailwind 4.3.3 met CSS-first configuratie**. In
`src/styles/brink-theme.css` staat een `@theme`-blok dat exact dezelfde tokens definieert als
`tokens.js`. De `@config`-bridge wordt **niet** gebruikt.

`tokens.js` blijft de canonieke bron. Er komt een geautomatiseerde pariteitstest
(`npm run verify:tokens`) die faalt zodra `brink-theme.css` afwijkt van `tokens.js`.

De bestaande Astro-apps blijven ongewijzigd op Tailwind 3.4 met de v3-preset. Het fundament
draagt vanaf nu beide vormen naast elkaar.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
|---|---|---|---|
| Tailwind 3.4.19 (`v3-lts`) | Nul frictie; identiek aan de andere apps | Nieuw project starten op een maintenance-tak die alleen security-fixes krijgt | Je erft de migratie sowieso, alleen later en met meer code |
| Tailwind 4 + `@config`-bridge | Snelst op te zetten; preset ongewijzigd bruikbaar | Compat-pad dat Tailwind op termijn laat vallen; beperkingen op `safelist`/`corePlugins` | Technische schuld vanaf dag 1, voor een besparing van enkele uren |
| **Tailwind 4 CSS-first** | Toekomstvast; `tokens.js` blijft leidend; twee dependencies minder | Eenmalige portering; werkruimte draait tijdelijk twee Tailwind-versies | Gekozen |

## Gevolgen

**Positief:** `postcss` en `autoprefixer` vervallen volledig — `@tailwindcss/vite` regelt de
hele pipeline. Aanzienlijk snellere builds. De Nieuwbouwplanner is meteen het referentie-
project voor de v4-migratie van de rest van de werkruimte.

**Negatief:** de werkruimte draait tijdelijk twee Tailwind-versies. Wie de huisstijl wijzigt,
moet `tokens.js` aanpassen én controleren dat `brink-theme.css` meeloopt. De pariteitstest
vangt dat af, maar alleen als hij ook echt gedraaid wordt (zit in `npm run verify`).

**Terugdraaien:** goedkoop zolang er weinig custom utilities zijn. `brink-theme.css`
vervangen door `@config "../../tailwind.config.js"` en `postcss` + `autoprefixer`
terugzetten is een halve dag werk.

## Uitvoering

De porting is mechanisch: elke waarde in `tokens.js` krijgt een `--color-*`, `--radius-*`,
`--spacing-*`, `--shadow-*` of `--font-*` custom property in het `@theme`-blok. De
Tailwind-classnamen (`bg-clay`, `rounded-card`, `shadow-e2`, …) blijven identiek, zodat
componenten uit `@brink/ui` ongewijzigd blijven werken.
