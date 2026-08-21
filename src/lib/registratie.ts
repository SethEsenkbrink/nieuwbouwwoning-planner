/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Welk scherm de registratie moet tonen
 *
 * DE BUG DIE HIERONDER LIGT. `/registreren` stond in `App.tsx` binnen
 * `AlleenVergrendeld`: is de kluis ontgrendeld, dan stuurt die je naar `/`.
 * Dat klinkt logisch — een ontgrendelde kluis heeft geen aanmaakscherm nodig.
 *
 * Alleen: `initialiseerKluis()` ontgrendelt de kluis zélf. De volgorde was
 *
 *   1. `await initialiseerKluis(...)`  → de DEK komt in de context, dus
 *      `isOntgrendeld` wordt true en React rendert opnieuw
 *   2. `AlleenVergrendeld` ziet dat en navigeert weg
 *   3. `setGegenereerdeCode(...)` zou daarna het herstelcodescherm tonen, maar
 *      het component is dan al ontkoppeld
 *
 * Gevolg: de gebruiker zag zijn 128-bit herstelcode nooit. Hij werd
 * doorgestuurd naar het dashboard met een kluis waarvan de enige noodingang
 * één render eerder was weggegooid. Zonder wachtwoordzin is dat dossier
 * daarna definitief onbereikbaar — er is geen server die kan resetten.
 *
 * De regel staat daarom hier, als functie, en niet als route-omhulsel: zo is
 * hij te testen zonder browser, en kan hij niet nog eens per ongeluk
 * verdwijnen bij een routewijziging.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Registratiescherm = "formulier" | "herstelcode" | "doorsturen";

/**
 * @param isOntgrendeld of de kluis op dit moment open is
 * @param heeftHerstelcode of er in deze sessie zojuist een code is gemaakt
 */
export function bepaalRegistratiescherm(
  isOntgrendeld: boolean,
  heeftHerstelcode: boolean,
): Registratiescherm {
  // Er is zojuist een code gemaakt. Die moet de gebruiker zien en bevestigen,
  // en dat weegt zwaarder dan het feit dat de kluis intussen openstaat.
  if (heeftHerstelcode) return "herstelcode";

  // Een ontgrendelde kluis zonder verse code: hier valt niets aan te maken.
  if (isOntgrendeld) return "doorsturen";

  return "formulier";
}
