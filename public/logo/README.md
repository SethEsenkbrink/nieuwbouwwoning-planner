# Logo — Nieuwbouwplanner

Eigen vorm binnen de Brink-huisstijl v2.0 "Warm/D3". Zelfde kleuren, zelfde
satelliet-motief, andere mark — conform de regel uit `../../../AGENTS.md`:
elke app heeft een uniek logo binnen dezelfde huisstijl.

## De mark

Een **gevel-silhouet** (nieuwbouw van tekening) in de klei-gradient, met de
Brink-satelliet rechtsonder in cream en een **olijf vinkje** erin — het
planner-element. Waar de koepel-site een cirkel als mark heeft, heeft de
Nieuwbouwplanner een gevel; de satelliet is wat de familie bij elkaar houdt.

| Element | Waarde |
|---|---|
| Gevel | radial gradient `#D77E4F` → `#C4633B` (klei-light → klei) |
| Satelliet | `#FBF8F1` (lifted) |
| Vinkje | `#4E5B3C` (olijf) |
| Wordmark | Manrope 700, tracking −1 · "nieuwbouw" in ink, "planner" in klei |

## Bestanden

| Bestand | Gebruik |
|---|---|
| `svg/icon-light.svg` · `svg/icon-dark.svg` | Alleen de mark, 100×100 |
| `svg/horizontal-light.svg` | Mark + wordmark, op canvas/lichte achtergrond |
| `svg/horizontal-dark.svg` | Mark + wordmark, op ink/donkere achtergrond |
| `svg/mono-ink.svg` · `svg/mono-cream.svg` | Eén kleur, voor stempels/facturen/watermerk |
| `../favicon.svg` | Vereenvoudigd: massieve olijf-dot i.p.v. het vinkje |
| `../apple-touch-icon.png` · `../icon-192.png` · `../icon-512.png` | App-iconen |
| `png/*` | Rasterexports voor plekken waar geen SVG kan |

## Waarom de wordmark outlines zijn, geen `<text>`

De letters staan als paden in de SVG, niet als tekst met `font-family="Manrope"`.
Dat betekent dat het logo er overal identiek uitziet — ook waar Manrope niet
geïnstalleerd is (e-mailclients, PDF-viewers, ontwerptools, servers die
thumbnails renderen). De Brink-hoofdlogo's gebruiken nog wel `<text>`; daar zie
je het probleem zodra je ze buiten de browser rendert.

Wil je de wordmark wijzigen, dan moeten de outlines opnieuw gegenereerd worden
uit de variable font (Manrope, `wght=700`) — je kunt de paden niet met de hand
aanpassen.

## Regels

- Niet roteren, uitrekken of herkleuren buiten deze varianten.
- Niet op puur wit plaatsen: gebruik `canvas` (#F5F1E8) of `lifted` (#FBF8F1).
- Minimale hoogte van de mark: 24px. Daaronder de favicon-variant gebruiken —
  het vinkje valt onder ~32px weg.
- Vrije ruimte rondom: minimaal de helft van de markhoogte.
