import type { Energielabel } from "@/types/model";

export const ENERGIELABEL_DISCLAIMER =
  "Let op: Dit energielabel is een indicatieve berekening op basis van je feitelijke meterstanden en gebruikersgedrag. Dit vervangt geen officieel NTA 8800 energielabel dat door een gecertificeerd EP-adviseur is opgenomen.";

export interface IndicatiefLabelResultaat {
  label: Energielabel;
  fossielEnergieKwhPerM2: number;
  totaalStroomKwh: number;
  totaalGasM3: number;
  woonoppervlakteM2: number;
  periodeDagen: number;
  disclaimer: string;
}

export interface SalderingParameters {
  jaar?: number;
  salderingsPercentage?: number; // 100% t/m 2026, daarna afbouwend
  stroomTariefPerKwh?: number; // bijv. € 0,35
  terugleverVergoedingPerKwh?: number; // bijv. € 0,08
  vasteTerugleverKostenPerKwh?: number; // bijv. € 0,05 (energiebedrijf toeslag)
}

export interface SalderingBerekening {
  jaar: number;
  brutoLeveringKwh: number;
  brutoTerugleveringKwh: number;
  gesaldeerdeKwh: number;
  nettoAfnameKwh: number;
  nettoTerugleveringKwh: number;
  kostenVóórSaldering: number;
  besparingSaldering: number;
  opbrengstTeruglevering: number;
  terugleverKosten: number;
  nettoKosten: number;
  salderingsPercentage: number;
}

/**
 * Berekent het wettelijk/indicatief salderingspercentage per kalenderjaar in Nederland.
 * - Tot en met 2026: 100%
 * - Vanaf 2027: afbouw conform wetsvoorstel (of instelbaar door de gebruiker)
 */
export function bepaalStandaardSalderingspercentage(jaar: number): number {
  if (jaar <= 2026) return 100;
  if (jaar === 2027) return 64;
  if (jaar === 2028) return 55;
  if (jaar === 2029) return 46;
  if (jaar === 2030) return 37;
  return 0; // Vanaf 2031 0%
}

/**
 * Berekent het indicatieve energielabel op basis van feitelijk verbruik per m² per jaar.
 * Omrekenfactoren:
 * - Gas: 1 m³ aardgas ≈ 9,77 kWh primaire fossiele energie
 * - Elektriciteit: 1 kWh netstroom ≈ 1,45 primaire energie
 */
export function berekenIndicatiefEnergielabel(
  stroomKwh: number,
  gasM3: number,
  woonoppervlakteM2: number,
  periodeDagen = 365,
): IndicatiefLabelResultaat {
  const m2 = Math.max(10, woonoppervlakteM2);
  const factorJaar = 365 / Math.max(1, periodeDagen);

  const stroomJaar = stroomKwh * factorJaar;
  const gasJaar = gasM3 * factorJaar;

  const fossielTotaalKwh = stroomJaar * 1.45 + gasJaar * 9.77;
  const fossielPerM2 = Math.round(fossielTotaalKwh / m2);

  let label: Energielabel;
  if (fossielPerM2 <= 0) label = "A++++";
  else if (fossielPerM2 <= 50) label = "A+++";
  else if (fossielPerM2 <= 75) label = "A++";
  else if (fossielPerM2 <= 100) label = "A+";
  else if (fossielPerM2 <= 160) label = "A";
  else if (fossielPerM2 <= 190) label = "B";
  else if (fossielPerM2 <= 250) label = "C";
  else if (fossielPerM2 <= 290) label = "D";
  else if (fossielPerM2 <= 335) label = "E";
  else if (fossielPerM2 <= 380) label = "F";
  else label = "G";

  return {
    label,
    fossielEnergieKwhPerM2: fossielPerM2,
    totaalStroomKwh: Math.round(stroomJaar),
    totaalGasM3: Math.round(gasJaar * 10) / 10,
    woonoppervlakteM2: m2,
    periodeDagen,
    disclaimer: ENERGIELABEL_DISCLAIMER,
  };
}

/**
 * Berekent de financiële uitkomst van zonnepanelen onder de (afbouwende) salderingsregeling.
 */
export function berekenSaldering(
  brutoLeveringKwh: number,
  brutoTerugleveringKwh: number,
  params: SalderingParameters = {},
): SalderingBerekening {
  const jaar = params.jaar ?? new Date().getFullYear();
  const salderingsPercentage =
    params.salderingsPercentage ?? bepaalStandaardSalderingspercentage(jaar);
  const stroomTarief = params.stroomTariefPerKwh ?? 0.35;
  const terugleverVergoeding = params.terugleverVergoedingPerKwh ?? 0.08;
  const terugleverKostenTarief = params.vasteTerugleverKostenPerKwh ?? 0.05;

  // Maximaal te salderen is het minimum van levering en teruglevering
  const maxTeSalderen = Math.min(brutoLeveringKwh, brutoTerugleveringKwh);
  const effectiefGesaldeerd = maxTeSalderen * (salderingsPercentage / 100);

  const nettoAfnameKwh = Math.max(0, brutoLeveringKwh - effectiefGesaldeerd);
  const nietGesaldeerdeTeruglevering = Math.max(0, brutoTerugleveringKwh - effectiefGesaldeerd);

  const kostenVóórSaldering = brutoLeveringKwh * stroomTarief;
  const besparingSaldering = effectiefGesaldeerd * stroomTarief;
  const opbrengstTeruglevering = nietGesaldeerdeTeruglevering * terugleverVergoeding;
  const terugleverKosten = brutoTerugleveringKwh * terugleverKostenTarief;

  const nettoKosten = nettoAfnameKwh * stroomTarief - opbrengstTeruglevering + terugleverKosten;

  return {
    jaar,
    brutoLeveringKwh,
    brutoTerugleveringKwh,
    gesaldeerdeKwh: Math.round(effectiefGesaldeerd),
    nettoAfnameKwh: Math.round(nettoAfnameKwh),
    nettoTerugleveringKwh: Math.round(nietGesaldeerdeTeruglevering),
    kostenVóórSaldering: Math.round(kostenVóórSaldering * 100) / 100,
    besparingSaldering: Math.round(besparingSaldering * 100) / 100,
    opbrengstTeruglevering: Math.round(opbrengstTeruglevering * 100) / 100,
    terugleverKosten: Math.round(terugleverKosten * 100) / 100,
    nettoKosten: Math.round(nettoKosten * 100) / 100,
    salderingsPercentage,
  };
}
