import { Timestamp, type DocumentData } from "firebase/firestore";
import type {
  Afspraak,
  AfspraakStatus,
  Anker,
  AnkerStatus,
  AnkerType,
  Betrokkene,
  BetrokkeneCategorie,
  Communicatieregel,
  FaseStatus,
  FaseType,
  Garantiewaarborg,
  Gebrek,
  GebrekStatus,
  MeerwerkItem,
  MeerwerkSluiting,
  MeerwerkStatus,
  Nabudgetpost,
  NabudgetStatus,
  OpleverStatus,
  OpschortingStatus,
  Phase,
  Project,
  TaakBron,
  TaakStatus,
  Task,
  Termijn,
  WaardenBron,
  Energielabel,
  Woningpaspoort,
  WoningStatus,
  Woningtype,
} from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Firestore-converters — de rand van het systeem
 *
 * Dit bestand is de enige plek waar `Timestamp` en `Date` elkaar raken.
 *
 * WAAROM DIT BESTAAT
 * `src/types/model.ts` beschrijft wat er in Firestore staat, en dat is
 * `Timestamp`. `src/lib/planning.ts` rekent met `Date` en mag de Firebase-SDK
 * niet kennen (anders zijn de tests niet meer zonder emulator te draaien).
 * Ergens moet die vertaling gebeuren. Hier dus, en nergens anders.
 *
 * TWEE DINGEN DIE FIRESTORE NIET PIKT
 *
 * 1. `undefined` als waarde. Een veld dat niet is ingevuld moet je WEGLATEN,
 *    niet op undefined zetten. `zonderLegeVelden()` doet dat.
 * 2. Een `Date` teruglezen. Wat je opslaat als Date komt terug als Timestamp.
 *    Vergeet je dat, dan krijg je `datum.getTime is not a function` op een plek
 *    ver van de oorzaak.
 *
 * De mappers zijn bewust expliciet per collectie geschreven in plaats van
 * generiek over veldnamen. Meer regels, maar de compiler controleert elk veld —
 * en bij een modelwijziging faalt de build hier, precies waar het moet.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Zet alle `Timestamp`-velden van een type om naar `Date`. */
export type MetDatums<T> = {
  [K in keyof T]: T[K] extends Timestamp
    ? Date
    : T[K] extends Timestamp | undefined
      ? Date | undefined
      : T[K];
};

export type WoningpaspoortData = MetDatums<Woningpaspoort>;

/**
 * `MetDatums` is bewust niet recursief: het mapt alleen `Timestamp` op het
 * bovenste niveau. Het woningpaspoort is een geneste map met een `Timestamp`
 * erin (`energielabelOpnameDatum`), en die zou dus ongemoeid blijven. Daarom
 * hier expliciet vervangen — zichtbaar in plaats van verstopt in een slim
 * mapped type dat bij de volgende geneste map opnieuw stilzwijgend faalt.
 */
export type ProjectData = Omit<MetDatums<Project>, "woningpaspoort"> & {
  woningpaspoort?: WoningpaspoortData;
};
export type AnkerData = MetDatums<Anker>;
export type BetrokkeneData = MetDatums<Betrokkene>;
export type AfspraakData = MetDatums<Afspraak>;
export type FaseData = MetDatums<Phase>;
export type TaakData = MetDatums<Task>;
export type MeerwerkData = MetDatums<MeerwerkItem>;
export type TermijnData = MetDatums<Termijn>;
export type GebrekData = MetDatums<Gebrek>;
export type NabudgetData = MetDatums<Nabudgetpost>;

/** Zoals hierboven, plus het Firestore-id dat pas bij het lezen bekend is. */
export type ProjectMetId = ProjectData & { id: string };
export type AnkerMetId = AnkerData & { id: string };
export type BetrokkeneMetId = BetrokkeneData & { id: string };
export type AfspraakMetId = AfspraakData & { id: string };
export type FaseMetId = FaseData & { id: string };
export type TaakMetId = TaakData & { id: string };
export type MeerwerkMetId = MeerwerkData & { id: string };
export type TermijnMetId = TermijnData & { id: string };
export type GebrekMetId = GebrekData & { id: string };
export type NabudgetMetId = NabudgetData & { id: string };

