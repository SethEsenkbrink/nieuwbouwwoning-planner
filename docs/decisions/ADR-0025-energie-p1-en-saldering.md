# ADR-0025 — Energieverbruik, P1 Smart Meter CSV-Import en Saldering

- **Status:** Geaccepteerd
- **Datum:** 2026-08-15
- **Beslissers:** Seth (producteigenaar), Assistent
- **Raakt:** `src/lib/p1.ts`, `src/lib/energie.ts`, `src/rules/energie.ts`, `docs/STATE.md`

---

## Context

Energie en verduurzaming spelen een centrale rol in het moderne woningdossier. Gebruikers willen inzicht in hun werkelijke verbruik, de opbrengst van zonnepanelen, de impact van de veranderende salderingsregeling (post-2027), en een indicatie van het energielabel.

Echter gelden strikte randvoorwaarden:
1. **Zero-network:** Geen externe API-koppelingen naar netbeheerders of energieleveranciers. Alle data moet 100% lokaal worden ingevoerd of geïmporteerd.
2. **Juridische zuiverheid:** Een berekend energielabel mag nooit verward worden met een officieel NTA 8800 certificaat.
3. **Deterministische berekeningen:** Salderingsafbouw moet transparant berekend worden volgens de vastgestelde parameters.

---

## Besluit

### 1. P1 Smart Meter CSV-Import (`src/lib/p1.ts`)
- 100% lokale in-memory parser voor exportbestanden van P1-meters, Home Assistant sensor exports, DSMR-reader en Slimme Meter tools.
- Automatische detectie van scheidingstekens (komma, puntkomma, tab) en kolomheaders (OBIS 1.8.1, 1.8.2, 2.8.1, 2.8.2, gas 24.2.1, etc.).
- Geen cloud-koppeling nodig: de gebruiker downloadt een CSV en sleept deze in de app.

### 2. Indicatief Energielabel met Permanente Disclaimer (`src/lib/energie.ts`)
- Berekent primair fossiel energieverbruik in $\text{kWh/m}^2\text{/jaar}$ op basis van stroom- en gasverbruik gewogen naar de woningoppervlakte.
- Bevat altijd de permanente wettelijke disclaimer: *"Dit energielabel is een indicatieve berekening op basis van je feitelijke meterstanden en gebruikersgedrag. Dit vervangt geen officieel NTA 8800 energielabel dat door een gecertificeerd EP-adviseur is opgenomen."*

### 3. Salderingsregeling & Post-2027 Parameters
- Volledige saldering (100%) tot en met 2026.
- Afbouwmodel vanaf 2027 conform wetsvoorstel (2027: 64%, 2028: 55%, ..., 2031: 0%), volledig parametriseerbaar en aanpasbaar door de gebruiker.
- Berekent gesaldeerde kWh, netto teruglevering, terugleverkosten en daadwerkelijke besparing.

### 4. Regelmotor Integratie (`src/rules/energie.ts`)
- **E-002 (Opnamefrequentie):** Signaleert wanneer er al meer dan 60 dagen (`attentie`) of 120 dagen (`waarschuwing`) geen meterstanden zijn ingevoerd.

---

## Gevolgen

### Positief
- Volledige privacy en offline werking: geen energiedata verlaat het apparaat.
- Direct financieel inzicht in de opbrengst van verduurzamingsmaatregelen en terugleverkosten.
- Eerlijke communicatie zonder valse zekerheid over officiële labels.
