import { ANKER_VOLGORDE, INVULBARE_ANKERS } from "@/data/ankers";
import type { AnkerStatus, AnkerType } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De rekenkern van het dashboard (ADR-0018)
 *
 * Alles wat het dashboard bovenaan toont wordt hier afgeleid, zodat het scherm
 * zelf alleen nog weergave is. Reden: de oude `Dashboard.tsx` rekende in de
 * render — acht secties met elk hun eigen filter en telling, 621 regels lang.
 * Daar valt niets aan te testen zonder de hele component te monteren, en dus
 * is er acht sessies lang niets aan getest.
 *
 * DIT BESTAND IS PUUR, net als `planning.ts`. Geen opslaglaag, geen React, en
 * geen `new Date()` die niet als parameter binnenkomt.
 *
 * HET ONDERSCHEID DAT HIER HET ZWAARST WEEGT: "niets ingevuld" is niet
 * hetzelfde als "nul". Het oude dashboard toonde `€ 0` voor een leeg
 * meerwerkbudget, en dat leest als een kapotte app in plaats van als een leeg
 * veld — het was de tweede opmerking in de live test van 2 augustus. Elk
 * kerncijfer heeft daarom een expliciete `ingevuld`-vlag in plaats van een
 * getal dat toevallig nul is.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Bouwvoortgang ──────────────────────────────────────────────────────────

/**
 * De staat van één bouwmoment op de voortgangsbalk.
 *
 *   gepasseerd  het moment is geweest — de datum ligt vast
 *   bekend      er staat een datum, maar hij mag nog schuiven
 *   onbekend    nog niets ingevuld
 *
 * Bewust drie standen en niet twee. Een moment met een verwachte datum is
 * iéts, maar het is niet hetzelfde als een moment dat geweest is; wie ze op
 * één hoop gooit ziet een balk die voller lijkt dan de bouw is.
 */
export type Voortgangsstand = "gepasseerd" | "bekend" | "onbekend";

export interface Bouwmomentstand {
  type: AnkerType;
  titel: string;
  stand: Voortgangsstand;
  datum?: Date;
}

export interface Bouwvoortgang {
  momenten: readonly Bouwmomentstand[];
  gepasseerd: number;
  bekend: number;
  totaal: number;
  /** Het laatste moment dat geweest is — "waar staat de bouw nu". */
  laatstGepasseerd?: Bouwmomentstand;
  /** Het eerstvolgende moment met een datum in de toekomst. */
  volgende?: Bouwmomentstand;
}

/** Wat de rekenkern van een anker nodig heeft. Lichter dan `AnkerMetId`. */
export interface AnkerStand {
  type: AnkerType;
  status: AnkerStatus;
  /**
   * `| undefined` staat er expliciet bij vanwege `exactOptionalPropertyTypes`:
   * zonder dat is `AnkerMetId` (waar het veld `Date | undefined` is) niet
   * toewijsbaar aan dit lichtere type.
   */
  verwachtOp?: Date | undefined;
}

/**
 * Zet de zeven invulbare bouwmomenten om in een balk.
 *
 * De oplevering zit hier niet bij: die leeft als band op het project en zou
 * anders twee keer meetellen. Zie de kop van `data/ankers.ts`.
 *
 * EEN MOMENT MET STATUS `gepasseerd` MAAR ZONDER DATUM TELT TOCH ALS
 * GEPASSEERD. Dat is wat de fasekeuze in de wizard straks invult (blok W1):
 * je weet dát de ruwbouw staat, maar niet meer op welke dag dat was — en dat
 * is genoeg om de rest van de planning op te baseren.
 */
export function maakBouwvoortgang(
  ankers: readonly AnkerStand[],
  nu: Date,
): Bouwvoortgang {
  const momenten = INVULBARE_ANKERS.map((beschrijving): Bouwmomentstand => {
    const anker = ankers.find((a) => a.type === beschrijving.type);

    // Een datum in het verleden telt als gepasseerd, ook zonder dat iemand de
    // status heeft omgezet. Anders blijft de balk staan op de dag dat de
    // gebruiker hem voor het laatst bijwerkte in plaats van op vandaag.
    const isGeweest =
      anker?.status === "gepasseerd" ||
      (anker?.verwachtOp !== undefined && anker.verwachtOp.getTime() < nu.getTime());

    const stand: Voortgangsstand = isGeweest
      ? "gepasseerd"
      : anker?.verwachtOp !== undefined
        ? "bekend"
        : "onbekend";

    return {
      type: beschrijving.type,
      titel: beschrijving.titel,
      stand,
      ...(anker?.verwachtOp === undefined ? {} : { datum: anker.verwachtOp }),
    };
  });

  const gepasseerd = momenten.filter((m) => m.stand === "gepasseerd");
  const bekend = momenten.filter((m) => m.stand === "bekend");

  return {
    momenten,
    gepasseerd: gepasseerd.length,
    bekend: bekend.length,
    totaal: momenten.length,
    ...(gepasseerd.length === 0 ? {} : { laatstGepasseerd: gepasseerd[gepasseerd.length - 1] }),
    ...(bekend.length === 0 ? {} : { volgende: bekend[0] }),
  };
}

