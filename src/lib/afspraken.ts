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

const MS_PER_DAG = 86_400_000;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Van een datum naar een offset — zodat je in datums kunt denken
 *
 * DE SPANNING DIE DIT OPLOST. ADR-0008 verbiedt het opslaan van een
 * afspraakdatum, en dat is de reden dat deze app bestaat: schuift de bouw, dan
 * schuiven alle afspraken mee zonder dat iemand iets hoeft bij te werken. Maar
 * niemand dénkt in offsets. Gevraagd op 2 augustus: *"dat hier al gekozen kan
 * worden wat een datum is voor die partij, dat ze het hier al gelijk goed
 * kunnen zetten."*
 *
 * Beide kan. De gebruiker typt een datum, deze functie rekent uit hoeveel
 * dagen dat is ten opzichte van het bouwmoment, en **die afstand** gaat het
 * model in. Het model blijft ongewijzigd, de invoer wordt menselijk.
 *
 * WAT DE UI ERBIJ MOET ZEGGEN, want anders is het een verrassing: de ingetypte
 * datum is geen afspraak in beton. Schuift het bouwmoment, dan schuift deze
 * datum mee — dat is de bedoeling, maar wie "15 oktober" intypt verwacht dat
 * niet vanzelf.
 *
 * `undefined` als het anker geen datum heeft: dan valt er niets terug te
 * rekenen en hoort het datumveld uitgeschakeld te zijn.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function offsetUitDatum(gewenst: Date, ankerdatum: Date | undefined): number | undefined {
  if (ankerdatum === undefined) return undefined;
  return Math.round((gewenst.getTime() - ankerdatum.getTime()) / MS_PER_DAG);
}

/**
 * De keerzijde: welke datum levert deze offset op?
 *
 * Staat los van `berekenDatum()` in `planning.ts`, dat een hele band met
 * zekerheid teruggeeft. Hier gaat het om één datum bij één bekend anker — het
 * voorbeeld dat live meeloopt terwijl je typt.
 */
export function datumUitOffset(offsetDagen: number, ankerdatum: Date | undefined): Date | undefined {
  if (ankerdatum === undefined) return undefined;
  return new Date(ankerdatum.getTime() + offsetDagen * MS_PER_DAG);
}
