import { leesBedragInvoer, toonBedragInvoer } from "@/lib/bedrag";
import type { HypotheekData, ProjectData, ProjectMetId, WoningpaspoortData } from "@/lib/converters";
import type {
  Energielabel,
  Garantiewaarborg,
  Hypotheekvorm,
  TrajectType,
  Woningtype,
} from "@/types/model";
import type { Instapmoment } from "./instapmoment";
import type { WizardStap } from "./stappen";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De invoerwaarden van de startwizard, en hun weg naar de opslag
 *
 * ALLES IS HIER TEKST, ook de bedragen en de getallen. Een half ingetikt
 * bedrag is geen geldig getal, en een veld dat onder je handen naar 0 springt
 * is onwerkbaar — zelfde afweging als in `lib/projectgegevens.ts`. De omzetting
 * gebeurt pas bij het opslaan, en dat is precies wat dit bestand doet.
 *
 * WAAROM DIT LOS VAN HET SCHERM STAAT. De wizard schrijft naar zes verschillende
 * plekken in het model, en de regels daarvoor zijn niet triviaal: een leeg veld
 * mag geen `undefined` in de opslag zetten (`exactOptionalPropertyTypes`), een
 * onleesbaar bedrag moet een leesbare fout opleveren in plaats van stil een 0,
 * en de hypotheek is een geneste map die je in zijn geheel meegeeft of helemaal
 * niet. Dat in een `onClick` schrijven betekent dat het niet te testen is, en
 * dat is bij het financiële beeld het laatste wat je wilt.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Wizardwaarden {
  // ── Stap: start ────────────────────────────────────────────────────────
  traject: TrajectType;
  moment: Instapmoment;

  // ── Stap: de woning ────────────────────────────────────────────────────
  /** Vrije naam van het dossier, bijv. "Ons huis in Almere". */
  naam: string;
  adres: string;
  huisnummer: string;
  huisnummerToevoeging: string;
  postcode: string;
  plaats: string;
  /** Leeg = nog niet gekozen. */
  woningtype: Woningtype | "";
  bouwjaar: string;
  woonoppervlakte: string;
  perceeloppervlakte: string;
  energielabel: Energielabel | "";

  // ── Stap: contract ─────────────────────────────────────────────────────
  bouwnummer: string;
  /** De projectnaam van de ontwikkelaar, bijv. "De Hovenbuurt fase 2". */
  ontwikkelaar: string;
  aannemer: string;
  waarborg: Garantiewaarborg;
  waarborgpolisnummer: string;
  notaris: string;
  transportdatum: Date | undefined;
  kadasterGemeente: string;
  kadasterSectie: string;
  kadasterPerceelnummer: string;

  // ── Stap: financieel ───────────────────────────────────────────────────
  koopsom: string;
  meerwerkbudget: string;
  bouwdepot: string;
  opschortingBedrag: string;
  hypotheekBedrag: string;
  hypotheekRente: string;
  hypotheekVorm: Hypotheekvorm | "";
  hypotheekLooptijdJaren: string;
  depotRente: string;
  grondbedrag: string;
  passeerdatum: Date | undefined;
}

export const LEGE_WIZARDWAARDEN: Wizardwaarden = {
  traject: "nieuwbouw",
  moment: "net_gekocht",

  naam: "",
  adres: "",
  huisnummer: "",
  huisnummerToevoeging: "",
  postcode: "",
  plaats: "",
  woningtype: "",
  bouwjaar: "",
  woonoppervlakte: "",
  perceeloppervlakte: "",
  energielabel: "",

  bouwnummer: "",
  ontwikkelaar: "",
  aannemer: "",
  waarborg: "woningborg",
  waarborgpolisnummer: "",
  notaris: "",
  transportdatum: undefined,
  kadasterGemeente: "",
  kadasterSectie: "",
  kadasterPerceelnummer: "",

  koopsom: "",
  meerwerkbudget: "",
  bouwdepot: "",
  opschortingBedrag: "",
  hypotheekBedrag: "",
  hypotheekRente: "",
  hypotheekVorm: "",
  hypotheekLooptijdJaren: "30",
  depotRente: "",
  grondbedrag: "",
  passeerdatum: undefined,
};

// ── Van een bestaand project terug naar het formulier ──────────────────────

