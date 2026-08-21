import { Timestamp } from "@/types/model";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocumentData = Record<string, any>;
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
  Hypotheekgegevens,
  Hypotheekvorm,
  KadastraleGegevens,
  MeerwerkItem,
  MeerwerkSluiting,
  MeerwerkStatus,
  Metereenheid,
  Metersoort,
  Meter,
  Meterstand,
  Nabudgetpost,
  NabudgetStatus,
  OpleverStatus,
  OpschortingStatus,
  Phase,
  Project,
  TaakBron,
  TaakStatus,
  Task,
  TrajectType,
  Termijn,
  WaardenBron,
  Energielabel,
  Montage,
  Onderdeel,
  OnderdeelCategorie,
  OnderhoudLogregel,
  OnderhoudTaak,
  Registratieplicht,
  Woningpaspoort,
  WoningStatus,
  Woningtype,
} from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Opslagconverters — de rand van het systeem
 *
 * Dit bestand is de enige plek waar `Timestamp` en `Date` elkaar raken.
 *
 * WAAROM DIT BESTAAT
 * `src/types/model.ts` beschrijft wat er in de opslag staat, en dat is
 * `Timestamp`. `src/lib/planning.ts` rekent met `Date` en mag de opslaglaag
 * niet kennen (anders zijn de tests niet meer zonder emulator te draaien).
 * Ergens moet die vertaling gebeuren. Hier dus, en nergens anders.
 *
 * TWEE DINGEN DIE DE OPSLAGVORM NIET PIKT
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
export type HypotheekData = MetDatums<Hypotheekgegevens>;
export type ProjectData = Omit<MetDatums<Project>, "woningpaspoort" | "hypotheek"> & {
  woningpaspoort?: WoningpaspoortData;
  hypotheek?: HypotheekData;
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

export type RegistratieplichtData = MetDatums<Registratieplicht>;
/** Zelfde reden als bij `ProjectData`: `registratieplicht` is een geneste map. */
export type OnderdeelData = Omit<MetDatums<Onderdeel>, "registratieplicht"> & {
  registratieplicht?: RegistratieplichtData;
};

/**
 * Wat een formulier oplevert: elk veld mag ontbreken én expliciet `undefined`
 * zijn.
 *
 * `Partial<T>` is dat NIET onder `exactOptionalPropertyTypes` (ADR-0003): daar
 * betekent `veld?: string` dat het veld weg mag, maar niet dat je er
 * `undefined` in mag zetten. Een leeggemaakt invoerveld levert precies dat op,
 * dus de `*NaarOpslag`-functies nemen dit type in plaats van `Partial`.
 * `zonderLegeVelden()` haalt de `undefined`s er alsnog uit vóór het opslaan.
 */
export type Invoer<T> = { [K in keyof T]?: T[K] | undefined };

export type OnderhoudTaakData = MetDatums<OnderhoudTaak>;
export type OnderhoudLogregelData = MetDatums<OnderhoudLogregel>;

export type MeterData = MetDatums<Meter>;
export type MeterstandData = MetDatums<Meterstand>;

/** Zoals hierboven, plus het opslag-id dat pas bij het lezen bekend is. */
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
export type OnderdeelMetId = OnderdeelData & { id: string };
export type OnderhoudTaakMetId = OnderhoudTaakData & { id: string };
export type OnderhoudLogregelMetId = OnderhoudLogregelData & { id: string };
export type MeterMetId = MeterData & { id: string };
export type MeterstandMetId = MeterstandData & { id: string };

// ── Hulpjes ────────────────────────────────────────────────────────────────

/**
 * Verwijdert velden met waarde `undefined`. Ze horen niet in een opgeslagen record —
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
 * Leest een datumveld uit een opslagdocument.
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
 * Zoals `leesGetal`, maar weigert ook negatieve waarden. Gebruikt voor de
 * meterstand: die telt op vanaf 0 en kan niet onder nul komen. Een negatieve
 * waarde zou twee opeenvolgende verbruiksperiodes onbruikbaar maken.
 */
function leesPositiefGetal(waarde: unknown): number | undefined {
  const getal = leesGetal(waarde);
  return getal !== undefined && getal >= 0 ? getal : undefined;
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
const TRAJECTTYPES = [
  "nieuwbouw",
  "bestaandeBouw",
] as const satisfies readonly TrajectType[];
const HYPOTHEEKVORMEN = [
  "annuitair",
  "lineair",
  "aflossingsvrij",
] as const satisfies readonly Hypotheekvorm[];
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
const ONDERDEELCATEGORIEEN_LIJST = [
  "verwarming",
  "ventilatie",
  "warm_water",
  "elektra",
  "opwekking",
  "opslag",
  "water",
  "zonwering",
  "dak",
  "gevel",
  "sanitair",
  "beveiliging",
  "overig",
] as const satisfies readonly OnderdeelCategorie[];
const MONTAGES = [
  "vast_geinstalleerd",
  "plug_and_play",
  "nvt",
] as const satisfies readonly Montage[];
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
const METERSOORTEN = [
  "stroom_enkel",
  "stroom_normaal",
  "stroom_dal",
  "teruglevering_enkel",
  "teruglevering_normaal",
  "teruglevering_dal",
  "gas",
  "water",
  "warmte",
  "overig",
] as const satisfies readonly Metersoort[];
const METEREENHEDEN = ["kWh", "m3", "GJ"] as const satisfies readonly Metereenheid[];

/**
 * De acht ankertypes, ook bruikbaar in de UI voor een keuzelijst.
 * Dezelfde lijst staat in `docs/archief/2026-07-29-betrokkenen-standaardlijst.md`.
 * Wijzig je er één, wijzig dan allebei.
 */
export const ALLE_ANKERTYPES = ANKERTYPES;
export const ALLE_CATEGORIEEN = CATEGORIEEN;
export const ALLE_WONINGTYPES = WONINGTYPES;
export const ALLE_ENERGIELABELS = ENERGIELABELS;

// ── Hypotheek (ADR-0019) ───────────────────────────────────────────────────

/**
 * De hypotheekgegevens zijn een geneste map met een `Timestamp` erin, net als
 * het woningpaspoort. `MetDatums` mapt alleen op het bovenste niveau, dus de
 * omzetting moet hier expliciet gebeuren.
 *
 * DIT BLOK ONTBRAK. `Hypotheekgegevens` staat sinds ADR-0019 in het model en
 * `rules/financieel.ts` leest `project.hypotheek?.passeerdatum` om de
 * 24-maandenregel van het bouwdepot te laten afgaan — maar er was geen enkele
 * weg om die map ooit weggeschreven te krijgen. De regel kon dus niet vuren en
 * een maandlastenprognose was onmogelijk. Zie converters.test.ts.
 */
function hypotheekNaarOpslag(
  hypotheek: Invoer<HypotheekData> | undefined,
): DocumentData | undefined {
  if (!hypotheek) return undefined;

  const inhoud = zonderLegeVelden({
    bedrag: hypotheek.bedrag,
    rente: hypotheek.rente,
    vorm: hypotheek.vorm,
    looptijdMaanden: hypotheek.looptijdMaanden,
    depotRente: hypotheek.depotRente,
    grondbedrag: hypotheek.grondbedrag,
    passeerdatum: naarTimestamp(hypotheek.passeerdatum),
  });

  return Object.keys(inhoud).length === 0 ? undefined : inhoud;
}

function hypotheekUitOpslag(waarde: unknown): HypotheekData | undefined {
  if (typeof waarde !== "object" || waarde === null || Array.isArray(waarde)) return undefined;
  const data = waarde as DocumentData;

  const hypotheek: HypotheekData = {
    ...optioneel("bedrag", leesGetal(data.bedrag)),
    ...optioneel("rente", leesGetal(data.rente)),
    ...optioneel("vorm", leesEnum(data.vorm, HYPOTHEEKVORMEN)),
    ...optioneel("looptijdMaanden", leesGetal(data.looptijdMaanden)),
    ...optioneel("depotRente", leesGetal(data.depotRente)),
    ...optioneel("grondbedrag", leesGetal(data.grondbedrag)),
    ...optioneel("passeerdatum", leesDatum(data.passeerdatum)),
  };

  return Object.keys(hypotheek).length === 0 ? undefined : hypotheek;
}

// ── Woningpaspoort (ADR-0013 §5) ───────────────────────────────────────────

/**
 * Het paspoort is een geneste map. Is er niets ingevuld, dan komt `undefined`
 * terug in plaats van een lege map: een leeg object zou in de opslag een veld
 * bezetten en in de UI als "ingevuld" tellen.
 */
/**
 * De kadastrale aanduiding, genest in het paspoort.
 *
 * `lib/woningpaspoort/overdracht.ts` drukt deze gegevens af op het
 * overdrachtsdossier, maar er was geen converter — het exportbestand toonde
 * daardoor altijd een streepje, ongeacht wat er ingevuld was.
 */
function kadasterNaarOpslag(kadaster: KadastraleGegevens | undefined): DocumentData | undefined {
  if (!kadaster) return undefined;

  const inhoud = zonderLegeVelden({
    gemeente: kadaster.gemeente,
    sectie: kadaster.sectie,
    perceelnummer: kadaster.perceelnummer,
    complexaanduiding: kadaster.complexaanduiding,
    appartementsindex: kadaster.appartementsindex,
  });

  return Object.keys(inhoud).length === 0 ? undefined : inhoud;
}

function kadasterUitOpslag(waarde: unknown): KadastraleGegevens | undefined {
  if (typeof waarde !== "object" || waarde === null || Array.isArray(waarde)) return undefined;
  const data = waarde as DocumentData;

  const kadaster: KadastraleGegevens = {
    ...optioneel("gemeente", leesString(data.gemeente)),
    ...optioneel("sectie", leesString(data.sectie)),
    ...optioneel("perceelnummer", leesString(data.perceelnummer)),
    ...optioneel("complexaanduiding", leesString(data.complexaanduiding)),
    ...optioneel("appartementsindex", leesString(data.appartementsindex)),
  };

  return Object.keys(kadaster).length === 0 ? undefined : kadaster;
}

function paspoortNaarOpslag(
  paspoort: Invoer<WoningpaspoortData> | undefined,
): DocumentData | undefined {
  if (!paspoort) return undefined;

  const inhoud = zonderLegeVelden({
    adres: paspoort.adres,
    huisnummer: paspoort.huisnummer,
    huisnummerToevoeging: paspoort.huisnummerToevoeging,
    postcode: paspoort.postcode,
    plaats: paspoort.plaats,
    woningtype: paspoort.woningtype,
    bouwjaar: paspoort.bouwjaar,
    woonoppervlakte: paspoort.woonoppervlakte,
    perceeloppervlakte: paspoort.perceeloppervlakte,
    energielabel: paspoort.energielabel,
    energielabelRegistratie: paspoort.energielabelRegistratie,
    energielabelOpnameDatum: naarTimestamp(paspoort.energielabelOpnameDatum),
    kadaster: kadasterNaarOpslag(paspoort.kadaster),
    waarborgpolisnummer: paspoort.waarborgpolisnummer,
    notaris: paspoort.notaris,
    transportdatum: naarTimestamp(paspoort.transportdatum),
    hypotheekverstrekker: paspoort.hypotheekverstrekker,
  });

  return Object.keys(inhoud).length === 0 ? undefined : inhoud;
}

function paspoortUitOpslag(waarde: unknown): WoningpaspoortData | undefined {
  if (typeof waarde !== "object" || waarde === null || Array.isArray(waarde)) return undefined;
  const data = waarde as DocumentData;

  const paspoort: WoningpaspoortData = {
    ...optioneel("adres", leesString(data.adres)),
    ...optioneel("huisnummer", leesString(data.huisnummer)),
    ...optioneel("huisnummerToevoeging", leesString(data.huisnummerToevoeging)),
    ...optioneel("postcode", leesString(data.postcode)),
    ...optioneel("plaats", leesString(data.plaats)),
    ...optioneel("woningtype", leesEnum(data.woningtype, WONINGTYPES)),
    ...optioneel("bouwjaar", leesGetal(data.bouwjaar)),
    ...optioneel("woonoppervlakte", leesGetal(data.woonoppervlakte)),
    ...optioneel("perceeloppervlakte", leesGetal(data.perceeloppervlakte)),
    ...optioneel("energielabel", leesEnum(data.energielabel, ENERGIELABELS)),
    ...optioneel("energielabelRegistratie", leesString(data.energielabelRegistratie)),
    ...optioneel("energielabelOpnameDatum", leesDatum(data.energielabelOpnameDatum)),
    ...optioneel("kadaster", kadasterUitOpslag(data.kadaster)),
    ...optioneel("waarborgpolisnummer", leesString(data.waarborgpolisnummer)),
    ...optioneel("notaris", leesString(data.notaris)),
    ...optioneel("transportdatum", leesDatum(data.transportdatum)),
    ...optioneel("hypotheekverstrekker", leesString(data.hypotheekverstrekker)),
  };

  return Object.keys(paspoort).length === 0 ? undefined : paspoort;
}

// ── Project ────────────────────────────────────────────────────────────────

export function projectNaarOpslag(project: Invoer<ProjectData>): DocumentData {
  return zonderLegeVelden({
    naam: project.naam,
    traject: project.traject,
    bouwnummer: project.bouwnummer,
    projectnaam: project.projectnaam,
    aannemer: project.aannemer,
    garantiewaarborg: project.garantiewaarborg,
    koopsom: project.koopsom,
    meerwerkbudget: project.meerwerkbudget,
    bouwdepotBedrag: project.bouwdepotBedrag,
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
    woningpaspoort: paspoortNaarOpslag(project.woningpaspoort),
    hypotheek: hypotheekNaarOpslag(project.hypotheek),
    aangemaaktOp: naarTimestamp(project.aangemaaktOp),
    bijgewerktOp: naarTimestamp(project.bijgewerktOp),
  });
}

export function projectUitOpslag(id: string, data: DocumentData): ProjectMetId {
  return {
    id,
    naam: leesString(data.naam) ?? "Naamloos project",
    ...optioneel("traject", leesEnum(data.traject, TRAJECTTYPES)),
    ...optioneel("bouwnummer", leesString(data.bouwnummer)),
    ...optioneel("projectnaam", leesString(data.projectnaam)),
    ...optioneel("aannemer", leesString(data.aannemer)),
    ...optioneel("garantiewaarborg", leesEnum(data.garantiewaarborg, GARANTIEWAARBORGEN)),
    ...optioneel("koopsom", leesGetal(data.koopsom)),
    ...optioneel("meerwerkbudget", leesGetal(data.meerwerkbudget)),
    ...optioneel("bouwdepotBedrag", leesGetal(data.bouwdepotBedrag)),
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
    ...optioneel("woningpaspoort", paspoortUitOpslag(data.woningpaspoort)),
    ...optioneel("hypotheek", hypotheekUitOpslag(data.hypotheek)),
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

export function ankerNaarOpslag(anker: Partial<AnkerData>): DocumentData {
  return zonderLegeVelden({
    type: anker.type,
    titel: anker.titel,
    verwachtOp: naarTimestamp(anker.verwachtOp),
    status: anker.status,
    bron: anker.bron,
  });
}

export function ankerUitOpslag(id: string, data: DocumentData): AnkerMetId {
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

export function betrokkeneNaarOpslag(betrokkene: Partial<BetrokkeneData>): DocumentData {
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

export function betrokkeneUitOpslag(id: string, data: DocumentData): BetrokkeneMetId {
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

export function afspraakNaarOpslag(afspraak: Partial<AfspraakData>): DocumentData {
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

export function afspraakUitOpslag(id: string, data: DocumentData): AfspraakMetId {
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

export function faseNaarOpslag(fase: Partial<FaseData>): DocumentData {
  return zonderLegeVelden({
    type: fase.type,
    titel: fase.titel,
    status: fase.status,
    streefdatum: naarTimestamp(fase.streefdatum),
    volgorde: fase.volgorde,
  });
}

export function faseUitOpslag(id: string, data: DocumentData): FaseMetId {
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

export function taakNaarOpslag(taak: Partial<TaakData>): DocumentData {
  return zonderLegeVelden({
    titel: taak.titel,
    deadline: naarTimestamp(taak.deadline),
    phaseId: taak.phaseId,
    status: taak.status,
    bron: taak.bron,
    notitie: taak.notitie,
  });
}

export function taakUitOpslag(id: string, data: DocumentData): TaakMetId {
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

export function meerwerkNaarOpslag(item: Partial<MeerwerkData>): DocumentData {
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

export function meerwerkUitOpslag(id: string, data: DocumentData): MeerwerkMetId {
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

export function termijnNaarOpslag(termijn: Partial<TermijnData>): DocumentData {
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

export function termijnUitOpslag(id: string, data: DocumentData): TermijnMetId {
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

export function gebrekNaarOpslag(gebrek: Partial<GebrekData>): DocumentData {
  return zonderLegeVelden({
    omschrijving: gebrek.omschrijving,
    locatie: gebrek.locatie,
    gemeldOp: naarTimestamp(gebrek.gemeldOp),
    hersteltermijn: naarTimestamp(gebrek.hersteltermijn),
    status: gebrek.status,
  });
}

export function gebrekUitOpslag(id: string, data: DocumentData): GebrekMetId {
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

export function nabudgetNaarOpslag(post: Partial<NabudgetData>): DocumentData {
  return zonderLegeVelden({
    omschrijving: post.omschrijving,
    geraamd: post.geraamd,
    werkelijk: post.werkelijk,
    status: post.status,
    notitie: post.notitie,
  });
}

export function nabudgetUitOpslag(id: string, data: DocumentData): NabudgetMetId {
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

// ── Onderdelen (ADR-0013) ──────────────────────────────────────────────────

/**
 * Het aantal specs en de lengte per waarde worden begrensd — hier én in de
 * rules. Zonder die grens is `specs` een vrij beschrijfbare map, en dat is
 * precies de opslagplek die constraint C2 uitsluit.
 */
const MAX_SPECS = 30;
const MAX_SPEC_SLEUTEL = 60;
const MAX_SPEC_WAARDE = 300;

/**
 * Leest een vrije sleutel-waardemap. Alles wat geen string is valt eruit in
 * plaats van doorgegeven te worden: de UI rendert deze waarden rechtstreeks, en
 * een getal of een genest object zou daar als `[object Object]` belanden.
 */
function leesSpecs(waarde: unknown): Record<string, string> | undefined {
  if (typeof waarde !== "object" || waarde === null || Array.isArray(waarde)) return undefined;

  const specs: Record<string, string> = {};
  for (const [sleutel, inhoud] of Object.entries(waarde as Record<string, unknown>)) {
    if (typeof inhoud !== "string" || inhoud === "") continue;
    if (sleutel.length > MAX_SPEC_SLEUTEL) continue;
    specs[sleutel] = inhoud.slice(0, MAX_SPEC_WAARDE);
    if (Object.keys(specs).length >= MAX_SPECS) break;
  }

  return Object.keys(specs).length === 0 ? undefined : specs;
}

function schoonSpecs(specs: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!specs) return undefined;

  const schoon: Record<string, string> = {};
  for (const [sleutel, waarde] of Object.entries(specs)) {
    const nette = waarde.trim();
    if (nette === "" || sleutel.trim() === "") continue;
    schoon[sleutel.trim().slice(0, MAX_SPEC_SLEUTEL)] = nette.slice(0, MAX_SPEC_WAARDE);
    if (Object.keys(schoon).length >= MAX_SPECS) break;
  }

  return Object.keys(schoon).length === 0 ? undefined : schoon;
}

function registratieNaarOpslag(
  plicht: RegistratieplichtData | undefined,
): DocumentData | undefined {
  if (!plicht?.instantie) return undefined;
  return zonderLegeVelden({
    instantie: plicht.instantie,
    aangemeldOp: naarTimestamp(plicht.aangemeldOp),
    referentie: plicht.referentie,
    toelichting: plicht.toelichting,
  });
}

function registratieUitOpslag(waarde: unknown): RegistratieplichtData | undefined {
  if (typeof waarde !== "object" || waarde === null || Array.isArray(waarde)) return undefined;
  const data = waarde as DocumentData;

  // Zonder instantie is een registratieplicht betekenisloos: je weet dan wel
  // dát er iets moet, maar niet bij wie.
  const instantie = leesString(data.instantie);
  if (!instantie) return undefined;

  return {
    instantie,
    ...optioneel("aangemeldOp", leesDatum(data.aangemeldOp)),
    ...optioneel("referentie", leesString(data.referentie)),
    ...optioneel("toelichting", leesString(data.toelichting)),
  };
}

export function onderdeelNaarOpslag(onderdeel: Partial<OnderdeelData>): DocumentData {
  return zonderLegeVelden({
    naam: onderdeel.naam,
    categorie: onderdeel.categorie,
    merk: onderdeel.merk,
    type: onderdeel.type,
    serienummer: onderdeel.serienummer,
    specs: schoonSpecs(onderdeel.specs),
    montage: onderdeel.montage,
    blijftBijWoning: onderdeel.blijftBijWoning,
    installatieDatum: naarTimestamp(onderdeel.installatieDatum),
    installateurBetrokkeneId: onderdeel.installateurBetrokkeneId,
    garantieMaanden: onderdeel.garantieMaanden,
    registratieplicht: registratieNaarOpslag(onderdeel.registratieplicht),
    documentUrl: onderdeel.documentUrl,
    notitie: onderdeel.notitie,
  });
}

export function onderdeelUitOpslag(id: string, data: DocumentData): OnderdeelMetId {
  return {
    id,
    naam: leesString(data.naam) ?? "Naamloos onderdeel",
    categorie: leesEnum(data.categorie, ONDERDEELCATEGORIEEN_LIJST) ?? "overig",
    // Terugval op "nvt" en niet op een van de twee echte montagevormen: een
    // onbekende waarde mag geen installatiegarantie of inboedelclaim suggereren
    // die er niet is (ADR-0013 §2).
    montage: leesEnum(data.montage, MONTAGES) ?? "nvt",
    // Terugval op true: onterecht "blijft achter" tonen is minder schadelijk
    // dan een onderdeel stilzwijgend uit het overdrachtsdossier laten vallen.
    blijftBijWoning: typeof data.blijftBijWoning === "boolean" ? data.blijftBijWoning : true,
    ...optioneel("merk", leesString(data.merk)),
    ...optioneel("type", leesString(data.type)),
    ...optioneel("serienummer", leesString(data.serienummer)),
    ...optioneel("specs", leesSpecs(data.specs)),
    ...optioneel("installatieDatum", leesDatum(data.installatieDatum)),
    ...optioneel("installateurBetrokkeneId", leesString(data.installateurBetrokkeneId)),
    ...optioneel("garantieMaanden", leesGetal(data.garantieMaanden)),
    ...optioneel("registratieplicht", registratieUitOpslag(data.registratieplicht)),
    ...optioneel("documentUrl", leesString(data.documentUrl)),
    ...optioneel("notitie", leesString(data.notitie)),
  };
}

// ── Onderhoud (ADR-0014) ───────────────────────────────────────────────────

export function onderhoudTaakNaarOpslag(taak: Invoer<OnderhoudTaakData>): DocumentData {
  return zonderLegeVelden({
    titel: taak.titel,
    omschrijving: taak.omschrijving,
    onderdeelId: taak.onderdeelId,
    intervalDagen: taak.intervalDagen,
    voorkeursmaand: taak.voorkeursmaand,
    laatstUitgevoerdOp: naarTimestamp(taak.laatstUitgevoerdOp),
    waardenBron: taak.waardenBron,
    waarschuwing: taak.waarschuwing,
  });
}

export function onderhoudTaakUitOpslag(id: string, data: DocumentData): OnderhoudTaakMetId {
  const maand = leesGetal(data.voorkeursmaand);

  return {
    id,
    titel: leesString(data.titel) ?? "Naamloze onderhoudstaak",
    // Terugval op 365: een taak zonder bruikbaar interval zou anders elke dag
    // op de lijst staan. Jaarlijks is de veiligste aanname — zichtbaar genoeg
    // om gecorrigeerd te worden, niet zo vaak dat hij de lijst overneemt.
    intervalDagen: leesGetal(data.intervalDagen) ?? 365,
    // Terugval op "voorstel": liever onterecht een disclaimer tonen dan een
    // schatting als eigen cijfer presenteren (ADR-0009).
    waardenBron: leesEnum(data.waardenBron, WAARDENBRONNEN) ?? "voorstel",
    ...optioneel("omschrijving", leesString(data.omschrijving)),
    ...optioneel("onderdeelId", leesString(data.onderdeelId)),
    // Een maand buiten 1–12 valt weg in plaats van door te lekken naar
    // `naarMaand()`, dat er anders een datum in een niet-bestaande maand van
    // zou maken.
    ...optioneel(
      "voorkeursmaand",
      maand !== undefined && Number.isInteger(maand) && maand >= 1 && maand <= 12
        ? maand
        : undefined,
    ),
    ...optioneel("laatstUitgevoerdOp", leesDatum(data.laatstUitgevoerdOp)),
    ...optioneel("waarschuwing", leesString(data.waarschuwing)),
  };
}

export function onderhoudLogregelNaarOpslag(
  regel: Invoer<OnderhoudLogregelData>,
): DocumentData {
  return zonderLegeVelden({
    taakId: regel.taakId,
    onderdeelId: regel.onderdeelId,
    uitgevoerdOp: naarTimestamp(regel.uitgevoerdOp),
    doorWie: regel.doorWie,
    kosten: regel.kosten,
    notitie: regel.notitie,
  });
}

export function onderhoudLogregelUitOpslag(
  id: string,
  data: DocumentData,
): OnderhoudLogregelMetId {
  return {
    id,
    taakId: leesString(data.taakId) ?? "",
    // Zonder datum is een logregel betekenisloos. Epoch is hier bewust: het
    // valt op in de UI en het voorkomt een crash op een ontbrekende datum.
    uitgevoerdOp: leesDatum(data.uitgevoerdOp) ?? new Date(0),
    ...optioneel("onderdeelId", leesString(data.onderdeelId)),
    ...optioneel("doorWie", leesString(data.doorWie)),
    ...optioneel("kosten", leesGetal(data.kosten)),
    ...optioneel("notitie", leesString(data.notitie)),
  };
}

// ── Meters en meterstanden (ADR-0015) ──────────────────────────────────────

export function meterNaarOpslag(meter: Invoer<MeterData>): DocumentData {
  return zonderLegeVelden({
    soort: meter.soort,
    naam: meter.naam,
    eenheid: meter.eenheid,
    meternummer: meter.meternummer,
    notitie: meter.notitie,
    waardenBron: meter.waardenBron,
  });
}

export function meterUitOpslag(id: string, data: DocumentData): MeterMetId {
  // Terugval op "overig": een onbekende soort mag geen meter laten verdwijnen
  // uit het overzicht. Bij `overig` toont de UI de eigen naam, en die staat er
  // dan meestal wél.
  const soort = leesEnum(data.soort, METERSOORTEN) ?? "overig";

  return {
    id,
    soort,
    // Terugval op kWh: verreweg de meest voorkomende eenheid, en fout genoeg
    // om op te vallen bij een gasmeter. Een meter zonder eenheid zou anders
    // een getal zonder betekenis tonen.
    eenheid: leesEnum(data.eenheid, METEREENHEDEN) ?? "kWh",
    // Zelfde terugval als bij de onderhoudstaak: liever onterecht een
    // disclaimer dan een schatting als eigen cijfer presenteren (ADR-0009).
    waardenBron: leesEnum(data.waardenBron, WAARDENBRONNEN) ?? "voorstel",
    ...optioneel("naam", leesString(data.naam)),
    ...optioneel("meternummer", leesString(data.meternummer)),
    ...optioneel("notitie", leesString(data.notitie)),
  };
}

export function meterstandNaarOpslag(stand: Invoer<MeterstandData>): DocumentData {
  return zonderLegeVelden({
    meterId: stand.meterId,
    opgenomenOp: naarTimestamp(stand.opgenomenOp),
    stand: stand.stand,
    notitie: stand.notitie,
  });
  // LET OP: hier hoort NOOIT een `verbruik` of `verbruikPerDag` bij te komen.
  // Dat volgt uit twee opeenvolgende standen en wordt in `lib/meterstanden.ts`
  // elke keer opnieuw berekend (ADR-0008, ADR-0015 §3). De rule op deze
  // collectie heeft een `keys().hasOnly(...)` die zo'n veld hard weigert.
}

export function meterstandUitOpslag(id: string, data: DocumentData): MeterstandMetId {
  return {
    id,
    meterId: leesString(data.meterId) ?? "",
    // Epoch als terugval, net als bij de logregel: een opname zonder datum is
    // betekenisloos, maar mag de app niet laten crashen. Hij valt op in de UI.
    opgenomenOp: leesDatum(data.opgenomenOp) ?? new Date(0),
    // Een meterstand is nooit negatief. Een negatieve waarde zou het verbruik
    // van twee opeenvolgende periodes vergiftigen, dus hij valt hier weg.
    //
    // De terugval is 0 en niet "laat de opname weg": 0 is een geldige stand
    // (een net vervangen meter begint daar), en de rekenkern markeert de
    // periode eromheen vanzelf als onbetrouwbaar. Zichtbaar fout is beter dan
    // stilzwijgend verdwenen.
    stand: leesPositiefGetal(data.stand) ?? 0,
    ...optioneel("notitie", leesString(data.notitie)),
  };
}
