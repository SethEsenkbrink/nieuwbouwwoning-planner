/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Wat er ná de oplevering nog komt
 *
 * Een nieuwbouwwoning wordt kaal opgeleverd. Wat de aannemer níét doet, staat
 * ook niet in de koopsom — en juist die posten worden bij het rekenen vergeten,
 * omdat ze pas opduiken als de sleutel er ligt.
 *
 * BEWUST GEEN RICHTBEDRAGEN.
 * De verleiding is groot om per post een indicatie te zetten ("vloer: € 4.000"),
 * maar de spreiding is enorm: laminaat of gietvloer, zelf leggen of laten
 * leggen, tien vierkante meter of honderd. Een verzonnen bedrag zou hier als
 * anker in het hoofd van de gebruiker blijven hangen, en dat is precies wat
 * ADR-0009 en constraint C5 willen voorkomen. Deze lijst is een geheugensteun,
 * geen begroting.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface StandaardNabudgetpost {
  sleutel: string;
  omschrijving: string;
  toelichting?: string;
}

export const STANDAARD_NABUDGET: readonly StandaardNabudgetpost[] = [
  {
    sleutel: "vloer",
    omschrijving: "Vloerafwerking",
    toelichting: "Inclusief egaliseren; let op de droogtijd van de dekvloer.",
  },
  { sleutel: "raambekleding", omschrijving: "Gordijnen en raambekleding" },
  {
    sleutel: "verlichting",
    omschrijving: "Verlichting en armaturen",
    toelichting: "De aannemer levert vaak alleen de aansluitpunten.",
  },
  { sleutel: "schilderwerk", omschrijving: "Binnenschilderwerk en behang" },
  {
    sleutel: "tuin",
    omschrijving: "Tuinaanleg",
    toelichting: "Grondwerk, beplanting en bestrating; vaak de grootste vergeten post.",
  },
  { sleutel: "schutting", omschrijving: "Schutting of erfafscheiding" },
  { sleutel: "oprit", omschrijving: "Oprit en bestrating" },
  { sleutel: "berging", omschrijving: "Berging of tuinhuis" },
  { sleutel: "zonwering", omschrijving: "Zonwering of screens" },
  {
    sleutel: "keukenapparatuur",
    omschrijving: "Losse keukenapparatuur",
    toelichting: "Alles wat niet in het meerwerk van de keuken zat.",
  },
  { sleutel: "sanitair", omschrijving: "Spiegels, accessoires en sanitair-extra's" },
  { sleutel: "trap", omschrijving: "Trapafwerking" },
  { sleutel: "verhuizing", omschrijving: "Verhuizing en opslag" },
  { sleutel: "aansluitingen", omschrijving: "Aansluitingen internet, tv en post" },
  { sleutel: "meubels", omschrijving: "Meubels en inrichting" },
];
