import type { BetrokkeneData } from "@/lib/converters";

/**
 * Regels rond betrokkenen die niets met opslag te maken hebben.
 *
 * Staat los van `projecten.ts` omdat dat bestand de Firebase-SDK laadt, en die
 * eist bij het importeren al een geldige configuratie. Alles wat hier staat is
 * te testen met gewone invoer en uitvoer — geen emulator, geen mocks.
 */

type TermijnVelden = Pick<
  BetrokkeneData,
  "aanlooptijdDagen" | "annuleertermijnDagen" | "waardenBron"
>;

/**
 * Bepaalt of de termijnen van een betrokkene nog een voorstel van de app zijn,
 * of inmiddels een eigen cijfer van de gebruiker (ADR-0009).
 *
 * De regel: zodra de gebruiker de aanlooptijd of de annuleertermijn aanpast,
 * zijn het zijn getallen en verdwijnt de disclaimer. Andere velden tellen niet
 * mee — een ingevuld e-mailadres maakt een geschatte aanlooptijd niet ineens
 * betrouwbaar.
 *
 * Eenmaal "eigen" blijft "eigen". Terugvallen naar "voorstel" zou betekenen dat
 * de app de gebruiker vertelt dat zijn eigen cijfer een schatting is.
 */
export function bepaalWaardenBron(
  huidig: TermijnVelden,
  wijzigingen: Partial<BetrokkeneData>,
): BetrokkeneData["waardenBron"] {
  if (huidig.waardenBron === "eigen") return "eigen";

  const aanlooptijdGewijzigd =
    wijzigingen.aanlooptijdDagen !== undefined &&
    wijzigingen.aanlooptijdDagen !== huidig.aanlooptijdDagen;

  const annuleertermijnGewijzigd =
    wijzigingen.annuleertermijnDagen !== undefined &&
    wijzigingen.annuleertermijnDagen !== huidig.annuleertermijnDagen;

  return aanlooptijdGewijzigd || annuleertermijnGewijzigd ? "eigen" : "voorstel";
}
