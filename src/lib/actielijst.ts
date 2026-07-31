import type { AfspraakMetId, AnkerMetId, BetrokkeneMetId, ProjectData } from "@/lib/converters";
import {
  bouwActielijst,
  type ActieRegel,
  type AfspraakInvoer,
  type AnkerInvoer,
  type BetrokkeneInvoer,
  type PlanningContext,
} from "@/lib/planning";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De brug tussen Firestore-documenten en de rekenmotor
 *
 * `planning.ts` is puur en kent alleen zijn eigen lichte invoertypes. De
 * datalaag levert documenten met id's, optionele velden en Firestore-eigenaardig-
 * heden. Dit bestand vertaalt het één naar het ander — en niets meer.
 *
 * WAAROM DIT NIET IN HET DASHBOARD STAAT
 * De vertaling bevat twee beslissingen die fout kunnen gaan zonder dat je het
 * ziet: wanneer telt de opleverband mee, en wat doe je met een anker zonder
 * datum. In een component zijn die niet te testen zonder de hele React-boom en
 * de Firebase-SDK op te tuigen. Hier wel, met gewone objecten in en een lijst
 * uit.
 *
 * Dit bestand importeert bewust alléén types uit `converters.ts` — die import
 * verdwijnt bij het compileren, dus de Firebase-SDK wordt hier nooit geladen en
 * de tests draaien zonder emulator.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Ankers zonder datum gaan wél mee naar de motor.
 *
 * `vindAnkerMetDatum()` in `planning.ts` slaat ze zelf over: je weet dát het
 * moment komt, niet wanneer. Ze hier alvast wegfilteren zou dezelfde regel op
 * twee plekken zetten, en dan is het een kwestie van tijd tot ze uit elkaar
 * lopen.
 */
export function naarAnkerInvoer(anker: AnkerMetId): AnkerInvoer {
  return {
    type: anker.type,
    status: anker.status,
    ...(anker.verwachtOp === undefined ? {} : { verwachtOp: anker.verwachtOp }),
  };
}

/**
 * Bouwt de context waarin gerekend wordt.
 *
 * De opleverband telt alleen mee als er een `opleverStatus` staat. Zonder die
 * staat weet de app niet of de datum indicatief of aangezegd is, en dat verschil
 * bepaalt wie je mag benaderen (ADR-0008, principe 1). Een datum zonder staat
 * zou stilzwijgend als "verwacht" gelden — precies het soort aanname dat
 * ADR-0009 wil uitbannen.
 */
export function naarPlanningContext(
  project: Pick<
    ProjectData,
    "opleverStatus" | "opleverVroegst" | "opleverVerwacht" | "opleverLaatst"
  >,
  ankers: readonly AnkerMetId[],
): PlanningContext {
  const status = project.opleverStatus;
  if (status === undefined) {
    return { ankers: ankers.map(naarAnkerInvoer) };
  }

  return {
    ankers: ankers.map(naarAnkerInvoer),
    opleverband: {
      status,
      ...(project.opleverVroegst === undefined ? {} : { vroegst: project.opleverVroegst }),
      ...(project.opleverVerwacht === undefined ? {} : { verwacht: project.opleverVerwacht }),
      ...(project.opleverLaatst === undefined ? {} : { laatst: project.opleverLaatst }),
    },
  };
}

export function naarBetrokkeneInvoer(betrokkene: BetrokkeneMetId): BetrokkeneInvoer {
  return {
    id: betrokkene.id,
    naam: betrokkene.naam,
    aanlooptijdDagen: betrokkene.aanlooptijdDagen,
    annuleertermijnDagen: betrokkene.annuleertermijnDagen,
    communicatieregel: betrokkene.communicatieregel,
  };
}

export function naarAfspraakInvoer(afspraak: AfspraakMetId): AfspraakInvoer {
  return {
    id: afspraak.id,
    betrokkeneId: afspraak.betrokkeneId,
    omschrijving: afspraak.omschrijving,
    ankerType: afspraak.ankerType,
    offsetDagen: afspraak.offsetDagen,
    status: afspraak.status,
    ...(afspraak.gecommuniceerdeDatum === undefined
      ? {}
      : { gecommuniceerdeDatum: afspraak.gecommuniceerdeDatum }),
    ...(afspraak.waarschuwing === undefined ? {} : { waarschuwing: afspraak.waarschuwing }),
  };
}

/** Alles bij elkaar: documenten in, werklijst uit. */
export function maakActielijst(
  project: Pick<
    ProjectData,
    "opleverStatus" | "opleverVroegst" | "opleverVerwacht" | "opleverLaatst"
  >,
  ankers: readonly AnkerMetId[],
  betrokkenen: readonly BetrokkeneMetId[],
  afspraken: readonly AfspraakMetId[],
  vandaag: Date,
): ActieRegel[] {
  return bouwActielijst(
    afspraken.map(naarAfspraakInvoer),
    betrokkenen.map(naarBetrokkeneInvoer),
    naarPlanningContext(project, ankers),
    vandaag,
  );
}

/**
 * Partijen die je zelf beheert komen nooit op de actielijst (`bepaalUrgentie`
 * geeft ze `geen`). Dat is de bedoeling, maar het scherm moet het wel melden —
 * anders lijkt het alsof ze vergeten zijn.
 */
export function telHandmatigeBetrokkenen(betrokkenen: readonly BetrokkeneMetId[]): number {
  return betrokkenen.filter((b) => b.communicatieregel === "handmatig").length;
}
