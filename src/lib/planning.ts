import type {
  AfspraakStatus,
  AnkerStatus,
  AnkerType,
  Communicatieregel,
  OpleverStatus,
} from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De rekenmotor — Nieuwbouwplanner
 *
 * Dit bestand bevat de eerste echte businesslogica van de app: het omrekenen
 * van ankers en offsets naar datums, en het bepalen van wie je nú moet
 * informeren. Zie ADR-0008 en ADR-0009.
 *
 * DRIE REGELS VOOR DIT BESTAND:
 *
 * 1. PUUR. Geen Firestore, geen React, geen `new Date()` zonder dat het als
 *    parameter binnenkomt. Alles wat hier gebeurt is te testen met gewone
 *    invoer en uitvoer, en dat is precies waarom het hier staat en niet in een
 *    component.
 *
 * 2. WERKT MET `Date`, NIET MET `Timestamp`. De conversie vanaf Firestore
 *    gebeurt aan de rand, in de datalaag. Zo blijft deze module vrij van de
 *    Firebase-SDK en draaien de tests zonder emulator.
 *
 * 3. REKENT IN HELE DAGEN OP UTC-MIDDERNACHT. Zomertijd maakt sommige dagen
 *    23 of 25 uur lang; wie in lokale tijd rekent, komt bij een offset van 42
 *    dagen een dag naast de waarheid uit rond eind maart en eind oktober.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const MS_PER_DAG = 86_400_000;

// ── Datumrekenwerk ─────────────────────────────────────────────────────────

/** Kapt tijd af naar UTC-middernacht, zodat dagverschillen heel blijven. */
export function opDag(datum: Date): Date {
  return new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
}

export function voegDagenToe(datum: Date, dagen: number): Date {
  return new Date(opDag(datum).getTime() + dagen * MS_PER_DAG);
}

/** Positief betekent: `a` ligt ná `b`. */
export function verschilInDagen(a: Date, b: Date): number {
  return Math.round((opDag(a).getTime() - opDag(b).getTime()) / MS_PER_DAG);
}

// ── Invoertypes ────────────────────────────────────────────────────────────
// Bewust lichter dan de Firestore-modellen: alleen wat de motor nodig heeft.
// Zo kan een test een scenario in drie regels opzetten.

export interface AnkerInvoer {
  type: AnkerType;
  status: AnkerStatus;
  verwachtOp?: Date;
}

export interface OpleverbandInvoer {
  status: OpleverStatus;
  vroegst?: Date;
  verwacht?: Date;
  laatst?: Date;
}

export interface PlanningContext {
  ankers: readonly AnkerInvoer[];
  opleverband?: OpleverbandInvoer;
}

export interface BetrokkeneInvoer {
  id: string;
  naam: string;
  aanlooptijdDagen: number;
  annuleertermijnDagen: number;
  communicatieregel: Communicatieregel;
}

export interface AfspraakInvoer {
  id: string;
  betrokkeneId: string;
  omschrijving: string;
  ankerType: AnkerType;
  offsetDagen: number;
  status: AfspraakStatus;
  gecommuniceerdeDatum?: Date;
  waarschuwing?: string;
}

// ── Uitvoertypes ───────────────────────────────────────────────────────────

/**
 * Hoe hard de berekende datum is (ADR-0009).
 *
 *   anker_bevestigd  het anker staat vast — de aannemer heeft het bevestigd
 *                    of het moment is al geweest
 *   anker_verwacht   het anker bestaat, maar de datum is een schatting
 *   teruggevallen    het gevraagde anker is onbekend; er is gerekend vanaf de
 *                    oplevering. De uitkomst kan er dagen tot weken naast zitten
 */
export type Zekerheid = "anker_bevestigd" | "anker_verwacht" | "teruggevallen";

/**
 * Een afgeleide datum is een band, geen punt — zolang de opleverdatum niet is
 * aangezegd (ADR-0008, principe 1). Bij `isPunt` vallen de drie samen en mag de
 * UI één datum tonen.
 */
export interface BerekendeBand {
  vroegst: Date;
  verwacht: Date;
  laatst: Date;
  isPunt: boolean;
  zekerheid: Zekerheid;
  /** Het anker waarop daadwerkelijk gerekend is. */
  gebruiktAnker: AnkerType;
  /** Het anker dat de afspraak vroeg. Wijkt af bij `teruggevallen`. */
  gevraagdAnker: AnkerType;
}

