import { toonDatum } from "@/lib/datum";
import { ANKER_TITELS } from "@/data/ankers";
import type { ActieRegel } from "@/lib/planning";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Concept-berichten — het enige wat deze app naar buiten laat gaan
 *
 * ADR-0008 noemt ze expliciet: bij elke regel op de actielijst een kant-en-klare
 * tekst. Zonder dat blijft doorgeven handwerk in een ander programma, en dan
 * wordt de doorgegeven-knop niet ingedrukt en verandert de lijst in ruis.
 *
 * DE BELANGRIJKSTE REGEL VAN DIT BESTAND
 * **Een bericht mag nooit meer zekerheid uitstralen dan de app heeft.** De
 * berekende datum kan een terugval zijn vanaf de opleverdatum omdat het echte
 * bouwmoment onbekend is (ADR-0009). In de UI staat daar een oranje melding bij;
 * in een mail aan de keukenleverancier verdwijnt die context volledig — hij
 * leest alleen een datum en zet die in zijn agenda.
 *
 * Daarom bevat elk bericht een expliciete zin over de hardheid van de datum, en
 * is die zin afhankelijk van `zekerheid` en van of de oplevering formeel is
 * aangezegd. Dat is geen beleefdheid maar constraint C5: de tool structureert en
 * herinnert, hij belooft niets namens de gebruiker.
 *
 * Het bericht wordt bewust **niet** verstuurd. De gebruiker kopieert het of
 * opent zijn eigen mailprogramma; er gaat geen mail vanuit de app de deur uit.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Conceptbericht {
  onderwerp: string;
  tekst: string;
}

export interface Berichtopties {
  /** Bijv. "Ons huis in Almere". Verschijnt tussen haakjes ter herkenning. */
  projectnaam?: string | undefined;
  /** Onder de groet. Leeg laten mag; dan eindigt het bericht na "groet,". */
  afzender?: string | undefined;
  /** Is de opleverdatum formeel aangezegd door de aannemer? */
  opleverAangezegd: boolean;
}

/** "Beste Jan," of, zonder contactpersoon, "Beste Keukenhuis," */
function aanhef(betrokkeneNaam: string, contactpersoon: string | undefined): string {
  const naam = contactpersoon?.trim();
  return `Beste ${naam !== undefined && naam !== "" ? naam : betrokkeneNaam},`;
}

/** De kern: wat is er aan de hand met de datum. */
function kern(regel: ActieRegel): string {
  const band = regel.berekend;
  const periode = band.isPunt
    ? toonDatum(band.verwacht)
    : `tussen ${toonDatum(band.vroegst)} en ${toonDatum(band.laatst)}`;

  if (regel.gecommuniceerdeDatum === undefined) {
    return band.isPunt
      ? `De datum die daar op dit moment voor staat is ${periode}.`
      : `Dat valt op dit moment naar verwachting ${periode}.`;
  }

  const eerder = `Eerder gaf ik hiervoor ${toonDatum(regel.gecommuniceerdeDatum)} door.`;
  const verschil = regel.verschilDagen ?? 0;

  if (!band.isPunt) {
    return `${eerder} Op dit moment ziet het ernaar uit dat het ${periode} valt.`;
  }

  const richting = verschil > 0 ? "later" : "eerder";
  const dagen = Math.abs(verschil);
  return `${eerder} Die datum is verschoven naar ${periode} — ${dagen} ${
    dagen === 1 ? "dag" : "dagen"
  } ${richting}.`;
}

/**
 * De zin over hoe hard de datum is. Dit is het stuk dat een volgende sessie
 * niet mag "opschonen": zonder deze zin presenteert het bericht een schatting
 * als een afspraak.
 */
function voorbehoud(regel: ActieRegel, opleverAangezegd: boolean): string {
  const band = regel.berekend;

  if (band.zekerheid === "teruggevallen") {
    return (
      `Deze datum is afgeleid van de verwachte opleverdatum; het moment waar het eigenlijk ` +
      `van afhangt (${ANKER_TITELS[band.gevraagdAnker].toLowerCase()}) is nog niet bekend. ` +
      `Beschouw hem daarom als indicatief — ik laat het weten zodra ik meer weet.`
    );
  }

  if (band.zekerheid === "anker_bevestigd" && opleverAangezegd) {
    return "Deze datum is inmiddels vastgelegd, dus we kunnen hem definitief inplannen.";
  }

  if (band.zekerheid === "anker_bevestigd") {
    return (
      "Het bouwmoment waar dit aan hangt staat vast, maar de oplevering is nog niet formeel " +
      "aangezegd. Ik geef het door zodra daar meer over bekend is."
    );
  }

  return (
    "De planning van de bouw kan nog schuiven, dus beschouw deze datum voorlopig als een " +
    "richtdatum. Ik laat het weten zodra hij vaststaat."
  );
}

export function maakConceptbericht(
  regel: ActieRegel,
  contactpersoon: string | undefined,
  opties: Berichtopties,
): Conceptbericht {
  const isNieuw = regel.gecommuniceerdeDatum === undefined;
  const project = opties.projectnaam?.trim();
  const projectDeel = project !== undefined && project !== "" ? ` (${project})` : "";

  const onderwerp = isNieuw
    ? `Planning ${regel.omschrijving}${projectDeel}`
    : `Gewijzigde datum: ${regel.omschrijving}${projectDeel}`;

  const regels = [
    aanhef(regel.betrokkeneNaam, contactpersoon),
    "",
    `Voor onze nieuwbouwwoning${projectDeel} gaat het om: ${regel.omschrijving}.`,
    "",
    kern(regel),
    "",
    voorbehoud(regel, opties.opleverAangezegd),
  ];

  if (regel.laatsteGratisSchuifdatum) {
    regels.push(
      "",
      `Voor de goede orde: volgens wat ik heb genoteerd kan de afspraak kosteloos verzet ` +
        `worden tot ${toonDatum(regel.laatsteGratisSchuifdatum)}. Klopt dat nog?`,
    );
  }

  regels.push(
    "",
    "Kun je laten weten of dit voor jullie werkbaar is?",
    "",
    "Met vriendelijke groet,",
  );

  const afzender = opties.afzender?.trim();
  if (afzender !== undefined && afzender !== "") regels.push(afzender);

  return { onderwerp, tekst: regels.join("\n") };
}

/**
 * Een `mailto:`-link opent het eigen mailprogramma met alles ingevuld. De app
 * verstuurt niets zelf — dat zou een mailprovider en een serverside key vragen,
 * en de gebruiker uit de lus halen op precies het moment dat hij er nog even
 * naar wil kijken.
 */
export function mailtoLink(email: string, bericht: Conceptbericht): string {
  const vraagtekens = new URLSearchParams({
    subject: bericht.onderwerp,
    body: bericht.tekst,
  });
  // URLSearchParams codeert spaties als "+", wat in een mailto-body letterlijk
  // als plusteken aankomt. Vandaar de correctie.
  return `mailto:${encodeURIComponent(email)}?${vraagtekens.toString().replace(/\+/g, "%20")}`;
}
