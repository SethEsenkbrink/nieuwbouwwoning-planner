/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De garantietermijnen van de waarborgregeling
 *
 * Alle vier lopen vanaf de oplevering, dus ze worden **afgeleid en niet
 * opgeslagen** — net als de uiterste datum voor het 5%-depot (ADR-0012).
 * Schuift de oplevering, dan schuiven ze mee.
 *
 * DIT IS GEEN JURIDISCH ADVIES (constraint C5).
 * Dit zijn de termijnen die gangbaar zijn bij Woningborg en SWK. Ze verschillen
 * per regeling en per onderdeel, en er staan uitzonderingen in elke polis.
 * Overal staat "meestal", en de UI zet het eigen garantiecertificaat voorop.
 *
 * Bewust géén termijnen per onderdeel (cv-ketel, kozijnen, dakbedekking): die
 * horen bij de fabrieksgarantie van dat specifieke apparaat, en dat is het
 * onderdelenregister uit blok E (ADR-0010). Zonder te weten wélke ketel erin
 * zit, is elke termijn een gok.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Garantietermijn {
  sleutel: string;
  titel: string;
  maanden: number;
  uitleg: string;
  /** Wat je zou moeten doen vóórdat deze termijn afloopt. */
  voorHetAfloopt?: string;
}

export const GARANTIETERMIJNEN: readonly Garantietermijn[] = [
  {
    sleutel: "onderhoud",
    titel: "Onderhoudstermijn",
    maanden: 3,
    uitleg:
      "De periode direct na oplevering waarin de aannemer verplicht is opgekomen gebreken te " +
      "herstellen. Meestal drie maanden.",
    voorHetAfloopt:
      "Loop het hele huis na. Krimpscheuren, klemmende deuren en afwerkfouten komen pas boven " +
      "als je er woont — en na deze termijn gelden strengere criteria.",
  },
  {
    sleutel: "kort",
    titel: "Kortlopende garanties",
    maanden: 24,
    uitleg:
      "Voor een aantal onderdelen kent de regeling een kortere termijn dan de algemene zes " +
      "jaar — denk aan installaties, hang- en sluitwerk en afwerking. Wélke, staat in je " +
      "garantiecertificaat.",
    voorHetAfloopt: "Laat installaties nakijken en meld wat niet goed werkt schriftelijk.",
  },
  {
    sleutel: "algemeen",
    titel: "Algemene garantie",
    maanden: 72,
    uitleg:
      "De hoofdregel van de waarborgregeling: meestal zes jaar op gebreken die onder de " +
      "garantienormen vallen.",
  },
  {
    sleutel: "constructief",
    titel: "Ernstige (constructieve) gebreken",
    maanden: 120,
    uitleg:
      "De langste termijn, meestal tien jaar, voor gebreken die de constructie of de " +
      "bruikbaarheid van de woning aantasten.",
  },
];
