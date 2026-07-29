import type { Timestamp } from "firebase/firestore";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Canoniek datamodel — Nieuwbouwplanner
 *
 * DIT BESTAND IS LEIDEND. Wijk je hier vanaf, dan moet je meenemen:
 *   1. firebase/firestore.rules   — validatie van dezelfde velden
 *   2. docs/PROJECT.md §5         — het schema in de documentatie
 *   3. firebase/firestore.indexes.json  — als je op een nieuw veld gaat sorteren
 *
 * Structuur in Firestore (alles onder de user, zodat de rules simpel blijven):
 *
 *   users/{uid}/projects/{projectId}
 *     ├── phases/{phaseId}
 *     ├── tasks/{taskId}
 *     ├── meerwerk/{itemId}
 *     ├── termijnen/{termId}
 *     └── gebreken/{defectId}
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Elk document krijgt zijn Firestore-id mee zodra het gelezen is. */
export interface MetId {
  id: string;
}

// ── Project ────────────────────────────────────────────────────────────────

export type Garantiewaarborg = "woningborg" | "swk" | "geen" | "anders";

export interface Project {
  /** Vrije naam van de gebruiker, bijv. "Ons huis in Almere". Verplicht. */
  naam: string;
  bouwnummer?: string;
  /** Naam van het bouwproject van de ontwikkelaar. */
  projectnaam?: string;
  aannemer?: string;
  garantiewaarborg?: Garantiewaarborg;
  /** Bedragen in hele euro's. */
  koopsom?: number;
  meerwerkbudget?: number;
  aangemaaktOp: Timestamp;
  bijgewerktOp?: Timestamp;
}

// ── Fases ──────────────────────────────────────────────────────────────────

/**
 * De vaste fases van het nieuwbouwtraject, in chronologische volgorde.
 * Deze lijst is bewust gesloten: hij beschrijft het traject, niet de voorkeur
 * van de gebruiker.
 */
export type FaseType =
  | "koop"
  | "notaris"
  | "financiering"
  | "bouw"
  | "oplevering"
  | "onderhoud"
  | "garantie";

export type FaseStatus = "open" | "bezig" | "klaar";

export interface Phase {
  type: FaseType;
  titel: string;
  status: FaseStatus;
  streefdatum?: Timestamp;
  /** Bepaalt de volgorde op de tijdlijn. */
  volgorde?: number;
}

// ── Taken ──────────────────────────────────────────────────────────────────

export type TaakStatus = "open" | "klaar";

/**
 * `geparsed` betekent: afkomstig uit de documentparser en door de gebruiker
 * bevestigd. Het onderscheid blijft zichtbaar, zodat duidelijk is welke
 * deadlines uit een contract komen en welke iemand zelf heeft ingevoerd.
 */
export type TaakBron = "handmatig" | "geparsed";

export interface Task {
  titel: string;
  deadline?: Timestamp;
  /** Verwijzing naar een phases/{phaseId}. */
  phaseId?: string;
  status: TaakStatus;
  bron: TaakBron;
  notitie?: string;
}

// ── Meerwerk ───────────────────────────────────────────────────────────────

export type MeerwerkStatus = "overweeg" | "besteld" | "bevestigd";

export interface MeerwerkItem {
  omschrijving: string;
  bedrag?: number;
  /**
   * De datum waarna dit meerwerk niet meer besteld kan worden — meestal
   * gekoppeld aan een bouwfase ("vóór het storten van de vloer").
   */
  sluitingsdatum?: Timestamp;
  phaseId?: string;
  status: MeerwerkStatus;
}

// ── Bouwdepot-termijnen ────────────────────────────────────────────────────

/**
 * Een termijn doorloopt drie stappen, die los van elkaar kunnen slepen:
 * de aannemer factureert → jij declareert bij de bank → de bank betaalt.
 * Daarom drie aparte booleans en geen enkele statusveld.
 */
export interface Termijn {
  /** Bijv. "fundering gereed" of "5e termijn — ruwe vloer". */
  omschrijving: string;
  bedrag?: number;
  gefactureerd: boolean;
  gefactureerdOp?: Timestamp;
  gedeclareerdBijBank: boolean;
  gedeclareerdOp?: Timestamp;
  betaald: boolean;
  betaaldOp?: Timestamp;
}

// ── Opleverpunten / gebreken ───────────────────────────────────────────────

export type GebrekStatus = "open" | "hersteld";

export interface Gebrek {
  omschrijving: string;
  /** Waar in de woning, bijv. "slaapkamer 2, kozijn noordzijde". */
  locatie?: string;
  gemeldOp?: Timestamp;
  /** Uiterste datum waarop het hersteld moet zijn. */
  hersteltermijn?: Timestamp;
  status: GebrekStatus;
}

// ── Handige aliassen voor gelezen documenten ───────────────────────────────

export type ProjectDoc = Project & MetId;
export type PhaseDoc = Phase & MetId;
export type TaskDoc = Task & MetId;
export type MeerwerkDoc = MeerwerkItem & MetId;
export type TermijnDoc = Termijn & MetId;
export type GebrekDoc = Gebrek & MetId;
