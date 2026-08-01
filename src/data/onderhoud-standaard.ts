import type { OnderdeelCategorie } from "@/types/model";
import { STANDAARD_ONDERDELEN, type StandaardOnderdeel } from "@/data/onderdelen-standaard";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Standaardbibliotheek onderhoud — wat er terugkomt, en hoe vaak
 *
 * Tweede bibliotheek naast `onderdelen-standaard.ts`. Die zegt wát er in huis
 * zit; deze zegt wat je ermee moet doen en wanneer.
 *
 * DRIE REGELS (ADR-0009, ADR-0014 §1)
 *
 * 1. DE INTERVALLEN ZIJN VOORSTELLEN, GEEN VOORSCHRIFTEN.
 *    Elke taak die hiervandaan komt krijgt `waardenBron: "voorstel"` en de
 *    bijbehorende disclaimer in de UI. Het onderhoudsvoorschrift van de
 *    fabrikant wint altijd van onze schatting — bij een NIBE-warmtepomp of een
 *    Brink-WTW staat het gewoon in de handleiding.
 *
 * 2. `voorkeursmaand` ALLEEN WAAR HET SEIZOEN ECHT UITMAAKT.
 *    Dakgoten na de bladval, radiatoren vóór het stookseizoen, buitenwerk in de
 *    zomer. Voor filters en rookmelders maakt de maand niet uit, en een
 *    voorkeursmaand zou daar alleen maar de reeks verstoren.
 *
 * 3. GEEN KOSTENRAMINGEN.
 *    Wat een cv-beurt kost verschilt per regio en per contract. Een verzonnen
 *    bedrag blijft als anker hangen — zelfde reden als bij `nabudget-standaard`.
 *
 * Bijgewerkt: 2026-08-01.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface StandaardOnderhoud {
  sleutel: string;
  titel: string;
  omschrijving: string;
  intervalDagen: number;
  /** 1–12, alleen bij seizoensgebonden werk. */
  voorkeursmaand?: number;
  /**
   * Bij welke onderdeelsleutel uit `onderdelen-standaard.ts` dit hoort.
   * Leeg = het hangt aan de woning zelf, niet aan een apparaat.
   */
  onderdeelSleutel?: string;
  /** Voor het groeperen in de UI. */
  categorie: OnderdeelCategorie;
  /** Wat er misgaat als je het overslaat. Wordt de `waarschuwing` op de taak. */
  waarschuwing?: string;
  /** Kun je dit zelf, of heb je een monteur nodig? */
  zelfTeDoen: boolean;
}

/**
 * De taak die je wilt voorstellen als de garantie van een onderdeel afloopt
 * (blok E4): "laat het nakijken zolang de fabrikant nog betaalt".
 *
 * Per onderdeelsleutel de sleutel van de servicebeurt uit de lijst hieronder.
 * Staat een onderdeel er niet bij, dan valt de UI terug op een vrije taak — dat
 * is beter dan een controle voorstellen die niets met garantie te maken heeft.
 */
const GARANTIECONTROLE_PER_ONDERDEEL: Readonly<Record<string, string>> = {
  warmtepomp: "warmtepomp_onderhoud",
  cv_ketel: "cv_onderhoud",
  wtw_unit: "wtw_filters",
  boiler: "anode_controleren",
  waterontharder: "waterontharder_service",
  zonnepanelen: "zonnepanelen_opbrengst",
  dakbedekking: "dak_inspectie",
  kozijnen: "kozijnen_rubbers",
  zonwering: "zonwering_controle",
};

