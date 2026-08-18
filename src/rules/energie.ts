import type { Meterstand } from "@/types/model";
import type { RegelContext, RegelResultaat } from "./types";

function naarDagenVerschil(datumA: Date, datumB: Date): number {
  const msDag = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(datumA.getFullYear(), datumA.getMonth(), datumA.getDate());
  const utc2 = Date.UTC(datumB.getFullYear(), datumB.getMonth(), datumB.getDate());
  return Math.floor((utc1 - utc2) / msDag);
}

function naarDatumSleutel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Evalueert energieregels (meterstanden, verbruikstrends en opnamefrequentie).
 */
export function evalueerEnergieRegels(
  context: RegelContext,
  meterstanden?: (Meterstand & { id?: string })[],
): RegelResultaat[] {
  const resultaten: RegelResultaat[] = [];
  const peildatum = context.peildatum ?? new Date();

  // 1. E-002: Controleer opname-interval van meterstanden
  if (meterstanden && meterstanden.length > 0) {
    // Sorteer op opnamedatum, nieuwste eerst
    const gesorteerd = [...meterstanden].sort((a, b) => b.opgenomenOp.toDate().getTime() - a.opgenomenOp.toDate().getTime());
    const nieuwste = gesorteerd[0];

    if (nieuwste) {
      const dagenSindsLaatste = naarDagenVerschil(peildatum, nieuwste.opgenomenOp.toDate());

      if (dagenSindsLaatste > 120) {
        resultaten.push({
          id: "e-002-waarschuwing",
          regelId: "E-002",
          categorie: "energie",
          niveau: "waarschuwing",
          titel: `Meterstanden al ${dagenSindsLaatste} dagen niet bijgewerkt`,
          beschrijving: `De laatste meterstand dateert van ${naarDatumSleutel(nieuwste.opgenomenOp.toDate())}. Voer nieuwe standen in voor betrouwbare verbruiksinzichten.`,
          actieTekst: "Meterstanden invoeren",
          actieUrl: "/energie",
          invoerwaarden: {
            laatsteOpname: nieuwste.opgenomenOp.toDate().toISOString().slice(0, 10),
            drempelDagen: 120,
          },
        });
      } else if (dagenSindsLaatste > 60) {
        resultaten.push({
          id: "e-002-attentie",
          regelId: "E-002",
          categorie: "energie",
          niveau: "attentie",
          titel: "Tijd voor nieuwe meterstanden",
          beschrijving: `Het is ${dagenSindsLaatste} dagen geleden sinds je laatste meterstandopname.`,
          actieTekst: "Meterstand toevoegen",
          actieUrl: "/energie",
          invoerwaarden: {
            laatsteOpname: nieuwste.opgenomenOp.toDate().toISOString().slice(0, 10),
            drempelDagen: 60,
          },
        });
      }
    }
  }

  return resultaten;
}
