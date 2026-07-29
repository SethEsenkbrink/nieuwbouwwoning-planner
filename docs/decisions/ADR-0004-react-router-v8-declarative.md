# ADR-0004 — `react-router` v8 in declarative mode

**Status:** Geaccepteerd
**Datum:** 2026-07-29

## Context

Bij het controleren van de versies op 2026-07-29 bleek dat het pakket **`react-router-dom`
is doodgelopen op 7.18.2**, terwijl **`react-router` op 8.3.0** staat. Sinds v7 is
`react-router-dom` samengevoegd in `react-router`; nieuwe projecten horen het laatste te
gebruiken. De projectbrief noemde nog `react-router-dom`.

React Router v8 kent drie modi:

- **declarative** — routes in JSX, `<Link>`, `useNavigate`. Puur client-side.
- **data** — declarative plus loaders/actions.
- **framework** — volwaardig fullstack-framework met server-side loaders, eigen build en
  eigen server.

Framework mode wordt in de documentatie aanbevolen als startpunt voor nieuwe apps, maar gaat
uit van een server die data ophaalt vóór rendering.

## Beslissing

We gebruiken **`react-router` 8.3.0 in declarative mode**. Niet `react-router-dom`, niet
framework mode.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
|---|---|---|---|
| `react-router-dom` 7.18.2 | Bekende naam uit de brief | Doodlopende lijn; krijgt geen nieuwe features | Dead end |
| Framework mode (`ssr: false`) | Type-safe routing, loaders/actions, aanbevolen default | React Router neemt de build over — botst met Vite + `@netlify/vite-plugin`; loaders draaien nergens, want auth en data zijn volledig client-side via Firebase | Je haalt een server-model binnen in een app die geen server heeft. Alle data komt uit de Firestore-client-SDK, achter een auth-state die pas ná hydration bekend is |
| Data mode | Loaders zonder framework-overname | Loaders moeten alsnog wachten op Firebase-auth-init; levert weinig op boven `useEffect` + context | Complexiteit zonder winst bij deze datastroom |
| **Declarative mode** | Simpelst; past exact bij client-side Firebase-auth; volledige controle over de build | Geen ingebouwde data-loading; die schrijven we zelf | Gekozen |

## Gevolgen

**Positief:** Vite blijft eigenaar van de build, wat `@netlify/vite-plugin` en de
Netlify-deploy simpel houdt. Auth-gating is één `<ProtectedRoute>`-component rond de
beveiligde routes.

**Negatief:** data-loading, loading-states en foutafhandeling schrijven we zelf. Bij groei
kan dat rommelig worden; dan is het moment om een data-laag (bijv. TanStack Query) te
overwegen — niet om naar framework mode te migreren.

**Terugdraaien:** overstappen naar data mode is later goed te doen (routes worden objecten
in plaats van JSX). Overstappen naar framework mode is een herbouw van de build-setup.

## Let op

Importeer altijd uit `react-router`, nooit uit `react-router-dom`. Voorbeelden op internet
staan nog vol met de oude import; die werkt niet in deze setup.
