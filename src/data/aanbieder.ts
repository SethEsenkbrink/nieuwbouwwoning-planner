/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Wie de app aanbiedt — één plek voor de juridische pagina's
 *
 * De algemene voorwaarden en de privacyverklaring noemen allebei dezelfde
 * gegevens. Twee kopieën van een adres lopen na de eerste verhuizing uit
 * elkaar, en een juridische pagina die zichzelf tegenspreekt is erger dan geen
 * pagina.
 *
 * DE GEGEVENS HIERONDER ZIJN OVERGENOMEN UIT DE VOETTEKST VAN
 * brinkmultimedia.nl (21 augustus 2026). Wijzigt daar iets — een verhuizing,
 * een ander telefoonnummer, het vervallen van de kleineondernemersregeling —
 * dan hoort dit bestand mee te veranderen. Het is de enige plek in deze app
 * waar het staat.
 *
 * ⚠ VELDEN DIE LEEG ZIJN, WORDEN NIET GETOOND.
 * Dat is bewust: liever een regel minder dan "KvK: TODO" op een pagina waar
 * iemand rechten aan ontleent.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Vestigingsadres {
  straat: string;
  postcode: string;
  plaats: string;
  land: string;
}

export interface Aanbieder {
  naam: string;
  product: string;
  /** Voor vragen over de app, de voorwaarden en privacy. */
  email: string;
  /** Voor het melden van kwetsbaarheden (zie SECURITY.md). */
  beveiligingEmail: string;
  /** Zoals je hem zou intoetsen, met spaties. */
  telefoon?: string;
  kvk?: string;
  btwId?: string;
  vestigingsadres?: Vestigingsadres;
  /**
   * Fiscale voetnoot uit de kleineondernemersregeling. Staat op facturen en
   * hoort daar; op de juridische pagina's van een gratis app is hij niet
   * verplicht, maar wel eerlijk om te noemen.
   */
  fiscaleNoot?: string;
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
  telefoon: "06 40 53 76 50",
  kvk: "71256385",
  btwId: "NL002397011B65",
  vestigingsadres: {
    straat: "De Hoven 30",
    postcode: "9454 PS",
    plaats: "Ekehaar",
    land: "Nederland",
  },
  fiscaleNoot: "Vrijgesteld van omzetbelasting op grond van artikel 25 Wet OB.",
  licentie: "AGPL-3.0-only",
};

/**
 * Het adres op één regel, zoals je het in een lopende zin zet.
 *
 * Geeft een lege string terug als er geen adres is ingevuld — de aanroeper
 * hoort die regel dan weg te laten in plaats van "gevestigd te " af te drukken.
 */
export function adresOpEenRegel(aanbieder: Aanbieder = AANBIEDER): string {
  const adres = aanbieder.vestigingsadres;
  if (!adres) return "";
  return `${adres.straat}, ${adres.postcode} ${adres.plaats}`;
}

/** De datum waarop de juridische teksten voor het laatst zijn herzien. */
export const JURIDISCH_BIJGEWERKT = "21 augustus 2026";

/** Versie van de voorwaarden, zodat een wijziging aantoonbaar is. */
export const VOORWAARDEN_VERSIE = "1.0";
