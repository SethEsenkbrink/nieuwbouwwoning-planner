import type { OpleverStatus } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De opleverband: van drie invoervelden naar drie opgeslagen datums
 *
 * De opleverdatum is een band met een staat, geen enkele waarde (ADR-0008,
 * principe 1). Het formulier toont afhankelijk van die staat één of drie
 * datumvelden, en de opslag krijgt er altijd drie. Die vertaling staat hier,
 * los van het scherm, om twee redenen:
 *
 * 1. Hij gebeurt op twee plekken — in de wizard en op de projectinstellingen —
 *    en moet daar identiek zijn. Een band die op het ene scherm anders
 *    dichtklapt dan op het andere levert stilletjes andere planning op.
 * 2. Er zit een regel in die fout kan gaan zonder dat iets klaagt: bij alles
 *    behalve `bandbreedte` vallen vroegst, verwacht en laatst samen. Doe je dat
 *    niet, dan blijft een oude bandbreedte staan onder een datum die inmiddels
 *    is aangezegd, en blijft de app een bereik tonen dat er niet meer is.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Opleverbandwaarden {
  status: OpleverStatus;
  verwacht: Date | undefined;
  vroegst: Date | undefined;
  laatst: Date | undefined;
  /** Vrije tekst: "mail aannemer 12-07". */
  bron: string;
}

export const LEGE_OPLEVERBAND: Opleverbandwaarden = {
  status: "indicatief",
  verwacht: undefined,
  vroegst: undefined,
  laatst: undefined,
  bron: "",
};

/** Wat er naar Firestore gaat. Alleen de opleververwante velden. */
export interface OpleverbandOpslag {
  opleverStatus: OpleverStatus;
  opleverVerwacht: Date;
  opleverVroegst: Date;
  opleverLaatst: Date;
  opleverBron?: string | undefined;
  opleverBronDatum?: Date | undefined;
}

/**
 * Controleert de invoer. Geeft `null` terug als alles klopt, anders een zin die
 * de gebruiker kan lezen.
 *
 * De volgorde-check bestond eerder niet: je kon een vroegste datum ná de laatste
 * invullen, en dan rekent `berekenDatum()` netjes een band uit die achterstevoren
 * loopt.
 */
export function controleerOpleverband(waarden: Opleverbandwaarden): string | null {
  if (!waarden.verwacht) return "Vul in ieder geval de verwachte opleverdatum in.";

  if (waarden.status === "bandbreedte") {
    if (waarden.vroegst && waarden.vroegst.getTime() > waarden.verwacht.getTime())
      return "De vroegste datum ligt na de verwachte datum.";
    if (waarden.laatst && waarden.laatst.getTime() < waarden.verwacht.getTime())
      return "De laatste datum ligt vóór de verwachte datum.";
    if (
      waarden.vroegst &&
      waarden.laatst &&
      waarden.vroegst.getTime() > waarden.laatst.getTime()
    )
      return "De vroegste datum ligt na de laatste datum.";
  }

  if (waarden.bron.trim().length > 300) return "De bron mag hooguit 300 tekens zijn.";

  return null;
}

/**
 * Zet de formulierwaarden om naar wat er opgeslagen wordt.
 *
 * Alleen bij `bandbreedte` blijven vroegst en laatst apart staan; in alle andere
 * gevallen vallen de drie datums samen en toont de UI één datum in plaats van
 * een bereik.
 *
 * Gooit als er geen verwachte datum is — roep eerst `controleerOpleverband` aan.
 */
export function naarOpslag(waarden: Opleverbandwaarden): OpleverbandOpslag {
  const verwacht = waarden.verwacht;
  if (!verwacht) throw new Error("Een opleverband zonder verwachte datum kan niet opgeslagen worden.");

  const isBand = waarden.status === "bandbreedte";
  const bron = waarden.bron.trim();

  return {
    opleverStatus: waarden.status,
    opleverVerwacht: verwacht,
    opleverVroegst: isBand ? (waarden.vroegst ?? verwacht) : verwacht,
    opleverLaatst: isBand ? (waarden.laatst ?? verwacht) : verwacht,
    opleverBron: bron === "" ? undefined : bron,
    // De bron zonder datum is half werk: je wilt bij de derde verschuiving zien
    // wanneer iemand wat beweerde, niet alleen wie.
    opleverBronDatum: bron === "" ? undefined : new Date(),
  };
}

/** Van een geladen project terug naar formulierwaarden. */
export function uitProject(project: {
  opleverStatus?: OpleverStatus | undefined;
  opleverVerwacht?: Date | undefined;
  opleverVroegst?: Date | undefined;
  opleverLaatst?: Date | undefined;
  opleverBron?: string | undefined;
}): Opleverbandwaarden {
  return {
    status: project.opleverStatus ?? "indicatief",
    verwacht: project.opleverVerwacht,
    vroegst: project.opleverVroegst,
    laatst: project.opleverLaatst,
    bron: project.opleverBron ?? "",
  };
}