// ── Hulpjes ────────────────────────────────────────────────────────────────

/**
 * Verwijdert velden met waarde `undefined`. Firestore weigert die namelijk —
 * een leeg veld hoort afwezig te zijn, niet aanwezig-maar-leeg.
 */
export function zonderLegeVelden(data: DocumentData): DocumentData {
  const resultaat: DocumentData = {};
  // `DocumentData` heeft een `any`-indexsignatuur; expliciet als `unknown`
  // lezen houdt de type-aware lintregels tevreden zonder een cast per waarde.
  for (const [sleutel, waarde] of Object.entries(data) as [string, unknown][]) {
    if (waarde !== undefined) resultaat[sleutel] = waarde;
  }
  return resultaat;
}

function naarTimestamp(datum: Date | undefined): Timestamp | undefined {
  return datum === undefined ? undefined : Timestamp.fromDate(datum);
}

/**
 * Leest een datumveld uit een Firestore-document.
 *
 * Accepteert ook een kale `Date`, want zo komt het terug uit een lokale
 * schrijfactie voordat de server hem heeft bevestigd (latency compensation).
 * Alles wat geen van beide is, geldt als afwezig — een half document mag de
 * app niet laten crashen.
 */
function leesDatum(waarde: unknown): Date | undefined {
  if (waarde instanceof Timestamp) return waarde.toDate();
  if (waarde instanceof Date) return waarde;
  return undefined;
}

function leesString(waarde: unknown): string | undefined {
  return typeof waarde === "string" && waarde !== "" ? waarde : undefined;
}

function leesGetal(waarde: unknown): number | undefined {
  return typeof waarde === "number" && Number.isFinite(waarde) ? waarde : undefined;
}

/**
 * Leest een waarde die tot een vaste lijst moet behoren. Staat er iets anders,
 * dan komt `undefined` terug in plaats van een waarde waar de rest van de app
 * niet op gerekend heeft. De rules laten zoiets niet toe, maar data die vóór
 * een modelwijziging is geschreven wel.
 */
function leesEnum<T extends string>(waarde: unknown, toegestaan: readonly T[]): T | undefined {
  return typeof waarde === "string" && (toegestaan as readonly string[]).includes(waarde)
    ? (waarde as T)
    : undefined;
}

const GARANTIEWAARBORGEN = [
  "woningborg",
  "swk",
  "geen",
  "anders",
] as const satisfies readonly Garantiewaarborg[];
const OPLEVERSTATUSSEN = [
  "indicatief",
  "bandbreedte",
  "aangezegd",
] as const satisfies readonly OpleverStatus[];
const ANKERTYPES = [
  "start_bouw",
  "begane_grond_gestort",
  "ruwbouw_gereed",
  "wind_waterdicht",
  "dekvloer_gestort",
  "oplevering",
  "sleuteloverdracht",
  "einde_onderhoudstermijn",
] as const satisfies readonly AnkerType[];
const ANKERSTATUSSEN = [
  "verwacht",
  "bevestigd",
  "gepasseerd",
] as const satisfies readonly AnkerStatus[];
const CATEGORIEEN = [
  "installatie",
  "afbouw",
  "tuin",
  "verhuizing",
  "huidige_woning",
  "nuts",
  "financieel",
  "overig",
] as const satisfies readonly BetrokkeneCategorie[];
const COMMUNICATIEREGELS = [
  "direct",
  "bij_aanzegging",
  "handmatig",
] as const satisfies readonly Communicatieregel[];
const WAARDENBRONNEN = ["voorstel", "eigen"] as const satisfies readonly WaardenBron[];
const AFSPRAAKSTATUSSEN = [
  "concept",
  "voorlopig",
  "bevestigd",
  "afgerond",
  "vervallen",
] as const satisfies readonly AfspraakStatus[];
const FASETYPES = [
  "koop",
  "notaris",
  "financiering",
  "bouw",
  "oplevering",
  "onderhoud",
  "garantie",
] as const satisfies readonly FaseType[];
const FASESTATUSSEN = ["open", "bezig", "klaar"] as const satisfies readonly FaseStatus[];
const TAAKSTATUSSEN = ["open", "klaar"] as const satisfies readonly TaakStatus[];
const TAAKBRONNEN = ["handmatig", "geparsed"] as const satisfies readonly TaakBron[];
const MEERWERKSTATUSSEN = [
  "overweeg",
  "besteld",
  "bevestigd",
] as const satisfies readonly MeerwerkStatus[];
const OPSCHORTINGSTATUSSEN = [
  "onbekend",
  "niet_gebruikt",
  "in_depot",
  "vrijgegeven",
] as const satisfies readonly OpschortingStatus[];
const GEBREKSTATUSSEN = ["open", "hersteld"] as const satisfies readonly GebrekStatus[];
const NABUDGETSTATUSSEN = [
  "geraamd",
  "besteld",
  "betaald",
] as const satisfies readonly NabudgetStatus[];
const MEERWERKSLUITINGEN = [
  "vaste_datum",
  "bouwmoment",
  "onbekend",
] as const satisfies readonly MeerwerkSluiting[];
const WONINGSTATUSSEN = ["in_aanbouw", "opgeleverd"] as const satisfies readonly WoningStatus[];
const WONINGTYPES = [
  "tussenwoning",
  "hoekwoning",
  "twee_onder_een_kap",
  "vrijstaand",
  "appartement",
  "benedenwoning",
  "bovenwoning",
  "overig",
] as const satisfies readonly Woningtype[];
const ENERGIELABELS = [
  "A+++++",
  "A++++",
  "A+++",
  "A++",
  "A+",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
] as const satisfies readonly Energielabel[];

