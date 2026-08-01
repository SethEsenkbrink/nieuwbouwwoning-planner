import type { OnderdeelMetId, OnderhoudTaakMetId } from "@/lib/converters";
import { overMaanden } from "@/lib/oplevering";
import { opDag, verschilInDagen, voegDagenToe } from "@/lib/planning";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Onderhoud — terugkerend werk aan de woning (ADR-0014)
 *
 * Puur TypeScript: geen Firestore, geen React, geen `new Date()` die niet als
 * parameter binnenkomt. Daardoor zonder emulator te testen.
 *
 * DE VOLGENDE BEURT WORDT NOOIT OPGESLAGEN (ADR-0008). Hij volgt uit
 * `laatstUitgevoerdOp` + `intervalDagen`, eventueel gecorrigeerd naar de
 * voorkeursmaand. Wat wél wordt opgeslagen is uitsluitend het verleden.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Waarop de berekening is gebaseerd. Dezelfde eerlijkheid als `zekerheid` bij
 * `berekenDatum()` (ADR-0009): "over drie maanden" na een echte beurt is iets
 * anders dan "over drie maanden" gerekend vanaf een aangenomen opleverdatum, en
 * dat verschil mag niet verdwijnen in de UI.
 */
export type OnderhoudBron = "uitgevoerd" | "installatie" | "oplevering";

export type Onderhoudsurgentie = "achterstallig" | "nu" | "binnenkort" | "later";

/** Binnen hoeveel dagen een beurt "binnenkort" heet. */
const BINNENKORT_DAGEN = 30;

export interface Onderhoudsstand {
  volgendeOp: Date;
  /** Negatief betekent: het had al gebeurd moeten zijn. */
  dagenResterend: number;
  bron: OnderhoudBron;
  urgentie: Onderhoudsurgentie;
  /** De datum waarop gerekend is — handig om in de UI te verantwoorden. */
  gerekendVanaf: Date;
  /** Is de datum verschoven door `voorkeursmaand`? */
  verschovenNaarMaand: boolean;

  /**
   * De fabrieksgarantie van het gekoppelde onderdeel verloopt vóór de volgende
   * beurt (blok E4). Dan telt die datum, niet het interval.
   *
   * Dit is het moment waarop informatie geld waard is: laat je de warmtepomp
   * nakijken zolang de garantie loopt, dan betaalt de fabrikant een defect.
   * Een dag later is het je eigen rekening.
   *
   * LET OP: dit verandert het INTERVAL niet. Het is een eenmalige, vervroegde
   * deadline. Is de beurt gedaan, dan loopt de reeks weer op `intervalDagen`
   * verder — de garantie komt immers niet terug.
   */
  garantieVerlooptOp?: Date;
}

/**
 * Verschuift een datum naar de dichtstbijzijnde voorkomen van `maand` (1–12).
 *
 * WAAROM DE DICHTSTBIJZIJNDE EN NIET DE EERSTVOLGENDE ERNA (ADR-0014 §1).
 * "Eerstvolgende erna" zou na één keer verkeerd afvinken negentien maanden
 * opleveren: goten gedaan in maart, interval 365 → maart volgend jaar → de
 * eerstvolgende oktober daarna is pas het jaar erop. De fout zou zichzelf in
 * stand houden. Bij onderhoud is te vroeg nooit fout en te laat wel, dus de
 * correctie mag naar voren.
 *
 * `nietVoor` IS DE ONDERGRENS DIE DAT BEGRENST, en die is niet optioneel-voor-
 * de-sier. Zonder hem kan de correctie tot vóór de laatste beurt schuiven zodra
 * het interval korter is dan een jaar:
 *
 *   interval 182 + voorkeursmaand oktober, laatst gedaan 15 oktober
 *     → berekend 15 april, kandidaten oktober vorig jaar (182 dagen terug) en
 *       oktober dit jaar (183 vooruit) → de vroegste wint → 15 oktober,
 *       precies de dag van de beurt zelf.
 *
 * De taak is dan meteen achterstallig en blijft dat: elke keer afvinken levert
 * dezelfde datum op. Bij interval 30 schuift hij zelfs elke beurt een dag terug.
 * Vandaar: kandidaten op of vóór `nietVoor` vallen af.
 *
 * De dag van de maand blijft behouden, geklemd op de laatste dag — dezelfde
 * valkuil die `overMaanden()` in `oplevering.ts` afvangt.
 */
