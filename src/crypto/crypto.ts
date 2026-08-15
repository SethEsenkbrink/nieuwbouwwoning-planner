import type { VaultMeta } from "./types";
import {
  base64ToUint8Array,
  berekenKekA,
  berekenKekC,
  genereerIV,
  genereerZout,
  STANDAARD_ARGON2_PARAMS,
  uint8ArrayToBase64,
} from "./kdf";
import { decodeCrockfordBase32, genereerHerstelcode, maskeerHerstelcode } from "./herstelcode";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Cryptografische Kern van Woningdossier (Fase 1)
 *
 * Beheert de master-sleutel (DEK) en alle versleutelde operaties:
 * - DEK: AES-256-GCM, non-extractable CryptoKey in RAM
 * - KEK-A: Argon2id (m=65536, t=3, p=4) uit wachtwoordzin
 * - KEK-C: HKDF-SHA-256 uit 128-bit herstelcode
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface NieuweKluisResultaat {
  meta: VaultMeta;
  dek: CryptoKey;
  herstelcode: string;
}

/**
 * Maakt een nieuwe kluis aan: genereert DEK, zouten, KEK-A, KEK-C en herstelcode.
 */
export async function initialiseerNieuweKluis(
  wachtwoordzin: string,
): Promise<NieuweKluisResultaat> {
  const dekBytes = new Uint8Array(32);
  crypto.getRandomValues(dekBytes);

  const saltA = genereerZout(16);
  const ivA = genereerIV(12);
  const kekA = await berekenKekA(wachtwoordzin, saltA, STANDAARD_ARGON2_PARAMS);
  const wrappedDekABytes = await versleutelRaw(kekA, ivA, dekBytes);

  const { code: herstelcode, bytes: recoveryBytes } = genereerHerstelcode();
  const saltC = genereerZout(16);
  const ivC = genereerIV(12);
  const kekC = await berekenKekC(recoveryBytes, saltC);
  const wrappedDekCBytes = await versleutelRaw(kekC, ivC, dekBytes);

  // Importeer DEK als non-extractable CryptoKey voor gebruik in het geheugen
  const dek = await crypto.subtle.importKey(
    "raw",
    dekBytes as ArrayBufferView<ArrayBuffer>,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );

  // Wis ruw sleutelmateriaal direct uit het geheugen
  dekBytes.fill(0);
  recoveryBytes.fill(0);

  const nu = new Date().toISOString();
  const meta: VaultMeta = {
    id: "meta",
    versie: 1,
    saltA: uint8ArrayToBase64(saltA),
    ivA: uint8ArrayToBase64(ivA),
    wrappedDekA: uint8ArrayToBase64(wrappedDekABytes),
    saltC: uint8ArrayToBase64(saltC),
    ivC: uint8ArrayToBase64(ivC),
    wrappedDekC: uint8ArrayToBase64(wrappedDekCBytes),
    argon2Params: STANDAARD_ARGON2_PARAMS,
    recoveryCodeHint: maskeerHerstelcode(herstelcode),
    aangemaaktOp: nu,
    bijgewerktOp: nu,
  };

  return {
    meta,
    dek,
    herstelcode,
  };
}

/**
 * Ontgrendelt de kluis met de wachtwoordzin via KEK-A (Argon2id).
 */
export async function ontgrendelMetWachtwoord(
  meta: VaultMeta,
  wachtwoord: string,
): Promise<CryptoKey> {
  const saltA = base64ToUint8Array(meta.saltA);
  const ivA = base64ToUint8Array(meta.ivA);
  const wrappedDekA = base64ToUint8Array(meta.wrappedDekA);

  const kekA = await berekenKekA(wachtwoord, saltA, meta.argon2Params);

  let rawDek: Uint8Array;
  try {
    rawDek = await ontsleutelRaw(kekA, ivA, wrappedDekA);
  } catch {
    throw new Error("Onjuiste wachtwoordzin of kluis beschadigd.");
  }

  try {
    const dek = await crypto.subtle.importKey(
      "raw",
      rawDek as ArrayBufferView<ArrayBuffer>,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    return dek;
  } finally {
    rawDek.fill(0);
  }
}

/**
 * Herstelt / ontgrendelt de kluis met de 128-bit herstelcode via KEK-C (HKDF).
 */
export async function ontgrendelMetHerstelcode(
  meta: VaultMeta,
  herstelcode: string,
): Promise<CryptoKey> {
  const recoveryBytes = decodeCrockfordBase32(herstelcode);
  const saltC = base64ToUint8Array(meta.saltC);
  const ivC = base64ToUint8Array(meta.ivC);
  const wrappedDekC = base64ToUint8Array(meta.wrappedDekC);

  const kekC = await berekenKekC(recoveryBytes, saltC);
  recoveryBytes.fill(0);

  let rawDek: Uint8Array;
  try {
    rawDek = await ontsleutelRaw(kekC, ivC, wrappedDekC);
  } catch {
    throw new Error("Ongeldige herstelcode of kluis beschadigd.");
  }

  try {
    const dek = await crypto.subtle.importKey(
      "raw",
      rawDek as ArrayBufferView<ArrayBuffer>,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    return dek;
  } finally {
    rawDek.fill(0);
  }
}

// ── Raw AES-256-GCM operaties ──────────────────────────────────────────────

async function versleutelRaw(
  key: CryptoKey,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as ArrayBufferView<ArrayBuffer> },
    key,
    data as ArrayBufferView<ArrayBuffer>,
  );
  return new Uint8Array(encrypted);
}

async function ontsleutelRaw(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as ArrayBufferView<ArrayBuffer> },
    key,
    ciphertext as ArrayBufferView<ArrayBuffer>,
  );
  return new Uint8Array(decrypted);
}

// ── Payloads versleutelen en ontsleutelen ───────────────────────────────────

/**
 * Versleutelt een tekststring met de DEK (AES-256-GCM met verse 12-byte IV).
 */
export async function versleutelTekst(
  dek: CryptoKey,
  tekst: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = genereerIV(12);
  const data = new TextEncoder().encode(tekst);
  const encrypted = await versleutelRaw(dek, iv, data);
  return {
    ciphertext: uint8ArrayToBase64(encrypted),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Ontsleutelt een tekststring met de DEK.
 */
export async function ontsleutelTekst(
  dek: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string,
): Promise<string> {
  const iv = base64ToUint8Array(ivBase64);
  const ciphertext = base64ToUint8Array(ciphertextBase64);
  const decrypted = await ontsleutelRaw(dek, iv, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/**
 * Versleutelt binaire data met de DEK.
 */
export async function versleutelBytes(
  dek: CryptoKey,
  data: Uint8Array,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = genereerIV(12);
  const ciphertext = await versleutelRaw(dek, iv, data);
  return {
    ciphertext,
    iv,
  };
}

/**
 * Ontsleutelt binaire data met de DEK.
 */
export async function ontsleutelBytes(
  dek: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  return ontsleutelRaw(dek, iv, ciphertext);
}