export const STANDAARD_ONDERHOUD: readonly StandaardOnderhoud[] = [
  // ── Ventilatie ──────────────────────────────────────────────────────────
  {
    sleutel: "wtw_filters",
    titel: "WTW-filters vervangen",
    omschrijving:
      "Beide filters uit de unit halen en vervangen. Noteer de filtermaat bij het onderdeel, " +
      "dan bestel je de volgende keer meteen de juiste.",
    intervalDagen: 182,
    onderdeelSleutel: "wtw_unit",
    categorie: "ventilatie",
    waarschuwing:
      "Vuile filters kosten rendement én luchtkwaliteit. Brink adviseert minimaal jaarlijks; " +
      "halfjaarlijks is gangbaar, en vaker bij huisgenoten met luchtwegklachten.",
    zelfTeDoen: true,
  },
  {
    sleutel: "wtw_filters_reinigen",
    titel: "WTW-filters tussentijds uitzuigen",
    omschrijving: "Halverwege de filterperiode even uitzuigen verlengt de standtijd.",
    intervalDagen: 91,
    onderdeelSleutel: "wtw_unit",
    categorie: "ventilatie",
    zelfTeDoen: true,
  },
  {
    sleutel: "ventilatiekanalen",
    titel: "Ventilatiekanalen laten reinigen",
    omschrijving: "Kanalen en ventielen laten doorblazen door een specialist.",
    intervalDagen: 1825,
    categorie: "ventilatie",
    zelfTeDoen: false,
  },

  // ── Verwarming ──────────────────────────────────────────────────────────
  {
    sleutel: "warmtepomp_onderhoud",
    titel: "Warmtepomp laten nakijken",
    omschrijving:
      "Servicebeurt door een erkend monteur: druk, koudemiddel, filters en werking van de " +
      "buitenunit.",
    intervalDagen: 730,
    onderdeelSleutel: "warmtepomp",
    categorie: "verwarming",
    waarschuwing:
      "Controleer je garantievoorwaarden: sommige fabrikanten eisen periodiek onderhoud, " +
      "anders vervalt de garantie. Bij R290 (propaan) mag niet iedere monteur eraan werken.",
    zelfTeDoen: false,
  },
  {
    sleutel: "warmtepomp_filter",
    titel: "Warmtepompfilter reinigen",
    omschrijving: "Het luchtfilter van de binnenunit uitnemen en schoonmaken.",
    intervalDagen: 182,
    onderdeelSleutel: "warmtepomp",
    categorie: "verwarming",
    zelfTeDoen: true,
  },
  {
    sleutel: "cv_onderhoud",
    titel: "Cv-ketel laten onderhouden",
    omschrijving: "Jaarlijkse servicebeurt, inclusief rookgasmeting.",
    intervalDagen: 365,
    onderdeelSleutel: "cv_ketel",
    categorie: "verwarming",
    waarschuwing:
      "Vaak een voorwaarde in zowel de fabrieksgarantie als de opstalverzekering bij " +
      "schade door de installatie.",
    zelfTeDoen: false,
  },
  {
    sleutel: "waterdruk",
    titel: "Waterdruk controleren",
    omschrijving: "Kijk op de manometer. Onder de 1,0 bar bijvullen tot circa 1,5 bar.",
    intervalDagen: 91,
    categorie: "verwarming",
    zelfTeDoen: true,
  },
  {
    sleutel: "radiatoren_ontluchten",
    titel: "Radiatoren ontluchten",
    omschrijving: "Vóór het stookseizoen, van laag naar hoog door het huis.",
    intervalDagen: 365,
    voorkeursmaand: 9,
    categorie: "verwarming",
    zelfTeDoen: true,
  },
  {
    sleutel: "vloerverwarming_ontluchten",
    titel: "Vloerverwarmingsverdeler ontluchten",
    omschrijving: "Per groep ontluchten en de doorstroommeters controleren.",
    intervalDagen: 365,
    voorkeursmaand: 9,
    onderdeelSleutel: "vloerverwarmingsverdeler",
    categorie: "verwarming",
    zelfTeDoen: true,
  },

  // ── Warm water ──────────────────────────────────────────────────────────
  {
    sleutel: "anode_controleren",
    titel: "Anode van de boiler laten controleren",
    omschrijving: "De magnesiumanode is een slijtdeel dat het vat beschermt tegen corrosie.",
    intervalDagen: 730,
    onderdeelSleutel: "boiler",
    categorie: "warm_water",
    waarschuwing:
      "Vervang je de anode niet, dan gaat uiteindelijk het vát kapot in plaats van de anode — " +
      "en dat is een vervanging in plaats van een onderdeel.",
    zelfTeDoen: false,
  },
  {
    sleutel: "legionella_spoelen",
    titel: "Weinig gebruikte tappunten doorspoelen",
    omschrijving: "Logeerbadkamer of buitenkraan een paar minuten heet laten doorlopen.",
    intervalDagen: 91,
    categorie: "warm_water",
    zelfTeDoen: true,
  },

  // ── Water ───────────────────────────────────────────────────────────────
  {
    sleutel: "waterontharder_zout",
    titel: "Zout bijvullen waterontharder",
    omschrijving: "Zoutniveau controleren en bijvullen tot het aangegeven maximum.",
    intervalDagen: 30,
    onderdeelSleutel: "waterontharder",
    categorie: "water",
    waarschuwing:
      "Raakt het zout op, dan verhardt het water ongemerkt weer — je merkt het pas aan de " +
      "kalkaanslag.",
    zelfTeDoen: true,
  },
  {
    sleutel: "waterontharder_service",
    titel: "Waterontharder laten nakijken",
    omschrijving: "Hars, klepwerk en instellingen laten controleren.",
    intervalDagen: 730,
    onderdeelSleutel: "waterontharder",
    categorie: "water",
    zelfTeDoen: false,
  },
  {
    sleutel: "waterhardheid_meten",
    titel: "Waterhardheid meten",
    omschrijving: "Met een teststrip controleren of de ontharder nog op de ingestelde waarde zit.",
    intervalDagen: 182,
    onderdeelSleutel: "waterontharder",
    categorie: "water",
    zelfTeDoen: true,
  },
  {
    sleutel: "waterfilter_voorfilter",
    titel: "Voorfilter drinkwaterfilter vervangen",
    omschrijving: "Sediment- en actief-koolcartridges vervangen.",
    intervalDagen: 182,
    onderdeelSleutel: "drinkwaterfilter",
    categorie: "water",
    waarschuwing:
      "Overschrijd het interval niet. De WHO waarschuwt expliciet dat een verouderd " +
      "actief-koolfilter bacteriegroei kan bevorderen — een oud filter is erger dan geen.",
    zelfTeDoen: true,
  },
  {
    sleutel: "waterfilter_membraan",
    titel: "RO-membraan vervangen",
    omschrijving: "Het osmosemembraan gaat bij normaal gebruik twee tot vijf jaar mee.",
    intervalDagen: 1095,
    onderdeelSleutel: "drinkwaterfilter",
    categorie: "water",
    zelfTeDoen: true,
  },

  // ── Elektra en opwekking ────────────────────────────────────────────────
  {
    sleutel: "aardlek_testen",
    titel: "Aardlekschakelaar testen",
    omschrijving:
      "Druk op de testknop; de schakelaar hoort meteen af te slaan. Daarna weer inschakelen.",
    intervalDagen: 91,
    onderdeelSleutel: "groepenkast",
    categorie: "elektra",
    waarschuwing:
      "Slaat hij niet af, laat het dan direct nakijken. Dit is de beveiliging die je tegen " +
      "elektrocutie beschermt.",
    zelfTeDoen: true,
  },
  {
    sleutel: "zonnepanelen_opbrengst",
    titel: "Opbrengst zonnepanelen controleren",
    omschrijving:
      "Vergelijk de jaaropbrengst met vorig jaar. Een structurele daling wijst op vervuiling, " +
      "schaduw of een defecte string.",
    intervalDagen: 365,
    voorkeursmaand: 9,
    onderdeelSleutel: "zonnepanelen",
    categorie: "opwekking",
    waarschuwing:
      "Meet vóórdat de opbrengstgarantie afloopt: zonder meting kun je niets claimen.",
    zelfTeDoen: true,
  },
  {
    sleutel: "zonnepanelen_reinigen",
    titel: "Zonnepanelen laten reinigen",
    omschrijving: "Alleen zinvol bij zichtbare vervuiling, mos of veel bomen in de buurt.",
    intervalDagen: 1095,
    voorkeursmaand: 4,
    onderdeelSleutel: "zonnepanelen",
    categorie: "opwekking",
    zelfTeDoen: false,
  },
  {
    sleutel: "batterij_gezondheid",
    titel: "Batterijcapaciteit controleren",
    omschrijving:
      "Noteer de resterende capaciteit uit de app. Zo zie je of hij binnen de cyclusgarantie " +
      "degradeert.",
    intervalDagen: 365,
    categorie: "opslag",
    waarschuwing:
      "De cyclus- of doorvoergarantie loopt meestal eerder af dan de jaargarantie. Zonder " +
      "eigen metingen kun je een claim niet onderbouwen.",
    zelfTeDoen: true,
  },

  // ── Beveiliging ─────────────────────────────────────────────────────────
  {
    sleutel: "rookmelders_testen",
    titel: "Rookmelders testen",
    omschrijving: "Testknop indrukken op elke melder. Bij gekoppelde melders gaan ze allemaal af.",
    intervalDagen: 30,
    onderdeelSleutel: "rookmelders",
    categorie: "beveiliging",
    zelfTeDoen: true,
  },
  {
    sleutel: "rookmelders_vervangen",
    titel: "Rookmelders vervangen",
    omschrijving:
      "Na tien jaar vervangen, ongeacht of ze het nog doen. De sensor veroudert; " +
      "schoonmaken helpt dan niet meer.",
    intervalDagen: 3650,
    onderdeelSleutel: "rookmelders",
    categorie: "beveiliging",
    waarschuwing: "De uiterste datum staat op de melder zelf, tien jaar na de productiedatum.",
    zelfTeDoen: true,
  },
  {
    sleutel: "sloten_smeren",
    titel: "Sloten en scharnieren smeren",
    omschrijving: "Cilinders met een grafiet- of PTFE-spray, scharnieren met een druppel olie.",
    intervalDagen: 365,
    onderdeelSleutel: "hang_en_sluitwerk",
    categorie: "beveiliging",
    zelfTeDoen: true,
  },

  // ── Bouwkundig ──────────────────────────────────────────────────────────
  {
    sleutel: "dakgoten",
    titel: "Dakgoten schoonmaken",
    omschrijving: "Bladeren en mos verwijderen, en controleren of de afvoer doorloopt.",
    intervalDagen: 365,
    voorkeursmaand: 11,
    categorie: "dak",
    waarschuwing:
      "Een verstopte goot laat water langs de gevel lopen. Dat zie je pas als de schade er is.",
    zelfTeDoen: true,
  },
  {
    sleutel: "dak_inspectie",
    titel: "Dak laten inspecteren",
    omschrijving: "Pannen, dakbedekking en aansluitingen laten nakijken.",
    intervalDagen: 1825,
    voorkeursmaand: 5,
    onderdeelSleutel: "dakbedekking",
    categorie: "dak",
    waarschuwing:
      "Bij een plat dak vaak een voorwaarde voor de garantie: geen inspectierapport, geen claim.",
    zelfTeDoen: false,
  },
  {
    sleutel: "kitvoegen",
    titel: "Kitvoegen badkamer controleren",
    omschrijving: "Loszittende of beschimmelde voegen vervangen.",
    intervalDagen: 1825,
    categorie: "sanitair",
    waarschuwing:
      "Een kapotte voeg laat water achter het tegelwerk lopen. Dat is de duurste " +
      "vijf-euro-reparatie die je kunt uitstellen.",
    zelfTeDoen: true,
  },
  {
    sleutel: "buitenschilderwerk",
    titel: "Buitenschilderwerk bijwerken",
    omschrijving: "Houtwerk controleren en waar nodig schuren en overschilderen.",
    intervalDagen: 2190,
    voorkeursmaand: 6,
    categorie: "gevel",
    zelfTeDoen: false,
  },
  {
    sleutel: "kozijnen_rubbers",
    titel: "Rubbers en beslag kozijnen nalopen",
    omschrijving: "Tochtrubbers schoonmaken en invetten, sluitpunten afstellen.",
    intervalDagen: 730,
    onderdeelSleutel: "kozijnen",
    categorie: "gevel",
    zelfTeDoen: true,
  },
  {
    sleutel: "zonwering_controle",
    titel: "Zonwering controleren",
    omschrijving: "Doek, geleiders en de windsensor nalopen vóór het seizoen.",
    intervalDagen: 365,
    voorkeursmaand: 4,
    onderdeelSleutel: "zonwering",
    categorie: "zonwering",
    zelfTeDoen: true,
  },

  // ── Meterstanden ────────────────────────────────────────────────────────
  {
    sleutel: "meterstanden",
    titel: "Meterstanden noteren",
    omschrijving:
      "Stroom, gas en water opnemen. Handig bij de jaarafrekening en om verbruik te volgen.",
    intervalDagen: 365,
    voorkeursmaand: 1,
    categorie: "overig",
    zelfTeDoen: true,
  },
];

