import { evalueerEnergieRegels } from "./energie";
import { evalueerFinancieleRegels } from "./financieel";
import { evalueerGarantieRegels } from "./garanties";
import { evalueerOnderhoudRegels } from "./onderhoud";
import { evalueerTermijnRegels } from "./termijnen";
import type { RegelContext, RegelResultaat, SignaalNiveau } from "./types";

const NIVEAU_PRIORITEIT: Record<SignaalNiveau, number> = {
  urgent: 4,
  waarschuwing: 3,
  attentie: 2,
  info: 1,
};

/**
 * Evalueert alle regels deterministisch over de verstrekte context.
 *
 * Eigenschappen:
 * - Pure deterministische functie (geen netwerk, geen side-effects)
 * - Resultaten gesorteerd op urgentie en datum
 */
export function evalueerRegels(context: RegelContext): RegelResultaat[] {
  const alleSignalen: RegelResultaat[] = [
    ...evalueerTermijnRegels(context),
    ...evalueerFinancieleRegels(context),
    ...evalueerGarantieRegels(context),
    ...evalueerOnderhoudRegels(context),
    ...evalueerEnergieRegels(context, context.meterstanden),
  ];

  // Sorteer op prioriteit (urgent eerst) en vervolgens op deadline
  return alleSignalen.sort((a, b) => {
    const scoreA = NIVEAU_PRIORITEIT[a.niveau];
    const scoreB = NIVEAU_PRIORITEIT[b.niveau];
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    if (a.deadlineDatum && b.deadlineDatum) {
      return a.deadlineDatum.localeCompare(b.deadlineDatum);
    }
    if (a.deadlineDatum) return -1;
    if (b.deadlineDatum) return 1;
    return a.titel.localeCompare(b.titel);
  });
}
