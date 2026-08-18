import type { MeterMetId, MeterstandMetId } from "@/lib/converters";
import { verschilInDagen } from "@/lib/planning";
import {
  CONFLICTERENDE_SOORTEN,
  METERBIBLIOTHEEK,
  OPNAME_VERS_DAGEN,
  meterdefinitieVoor,
} from "@/data/meters-standaard";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Meterstanden — rekenen over het verbruik (ADR-0015)
 *
 * Puur TypeScript: geen opslaglaag, geen React, geen `new Date()` die niet als
 * parameter binnenkomt.
 *
 * WAT HIER WORDT AFGELEID EN NOOIT OPGESLAGEN (ADR-0008, ADR-0015 §3):
 * het verbruik tussen twee standen, het aantal dagen ertussen, het gemiddelde
 * per dag, en de vergelijking met de vorige periode. Alle vier volgen uit
 * `stand` + `opgenomenOp`, en die twee zijn de enige feiten.
 *
 * Corrigeer je een verkeerd overgetypte stand, dan kloppen de periodes ervóór
 * én erná meteen weer. Was het verbruik opgeslagen, dan stond er na die
 * correctie een getal dat niet meer bij de standen past.
 *
 * DE VALKUIL DIE HIER WORDT AFGEVANGEN — een dalende stand.
 * `nieuw - oud` levert dan een groot negatief getal op dat de trend en het
 * gemiddelde vergiftigt. Oorzaken, in volgorde van waarschijnlijkheid:
 *
 *   1. een typefout bij het invoeren;
 *   2. de meter is vervangen en begint opnieuw bij 0;
 *   3. een mechanische meter is omgelopen (99999 → 00000).
 *
 * De app rekent geen van drieën recht. Automatisch compenseren betekent gokken
 * welke van de drie het was, en bij een typefout verbergt die compensatie de
 * fout. De periode krijgt daarom `betrouwbaar: false` met een reden, telt niet
 * mee in de trend, en de UI zegt wat er waarschijnlijk aan de hand is.
 *
 * Dat is dezelfde afweging als bij de ondergrens op `voorkeursmaand` en op de
 * garantiedeadline (sessie 06): een correctie zonder ondergrens produceert
 * stil een fout getal, en stil fout is erger dan zichtbaar niets.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Wat de naam van een meter is: de eigen naam, anders het bibliotheeklabel. */
export function meternaamVan(meter: Pick<MeterMetId, "soort" | "naam">): string {
  if (meter.naam !== undefined && meter.naam !== "") return meter.naam;
  return meterdefinitieVoor(meter.soort)?.label ?? "Naamloze meter";
}

/**
 * Het aantal decimalen dat bij deze meter hoort, voor de weergave.
 *
 * Bij `overig` staat er geen bruikbaar getal in de bibliotheek — die soort
 * dekt zowel een laadpaal in kWh als een tussenmeter in m³. Dan bepaalt de
 * gekozen eenheid het aantal: anders toont een eigen watermeter 12,345 m³ als
 * "12", en dat ziet eruit alsof de stand verkeerd is ingevoerd.
 */
export function decimalenVan(meter: Pick<MeterMetId, "soort" | "eenheid">): number {
  if (meter.soort === "overig") return meter.eenheid === "kWh" ? 0 : 3;
  return meterdefinitieVoor(meter.soort)?.decimalen ?? 0;
}

/** Telt deze meter een opbrengst in plaats van een kostenpost? */
export function isTeruglevering(meter: Pick<MeterMetId, "soort">): boolean {
  return meterdefinitieVoor(meter.soort)?.isTeruglevering ?? false;
}

/**
 * Leest een ingetypte meterstand.
 *
 * Twee Nederlandse gewoontes moeten eruit vóórdat `Number()` het ziet: de
 * komma als decimaalteken, en de punt als duizendtalscheiding. Zonder die
 * tweede wordt `"12.345"` stilzwijgend 12,345 — een factor 1000 mis. En dat
 * valt pas op bij de vólgende opname, die dan als "gedaald" wordt gemarkeerd;
 * bij de eerste opname op een meter valt het helemaal niet op.
 *
 * `undefined` bij alles wat geen bruikbaar, niet-negatief getal is. De UI
 * toont dan een foutmelding in plaats van iets op te slaan.
 */
export function leesStandInvoer(tekst: string): number | undefined {
  const opgeschoond = tekst
    .trim()
    // Een punt met precies drie cijfers erachter is een duizendtalscheiding.
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  if (!/^\d+(\.\d+)?$/.test(opgeschoond)) return undefined;

  const waarde = Number(opgeschoond);
  return Number.isFinite(waarde) && waarde >= 0 ? waarde : undefined;
}

