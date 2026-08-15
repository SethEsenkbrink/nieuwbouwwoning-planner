import * as fflate from "fflate";
import type { WoningdossierDB } from "@/db/db";
import type { VaultMeta } from "@/crypto/types";
import {
  ontgrendelMetHerstelcode,
  ontgrendelMetWachtwoord,
  ontsleutelBytes,
} from "@/crypto/crypto";
import { schrijfRuweBytes } from "@/lib/opfs/storage";
import { HUIDIGE_SCHEMA_VERSIE, migreer } from "@/migrations";
import type { DossierDatabasePayload, DossierManifest } from "./types";
import { valideerChecksums } from "./checksums";

export interface ImportResultaat {
  meta: VaultMeta;
  dek: CryptoKey;
  projectNaam: string;
  aantalRecords: number;
  /** Aantal bijlagen dat naar OPFS is teruggezet. */
  aantalBestanden: number;
  /** De schemaversie waarmee het bestand geschreven was, vóór migratie. */
  gemigreerdVanaf: number;
}

/**
 * Importeert en herstelt een `.woningdossier` bestand in de lokale database.
 */
export async function importeerDossier(
  zipBytes: Uint8Array,
  wachtwoordOfHerstelcode: string,
  database: WoningdossierDB,
): Promise<ImportResultaat> {
  // 1. Unzip het archief met fflate
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = fflate.unzipSync(zipBytes);
  } catch (err) {
    throw new Error("Ongeldig archiefbestand", { cause: err });
  }

  // 2. Valideer CHECKSUMS
  const checksumsBytes = unzipped.CHECKSUMS;
  if (!checksumsBytes) {
    throw new Error("Ongeldig .woningdossier bestand: CHECKSUMS ontbreekt.");
  }
  const checksumsTekst = new TextDecoder().decode(checksumsBytes);
  const checksumResult = await valideerChecksums(unzipped, checksumsTekst);
  if (!checksumResult.geldig) {
    throw new Error(`Integriteitscontrole mislukt:\n${checksumResult.fouten.join("\n")}`);
  }

  // 3. Lees en parse manifest.json
  const manifestBytes = unzipped["manifest.json"];
  if (!manifestBytes) {
    throw new Error("Ongeldig .woningdossier bestand: manifest.json ontbreekt.");
  }
  const manifestJson = new TextDecoder().decode(manifestBytes);
  let parsedManifest: Record<string, unknown>;
  try {
    parsedManifest = JSON.parse(manifestJson) as Record<string, unknown>;
  } catch {
    throw new Error("manifest.json bevat ongeldige JSON.");
  }

  if (parsedManifest.formaatVersie !== 1) {
    throw new Error(`Niet-ondersteunde formaatversie: ${String(parsedManifest.formaatVersie)}`);
  }

  const manifest = parsedManifest as unknown as DossierManifest;

  // Backups van vóór de migratieketen hadden geen `schemaVersie`. Die zijn per
  // definitie schemaversie 1 — dat is de enige versie die toen bestond.
  const schemaVersieUitBestand =
    typeof parsedManifest.schemaVersie === "number" ? parsedManifest.schemaVersie : 1;

  // 4. Ontgrendel de DEK via wachtwoord of herstelcode
  let dek: CryptoKey;
  try {
    dek = await ontgrendelMetWachtwoord(manifest.kluismeta, wachtwoordOfHerstelcode);
  } catch {
    try {
      dek = await ontgrendelMetHerstelcode(manifest.kluismeta, wachtwoordOfHerstelcode);
    } catch {
      throw new Error("Wachtwoordzin of herstelcode is onjuist voor dit dossier.");
    }
  }

  // 5. Ontsleutel data.enc
  const dataEncBytes = unzipped["data.enc"];
  if (!dataEncBytes || dataEncBytes.length < 28) {
    throw new Error("data.enc ontbreekt of is onvolledig.");
  }

  const dataIv = dataEncBytes.slice(0, 12);
  const dataCiphertext = dataEncBytes.slice(12);

  let decryptedBytes: Uint8Array;
  try {
    decryptedBytes = await ontsleutelBytes(dek, dataCiphertext, dataIv);
  } catch {
    throw new Error("Ontsleutelen van data.enc mislukt (authenticatie-tag ongeldig).");
  }

  // 6. Parse de database payload
  const payloadJson = new TextDecoder().decode(decryptedBytes);
  let payload: DossierDatabasePayload;
  try {
    payload = JSON.parse(payloadJson) as DossierDatabasePayload;
  } catch {
    throw new Error("Ontsleutelde database-inhoud bevat ongeldige JSON.");
  }

  // 7. Draai de migratieketen vóórdat er ook maar iets naar de database gaat.
  //
  //    `migreer` weigert bewust een schemaversie die nieuwer is dan deze build
  //    kent: doorgaan zou betekenen dat we velden wegschrijven waarvan we de
  //    betekenis niet kennen, en dat is stil dataverlies (A-03).
  const tabellen = migreer(
    payload.tabellen,
    schemaVersieUitBestand,
  ) as unknown as DossierDatabasePayload["tabellen"];
  let totaalAantalRecords = 0;

  await database.transaction(
    "rw",
    [
      database.vault_meta,
      database.projecten,
      database.ankers,
      database.betrokkenen,
      database.afspraken,
      database.phases,
      database.tasks,
      database.meerwerk,
      database.termijnen,
      database.gebreken,
      database.nabudget,
      database.onderdelen,
      database.onderhoudstaken,
      database.onderhoudslogboek,
      database.meters,
      database.meterstanden,
      database.materialen,
      database.garanties,
      database.verzekeringen,
      database.inboedel,
    ],
    async () => {
      // Wis huidige tabellen
      await Promise.all([
        database.vault_meta.clear(),
        database.projecten.clear(),
        database.ankers.clear(),
        database.betrokkenen.clear(),
        database.afspraken.clear(),
        database.phases.clear(),
        database.tasks.clear(),
        database.meerwerk.clear(),
        database.termijnen.clear(),
        database.gebreken.clear(),
        database.nabudget.clear(),
        database.onderdelen.clear(),
        database.onderhoudstaken.clear(),
        database.onderhoudslogboek.clear(),
        database.meters.clear(),
        database.meterstanden.clear(),
        database.materialen.clear(),
        database.garanties.clear(),
        database.verzekeringen.clear(),
        database.inboedel.clear(),
      ]);

      // Vul kluis-metadata
      await database.vault_meta.put(manifest.kluismeta);

      // Vul alle tabellen
      if (tabellen.projecten?.length) {
        await database.projecten.bulkPut(tabellen.projecten as never);
        totaalAantalRecords += tabellen.projecten.length;
      }
      if (tabellen.ankers?.length) {
        await database.ankers.bulkPut(tabellen.ankers as never);
        totaalAantalRecords += tabellen.ankers.length;
      }
      if (tabellen.betrokkenen?.length) {
        await database.betrokkenen.bulkPut(tabellen.betrokkenen as never);
        totaalAantalRecords += tabellen.betrokkenen.length;
      }
      if (tabellen.afspraken?.length) {
        await database.afspraken.bulkPut(tabellen.afspraken as never);
        totaalAantalRecords += tabellen.afspraken.length;
      }
      if (tabellen.phases?.length) {
        await database.phases.bulkPut(tabellen.phases as never);
        totaalAantalRecords += tabellen.phases.length;
      }
      if (tabellen.tasks?.length) {
        await database.tasks.bulkPut(tabellen.tasks as never);
        totaalAantalRecords += tabellen.tasks.length;
      }
      if (tabellen.meerwerk?.length) {
        await database.meerwerk.bulkPut(tabellen.meerwerk as never);
        totaalAantalRecords += tabellen.meerwerk.length;
      }
      if (tabellen.termijnen?.length) {
        await database.termijnen.bulkPut(tabellen.termijnen as never);
        totaalAantalRecords += tabellen.termijnen.length;
      }
      if (tabellen.gebreken?.length) {
        await database.gebreken.bulkPut(tabellen.gebreken as never);
        totaalAantalRecords += tabellen.gebreken.length;
      }
      if (tabellen.nabudget?.length) {
        await database.nabudget.bulkPut(tabellen.nabudget as never);
        totaalAantalRecords += tabellen.nabudget.length;
      }
      if (tabellen.onderdelen?.length) {
        await database.onderdelen.bulkPut(tabellen.onderdelen as never);
        totaalAantalRecords += tabellen.onderdelen.length;
      }
      if (tabellen.onderhoudstaken?.length) {
        await database.onderhoudstaken.bulkPut(tabellen.onderhoudstaken as never);
        totaalAantalRecords += tabellen.onderhoudstaken.length;
      }
      if (tabellen.onderhoudslogboek?.length) {
        await database.onderhoudslogboek.bulkPut(tabellen.onderhoudslogboek as never);
        totaalAantalRecords += tabellen.onderhoudslogboek.length;
      }
      if (tabellen.meters?.length) {
        await database.meters.bulkPut(tabellen.meters as never);
        totaalAantalRecords += tabellen.meters.length;
      }
      if (tabellen.meterstanden?.length) {
        await database.meterstanden.bulkPut(tabellen.meterstanden as never);
        totaalAantalRecords += tabellen.meterstanden.length;
      }
      if (tabellen.materialen?.length) {
        await database.materialen.bulkPut(tabellen.materialen as never);
        totaalAantalRecords += tabellen.materialen.length;
      }
      if (tabellen.garanties?.length) {
        await database.garanties.bulkPut(tabellen.garanties as never);
        totaalAantalRecords += tabellen.garanties.length;
      }
      if (tabellen.verzekeringen?.length) {
        await database.verzekeringen.bulkPut(tabellen.verzekeringen as never);
        totaalAantalRecords += tabellen.verzekeringen.length;
      }
      if (tabellen.inboedel?.length) {
        await database.inboedel.bulkPut(tabellen.inboedel as never);
        totaalAantalRecords += tabellen.inboedel.length;
      }
    },
  );

  // 8. Zet de bijlagen terug in OPFS.
  //
  //    De bytes in het archief zijn al onder de DEK versleuteld, dus ze gaan
  //    ongewijzigd terug. Vóór A-02 gebeurde dit helemaal niet en verloor de
  //    gebruiker bij elk herstel al zijn documenten.
  let aantalBestanden = 0;
  for (const [entryNaam, ruweBytes] of Object.entries(unzipped)) {
    if (!entryNaam.startsWith("files/") || !entryNaam.endsWith(".enc")) continue;
    if (entryNaam === "files/index.enc") continue;

    const uuid = entryNaam.slice("files/".length, -".enc".length);
    await schrijfRuweBytes(uuid, ruweBytes);
    aantalBestanden++;
  }

  const eersteProject = tabellen.projecten?.[0] as { naam?: string } | undefined;
  const projectNaam = eersteProject?.naam ?? "Woningdossier";

  return {
    meta: manifest.kluismeta,
    dek,
    projectNaam,
    aantalRecords: totaalAantalRecords,
    aantalBestanden,
    gemigreerdVanaf: schemaVersieUitBestand,
  };
}

export { HUIDIGE_SCHEMA_VERSIE };