/**
 * De acht ankertypes, ook bruikbaar in de UI voor een keuzelijst.
 * Dezelfde lijst staat in `firebase/firestore.rules` (`ankerTypes()`) en in
 * `docs/2026-07-29-betrokkenen-standaardlijst.md`. Wijzig je er één, wijzig
 * dan alle drie.
 */
export const ALLE_ANKERTYPES = ANKERTYPES;
export const ALLE_CATEGORIEEN = CATEGORIEEN;
export const ALLE_WONINGTYPES = WONINGTYPES;
export const ALLE_ENERGIELABELS = ENERGIELABELS;

// ── Woningpaspoort (ADR-0013 §5) ───────────────────────────────────────────

/**
 * Het paspoort is een geneste map. Is er niets ingevuld, dan komt `undefined`
 * terug in plaats van een lege map: een leeg object zou in Firestore een veld
 * bezetten en in de UI als "ingevuld" tellen.
 */
function paspoortNaarFirestore(
  paspoort: WoningpaspoortData | undefined,
): DocumentData | undefined {
  if (!paspoort) return undefined;

  const inhoud = zonderLegeVelden({
    adres: paspoort.adres,
    postcode: paspoort.postcode,
    plaats: paspoort.plaats,
    woningtype: paspoort.woningtype,
    bouwjaar: paspoort.bouwjaar,
    woonoppervlakte: paspoort.woonoppervlakte,
    perceeloppervlakte: paspoort.perceeloppervlakte,
    energielabel: paspoort.energielabel,
    energielabelRegistratie: paspoort.energielabelRegistratie,
    energielabelOpnameDatum: naarTimestamp(paspoort.energielabelOpnameDatum),
    waarborgpolisnummer: paspoort.waarborgpolisnummer,
    notaris: paspoort.notaris,
    hypotheekverstrekker: paspoort.hypotheekverstrekker,
  });

  return Object.keys(inhoud).length === 0 ? undefined : inhoud;
}

