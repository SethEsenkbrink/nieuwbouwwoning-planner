/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Offsets leesbaar maken
 *
 * In het model is een offset één getal: negatief betekent ervóór, positief
 * erna (ADR-0008). Dat is precies wat de rekenkern nodig heeft en precies wat
 * een mens niet wil invullen. Niemand denkt "min vijfenveertig"; mensen denken
 * "vijfenveertig dagen vóór de sleuteloverdracht".
 *
 * Deze twee functies zijn de vertaling, en ze staan hier los van het formulier
 * zodat er tests op kunnen. De valkuil zit bij nul en bij het dubbele minteken:
 * −45 met richting "voor" moet 45 opleveren, niet −45.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Richting = "voor" | "na";

/** Van één getal naar wat het formulier toont. */
export function splitsOffset(offsetDagen: number): { dagen: number; richting: Richting } {
  return {
    dagen: Math.abs(offsetDagen),
    // Nul is geen richting. "Op de dag zelf" tonen we als "na", zodat het veld
    // een geldige waarde heeft; het teken maakt bij nul toch niets uit.
    richting: offsetDagen < 0 ? "voor" : "na",
  };
}

/** Van wat het formulier oplevert naar het getal dat wordt opgeslagen. */
export function maakOffset(dagen: number, richting: Richting): number {
  const positief = Math.abs(dagen);
  return richting === "voor" ? -positief : positief;
}

/** Bijvoorbeeld "45 dagen vóór Sleuteloverdracht" of "op de dag van Oplevering". */
export function toonOffset(offsetDagen: number, ankerTitel: string): string {
  if (offsetDagen === 0) return `op de dag van ${ankerTitel}`;
  const dagen = Math.abs(offsetDagen);
  const eenheid = dagen === 1 ? "dag" : "dagen";
  return offsetDagen < 0
    ? `${dagen} ${eenheid} vóór ${ankerTitel}`
    : `${dagen} ${eenheid} ná ${ankerTitel}`;
}
