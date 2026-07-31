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
 *     ├── ankers/{ankerId}
 *     ├── betrokkenen/{betrokkeneId}
 *     ├── afspraken/{afspraakId}
 *     ├── phases/{phaseId}
 *     ├── tasks/{taskId}
 *     ├── meerwerk/{itemId}
 *     ├── termijnen/{termId}
 *     ├── gebreken/{defectId}
 *     └── nabudget/{postId}
 *
 * DE BELANGRIJKSTE REGEL IN DIT MODEL (ADR-0008):
 * een afspraakdatum wordt NOOIT opgeslagen. Alleen `ankerType` + `offsetDagen`.
 * De datum is altijd afgeleid via `src/lib/planning.ts`. Sla je hem wél op, dan
 * is elke verschuiving van de bouw een migratie — precies het handwerk dat deze
 * app wegneemt.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Elk document krijgt zijn Firestore-id mee zodra het gelezen is. */
export interface MetId {
  id: string;
}

// ── Project ────────────────────────────────────────────────────────────────

export type Garantiewaarborg = "woningborg" | "swk" | "geen" | "anders";

/**
 * De staat van de opleverdatum. Dit veld bepaalt wie je wel en niet mag
 * benaderen — zie ADR-0008, principe 1.
 *
 *   indicatief   "ergens in week 45"           → niemand definitief boeken
 *   bandbreedte  vroegst wk 44 – laatst wk 50  → alleen lange aanlooptijden waarschuwen
 *   aangezegd    formele aanzegging aannemer   → nu pas iedereen definitief inplannen
 *
 * In Nederland zegt de aannemer de opleverdatum formeel aan, meestal enkele
 * weken van tevoren. Alles daarvóór is een schatting, en dat onderscheid moet
 * de app kennen.
 */
export type OpleverStatus = "indicatief" | "bandbreedte" | "aangezegd";

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

  // ── De opleverdatum als band ────────────────────────────────────────────
  // Drie datums in plaats van één, plus de staat en de herkomst. Bij
  // `aangezegd` vallen vroegst/verwacht/laatst doorgaans samen.

  opleverStatus?: OpleverStatus;
  opleverVroegst?: Timestamp;
  opleverVerwacht?: Timestamp;
  opleverLaatst?: Timestamp;
  /**
   * Wie beweerde dit, en wanneer. Bijv. "mail aannemer 12-07".
   * Klinkt als een detail, maar bij de derde verschuiving wil je terug kunnen
   * zien waar een datum vandaan kwam.
   */
  opleverBron?: string;
  opleverBronDatum?: Timestamp;

  // ── Het 5%-opschortingsrecht (ADR-0012) ─────────────────────────────────
  // Geen datum hier: de uiterste keuzedatum volgt uit de oplevering plus de
  // onderhoudstermijn en schuift dus mee (ADR-0008).

  opschortingStatus?: OpschortingStatus;
  /**
   * Het bedrag dat in depot staat. Bewust door de gebruiker in te vullen en
   * niet af te leiden uit `koopsom`: de 5% geldt over de **aanneemsom**, en de
   * koopsom bevat ook de grond. Zelf uitrekenen zou een te hoog bedrag
   * presenteren als feit.
   */
  opschortingBedrag?: number;
  opschortingNotitie?: string;

  aangemaaktOp: Timestamp;
  bijgewerktOp?: Timestamp;
}

// ── Ankers ─────────────────────────────────────────────────────────────────

/**
 * Bouwmomenten waaraan afspraken hangen. Bewust een gesloten lijst: hij
 * beschrijft het bouwproces, niet de voorkeur van de gebruiker.
 *
 * Waarom niet alleen `oplevering`: de keuken-inmeter komt niet "zes weken vóór
 * oplevering", hij komt zodra de wanden staan. En de vloerenlegger hangt aan
 * de droogtijd van de dekvloer, niet aan de sleuteloverdracht. Die momenten
 * lopen uiteen zodra de bouw ongelijkmatig schuift — en dat is precies wat er
 * gebeurt. Zie ADR-0008, principe 2.
 */
export type AnkerType =
  | "start_bouw"
  | "begane_grond_gestort"
  | "ruwbouw_gereed"
  | "wind_waterdicht"
  | "dekvloer_gestort"
  | "oplevering"
  | "sleuteloverdracht"
  | "einde_onderhoudstermijn";

/**
 * `verwacht`   — schatting, mag schuiven
 * `bevestigd`  — de aannemer heeft dit vastgelegd
 * `gepasseerd` — het moment is geweest; de datum ligt vast
 */
export type AnkerStatus = "verwacht" | "bevestigd" | "gepasseerd";

export interface Anker {
  type: AnkerType;
  /** Vrije titel, bijv. "Dekvloer begane grond". */
  titel: string;
  verwachtOp?: Timestamp;
  status: AnkerStatus;
  /** Waar deze datum vandaan komt, bijv. "bouwvergadering 03-09". */
  bron?: string;
}