/**
 * Chronologisch, oudste eerst.
 *
 * Bij twee opnames op dezelfde dag valt de volgorde terug op het document-id,
 * zodat de uitkomst stabiel is. Zonder die tweede sleutel zou de volgorde per
 * lees-ronde kunnen wisselen en zou het verbruik van die dag heen en weer
 * springen tussen twee waarden.
 */
export function sorteerOpnames(opnames: readonly MeterstandMetId[]): MeterstandMetId[] {
  return [...opnames].sort((a, b) => {
    const opDatum = a.opgenomenOp.getTime() - b.opgenomenOp.getTime();
    if (opDatum !== 0) return opDatum;
    return a.id.localeCompare(b.id);
  });
}

/** Alleen de opnames van één meter, chronologisch. */
export function opnamesVan(
  opnames: readonly MeterstandMetId[],
  meterId: string,
): MeterstandMetId[] {
  return sorteerOpnames(opnames.filter((o) => o.meterId === meterId));
}

/**
 * Waarom een periode niet te gebruiken is.
 *
 *   stand_gedaald        de nieuwe stand is lager dan de vorige;
 *   zelfde_dag           twee opnames op dezelfde dag — delen door nul dagen;
 *   volgt_op_zelfde_dag  het beginpunt is een van twee opnames van dezelfde
 *                        dag, en welke dat is ligt niet vast.
 */
export type Onbetrouwbaar = "stand_gedaald" | "zelfde_dag" | "volgt_op_zelfde_dag";

export interface Verbruiksperiode {
  van: Date;
  tot: Date;
  /** Altijd ≥ 1 bij een betrouwbare periode. */
  dagen: number;
  standVan: number;
  standTot: number;
  /** `null` zodra de periode onbetrouwbaar is — dan is er geen getal te geven. */
  verbruik: number | null;
  perDag: number | null;
  betrouwbaar: boolean;
  reden?: Onbetrouwbaar;
}

/**
 * Het verbruik tussen elk paar opeenvolgende opnames van één meter.
 *
 * Bij n opnames levert dit n−1 periodes op; bij minder dan twee opnames een
 * lege lijst. Eén stand zegt namelijk niets over verbruik — je hebt altijd een
 * beginpunt én een eindpunt nodig.
 */
export function berekenPeriodes(opnames: readonly MeterstandMetId[]): Verbruiksperiode[] {
  const gesorteerd = sorteerOpnames(opnames);
  const periodes: Verbruiksperiode[] = [];

  for (let i = 1; i < gesorteerd.length; i += 1) {
    const vorige = gesorteerd[i - 1];
    const huidige = gesorteerd[i];
    // `noUncheckedIndexedAccess` staat aan; de lus garandeert dat beide er
    // zijn, maar de compiler weet dat niet.
    if (vorige === undefined || huidige === undefined) continue;

    const dagen = verschilInDagen(huidige.opgenomenOp, vorige.opgenomenOp);
    const basis = {
      van: vorige.opgenomenOp,
      tot: huidige.opgenomenOp,
      dagen,
      standVan: vorige.stand,
      standTot: huidige.stand,
    };

    if (huidige.stand < vorige.stand) {
      periodes.push({
        ...basis,
        verbruik: null,
        perDag: null,
        betrouwbaar: false,
        reden: "stand_gedaald",
      });
      continue;
    }

    // Het beginpunt is één van twee opnames van dezelfde dag. Welke van de
    // twee dat is, hangt af van de sorteervolgorde — en die valt bij een
    // gelijke datum terug op het opslag-id, dat willekeurig is.
    //
    // Zonder deze check zou alleen de nul-dagen-periode zelf gemarkeerd zijn
    // en zou déze periode gewoon doorrekenen vanaf een willekeurige van de
    // twee. Dat is precies het soort stille correctie dat ADR-0015 §4 elders
    // afwijst: de app kiest dan een waarde in plaats van te melden dat er
    // twee kandidaten zijn.
    const vorigeVorige = gesorteerd[i - 2];
    if (
      vorigeVorige !== undefined &&
      verschilInDagen(vorige.opgenomenOp, vorigeVorige.opgenomenOp) <= 0
    ) {
      periodes.push({
        ...basis,
        verbruik: null,
        perDag: null,
        betrouwbaar: false,
        reden: "volgt_op_zelfde_dag",
      });
      continue;
    }

    // Twee opnames op dezelfde dag: het verbruik ertussen is wél bekend, maar
    // een gemiddelde per dag is dat niet — dat zou delen door nul zijn. De
    // hele periode als onbetrouwbaar markeren is eerlijker dan een verbruik
    // tonen naast een leeg gemiddelde.
    if (dagen <= 0) {
      periodes.push({
        ...basis,
        verbruik: null,
        perDag: null,
        betrouwbaar: false,
        reden: "zelfde_dag",
      });
      continue;
    }

    const verbruik = huidige.stand - vorige.stand;
    periodes.push({
      ...basis,
      verbruik,
      perDag: verbruik / dagen,
      betrouwbaar: true,
    });
  }

  return periodes;
}

