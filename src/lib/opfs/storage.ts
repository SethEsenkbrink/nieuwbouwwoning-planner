import { ontsleutelBytes, versleutelBytes } from "@/crypto/crypto";

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
  const { ciphertext, iv } = await versleutelBytes(dek, data);
  const payload = new Uint8Array(iv.length + ciphertext.length);
  payload.set(iv, 0);
  payload.set(ciphertext, iv.length);

  const dir = await haalFilesDirectory();
  if (!dir) {
    inMemoryFiles.set(uuid, payload);
    return;
  }

  const fileHandle = await dir.getFileHandle(`${uuid}.enc`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(payload);
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

  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  return ontsleutelBytes(dek, ciphertext, iv);
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