export function naarMaand(datum: Date, maand: number, nietVoor?: Date): Date {
  const jaar = datum.getUTCFullYear();
  const dag = datum.getUTCDate();
  const doelMaand = maand - 1; // JS telt maanden vanaf 0.

  // Vier jaren, zodat er ook bij een meerjarig interval altijd een kandidaat
  // ná de ondergrens overblijft.
  const alle = [jaar - 1, jaar, jaar + 1, jaar + 2].map((j) => {
    const laatsteDag = new Date(Date.UTC(j, doelMaand + 1, 0)).getUTCDate();
    return new Date(Date.UTC(j, doelMaand, Math.min(dag, laatsteDag)));
  });

  const bruikbaar =
    nietVoor === undefined ? alle : alle.filter((k) => k.getTime() > nietVoor.getTime());

  // Destructureren in plaats van indexeren: dan is `eerste` gewoon
  // `Date | undefined` en volstaat één check, zonder cast of `!`-assertion.
  // Blijft er niets over — alleen mogelijk bij een absurde combinatie — dan is
  // de onveranderde datum beter dan een datum in het verleden.
  const [eerste, ...rest] = bruikbaar;
  if (eerste === undefined) return datum;

  let beste = eerste;
  for (const kandidaat of rest) {
    const afstand = Math.abs(kandidaat.getTime() - datum.getTime());
    if (afstand < Math.abs(beste.getTime() - datum.getTime())) beste = kandidaat;
  }
  return beste;
}

export interface OnderhoudContext {
  /**
   * Het onderdeel waar de taak aan hangt, als dat er is. `garantieMaanden`
   * hoort erbij sinds blok E4: een aflopende garantie vervroegt de beurt.
   */
  onderdeel?: Pick<OnderdeelMetId, "installatieDatum" | "garantieMaanden"> | undefined;
  /** De opleverdatum van het project — het laatste vangnet. */
  opleverdatum?: Date | undefined;
}

/**
 * Wanneer moet deze taak weer gebeuren.
 *
 * `null` als er geen enkel startpunt is: nooit uitgevoerd, geen onderdeel met
 * installatiedatum, en geen opleverdatum. Dan valt er niets te berekenen, en
 * een verzonnen startpunt zou een datum opleveren die er betrouwbaar uitziet
 * zonder dat te zijn.
 */
export function berekenVolgendeOnderhoud(
  taak: Pick<
    OnderhoudTaakMetId,
    "intervalDagen" | "laatstUitgevoerdOp" | "voorkeursmaand"
  >,
  context: OnderhoudContext,
  vandaag: Date,
): Onderhoudsstand | null {
  const { basis, bron } = bepaalBasis(taak, context) ?? {};
  if (basis === undefined || bron === undefined) return null;

  const zonderCorrectie = voegDagenToe(basis, taak.intervalDagen);
  // `basis` als ondergrens: de correctie mag nooit tot op of vóór de laatste
  // beurt schuiven. Zie de uitleg bij `naarMaand()`.
  const uitInterval =
    taak.voorkeursmaand === undefined
      ? zonderCorrectie
      : naarMaand(zonderCorrectie, taak.voorkeursmaand, basis);

  // ── De garantiedeadline (blok E4) ────────────────────────────────────────
  // Verloopt de fabrieksgarantie vóór de volgende geplande beurt, dan telt die
  // datum. Alleen als hij in de TOEKOMST ligt: een garantie die al voorbij is
  // levert geen deadline meer op, alleen spijt.
  const garantie = garantieEinde(context.onderdeel);
  const vervroegd =
    garantie !== null &&
    garantie.getTime() > vandaag.getTime() &&
    garantie.getTime() < uitInterval.getTime();

  const volgendeOp = vervroegd && garantie ? garantie : uitInterval;
  const dagenResterend = verschilInDagen(volgendeOp, vandaag);

  return {
    volgendeOp,
    dagenResterend,
    bron,
    urgentie: bepaalUrgentie(dagenResterend),
    gerekendVanaf: basis,
    // De voorkeursmaand-correctie geldt over het interval, ook als de garantie
    // daarna nog vervroegt — anders zou de UI de verschuiving verzwijgen.
    verschovenNaarMaand: uitInterval.getTime() !== zonderCorrectie.getTime(),
    ...(vervroegd && garantie ? { garantieVerlooptOp: garantie } : {}),
  };
}

/**
 * De einddatum van de fabrieksgarantie op een onderdeel, of `null`.
 *
 * Dezelfde berekening als `berekenGarantieklok()` in `lib/onderdelen.ts`, maar
 * die functie leeft aan de andere kant van de scheiding: `onderdelen.ts` gaat
 * over het register, dit bestand over de planning. Ze importeren elkaar niet,
 * en dat is opzet — anders krijg je een cirkel zodra het register ooit iets uit
 * de planning nodig heeft.
 */