export interface Verbruikstrend {
  laatste: Verbruiksperiode;
  vorige?: Verbruiksperiode;
  /**
   * Het verschil in gemiddeld verbruik per dag ten opzichte van de vorige
   * periode, in procenten. `undefined` zonder vergelijkbare vorige periode.
   *
   * Positief betekent MEER verbruik. Bij een terugleveringsmeter is dat juist
   * goed nieuws — de UI kent het onderscheid via `isTeruglevering()`, de
   * rekenkern bemoeit zich er niet mee.
   */
  verschilProcent?: number;
  richting: "meer" | "minder" | "gelijk" | "onbekend";
}

/** Binnen deze marge noemen we twee periodes gelijk in plaats van "meer" of "minder". */
const GELIJK_MARGE_PROCENT = 2;

/**
 * De laatste betrouwbare periode, met de daaraan voorafgaande betrouwbare
 * periode ernaast.
 *
 * Onbetrouwbare periodes worden overgeslagen in plaats van de trend te
 * blokkeren: één typefout in het midden van een reeks mag niet betekenen dat
 * er nooit meer een trend te zien is. Ze blijven wél zichtbaar in de
 * periodelijst, zodat de fout niet uit beeld verdwijnt.
 */
export function verbruikstrend(opnames: readonly MeterstandMetId[]): Verbruikstrend | null {
  const betrouwbaar = berekenPeriodes(opnames).filter((p) => p.betrouwbaar);
  const laatste = betrouwbaar.at(-1);
  if (laatste === undefined) return null;

  const vorige = betrouwbaar.at(-2);
  if (vorige === undefined || laatste.perDag === null || vorige.perDag === null) {
    return { laatste, richting: "onbekend" };
  }

  // Delen door nul: was de vorige periode nul verbruik, dan is een percentage
  // niet te geven. Dat is geen randgeval — bij een terugleveringsmeter in
  // december is nul een normale uitkomst.
  if (vorige.perDag === 0) {
    return {
      laatste,
      vorige,
      richting: laatste.perDag === 0 ? "gelijk" : "meer",
    };
  }

  const verschilProcent = ((laatste.perDag - vorige.perDag) / vorige.perDag) * 100;
  const richting =
    Math.abs(verschilProcent) < GELIJK_MARGE_PROCENT
      ? "gelijk"
      : verschilProcent > 0
        ? "meer"
        : "minder";

  return { laatste, vorige, verschilProcent, richting };
}

export interface Meterstandsoverzicht {
  meter: MeterMetId;
  naam: string;
  laatste?: MeterstandMetId;
  /** Dagen sinds de laatste opname. `undefined` als er nog geen opname is. */
  dagenSindsOpname?: number;
  /** Er is nog nooit een stand genoteerd, of de laatste is te oud. */
  opnameAchterstallig: boolean;
  periodes: Verbruiksperiode[];
  trend: Verbruikstrend | null;
  /** Hoeveel periodes er niet klopten. Aanleiding om de reeks na te lopen. */
  aantalOnbetrouwbaar: number;
}

/**
 * Alles wat het scherm van één meter nodig heeft, in één keer gerekend.
 *
 * Bewust één functie in plaats van vijf losse aanroepen vanuit de component:
 * dan staat de volgorde van het sorteren en filteren op één plek, en kan een
 * test hem in z'n geheel narekenen.
 */
