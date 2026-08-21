import type { TrajectType } from "@/types/model";
import { isOpOfNa, isVoor, type Instapmoment } from "./instapmoment";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Welke stappen de wizard toont, gegeven traject en instapmoment
 *
 * De regel per stap staat hieronder als functie en niet als tabel met vinkjes.
 * Bij zes momenten maal twee trajecten is een tabel twaalf kolommen breed en
 * kan niemand meer zien wáárom er ergens een vinkje staat. Een regel van één
 * zin — "meerwerk vragen we niet meer als de sleutel er ligt" — kun je
 * nalezen, en de test eronder pint hem vast.
 *
 * VERPLICHT VERSUS OPTIONEEL. De wizard moet compleet zijn zonder dwingend te
 * worden. Verplichte stappen laten zich niet overslaan omdat de app er zonder
 * niets zinnigs kan doen: zonder woning geen dossier, zonder bedragen geen
 * financieel beeld. Optionele stappen krijgen een "Later invullen"-knop en
 * blijven daarna vanuit het dashboard bereikbaar. Wie oriënteert heeft nog
 * geen aanneemsom, en die dan verplicht stellen levert een verzonnen getal op
 * dat vervolgens als feit in het dossier staat.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type WizardStap =
  | "start"
  | "woning"
  | "contract"
  | "planning"
  | "financieel"
  | "betrokkenen"
  | "oplevering"
  | "onderdelen"
  | "onderhoud"
  | "meters"
  | "klaar";

export interface Stapdefinitie {
  stap: WizardStap;
  /** Kort label voor de stapindicator. */
  titel: string;
  /** Kop boven het formulier. */
  kop: string;
  uitleg: string;
  /**
   * Verplicht = de wizard laat je niet verder zonder de kernvelden.
   * Optioneel = er staat een knop "Later invullen".
   */
  verplicht: boolean;
}

interface Stapregel {
  stap: WizardStap;
  titel: string;
  /** Kop en uitleg mogen per traject verschillen. */
  kop: (traject: TrajectType) => string;
  uitleg: (traject: TrajectType, moment: Instapmoment) => string;
  geldt: (traject: TrajectType, moment: Instapmoment) => boolean;
  verplicht: (traject: TrajectType, moment: Instapmoment) => boolean;
}

const ALTIJD = () => true;

