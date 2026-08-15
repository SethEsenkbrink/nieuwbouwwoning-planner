import * as fflate from "fflate";
import type { WoningdossierDB } from "@/db/db";
import type { VaultMeta } from "@/crypto/types";
import { versleutelBytes } from "@/crypto/crypto";
import type { BestandIndexItem, DossierDatabasePayload, DossierManifest } from "./types";
import { maakChecksumsTekst } from "./checksums";

/**
 * Exporteert het complete woningdossier naar een streaming `.woningdossier` zip-archief.
 */
export async function exporteerDossier(
  database: WoningdossierDB,
  dek: CryptoKey,
  meta: VaultMeta,
): Promise<Uint8Array> {
  // 1. Haal alle tabellen op uit IndexedDB
  const [
    projecten,
    ankers,
    betrokkenen,
    afspraken,
    phases,
    tasks,
    meerwerk,
    termijnen,
    gebreken,
    nabudget,
    onderdelen,
    onderhoudstaken,
    onderhoudslogboek,
    meters,
    meterstanden,
    materialen,
    garanties,
    verzekeringen,
    inboedel,
  ] = await Promise.all([
    database.projecten.toArray(),
    database.ankers.toArray(),
    database.betrokkenen.toArray(),
    database.afspraken.toArray(),
    database.phases.toArray(),
    database.tasks.toArray(),
    database.meerwerk.toArray(),
    database.termijnen.toArray(),
    database.gebreken.toArray(),
    database.nabudget.toArray(),
    database.onderdelen.toArray(),
    database.onderhoudstaken.toArray(),
    database.onderhoudslogboek.toArray(),
    database.meters.toArray(),
    database.meterstanden.toArray(),
    database.materialen.toArray(),
    database.garanties.toArray(),
    database.verzekeringen.toArray(),
    database.inboedel.toArray(),
  ]);

  // 2. Bouw de database payload
  const databasePayload: DossierDatabasePayload = {
    versie: 1,
    exportDatum: new Date().toISOString(),
    tabellen: {
      projecten,
      ankers,
      betrokkenen,
      afspraken,
      phases,
      tasks,
      meerwerk,
      termijnen,
      gebreken,
      nabudget,
      onderdelen,
      onderhoudstaken,
      onderhoudslogboek,
      meters,
      meterstanden,
      materialen,
      garanties,
      verzekeringen,
      inboedel,
    },
  };

  // 3. Serialiseer en versleutel de data payload onder de DEK
  const jsonBytes = new TextEncoder().encode(JSON.stringify(databasePayload));
  const { ciphertext: dataCiphertext, iv: dataIv } = await versleutelBytes(dek, jsonBytes);

  // Combineer 12-byte IV + Ciphertext + Tag in data.enc
  const dataEncBytes = new Uint8Array(dataIv.length + dataCiphertext.length);
  dataEncBytes.set(dataIv, 0);
  dataEncBytes.set(dataCiphertext, dataIv.length);

  // 4. Versleutel het bestandenindexregister
  const bestandenIndex: BestandIndexItem[] = [];
  const indexJsonBytes = new TextEncoder().encode(JSON.stringify(bestandenIndex));
  const { ciphertext: indexCiphertext, iv: indexIv } = await versleutelBytes(dek, indexJsonBytes);

  const indexEncBytes = new Uint8Array(indexIv.length + indexCiphertext.length);
  indexEncBytes.set(indexIv, 0);
  indexEncBytes.set(indexCiphertext, indexIv.length);

  // 5. Bouw onversleuteld manifest.json
  const manifest: DossierManifest = {
    formaatVersie: 1,
    appVersie: "0.1.0",
    aangemaaktOp: new Date().toISOString(),
    kluismeta: meta,
    statistieken: {
      aantalProjecten: projecten.length,
      aantalBestanden: bestandenIndex.length,
      totaalBytes: dataEncBytes.length,
    },
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

  // 6. Stel het zip dictionary samen
  const zipDict: Record<string, Uint8Array> = {
    "manifest.json": manifestBytes,
    "data.enc": dataEncBytes,
    "files/index.enc": indexEncBytes,
  };

  // 7. Genereer CHECKSUMS bestand
  const checksumsTekst = await maakChecksumsTekst(zipDict);
  zipDict.CHECKSUMS = new TextEncoder().encode(checksumsTekst);

  // 8. Maak het zip-bestand met fflate
  const zipBytes = fflate.zipSync(zipDict, { level: 6 });
  return zipBytes;
}

/**
 * Triggert een veilige browser-download van het geëxporteerde `.woningdossier` bestand.
 */
export function downloadDossierBestand(
  zipBytes: Uint8Array,
  projectNaam = "mijn-woning",
): void {
  const blob = new Blob([zipBytes as BlobPart], { type: "application/x-woningdossier" });
  const url = URL.createObjectURL(blob);
  const datumStr = new Date().toISOString().slice(0, 10);
  const veiligeNaam = projectNaam.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const bestandsnaam = `woningdossier-${veiligeNaam}-${datumStr}.woningdossier`;

  const link = document.createElement("a");
  link.href = url;
  link.download = bestandsnaam;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
