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
 *     ├── nabudget/{postId}
 *     ├── meters/{meterId}          (ADR-0015)
 *     └── meterstanden/{opnameId}   (ADR-0015)
 *
 * Vanaf blok E (ADR-0010, ADR-0013) komt daar het woningdossier bij. Het
 * woningpaspoort is een GENEST veld op het project en geen losse velden: een
 * map telt in de rules als één veld, waardoor `withinSize(25)` intact blijft.
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

// ── Woningdossier: de tweede fase (ADR-0010, ADR-0013) ─────────────────────

/**
 * De fase waarin de woning verkeert. Dit ene veld bepaalt wat het dashboard
 * bovenaan zet: in `in_aanbouw` de schuif-impact-actielijst, in `opgeleverd`
 * de onderhoudslijst.
 *
 * Bewust handmatig om te zetten en NIET af te leiden uit de opleverdatum: een
 * oplevering kan mislukken en een sleuteloverdracht kan uitgesteld worden. De
 * app zou dan van vorm veranderen op precies het moment dat er nog van alles
 * moet gebeuren. Zie ADR-0010 §1.
 */
export type WoningStatus = "in_aanbouw" | "opgeleverd";

/**
 * Het woningtype. Gesloten lijst — hij beschrijft de woningvoorraad, niet de
 * voorkeur van de gebruiker, en bepaalt straks welke onderdelen en
 * onderhoudstaken de bibliotheek voorstelt (een appartement heeft geen dakgoot).
 */
export type Woningtype =
  | "tussenwoning"
  | "hoekwoning"
  | "twee_onder_een_kap"
  | "vrijstaand"
  | "appartement"
  | "benedenwoning"
  | "bovenwoning"
  | "overig";

/**
 * De labelschaal volgens NTA 8800, geldig sinds 1 januari 2021. Gesloten lijst,
 * want hij is wettelijk vastgelegd. Nieuwbouw komt sinds de BENG-eisen
 * doorgaans op A++++ of hoger uit.
 */
export type Energielabel =
  | "A+++++"
  | "A++++"
  | "A+++"
  | "A++"
  | "A+"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G";

/**
 * Wat er over de woning zelf vastligt — los van het bouwtraject.
 *
 * Dit is één GENEST veld op `Project` en geen dertien losse velden. Reden:
 * `withinSize(25)` in de rules telt met `request.resource.data.size()`, en
 * `Project` zit al op 18 velden. Als map kost het paspoort er één. Zie
 * ADR-0013 §5.
 *
 * `aannemer`, `bouwnummer` en `garantiewaarborg` staan bewust NIET hier maar
 * op het project zelf: die horen bij het bouwtraject en zijn al ingevuld
 * voordat het paspoort relevant wordt.
 */
export interface Woningpaspoort {
  adres?: string;
  postcode?: string;
  plaats?: string;
  woningtype?: Woningtype;
  bouwjaar?: number;
  /** Gebruiksoppervlakte wonen in m², zoals in de brochure. */
  woonoppervlakte?: number;
  /** Perceeloppervlakte in m². Leeg bij een appartement. */
  perceeloppervlakte?: number;

  // ── Het energielabel als klok, niet als tekstje (ADR-0013 §4) ──────────
  // Een label is TIEN JAAR geldig vanaf de opnamedatum en verloopt stil: is
  // het verlopen, dan is het ook uit EP-online en MijnOverheid verdwenen, en
  // bij verkoop heb je een geldig label nodig.
  //
  // De einddatum wordt NIET opgeslagen — die volgt uit de opnamedatum plus
  // tien jaar (ADR-0008). De opnamedatum zelf is wél een feit en gaat er dus in.

  energielabel?: Energielabel;
  /** Het registratienummer in EP-online, waarmee het label terug te vinden is. */
  energielabelRegistratie?: string;
  energielabelOpnameDatum?: Timestamp;

  /** Het polisnummer bij Woningborg of SWK — het waarborgtype staat op het project. */
  waarborgpolisnummer?: string;
  notaris?: string;
  hypotheekverstrekker?: string;
}

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

  // ── Het woningdossier (ADR-0010) ────────────────────────────────────────
  // Twee velden, waarvan het paspoort een geneste map is. Ontbreekt
  // `woningStatus`, dan geldt `in_aanbouw` — bestaande projecten van vóór
  // blok E hoeven dus niet gemigreerd te worden.

  woningStatus?: WoningStatus;
  woningpaspoort?: Woningpaspoort;

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

