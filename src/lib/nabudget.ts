import type { NabudgetMetId } from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Budget ná de oplevering — geraamd naast werkelijk
 *
 * Twee bedragen per post, en dat is de hele kern: wat je dacht dat het zou
 * kosten, en wat het werd. Eén bedrag per post zou het interessantste getal
 * wegpoetsen — je totale overschrijding.
 *
 * DE TOTAALSOM GEBRUIKT HET WERKELIJKE BEDRAG ZODRA DAT ER IS.
 * Voor een post die betaald is telt de raming niet meer mee; dat zou dubbel
 * tellen. Staat er nog geen werkelijk bedrag, dan is de raming het beste dat
 * we hebben.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Het bedrag dat voor deze post telt: werkelijk als dat bekend is, anders de raming. */
export function telbaarBedrag(post: NabudgetMetId): number {
  return post.werkelijk ?? post.geraamd ?? 0;
}

export interface Nabudgetstand {
  aantal: number;
  /** Alles bij elkaar, met werkelijk vóór geraamd. */
  totaal: number;
  geraamd: number;
  besteld: number;
  betaald: number;
  /**
   * Werkelijk min geraamd, alleen over posten waar allebei bekend is.
   * Positief betekent: duurder uitgevallen dan gedacht.
   */
  afwijking: number;
  /** Posten zonder enig bedrag; de totalen zijn dan een ondergrens. */
  zonderBedrag: number;
}

export function telNabudget(posten: readonly NabudgetMetId[]): Nabudgetstand {
  const stand: Nabudgetstand = {
    aantal: posten.length,
    totaal: 0,
    geraamd: 0,
    besteld: 0,
    betaald: 0,
    afwijking: 0,
    zonderBedrag: 0,
  };

  for (const post of posten) {
    const bedrag = telbaarBedrag(post);
    stand.totaal += bedrag;

    if (post.geraamd === undefined && post.werkelijk === undefined) stand.zonderBedrag += 1;
    if (post.geraamd !== undefined && post.werkelijk !== undefined)
      stand.afwijking += post.werkelijk - post.geraamd;

    if (post.status === "betaald") stand.betaald += bedrag;
    else if (post.status === "besteld") stand.besteld += bedrag;
    else stand.geraamd += bedrag;
  }

  return stand;
}

const VOLGORDE: Record<NabudgetMetId["status"], number> = {
  geraamd: 0,
  besteld: 1,
  betaald: 2,
};

/**
 * Wat nog moet gebeuren bovenaan, wat betaald is onderaan; binnen een groep het
 * duurste eerst. Bij een lijst van vijftien posten is het grootste bedrag het
 * eerste waar je iets aan kunt veranderen.
 */
export function sorteerNabudget(posten: readonly NabudgetMetId[]): NabudgetMetId[] {
  return [...posten].sort((a, b) => {
    const opStatus = VOLGORDE[a.status] - VOLGORDE[b.status];
    if (opStatus !== 0) return opStatus;

    const verschil = telbaarBedrag(b) - telbaarBedrag(a);
    if (verschil !== 0) return verschil;

    return a.omschrijving.localeCompare(b.omschrijving, "nl");
  });
}

/** Welke standaardposten nog niet in de lijst staan, op omschrijving vergeleken. */
export function ontbrekendeStandaardposten(
  posten: readonly NabudgetMetId[],
  standaard: readonly { omschrijving: string }[],
): string[] {
  const aanwezig = new Set(posten.map((p) => p.omschrijving.trim().toLowerCase()));
  return standaard
    .map((s) => s.omschrijving)
    .filter((o) => !aanwezig.has(o.trim().toLowerCase()));
}
