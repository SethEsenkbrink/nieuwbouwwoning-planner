# ADR-0007 — Dependency-overrides in plaats van `npm audit fix --force`

**Status:** Geaccepteerd
**Datum:** 2026-07-29

## Context

Direct na de eerste `npm install` meldde `npm audit` **15 high severity
vulnerabilities**. Alle vijftien komen uit één tak: `@netlify/vite-plugin`, een
devDependency die Netlify Functions lokaal emuleert tijdens `npm run dev`.

Twee onderliggende oorzaken:

| Pakket | Advisory | Vindplaats |
|---|---|---|
| `brace-expansion` 2.1.3 | [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — DoS via ongelimiteerde expansie (out-of-memory) | genest onder `glob` en `readdir-glob` |
| `sharp` 0.34.5 | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — geërfde libvips-CVE's | via `ipx` → `@netlify/images` |

De overige dertien meldingen zijn "depends on a vulnerable version of…" — geen
zelfstandige problemen, maar doorvertaling van deze twee.

### Wat het risico feitelijk is

Gecontroleerd met `npm ls --omit=dev --all`: **niets uit deze tak zit in de
productiebundle.** Het is uitsluitend build- en dev-tooling.

- De `brace-expansion`-DoS vereist dat een aanvaller het glob-patroon bepaalt. In
  deze keten komen de patronen uit Netlify's eigen bundelcode, niet van buiten.
- De `sharp`/libvips-CVE's zitten in beeldverwerking via `@netlify/images` — de
  emulatie van Netlify Image CDN. Die functie gebruiken we niet, en de code draait
  alleen op de ontwikkelmachine.

Reëel risico dus: laag. Maar vijftien permanente "high"-meldingen zijn wél schadelijk:
ze maken `npm audit` waardeloos als signaal, waardoor een echte kwetsbaarheid straks
ondersneeuwt.

## Beslissing

We voegen **`overrides`** toe aan `package.json`:

```json
"overrides": {
  "brace-expansion": "^5.0.8",
  "sharp": "^0.35.3"
}
```

Beide zijn de laagste versies waarin de betreffende advisories verholpen zijn.
Resultaat: `npm audit` → **0 vulnerabilities**, en `npm run verify` blijft groen
(typecheck, lint, tokenpariteit, build).

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
|---|---|---|---|
| `npm audit fix --force` | Eén commando | Downgradet `@netlify/vite-plugin` van 2.12.9 naar **2.1.4** — elf minor versies terug, expliciet als breaking aangemerkt | Je lost een dev-only DoS op door je tooling een jaar terug in de tijd te zetten. Dat introduceert meer risico dan het wegneemt |
| Meldingen negeren | Geen werk | `npm audit` wordt permanent rood; over een half jaar kijkt niemand er meer naar en glipt een echte kwetsbaarheid erdoor | De waarde van audit zit in het signaal, en dat gooi je hiermee weg |
| `@netlify/vite-plugin` verwijderen | Verwijdert de hele tak in één klap | Je verliest lokale emulatie van Netlify Functions — precies wat je nodig hebt bij het bouwen van de documentparser (fase 2) | Te duur voor wat het oplost |
| **Overrides** | 0 vulnerabilities, nieuwste plugin blijft staan, build ongewijzigd | Je dwingt versies af die de upstream-maintainer niet getest heeft | Gekozen |

## Gevolgen

**Positief:** `npm audit` is weer een bruikbaar signaal. De nieuwste
`@netlify/vite-plugin` blijft in gebruik, dus geen functionaliteitsverlies.

**Negatief:** overrides zijn een vorm van "wij weten het beter dan de maintainer".
`brace-expansion` gaat van 2.x naar 5.x — dat is drie majors. De API is voor het
gebruik binnen `glob`/`minimatch` gelijk gebleven en de build bewijst dat het werkt,
maar dit is geen garantie voor toekomstige versies.

**Onderhoud:** controleer bij elke grote dependency-update of de overrides nog nodig
zijn. Zodra Netlify zijn keten bijwerkt, kunnen ze weg:

```bash
# Overrides tijdelijk uit package.json halen, dan:
npm install && npm audit
# 0 vulnerabilities? Dan kunnen ze definitief weg.
```

**Terugdraaien:** twee regels uit `package.json` verwijderen en `npm install`.

## Regel voor volgende sessies

Bij een nieuwe audit-melding: **eerst uitzoeken of het productie- of dev-code
betreft** (`npm ls --omit=dev --all | grep <pakket>`), en of het aanvalspad in dit
project überhaupt bestaat. Pas daarna ingrijpen — en nooit met `--force` als dat een
downgrade van een direct gebruikte dependency oplevert.
