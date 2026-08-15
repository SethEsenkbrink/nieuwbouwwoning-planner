import { ontsleutelBytes } from "@/crypto/crypto";
import { genereerIV } from "@/crypto/kdf";

/**
 * ── Chunkformaat voor versleutelde documenten ──────────────────────────────
 *
 * Een bouwtekening of aannemingsovereenkomst kan tientallen megabytes zijn.
 * Die in één keer in het geheugen laden en met één IV versleutelen werkt, maar
 * schaalt slecht en wijkt af van de specificatie (A-05).
 *
 * Opzet, na een vaste kop van 8 bytes:
 *
 *   "WDCHUNK1"                       magic + formaatversie
 *   per chunk:
 *     12 bytes   IV, vers uit crypto.getRandomValues — nooit afgeleid van een
 *                teller, nooit hergebruikt tussen chunks
 *      4 bytes   lengte van de ciphertext (big-endian uint32)
 *      n bytes   AES-256-GCM ciphertext incl. 16-byte authenticatietag
 *
 * Elke chunk heeft dus zijn eigen IV én zijn eigen authenticatietag. Een
 * gewijzigde of afgekapte chunk valt daardoor op bij het ontsleutelen in
 * plaats van stil verkeerde bytes op te leveren.
 */
const CHUNK_MAGIC = "WDCHUNK1";
const CHUNK_GROOTTE = 1024 * 1024; // 1 MiB
const IV_LENGTE = 12;
const LENGTE_VELD = 4;

function magicBytes(): Uint8Array {
  return new TextEncoder().encode(CHUNK_MAGIC);
}

function heeftChunkKop(payload: Uint8Array): boolean {
  const magic = magicBytes();
  if (payload.length < magic.length) return false;
  return magic.every((b, i) => payload[i] === b);
}

/**
 * In-memory fallback voor omgevingen zonder OPFS (zoals Node / Vitest)
 */
const inMemoryFiles = new Map<string, Uint8Array>();

/**
 * Geeft de directory handle voor de `files/` map in OPFS terug.
 */
async function haalFilesDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) {
    return null;
  }
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle("files", { create: true });
  } catch {
    return null;
  }
}

/**
 * Slaat een bestand versleuteld op in OPFS onder de opgegeven UUID.
 * Versleuteling: AES-256-GCM onder de actieve DEK.
 */
export async function slaBestandOp(
  dek: CryptoKey,
  uuid: string,
  data: Uint8Array,
): Promise<void> {
  const payload = await versleutelInChunks(dek, data);

  const dir = await haalFilesDirectory();
  if (!dir) {
    inMemoryFiles.set(uuid, payload);
    return;
  }

  const fileHandle = await dir.getFileHandle(`${uuid}.enc`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(payload as unknown as FileSystemWriteChunkType);
  await writable.close();
}

/**
 * Leest en ontsleutelt een bestand uit OPFS onder de opgegeven UUID.
 */
export async function leesBestand(
  dek: CryptoKey,
  uuid: string,
): Promise<Uint8Array> {
  const dir = await haalFilesDirectory();
  let payload: Uint8Array | undefined;

  if (!dir) {
    payload = inMemoryFiles.get(uuid);
    if (!payload) {
      throw new Error(`Bestand met UUID '${uuid}' niet gevonden.`);
    }
  } else {
    try {
      const fileHandle = await dir.getFileHandle(`${uuid}.enc`);
      const file = await fileHandle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      payload = new Uint8Array(arrayBuffer);
    } catch {
      throw new Error(`Bestand met UUID '${uuid}' niet gevonden in OPFS.`);
    }
  }

  if (payload.length < 28) {
    throw new Error(`Bestand '${uuid}' is corrupt of onvolledig.`);
  }

  return ontsleutelUitChunks(dek, payload, uuid);
}

// ── Chunked encryptie ──────────────────────────────────────────────────────

/** Versleutelt data in blokken van 1 MiB, elk met een eigen verse IV. */
async function versleutelInChunks(dek: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const magic = magicBytes();
  const delen: Uint8Array[] = [magic];
  let totaal = magic.length;

  for (let start = 0; start < data.length; start += CHUNK_GROOTTE) {
    const blok = data.subarray(start, Math.min(start + CHUNK_GROOTTE, data.length));

    // Verse IV per chunk. Bewust géén teller en géén afleiding uit de vorige
    // IV: hergebruik van een IV onder dezelfde sleutel breekt AES-GCM volledig.
    const iv = genereerIV(IV_LENGTE);
    const ciphertext = await versleutelMetIV(dek, iv, blok);

    const kop = new Uint8Array(IV_LENGTE + LENGTE_VELD);
    kop.set(iv, 0);
    new DataView(kop.buffer).setUint32(IV_LENGTE, ciphertext.length, false);

    delen.push(kop, ciphertext);
    totaal += kop.length + ciphertext.length;
  }

  // Een leeg bestand levert alleen de kop op; dat is geldig en leest terug
  // als een lege Uint8Array.
  const payload = new Uint8Array(totaal);
  let offset = 0;
  for (const deel of delen) {
    payload.set(deel, offset);
    offset += deel.length;
  }
  return payload;
}

/**
 * Ontsleutelt een chunked payload.
 *
 * Bestanden die vóór A-05 zijn opgeslagen hebben geen chunkkop: die staan als
 * één IV gevolgd door één ciphertext op schijf. Die worden nog gewoon gelezen,
 * zodat bestaande bijlagen niet onbruikbaar worden door deze wijziging.
 */
async function ontsleutelUitChunks(
  dek: CryptoKey,
  payload: Uint8Array,
  uuid: string,
): Promise<Uint8Array> {
  if (!heeftChunkKop(payload)) {
    const iv = payload.slice(0, IV_LENGTE);
    const ciphertext = payload.slice(IV_LENGTE);
    return ontsleutelBytes(dek, ciphertext, iv);
  }

  const delen: Uint8Array[] = [];
  let totaal = 0;
  let offset = magicBytes().length;

  while (offset < payload.length) {
    if (offset + IV_LENGTE + LENGTE_VELD > payload.length) {
      throw new Error(`Bestand '${uuid}' is afgekapt: onvolledige chunkkop.`);
    }

    const iv = payload.slice(offset, offset + IV_LENGTE);
    const lengte = new DataView(
      payload.buffer,
      payload.byteOffset + offset + IV_LENGTE,
      LENGTE_VELD,
    ).getUint32(0, false);
    offset += IV_LENGTE + LENGTE_VELD;

    if (offset + lengte > payload.length) {
      throw new Error(`Bestand '${uuid}' is afgekapt: chunk loopt voorbij het einde.`);
    }

    const ciphertext = payload.slice(offset, offset + lengte);
    offset += lengte;

    const blok = await ontsleutelBytes(dek, ciphertext, iv);
    delen.push(blok);
    totaal += blok.length;
  }

  const resultaat = new Uint8Array(totaal);
  let schrijf = 0;
  for (const deel of delen) {
    resultaat.set(deel, schrijf);
    schrijf += deel.length;
  }
  return resultaat;
}

/** AES-256-GCM met een expliciet meegegeven IV. */
async function versleutelMetIV(
  dek: CryptoKey,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as ArrayBufferView<ArrayBuffer> },
    dek,
    data as ArrayBufferView<ArrayBuffer>,
  );
  return new Uint8Array(encrypted);
}