// ── Onderdelen — het register van wat er in de woning zit (ADR-0013) ───────

/**
 * Waar een onderdeel bij hoort. Gesloten lijst, want hij stuurt de
 * standaardbibliotheek aan: per categorie hangen er voorgestelde specvelden en
 * onderhoudsintervallen aan.
 */
export type OnderdeelCategorie =
  | "verwarming"
  | "ventilatie"
  | "warm_water"
  | "elektra"
  | "opwekking"
  | "opslag"
  | "water"
  | "zonwering"
  | "dak"
  | "gevel"
  | "sanitair"
  | "beveiliging"
  | "overig";

/**
 * Hoe het onderdeel in de woning zit (ADR-0013 §2).
 *
 *   vast_geinstalleerd  nagelvast, door een installateur aangesloten. Onderdeel
 *                       van de onroerende zaak, valt onder de opstalverzekering
 *                       en er hoort installatiegarantie bij.
 *   plug_and_play       je steekt hem in het stopcontact. Roerende zaak, valt
 *                       onder de inboedel, alleen fabrieksgarantie.
 *   nvt                 bouwkundig, niet geïnstalleerd — kozijnen, dakbedekking.
 *
 * Dit is de scherpste scheidslijn in het register en de reden dat het veld
 * verplicht is: hij is achteraf niet af te leiden.
 */
export type Montage = "vast_geinstalleerd" | "plug_and_play" | "nvt";

/**
 * Een wettelijke registratie- of meldplicht die bij een onderdeel hoort
 * (ADR-0013 §3).
 *
 * Zolang `aangemeldOp` leeg is, staat het onderdeel op de actielijst. Precies
 * hetzelfde mechanisme als `gecommuniceerdeDatum` bij afspraken: het verschil
 * tussen wat de app weet en wat de buitenwereld weet ís het werk.
 *
 * Het bekendste geval is de thuisbatterij: sinds 7 mei 2024 moet elke
 * batterij vanaf 0,8 kW die terug kan leveren worden aangemeld bij de
 * netbeheerder via Energieleveren.nl — óók een plug-and-play model. Meld je
 * het niet, dan mag de netbeheerder je teruglevering weigeren.
 */
export interface Registratieplicht {
  /** Bij wie, bijv. "Netbeheerder via Energieleveren.nl". */
  instantie: string;
  /** Wanneer het gemeld is. Een feit over het verleden, dus wél opgeslagen. */
  aangemeldOp?: Timestamp;
  /** Het meld- of dossiernummer dat je terugkrijgt. */
  referentie?: string;
  toelichting?: string;
}

export interface Onderdeel {
  /** Wat het is, bijv. "Warmtepomp" of "Thuisbatterij". Verplicht. */
  naam: string;
  categorie: OnderdeelCategorie;

  merk?: string;
  /** De typeaanduiding, bijv. "S2125-8" of "Flair 325". */
  type?: string;
  serienummer?: string;

  /**
   * Vrije technische gegevens (ADR-0013 §1).
   *
   * De bibliotheek levert per categorie een lijst voorgestelde sleutels, zodat
   * je niet zelf hoeft te bedenken wát er relevant is. Eigen sleutels mogen.
   *
   * ALLE WAARDEN ZIJN STRINGS, ook de getallen: "7,5 kW", "R290", "4,8". Er
   * wordt niet mee gerekend — ze zijn er om te vinden en over te typen bij een
   * storing of een offerte. Moet dat ooit wél, dan is dat een nieuwe ADR.
   */
  specs?: Record<string, string>;

  montage: Montage;
  /**
   * Blijft dit achter bij verkoop? Bewust NIET afgeleid uit `montage`: een
   * plug-in batterij kan bij de woning verkocht worden, en een vaste zonwering
   * kan in de onderhandeling meegaan. Voedt het overdrachtsdossier (E8) en de
   * scheiding inboedel/opstal.
   */
  blijftBijWoning: boolean;

  installatieDatum?: Timestamp;
  /** Verwijzing naar een betrokkenen/{betrokkeneId} — de partij die het plaatste. */
  installateurBetrokkeneId?: string;
  /** Fabrieksgarantie in maanden. De einddatum volgt eruit en wordt niet opgeslagen. */
  garantieMaanden?: number;

