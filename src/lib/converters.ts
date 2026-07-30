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
  Garantiewaarborg,
  OpleverStatus,
  Project,
  WaardenBron,
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

export type ProjectData = MetDatums<Project>;
export type AnkerData = MetDatums<Anker>;
export type BetrokkeneData = MetDatums<Betrokkene>;
export type AfspraakData = MetDatums<Afspraak>;

/** Zoals hierboven, plus het Firestore-id dat pas bij het lezen bekend is. */
export type ProjectMetId = ProjectData & { id: string };
export type AnkerMetId = AnkerData & { id: string };
export type BetrokkeneMetId = BetrokkeneData & { id: string };
export type AfspraakMetId = AfspraakData & { id: string };

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

/**
 * De acht ankertypes, ook bruikbaar in de UI voor een keuzelijst.
 * Dezelfde lijst staat in `firebase/firestore.rules` (`ankerTypes()`) en in
 * `docs/2026-07-29-betrokkenen-standaardlijst.md`. Wijzig je er één, wijzig
 * dan alle drie.
 */
export const ALLE_ANKERTYPES = ANKERTYPES;
export const ALLE_CATEGORIEEN = CATEGORIEEN;

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
