import type { WoningdossierDB } from "@/db/db";
import type { VaultMeta } from "@/crypto/types";
import { downloadDossierBestand, exporteerDossier } from "./export";
import {
  controleerToegang,
  haalBewaardeBackupmap,
  haalSlotLeeftijden,
  ondersteuntBackupmap,
  schrijfEnControleer,
  type Toegang,
} from "./doel";
import { bepaalTeSchrijvenSlots, type BackupSlot } from "./rotatie";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De roulerende backup uitvoeren
 *
 * Brengt drie dingen samen die los van elkaar niets waard zijn: het schema
 * (welk slot is nu aan de beurt), het doel (mogen we daar schrijven) en de
 * export (wat schrijven we). De volgorde is bewust: eerst permissie, dan pas
 * exporteren. Een export van tientallen megabytes maken om vervolgens te
 * ontdekken dat de map niet toegankelijk is, is verspilde moeite en verspilde
 * tijd met de plaintext in het geheugen.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type BackupUitkomst =
  | { soort: "geschreven"; slots: BackupSlot[] }
  | { soort: "niets-te-doen" }
  | { soort: "gedownload" }
  | { soort: "toegang-nodig"; toegang: Toegang };

export interface RoulerendeBackupOpties {
  /** Peildatum. Injecteerbaar zodat de rotatie testbaar is. */
  datum?: Date;
  /**
   * Bij `true` wordt er gedownload als er geen bruikbare map is.
   *
   * Standaard `false`: een achtergrondcontrole bij het opstarten hoort niet
   * ongevraagd een downloadvenster te openen. Alleen wanneer de gebruiker zelf
   * op "backup maken" drukt is dat de juiste fallback.
   */
  valTerugOpDownload?: boolean;
  projectNaam?: string;
}

/**
 * Voert de roulerende backup uit voor zover er iets te doen is.
 *
 * Geeft altijd terug wát er gebeurd is, zodat de UI dat eerlijk kan tonen in
 * plaats van "gelukt" te melden als er niets geschreven is.
 */
export async function voerRoulerendeBackupUit(
  database: WoningdossierDB,
  dek: CryptoKey,
  meta: VaultMeta,
  opties: RoulerendeBackupOpties = {},
): Promise<BackupUitkomst> {
  const datum = opties.datum ?? new Date();

  // 1. Is er een bruikbare map?
  const map = ondersteuntBackupmap() ? await haalBewaardeBackupmap() : null;
  const toegang = await controleerToegang(map);

  if (!map || toegang !== "verleend") {
    if (opties.valTerugOpDownload) {
      const zip = await exporteerDossier(database, dek, meta);
      downloadDossierBestand(zip, opties.projectNaam);
      return { soort: "gedownload" };
    }
    return { soort: "toegang-nodig", toegang };
  }

  // 2. Welke slots zijn aan de beurt?
  const leeftijden = await haalSlotLeeftijden(map);
  const teSchrijven = bepaalTeSchrijvenSlots(datum, leeftijden);
  if (teSchrijven.length === 0) {
    return { soort: "niets-te-doen" };
  }

  // 3. Eén export, naar meerdere slots.
  //
  //    Dezelfde bytes in elk slot is precies de bedoeling: de reeksen
  //    verschillen in wannéér ze vervangen worden, niet in inhoud.
  const zip = await exporteerDossier(database, dek, meta);

  for (const slot of teSchrijven) {
    await schrijfEnControleer(map, slot.bestandsnaam, zip);
  }

  return { soort: "geschreven", slots: teSchrijven };
}