function garantieEinde(
  onderdeel: Pick<OnderdeelMetId, "installatieDatum" | "garantieMaanden"> | undefined,
): Date | null {
  if (!onderdeel?.installatieDatum) return null;
  const maanden = onderdeel.garantieMaanden;
  if (maanden === undefined || maanden <= 0) return null;
  return overMaanden(onderdeel.installatieDatum, maanden);
}

/**
 * Het startpunt, in volgorde van betrouwbaarheid (ADR-0014 §4). De eerste die
 * er is, wint.
 */
function bepaalBasis(
  taak: Pick<OnderhoudTaakMetId, "laatstUitgevoerdOp">,
  context: OnderhoudContext,
): { basis: Date; bron: OnderhoudBron } | null {
  if (taak.laatstUitgevoerdOp) {
    return { basis: opDag(taak.laatstUitgevoerdOp), bron: "uitgevoerd" };
  }
  if (context.onderdeel?.installatieDatum) {
    return { basis: opDag(context.onderdeel.installatieDatum), bron: "installatie" };
  }
  if (context.opleverdatum) {
    return { basis: opDag(context.opleverdatum), bron: "oplevering" };
  }
  return null;
}

function bepaalUrgentie(dagenResterend: number): Onderhoudsurgentie {
  if (dagenResterend < 0) return "achterstallig";
  if (dagenResterend === 0) return "nu";
  if (dagenResterend <= BINNENKORT_DAGEN) return "binnenkort";
  return "later";
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De onderhoudslijst
 *
 * Dit is de tegenhanger van de actielijst uit ADR-0008, maar dan voor de fase
 * ná de oplevering. Hij staat op dezelfde plek op het dashboard, en hij is —
 * bij gebrek aan e-mail (ADR-0014 §3) — de enige herinnering die er is.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Onderhoudsregel {
  taak: OnderhoudTaakMetId;
  stand: Onderhoudsstand;
  /** De naam van het gekoppelde onderdeel, als dat er is. */
  onderdeelNaam?: string;
}

const VOLGORDE: Record<Onderhoudsurgentie, number> = {
  achterstallig: 0,
  nu: 1,
  binnenkort: 2,
  later: 3,
};

/**
 * Alle taken met een berekenbare datum, op urgentie gesorteerd en binnen
 * dezelfde urgentie op datum.
 *
 * Taken zónder startpunt vallen weg: die kunnen niets zinnigs zeggen. Ze zijn
 * apart op te vragen met `takenZonderStartpunt()`, zodat ze niet stil
 * verdwijnen.
 */
export function maakOnderhoudslijst(
  taken: readonly OnderhoudTaakMetId[],
  onderdelen: readonly OnderdeelMetId[],
  opleverdatum: Date | undefined,
  vandaag: Date,
): Onderhoudsregel[] {
  const regels: Onderhoudsregel[] = [];

  for (const taak of taken) {
    const onderdeel = onderdelen.find((o) => o.id === taak.onderdeelId);
    const stand = berekenVolgendeOnderhoud(taak, { onderdeel, opleverdatum }, vandaag);
    if (!stand) continue;

    regels.push({
      taak,
      stand,
      ...(onderdeel ? { onderdeelNaam: onderdeel.naam } : {}),
    });
  }

  return regels.sort((a, b) => {
    const opUrgentie = VOLGORDE[a.stand.urgentie] - VOLGORDE[b.stand.urgentie];
    if (opUrgentie !== 0) return opUrgentie;

    const opDatum = a.stand.volgendeOp.getTime() - b.stand.volgendeOp.getTime();
    if (opDatum !== 0) return opDatum;

    return a.taak.titel.localeCompare(b.taak.titel, "nl");
  });
}

/**
 * Taken waarvoor geen startpunt te bepalen is. Die horen zichtbaar te blijven:
 * ze staan er wel, maar de app kan er nog niets over zeggen — meestal omdat de
 * opleverdatum nog ontbreekt.
 */
export function takenZonderStartpunt(
  taken: readonly OnderhoudTaakMetId[],
  onderdelen: readonly OnderdeelMetId[],
  opleverdatum: Date | undefined,
  vandaag: Date,
): OnderhoudTaakMetId[] {
  return taken.filter((taak) => {
    const onderdeel = onderdelen.find((o) => o.id === taak.onderdeelId);
    return berekenVolgendeOnderhoud(taak, { onderdeel, opleverdatum }, vandaag) === null;
  });
}

/**
 * Onderdelen waarvan de garantie binnenkort afloopt en waar nog géén
 * onderhoudstaak aan hangt (blok E4).
 *
 * Dit is het gat tussen weten en doen: het register kent de garantiedatum, maar
 * zonder taak gebeurt er niets mee. De UI biedt hier één klik om alsnog een
 * taak aan te maken.
 *
 * Onderdelen mét een taak vallen hier weg — die worden al vervroegd via
 * `garantieVerlooptOp` op de stand, en twee keer waarschuwen voor hetzelfde is
 * ruis.
 */
export function garantiesZonderTaak(
  onderdelen: readonly OnderdeelMetId[],
  taken: readonly OnderhoudTaakMetId[],
  vandaag: Date,
  binnenDagen = 90,
): { onderdeel: OnderdeelMetId; verlooptOp: Date; dagenResterend: number }[] {
  const gekoppeld = new Set(
    taken.map((t) => t.onderdeelId).filter((id): id is string => id !== undefined),
  );

  return onderdelen
    .filter((o) => !gekoppeld.has(o.id))
    .flatMap((onderdeel) => {
      const verlooptOp = garantieEinde(onderdeel);
      if (verlooptOp === null) return [];

      const dagenResterend = verschilInDagen(verlooptOp, vandaag);
      if (dagenResterend < 0 || dagenResterend > binnenDagen) return [];

      return [{ onderdeel, verlooptOp, dagenResterend }];
    })
    .sort((a, b) => a.dagenResterend - b.dagenResterend);
}

export interface Onderhoudsstanden {
  totaal: number;
  achterstallig: number;
  binnenkort: number;
  /** Taken zonder berekenbare datum. */
  onbekend: number;
}

export function telOnderhoud(
  taken: readonly OnderhoudTaakMetId[],
  onderdelen: readonly OnderdeelMetId[],
  opleverdatum: Date | undefined,
  vandaag: Date,
): Onderhoudsstanden {
  const regels = maakOnderhoudslijst(taken, onderdelen, opleverdatum, vandaag);

  let achterstallig = 0;
  let binnenkort = 0;
  for (const regel of regels) {
    if (regel.stand.urgentie === "achterstallig") achterstallig += 1;
    else if (regel.stand.urgentie === "nu" || regel.stand.urgentie === "binnenkort")
      binnenkort += 1;
  }

  return {
    totaal: taken.length,
    achterstallig,
    binnenkort,
    onbekend: taken.length - regels.length,
  };
}

/**
 * Leesbare weergave van een interval. "Elke 365 dagen" zegt minder dan
 * "jaarlijks", en de gebruiker denkt in de tweede vorm.
 */
export function toonInterval(dagen: number): string {
  if (dagen % 365 === 0 && dagen >= 365) {
    const jaren = dagen / 365;
    return jaren === 1 ? "jaarlijks" : `elke ${jaren} jaar`;
  }
  if (dagen === 30 || dagen === 31) return "maandelijks";
  if (dagen === 90 || dagen === 91) return "per kwartaal";
  if (dagen === 182 || dagen === 183) return "halfjaarlijks";
  if (dagen % 30 === 0) return `elke ${dagen / 30} maanden`;
  if (dagen % 7 === 0) return dagen === 7 ? "wekelijks" : `elke ${dagen / 7} weken`;
  return `elke ${dagen} dagen`;
}

/** "1 dag" en niet "1 dagen". Wordt op twee schermen gebruikt. */
export function dagenOverTijd(dagenResterend: number): string {
  const dagen = Math.abs(dagenResterend);
  return dagen === 1 ? "1 dag over tijd" : `${dagen} dagen over tijd`;
}

export function dagenTeGaan(dagenResterend: number): string {
  return dagenResterend === 1 ? "over 1 dag" : `over ${dagenResterend} dagen`;
}

/**
 * Een voorkeursmaand bij een kort interval maakt de taak in de praktijk
 * jaarlijks: de correctie kan immers niet vóór de laatste beurt landen, dus de
 * eerstvolgende bruikbare voorkomen van die maand ligt een jaar verderop.
 *
 * Dat is geen fout maar wel bijna nooit de bedoeling — zout bijvullen "in
 * oktober" betekent tien maanden geen zout. De UI waarschuwt daarom.
 */
export function voorkeursmaandVerstoortInterval(
  intervalDagen: number,
  voorkeursmaand: number | undefined,
): boolean {
  return voorkeursmaand !== undefined && intervalDagen < 300;
}

const MAANDEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

/** `undefined` bij een maandnummer buiten 1–12, zodat rommel niet doorlekt. */
export function toonMaand(maand: number | undefined): string | undefined {
  if (maand === undefined || maand < 1 || maand > 12) return undefined;
  return MAANDEN[maand - 1];
}
