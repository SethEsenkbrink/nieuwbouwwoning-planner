import type { AnkerType, TrajectType, WoningStatus } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Waar sta je nu — en welke vragen horen daarbij
 *
 * HET PROBLEEM DAT DIT OPLOST. De oude wizard had drie stappen en ging ervan
 * uit dat je aan het begin van een nieuwbouwtraject stond. Wie zijn sleutel al
 * had, kreeg vragen over een opleverdatum die allang geweest was, en zag geen
 * enkele vraag over het onderhoud waar het voor hem juist om draaide. Wie nog
 * aan het oriënteren was, moest een aanneemsom invullen die nog niet bestond.
 *
 * De oplossing is niet "meer vragen" maar "de juiste vragen". Eén keuze —
 * waar sta je — bepaalt daarna welke stappen er zijn, welke verplicht zijn, en
 * hoe de app zich na de wizard gedraagt.
 *
 * DRIE REGELS DIE HIER GELDEN
 *
 * 1. DIT BESTAND IS PUUR. Geen React, geen opslag, geen Date.now(). Alles is
 *    een functie van (traject, moment) naar een uitkomst, en dus te testen
 *    zonder browser. De wizard-UI leest hieruit; hij beslist zelf niets.
 *
 * 2. EEN OVERGESLAGEN STAP IS GEEN LEGE STAP. Wie op `in_beheer` binnenkomt
 *    krijgt geen vragen over meerwerk, maar de meerwerkmodule verdwijnt niet
 *    uit de app. Het onderscheid is "nu niet vragen", niet "bestaat niet".
 *
 * 3. HET MOMENT WORDT NIET AFGELEID UIT DATUMS. De verleiding is groot om uit
 *    een opleverdatum in het verleden te concluderen dat de woning opgeleverd
 *    is. Dat gaat mis op precies de momenten dat het spannend is: een
 *    oplevering kan afgekeurd worden, een transport kan uitgesteld worden. Om
 *    dezelfde reden waarom `woningStatus` in ADR-0010 §1 handmatig is, vragen
 *    we het hier gewoon.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Het moment waarop iemand de app begint te gebruiken.
 *
 * Chronologisch geordend; `VOLGORDE` hieronder legt dat vast zodat "verder dan"
 * een uitspraak is die je kunt doen zonder de labels te kennen.
 */
export type Instapmoment =
  | "orientatie"
  | "net_gekocht"
  | "in_aanbouw"
  | "bijna_oplevering"
  | "net_opgeleverd"
  | "in_beheer";

export const VOLGORDE: readonly Instapmoment[] = [
  "orientatie",
  "net_gekocht",
  "in_aanbouw",
  "bijna_oplevering",
  "net_opgeleverd",
  "in_beheer",
];

/** Ligt `a` chronologisch op of ná `b`? */
export function isOpOfNa(a: Instapmoment, b: Instapmoment): boolean {
  return VOLGORDE.indexOf(a) >= VOLGORDE.indexOf(b);
}

/** Ligt `a` chronologisch vóór `b`? */
export function isVoor(a: Instapmoment, b: Instapmoment): boolean {
  return VOLGORDE.indexOf(a) < VOLGORDE.indexOf(b);
}

// ── De keuzes die de gebruiker te zien krijgt ──────────────────────────────

export interface Momentkeuze {
  moment: Instapmoment;
  label: string;
  toelichting: string;
  /** Wat de app hierna vooral voor je doet. Eén zin, geen belofte. */
  gevolg: string;
}

/**
 * Bij nieuwbouw bestaan alle zes de momenten.
 */
const NIEUWBOUW_KEUZES: readonly Momentkeuze[] = [
  {
    moment: "orientatie",
    label: "Ik oriënteer me nog",
    toelichting:
      "Je hebt nog niets getekend. Misschien sta je ingeschreven op een project of wacht je op toewijzing.",
    gevolg: "Je legt vast wat je al weet. De rest komt er vanzelf bij zodra je tekent.",
  },
  {
    moment: "net_gekocht",
    label: "Ik heb net getekend",
    toelichting:
      "De koop-/aannemingsovereenkomst is rond. De bouw is nog niet begonnen of staat aan het begin.",
    gevolg: "De termijnstaat, het bouwdepot en de eerste afspraken worden ingericht.",
  },
  {
    moment: "in_aanbouw",
    label: "De bouw is bezig",
    toelichting:
      "Er wordt gebouwd. Je krijgt bouwvergaderingen en termijnfacturen, en de opleverdatum schuift af en toe.",
    gevolg: "De app rekent verschuivingen door en laat zien wie je daarover moet spreken.",
  },
  {
    moment: "bijna_oplevering",
    label: "De oplevering komt eraan",
    toelichting:
      "De opleverdatum is aangezegd of ligt binnen enkele weken. Nu wordt alles definitief ingepland.",
    gevolg: "De opleverlijst, het 5%-depot en de verhuizing komen bovenaan te staan.",
  },
  {
    moment: "net_opgeleverd",
    label: "Ik heb de sleutel net gekregen",
    toelichting:
      "De woning is opgeleverd. De onderhoudstermijn van zes maanden loopt en er zijn misschien nog opleverpunten open.",
    gevolg: "Hersteltermijnen, het 5%-depot en de eerste garantieklokken gaan lopen.",
  },
  {
    moment: "in_beheer",
    label: "Ik woon er al langer",
    toelichting:
      "Het bouwtraject is afgerond. Wat overblijft is onderhoud, garanties, verbruik en administratie.",
    gevolg: "De app wordt je onderhoudsdossier: wat er in huis zit en wanneer het aandacht vraagt.",
  },
];