function paspoortUitFirestore(waarde: unknown): WoningpaspoortData | undefined {
  if (typeof waarde !== "object" || waarde === null || Array.isArray(waarde)) return undefined;
  const data = waarde as DocumentData;

  const paspoort: WoningpaspoortData = {
    ...optioneel("adres", leesString(data.adres)),
    ...optioneel("postcode", leesString(data.postcode)),
    ...optioneel("plaats", leesString(data.plaats)),
    ...optioneel("woningtype", leesEnum(data.woningtype, WONINGTYPES)),
    ...optioneel("bouwjaar", leesGetal(data.bouwjaar)),
    ...optioneel("woonoppervlakte", leesGetal(data.woonoppervlakte)),
    ...optioneel("perceeloppervlakte", leesGetal(data.perceeloppervlakte)),
    ...optioneel("energielabel", leesEnum(data.energielabel, ENERGIELABELS)),
    ...optioneel("energielabelRegistratie", leesString(data.energielabelRegistratie)),
    ...optioneel("energielabelOpnameDatum", leesDatum(data.energielabelOpnameDatum)),
    ...optioneel("waarborgpolisnummer", leesString(data.waarborgpolisnummer)),
    ...optioneel("notaris", leesString(data.notaris)),
    ...optioneel("hypotheekverstrekker", leesString(data.hypotheekverstrekker)),
  };

  return Object.keys(paspoort).length === 0 ? undefined : paspoort;
}

// ── Project ────────────────────────────────────────────────────────────────

export function projectNaarFirestore(project: Partial<ProjectData>): DocumentData {
  return zonderLegeVelden({
    naam: project.naam,
    bouwnummer: project.bouwnummer,
    projectnaam: project.projectnaam,
    aannemer: project.aannemer,
    garantiewaarborg: project.garantiewaarborg,
    koopsom: project.koopsom,
    meerwerkbudget: project.meerwerkbudget,
    opleverStatus: project.opleverStatus,
    opleverVroegst: naarTimestamp(project.opleverVroegst),
    opleverVerwacht: naarTimestamp(project.opleverVerwacht),
    opleverLaatst: naarTimestamp(project.opleverLaatst),
    opleverBron: project.opleverBron,
    opleverBronDatum: naarTimestamp(project.opleverBronDatum),
    opschortingStatus: project.opschortingStatus,
    opschortingBedrag: project.opschortingBedrag,
    opschortingNotitie: project.opschortingNotitie,
    woningStatus: project.woningStatus,
    woningpaspoort: paspoortNaarFirestore(project.woningpaspoort),
    aangemaaktOp: naarTimestamp(project.aangemaaktOp),
    bijgewerktOp: naarTimestamp(project.bijgewerktOp),
  });
}

export function projectUitFirestore(id: string, data: DocumentData): ProjectMetId {
  return {
    id,
    naam: leesString(data.naam) ?? "Naamloos project",
    ...optioneel("bouwnummer", leesString(data.bouwnummer)),
    ...optioneel("projectnaam", leesString(data.projectnaam)),
    ...optioneel("aannemer", leesString(data.aannemer)),
    ...optioneel("garantiewaarborg", leesEnum(data.garantiewaarborg, GARANTIEWAARBORGEN)),
    ...optioneel("koopsom", leesGetal(data.koopsom)),
    ...optioneel("meerwerkbudget", leesGetal(data.meerwerkbudget)),
    ...optioneel("opleverStatus", leesEnum(data.opleverStatus, OPLEVERSTATUSSEN)),
    ...optioneel("opleverVroegst", leesDatum(data.opleverVroegst)),
    ...optioneel("opleverVerwacht", leesDatum(data.opleverVerwacht)),
    ...optioneel("opleverLaatst", leesDatum(data.opleverLaatst)),
    ...optioneel("opleverBron", leesString(data.opleverBron)),
    ...optioneel("opleverBronDatum", leesDatum(data.opleverBronDatum)),
    ...optioneel("opschortingStatus", leesEnum(data.opschortingStatus, OPSCHORTINGSTATUSSEN)),
    ...optioneel("opschortingBedrag", leesGetal(data.opschortingBedrag)),
    ...optioneel("opschortingNotitie", leesString(data.opschortingNotitie)),
    // Ontbreekt `woningStatus`, dan blijft hij afwezig en behandelt de app het
    // project als `in_aanbouw` — zie `isOpgeleverd()` in `lib/woning.ts`.
    // Projecten van vóór blok E hoeven dus niet gemigreerd te worden.
    ...optioneel("woningStatus", leesEnum(data.woningStatus, WONINGSTATUSSEN)),
    ...optioneel("woningpaspoort", paspoortUitFirestore(data.woningpaspoort)),
    aangemaaktOp: leesDatum(data.aangemaaktOp) ?? new Date(0),
    ...optioneel("bijgewerktOp", leesDatum(data.bijgewerktOp)),
  };
}