// ── Betrokkenen ────────────────────────────────────────────────────────────

export type BetrokkeneCategorie =
  | "installatie"
  | "afbouw"
  | "tuin"
  | "verhuizing"
  | "huidige_woning"
  | "nuts"
  | "financieel"
  | "overig";

/**
 * Wanneer je deze partij informeert bij een verschuiving. Dit ene veld haalt
 * naar verwachting het grootste deel van het mailverkeer weg (ADR-0008,
 * principe 4).
 *
 *   direct          bij élke wijziging — voor partijen met een lange aanlooptijd
 *   bij_aanzegging  pas als de opleverdatum formeel is aangezegd
 *   handmatig       nooit automatisch voorstellen; de gebruiker beslist
 *
 * Een naïeve implementatie mailt bij elke wijziging iedereen. Dat maakt het
 * erger: schuift de oplevering drie keer, dan heb je iedereen drie keer lastig-
 * gevallen met een datum die opnieuw niet klopte.
 */
export type Communicatieregel = "direct" | "bij_aanzegging" | "handmatig";

/**
 * Herkomst van `aanlooptijdDagen` en `annuleertermijnDagen` (ADR-0009).
 *
 *   voorstel  overgenomen uit de standaardbibliotheek — een inschatting
 *   eigen     de gebruiker heeft het cijfer van zijn leverancier ingevuld
 *
 * Bij `voorstel` toont de UI "voorstel — controleer bij je leverancier"
 * (constraint C5: de tool structureert, hij adviseert niet). Zodra de gebruiker
 * een van beide waarden aanpast, gaat dit veld naar `eigen` en verdwijnt de
 * disclaimer. Dat omzetten hoort in de opslaglaag te gebeuren, niet in het
 * formulier — vergeet je het, dan blijft de disclaimer hangen op cijfers die
 * de gebruiker zelf heeft ingevoerd.
 */
export type WaardenBron = "voorstel" | "eigen";

export interface Betrokkene {
  /** Bedrijfsnaam. Verplicht — dit is waar de gebruiker de partij aan herkent. */
  naam: string;
  contactpersoon?: string;
  email?: string;
  telefoon?: string;
  categorie: BetrokkeneCategorie;

  /**
   * Tijd tussen "deze partij weet het" en "deze partij staat er".
   * Keuken 56–70 dagen, vloerenlegger 21, verhuisbus 7.
   * Bepaalt hoe vroeg je moet informeren.
   */
  aanlooptijdDagen: number;

  /**
   * Tot hoeveel dagen van tevoren kan de afspraak kosteloos verzet worden.
   * Een bus annuleren kan tot 48 uur van tevoren gratis; een keuken die in
   * productie is, niet meer.
   *
   * Het snijpunt van deze twee getallen levert het cijfer dat er werkelijk toe
   * doet: de laatste dag waarop je nog gratis kunt schuiven.
   */
  annuleertermijnDagen: number;

  communicatieregel: Communicatieregel;
  waardenBron: WaardenBron;
  notitie?: string;
}

// ── Afspraken ──────────────────────────────────────────────────────────────

/**
 * `concept`    nog niet naar buiten gebracht
 * `voorlopig`  partij is geïnformeerd, datum nog niet hard
 * `bevestigd`  beide partijen zijn het eens over de datum
 * `afgerond`   is gebeurd
 * `vervallen`  gaat niet door
 */
export type AfspraakStatus = "concept" | "voorlopig" | "bevestigd" | "afgerond" | "vervallen";

export interface Afspraak {
  /** Verwijzing naar een betrokkenen/{betrokkeneId}. */
  betrokkeneId: string;
  /** Wat er gebeurt, bijv. "inmeten keuken". */
  omschrijving: string;

  /**
   * Het anker waaraan deze afspraak hangt, plus de verschuiving in dagen.
   * Negatief = ervóór. Bijv. `dekvloer_gestort` +42 (droogtijd), of
   * `sleuteloverdracht` −45 (huur opzeggen).
   *
   * HIER STAAT GEEN DATUM, EN DIE KOMT ER OOK NOOIT. Zie de kop van dit
   * bestand en ADR-0008.
   */
  ankerType: AnkerType;
  offsetDagen: number;

  /** Hoeveel dagen de klus zelf duurt. Voor overlap-detectie later. */
  duurDagen?: number;

  status: AfspraakStatus;

