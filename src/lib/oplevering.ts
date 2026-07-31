import { berekenDatum, opDag, verschilInDagen, type PlanningContext } from "@/lib/planning";
import type { GebrekMetId } from "@/lib/converters";
import { GARANTIETERMIJNEN } from "@/data/garanties";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Oplevering — opleverpunten en het 5%-depot
 *
 * DE UITERSTE DATUM VOOR HET DEPOT WORDT AFGELEID, NIET OPGESLAGEN (ADR-0012).
 * De termijn loopt tot het einde van de onderhoudstermijn, en die begint bij de
 * oplevering. Beide schuiven mee met de bouw; een opgeslagen datum zou na de
 * eerste verschuiving verkeerd staan — en het is precies een datum waarvan de
 * gebruiker aanneemt dat de app hem bewaakt.
 *
 * De afleiding kent twee bronnen, in deze volgorde:
 *   1. het anker `einde_onderhoudstermijn`, als dat is ingevuld;
 *   2. anders de oplevering plus de standaardtermijn van 90 dagen.
 *
 * Bij de tweede staat er in de UI expliciet bij dat het om de standaardtermijn
 * gaat — dezelfde eerlijkheid als bij `zekerheid` in ADR-0009.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * De gangbare onderhoudstermijn bij Woningborg en SWK. Geen wet: het eigen
 * contract is leidend, en dat staat ook in de UI.
 */
export const ONDERHOUDSTERMIJN_DAGEN = 90;

export interface Onderhoudstermijn {
  eindigtOp: Date;
  /** Waarop de datum gebaseerd is — bepaalt wat de UI erbij zet. */
  bron: "anker" | "standaardtermijn";
  /** Negatief betekent: de termijn is voorbij. */
  dagenResterend: number;
}

export function bepaalOnderhoudstermijn(
  context: PlanningContext,
  vandaag: Date,
): Onderhoudstermijn | null {
  const uitAnker = berekenDatum("einde_onderhoudstermijn", 0, context);
  if (uitAnker && uitAnker.zekerheid !== "teruggevallen") {
    return {
      eindigtOp: uitAnker.verwacht,
      bron: "anker",
      dagenResterend: verschilInDagen(uitAnker.verwacht, vandaag),
    };
  }

  const oplevering = berekenDatum("oplevering", 0, context);
  if (!oplevering) return null;

  const eindigtOp = opDag(
    new Date(oplevering.verwacht.getTime() + ONDERHOUDSTERMIJN_DAGEN * 86_400_000),
  );
  return {
    eindigtOp,
    bron: "standaardtermijn",
    dagenResterend: verschilInDagen(eindigtOp, vandaag),
  };
}

export type Gebrekstand = "hersteld" | "termijn_verlopen" | "open";

export function gebrekstand(gebrek: GebrekMetId, vandaag: Date): Gebrekstand {
  if (gebrek.status === "hersteld") return "hersteld";
  if (gebrek.hersteltermijn && verschilInDagen(gebrek.hersteltermijn, vandaag) < 0)
    return "termijn_verlopen";
  return "open";
}

const VOLGORDE: Record<Gebrekstand, number> = {
  termijn_verlopen: 0,
  open: 1,
  hersteld: 2,
};

/**
 * Verstreken hersteltermijnen bovenaan, herstelde punten onderaan.
 *
 * Herstelde punten blijven staan en verdwijnen niet: ze horen bij het
 * proces-verbaal, en bij een geschil wil je kunnen laten zien wat er is gemeld
 * en wanneer.
 */
export function sorteerGebreken(gebreken: readonly GebrekMetId[], vandaag: Date): GebrekMetId[] {
  return [...gebreken].sort((a, b) => {
    const opStand = VOLGORDE[gebrekstand(a, vandaag)] - VOLGORDE[gebrekstand(b, vandaag)];
    if (opStand !== 0) return opStand;

    const termijnA = a.hersteltermijn?.getTime();
    const termijnB = b.hersteltermijn?.getTime();
    if (termijnA !== undefined && termijnB !== undefined) return termijnA - termijnB;
    if (termijnA !== undefined) return -1;
    if (termijnB !== undefined) return 1;

    return (a.locatie ?? "").localeCompare(b.locatie ?? "", "nl");
  });
}

export interface Gebrekenstand {
  totaal: number;
  open: number;
  hersteld: number;
  /** Open punten waarvan de afgesproken hersteltermijn verstreken is. */
  termijnVerlopen: number;
}

export function telGebreken(gebreken: readonly GebrekMetId[], vandaag: Date): Gebrekenstand {
  const stand: Gebrekenstand = { totaal: gebreken.length, open: 0, hersteld: 0, termijnVerlopen: 0 };

  for (const gebrek of gebreken) {
    switch (gebrekstand(gebrek, vandaag)) {
      case "hersteld":
        stand.hersteld += 1;
        break;
      case "termijn_verlopen":
        stand.open += 1;
        stand.termijnVerlopen += 1;
        break;
      default:
        stand.open += 1;
    }
  }

  return stand;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Garantietermijnen — afgeleid, net als de onderhoudstermijn
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Zelfde dag, zoveel maanden later, in UTC.
 *
 * De valkuil zit in de maandlengte: `setMonth` op 31 augustus plus zes maanden
 * levert 3 maart op in plaats van 28 februari, omdat JavaScript de overloop
 * doorschuift naar de volgende maand. Bij een garantietermijn is dat het
 * verschil tussen "op tijd gemeld" en "net te laat", dus wordt hier geklemd op
 * de laatste dag van de doelmaand.
 */
export function overMaanden(datum: Date, maanden: number): Date {
  const jaar = datum.getUTCFullYear();
  const maand = datum.getUTCMonth() + maanden;
  const dag = datum.getUTCDate();

  // Dag 0 van de vólgende maand = de laatste dag van de doelmaand.
  const laatsteDag = new Date(Date.UTC(jaar, maand + 1, 0)).getUTCDate();
  return new Date(Date.UTC(jaar, maand, Math.min(dag, laatsteDag)));
}

export interface Garantiestand {
  sleutel: string;
  titel: string;
  uitleg: string;
  voorHetAfloopt?: string;
  verstrijktOp: Date;
  /** Negatief betekent: de termijn is voorbij. */
  dagenResterend: number;
  /** Loopt af binnen drie maanden — het moment om iets te laten nakijken. */
  bijnaVoorbij: boolean;
}

/** Binnen hoeveel dagen een aflopende termijn de aandacht verdient. */
const BIJNA_VOORBIJ_DAGEN = 90;

/**
 * Alle termijnen, gerekend vanaf de opleverdatum. `null` zolang die niet
 * bekend is — dan valt er niets af te tellen en verzint de app niets.
 */
export function berekenGaranties(
  context: PlanningContext,
  vandaag: Date,
): Garantiestand[] | null {
  const oplevering = berekenDatum("oplevering", 0, context);
  if (!oplevering) return null;

  return GARANTIETERMIJNEN.map((termijn) => {
    const verstrijktOp = overMaanden(oplevering.verwacht, termijn.maanden);
    const dagenResterend = verschilInDagen(verstrijktOp, vandaag);
    return {
      sleutel: termijn.sleutel,
      titel: termijn.titel,
      uitleg: termijn.uitleg,
      ...(termijn.voorHetAfloopt === undefined
        ? {}
        : { voorHetAfloopt: termijn.voorHetAfloopt }),
      verstrijktOp,
      dagenResterend,
      bijnaVoorbij: dagenResterend >= 0 && dagenResterend <= BIJNA_VOORBIJ_DAGEN,
    };
  });
}