export type Urgentie = "kritiek" | "hoog" | "normaal" | "wacht" | "geen";

export interface ActieRegel {
  afspraakId: string;
  betrokkeneId: string;
  betrokkeneNaam: string;
  omschrijving: string;
  urgentie: Urgentie;
  /** Waarom er nú iets moet gebeuren. Toont de UI onder de regel. */
  reden: string;
  berekend: BerekendeBand;
  gecommuniceerdeDatum?: Date;
  /** Positief: de nieuwe datum ligt later dan wat de partij weet. */
  verschilDagen?: number;
  /** De laatste dag waarop deze afspraak nog kosteloos te verzetten is. */
  laatsteGratisSchuifdatum?: Date;
  waarschuwing?: string;
}

// ── berekenDatum ───────────────────────────────────────────────────────────

/**
 * Zoekt het anker met een bruikbare datum. Een anker zonder `verwachtOp` telt
 * niet: je weet dát het moment komt, niet wanneer.
 */
function vindAnkerMetDatum(
  ankers: readonly AnkerInvoer[],
  type: AnkerType,
): AnkerInvoer | undefined {
  return ankers.find((a) => a.type === type && a.verwachtOp !== undefined);
}

function zekerheidVan(status: AnkerStatus): Zekerheid {
  return status === "verwacht" ? "anker_verwacht" : "anker_bevestigd";
}

function bandUitOpleverband(
  band: OpleverbandInvoer,
): { vroegst: Date; verwacht: Date; laatst: Date } | undefined {
  const verwacht = band.verwacht ?? band.vroegst ?? band.laatst;
  if (verwacht === undefined) return undefined;
  return {
    vroegst: band.vroegst ?? verwacht,
    verwacht,
    laatst: band.laatst ?? verwacht,
  };
}

/**
 * Rekent een anker + offset om naar een datumband.
 *
 * Terugvalgedrag als het gevraagde anker onbekend is: er wordt gerekend vanaf
 * de oplevering, met `zekerheid: "teruggevallen"`. Dat is bewust — gebruiker #1
 * kent aan het begin alleen een indicatieve opleverdatum, en een lege planning
 * is nutteloos op precies het moment dat de app nodig is. Maar de uitkomst mag
 * er nooit uitzien als een harde datum: de UI moet `zekerheid` tonen en
 * benoemen wélk anker ontbreekt (ADR-0009).
 *
 * Retourneert `null` als er niets te rekenen valt: geen anker én geen
 * opleverdatum. Dan is er domweg geen informatie.
 */
export function berekenDatum(
  gevraagdAnker: AnkerType,
  offsetDagen: number,
  context: PlanningContext,
): BerekendeBand | null {
  // 1. Het anker zelf, als het een datum heeft.
  //    Uitzondering: voor `oplevering` gaat de band vóór het losse anker — de
  //    band draagt meer informatie (vroegst/laatst) dan één datum.
  const directAnker = vindAnkerMetDatum(context.ankers, gevraagdAnker);
  if (directAnker?.verwachtOp !== undefined && gevraagdAnker !== "oplevering") {
    const datum = voegDagenToe(directAnker.verwachtOp, offsetDagen);
    return {
      vroegst: datum,
      verwacht: datum,
      laatst: datum,
      isPunt: true,
      zekerheid: zekerheidVan(directAnker.status),
      gebruiktAnker: gevraagdAnker,
      gevraagdAnker,
    };
  }

  // 2. De opleverband.
  const opleverband = context.opleverband ? bandUitOpleverband(context.opleverband) : undefined;
  if (opleverband) {
    const teruggevallen = gevraagdAnker !== "oplevering";
    const aangezegd = context.opleverband?.status === "aangezegd";
    const vroegst = voegDagenToe(opleverband.vroegst, offsetDagen);
    const verwacht = voegDagenToe(opleverband.verwacht, offsetDagen);
    const laatst = voegDagenToe(opleverband.laatst, offsetDagen);
    return {
      vroegst,
      verwacht,
      laatst,
      isPunt: vroegst.getTime() === laatst.getTime(),
      zekerheid: teruggevallen ? "teruggevallen" : aangezegd ? "anker_bevestigd" : "anker_verwacht",
      gebruiktAnker: "oplevering",
      gevraagdAnker,
    };
  }

  // 3. Geen band, maar misschien wel een los oplevering-anker.
  const opleverAnker = vindAnkerMetDatum(context.ankers, "oplevering");
  if (opleverAnker?.verwachtOp !== undefined) {
    const datum = voegDagenToe(opleverAnker.verwachtOp, offsetDagen);
    return {
      vroegst: datum,
      verwacht: datum,
      laatst: datum,
      isPunt: true,
      zekerheid:
        gevraagdAnker === "oplevering" ? zekerheidVan(opleverAnker.status) : "teruggevallen",
      gebruiktAnker: "oplevering",
      gevraagdAnker,
    };
  }

  return null;
}