/**
 * Bij bestaande bouw bestaat `in_aanbouw` niet.
 *
 * Er wordt niets gebouwd; tussen tekenen en sleutel zit een notariële
 * overdracht en verder vooral wachten. Die twee samenvouwen tot één keuze is
 * eerlijker dan een lege stap tonen. De overige labels zijn anders omdat de
 * woorden anders zijn: bij bestaande bouw heet het transport, niet oplevering.
 */
const BESTAANDE_BOUW_KEUZES: readonly Momentkeuze[] = [
  {
    moment: "orientatie",
    label: "Ik ben aan het zoeken of aan het bieden",
    toelichting: "Er is nog geen koopovereenkomst. Misschien loopt er een bod.",
    gevolg: "Je legt vast wat je van de woning weet, zodat je bod onderbouwd is.",
  },
  {
    moment: "net_gekocht",
    label: "De koopovereenkomst is getekend",
    toelichting:
      "De ontbindende voorwaarden lopen: financiering, en meestal een bouwkundige keuring.",
    gevolg: "De uiterste datums van je ontbindende voorwaarden komen als termijn in beeld.",
  },
  {
    moment: "bijna_oplevering",
    label: "Het transport bij de notaris staat gepland",
    toelichting: "De datum voor het passeren van de akte is bekend. De sleutel komt eraan.",
    gevolg: "Meterstanden, verzekeringen en de verhuizing komen bovenaan te staan.",
  },
  {
    moment: "net_opgeleverd",
    label: "Ik heb de sleutel net gekregen",
    toelichting: "De akte is gepasseerd. Nu begint het echte werk: inrichten en op orde brengen.",
    gevolg: "Onderdelen, meterstanden en het eerste onderhoud worden ingericht.",
  },
  {
    moment: "in_beheer",
    label: "Ik woon er al langer",
    toelichting: "De aankoop is verleden tijd. Wat overblijft is onderhoud, verbruik en garanties.",
    gevolg: "De app wordt je onderhoudsdossier: wat er in huis zit en wanneer het aandacht vraagt.",
  },
];

export function momentenVoor(traject: TrajectType): readonly Momentkeuze[] {
  return traject === "nieuwbouw" ? NIEUWBOUW_KEUZES : BESTAANDE_BOUW_KEUZES;
}

/**
 * Geldt dit moment binnen dit traject?
 *
 * Nodig omdat iemand halverwege van traject kan wisselen. Stond hij op
 * `in_aanbouw` en zet hij het traject op bestaande bouw, dan bestaat zijn keuze
 * niet meer en moet de wizard er een geldige van maken in plaats van een lege
 * stappenlijst te tonen.
 */
export function isGeldigMoment(traject: TrajectType, moment: Instapmoment): boolean {
  return momentenVoor(traject).some((k) => k.moment === moment);
}

/** Het dichtstbijzijnde geldige moment binnen dit traject. */
export function dichtstbijzijndeMoment(
  traject: TrajectType,
  moment: Instapmoment,
): Instapmoment {
  if (isGeldigMoment(traject, moment)) return moment;

  const geldig = momentenVoor(traject).map((k) => k.moment);
  const doelIndex = VOLGORDE.indexOf(moment);

  let beste = geldig[0] ?? "orientatie";
  let besteAfstand = Number.POSITIVE_INFINITY;
  for (const kandidaat of geldig) {
    const afstand = Math.abs(VOLGORDE.indexOf(kandidaat) - doelIndex);
    if (afstand < besteAfstand) {
      besteAfstand = afstand;
      beste = kandidaat;
    }
  }
  return beste;
}

// ── Wat het moment betekent voor het dossier ───────────────────────────────

/**
 * De woningstatus die bij dit moment hoort.
 *
 * `opgeleverd` vanaf het moment dat de sleutel er is. Dat ene veld bepaalt wat
 * het dashboard bovenaan zet (ADR-0010 §1), dus het is het verschil tussen een
 * app over bouwen en een app over wonen.
 */
export function woningStatusVoor(moment: Instapmoment): WoningStatus {
  return isOpOfNa(moment, "net_opgeleverd") ? "opgeleverd" : "in_aanbouw";
}

/**
 * De ankers die op dit moment al gepasseerd zijn.
 *
 * Hiermee hoeft iemand die midden in de bouw instapt niet uit te leggen dat de
 * begane grond gestort is — dat volgt uit "de bouw is bezig". De datums vult
 * hij zelf in als hij ze weet; de status klopt in elk geval meteen.
 *
 * BEWUST CONSERVATIEF. Bij `in_aanbouw` staat alleen `start_bouw` op
 * gepasseerd. Of de ruwbouw al staat weten we niet, en een verkeerd
 * "gepasseerd" is erger dan een ontbrekende: gepasseerde ankers liggen vast en
 * schuiven niet meer mee.
 */
export function gepasseerdeAnkers(moment: Instapmoment): readonly AnkerType[] {
  switch (moment) {
    case "orientatie":
    case "net_gekocht":
      return [];
    case "in_aanbouw":
      return ["start_bouw"];
    case "bijna_oplevering":
      return ["start_bouw", "begane_grond_gestort", "ruwbouw_gereed", "wind_waterdicht"];
    case "net_opgeleverd":
      return [
        "start_bouw",
        "begane_grond_gestort",
        "ruwbouw_gereed",
        "wind_waterdicht",
        "dekvloer_gestort",
        "oplevering",
        "sleuteloverdracht",
      ];
    case "in_beheer":
      return [
        "start_bouw",
        "begane_grond_gestort",
        "ruwbouw_gereed",
        "wind_waterdicht",
        "dekvloer_gestort",
        "oplevering",
        "sleuteloverdracht",
        "einde_onderhoudstermijn",
      ];
  }
}