export function overzichtVoorMeter(
  meter: MeterMetId,
  alleOpnames: readonly MeterstandMetId[],
  vandaag: Date,
): Meterstandsoverzicht {
  const opnames = opnamesVan(alleOpnames, meter.id);
  const laatste = opnames.at(-1);
  const periodes = berekenPeriodes(opnames);

  // Afgekapt op nul: een opname met een datum in de toekomst (een typefout in
  // het jaartal) zou anders een negatief aantal dagen opleveren, en dat lekt
  // als "-240 dagen geleden" de UI in. De invoer weigert een toekomstdatum,
  // maar data die vóór die check is opgeslagen bestaat mogelijk nog.
  const dagenSindsOpname =
    laatste === undefined
      ? undefined
      : Math.max(0, verschilInDagen(vandaag, laatste.opgenomenOp));

  return {
    meter,
    naam: meternaamVan(meter),
    ...(laatste === undefined ? {} : { laatste }),
    ...(dagenSindsOpname === undefined ? {} : { dagenSindsOpname }),
    // Nog nooit een stand genoteerd telt óók als achterstallig: een meter
    // zonder enkele opname is precies de meter waar je aan herinnerd wilt
    // worden.
    opnameAchterstallig: dagenSindsOpname === undefined || dagenSindsOpname > OPNAME_VERS_DAGEN,
    periodes,
    trend: verbruikstrend(opnames),
    aantalOnbetrouwbaar: periodes.filter((p) => !p.betrouwbaar).length,
  };
}

/** Alle meters met hun overzicht, gesorteerd op wat aandacht vraagt. */
export function overzichtVoorAlleMeters(
  meters: readonly MeterMetId[],
  opnames: readonly MeterstandMetId[],
  vandaag: Date,
): Meterstandsoverzicht[] {
  const overzichten = meters.map((m) => overzichtVoorMeter(m, opnames, vandaag));

  // Achterstallige meters bovenaan, daarna de volgorde van de bibliotheek
  // (stroom vóór gas vóór water) en tot slot op naam. Eigen meters komen
  // achteraan, want die staan als `overig` onderaan de bibliotheek.
  return overzichten.sort((a, b) => {
    if (a.opnameAchterstallig !== b.opnameAchterstallig) return a.opnameAchterstallig ? -1 : 1;

    const opSoort = soortVolgorde(a.meter.soort) - soortVolgorde(b.meter.soort);
    if (opSoort !== 0) return opSoort;

    return a.naam.localeCompare(b.naam, "nl");
  });
}

function soortVolgorde(soort: MeterMetId["soort"]): number {
  const i = METERBIBLIOTHEEK.findIndex((m) => m.soort === soort);
  return i === -1 ? METERBIBLIOTHEEK.length : i;
}

/**
 * Een getal met het juiste aantal decimalen, in Nederlandse notatie.
 *
 * Vast aantal decimalen en niet "zoveel als nodig": een gasstand van 1234,500
 * hoort er hetzelfde uit te zien als 1234,567, anders lijkt de ene preciezer
 * afgelezen dan de andere.
 */
export function toonStand(waarde: number, decimalen: number): string {
  return waarde.toLocaleString("nl-NL", {
    minimumFractionDigits: decimalen,
    maximumFractionDigits: decimalen,
  });
}

/**
 * Verbruik per dag. Krijgt één decimaal extra ten opzichte van de meter zelf:
 * een woning verbruikt ~8 kWh per dag, en afronden op hele kWh zou het
 * verschil tussen 8,4 en 8,6 wegpoetsen — precies waar je naar kijkt.
 */
export function toonPerDag(waarde: number, decimalen: number): string {
  return toonStand(waarde, decimalen + 1);
}

/** De eenheid zoals je hem schrijft: m3 wordt m³. */
export function toonEenheid(eenheid: MeterMetId["eenheid"]): string {
  return eenheid === "m3" ? "m³" : eenheid;
}

/** Meters waarvan de laatste opname te lang geleden is — voor het dashboard. */
export function metersMetAchterstalligeOpname(
  meters: readonly MeterMetId[],
  opnames: readonly MeterstandMetId[],
  vandaag: Date,
): Meterstandsoverzicht[] {
  return overzichtVoorAlleMeters(meters, opnames, vandaag).filter((o) => o.opnameAchterstallig);
}

/**
 * Welke meters elkaar uitsluiten (enkeltarief naast dubbeltarief).
 *
 * Een WAARSCHUWING, geen blokkade: wie halverwege het jaar van contract
 * wisselt heeft tijdelijk beide reeksen, en dat mag de app niet onmogelijk
 * maken.
 */
export function conflicterendeMeters(meters: readonly MeterMetId[]): string[] {
  const aanwezig = new Set(meters.map((m) => m.soort));
  return CONFLICTERENDE_SOORTEN.filter((c) => c.soorten.every((s) => aanwezig.has(s))).map(
    (c) => c.melding,
  );
}
