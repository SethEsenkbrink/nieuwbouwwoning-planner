import { argon2id } from "hash-wasm";
import type { Argon2Params, WorkerMessage, WorkerResponse } from "./types";

export const STANDAARD_ARGON2_PARAMS: Argon2Params = {
  m: 65536, // 64 MiB RAM
  t: 3,     // 3 iteraties
  p: 4,     // 4 parallelle lanes
  hashLength: 32, // 256-bit sleutel
};

const HKDF_INFO = new TextEncoder().encode("woningdossier-kek-c-v1");

/**
 * Leidt KEK-A (AES-256-GCM CryptoKey) af uit een wachtwoordzin via Argon2id.
 *
 * Gebruikt een Web Worker in de browser indien beschikbaar, of draait
 * direct WASM in test-/serveromgevingen.
 */
export async function berekenKekA(
  wachtwoord: string,
  salt: Uint8Array,
  params: Argon2Params = STANDAARD_ARGON2_PARAMS,
): Promise<CryptoKey> {
  let keyBytes: Uint8Array;

  if (typeof window !== "undefined" && typeof Worker !== "undefined") {
    keyBytes = await deriveKeyViaWorker(wachtwoord, salt, params);
  } else {
    keyBytes = await argon2id({
      password: wachtwoord,
      salt,
      parallelism: params.p,
      iterations: params.t,
      memorySize: params.m,
      hashLength: params.hashLength,
      outputType: "binary",
    });
  }

  try {
    const kek = await crypto.subtle.importKey(
      "raw",
      keyBytes as ArrayBufferView<ArrayBuffer>,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    return kek;
  } finally {
    // Wist de ruwe sleutelbytes direct uit het geheugen
    keyBytes.fill(0);
  }
}

function deriveKeyViaWorker(
  wachtwoord: string,
  salt: Uint8Array,
  params: Argon2Params,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL("./argon2.worker.ts", import.meta.url), {
        type: "module",
      });

      const id = crypto.randomUUID();

      const cleanup = () => {
        worker.terminate();
      };

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.id !== id) return;
        cleanup();

        if (msg.type === "DERIVE_KEY_SUCCESS") {
          resolve(new Uint8Array(msg.keyBytes));
        } else {
          reject(new Error(msg.error || "Fout bij berekenen van Argon2id in worker"));
        }
      };

      worker.onerror = (err) => {
        cleanup();
        reject(new Error(`Worker error: ${err.message}`));
      };

      const request: WorkerMessage = {
        type: "DERIVE_KEY",
        id,
        wachtwoord,
        salt,
        params,
      };

      worker.postMessage(request);
    } catch {
      // Fallback naar directe aanroep als worker creatie faalt
      argon2id({
        password: wachtwoord,
        salt,
        parallelism: params.p,
        iterations: params.t,
        memorySize: params.m,
        hashLength: params.hashLength,
        outputType: "binary",
      })
        .then(resolve)
        .catch(reject);
    }
  });
}

/**
 * Leidt KEK-C (AES-256-GCM CryptoKey) af uit een 128-bit herstelcode via HKDF-SHA-256.
 */
export async function berekenKekC(
  recoveryBytes: Uint8Array,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    recoveryBytes as ArrayBufferView<ArrayBuffer>,
    "HKDF",
    false,
    ["deriveKey"],
  );

  const kek = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as ArrayBufferView<ArrayBuffer>,
      info: HKDF_INFO,
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  return kek;
}

// ── Hulpfuncties voor encoding ─────────────────────────────────────────────

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    const byte = bytes[i] ?? 0;
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function genereerZout(lengte = 16): Uint8Array {
  const salt = new Uint8Array(lengte);
  crypto.getRandomValues(salt);
  return salt;
}

export function genereerIV(lengte = 12): Uint8Array {
  const iv = new Uint8Array(lengte);
  crypto.getRandomValues(iv);
  return iv;
}
