import type { OnderhoudTaakDoc } from "@/types/model";

export interface MjopJaarPost {
  jaar: number;
  geschatteKosten: number;
  aantalTaken: number;
  taken: {
    taakId: string;
    titel: string;
    kosten: number;
  }[];
}

/**
 * Berekent een meerjarenonderhoudsraming (MJOP-light) over een horizon van N jaren.
 *
 * Eigenschappen:
 * - Pure deterministische functie
 * - Berekent op basis van `intervalDagen` (of geschat cyclusinterval) en `geschatteKosten` of eerdere logboekkosten
 */
export function berekenMjopKostenOverzicht(
  taken: OnderhoudTaakDoc[],
  horizonJaren = 10,
  startJaar = new Date().getFullYear(),
): MjopJaarPost[] {
  const overzicht: MjopJaarPost[] = [];

  for (let j = 0; j < horizonJaren; j++) {
    const jaar = startJaar + j;
    overzicht.push({
      jaar,
      geschatteKosten: 0,
      aantalTaken: 0,
      taken: [],
    });
  }

  for (const taak of taken) {
    const intervalJaren = Math.max(1, Math.round(taak.intervalDagen / 365));
    const geschatBedrag = (taak as { geschatteKosten?: number }).geschatteKosten ?? 150; // fallback standaardbedrag

    // Bepaal startjaar van de taak
    let taakStartJaar = startJaar;
    if (taak.laatstUitgevoerdOp) {
      taakStartJaar = taak.laatstUitgevoerdOp.toDate().getFullYear() + intervalJaren;
    }

    for (let jaar = Math.max(startJaar, taakStartJaar); jaar < startJaar + horizonJaren; jaar += intervalJaren) {
      const jaarIndex = jaar - startJaar;
      const jaarPost = overzicht[jaarIndex];
      if (jaarPost) {
        jaarPost.geschatteKosten += geschatBedrag;
        jaarPost.aantalTaken += 1;
        jaarPost.taken.push({
          taakId: taak.id,
          titel: taak.titel,
          kosten: geschatBedrag,
        });
      }
    }
  }

  return overzicht;
}
