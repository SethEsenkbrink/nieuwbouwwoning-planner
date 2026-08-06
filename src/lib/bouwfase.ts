import { ANKER_VOLGORDE, INVULBARE_ANKERS } from "@/data/ankers";
import type { StandaardBetrokkene } from "@/data/betrokkenen-standaard";
import type { AnkerType } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Waar staat de bouw — en wat dat verandert aan de vragen (blok W1)
 *
 * DE AANLEIDING. De wizard ging ervan uit dat je aan het begin van je
 * bouwtraject staat: hij vraagt naar een opleverdatum die nog een schatting is
 * en stelt alle achtendertig partijen voor alsof ze allemaal nog moeten komen.
 * Gebruiker #1 staat in de eindfase — de woning staat er al, ze zijn met de
 * laatste dingen bezig. De helft van wat de app hem vroeg, sloeg nergens meer
 * op.
 *
 * Eén vraag vooraan lost dat op: **waar staat de bouw nu?** De zeven
 * bouwmomenten bestaan al; deze module vertaalt die keuze naar twee dingen:
 *
 *   1. welke bouwmomenten daarmee `gepasseerd` zijn;
 *   2. welke partijen nog zinvol zijn om voor te stellen.
 *
 * WAAROM ER GEEN DATUMS GEVRAAGD WORDEN BIJ DEZE STAP. Nagekeken in
 * `planning.ts`: `berekenDatum()` filtert ankers op `verwachtOp !== undefined`
 * en valt bij een anker zónder datum netjes terug op de opleverband, met
 * `zekerheid: "teruggevallen"`. De UI toont dat al als *"Gerekend vanaf de
 * oplevering — X is nog niet bekend"*. Een gepasseerd anker zonder datum is
 * dus veilig, en dat scheelt zeven datumvelden in een wizard waarvan de klacht
 * juist was dat er te veel ingevuld moest worden.
 *
 * DIT BESTAND IS PUUR. Geen Firestore, geen React.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * De keuze in de wizard.
 *
 * `nog_niet_begonnen` en `opgeleverd` zijn geen bouwmomenten maar wel de twee
 * uitersten die iemand kan aanvinken. Daartussenin liggen de vijf momenten uit
 * `ANKER_VOLGORDE` die vóór de oplevering vallen.
 */
export type Bouwfase =
  | "nog_niet_begonnen"
  | "start_bouw"
  | "begane_grond_gestort"
  | "ruwbouw_gereed"
  | "wind_waterdicht"
  | "dekvloer_gestort"
  | "opgeleverd";

export interface Bouwfasekeuze {
  waarde: Bouwfase;
  label: string;
  /** Eén regel die de keuze herkenbaar maakt zonder vakjargon. */
  toelichting: string;
}

/**
 * De keuzelijst, chronologisch.
 *
 * De labels beschrijven wat je ziet als je op de bouwplaats staat, niet wat de
 * aannemer het noemt. "De ruwbouw staat" is jargon; "de muren staan overeind"
 * is wat je herkent. De vakterm staat erachter, zodat je hem later terugkent op
 * het ankerscherm.
 */
export const BOUWFASES: readonly Bouwfasekeuze[] = [
  {
    waarde: "nog_niet_begonnen",
    label: "De bouw moet nog beginnen",
    toelichting: "Je hebt getekend, maar er is nog niet geschept.",
  },
  {
    waarde: "start_bouw",
    label: "De bouw is begonnen",
    toelichting: "De eerste schop is de grond in.",
  },
  {
    waarde: "begane_grond_gestort",
    label: "De begane grondvloer ligt",
    toelichting: "Leidingwerk en vloerverwarming liggen erin en zitten vast.",
  },
  {
    waarde: "ruwbouw_gereed",
    label: "De muren staan overeind",
    toelichting: "De ruwbouw is klaar — vanaf nu kan er ingemeten worden.",
  },
  {
    waarde: "wind_waterdicht",
    label: "Het dak en de kozijnen zitten erin",
    toelichting: "Wind- en waterdicht. Het binnenwerk kan beginnen.",
  },
  {
    waarde: "dekvloer_gestort",
    label: "De dekvloer is gestort",
    toelichting: "Nu geldt de droogtijd: ruwweg een week per centimeter.",
  },
  {
    waarde: "opgeleverd",
    label: "De woning is al opgeleverd",
    toelichting: "Je hebt de sleutel. De app wordt dan een woningdossier.",
  },
];

/** De volgorde-index binnen `ANKER_VOLGORDE`; `-1` als het geen anker is. */
function indexVan(type: AnkerType): number {
  return ANKER_VOLGORDE.findIndex((a) => a.type === type);
}