/**
 * Bij welk standaardonderdeel hoort dit opgeslagen onderdeel? Match op naam,
 * want de bibliotheeksleutel wordt niet opgeslagen — de bibliotheek is een
 * hulpmiddel bij het invullen, geen verwijzing die moet blijven kloppen als de
 * lijst verandert.
 */
export function standaardOnderdeelVoor(onderdeelNaam: string): StandaardOnderdeel | undefined {
  const genormaliseerd = onderdeelNaam.trim().toLowerCase();
  return STANDAARD_ONDERDELEN.find((o) => o.naam.toLowerCase() === genormaliseerd);
}

/**
 * De voorgestelde garantiecontrole voor een onderdeel (blok E4): "laat het
 * nakijken zolang de fabrikant nog betaalt".
 *
 * `undefined` als er geen passende taak is. De UI valt dan terug op een vrije
 * taak met de naam van het onderdeel erin — beter dan een controle voorstellen
 * die niets met garantie te maken heeft.
 */
export function garantiecontroleVoor(onderdeelNaam: string): StandaardOnderhoud | undefined {
  const standaard = standaardOnderdeelVoor(onderdeelNaam);
  if (!standaard) return undefined;

  const taaksleutel = GARANTIECONTROLE_PER_ONDERDEEL[standaard.sleutel];
  if (taaksleutel === undefined) return undefined;

  return STANDAARD_ONDERHOUD.find((o) => o.sleutel === taaksleutel);
}