function alsTekst(waarde: number | undefined): string {
  return waarde === undefined ? "" : String(waarde);
}

/**
 * Vult het formulier met wat er al in het project staat.
 *
 * Nodig omdat de wizard te sluiten en later te hervatten is. Zonder dit zou je
 * bij terugkomen alles opnieuw intikken, of erger: lege velden opslaan over
 * gegevens die er al waren.
 */
export function uitProject(project: ProjectMetId, moment: Instapmoment): Wizardwaarden {
  const paspoort = project.woningpaspoort;
  const hypotheek = project.hypotheek;

  return {
    traject: project.traject ?? "nieuwbouw",
    moment,

    naam: project.naam === "Naamloos project" ? "" : project.naam,
    adres: paspoort?.adres ?? "",
    huisnummer: paspoort?.huisnummer ?? "",
    huisnummerToevoeging: paspoort?.huisnummerToevoeging ?? "",
    postcode: paspoort?.postcode ?? "",
    plaats: paspoort?.plaats ?? "",
    woningtype: paspoort?.woningtype ?? "",
    bouwjaar: alsTekst(paspoort?.bouwjaar),
    woonoppervlakte: alsTekst(paspoort?.woonoppervlakte),
    perceeloppervlakte: alsTekst(paspoort?.perceeloppervlakte),
    energielabel: paspoort?.energielabel ?? "",

    bouwnummer: project.bouwnummer ?? "",
    ontwikkelaar: project.projectnaam ?? "",
    aannemer: project.aannemer ?? "",
    waarborg: project.garantiewaarborg ?? "woningborg",
    waarborgpolisnummer: paspoort?.waarborgpolisnummer ?? "",
    notaris: paspoort?.notaris ?? "",
    transportdatum: paspoort?.transportdatum,
    kadasterGemeente: paspoort?.kadaster?.gemeente ?? "",
    kadasterSectie: paspoort?.kadaster?.sectie ?? "",
    kadasterPerceelnummer: paspoort?.kadaster?.perceelnummer ?? "",

    koopsom: toonBedragInvoer(project.koopsom),
    meerwerkbudget: toonBedragInvoer(project.meerwerkbudget),
    bouwdepot: toonBedragInvoer(project.bouwdepotBedrag),
    opschortingBedrag: toonBedragInvoer(project.opschortingBedrag),
    hypotheekBedrag: toonBedragInvoer(hypotheek?.bedrag),
    hypotheekRente: alsTekst(hypotheek?.rente),
    hypotheekVorm: hypotheek?.vorm ?? "",
    hypotheekLooptijdJaren:
      hypotheek?.looptijdMaanden === undefined
        ? "30"
        : String(Math.round(hypotheek.looptijdMaanden / 12)),
    depotRente: alsTekst(hypotheek?.depotRente),
    grondbedrag: toonBedragInvoer(hypotheek?.grondbedrag),
    passeerdatum: hypotheek?.passeerdatum,
  };
}

// ── Van het formulier naar de opslag ───────────────────────────────────────

/**
 * Een veld dat alleen meegaat als er iets in staat.
 *
 * `exactOptionalPropertyTypes` staat aan (ADR-0003), dus een veld expliciet op
 * `undefined` zetten is iets anders dan het weglaten — en de opslaglaag
 * accepteert het eerste niet.
 */
function tekstveld<K extends string>(sleutel: K, waarde: string) {
  const schoon = waarde.trim();
  return schoon === "" ? {} : ({ [sleutel]: schoon } as Record<K, string>);
}

function getalveld<K extends string>(sleutel: K, waarde: string) {
  const getal = leesGetalInvoer(waarde);
  return getal === undefined ? {} : ({ [sleutel]: getal } as Record<K, number>);
}

function bedragveld<K extends string>(sleutel: K, waarde: string) {
  const bedrag = leesBedragInvoer(waarde);
  return bedrag === undefined ? {} : ({ [sleutel]: bedrag } as Record<K, number>);
}

function datumveld<K extends string>(sleutel: K, waarde: Date | undefined) {
  return waarde === undefined ? {} : ({ [sleutel]: waarde } as Record<K, Date>);
}

