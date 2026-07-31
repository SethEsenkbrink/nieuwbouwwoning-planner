/**
 * Bedragen tonen. Eén plek, zodat "€ 1.250" er overal hetzelfde uitziet.
 *
 * Alles in hele euro's: bij een koopsom van drie ton zijn centen ruis, en de
 * app is geen boekhouding. `undefined` wordt een streepje in plaats van "€ 0" —
 * "niets ingevuld" en "nul euro" zijn niet hetzelfde, en dat verschil telt bij
 * een budgetoverzicht.
 */
export function toonBedrag(bedrag: number | undefined): string {
  if (bedrag === undefined) return "—";
  return `€ ${Math.round(bedrag).toLocaleString("nl-NL")}`;
}
