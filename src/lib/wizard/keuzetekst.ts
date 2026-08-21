/**
 * Telwoord onder een keuzelijst in de wizard: "3 van de 14 partijen gekozen".
 *
 * Staat los van `components/wizard/Keuzelijst.tsx` omdat een bestand dat naast
 * componenten ook functies exporteert Fast Refresh breekt — React kan dan niet
 * bepalen of een wijziging de component raakt en herlaadt de hele pagina.
 * Zelfde reden als bij `lib/projectgegevens.ts`.
 */
export function keuzeSamenvatting(
  gekozen: number,
  totaal: number,
  enkelvoud: string,
  meervoud: string,
): string {
  if (gekozen === 0) {
    return "Niets gekozen — je kunt dit later vanuit het dashboard aanvullen.";
  }
  const woord = gekozen === 1 ? enkelvoud : meervoud;
  return `${String(gekozen)} van de ${String(totaal)} ${woord} gekozen.`;
}