/**
 * Neemt een veld alleen op als er een waarde is.
 *
 * Nodig omdat `exactOptionalPropertyTypes` aan staat (ADR-0003): een optioneel
 * veld expliciet op `undefined` zetten is dan iets anders dan het weglaten, en
 * TypeScript accepteert het eerste niet.
 */
function optioneel<K extends string, T>(sleutel: K, waarde: T | undefined) {
  return (waarde === undefined ? {} : { [sleutel]: waarde }) as Partial<Record<K, T>>;
}

// ── Anker ──────────────────────────────────────────────────────────────────

export function ankerNaarFirestore(anker: Partial<AnkerData>): DocumentData {
  return zonderLegeVelden({
    type: anker.type,
    titel: anker.titel,
    verwachtOp: naarTimestamp(anker.verwachtOp),
    status: anker.status,
    bron: anker.bron,
  });
}

export function ankerUitFirestore(id: string, data: DocumentData): AnkerMetId {
  return {
    id,
    type: leesEnum(data.type, ANKERTYPES) ?? "oplevering",
    titel: leesString(data.titel) ?? "Onbekend bouwmoment",
    status: leesEnum(data.status, ANKERSTATUSSEN) ?? "verwacht",
    ...optioneel("verwachtOp", leesDatum(data.verwachtOp)),
    ...optioneel("bron", leesString(data.bron)),
  };
}

// ── Betrokkene ─────────────────────────────────────────────────────────────

export function betrokkeneNaarFirestore(betrokkene: Partial<BetrokkeneData>): DocumentData {
  return zonderLegeVelden({
    naam: betrokkene.naam,
    contactpersoon: betrokkene.contactpersoon,
    email: betrokkene.email,
    telefoon: betrokkene.telefoon,
    categorie: betrokkene.categorie,
    aanlooptijdDagen: betrokkene.aanlooptijdDagen,
    annuleertermijnDagen: betrokkene.annuleertermijnDagen,
    communicatieregel: betrokkene.communicatieregel,
    waardenBron: betrokkene.waardenBron,
    notitie: betrokkene.notitie,
  });
}

export function betrokkeneUitFirestore(id: string, data: DocumentData): BetrokkeneMetId {
  return {
    id,
    naam: leesString(data.naam) ?? "Onbekende partij",
    categorie: leesEnum(data.categorie, CATEGORIEEN) ?? "overig",
    // Terugval op 0: liever een partij zonder aanlooptijd op de lijst dan een
    // regel die stilletjes verdwijnt omdat één veld ontbrak.
    aanlooptijdDagen: leesGetal(data.aanlooptijdDagen) ?? 0,
    annuleertermijnDagen: leesGetal(data.annuleertermijnDagen) ?? 0,
    communicatieregel: leesEnum(data.communicatieregel, COMMUNICATIEREGELS) ?? "handmatig",
    waardenBron: leesEnum(data.waardenBron, WAARDENBRONNEN) ?? "voorstel",
    ...optioneel("contactpersoon", leesString(data.contactpersoon)),
    ...optioneel("email", leesString(data.email)),
    ...optioneel("telefoon", leesString(data.telefoon)),
    ...optioneel("notitie", leesString(data.notitie)),
  };
}

// ── Afspraak ───────────────────────────────────────────────────────────────

export function afspraakNaarFirestore(afspraak: Partial<AfspraakData>): DocumentData {
  return zonderLegeVelden({
    betrokkeneId: afspraak.betrokkeneId,
    omschrijving: afspraak.omschrijving,
    ankerType: afspraak.ankerType,
    offsetDagen: afspraak.offsetDagen,
    duurDagen: afspraak.duurDagen,
    status: afspraak.status,
    gecommuniceerdeDatum: naarTimestamp(afspraak.gecommuniceerdeDatum),
    gecommuniceerdOp: naarTimestamp(afspraak.gecommuniceerdOp),
    waarschuwing: afspraak.waarschuwing,
    notitie: afspraak.notitie,
  });
}