// ── bepaalUrgentie ─────────────────────────────────────────────────────────

/**
 * Hoeveel dagen je nog hebt voordat deze partij niet meer kosteloos te
 * verzetten is. De uitkomst is de laatste dag waarop schuiven nog gratis is —
 * het getal dat op het dashboard hoort, niet de opleverdatum zelf
 * (ADR-0008, principe 3).
 */
export function laatsteGratisSchuifdatum(
  berekend: BerekendeBand,
  annuleertermijnDagen: number,
): Date {
  // Op de vroegste datum uit de band, niet de verwachte: als het meevalt en de
  // oplevering vervroegt, is dát het moment waarop de deur dichtvalt.
  return voegDagenToe(berekend.vroegst, -annuleertermijnDagen);
}

interface UrgentieUitkomst {
  urgentie: Urgentie;
  reden: string;
}

/**
 * Bepaalt hoe dringend een afspraak is, en waaróm. De reden is geen sierletter:
 * een actielijst zonder motivering wordt weggeklikt.
 *
 * De volgorde van de checks is de prioriteit. Kritiek en hoog gaan vóór de
 * `bij_aanzegging`-rem — een partij die je niet meer gratis kunt verzetten,
 * moet je spreken, ook al staat de opleverdatum nog niet vast.
 */
export function bepaalUrgentie(
  afspraak: AfspraakInvoer,
  betrokkene: BetrokkeneInvoer,
  berekend: BerekendeBand,
  vandaag: Date,
  opleverStatus: OpleverStatus | undefined,
): UrgentieUitkomst {
  if (afspraak.status === "afgerond" || afspraak.status === "vervallen") {
    return { urgentie: "geen", reden: "Deze afspraak loopt niet meer." };
  }

  if (betrokkene.communicatieregel === "handmatig") {
    return {
      urgentie: "geen",
      reden: "Je hebt ingesteld dat je deze partij zelf benadert.",
    };
  }

  const gecommuniceerd = afspraak.gecommuniceerdeDatum;
  const afwijking =
    gecommuniceerd === undefined ? undefined : verschilInDagen(berekend.verwacht, gecommuniceerd);
  const erIsAfwijking =
    gecommuniceerd === undefined || (afwijking !== undefined && afwijking !== 0);

  if (!erIsAfwijking) {
    return { urgentie: "geen", reden: "Deze partij heeft de juiste datum." };
  }

  // ── Kritiek ────────────────────────────────────────────────────────────
  const gratisTot = laatsteGratisSchuifdatum(berekend, betrokkene.annuleertermijnDagen);
  const dagenTotGratisTot = verschilInDagen(gratisTot, vandaag);

  if (betrokkene.annuleertermijnDagen > 0 && dagenTotGratisTot <= 7) {
    return {
      urgentie: "kritiek",
      reden:
        dagenTotGratisTot < 0
          ? `Kosteloos verzetten kon tot ${dagenTotGratisTot * -1} dagen geleden — vanaf nu kost een wijziging geld.`
          : `Nog ${dagenTotGratisTot} dagen om kosteloos te verzetten.`,
    };
  }

  if (gecommuniceerd !== undefined) {
    const dagenTotOudeDatum = verschilInDagen(gecommuniceerd, vandaag);
    if (dagenTotOudeDatum >= 0 && dagenTotOudeDatum <= betrokkene.aanlooptijdDagen) {
      return {
        urgentie: "kritiek",
        reden: `Deze partij werkt nu naar een datum toe die niet meer klopt en staat straks voor niets klaar.`,
      };
    }
  }

  // ── Hoog ───────────────────────────────────────────────────────────────
  const dagenTotNieuweDatum = verschilInDagen(berekend.verwacht, vandaag);
  if (dagenTotNieuweDatum <= betrokkene.aanlooptijdDagen) {
    return {
      urgentie: "hoog",
      reden: `Ze hebben ${betrokkene.aanlooptijdDagen} dagen nodig en de nieuwe datum is over ${dagenTotNieuweDatum} dagen — ze moeten dit nu weten.`,
    };
  }

  // ── Wacht ──────────────────────────────────────────────────────────────
  if (betrokkene.communicatieregel === "bij_aanzegging" && opleverStatus !== "aangezegd") {
    return {
      urgentie: "wacht",
      reden:
        "Deze partij hoeft pas iets te weten als de opleverdatum formeel is aangezegd. " +
        "Nu mailen betekent straks nog een keer mailen.",
    };
  }

  // ── Normaal ────────────────────────────────────────────────────────────
  return {
    urgentie: "normaal",
    reden:
      gecommuniceerd === undefined
        ? "Deze afspraak is nog niet doorgegeven."
        : `De datum is ${Math.abs(afwijking ?? 0)} dagen ${(afwijking ?? 0) > 0 ? "opgeschoven" : "vervroegd"} sinds je hem doorgaf.`,
  };
}

