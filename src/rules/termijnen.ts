import type { RegelContext, RegelResultaat } from "./types";

function naarDagenVerschil(datumA: Date, datumB: Date): number {
  const msDag = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(datumA.getFullYear(), datumA.getMonth(), datumA.getDate());
  const utc2 = Date.UTC(datumB.getFullYear(), datumB.getMonth(), datumB.getDate());
  return Math.floor((utc1 - utc2) / msDag);
}

function voegDagenToe(datum: Date, dagen: number): Date {
  const d = new Date(datum.getTime());
  d.setDate(d.getDate() + dagen);
  return d;
}

function naarDatumSleutel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Evalueert alle wettelijke en contractuele termijnregels.
 */
export function evalueerTermijnRegels(context: RegelContext): RegelResultaat[] {
  const resultaten: RegelResultaat[] = [];
  const peildatum = context.peildatum ?? new Date();

  // ── T-001: 5%-depot onderhoudstermijn (3 maanden na oplevering) ───────────
  const oplevering =
    context.project.opleverVerwacht?.toDate() ??
    context.ankers?.find((a) => a.type === "oplevering")?.verwachtOp?.toDate();

  if (oplevering) {
    const vervalDatum = voegDagenToe(oplevering, 90); // 3 maanden norm
    const resterendeDagen = naarDagenVerschil(vervalDatum, peildatum);

    if (resterendeDagen >= 0 && resterendeDagen <= 7) {
      resultaten.push({
        id: "t-001-urgent",
        regelId: "T-001",
        categorie: "termijnen",
        niveau: "waarschuwing",
        titel: "5%-depot verloopt over minder dan 7 dagen",
        beschrijving:
          "Drie maanden na oplevering keert de notaris het 5%-depot automatisch uit aan de aannemer, tenzij je tijdig meldt dat er nog openstaande gebreken zijn.",
        deadlineDatum: naarDatumSleutel(vervalDatum),
        actieTekst: "Bekijk opschortingsstatus",
        actieUrl: "/oplevering",
        invoerwaarden: {
          opleverdatum: naarDatumSleutel(oplevering),
          vervaldatum: naarDatumSleutel(vervalDatum),
          termijnDagen: 90,
        },
      });
    } else if (resterendeDagen > 7 && resterendeDagen <= 30) {
      resultaten.push({
        id: "t-001-attentie",
        regelId: "T-001",
        categorie: "termijnen",
        niveau: "attentie",
        titel: "5%-depot vervaldatum nadert",
        beschrijving: `Over ${resterendeDagen} dagen verloopt de 3-maandstermijn voor het 5%-opschortingsrecht bij de notaris.`,
        deadlineDatum: naarDatumSleutel(vervalDatum),
        actieTekst: "Controleer gebrekenlijst",
        actieUrl: "/oplevering",
        invoerwaarden: {
          opleverdatum: naarDatumSleutel(oplevering),
          vervaldatum: naarDatumSleutel(vervalDatum),
          termijnDagen: 90,
        },
      });
    } else if (resterendeDagen < 0 && (context.project.opschortingStatus === "in_depot" || (context.project.opschortingBedrag ?? 0) > 0)) {
      resultaten.push({
        id: "t-001-verstreken",
        regelId: "T-001",
        categorie: "termijnen",
        niveau: "urgent",
        titel: "5%-depot termijn is verstreken",
        beschrijving:
          "De 3 maanden onderhoudstermijn is verstreken. Controleer of de notaris het depot heeft vrijgegeven of dat er nog herstelwerkzaamheden lopen.",
        deadlineDatum: naarDatumSleutel(vervalDatum),
        actieTekst: "Bekijk opleverstatus",
        actieUrl: "/oplevering",
        invoerwaarden: {
          opleverdatum: naarDatumSleutel(oplevering),
          vervaldatum: naarDatumSleutel(vervalDatum),
          termijnDagen: 90,
        },
      });
    }
  }

  // ── T-002: Hersteltermijn gebreken (PV van oplevering) ────────────────────
  if (context.gebreken) {
    for (const gebrek of context.gebreken) {
      if (gebrek.status === "open" && gebrek.gemeldOp) {
        const gemeldDatum = gebrek.gemeldOp.toDate();
        const verstrekenDagen = naarDagenVerschil(peildatum, gemeldDatum);

        if (verstrekenDagen > 90) {
          resultaten.push({
            id: `t-002-urgent-${gebrek.id ?? gebrek.omschrijving}`,
            regelId: "T-002",
            categorie: "termijnen",
            niveau: "urgent",
            titel: `Gebrek staat al >90 dagen open: ${gebrek.omschrijving}`,
            beschrijving: `Dit gebrek is ${verstrekenDagen} dagen geleden gemeld en nog niet hersteld. Tijd voor een schriftelijke ingebrekestelling.`,
            referentieEntiteit: { type: "gebrek", id: gebrek.id ?? "" },
            actieTekst: "Bekijk gebrek",
            actieUrl: "/oplevering",
            invoerwaarden: {
              gebrekId: gebrek.id ?? "onbekend",
              gemeldOp: naarDatumSleutel(gemeldDatum),
              status: gebrek.status,
            },
          });
        } else if (verstrekenDagen > 30) {
          resultaten.push({
            id: `t-002-waarschuwing-${gebrek.id ?? gebrek.omschrijving}`,
            regelId: "T-002",
            categorie: "termijnen",
            niveau: "waarschuwing",
            titel: `Hersteltermijn gebrek overschreden: ${gebrek.omschrijving}`,
            beschrijving: `Gebrek staat ${verstrekenDagen} dagen open zonder herstel. De gebruikelijke hersteltermijn is 30 dagen.`,
            referentieEntiteit: { type: "gebrek", id: gebrek.id ?? "" },
            actieTekst: "Herinnering sturen",
            actieUrl: "/oplevering",
            invoerwaarden: {
              gebrekId: gebrek.id ?? "onbekend",
              gemeldOp: naarDatumSleutel(gemeldDatum),
              status: gebrek.status,
            },
          });
        }
      }
    }
  }

  // ── T-003: Meerwerk sluitingstermijnen ────────────────────────────────────
  if (context.meerwerk) {
    for (const item of context.meerwerk) {
      if (item.status === "overweeg" && item.sluitingsdatum) {
        const sluiting = item.sluitingsdatum.toDate();
        const dagenTotSluiting = naarDagenVerschil(sluiting, peildatum);

        if (dagenTotSluiting < 0) {
          resultaten.push({
            id: `t-003-verstreken-${item.id ?? item.omschrijving}`,
            regelId: "T-003",
            categorie: "termijnen",
            niveau: "urgent",
            titel: `Sluitingsdatum meerwerk verstreken: ${item.omschrijving}`,
            beschrijving: `De deadline voor deze optie (${naarDatumSleutel(sluiting)}) is voorbij. Neem contact op met de aannemer of dit nog kan.`,
            deadlineDatum: naarDatumSleutel(sluiting),
            referentieEntiteit: { type: "meerwerk", id: item.id ?? "" },
            actieTekst: "Bekijk meerwerkoptie",
            actieUrl: "/meerwerk",
            invoerwaarden: {
              meerwerkId: item.id ?? "onbekend",
              sluitingsdatum: naarDatumSleutel(sluiting),
            },
          });
        } else if (dagenTotSluiting <= 3) {
          resultaten.push({
            id: `t-003-urgent-${item.id ?? item.omschrijving}`,
            regelId: "T-003",
            categorie: "termijnen",
            niveau: "waarschuwing",
            titel: `Meerwerkoptie sluit bijna (${dagenTotSluiting} ${dagenTotSluiting === 1 ? "dag" : "dagen"}): ${item.omschrijving}`,
            beschrijving: `Je hebt nog maar ${dagenTotSluiting} ${dagenTotSluiting === 1 ? "dag" : "dagen"} om de knoop door te hakken voor ${item.omschrijving}.`,
            deadlineDatum: naarDatumSleutel(sluiting),
            referentieEntiteit: { type: "meerwerk", id: item.id ?? "" },
            actieTekst: "Keuze doorgeven",
            actieUrl: "/meerwerk",
            invoerwaarden: {
              meerwerkId: item.id ?? "onbekend",
              sluitingsdatum: naarDatumSleutel(sluiting),
            },
          });
        } else if (dagenTotSluiting <= 14) {
          resultaten.push({
            id: `t-003-attentie-${item.id ?? item.omschrijving}`,
            regelId: "T-003",
            categorie: "termijnen",
            niveau: "attentie",
            titel: `Sluitingsdatum meerwerk nadert: ${item.omschrijving}`,
            beschrijving: `Nog ${dagenTotSluiting} dagen tot sluiting (${naarDatumSleutel(sluiting)}).`,
            deadlineDatum: naarDatumSleutel(sluiting),
            referentieEntiteit: { type: "meerwerk", id: item.id ?? "" },
            actieTekst: "Bekijk meerwerk",
            actieUrl: "/meerwerk",
            invoerwaarden: {
              meerwerkId: item.id ?? "onbekend",
              sluitingsdatum: naarDatumSleutel(sluiting),
            },
          });
        }
      }
    }
  }

  return resultaten;
}