export function afspraakUitFirestore(id: string, data: DocumentData): AfspraakMetId {
  return {
    id,
    betrokkeneId: leesString(data.betrokkeneId) ?? "",
    omschrijving: leesString(data.omschrijving) ?? "Naamloze afspraak",
    ankerType: leesEnum(data.ankerType, ANKERTYPES) ?? "oplevering",
    offsetDagen: leesGetal(data.offsetDagen) ?? 0,
    status: leesEnum(data.status, AFSPRAAKSTATUSSEN) ?? "concept",
    ...optioneel("duurDagen", leesGetal(data.duurDagen)),
    ...optioneel("gecommuniceerdeDatum", leesDatum(data.gecommuniceerdeDatum)),
    ...optioneel("gecommuniceerdOp", leesDatum(data.gecommuniceerdOp)),
    ...optioneel("waarschuwing", leesString(data.waarschuwing)),
    ...optioneel("notitie", leesString(data.notitie)),
  };
}

// ── Fase ───────────────────────────────────────────────────────────────────

export function faseNaarFirestore(fase: Partial<FaseData>): DocumentData {
  return zonderLegeVelden({
    type: fase.type,
    titel: fase.titel,
    status: fase.status,
    streefdatum: naarTimestamp(fase.streefdatum),
    volgorde: fase.volgorde,
  });
}

export function faseUitFirestore(id: string, data: DocumentData): FaseMetId {
  return {
    id,
    type: leesEnum(data.type, FASETYPES) ?? "bouw",
    titel: leesString(data.titel) ?? "Naamloze fase",
    status: leesEnum(data.status, FASESTATUSSEN) ?? "open",
    ...optioneel("streefdatum", leesDatum(data.streefdatum)),
    ...optioneel("volgorde", leesGetal(data.volgorde)),
  };
}

// ── Taak ───────────────────────────────────────────────────────────────────

export function taakNaarFirestore(taak: Partial<TaakData>): DocumentData {
  return zonderLegeVelden({
    titel: taak.titel,
    deadline: naarTimestamp(taak.deadline),
    phaseId: taak.phaseId,
    status: taak.status,
    bron: taak.bron,
    notitie: taak.notitie,
  });
}

export function taakUitFirestore(id: string, data: DocumentData): TaakMetId {
  return {
    id,
    titel: leesString(data.titel) ?? "Naamloze taak",
    status: leesEnum(data.status, TAAKSTATUSSEN) ?? "open",
    // Terugval op "handmatig": een taak waarvan de herkomst onduidelijk is,
    // presenteren als uit een contract geparsed zou meer zekerheid suggereren
    // dan er is.
    bron: leesEnum(data.bron, TAAKBRONNEN) ?? "handmatig",
    ...optioneel("deadline", leesDatum(data.deadline)),
    ...optioneel("phaseId", leesString(data.phaseId)),
    ...optioneel("notitie", leesString(data.notitie)),
  };
}

// ── Meerwerk ───────────────────────────────────────────────────────────────

export function meerwerkNaarFirestore(item: Partial<MeerwerkData>): DocumentData {
  return zonderLegeVelden({
    omschrijving: item.omschrijving,
    bedrag: item.bedrag,
    sluiting: item.sluiting,
    sluitingsdatum: naarTimestamp(item.sluitingsdatum),
    sluitingAnkerType: item.sluitingAnkerType,
    sluitingOffsetDagen: item.sluitingOffsetDagen,
    phaseId: item.phaseId,
    status: item.status,
    notitie: item.notitie,
  });
}

export function meerwerkUitFirestore(id: string, data: DocumentData): MeerwerkMetId {
  return {
    id,
    omschrijving: leesString(data.omschrijving) ?? "Naamloos meerwerk",
    status: leesEnum(data.status, MEERWERKSTATUSSEN) ?? "overweeg",
    // Terugval op "onbekend": een item zonder geldige sluitingssoort als vaste
    // datum tonen zou een deadline suggereren die er niet is (ADR-0011).
    sluiting: leesEnum(data.sluiting, MEERWERKSLUITINGEN) ?? "onbekend",
    ...optioneel("bedrag", leesGetal(data.bedrag)),
    ...optioneel("sluitingsdatum", leesDatum(data.sluitingsdatum)),
    ...optioneel("sluitingAnkerType", leesEnum(data.sluitingAnkerType, ANKERTYPES)),
    ...optioneel("sluitingOffsetDagen", leesGetal(data.sluitingOffsetDagen)),
    ...optioneel("phaseId", leesString(data.phaseId)),
    ...optioneel("notitie", leesString(data.notitie)),
  };
}

