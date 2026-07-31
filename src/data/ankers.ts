import type { AnkerStatus, AnkerType } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De acht bouwmomenten, met hun volgorde en hun betekenis
 *
 * `AnkerType` in `src/types/model.ts` is de canonieke lijst; dit bestand geeft
 * er de menselijke kant bij: hoe heet het moment, in welke volgorde komt het,
 * en waaróm doet het ertoe voor de planning.
 *
 * De uitleg is geen sierletter. Wie niet weet dat een dekvloer weken staat te
 * drogen, plant de vloerenlegger op de verkeerde dag — en dat is precies het
 * soort fout dat deze app hoort te voorkomen (ADR-0008).
 *
 * DE OPLEVERING STAAT HIER BEWUST NIET TUSSEN DE INVULBARE ANKERS.
 * De opleverdatum leeft als band op het project (`opleverVroegst` /
 * `opleverVerwacht` / `opleverLaatst` + `opleverStatus`), en `berekenDatum()`
 * geeft die band voorrang boven een los `oplevering`-anker. Zou je hem hier
 * ook als los anker kunnen invullen, dan bestaan er twee opleverdatums waarvan
 * er één stilletjes wordt genegeerd.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface AnkerBeschrijving {
  type: AnkerType;
  /** Wordt als `titel` opgeslagen; de gebruiker hoeft niets te verzinnen. */
  titel: string;
  /** Waarom dit moment de planning beïnvloedt. */
  uitleg: string;
}

/** Chronologisch. Dit is ook de volgorde waarin het ankerscherm ze toont. */
export const ANKER_VOLGORDE: readonly AnkerBeschrijving[] = [
  {
    type: "start_bouw",
    titel: "Start bouw",
    uitleg: "De eerste schop de grond in. Vanaf hier gaat de rest van de planning lopen.",
  },
  {
    type: "begane_grond_gestort",
    titel: "Begane grondvloer gestort",
    uitleg:
      "Wat onder de vloer moest — leidingwerk, vloerverwarming, loze buizen — ligt hierna vast.",
  },
  {
    type: "ruwbouw_gereed",
    titel: "Ruwbouw gereed",
    uitleg: "De wanden staan. Pas nu kan er ingemeten worden voor keuken en tegelwerk.",
  },
  {
    type: "wind_waterdicht",
    titel: "Wind- en waterdicht",
    uitleg: "Dak en kozijnen zitten erin. Het binnenwerk kan beginnen, ook bij slecht weer.",
  },
  {
    type: "dekvloer_gestort",
    titel: "Dekvloer gestort",
    uitleg:
      "Let op de droogtijd: ruwweg een week per centimeter, bij een gangbare dikte al gauw " +
      "vijf tot zeven weken. Een vloer die daarvóór gelegd wordt, gaat mis.",
  },
  {
    type: "oplevering",
    titel: "Oplevering",
    uitleg:
      "Het moment van de opleverpunten en het 5%-depot. Deze datum staat als band bij je " +
      "project, niet als los bouwmoment.",
  },
  {
    type: "sleuteloverdracht",
    titel: "Sleuteloverdracht",
    uitleg:
      "Vaak dezelfde dag als de oplevering, soms later. Verhuizing en opzegtermijnen hangen " +
      "hieraan, niet aan de oplevering zelf.",
  },
  {
    type: "einde_onderhoudstermijn",
    titel: "Einde onderhoudstermijn",
    uitleg:
      "Meestal drie maanden na oplevering. Het laatste moment waarop je gebreken uit de " +
      "oplevering nog onder die termijn kunt melden.",
  },
];

/**
 * De ankers die je op het ankerscherm zelf invult — dus alles behalve de
 * oplevering. Zie de kop van dit bestand voor het waarom.
 */
export const INVULBARE_ANKERS: readonly AnkerBeschrijving[] = ANKER_VOLGORDE.filter(
  (a) => a.type !== "oplevering",
);

export const ANKER_TITELS: Record<AnkerType, string> = Object.fromEntries(
  ANKER_VOLGORDE.map((a) => [a.type, a.titel]),
) as Record<AnkerType, string>;

export const ANKERSTATUS_LABELS: Record<AnkerStatus, string> = {
  verwacht: "verwacht — een schatting, mag nog schuiven",
  bevestigd: "bevestigd — de aannemer heeft dit vastgelegd",
  gepasseerd: "gepasseerd — dit moment is geweest",
};

/** Korte variant voor in een lijst of badge. */
export const ANKERSTATUS_KORT: Record<AnkerStatus, string> = {
  verwacht: "verwacht",
  bevestigd: "bevestigd",
  gepasseerd: "gepasseerd",
};
