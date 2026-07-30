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
