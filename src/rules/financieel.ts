import type { RegelContext, RegelResultaat } from "./types";

function naarMaandenVerschil(datumA: Date, datumB: Date): number {
  return (
    (datumA.getFullYear() - datumB.getFullYear()) * 12 +
    (datumA.getMonth() - datumB.getMonth())
  );
}

function voegMaandenToe(datum: Date, maanden: number): Date {
  const d = new Date(datum.getTime());
  d.setMonth(d.getMonth() + maanden);
  return d;
}

function naarDatumSleutel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Evalueert financiële regels (bouwdepot, meerwerkbudget, termijnbetalingen).
 */
export function evalueerFinancieleRegels(context: RegelContext): RegelResultaat[] {
  const resultaten: RegelResultaat[] = [];
  const peildatum = context.peildatum ?? new Date();

  // ── F-001: Bouwdepot looptijd (24-maandenklok) ────────────────────────────
  const passeerdatum = context.project.hypotheek?.passeerdatum?.toDate();
  if (passeerdatum) {
    const vervalDatum = voegMaandenToe(passeerdatum, 24);
    const maandenResterend = naarMaandenVerschil(vervalDatum, peildatum);

    if (maandenResterend < 0) {
      resultaten.push({
        id: "f-001-verstreken",
        regelId: "F-001",
        categorie: "financieel",
        niveau: "urgent",
        titel: "Standaard looptijd bouwdepot (2 jaar) is verstreken",
        beschrijving:
          "De 24 maanden van je bouwdepot zijn voorbij. Controleer bij de geldverstrekker of het depot verlengd moet worden of dat het restant verrekend wordt met de hypotheek.",
        deadlineDatum: naarDatumSleutel(vervalDatum),
        actieTekst: "Bekijk bouwdepot",
        actieUrl: "/bouwdepot",
        invoerwaarden: {
          passeerdatum: passeerdatum.toISOString().slice(0, 10),
          vervaldatum: vervalDatum.toISOString().slice(0, 10),
          looptijdMaanden: 24,
        },
      });
    } else if (maandenResterend <= 1) {
      resultaten.push({
        id: "f-001-urgent",
        regelId: "F-001",
        categorie: "financieel",
        niveau: "waarschuwing",
        titel: "Bouwdepot verloopt binnen 1 maand",
        beschrijving:
          "De maximale standaard looptijd van 24 maanden nadert op " +
          naarDatumSleutel(vervalDatum) +
          ". Dien tijdig je laatste declaraties in of vraag verlenging aan.",
        deadlineDatum: naarDatumSleutel(vervalDatum),
        actieTekst: "Bekijk bouwdepot",
        actieUrl: "/bouwdepot",
        invoerwaarden: {
          passeerdatum: passeerdatum.toISOString().slice(0, 10),
          vervaldatum: vervalDatum.toISOString().slice(0, 10),
          looptijdMaanden: 24,
        },
      });
    } else if (maandenResterend <= 6) {
      resultaten.push({
        id: "f-001-attentie",
        regelId: "F-001",
        categorie: "financieel",
        niveau: "attentie",
        titel: "Bouwdepot looptijd nadert 18 maanden",
        beschrijving:
          "Je bouwdepot loopt over " +
          maandenResterend +
          " maanden af. Houd rekening met de geldigheid van declaraties.",
        deadlineDatum: naarDatumSleutel(vervalDatum),
        actieTekst: "Bekijk bouwdepot",
        actieUrl: "/bouwdepot",
        invoerwaarden: {
          passeerdatum: passeerdatum.toISOString().slice(0, 10),
          vervaldatum: vervalDatum.toISOString().slice(0, 10),
          looptijdMaanden: 24,
        },
      });
    }
  }

  // ── F-002: Meerwerkbudget overschrijding ──────────────────────────────────
  const budget = context.project.meerwerkbudget;
  if (budget && budget > 0 && context.meerwerk) {
    let totaalActief = 0;
    for (const item of context.meerwerk) {
      if (item.status === "besteld" || item.status === "bevestigd") {
        const bedrag = item.bedrag ?? 0;
        totaalActief += bedrag;
      }
    }

    if (totaalActief > budget) {
      const overschrijding = totaalActief - budget;
      resultaten.push({
        id: "f-002-overschreden",
        regelId: "F-002",
        niveau: "waarschuwing",
        categorie: "financieel",
        titel: `Meerwerk overschrijdt budget met € ${overschrijding.toLocaleString("nl-NL")}`,
        beschrijving: `Totale meerwerkkeuzes bedragen € ${totaalActief.toLocaleString("nl-NL")} tegenover een budget van € ${budget.toLocaleString("nl-NL")}.`,
        actieTekst: "Bekijk meerwerkoverzicht",
        actieUrl: "/meerwerk",
        invoerwaarden: {
          overschrijding,
          meerwerkbudget: budget,
          totaalActief,
        },
      });
    } else if (totaalActief >= 0.9 * budget) {
      resultaten.push({
        id: "f-002-bijna-vol",
        regelId: "F-002",
        categorie: "financieel",
        niveau: "attentie",
        titel: "Meerwerk nadert budget (90%+ verbruikt)",
        beschrijving: `Er is € ${totaalActief.toLocaleString("nl-NL")} van het budget van € ${budget.toLocaleString("nl-NL")} vastgelegd.`,
        actieTekst: "Bekijk meerwerk",
        actieUrl: "/meerwerk",
        invoerwaarden: {
          meerwerkbudget: budget,
          totaalActief,
        },
      });
    }
  }

  // ── F-003: Openstaande vervallen bouwtermijnen ────────────────────────────
  if (context.termijnen) {
    for (const termijn of context.termijnen) {
      if (termijn.gefactureerd && !termijn.betaald) {
        resultaten.push({
          id: `f-003-open-${termijn.id ?? termijn.omschrijving}`,
          regelId: "F-003",
          categorie: "financieel",
          niveau: "waarschuwing",
          titel: `Bouwtermijn gefactureerd: ${termijn.omschrijving}`,
          beschrijving: `Deze termijn van € ${(termijn.bedrag ?? 0).toLocaleString("nl-NL")} is door de aannemer gefactureerd en dient via het bouwdepot gedeclareerd/betaald te worden.`,
          referentieEntiteit: { type: "termijn", id: termijn.id ?? "" },
          actieTekst: "Declareer termijn",
          actieUrl: "/bouwdepot",
          invoerwaarden: {
            termijnId: termijn.id ?? termijn.omschrijving,
            bedrag: termijn.bedrag ?? 0,
            gefactureerd: true,
            betaald: false,
          },
        });
      }
    }
  }

  return resultaten;
}
