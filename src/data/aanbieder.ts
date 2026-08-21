/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Wie de app aanbiedt — één plek voor de juridische pagina's
 *
 * De algemene voorwaarden en de privacyverklaring noemen allebei dezelfde
 * gegevens. Twee kopieën van een adres lopen na de eerste verhuizing uit
 * elkaar, en een juridische pagina die zichzelf tegenspreekt is erger dan geen
 * pagina.
 *
 * ⚠ VELDEN DIE LEEG ZIJN, WORDEN NIET GETOOND.
 * Dat is bewust: liever een regel minder dan "KvK: TODO" op een pagina waar
 * iemand rechten aan ontleent. Vul `kvk` en `vestigingsadres` in zodra je ze
 * op de site wilt hebben — de pagina's nemen ze dan vanzelf op.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Aanbieder {
  naam: string;
  product: string;
  /** Voor vragen over de app, de voorwaarden en privacy. */
  email: string;
  /** Voor het melden van kwetsbaarheden (zie SECURITY.md). */
  beveiligingEmail: string;
  /** Leeg laten tot het ingevuld kan worden. */
  kvk?: string;
  /** Leeg laten tot het ingevuld kan worden. */
  vestigingsadres?: string;
  /**
   * De licentie waaronder de broncode beschikbaar is.
   *
   * Bewust alleen de naam en géén URL. `verify:offline` scant de gebouwde
   * bundle op externe adressen en loopt rood op elke http(s)-verwijzing, ook
   * op een link waar de gebruiker zelf op klikt. Die gate absoluut houden is
   * meer waard dan een klikbare licentie: de volledige tekst staat in
   * `LICENSE` in de broncode.
   */
  licentie: string;
}

export const AANBIEDER: Aanbieder = {
  naam: "Brink Multimedia",
  product: "Woningdossier",
  email: "info@brinkmultimedia.nl",
  beveiligingEmail: "security@brinkmultimedia.nl",
  licentie: "AGPL-3.0-only",
};

/** De datum waarop de juridische teksten voor het laatst zijn herzien. */
export const JURIDISCH_BIJGEWERKT = "21 augustus 2026";

/** Versie van de voorwaarden, zodat een wijziging aantoonbaar is. */
export const VOORWAARDEN_VERSIE = "1.0";