const REGELS: readonly Stapregel[] = [
  {
    stap: "start",
    titel: "Start",
    kop: () => "Waar sta je nu?",
    uitleg: () =>
      "Deze ene keuze bepaalt de rest van de wizard. Kies wat het dichtst in de buurt komt — " +
      "je kunt hem later altijd bijstellen zonder iets kwijt te raken.",
    geldt: ALTIJD,
    verplicht: ALTIJD,
  },

  {
    stap: "woning",
    titel: "De woning",
    kop: () => "Om welke woning gaat het?",
    uitleg: (_traject, moment) =>
      moment === "orientatie"
        ? "Vul in wat je weet. Ken je het adres nog niet, dan volstaat een werknaam en het bouwnummer."
        : "Het adres, het type en de oppervlakte. Deze gegevens sturen straks welke onderdelen en " +
          "onderhoudstaken de app voorstelt — een appartement heeft geen dakgoot.",
    geldt: ALTIJD,
    // Zonder woning is er geen dossier. Alleen bij oriëntatie kan het adres
    // nog echt onbekend zijn.
    verplicht: (_t, moment) => moment !== "orientatie",
  },

  {
    stap: "contract",
    titel: "Contract",
    kop: (traject) =>
      traject === "nieuwbouw" ? "Aannemer, waarborg en contract" : "Verkoop, notaris en makelaar",
    uitleg: (traject) =>
      traject === "nieuwbouw"
        ? "Wie bouwt er, onder welke garantieregeling, en met welk polisnummer. Die regeling bepaalt " +
          "de garantietermijnen die de app straks voor je bijhoudt."
        : "Wie het verkoopt, welke notaris het transport doet en of er een makelaar bij betrokken is.",
    geldt: ALTIJD,
    verplicht: (_t, moment) => isOpOfNa(moment, "net_gekocht"),
  },

  {
    stap: "planning",
    titel: "Planning",
    kop: (traject) => (traject === "nieuwbouw" ? "De opleverdatum" : "Datums en voorwaarden"),
    uitleg: (traject) =>
      traject === "nieuwbouw"
        ? "Een opleverdatum schuift bijna altijd. Daarom slaat de app niet alleen een datum op, maar " +
          "ook hoe zeker die is — dat bepaalt wie je nu al kunt boeken en wie beter kan wachten."
        : "De datum van het transport bij de notaris, en de uiterste datums van je ontbindende " +
          "voorwaarden. Die laatste zijn hard: verstrijken ze, dan vervalt je uitweg.",
    // Wie er al jaren woont heeft geen planning meer; die datums zijn geschiedenis.
    geldt: (_t, moment) => moment !== "in_beheer",
    verplicht: (_t, moment) => moment === "in_aanbouw" || moment === "bijna_oplevering",
  },

  {
    stap: "financieel",
    titel: "Financieel",
    kop: () => "Het financiële beeld",
    uitleg: (traject, moment) =>
      isOpOfNa(moment, "net_opgeleverd")
        ? "Wat de woning gekost heeft en wat de hypotheek maandelijks doet. Zonder deze bedragen " +
          "blijft het dossier een agenda in plaats van een overzicht."
        : traject === "nieuwbouw"
          ? "Koopsom, meerwerkbudget en bouwdepot, plus de hypotheek. Hiermee kan de app de " +
            "depotstand, de bouwrente en je maandlasten doorrekenen."
          : "Koopsom, verbouwbudget en de hypotheek. Hiermee kan de app je maandlasten en je " +
            "resterende ruimte doorrekenen.",
    geldt: ALTIJD,
    // Hier draait het om. Bij oriëntatie zijn de bedragen nog een schatting,
    // dus dan niet verplicht — daarna wel.
    verplicht: (_t, moment) => moment !== "orientatie",
  },

  {
    stap: "betrokkenen",
    titel: "Betrokkenen",
    kop: () => "Wie schakel je zelf in?",
    uitleg: () =>
      "De app zet er meteen de bijbehorende afspraken bij, gekoppeld aan het juiste bouwmoment. " +
      "Schuift de bouw, dan zie je direct wie je moet bellen en wie nog even kan wachten.",
    // Na de sleuteloverdracht is het inplannen van keukenleveranciers en
    // verhuizers verleden tijd. Wie dan instapt, slaat dit over.
    geldt: (_t, moment) => isVoor(moment, "net_opgeleverd"),
    verplicht: () => false,
  },

  {
    stap: "oplevering",
    titel: "Oplevering",
    kop: (traject) => (traject === "nieuwbouw" ? "Oplevering en het 5%-depot" : "De sleuteloverdracht"),
    uitleg: (traject) =>
      traject === "nieuwbouw"
        ? "Het opschortingsrecht van 5% (art. 7:768 BW) vervalt drie maanden na oplevering, tenzij je " +
          "schriftelijk blokkeert. Vul het depotbedrag in, dan zet de app de klok voor je."
        : "Wat er bij de sleuteloverdracht is afgesproken, en welke gebreken je hebt vastgelegd.",
    // Alleen relevant rond het moment zelf: ervóór weet je nog niets, en wie
    // er al jaren woont heeft deze termijnen allang gehad.
    geldt: (_t, moment) => moment === "bijna_oplevering" || moment === "net_opgeleverd",
    verplicht: () => false,
  },

  {
    stap: "onderdelen",
    titel: "Installaties",
    kop: () => "Wat zit er in de woning?",
    uitleg: () =>
      "Ketel, warmtepomp, WTW, zonnepanelen, kozijnen. Per onderdeel het merk en de installatiedatum. " +
      "Daaruit volgen de garantieklokken en de onderhoudstaken — dit is de basis van al het volgende.",
    geldt: (_t, moment) => isOpOfNa(moment, "net_opgeleverd"),
    verplicht: () => false,
  },

  {
    stap: "onderhoud",
    titel: "Onderhoud",
    kop: () => "Wat komt er terug, en hoe vaak?",
    uitleg: (_traject, moment) =>
      moment === "in_beheer"
        ? "Hier begint het voor jou. Vink aan wat er in jouw huis speelt; de app houdt bij wanneer het " +
          "weer aan de beurt is en wat het gekost heeft."
        : "Vink aan wat er in jouw huis speelt. De intervallen zijn voorstellen — het voorschrift van " +
          "de fabrikant gaat altijd voor.",
    geldt: (_t, moment) => isOpOfNa(moment, "net_opgeleverd"),
    // Wie als beheerder instapt, komt hiervoor. Dan is dit de kern en niet
    // een bijzaak die je overslaat.
    verplicht: (_t, moment) => moment === "in_beheer",
  },

  {
    stap: "meters",
    titel: "Meters",
    kop: () => "Meterstanden en verbruik",
    uitleg: (_traject, moment) =>
      moment === "bijna_oplevering"
        ? "Noteer je meters nu alvast. De standen op de dag van overdracht zijn het enige bewijs bij " +
          "een discussie met de netbeheerder, en die dag vergeet iedereen het."
        : "Welke meters je hebt en wat ze nu aanwijzen. Daarmee kan de app je verbruik en je " +
          "teruglevering volgen.",
    geldt: (_t, moment) => isOpOfNa(moment, "bijna_oplevering"),
    verplicht: () => false,
  },

  {
    stap: "klaar",
    titel: "Klaar",
    kop: () => "Je dossier staat",
    uitleg: () =>
      "Een overzicht van wat er is ingericht en wat er nog open staat. Alles wat je hebt overgeslagen " +
      "blijft vanuit het dashboard bereikbaar.",
    geldt: ALTIJD,
    verplicht: ALTIJD,
  },
];

