import type { OnderdeelMetId } from "@/lib/converters";
import { overMaanden } from "@/lib/oplevering";
import { verschilInDagen } from "@/lib/planning";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Onderdelen — rekenen over het register (ADR-0013)
 *
 * Puur TypeScript: geen opslaglaag, geen React, geen `new Date()` die niet als
 * parameter binnenkomt.
 *
 * TWEE DINGEN WORDEN HIER AFGELEID EN NOOIT OPGESLAGEN (ADR-0008):
 *   1. de einddatum van de fabrieksgarantie — installatiedatum + maanden;
 *   2. of een registratieplicht nog openstaat — dat volgt uit `aangemeldOp`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Binnen hoeveel dagen een aflopende garantie de aandacht verdient. */
const BIJNA_VOORBIJ_DAGEN = 90;

export interface Garantieklok {
  verstrijktOp: Date;
  /** Negatief betekent: de garantie is voorbij. */
  dagenResterend: number;
  voorbij: boolean;
  /**
   * Loopt af binnen drie maanden. Dit is het moment waarop informatie geld
   * waard is: nog even laten nakijken vóórdat het je eigen rekening wordt.
   */
  bijnaVoorbij: boolean;
}

/**
 * `null` zonder installatiedatum of zonder garantietermijn. Een van beide
 * ontbreekt betekent dat er niets te berekenen valt — en een gegokte startdatum
 * levert een klok op die geruststelt zonder ergens op te slaan.
 */
export function berekenGarantieklok(
  onderdeel: Pick<OnderdeelMetId, "installatieDatum" | "garantieMaanden">,
  vandaag: Date,
): Garantieklok | null {
  const { installatieDatum, garantieMaanden } = onderdeel;
  if (!installatieDatum || garantieMaanden === undefined || garantieMaanden <= 0) return null;

  const verstrijktOp = overMaanden(installatieDatum, garantieMaanden);
  const dagenResterend = verschilInDagen(verstrijktOp, vandaag);

  return {
    verstrijktOp,
    dagenResterend,
    voorbij: dagenResterend < 0,
    bijnaVoorbij: dagenResterend >= 0 && dagenResterend <= BIJNA_VOORBIJ_DAGEN,
  };
}

/**
 * Staat er nog een registratieplicht open?
 *
 * Zolang `aangemeldOp` leeg is: ja. Hetzelfde patroon als `gecommuniceerdeDatum`
 * bij afspraken — het verschil tussen wat de app weet en wat de buitenwereld
 * weet is het werk dat er ligt.
 */
export function registratieOpenstaand(onderdeel: Pick<OnderdeelMetId, "registratieplicht">): boolean {
  const plicht = onderdeel.registratieplicht;
  return plicht !== undefined && plicht.aangemeldOp === undefined;
}

export function telOpenstaandeRegistraties(onderdelen: readonly OnderdeelMetId[]): number {
  return onderdelen.filter(registratieOpenstaand).length;
}

/**
 * Wat er straks in het overdrachtsdossier terechtkomt (E8) — en wat níét.
 *
 * De scheiding komt uit `blijftBijWoning` en niet uit `montage`, precies zoals
 * ADR-0013 §2 voorschrijft: een plug-in batterij kan bij de woning verkocht
 * worden en een vaste zonwering kan meegaan in de onderhandeling.
 */
export interface Overdrachtsstand {
  blijftAchter: number;
  verhuistMee: number;
}

export function telOverdracht(onderdelen: readonly OnderdeelMetId[]): Overdrachtsstand {
  let blijftAchter = 0;
  for (const onderdeel of onderdelen) if (onderdeel.blijftBijWoning) blijftAchter += 1;
  return { blijftAchter, verhuistMee: onderdelen.length - blijftAchter };
}

/**
 * Sorteervolgorde voor het register: eerst wat aandacht vraagt, dan de rest
 * alfabetisch binnen de categorie.
 *
 * De volgorde is bewust niet op categorie alleen. Een openstaande meldplicht
 * bij de netbeheerder heeft een consequentie — de netbeheerder mag je
 * teruglevering weigeren — en die hoort niet onderaan een alfabetische lijst
 * te verdwijnen.
 */
export type Onderdeelstand = "registratie_open" | "garantie_loopt_af" | "garantie_voorbij" | "normaal";

export function onderdeelstand(onderdeel: OnderdeelMetId, vandaag: Date): Onderdeelstand {
  if (registratieOpenstaand(onderdeel)) return "registratie_open";

  const klok = berekenGarantieklok(onderdeel, vandaag);
  if (klok?.bijnaVoorbij) return "garantie_loopt_af";
  if (klok?.voorbij) return "garantie_voorbij";
  return "normaal";
}

const VOLGORDE: Record<Onderdeelstand, number> = {
  registratie_open: 0,
  garantie_loopt_af: 1,
  normaal: 2,
  garantie_voorbij: 3,
};

export function sorteerOnderdelen(
  onderdelen: readonly OnderdeelMetId[],
  vandaag: Date,
): OnderdeelMetId[] {
  return [...onderdelen].sort((a, b) => {
    const opStand = VOLGORDE[onderdeelstand(a, vandaag)] - VOLGORDE[onderdeelstand(b, vandaag)];
    if (opStand !== 0) return opStand;

    const opCategorie = a.categorie.localeCompare(b.categorie, "nl");
    if (opCategorie !== 0) return opCategorie;

    return a.naam.localeCompare(b.naam, "nl");
  });
}

/**
 * De specs als geordende regels voor de UI.
 *
 * De volgorde volgt de bibliotheek, zodat "Vermogen" boven "Bouwjaar" staat en
 * niet alfabetisch ertussenuit valt. Eigen sleutels die niet in de bibliotheek
 * voorkomen komen erachteraan, alfabetisch.
 */
export function ordenSpecs(
  specs: Record<string, string> | undefined,
  volgorde: readonly string[],
): { sleutel: string; waarde: string }[] {
  if (!specs) return [];

  // `flatMap` in plaats van filter + map: dan hoeft de waarde niet gecast te
  // worden om `noUncheckedIndexedAccess` tevreden te stellen. De compiler leidt
  // uit de vroege `return []` af dat `waarde` hier een string is.
  const bekend = volgorde.flatMap((sleutel) => {
    const waarde = specs[sleutel];
    return waarde === undefined ? [] : [{ sleutel, waarde }];
  });

  // `Object.entries` levert de waarde meteen mee, dus ook hier geen cast.
  const rest = Object.entries(specs)
    .filter(([sleutel]) => !volgorde.includes(sleutel))
    .sort(([a], [b]) => a.localeCompare(b, "nl"))
    .map(([sleutel, waarde]) => ({ sleutel, waarde }));

  return [...bekend, ...rest];
}
