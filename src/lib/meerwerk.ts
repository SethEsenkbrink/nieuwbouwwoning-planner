import { berekenDatum, verschilInDagen, type BerekendeBand, type PlanningContext } from "@/lib/planning";
import type { MeerwerkMetId } from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Meerwerk: wanneer gaat de deur dicht, en wat kost het samen
 *
 * De deadline kent drie vormen (ADR-0011) en die gedragen zich verschillend:
 *
 *   vaste_datum  de administratieve sluitingsdatum van de aannemer. Staat vast
 *                en schuift NIET mee als de bouw schuift — de keuzelijst is dan
 *                allang dicht. Er valt niets te berekenen; de datum is wat hij is.
 *   bouwmoment   meerwerk dat tijdens de bouw opkomt. Hier geldt ADR-0008 en
 *                wordt de datum afgeleid, inclusief `zekerheid` uit ADR-0009.
 *   onbekend     geen deadline bekend. Geen datum verzinnen.
 *
 * Dit onderscheid is de reden dat deze module bestaat. Een scherm dat het zelf
 * uitrekent zou de twee door elkaar halen, en dan schuift een harde datum mee
 * met een bouw die verschuift — precies de fout die geld kost.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Meerwerkstand = "gesloten" | "sluit_binnenkort" | "open" | "onbekend";

/** Binnen hoeveel dagen "sluit binnenkort" gaat gelden. */
const BINNENKORT_DAGEN = 21;

export interface MeerwerkBeoordeling {
  item: MeerwerkMetId;
  /** De deadline, ongeacht hoe hij tot stand kwam. `undefined` bij onbekend. */
  sluitOp?: Date;
  /** Alleen gevuld bij `bouwmoment` — de UI toont dan de zekerheid erbij. */
  berekend?: BerekendeBand;
  stand: Meerwerkstand;
  /** Negatief betekent: de datum is al gepasseerd. */
  dagenTotSluiting?: number;
}

export function beoordeelMeerwerk(
  item: MeerwerkMetId,
  context: PlanningContext,
  vandaag: Date,
): MeerwerkBeoordeling {
  if (item.sluiting === "vaste_datum" && item.sluitingsdatum) {
    return metStand(item, item.sluitingsdatum, vandaag);
  }

  if (item.sluiting === "bouwmoment" && item.sluitingAnkerType) {
    const band = berekenDatum(item.sluitingAnkerType, item.sluitingOffsetDagen ?? 0, context);
    if (!band) return { item, stand: "onbekend" };
    return { ...metStand(item, band.verwacht, vandaag), berekend: band };
  }

  return { item, stand: "onbekend" };
}

function metStand(item: MeerwerkMetId, sluitOp: Date, vandaag: Date): MeerwerkBeoordeling {
  const dagen = verschilInDagen(sluitOp, vandaag);
  return {
    item,
    sluitOp,
    dagenTotSluiting: dagen,
    stand: dagen < 0 ? "gesloten" : dagen <= BINNENKORT_DAGEN ? "sluit_binnenkort" : "open",
  };
}

const STANDVOLGORDE: Record<Meerwerkstand, number> = {
  sluit_binnenkort: 0,
  open: 1,
  onbekend: 2,
  gesloten: 3,
};

/**
 * Wat bijna dichtgaat bovenaan, wat al dicht is onderaan.
 *
 * Een gesloten item verdwijnt niet: je wilt kunnen zien wat je hebt laten
 * lopen, en een item dat je al besteld hebt blijft relevant voor het budget.
 */
export function sorteerMeerwerk(
  beoordelingen: readonly MeerwerkBeoordeling[],
): MeerwerkBeoordeling[] {
  return [...beoordelingen].sort((a, b) => {
    const opStand = STANDVOLGORDE[a.stand] - STANDVOLGORDE[b.stand];
    if (opStand !== 0) return opStand;

    const datumA = a.sluitOp?.getTime();
    const datumB = b.sluitOp?.getTime();
    if (datumA !== undefined && datumB !== undefined) return datumA - datumB;
    if (datumA !== undefined) return -1;
    if (datumB !== undefined) return 1;

    return a.item.omschrijving.localeCompare(b.item.omschrijving, "nl");
  });
}

export interface Meerwerkbudget {
  /** Alles wat je overweegt, nog niet besteld. */
  overwogen: number;
  /** Besteld maar nog niet bevestigd door de aannemer. */
  besteld: number;
  /** Bevestigd: dit gaat gebeuren en dit kost het. */
  bevestigd: number;
  /** Besteld + bevestigd — wat je in de praktijk kwijt bent. */
  vastgelegd: number;
  /** Vastgelegd + overwogen: het maximum als je alles doorzet. */
  maximaal: number;
  /** Budget uit het project, als dat is ingevuld. */
  budget?: number;
  /** Negatief betekent: over het budget heen. */
  ruimte?: number;
}

/**
 * Telt de bedragen op, uitgesplitst naar status.
 *
 * Items zonder bedrag tellen als nul. Dat is een keuze: het alternatief is de
 * hele som als "onbekend" markeren, en dan verlies je het overzicht door één
 * item waarvan de prijs nog niet binnen is. De UI meldt apart hoeveel items
 * geen bedrag hebben.
 */
export function telMeerwerk(
  items: readonly MeerwerkMetId[],
  budget: number | undefined,
): Meerwerkbudget {
  let overwogen = 0;
  let besteld = 0;
  let bevestigd = 0;

  for (const item of items) {
    const bedrag = item.bedrag ?? 0;
    if (item.status === "overweeg") overwogen += bedrag;
    else if (item.status === "besteld") besteld += bedrag;
    else bevestigd += bedrag;
  }

  const vastgelegd = besteld + bevestigd;

  return {
    overwogen,
    besteld,
    bevestigd,
    vastgelegd,
    maximaal: vastgelegd + overwogen,
    ...(budget === undefined ? {} : { budget, ruimte: budget - vastgelegd }),
  };
}

/** Hoeveel items nog geen bedrag hebben — de som is dan een ondergrens. */
export function telZonderBedrag(items: readonly MeerwerkMetId[]): number {
  return items.filter((i) => i.bedrag === undefined).length;
}