// ── Termijn (bouwdepot) ────────────────────────────────────────────────────

export function termijnNaarFirestore(termijn: Partial<TermijnData>): DocumentData {
  return zonderLegeVelden({
    omschrijving: termijn.omschrijving,
    bedrag: termijn.bedrag,
    gefactureerd: termijn.gefactureerd,
    gefactureerdOp: naarTimestamp(termijn.gefactureerdOp),
    gedeclareerdBijBank: termijn.gedeclareerdBijBank,
    gedeclareerdOp: naarTimestamp(termijn.gedeclareerdOp),
    betaald: termijn.betaald,
    betaaldOp: naarTimestamp(termijn.betaaldOp),
  });
}

export function termijnUitFirestore(id: string, data: DocumentData): TermijnMetId {
  return {
    id,
    omschrijving: leesString(data.omschrijving) ?? "Naamloze termijn",
    // Terugval op false: een ontbrekende boolean als "gedaan" lezen zou een
    // openstaande declaratie laten verdwijnen uit het overzicht.
    gefactureerd: data.gefactureerd === true,
    gedeclareerdBijBank: data.gedeclareerdBijBank === true,
    betaald: data.betaald === true,
    ...optioneel("bedrag", leesGetal(data.bedrag)),
    ...optioneel("gefactureerdOp", leesDatum(data.gefactureerdOp)),
    ...optioneel("gedeclareerdOp", leesDatum(data.gedeclareerdOp)),
    ...optioneel("betaaldOp", leesDatum(data.betaaldOp)),
  };
}

// ── Gebrek (opleverpunt) ───────────────────────────────────────────────────

export function gebrekNaarFirestore(gebrek: Partial<GebrekData>): DocumentData {
  return zonderLegeVelden({
    omschrijving: gebrek.omschrijving,
    locatie: gebrek.locatie,
    gemeldOp: naarTimestamp(gebrek.gemeldOp),
    hersteltermijn: naarTimestamp(gebrek.hersteltermijn),
    status: gebrek.status,
  });
}

export function gebrekUitFirestore(id: string, data: DocumentData): GebrekMetId {
  return {
    id,
    omschrijving: leesString(data.omschrijving) ?? "Naamloos opleverpunt",
    // Terugval op "open": een gebrek waarvan de status onleesbaar is als
    // hersteld tonen zou het uit beeld halen terwijl het er nog kan zijn.
    status: leesEnum(data.status, GEBREKSTATUSSEN) ?? "open",
    ...optioneel("locatie", leesString(data.locatie)),
    ...optioneel("gemeldOp", leesDatum(data.gemeldOp)),
    ...optioneel("hersteltermijn", leesDatum(data.hersteltermijn)),
  };
}

// ── Nabudget (posten ná de oplevering) ─────────────────────────────────────

export function nabudgetNaarFirestore(post: Partial<NabudgetData>): DocumentData {
  return zonderLegeVelden({
    omschrijving: post.omschrijving,
    geraamd: post.geraamd,
    werkelijk: post.werkelijk,
    status: post.status,
    notitie: post.notitie,
  });
}

export function nabudgetUitFirestore(id: string, data: DocumentData): NabudgetMetId {
  return {
    id,
    omschrijving: leesString(data.omschrijving) ?? "Naamloze post",
    // Terugval op "geraamd": een post als betaald tonen die het niet is, haalt
    // hem uit het overzicht van wat er nog komt.
    status: leesEnum(data.status, NABUDGETSTATUSSEN) ?? "geraamd",
    ...optioneel("geraamd", leesGetal(data.geraamd)),
    ...optioneel("werkelijk", leesGetal(data.werkelijk)),
    ...optioneel("notitie", leesString(data.notitie)),
  };
}