/**
 * Leest een getal dat geen bedrag is: een bouwjaar, een oppervlakte, een
 * rentepercentage.
 *
 * Accepteert de komma als decimaalteken, want dat is wat een Nederlands
 * toetsenbord geeft. Weigert alles wat geen getal is in plaats van er stil 0
 * van te maken — een rente van 0% zou anders als feit in het dossier belanden.
 */
export function leesGetalInvoer(tekst: string): number | undefined {
  const schoon = tekst.trim().replace(",", ".");
  if (schoon === "") return undefined;
  const getal = Number(schoon);
  return Number.isFinite(getal) ? getal : undefined;
}

/** Wat er van de woningstap naar het paspoort gaat. */
export function woningpaspoortPatch(waarden: Wizardwaarden): WoningpaspoortData {
  const kadaster = {
    ...tekstveld("gemeente", waarden.kadasterGemeente),
    ...tekstveld("sectie", waarden.kadasterSectie),
    ...tekstveld("perceelnummer", waarden.kadasterPerceelnummer),
  };

  return {
    ...tekstveld("adres", waarden.adres),
    ...tekstveld("huisnummer", waarden.huisnummer),
    ...tekstveld("huisnummerToevoeging", waarden.huisnummerToevoeging),
    ...tekstveld("postcode", waarden.postcode),
    ...tekstveld("plaats", waarden.plaats),
    ...(waarden.woningtype === "" ? {} : { woningtype: waarden.woningtype }),
    ...getalveld("bouwjaar", waarden.bouwjaar),
    ...getalveld("woonoppervlakte", waarden.woonoppervlakte),
    ...getalveld("perceeloppervlakte", waarden.perceeloppervlakte),
    ...(waarden.energielabel === "" ? {} : { energielabel: waarden.energielabel }),
    ...tekstveld("waarborgpolisnummer", waarden.waarborgpolisnummer),
    ...tekstveld("notaris", waarden.notaris),
    ...datumveld("transportdatum", waarden.transportdatum),
    ...(Object.keys(kadaster).length === 0 ? {} : { kadaster }),
  };
}

/**
 * De hypotheekmap, of niets.
 *
 * In zijn geheel of helemaal niet: een map met alleen een looptijd erin telt in
 * de UI als "ingevuld" en levert een maandlast op die nergens op slaat. De
 * looptijd staat daarom als enige niet in de test hieronder — hij heeft een
 * standaardwaarde en zegt op zichzelf niets.
 */
export function hypotheekPatch(waarden: Wizardwaarden): HypotheekData | undefined {
  const map = {
    ...bedragveld("bedrag", waarden.hypotheekBedrag),
    ...getalveld("rente", waarden.hypotheekRente),
    ...(waarden.hypotheekVorm === "" ? {} : { vorm: waarden.hypotheekVorm }),
    ...getalveld("depotRente", waarden.depotRente),
    ...bedragveld("grondbedrag", waarden.grondbedrag),
    ...datumveld("passeerdatum", waarden.passeerdatum),
  };

  if (Object.keys(map).length === 0) return undefined;

  const jaren = leesGetalInvoer(waarden.hypotheekLooptijdJaren);
  return {
    ...map,
    ...(jaren === undefined ? {} : { looptijdMaanden: Math.round(jaren * 12) }),
  };
}

/** Wat er van de financiële stap naar het project gaat. */
export type Financieelpatch = Partial<
  Pick<
    ProjectData,
    "koopsom" | "meerwerkbudget" | "bouwdepotBedrag" | "opschortingBedrag" | "hypotheek"
  >
>;

export function financieelPatch(waarden: Wizardwaarden): Financieelpatch {
  const hypotheek = hypotheekPatch(waarden);
  return {
    ...bedragveld("koopsom", waarden.koopsom),
    ...bedragveld("meerwerkbudget", waarden.meerwerkbudget),
    ...bedragveld("bouwdepotBedrag", waarden.bouwdepot),
    ...bedragveld("opschortingBedrag", waarden.opschortingBedrag),
    ...(hypotheek === undefined ? {} : { hypotheek }),
  };
}

/** Wat er van de contractstap naar het project gaat. */
export type Contractpatch = Partial<
  Pick<ProjectData, "bouwnummer" | "projectnaam" | "aannemer" | "garantiewaarborg">
>;

