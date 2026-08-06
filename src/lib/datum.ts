/**
 * Datumweergave voor de UI.
 *
 * Staat los van `Datumveld.tsx` omdat een bestand dat naast componenten ook
 * functies exporteert Fast Refresh breekt: React kan dan niet meer zien of een
 * wijziging de component raakt of niet, en herlaadt de hele pagina.
 *
 * ALLES HIER LEEST IN UTC. De app slaat datums op als UTC-middernacht (zie
 * `src/lib/planning.ts`); ze in lokale tijd formatteren zou ze in de zomertijd
 * een dag terugzetten — 16 november wordt dan 15 november.
 */

/** Bijvoorbeeld "16 nov 2026". */
export function toonDatum(datum: Date | undefined): string {
  if (!datum) return "—";
  return datum.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Voor `<input type="date">`, dat "2026-11-16" verwacht. */
export function alsInvoerwaarde(datum: Date | undefined): string {
  return datum ? datum.toISOString().slice(0, 10) : "";
}

/**
 * Leest de waarde van een `<input type="date">` terug als UTC-middernacht.
 * `new Date("2026-11-16")` doet dit al, maar de expliciete tijd maakt duidelijk
 * dat het geen toeval is.
 */
export function uitInvoerwaarde(tekst: string): Date | undefined {
  return tekst === "" ? undefined : new Date(`${tekst}T00:00:00.000Z`);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Vandaag — de lokale dag, op UTC-middernacht (BUG-03)
 *
 * Overal in de app stond `opDag(new Date())` als definitie van "vandaag".
 * Maar `opDag()` leest de datumdelen met `getUTC*`, en in de Nederlandse zomertijd
 * (UTC+2) is het tussen 00:00 en 02:00 lokaal in UTC nog de vórige dag. Wie op
 * 2 augustus om 01:30 het dashboard opende, kreeg de urgenties van 1 augustus.
 *
 * HIER STAAN DE GETTERS DUS BEWUST ZONDER `UTC`: `getFullYear()` in plaats van
 * `getUTCFullYear()`. We willen de dag zoals de gebruiker hem op zijn klok
 * ziet, en zetten díé op UTC-middernacht — het formaat waarin de rest van de
 * app rekent en opslaat.
 *
 * `opDag()` in `planning.ts` blijft ongewijzigd en houdt zijn eigen taak: een
 * reeds opgeslagen UTC-datum klemmen. Die functie mag geen tijdzone kennen,
 * want `planning.ts` is puur (ADR-0008).
 *
 * `nu` is een parameter zodat dit te testen valt zonder de systeemklok te
 * verzetten. Roep hem in de app altijd zonder argument aan.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function vandaag(nu: Date = new Date()): Date {
  return new Date(Date.UTC(nu.getFullYear(), nu.getMonth(), nu.getDate()));
}

const MS_PER_DAG = 86_400_000;

/**
 * Hoe ver weg een datum ligt, in gewone taal: "over 12 weken", "morgen",
 * "3 dagen te laat".
 *
 * WAAROM DIT BESTAAT. Uit de live test van 2 augustus: *"datums die mij niks
 * zeggen."* Op het dashboard stond veertien keer een kale datum als
 * "21 okt 2026". Dat is een feit, geen informatie — je moet zelf uitrekenen of
 * dat ver weg is of morgen, en dat doe je bij de veertiende regel niet meer.
 *
 * De schaal loopt mee met hoe mensen over tijd praten: dichtbij tellen we in
 * dagen, verder weg in weken, en voorbij een half jaar in maanden. Precisie
 * die niemand gebruikt is ruis — "over 37 weken" zegt minder dan "over 8
 * maanden".
 */
export function toonAfstand(datum: Date | undefined, nu: Date = vandaag()): string {
  if (!datum) return "—";

  const dagen = Math.round((datum.getTime() - nu.getTime()) / MS_PER_DAG);

  if (dagen === 0) return "vandaag";
  if (dagen === 1) return "morgen";
  if (dagen === -1) return "gisteren";

  if (dagen < 0) {
    const over = -dagen;
    if (over < 14) return `${String(over)} dagen te laat`;
    if (over < 70) return `${String(Math.round(over / 7))} weken te laat`;
    return `${String(Math.round(over / 30))} maanden te laat`;
  }

  if (dagen < 14) return `over ${String(dagen)} dagen`;
  if (dagen < 180) return `over ${String(Math.round(dagen / 7))} weken`;
  return `over ${String(Math.round(dagen / 30))} maanden`;
}

/**
 * De afstand mét de datum erachter: "over 12 weken — 28 okt 2026".
 *
 * Deze volgorde is de hele wijziging. Eerst wat je wilt weten (hoe dringend),
 * dan het feit dat je nodig hebt zodra je gaat handelen (welke dag). Andersom
 * lees je veertien keer een datum voordat je bij de eerste bruikbare regel
 * bent.
 */
export function toonDatumMetAfstand(datum: Date | undefined, nu: Date = vandaag()): string {
  if (!datum) return "—";
  return `${toonAfstand(datum, nu)} — ${toonDatum(datum)}`;
}
