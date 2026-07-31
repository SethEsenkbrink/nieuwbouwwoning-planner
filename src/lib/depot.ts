import type { TermijnMetId } from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Bouwdepot — drie stappen die los van elkaar kunnen slepen
 *
 * Een bouwtermijn doorloopt: de aannemer factureert → jij declareert bij de
 * bank → de bank betaalt. Daarom drie booleans in het model en geen enkel
 * statusveld: ze lopen in de praktijk niet netjes gelijk op.
 *
 * HET GETAL DAT ERTOE DOET IS `teDeclareren`.
 * Een factuur die je hebt ontvangen maar niet hebt ingediend, is geld dat
 * stilstaat terwijl de aannemer op betaling wacht. Dat is de enige stap in de
 * keten waar jíj aan zet bent — de andere twee liggen bij de aannemer en de
 * bank. Een depotoverzicht dat alleen "totaal betaald" toont, laat precies dat
 * ene actiepunt weg.
 *
 * Puur, zonder Firestore: `vandaag` en de bedragen komen als parameter binnen.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Termijnstand = "open" | "gefactureerd" | "gedeclareerd" | "betaald";

/**
 * De verst gevorderde stap telt. Een termijn die betaald is maar waarvan het
 * declaratie-vinkje vergeten is, staat gewoon op `betaald` — anders zou een
 * vergeten vinkje een actiepunt opleveren dat er niet is.
 */
export function termijnstand(termijn: TermijnMetId): Termijnstand {
  if (termijn.betaald) return "betaald";
  if (termijn.gedeclareerdBijBank) return "gedeclareerd";
  if (termijn.gefactureerd) return "gefactureerd";
  return "open";
}

export interface Depotstand {
  aantal: number;
  /** Alle bedragen bij elkaar, ongeacht de stand. */
  totaal: number;
  /** Nog niet gefactureerd door de aannemer. */
  nogNietGefactureerd: number;
  /** Gefactureerd maar nog niet ingediend bij de bank — hier ben jíj aan zet. */
  teDeclareren: number;
  /** Ingediend, maar de bank heeft nog niet betaald. */
  wachtOpBank: number;
  betaald: number;
  /** Hoeveel termijnen er nog op jouw actie wachten. */
  aantalTeDeclareren: number;
  /** Items zonder bedrag; de sommen zijn dan een ondergrens. */
  zonderBedrag: number;
}

export function telDepot(termijnen: readonly TermijnMetId[]): Depotstand {
  const stand: Depotstand = {
    aantal: termijnen.length,
    totaal: 0,
    nogNietGefactureerd: 0,
    teDeclareren: 0,
    wachtOpBank: 0,
    betaald: 0,
    aantalTeDeclareren: 0,
    zonderBedrag: 0,
  };

  for (const termijn of termijnen) {
    const bedrag = termijn.bedrag ?? 0;
    if (termijn.bedrag === undefined) stand.zonderBedrag += 1;
    stand.totaal += bedrag;

    switch (termijnstand(termijn)) {
      case "betaald":
        stand.betaald += bedrag;
        break;
      case "gedeclareerd":
        stand.wachtOpBank += bedrag;
        break;
      case "gefactureerd":
        stand.teDeclareren += bedrag;
        stand.aantalTeDeclareren += 1;
        break;
      default:
        stand.nogNietGefactureerd += bedrag;
    }
  }

  return stand;
}

/**
 * Termijnen horen in hun eigen volgorde te staan — "1e termijn", "2e termijn" —
 * en niet op urgentie. Het is een keten, geen werklijst; de actiepunten staan
 * apart bovenaan het scherm.
 *
 * `numeric: true` zorgt dat "10e termijn" ná "2e termijn" komt en niet ervoor.
 */
export function sorteerTermijnen(termijnen: readonly TermijnMetId[]): TermijnMetId[] {
  return [...termijnen].sort((a, b) => {
    const datumA = a.gefactureerdOp?.getTime();
    const datumB = b.gefactureerdOp?.getTime();
    if (datumA !== undefined && datumB !== undefined && datumA !== datumB) return datumA - datumB;
    if (datumA !== undefined && datumB === undefined) return -1;
    if (datumA === undefined && datumB !== undefined) return 1;
    return a.omschrijving.localeCompare(b.omschrijving, "nl", { numeric: true });
  });
}

/**
 * Wat er van de koopsom via het depot loopt. `undefined` als de koopsom niet is
 * ingevuld — dan valt er niets te vergelijken en toont de UI alleen de sommen.
 */
export function depotDekking(stand: Depotstand, koopsom: number | undefined): number | undefined {
  if (koopsom === undefined || koopsom <= 0) return undefined;
  return Math.round((stand.totaal / koopsom) * 100);
}