// ── bouwActielijst ─────────────────────────────────────────────────────────

const URGENTIE_VOLGORDE: Record<Urgentie, number> = {
  kritiek: 0,
  hoog: 1,
  normaal: 2,
  wacht: 3,
  geen: 4,
};

/**
 * Zet afspraken om in een gesorteerde werklijst.
 *
 * Wat erin komt: elke lopende afspraak waarvan de berekende datum afwijkt van
 * wat de betreffende partij als laatste van je hoorde. Dat verschil ís de
 * actielijst (ADR-0008, principe 5) — niets meer, niets minder.
 *
 * Wat er niet in komt: afspraken die kloppen, afgeronde en vervallen
 * afspraken, en partijen die je handmatig beheert. Die verschijnen pas als er
 * werkelijk iets verandert.
 *
 * Gesorteerd op wat er kapotgaat als je niets doet, niet op alfabet of datum.
 */
export function bouwActielijst(
  afspraken: readonly AfspraakInvoer[],
  betrokkenen: readonly BetrokkeneInvoer[],
  context: PlanningContext,
  vandaag: Date,
): ActieRegel[] {
  const perId = new Map(betrokkenen.map((b) => [b.id, b]));
  const regels: ActieRegel[] = [];

  for (const afspraak of afspraken) {
    const betrokkene = perId.get(afspraak.betrokkeneId);
    if (!betrokkene) continue; // wees zonder partij: overslaan, niet crashen

    const berekend = berekenDatum(afspraak.ankerType, afspraak.offsetDagen, context);
    if (!berekend) continue; // niets bekend om op te rekenen

    const { urgentie, reden } = bepaalUrgentie(
      afspraak,
      betrokkene,
      berekend,
      vandaag,
      context.opleverband?.status,
    );
    if (urgentie === "geen") continue;

    const gecommuniceerd = afspraak.gecommuniceerdeDatum;

    regels.push({
      afspraakId: afspraak.id,
      betrokkeneId: betrokkene.id,
      betrokkeneNaam: betrokkene.naam,
      omschrijving: afspraak.omschrijving,
      urgentie,
      reden,
      berekend,
      ...(gecommuniceerd !== undefined
        ? {
            gecommuniceerdeDatum: gecommuniceerd,
            verschilDagen: verschilInDagen(berekend.verwacht, gecommuniceerd),
          }
        : {}),
      ...(betrokkene.annuleertermijnDagen > 0
        ? {
            laatsteGratisSchuifdatum: laatsteGratisSchuifdatum(
              berekend,
              betrokkene.annuleertermijnDagen,
            ),
          }
        : {}),
      ...(afspraak.waarschuwing !== undefined ? { waarschuwing: afspraak.waarschuwing } : {}),
    });
  }

  return regels.sort((a, b) => {
    const opUrgentie = URGENTIE_VOLGORDE[a.urgentie] - URGENTIE_VOLGORDE[b.urgentie];
    if (opUrgentie !== 0) return opUrgentie;
    return a.berekend.verwacht.getTime() - b.berekend.verwacht.getTime();
  });
}
