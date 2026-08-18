import type { Bron, Bronnen } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Herkomst van waarden — en de grendel op handmatige invoer
 *
 * De audit stelde vast dat er geen enkele code was die voorkwam dat een
 * herberekening een handmatig ingevoerde waarde overschrijft (bevinding A-10).
 * Dat is precies het soort fout dat je pas merkt als het te laat is: je past
 * een datum aan, de app rekent iets door, en je aanpassing is stil weg.
 *
 * Deze module is die grendel. De regel is één zin lang:
 *
 *   **Een waarde met bron `ingevoerd` wordt nooit overschreven door iets
 *   anders dan de gebruiker zelf.**
 *
 * Alles hieronder is puur — geen opslag, geen React — zodat de regel los van
 * de plek waar hij wordt toegepast te toetsen is.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** De bron van één veld, of `undefined` als die niet is vastgelegd. */
export function bronVan(bronnen: Bronnen | undefined, veld: string): Bron | undefined {
  return bronnen?.[veld];
}

/**
 * Of een veld door een automatische bewerking overschreven mag worden.
 *
 * Onbekende herkomst telt als overschrijfbaar: velden van vóór deze module
 * hebben geen bron, en die als onaantastbaar behandelen zou elke herberekening
 * in bestaande dossiers blokkeren.
 */
export function magOverschrijven(bronnen: Bronnen | undefined, veld: string): boolean {
  return bronVan(bronnen, veld) !== "ingevoerd";
}

export interface SamenvoegResultaat<T> {
  /** Het record na samenvoegen. */
  record: T;
  /** Velden die zijn overgeslagen omdat de gebruiker ze zelf had ingevuld. */
  overgeslagen: string[];
  /** De bijgewerkte herkomstmap. */
  bronnen: Bronnen;
}

/**
 * Voegt berekende waarden samen met een bestaand record.
 *
 * Velden die de gebruiker zelf heeft ingevuld blijven staan, en worden
 * teruggegeven in `overgeslagen` zodat de UI kan tonen wát er niet is
 * bijgewerkt. Stil overslaan zou net zo verwarrend zijn als stil overschrijven.
 */
export function voegBerekendeWaardenSamen<T extends Record<string, unknown>>(
  bestaand: T,
  berekend: Partial<T>,
  bron: Exclude<Bron, "ingevoerd"> = "afgeleid",
): SamenvoegResultaat<T> {
  const huidigeBronnen: Bronnen = { ...((bestaand.bronnen as Bronnen | undefined) ?? {}) };
  const resultaat: Record<string, unknown> = { ...bestaand };
  const overgeslagen: string[] = [];

  for (const [veld, waarde] of Object.entries(berekend)) {
    if (waarde === undefined) continue;

    if (!magOverschrijven(huidigeBronnen, veld)) {
      overgeslagen.push(veld);
      continue;
    }

    resultaat[veld] = waarde;
    huidigeBronnen[veld] = bron;
  }

  resultaat.bronnen = huidigeBronnen;
  return { record: resultaat as T, overgeslagen, bronnen: huidigeBronnen };
}

/**
 * Legt vast dat de gebruiker deze velden zelf heeft ingevuld.
 *
 * Aan te roepen vanuit elk formulier dat opslaat. Daarna zijn die velden
 * beschermd tegen elke automatische bewerking.
 */
export function markeerAlsIngevoerd<T extends Record<string, unknown>>(
  record: T,
  velden: readonly string[],
): T {
  const bronnen: Bronnen = { ...((record.bronnen as Bronnen | undefined) ?? {}) };
  for (const veld of velden) {
    bronnen[veld] = "ingevoerd";
  }
  return { ...record, bronnen };
}

/**
 * Markeert velden met een herkomst zonder de waarden aan te raken.
 *
 * Gebruikt bij import: de waarden komen ergens anders vandaan, maar ze zijn
 * niet door de gebruiker in deze app ingetikt en mogen dus later door een
 * herberekening bijgewerkt worden.
 */
export function markeerHerkomst<T extends Record<string, unknown>>(
  record: T,
  velden: readonly string[],
  bron: Bron,
): T {
  const bronnen: Bronnen = { ...((record.bronnen as Bronnen | undefined) ?? {}) };
  for (const veld of velden) {
    bronnen[veld] = bron;
  }
  return { ...record, bronnen };
}