/**
 * Verwijdert een bestand uit OPFS.
 */
export async function verwijderBestand(uuid: string): Promise<void> {
  const dir = await haalFilesDirectory();
  if (!dir) {
    inMemoryFiles.delete(uuid);
    return;
  }
  try {
    await dir.removeEntry(`${uuid}.enc`);
  } catch {
    // Reeds verwijderd of niet bestaand
  }
}

/**
 * Controleert of een bestand bestaat in OPFS.
 */
export async function bestaatBestand(uuid: string): Promise<boolean> {
  const dir = await haalFilesDirectory();
  if (!dir) {
    return inMemoryFiles.has(uuid);
  }
  try {
    await dir.getFileHandle(`${uuid}.enc`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Geeft de UUID's van alle opgeslagen bestanden terug.
 *
 * Nodig voor de backup: die moet weten wélke bestanden er zijn. Vóór deze
 * functie bestond dat pad niet, en exporteerde de backup een hardgecodeerd
 * lege bestandsindex — waardoor bijlagen stil verdwenen bij herstel (A-02).
 */
export async function lijstBestandUuids(): Promise<string[]> {
  const dir = await haalFilesDirectory();
  if (!dir) {
    return [...inMemoryFiles.keys()];
  }

  const uuids: string[] = [];
  try {
    const iterableDir = dir as unknown as { keys: () => AsyncIterable<string> };
    for await (const naam of iterableDir.keys()) {
      if (naam.endsWith(".enc")) {
        uuids.push(naam.slice(0, -".enc".length));
      }
    }
  } catch {
    // Map bestaat nog niet of is leeg
  }
  return uuids;
}

/**
 * Leest de ruwe, nog versleutelde bytes (IV + ciphertext) van een bestand.
 *
 * De backup kopieert deze bytes ongewijzigd het archief in. Ontsleutelen en
 * opnieuw versleutelen zou onnodig zijn, trager, en zou de plaintext door het
 * geheugen halen zonder dat daar iets tegenover staat.
 */
export async function leesRuweBytes(uuid: string): Promise<Uint8Array> {
  const dir = await haalFilesDirectory();
  if (!dir) {
    const payload = inMemoryFiles.get(uuid);
    if (!payload) {
      throw new Error(`Bestand met UUID '${uuid}' niet gevonden.`);
    }
    return payload;
  }

  const fileHandle = await dir.getFileHandle(`${uuid}.enc`);
  const file = await fileHandle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * Schrijft ruwe, reeds versleutelde bytes terug naar OPFS. Gebruikt bij herstel.
 */
export async function schrijfRuweBytes(uuid: string, payload: Uint8Array): Promise<void> {
  const dir = await haalFilesDirectory();
  if (!dir) {
    inMemoryFiles.set(uuid, payload);
    return;
  }

  const fileHandle = await dir.getFileHandle(`${uuid}.enc`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(payload as unknown as FileSystemWriteChunkType);
  await writable.close();
}

/**
 * Wist alle bestanden uit de OPFS opslag (bijv. bij kluis reset).
 */
export async function wisAlleBestanden(): Promise<void> {
  inMemoryFiles.clear();
  const dir = await haalFilesDirectory();
  if (!dir) return;

  try {
    const iterableDir = dir as unknown as { keys: () => AsyncIterable<string> };
    for await (const name of iterableDir.keys()) {
      await dir.removeEntry(name);
    }
  } catch {
    // Map was wellicht leeg
  }
}
