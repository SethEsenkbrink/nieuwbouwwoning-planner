/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Bedragen lezen en tonen — één plek voor al het geld in de app
 *
 * Tot 2 augustus 2026 stond hier alleen `toonBedrag()`. Het lézen van een
 * bedrag stond zes keer gekopieerd in de routes, en zes keer half:
 *
 *     const schoon = tekst.trim().replace(/[.\s]/g, "");
 *
 * Die opschoning haalt de punt weg maar laat de komma staan, waardoor
 * `Number("1250,50")` NaN geeft en de gebruiker te horen krijgt dat hij een
 * getal moet invullen — terwijl hij dat net deed. Bij een depottermijn of een
 * meerwerkpost is een bedrag met centen de normaalste zaak, dus dit trof
 * precies de velden waar het het meest opviel. Zie BUG-01 in
 * `docs/2026-08-01-bevindingen-live-test.md`.
 *
 * DEZELFDE FOUTKLASSE ALS `leesStandInvoer()` IN E7, en om dezelfde reden
 * opgelost: één functie met tests, in plaats van zes kopieën die uit elkaar
 * lopen zodra iemand er één repareert.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Leest een ingetypt bedrag en geeft hele euro's terug.
 *
 * Drie Nederlandse gewoontes moeten eruit vóórdat `Number()` het ziet:
 *
 *   1. het euroteken, want het veld toont dat zelf al — wie het toch intypt
 *      hoort geen foutmelding te krijgen voor iets wat er al staat;
 *   2. de komma als decimaalteken (`1250,50`);
 *   3. de punt als duizendtalscheiding (`1.250`).
 *
 * Punt nummer drie is de gevaarlijke: zonder die behandeling wordt `"1.250"`
 * stilzwijgend 1,25 en dus na afronding **één euro**. Dat is een factor 1000
 * mis in een bedrag dat er verder plausibel uitziet. Een punt telt daarom
 * alleen als duizendtalscheiding wanneer er precies drie cijfers achter staan;
 * in `"1.25"` blijft hij een decimaalteken.
 *
 * AFRONDEN OP HELE EURO'S IS EEN BEWUSTE KEUZE (Seth, 2 augustus 2026): de app
 * is een planner en geen boekhouding, en `toonBedrag()` rondde al af. Zou je
 * de centen wél bewaren maar afgerond tonen, dan klopt de som van de getoonde
 * posten niet met het getoonde totaal — een verschil dat niemand kan verklaren
 * omdat de centen nergens zichtbaar zijn.
 *
 * `undefined` bij alles wat geen bruikbaar, niet-negatief bedrag is. De UI
 * toont dan een foutmelding in plaats van iets op te slaan.
 */
export function leesBedragInvoer(tekst: string): number | undefined {
  const opgeschoond = tekst
    // Euroteken en witruimte eruit. `\s` dekt ook de harde spatie (U+00A0)
    // die uit een gekopieerd bedrag meekomt; die staat hier bewust niet als
    // los teken in de class, want een onzichtbaar karakter in de broncode is
    // precies wat een latere lezer per ongeluk weghaalt.
    .replace(/[€\s]/g, "")
    // Een punt met precies drie cijfers erachter is een duizendtalscheiding.
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  if (!/^\d+(\.\d+)?$/.test(opgeschoond)) return undefined;

  const waarde = Number(opgeschoond);
  if (!Number.isFinite(waarde) || waarde < 0) return undefined;

  return Math.round(waarde);
}

/**
 * Het bedrag zoals het in een invoerveld hoort te staan: met duizendtalpunten,
 * zonder euroteken — dat staat al vast in het veld zelf.
 *
 * Wordt gebruikt zodra je het veld verlaat. Je typt `1250,50` en ziet `1.251`
 * terugkomen; dat is de bevestiging dat het bedrag geland is én dat er is
 * afgerond. Zonder die terugkoppeling weet je pas bij het opslaan wat de app
 * ervan gemaakt heeft.
 */
export function toonBedragInvoer(bedrag: number | undefined): string {
  if (bedrag === undefined) return "";
  return Math.round(bedrag).toLocaleString("nl-NL");
}

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