  registratieplicht?: Registratieplicht;

  /**
   * Een LINK naar waar de handleiding of factuur staat — Drive, OneDrive, de
   * site van de fabrikant. De app bewaart de vindplaats, nooit het bestand
   * (constraint C2, ADR-0005, ADR-0013 §3).
   */
  documentUrl?: string;
  notitie?: string;
}

// ── Onderhoud — terugkerend werk aan de woning (ADR-0014) ──────────────────

/**
 * Een onderhoudstaak herhaalt zich; een bouwafspraak niet. Dat is het enige
 * punt waarop de mechaniek uit ADR-0008 niet volstond (ADR-0010 §2).
 *
 * DE VOLGENDE BEURT WORDT NOOIT OPGESLAGEN. Alleen `laatstUitgevoerdOp` (een
 * feit over het verleden, net als `gecommuniceerdeDatum`) en `intervalDagen`.
 * De volgende datum volgt daaruit via `lib/onderhoud.ts`.
 */
export interface OnderhoudTaak {
  /** Wat er moet gebeuren, bijv. "WTW-filters vervangen". Verplicht. */
  titel: string;
  omschrijving?: string;

  /** Verwijzing naar een onderdelen/{onderdeelId}. Niet alles hangt aan een apparaat. */
  onderdeelId?: string;

  /** 30 = maandelijks, 365 = jaarlijks, 3650 = elke tien jaar. */
  intervalDagen: number;

  /**
   * De maand waarin dit hoort te gebeuren (1–12), voor seizoenswerk
   * (ADR-0014 §1).
   *
   * Is die gezet, dan verschuift de berekende datum naar de DICHTSTBIJZIJNDE
   * voorkomen van die maand. Zonder dit veld bepaalt het moment van afvinken de
   * hele reeks: goten die je één keer in maart afvinkt, staan daarna elk jaar
   * in maart — en die fout plant zich voort.
   */
  voorkeursmaand?: number;

  /** Wanneer het voor het laatst gedaan is. Leeg = nog nooit. */
  laatstUitgevoerdOp?: Timestamp;

  /** `voorstel` zolang het interval uit de bibliotheek komt (ADR-0009). */
  waardenBron: WaardenBron;

  /**
   * Waarschuwing die bij deze taak hoort — bijv. dat een verouderd
   * actief-koolfilter bacteriegroei kan bevorderen, of dat een rookmelder na
   * tien jaar vervángen moet worden en schoonmaken dan niet meer helpt.
   */
  waarschuwing?: string;
}

/**
 * Eén uitgevoerde beurt. Wordt in dezelfde batch geschreven als het bijwerken
 * van `laatstUitgevoerdOp`, zodat er nooit een bijgewerkte taak zonder logregel
 * kan bestaan (ADR-0014 §2).
 *
 * Zonder deze collectie zou elke beurt de vorige overschrijven: je ziet dan dát
 * er iets gebeurde, maar niet wat, door wie of wat het kostte. Dat is het deel
 * dat bij verkoop het waardevolst is, en het is niet achteraf te reconstrueren.
 */
export interface OnderhoudLogregel {
  taakId: string;
  /** Overgenomen van de taak op het moment van uitvoeren, voor het onderdeeloverzicht. */
  onderdeelId?: string;
  /** Een feit over het verleden, dus wél opgeslagen. */
  uitgevoerdOp: Timestamp;
  /** Wie het deed: "zelf", of de naam van het servicebedrijf. */
  doorWie?: string;
  /** Wat het kostte, in hele euro's. */
  kosten?: number;
  notitie?: string;
}

// ── Meters en meterstanden (ADR-0015) ──────────────────────────────────────

/**
 * Wat er gemeten wordt. Gesloten lijst, want hij stuurt de bibliotheek aan:
 * per soort hangt er een eenheid, een aantal decimalen en een toelichting aan.
 *
 * De stroomregisters volgen de Nederlandse praktijk. Een aansluiting heeft
 * ófwel één register (enkeltarief) ófwel twee (normaal- en daltarief), en bij
 * zonnepanelen komt daar hetzelfde aantal teruglever-registers bij:
 *
 *   1.8.1 / 1.8.2   levering dal / normaal
 *   2.8.1 / 2.8.2   teruglevering dal / normaal
 *
 * `overig` is de ontsnapping voor wat er niet in past: een tussenmeter op de
 * warmtepomp, een laadpaal, een aparte meter op de thuisbatterij. Dan is
 * `naam` verplicht en kiest de gebruiker zelf de eenheid — een lijst die
 * veroudert mag geen harde regel worden (ADR-0015 §2).
 */