/**
 * Welke bouwmomenten zijn met deze keuze geweest?
 *
 * Inclusief het gekozen moment zelf: kies je "de muren staan overeind", dan is
 * de ruwbouw geweest, niet aanstaande.
 *
 * Bij `opgeleverd` zijn alle invulbare momenten geweest — de sleuteloverdracht
 * en het einde van de onderhoudstermijn zitten daar níét automatisch bij. Die
 * kunnen na de oplevering nog komen, en ze aanvinken zou een onderhoudstermijn
 * afsluiten die nog loopt.
 */
export function gepasseerdeAnkers(fase: Bouwfase): readonly AnkerType[] {
  if (fase === "nog_niet_begonnen") return [];

  if (fase === "opgeleverd") {
    return INVULBARE_ANKERS.filter(
      (a) => a.type !== "sleuteloverdracht" && a.type !== "einde_onderhoudstermijn",
    ).map((a) => a.type);
  }

  const grens = indexVan(fase);
  return INVULBARE_ANKERS.filter((a) => indexVan(a.type) <= grens).map((a) => a.type);
}

/**
 * Is deze partij nog zinvol om voor te stellen?
 *
 * Een partij valt af zodra **al haar afspraken** geweest zijn. Heeft ze er ook
 * maar één die nog komt, dan blijft ze staan.
 *
 * DRIE REGELS, EN ALLE DRIE ZIJN ZE NODIG GEBLEKEN:
 *
 * 1. **Eén toekomstige afspraak houdt de partij overeind.** De keuken­leverancier
 *    meet in bij de ruwbouw én levert bij de oplevering. Staat de ruwbouw al,
 *    dan is het inmeten geweest maar de levering allerminst — die partij
 *    weglaten zou de belangrijkste afspraak van het traject laten verdwijnen.
 *
 * 2. **Een afspraak aan de oplevering telt nooit als geweest**, ook niet bij
 *    `fase: "opgeleverd"`. Een tuinaanleg die zestig dagen ná de oplevering
 *    valt, moet nog steeds ingepland worden.
 *
 * 3. **Een positieve offset telt nooit als geweest.** Dit is de regel die er
 *    bij het narekenen bij moest: de vloerenlegger hangt aan
 *    `dekvloer_gestort + 42` vanwege de droogtijd. Kijk je alleen naar het
 *    ankertype, dan verdwijnt hij precies op het moment dat hij ingepland moet
 *    worden — zes weken vóór hij komt. De fase vertelt ons dát het anker
 *    gepasseerd is, niet wánneer; bij een offset naar de toekomst kunnen we dus
 *    niets concluderen, en dan is laten staan de veilige keuze.
 */
export function isNogRelevant(partij: StandaardBetrokkene, fase: Bouwfase): boolean {
  const geweest = new Set(gepasseerdeAnkers(fase));
  if (geweest.size === 0) return true;

  return partij.afspraken.some(
    (afspraak) =>
      afspraak.ankerType === "oplevering" ||
      afspraak.offsetDagen > 0 ||
      !geweest.has(afspraak.ankerType),
  );
}

/**
 * Splitst de bibliotheek in "hoort bij waar je nu staat" en "dit is al geweest".
 *
 * De tweede groep wordt niet weggegooid maar ingeklapt. Stil weglaten zou de
 * gebruiker een keuze afnemen zonder het te zeggen — en soms klopt de fase niet
 * precies, of is een partij alsnog nodig.
 */
export function splitsOpFase(
  partijen: readonly StandaardBetrokkene[],
  fase: Bouwfase,
): { relevant: readonly StandaardBetrokkene[]; geweest: readonly StandaardBetrokkene[] } {
  const relevant: StandaardBetrokkene[] = [];
  const geweest: StandaardBetrokkene[] = [];

  for (const partij of partijen) {
    if (isNogRelevant(partij, fase)) relevant.push(partij);
    else geweest.push(partij);
  }

  return { relevant, geweest };
}

/**
 * Welke opleverstatus ligt bij deze fase voor de hand?
 *
 * Niet meer dan een startwaarde — de gebruiker kiest zelf. Maar bij een woning
 * waarvan de dekvloer al ligt is "indicatief" onwaarschijnlijk: dan zit je
 * dichtbij genoeg dat er een bandbreedte of een aanzegging ligt. De wizard
 * begint dus niet meer standaard op de meest vage optie.
 */
export function voorgesteldeOpleverstatus(
  fase: Bouwfase,
): "indicatief" | "bandbreedte" | "aangezegd" {
  if (fase === "opgeleverd") return "aangezegd";
  if (fase === "dekvloer_gestort") return "bandbreedte";
  return "indicatief";
}