/** De volgorde-index van een bouwmoment, voor sorteren. */
export function ankerIndex(type: AnkerType): number {
  return ANKER_VOLGORDE.findIndex((a) => a.type === type);
}

// ── Kerncijfers ────────────────────────────────────────────────────────────

/**
 * Eén tegel op het dashboard.
 *
 * `ingevuld: false` betekent dat de gebruiker het onderliggende veld nog niet
 * heeft gevuld. De UI toont dan een streepje met een link, en níét `€ 0`.
 */
export interface Kerncijfer {
  ingevuld: boolean;
  /** Het getal zelf. Bij `ingevuld: false` betekenisloos. */
  waarde: number;
  /** Waar het tegen afgezet wordt, als dat bekend is. */
  van?: number;
  /** Vraagt dit cijfer aandacht? Kleurt de tegel. */
  alarm: boolean;
}

export interface Geldstand {
  vastgelegd: number;
  budget?: number;
  ruimte?: number;
}

export interface Depotcijfers {
  betaald: number;
  aantalTeDeclareren: number;
}

/**
 * Het meerwerkcijfer.
 *
 * `alarm` bij overschrijding van het budget — en alleen dán. Een leeg budget
 * is geen alarm maar een onbekende: de app weet niet of € 8.000 aan meerwerk
 * veel is als niemand heeft gezegd wat de grens was.
 */
export function meerwerkCijfer(stand: Geldstand): Kerncijfer {
  const heeftBudget = stand.budget !== undefined;
  return {
    // Zonder budget én zonder besteed meerwerk valt er niets te tonen.
    ingevuld: heeftBudget || stand.vastgelegd > 0,
    waarde: stand.vastgelegd,
    ...(stand.budget === undefined ? {} : { van: stand.budget }),
    alarm: stand.ruimte !== undefined && stand.ruimte < 0,
  };
}

/**
 * Het depotcijfer.
 *
 * `alarm` als er facturen klaarliggen die nog niet bij de bank zijn ingediend.
 * Dat is het enige punt in het depotproces waar de gebruiker zélf aan zet is —
 * wachten op de bank is geen werk, een niet-ingediende factuur wel.
 */
export function depotCijfer(stand: Depotcijfers, depotbedrag: number | undefined): Kerncijfer {
  return {
    ingevuld: depotbedrag !== undefined || stand.betaald > 0,
    waarde: stand.betaald,
    ...(depotbedrag === undefined ? {} : { van: depotbedrag }),
    alarm: stand.aantalTeDeclareren > 0,
  };
}

// ── Wat vraagt nú aandacht ─────────────────────────────────────────────────

const MS_PER_DAG = 86_400_000;

/** Standaardvenster: alles daarbuiten kan wachten. */
export const AANDACHTSVENSTER_DAGEN = 30;

/** Het minimum dat een regel nodig heeft om gesplitst te kunnen worden. */
export interface Aandachtsregel {
  urgentie: string;
  datum?: Date;
}

export interface Aandachtsplitsing<T> {
  /** Urgent, of binnen het venster. Standaard zichtbaar. */
  nu: readonly T[];
  /** De rest — achter een uitklap. */
  later: readonly T[];
}

/**
 * Splitst een lijst in "hier moet je nu naar kijken" en "dit kan wachten".
 *
 * WAAROM DIT BESTAAT. Bij de live test van 2 augustus stonden er veertien
 * partijen op het dashboard, waarvan er twaalf op "kan nog even" stonden.
 * Veertien regels waarvan er twaalf niet urgent zijn is geen werklijst maar
 * een archief — en dan lees je ook de twee die er wél toe doen niet meer.
 *
 * TWEE INGANGEN, want urgentie en tijd zijn niet hetzelfde:
 *
 * - `kritiek` en `hoog` komen áltijd naar boven, ook als de datum nog ver weg
 *   is. Een keukenleverancier met tien weken aanlooptijd moet je nú bellen,
 *   juist omdat het over drie maanden pas gebeurt.
 * - Alles binnen `venster` komt naar boven, ook als de urgentie laag is. Wat
 *   volgende week gebeurt is per definitie relevant.
 *
 * Een regel zónder datum telt als "later": zonder datum valt er niets te
 * plannen, en hij zou anders elke dag bovenaan blijven staan zonder dat er
 * iets verandert.
 */
export function splitsOpAandacht<T extends Aandachtsregel>(
  regels: readonly T[],
  nu: Date,
  venster: number = AANDACHTSVENSTER_DAGEN,
): Aandachtsplitsing<T> {
  const binnen: T[] = [];
  const buiten: T[] = [];

  for (const regel of regels) {
    const urgent = regel.urgentie === "kritiek" || regel.urgentie === "hoog";
    const dagen =
      regel.datum === undefined
        ? undefined
        : Math.round((regel.datum.getTime() - nu.getTime()) / MS_PER_DAG);

    // Een verstreken datum hoort óók bovenaan: die is niet "voorbij", die is te laat.
    const dichtbij = dagen !== undefined && dagen <= venster;

    if (urgent || dichtbij) binnen.push(regel);
    else buiten.push(regel);
  }

  return { nu: binnen, later: buiten };
}