export type Metersoort =
  | "stroom_enkel"
  | "stroom_normaal"
  | "stroom_dal"
  | "teruglevering_enkel"
  | "teruglevering_normaal"
  | "teruglevering_dal"
  | "gas"
  | "water"
  | "warmte"
  | "overig";

/**
 * De eenheid waarin de meter telt. Bewust kort gehouden: alles wat een
 * Nederlandse woning aan de meter heeft, valt hieronder.
 *
 *   kWh  stroom, teruglevering, tussenmeters
 *   m3   gas en water
 *   GJ   stadsverwarming
 */
export type Metereenheid = "kWh" | "m3" | "GJ";

/**
 * Eén meter in de woning — wát je meet, niet wat hij aanwees.
 *
 * DIT IS EEN EIGEN DOCUMENT EN GEEN TEKSTVELD OP DE OPNAME (ADR-0015 §1).
 * Zou de meternaam op elke stand staan, dan splitst één typefout
 * ("tussenmeter WP" naast "tussenmeter wp") de reeks stil in tweeën: de trend
 * over de gesplitste helft klopt niet meer en er komt geen foutmelding. Dat is
 * dezelfde soort stille fout als de `undefined === undefined`-koppeling uit
 * sessie 06.
 *
 * `eenheid` en `meternummer` horen bij de méter en niet bij de opname;
 * meesturen op elke stand zou duplicatie zijn die scheef groeit zodra iemand
 * er één corrigeert.
 */
export interface Meter {
  soort: Metersoort;

  /**
   * Eigen naam, bijv. "Tussenmeter warmtepomp". Leeg = het label uit de
   * bibliotheek. VERPLICHT bij `soort: "overig"`, want dan is er geen label.
   */
  naam?: string;

  eenheid: Metereenheid;

  /** Het nummer op de meter zelf, handig bij een verhuizing of een storing. */
  meternummer?: string;

  notitie?: string;

  /** `voorstel` zolang de eenheid uit de bibliotheek komt (ADR-0009). */
  waardenBron: WaardenBron;
}

/**
 * Eén opname: wat de meter aanwees, en wanneer je gekeken hebt. Allebei feiten
 * over de buitenwereld, dus allebei opgeslagen (ADR-0008).
 *
 * WAT HIER NIET IN STAAT: `verbruik`, `verbruikPerDag`, `periodeDagen`. Die
 * volgen uit twee opeenvolgende standen en worden elke keer opnieuw berekend
 * in `lib/meterstanden.ts`. Corrigeer je een verkeerd overgetypte stand, dan
 * kloppen de periodes ervóór én erná meteen weer; was het verbruik opgeslagen,
 * dan was elke correctie een migratie.
 *
 * De rules dwingen dat af met `keys().hasOnly(...)` — na `onderhoudstaken` de
 * tweede collectie met een gesloten veldenlijst. Zonder die whitelist kan een
 * client alsnog een `verbruik` meesturen en staat de afgeleide waarde in de
 * database. KOMT ER EEN VELD BIJ, DAN MOET HET OOK IN DIE LIJST.
 */
export interface Meterstand {
  /** Verwijzing naar een meters/{meterId}. Verplicht. */
  meterId: string;

  /** Wanneer je gekeken hebt. */
  opgenomenOp: Timestamp;

  /**
   * Wat er stond, in de eenheid van de meter. Mag decimalen hebben: gas en
   * water lopen in m³ met drie cijfers achter de komma.
   *
   * Een stand loopt op. Staat er toch een lagere dan de vorige, dan is dat een
   * typefout, een vervangen meter of een omloop bij 99999 — en dat wordt in de
   * rekenkern gemarkeerd, niet rechtgerekend (ADR-0015 §4).
   */
  stand: number;

  notitie?: string;
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
export type NabudgetpostDoc = Nabudgetpost & MetId;
export type OnderdeelDoc = Onderdeel & MetId;
export type OnderhoudTaakDoc = OnderhoudTaak & MetId;
export type OnderhoudLogregelDoc = OnderhoudLogregel & MetId;
export type MeterDoc = Meter & MetId;
export type MeterstandDoc = Meterstand & MetId;
