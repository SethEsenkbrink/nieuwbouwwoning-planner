import type { ProjectMetId } from "@/lib/converters";
import type { Instapmoment } from "./instapmoment";
import { dichtstbijzijndeMoment } from "./instapmoment";
import type { WizardStap } from "./stappen";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Wat er al in het dossier staat — en wat de wizard daaruit afleidt
 *
 * De wizard is te sluiten en later te hervatten. Bij terugkomst moet hij twee
 * dingen weten: waar de gebruiker ongeveer staat, en welke stappen hij al
 * gedaan heeft. Beide worden hier uit het dossier zélf afgeleid en niet apart
 * opgeslagen.
 *
 * WAAROM NIET OPSLAAN. Een `instapmoment` op het project zou een 23e veld zijn
 * en, belangrijker, een tweede waarheid naast `woningStatus`. Die twee zouden
 * uit elkaar lopen zodra iemand zijn status omzet zonder de wizard te openen —
 * en dan toont de wizard vragen over een bouw die allang klaar is.
 *
 * HET GERADEN MOMENT IS EEN VOORSTEL, GEEN VASTSTELLING. De wizard zet het als
 * voorselectie op stap 1 en vraagt het gewoon opnieuw. Dat is niet dubbelop:
 * tussen twee sessies kan er van alles gebeurd zijn, en juist dan wil je die
 * vraag stellen.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Dossierstand {
  project: ProjectMetId | null;
  aantalBetrokkenen: number;
  aantalOnderdelen: number;
  aantalOnderhoudstaken: number;
  aantalMeters: number;
}

export const LEGE_DOSSIERSTAND: Dossierstand = {
  project: null,
  aantalBetrokkenen: 0,
  aantalOnderdelen: 0,
  aantalOnderhoudstaken: 0,
  aantalMeters: 0,
};

/**
 * Het moment dat het best bij dit project past.
 *
 * De volgorde van de vragen is niet willekeurig: de status van de oplevering
 * zegt meer dan de datum ervan, en `woningStatus` zegt meer dan allebei — dat
 * veld zet de gebruiker bewust om (ADR-0010 §1), dus als het op `opgeleverd`
 * staat is dat een bewering en geen gevolgtrekking.
 */
export function raadMoment(project: ProjectMetId | null): Instapmoment {
  if (!project) return "net_gekocht";

  const traject = project.traject ?? "nieuwbouw";

  if (project.woningStatus === "opgeleverd") {
    // Onderscheid tussen "net" en "al een tijd": zolang er een depot in
    // behandeling is, zit iemand nog in de nasleep van de oplevering.
    //
    // Een status die er níét staat telt hier ook als lopend. Dat is de
    // voorzichtige kant op: `net_opgeleverd` toont méér stappen dan
    // `in_beheer`, en dit is een voorselectie die de gebruiker meteen daarna
    // bevestigt. Te veel tonen kost hem één klik; te weinig tonen kost hem de
    // stap waarop hij zijn 5%-depot had willen vastleggen.
    const depotLoopt =
      project.opschortingStatus === undefined ||
      project.opschortingStatus === "onbekend" ||
      project.opschortingStatus === "in_depot";
    return depotLoopt ? "net_opgeleverd" : "in_beheer";
  }

  if (project.opleverStatus === "aangezegd") return "bijna_oplevering";
  if (project.opleverVerwacht !== undefined) {
    return dichtstbijzijndeMoment(traject, "in_aanbouw");
  }
  if (project.koopsom !== undefined || project.aannemer !== undefined) return "net_gekocht";

  return "orientatie";
}

/**
 * Welke stappen op grond van de inhoud als afgerond mogen gelden.
 *
 * Bewust ruim: één ingevuld kernveld telt als "hier ben je geweest". Streng
 * zijn zou iemand die de wizard hervat door schermen sturen die hij al gehad
 * heeft, en dat is precies waarom mensen wizards wegklikken.
 *
 * `start` staat er altijd bij: wie een project heeft, heeft die keuze gemaakt.
 */
export function afgerondeStappen(stand: Dossierstand): WizardStap[] {
  const { project } = stand;
  if (!project) return [];

  const gedaan: WizardStap[] = ["start"];
  const paspoort = project.woningpaspoort;

  if (paspoort?.adres !== undefined || project.bouwnummer !== undefined) gedaan.push("woning");

  if (
    project.aannemer !== undefined ||
    project.projectnaam !== undefined ||
    paspoort?.notaris !== undefined ||
    paspoort?.waarborgpolisnummer !== undefined
  ) {
    gedaan.push("contract");
  }

  if (project.opleverVerwacht !== undefined || paspoort?.transportdatum !== undefined) {
    gedaan.push("planning");
  }

  if (project.koopsom !== undefined || project.hypotheek !== undefined) gedaan.push("financieel");

  if (project.opschortingBedrag !== undefined || project.opschortingStatus !== undefined) {
    gedaan.push("oplevering");
  }

  if (stand.aantalBetrokkenen > 0) gedaan.push("betrokkenen");
  if (stand.aantalOnderdelen > 0) gedaan.push("onderdelen");
  if (stand.aantalOnderhoudstaken > 0) gedaan.push("onderhoud");
  if (stand.aantalMeters > 0) gedaan.push("meters");

  return gedaan;
}