/** De stappen die bij dit traject en dit moment horen, in volgorde. */
export function stappenVoor(
  traject: TrajectType,
  moment: Instapmoment,
): readonly Stapdefinitie[] {
  return REGELS.filter((regel) => regel.geldt(traject, moment)).map((regel) => ({
    stap: regel.stap,
    titel: regel.titel,
    kop: regel.kop(traject),
    uitleg: regel.uitleg(traject, moment),
    verplicht: regel.verplicht(traject, moment),
  }));
}

/** Positie van een stap binnen het plan, of -1 als hij er niet in zit. */
export function stapIndex(stappen: readonly Stapdefinitie[], stap: WizardStap): number {
  return stappen.findIndex((s) => s.stap === stap);
}

/**
 * De stap waar de wizard heen moet na `huidige`.
 *
 * Geeft `null` terug op de laatste stap, zodat de aanroeper zelf bepaalt wat
 * er dan gebeurt — afronden is een actie, geen navigatie.
 */
export function volgendeStap(
  stappen: readonly Stapdefinitie[],
  huidige: WizardStap,
): WizardStap | null {
  const index = stapIndex(stappen, huidige);
  if (index < 0 || index >= stappen.length - 1) return null;
  return stappen[index + 1]?.stap ?? null;
}

export function vorigeStap(
  stappen: readonly Stapdefinitie[],
  huidige: WizardStap,
): WizardStap | null {
  const index = stapIndex(stappen, huidige);
  if (index <= 0) return null;
  return stappen[index - 1]?.stap ?? null;
}

/**
 * Waar de wizard naartoe moet als het stappenplan verandert.
 *
 * Wisselt iemand op stap 5 van traject, dan kan de stap waar hij stond
 * verdwenen zijn. Terugvallen naar het begin zou zijn werk onzichtbaar maken;
 * dit zoekt de laatste stap die nog bestaat en niet verder ligt dan waar hij
 * was.
 */
export function dichtstbijzijndeStap(
  stappen: readonly Stapdefinitie[],
  huidige: WizardStap,
): WizardStap {
  const eerste = stappen[0]?.stap ?? "start";
  if (stapIndex(stappen, huidige) >= 0) return huidige;

  const alleStappen = REGELS.map((r) => r.stap);
  const doel = alleStappen.indexOf(huidige);
  if (doel < 0) return eerste;

  let beste = eerste;
  for (const definitie of stappen) {
    if (alleStappen.indexOf(definitie.stap) <= doel) beste = definitie.stap;
  }
  return beste;
}

/**
 * Hoeveel van het plan is af.
 *
 * `start` en `klaar` tellen niet mee: de eerste is een keuze en niet iets wat
 * je invult, en de laatste is een samenvatting. Zouden ze wel meetellen, dan
 * begint iedere wizard op 9% en eindigt hij op 100% zonder dat er iets gebeurd
 * is.
 */
export function voortgang(
  stappen: readonly Stapdefinitie[],
  afgerond: readonly WizardStap[],
): { gedaan: number; totaal: number; percentage: number } {
  const telt = stappen.filter((s) => s.stap !== "start" && s.stap !== "klaar");
  const totaal = telt.length;
  const gedaan = telt.filter((s) => afgerond.includes(s.stap)).length;
  return {
    gedaan,
    totaal,
    percentage: totaal === 0 ? 100 : Math.round((gedaan / totaal) * 100),
  };
}

/** De verplichte stappen die nog niet zijn afgerond. */
export function openVerplichteStappen(
  stappen: readonly Stapdefinitie[],
  afgerond: readonly WizardStap[],
): readonly Stapdefinitie[] {
  return stappen.filter(
    (s) => s.verplicht && s.stap !== "start" && s.stap !== "klaar" && !afgerond.includes(s.stap),
  );
}
