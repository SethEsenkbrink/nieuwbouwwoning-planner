import type { OnderdeelMetId, OnderhoudTaakMetId } from "@/lib/converters";
import { berekenVolgendeOnderhoud } from "@/lib/onderhoud";
import type { RegelContext, RegelResultaat } from "./types";

function naarDatumSleutel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function naarDatum(waarde: unknown): Date | undefined {
  if (!waarde) return undefined;
  if (typeof (waarde as { toDate?: () => Date }).toDate === "function") {
    return (waarde as { toDate: () => Date }).toDate();
  }
  if (waarde instanceof Date) {
    return waarde;
  }
  return undefined;
}

/**
 * Evalueert alle onderhoudstaken en signaleert achterstallig of binnenkort benodigd werk.
 */
export function evalueerOnderhoudRegels(context: RegelContext): RegelResultaat[] {
  const resultaten: RegelResultaat[] = [];
  const peildatum = context.peildatum ?? new Date();

  const opleverdatum =
    context.project.opleverVerwacht?.toDate() ??
    context.ankers?.find((a) => a.type === "oplevering")?.verwachtOp?.toDate();

  if (context.onderhoudstaken) {
    for (const taak of context.onderhoudstaken) {
      const gekoppeldOnderdeel = context.onderdelen?.find(
        (o) => o.id === taak.onderdeelId,
      );

      const laatstUitgevoerdOp = naarDatum(taak.laatstUitgevoerdOp);
      const onderdeelInstallatieDatum = naarDatum(gekoppeldOnderdeel?.installatieDatum);

      const taakInput: Pick<
        OnderhoudTaakMetId,
        "intervalDagen" | "voorkeursmaand" | "laatstUitgevoerdOp"
      > = {
        intervalDagen: taak.intervalDagen,
        laatstUitgevoerdOp,
      };
      if (taak.voorkeursmaand !== undefined) {
        taakInput.voorkeursmaand = taak.voorkeursmaand;
      }

      let onderdeelContext: Pick<OnderdeelMetId, "installatieDatum" | "garantieMaanden"> | undefined;
      if (gekoppeldOnderdeel) {
        onderdeelContext = {
          installatieDatum: onderdeelInstallatieDatum,
        };
        if (gekoppeldOnderdeel.garantieMaanden !== undefined) {
          onderdeelContext.garantieMaanden = gekoppeldOnderdeel.garantieMaanden;
        }
      }

      const stand = berekenVolgendeOnderhoud(
        taakInput,
        {
          onderdeel: onderdeelContext,
          opleverdatum,
        },
        peildatum,
      );

      if (stand) {
        if (stand.urgentie === "achterstallig") {
          const dagenTeLaat = Math.abs(stand.dagenResterend);
          resultaten.push({
            id: `o-001-achterstallig-${taak.id ?? taak.titel}`,
            regelId: "O-001",
            categorie: "onderhoud",
            niveau: "waarschuwing",
            titel: `Onderhoud achterstallig (${dagenTeLaat} ${dagenTeLaat === 1 ? "dag" : "dagen"}): ${taak.titel}`,
            beschrijving: `Volgende geplande beurt was op ${naarDatumSleutel(stand.volgendeOp)}. ${taak.waarschuwing ?? ""}`.trim(),
            deadlineDatum: naarDatumSleutel(stand.volgendeOp),
            referentieEntiteit: { type: "taak", id: taak.id ?? "" },
            actieTekst: "Afvinken in onderhoud",
            actieUrl: "/onderhoud",
          });
        } else if (stand.urgentie === "nu" || stand.urgentie === "binnenkort") {
          resultaten.push({
            id: `o-001-binnenkort-${taak.id ?? taak.titel}`,
            regelId: "O-001",
            categorie: "onderhoud",
            niveau: "attentie",
            titel: `Gepland onderhoud nadert (${stand.dagenResterend} ${stand.dagenResterend === 1 ? "dag" : "dagen"}): ${taak.titel}`,
            beschrijving: `Volgende beurt gepland op ${naarDatumSleutel(stand.volgendeOp)}. ${taak.waarschuwing ?? ""}`.trim(),
            deadlineDatum: naarDatumSleutel(stand.volgendeOp),
            referentieEntiteit: { type: "taak", id: taak.id ?? "" },
            actieTekst: "Bekijk taak",
            actieUrl: "/onderhoud",
          });
        }
      }
    }
  }

  return resultaten;
}
