import type { RegelContext, RegelResultaat } from "./types";

function naarDagenVerschil(datumA: Date, datumB: Date): number {
  const msDag = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(datumA.getFullYear(), datumA.getMonth(), datumA.getDate());
  const utc2 = Date.UTC(datumB.getFullYear(), datumB.getMonth(), datumB.getDate());
  return Math.floor((utc1 - utc2) / msDag);
}

function voegJarenToe(datum: Date, jaren: number): Date {
  const d = new Date(datum.getTime());
  d.setFullYear(d.getFullYear() + jaren);
  return d;
}

function naarDatumSleutel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Evalueert garantietermijnen en signaleert naderende vervaldata (bijv. voor eindinspectie).
 */
export function evalueerGarantieRegels(context: RegelContext): RegelResultaat[] {
  const resultaten: RegelResultaat[] = [];
  const peildatum = context.peildatum ?? new Date();

  // 1. Evalueer expliciete garantie-items
  if (context.garanties) {
    for (const garantie of context.garanties) {
      if (garantie.ingangsdatum && garantie.looptijdJaren > 0) {
        const ingang = garantie.ingangsdatum.toDate();
        const vervaldatum = voegJarenToe(ingang, garantie.looptijdJaren);
        const resterendeDagen = naarDagenVerschil(vervaldatum, peildatum);

        if (resterendeDagen >= 0 && resterendeDagen <= 14) {
          resultaten.push({
            id: `g-001-urgent-${garantie.id ?? garantie.titel}`,
            regelId: "G-001",
            categorie: "garantie",
            niveau: "waarschuwing",
            titel: `Garantie verloopt over ${resterendeDagen} ${resterendeDagen === 1 ? "dag" : "dagen"}: ${garantie.titel}`,
            beschrijving: `De garantieperiode van ${garantie.looptijdJaren} jaar voor '${garantie.titel}' eindigt op ${naarDatumSleutel(vervaldatum)}. Controleer op verborgen gebreken.`,
            deadlineDatum: naarDatumSleutel(vervaldatum),
            referentieEntiteit: { type: "onderdeel", id: garantie.id ?? "" },
            actieTekst: "Controleer onderdeel",
            actieUrl: "/woning",
          });
        } else if (resterendeDagen > 14 && resterendeDagen <= 60) {
          resultaten.push({
            id: `g-001-attentie-${garantie.id ?? garantie.titel}`,
            regelId: "G-001",
            categorie: "garantie",
            niveau: "attentie",
            titel: `Garantie vervaldatum nadert: ${garantie.titel}`,
            beschrijving: `Nog ${resterendeDagen} dagen garantie (${naarDatumSleutel(vervaldatum)}). Plan eventueel een inspectie in.`,
            deadlineDatum: naarDatumSleutel(vervaldatum),
            referentieEntiteit: { type: "onderdeel", id: garantie.id ?? "" },
            actieTekst: "Bekijk garantie",
            actieUrl: "/woning",
          });
        }
      }
    }
  }

  // 2. Evalueer onderdelen met fabrieksgarantie in maanden
  if (context.onderdelen) {
    for (const onderdeel of context.onderdelen) {
      if (onderdeel.installatieDatum && onderdeel.garantieMaanden && onderdeel.garantieMaanden > 0) {
        const installatie = onderdeel.installatieDatum.toDate();
        const vervaldatum = new Date(installatie.getTime());
        vervaldatum.setMonth(vervaldatum.getMonth() + onderdeel.garantieMaanden);
        const resterendeDagen = naarDagenVerschil(vervaldatum, peildatum);

        if (resterendeDagen >= 0 && resterendeDagen <= 30) {
          resultaten.push({
            id: `g-002-onderdeel-${onderdeel.id ?? onderdeel.naam}`,
            regelId: "G-002",
            categorie: "garantie",
            niveau: resterendeDagen <= 7 ? "waarschuwing" : "attentie",
            titel: `Installatiegarantie verloopt binnenkort: ${onderdeel.naam}`,
            beschrijving: `Fabrieksgarantie van ${onderdeel.garantieMaanden} maanden eindigt op ${naarDatumSleutel(vervaldatum)}.`,
            deadlineDatum: naarDatumSleutel(vervaldatum),
            referentieEntiteit: { type: "onderdeel", id: onderdeel.id ?? "" },
            actieTekst: "Bekijk onderdeel",
            actieUrl: "/onderdelen",
          });
        }
      }
    }
  }

  return resultaten;
}
