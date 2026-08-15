import * as fflate from "fflate";
import type { WoningdossierDB } from "@/db/db";
import type { VaultMeta } from "@/crypto/types";
import { versleutelBytes } from "@/crypto/crypto";
import { leesRuweBytes, lijstBestandUuids } from "@/lib/opfs/storage";
import { HUIDIGE_SCHEMA_VERSIE } from "@/migrations";
import type { BestandIndexItem, DossierDatabasePayload, DossierManifest } from "./types";
import { maakChecksumsTekst, valideerChecksums } from "./checksums";

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
    versie: HUIDIGE_SCHEMA_VERSIE,
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

  // 4. Neem de bijlagen uit OPFS mee.
  //
  //    Dit blok stond er niet: `bestandenIndex` was een hardgecodeerd lege
  //    array, waardoor `files/<uuid>.enc` nooit werd geschreven en elke
  //    bijlage stil verdween bij herstel — terwijl de app "backup geslaagd"
  //    meldde (A-02). De ruwe bytes gaan ongewijzigd mee: ze zijn al onder
  //    de DEK versleuteld, dus opnieuw versleutelen zou alleen de plaintext
  //    nodeloos door het geheugen halen.
  const bestandsUuids = await lijstBestandUuids();
  const bestandenIndex: BestandIndexItem[] = [];
  const bestandsEntries: Record<string, Uint8Array> = {};
  let totaalBestandsBytes = 0;

  for (const uuid of bestandsUuids) {
    const ruweBytes = await leesRuweBytes(uuid);
    bestandsEntries[`files/${uuid}.enc`] = ruweBytes;
    totaalBestandsBytes += ruweBytes.length;
    bestandenIndex.push({
      uuid,
      naam: `${uuid}.enc`,
      mimeType: "application/octet-stream",
      grootte: ruweBytes.length,
      sha256: await sha256Hex(ruweBytes),
      toegevoegdOp: new Date().toISOString(),
    });
  }

  const indexJsonBytes = new TextEncoder().encode(JSON.stringify(bestandenIndex));
  const { ciphertext: indexCiphertext, iv: indexIv } = await versleutelBytes(dek, indexJsonBytes);

  const indexEncBytes = new Uint8Array(indexIv.length + indexCiphertext.length);
  indexEncBytes.set(indexIv, 0);
  indexEncBytes.set(indexCiphertext, indexIv.length);

  // 5. Bouw onversleuteld manifest.json
  const aantallen: Record<string, number> = {};
  for (const [tabelNaam, rijen] of Object.entries(databasePayload.tabellen)) {
    aantallen[tabelNaam] = rijen.length;
  }

  const manifest: DossierManifest = {
    formaat: "woningdossier",
    formaatVersie: 1,
    schemaVersie: HUIDIGE_SCHEMA_VERSIE,
    appVersie: "0.1.0",
    aangemaaktOp: new Date().toISOString(),
    cipher: "AES-256-GCM",
    kluismeta: meta,
    aantallen,
    statistieken: {
      aantalProjecten: projecten.length,
      aantalBestanden: bestandenIndex.length,
      totaalBytes: dataEncBytes.length + totaalBestandsBytes,
    },
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

  // 6. Stel het zip dictionary samen
  const zipDict: Record<string, Uint8Array> = {
    "manifest.json": manifestBytes,
    "data.enc": dataEncBytes,
    "files/index.enc": indexEncBytes,
    ...bestandsEntries,
  };

  // 7. Genereer CHECKSUMS bestand
  const checksumsTekst = await maakChecksumsTekst(zipDict);
  zipDict.CHECKSUMS = new TextEncoder().encode(checksumsTekst);

  // 8. Maak het zip-bestand met fflate
  const zipBytes = fflate.zipSync(zipDict, { level: 6 });

  // 9. Lees terug vóórdat de aanroeper "geslaagd" mag melden.
  //
  //    Zonder deze stap werd een afgekapte of beschadigde schrijfactie als
  //    succes gerapporteerd (A-07). Een backup die je nooit hebt teruggelezen
  //    is geen backup — het is een aanname.
  await controleerArchief(zipBytes, Object.keys(zipDict));

  return zipBytes;
}

/** SHA-256 van bytes als hex-string. */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as ArrayBufferView<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Pakt het zojuist gebouwde archief opnieuw uit en controleert het volledig:
 * alle verwachte entries aanwezig, en alle checksums kloppend.
 */
async function controleerArchief(zipBytes: Uint8Array, verwachteEntries: string[]): Promise<void> {
  let uitgepakt: Record<string, Uint8Array>;
  try {
    uitgepakt = fflate.unzipSync(zipBytes);
  } catch (err) {
    throw new Error("Backupcontrole mislukt: het archief kon niet worden teruggelezen.", {
      cause: err,
    });
  }

  for (const entry of verwachteEntries) {
    if (!(entry in uitgepakt)) {
      throw new Error(`Backupcontrole mislukt: '${entry}' ontbreekt in het geschreven archief.`);
    }
  }

  const checksumsBytes = uitgepakt.CHECKSUMS;
  if (!checksumsBytes) {
    throw new Error("Backupcontrole mislukt: CHECKSUMS ontbreekt in het geschreven archief.");
  }

  const resultaat = await valideerChecksums(uitgepakt, new TextDecoder().decode(checksumsBytes));
  if (!resultaat.geldig) {
    throw new Error(`Backupcontrole mislukt:\n${resultaat.fouten.join("\n")}`);
  }
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
