# ADR-0005 — Geen Firebase Storage, geen Cloud Functions; serverside op Netlify

**Status:** Geaccepteerd
**Datum:** 2026-07-29

## Context

Twee harde constraints uit `PROJECT.md` §3 hangen samen en zijn allebei makkelijk per
ongeluk te schenden:

- **C2 — geen bestandsopslag.** De belofte aan de gebruiker is dat een aannemings-
  overeenkomst wél gelezen maar nooit bewaard wordt. Dat is een privacy-eigenschap die het
  hele parser-verhaal draagt.
- **C3 — gratis.** Firebase Spark levert Auth + Firestore kosteloos, maar staat géén Cloud
  Functions toe. Zodra iemand een Cloud Function wil deployen, moet het project naar Blaze —
  en dan is de gratis-belofte weg.

Beide worden geschonden door een schijnbaar onschuldige actie: `getStorage()` aanroepen,
of `firebase deploy --only functions` draaien.

## Beslissing

- **Firebase Storage wordt nooit geïnitialiseerd.** `src/lib/firebase.ts` exporteert alleen
  `auth` en `db`. Er staat geen import van `firebase/storage` in het project.
- **Firebase Cloud Functions worden niet gebruikt.** `firebase.json` bevat geen
  `functions`-blok. Firebase is uitsluitend Auth + Firestore.
- **Alle serverside logica draait op Netlify Functions** (`netlify/functions/*.mts`). Die
  functions zijn stateless: ze ontvangen tekst, geven JSON terug, en persisteren niets.
- Documenten worden client-side gelezen met `pdf.js`. Alleen de geëxtraheerde, door de
  gebruiker bevestigde velden gaan naar Firestore.

## Alternatieven

| Optie | Voor | Tegen | Waarom niet |
|---|---|---|---|
| Firebase Storage voor documenten | Gebruiker kan later terug naar het origineel | Breekt de kernbelofte; vereist Blaze bij volume; maakt van ons een verwerker van gevoelige contractdata | Schendt C2 en C3 |
| Cloud Functions voor het parsen | Alles binnen één platform | Vereist Blaze | Schendt C3 |
| **pdf.js client-side + Netlify Functions** | Document verlaat het apparaat nooit als bestand; blijft binnen beide gratis tiers | Parsing hangt af van wat de browser aankan; grote PDF's kosten geheugen | Gekozen |

## Gevolgen

**Positief:** de privacybelofte is architectureel afgedwongen, niet alleen beloofd — er is
simpelweg geen plek waar een bestand naartoe kán. Kosten blijven structureel nul.

**Negatief:** de gebruiker moet het document opnieuw kiezen als hij iets wil nakijken. Zeer
grote PDF's kunnen client-side tegen geheugengrenzen aanlopen. Netlify Functions hebben een
kortere timeout dan Cloud Functions — lange LLM-calls moeten daarbinnen passen, anders is een
background function nodig.

**Terugdraaien:** technisch eenvoudig, maar het zou de propositie van het product veranderen.
Behandel dit als een productbelofte, niet als een technische keuze.

## Controlepunt bij elke sessie

Voordat je een Firebase-service of npm-package toevoegt, stel twee vragen:

1. Vereist dit het Blaze-plan?
2. Persisteert dit een bestand of ruwe documentinhoud?

Eén keer "ja" betekent: niet doen, of eerst een nieuwe ADR die deze vervangt.