export function contractPatch(waarden: Wizardwaarden): Contractpatch {
  return {
    ...tekstveld("bouwnummer", waarden.bouwnummer),
    ...tekstveld("projectnaam", waarden.ontwikkelaar),
    ...tekstveld("aannemer", waarden.aannemer),
    garantiewaarborg: waarden.waarborg,
  };
}

/**
 * De naam waaronder het dossier bekend komt te staan.
 *
 * Valt terug op het adres en dan op de plaats, zodat er nooit een dossier
 * ontstaat dat "Naamloos project" heet terwijl het adres gewoon is ingevuld.
 */
export function projectnaamVan(waarden: Wizardwaarden): string {
  const eigen = waarden.naam.trim();
  if (eigen !== "") return eigen;

  const straat = [waarden.adres.trim(), waarden.huisnummer.trim()].filter(Boolean).join(" ");
  if (straat !== "") return straat;

  const plaats = waarden.plaats.trim();
  if (plaats !== "") return plaats;

  return waarden.traject === "nieuwbouw" ? "Mijn nieuwbouwwoning" : "Mijn woning";
}

// ── Controles per stap ─────────────────────────────────────────────────────

/**
 * Controleert de invoer van één stap.
 *
 * Geeft `null` als het klopt, anders een zin die de gebruiker kan lezen.
 * `verplicht` komt uit het stappenplan: bij een optionele stap zijn lege velden
 * geen fout, maar een onleesbaar bedrag nog steeds wél. Anders slaat de wizard
 * stilzwijgend niets op en denkt de gebruiker dat het gelukt is.
 */
export function controleerStap(
  stap: WizardStap,
  waarden: Wizardwaarden,
  verplicht: boolean,
): string | null {
  switch (stap) {
    case "woning": {
      if (verplicht && projectnaamVan(waarden) === "" ) {
        return "Geef je dossier een naam, of vul het adres in.";
      }
      if (verplicht && waarden.adres.trim() === "" && waarden.bouwnummer.trim() === "") {
        return "Vul het adres in, of het bouwnummer als het adres nog niet bekend is.";
      }
      const bouwjaar = leesGetalInvoer(waarden.bouwjaar);
      if (waarden.bouwjaar.trim() !== "" && bouwjaar === undefined) {
        return "Het bouwjaar is geen getal.";
      }
      if (bouwjaar !== undefined && (bouwjaar < 1000 || bouwjaar > 2200)) {
        return "Vul het bouwjaar als vier cijfers in, bijvoorbeeld 2026.";
      }
      for (const [label, tekst] of [
        ["woonoppervlakte", waarden.woonoppervlakte],
        ["perceeloppervlakte", waarden.perceeloppervlakte],
      ] as const) {
        if (tekst.trim() !== "" && leesGetalInvoer(tekst) === undefined) {
          return `De ${label} is geen getal.`;
        }
      }
      return null;
    }

    case "financieel": {
      for (const [label, tekst] of [
        ["koopsom", waarden.koopsom],
        ["meerwerkbudget", waarden.meerwerkbudget],
        ["bouwdepot", waarden.bouwdepot],
        ["5%-depot", waarden.opschortingBedrag],
        ["hypotheekbedrag", waarden.hypotheekBedrag],
        ["grondbedrag", waarden.grondbedrag],
      ] as const) {
        if (tekst.trim() !== "" && leesBedragInvoer(tekst) === undefined) {
          return `Het ${label} is geen bedrag dat de app kan lezen.`;
        }
      }
      for (const [label, tekst] of [
        ["rente", waarden.hypotheekRente],
        ["depotrente", waarden.depotRente],
      ] as const) {
        const getal = leesGetalInvoer(tekst);
        if (tekst.trim() !== "" && getal === undefined) {
          return `De ${label} is geen percentage dat de app kan lezen.`;
        }
        if (getal !== undefined && (getal < 0 || getal > 25)) {
          return `Een ${label} van ${String(getal)}% klopt vermoedelijk niet. Vul het percentage in, niet het bedrag.`;
        }
      }
      if (verplicht && waarden.koopsom.trim() === "") {
        return "Vul in ieder geval de koopsom in — daar hangt de rest van het financiële beeld aan.";
      }
      return null;
    }

    default:
      return null;
  }
}
