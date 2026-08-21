/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De pagina's die een zoekmachine mag zien — en de enige plek waar dat staat
 *
 * Tot 21 augustus 2026 was het antwoord op "wat mag geïndexeerd worden" drie
 * keer los opgeschreven: `Disallow: /` in robots.txt, `noindex, nofollow` in
 * index.html, en impliciet in de routetabel. Er wás niets publieks, dus dat
 * viel niet op. Nu er een landingspagina met voorwaarden en privacyverklaring
 * staat, zouden die drie plekken meteen uit elkaar gaan lopen.
 *
 * Deze lijst is de bron. Er hangen vier dingen aan:
 *
 *   1. `public/sitemap.xml`     — de URL's die je aan Google opgeeft
 *   2. `public/robots.txt`      — wat je toestaat te crawlen
 *   3. `src/lib/usePaginameta`  — titel, omschrijving en canonical per pagina
 *   4. `scripts/verify-seo.mjs` — de gate die controleert dat 1 en 2 hierop
 *                                 aansluiten
 *
 * DE STANDAARD IS "GEBLOKKEERD". robots.txt sluit alles af en zet er alleen
 * de paden uit deze lijst weer bij. Een nieuwe route in de app is daarmee
 * automatisch uitgesloten — wat de veilige kant op is bij een applicatie waar
 * álles achter een kluis hoort te zitten.
 *
 * ⚠ HET DOMEIN HIERONDER MOET KLOPPEN.
 * Een sitemap met het verkeerde adres wijst zoekmachines naar URL's die niet
 * bestaan, en dat blijft maanden staan zonder dat iets klaagt. Verhuist de app
 * naar een eigen domein, pas dan `CANONIEKE_ORIGIN` aan en draai
 * `npm run verify` — de gate dwingt af dat robots.txt en sitemap.xml meegaan.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Zonder afsluitende slash. */
export const CANONIEKE_ORIGIN = "https://nieuwbouwplanner.netlify.app";

export interface PubliekePagina {
  /** Begint met een slash. De wortel is exact "/". */
  pad: string;
  /** Wat er in het browsertabblad en in het zoekresultaat komt te staan. */
  titel: string;
  /** De omschrijving onder het zoekresultaat. Circa 150 tekens. */
  beschrijving: string;
  /** Voor de sitemap: 1.0 voor de landingspagina, lager voor de rest. */
  prioriteit: string;
}

export const PUBLIEKE_PAGINAS: readonly PubliekePagina[] = [
  {
    pad: "/",
    titel: "Woningdossier — 100% lokaal en versleuteld woningdossier",
    beschrijving:
      "Houd de termijnen, kosten, garanties en het onderhoud van je woning bij. " +
      "Volledig op je eigen apparaat, versleuteld, zonder account en zonder server.",
    prioriteit: "1.0",
  },
  {
    pad: "/voorwaarden",
    titel: "Algemene voorwaarden — Woningdossier",
    beschrijving:
      "De voorwaarden voor het gebruik van Woningdossier: wat de app is, wat hij " +
      "uitdrukkelijk niet is, en wie waarvoor verantwoordelijk is.",
    prioriteit: "0.3",
  },
  {
    pad: "/privacy",
    titel: "Privacyverklaring — Woningdossier",
    beschrijving:
      "Wat er gebeurt met de gegevens die je invult: niets verlaat je apparaat. " +
      "Inclusief wat de hostingpartij wél ziet als je de pagina opent.",
    prioriteit: "0.3",
  },
];

/** De volledige canonieke URL van een publieke pagina. */
export function canoniekeUrl(pad: string, origin: string = CANONIEKE_ORIGIN): string {
  return pad === "/" ? `${origin}/` : `${origin}${pad}`;
}

export function paginaVoorPad(pad: string): PubliekePagina | undefined {
  return PUBLIEKE_PAGINAS.find((p) => p.pad === pad);
}