  /**
   * De datum die deze partij als laatste van jou heeft gekregen — de kern van
   * de hele module (ADR-0008, principe 5).
   *
   * Wijkt de berekende datum hiervan af, dan staat deze afspraak op de
   * actielijst. Vink je "doorgegeven" aan, dan lopen ze weer gelijk en
   * verdwijnt de regel. Wat overblijft is je werklijst.
   *
   * Let op: dít is de enige datum in dit model die wél wordt opgeslagen, en
   * dat is geen inconsistentie — het is geen planning maar een feit over de
   * buitenwereld: wat weet die partij nu.
   */
  gecommuniceerdeDatum?: Timestamp;
  gecommuniceerdOp?: Timestamp;

  /**
   * Waarschuwing die bij deze afspraak hoort en zichtbaar moet zijn op het
   * moment dat hij relevant wordt — bijv. de droogtijd van de dekvloer of de
   * onomkeerbaarheid van een opzegtermijn. Waarschuwingen horen bij de data,
   * niet in een handleiding die niemand leest.
   */
  waarschuwing?: string;

  notitie?: string;
}

// ── Fases ──────────────────────────────────────────────────────────────────

/**
 * De vaste fases van het nieuwbouwtraject, in chronologische volgorde.
 * Deze lijst is bewust gesloten: hij beschrijft het traject, niet de voorkeur
 * van de gebruiker.
 */
export type FaseType =
  "koop" | "notaris" | "financiering" | "bouw" | "oplevering" | "onderhoud" | "garantie";

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

/**
 * Hoe de deadline van dit meerwerk bepaald wordt (ADR-0011).
 *
 *   vaste_datum  de administratieve sluitingsdatum van de aannemer. Ligt vóór
 *                de start van de bouw en schuift NIET mee als de bouw schuift —
 *                de keuzelijst is dan allang dicht. Dit is het normale geval.
 *   bouwmoment   meerwerk dat tijdens de bouw opkomt: "extra loze leiding, maar
 *                wel vóórdat de dekvloer wordt gestort". Hier geldt ADR-0008
 *                onverkort en wordt de datum afgeleid.
 *   onbekend     je hebt de wens genoteerd maar weet nog niet wanneer hij
 *                dichtgaat. Een verzonnen datum is erger dan geen.
 */
export type MeerwerkSluiting = "vaste_datum" | "bouwmoment" | "onbekend";

export interface MeerwerkItem {
  omschrijving: string;
  bedrag?: number;

  /**
   * Welk van de drie soorten deadlines dit is. Expliciet, en niet af te leiden
   * uit welk veld is ingevuld: dat zou twee bronnen van waarheid opleveren
   * waarvan er stilzwijgend één wint. Zie ADR-0011.
   */
  sluiting: MeerwerkSluiting;

  /** Alleen bij `vaste_datum`. Een feit uit het contract, geen berekening. */
  sluitingsdatum?: Timestamp;

  /** Alleen bij `bouwmoment`. Samen goed voor een afgeleide datum. */
  sluitingAnkerType?: AnkerType;
  sluitingOffsetDagen?: number;

  phaseId?: string;
  status: MeerwerkStatus;
  notitie?: string;
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

/**
 * Het 5%-opschortingsrecht bij nieuwbouw (ADR-0012).
 *
 *   onbekend       je hebt er nog niet over besloten
 *   niet_gebruikt  bewust niet gebruikt, of te laat
 *   in_depot       het bedrag staat bij de notaris
 *   vrijgegeven    de punten zijn hersteld en het bedrag is naar de aannemer
 *
 * De uiterste datum om te kiezen wordt NIET opgeslagen: die volgt uit de
 * oplevering plus de onderhoudstermijn, en schuift dus mee (ADR-0008).
 */
export type OpschortingStatus = "onbekend" | "niet_gebruikt" | "in_depot" | "vrijgegeven";

export type GebrekStatus = "open" | "hersteld";

/**
 * Posten die ná de oplevering nog komen: vloer, gordijnen, tuin, oprit.
 * Ze horen niet bij de aannemer en niet bij het bouwdepot, maar ze bepalen wel
 * wat het huis uiteindelijk kost.
 *
 *   geraamd  je hebt een bedrag in gedachten
 *   besteld  opdracht gegeven
 *   betaald  afgerekend
 */
export type NabudgetStatus = "geraamd" | "besteld" | "betaald";

export interface Nabudgetpost {
  omschrijving: string;
  /** Wat je denkt dat het wordt. */
  geraamd?: number;
  /** Wat het geworden is. Pas bekend als de rekening er ligt. */
  werkelijk?: number;
  status: NabudgetStatus;
  notitie?: string;
}

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
export type AnkerDoc = Anker & MetId;
export type BetrokkeneDoc = Betrokkene & MetId;
export type AfspraakDoc = Afspraak & MetId;
export type PhaseDoc = Phase & MetId;
export type TaskDoc = Task & MetId;
export type MeerwerkDoc = MeerwerkItem & MetId;
export type TermijnDoc = Termijn & MetId;
export type GebrekDoc = Gebrek & MetId;
