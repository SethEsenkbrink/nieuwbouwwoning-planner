# ADR-0001 — React + Vite in plaats van Astro

**Status:** Geaccepteerd
**Datum:** 2026-07-29

## Context

`AGENTS.md` in de werkruimte-root schrijft **Astro + React islands + Tailwind** voor als
huisstandaard voor alle Brink-projecten. De projectbrief van de Nieuwbouwplanner specificeert
echter **React + Vite + Tailwind**.

De Nieuwbouwplanner verschilt fundamenteel van de andere apps in de werkruimte
(Brinkmultimedia.nl, Lmrapro.nl, Dronetak, Productlijst): dat zijn content-sites waar
statische generatie en minimale JS de kern van de waarde zijn. De Nieuwbouwplanner is een
**volledig ingelogde applicatie** — er is geen enkele publieke pagina met content die van
SSG of SEO profiteert. De hele app draait achter Firebase Auth, met realtime Firestore-state
en client-side routing.

## Beslissing

De Nieuwbouwplanner wordt gebouwd met **React 19 + Vite 8**, niet met Astro. Dit is een
bewuste, gedocumenteerde afwijking van `AGENTS.md`.

De huisstijl blijft volledig intact: de app draagt een eigen `brink-ui/`-kopie en volgt alle
onwrikbare huisstijlregels uit `AGENTS.md`.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
|---|---|---|---|
| Astro + React islands | Consistent met de rest van de werkruimte | Islands-model werkt tegen je bij gedeelde auth-state over de hele app; elke pagina zou één grote island zijn | Je betaalt de complexiteit van Astro zonder de voordelen te krijgen |
| Astro shell + losse Vite-SPA | Beste SEO voor een latere marketingpagina | Twee builds, twee deploys, twee configs — voor een project dat nog geen marketingpagina heeft | Te vroeg. Kan later alsnog: de landingspagina komt dan als aparte Astro-app |
| **React + Vite** | Past bij een ingelogde SPA; simpelste mentale model; snelste dev-server | Wijkt af van de huisstandaard | Gekozen |

## Gevolgen

**Positief:** één routingmodel, één state-model. Geen hydration-grenzen om over na te denken
bij auth-state. Vite's dev-server is direct bruikbaar met `@netlify/vite-plugin` voor lokale
functions.

**Negatief:** de werkruimte heeft nu twee frontend-stacks. Een ontwikkelaar die van
Brinkmultimedia.nl naar de Nieuwbouwplanner schakelt, moet omdenken. `AGENTS.md` is niet
langer universeel waar — deze ADR is de aantekening daarbij.

**Terugdraaien:** duur zodra er meer dan een handvol routes staat. Het moment om hierop terug
te komen is *nu of nooit*. Komt er ooit een publieke marketingpagina met SEO-belang, dan
bouwen we die als aparte Astro-app naast deze — niet door deze om te bouwen.
