/**
 * Type-definities voor de cryptografische kluis (Woningdossier Fase 1)
 */

export interface Argon2Params {
  /** Geheugen in KiB (standaard 65536 = 64 MiB) */
  m: number;
  /** Iteraties / time cost (standaard 3) */
  t: number;
  /** Parallellisme (standaard 4) */
  p: number;
  /** Sleutellengte in bytes (standaard 32 = 256-bit) */
  hashLength: number;
}

export interface VaultMeta {
  id: "meta";
  versie: 1;
  /** Zout voor KEK-A (Argon2id), base64 encoded (16 bytes) */
  saltA: string;
  /** IV voor DEK encryptie onder KEK-A, base64 encoded (12 bytes) */
  ivA: string;
  /** Versleutelde DEK onder KEK-A, base64 encoded (ciphertext + 16-byte auth tag) */
  wrappedDekA: string;

  /** Zout voor KEK-C (HKDF-SHA-256), base64 encoded (16 bytes) */
  saltC: string;
  /** IV voor DEK encryptie onder KEK-C, base64 encoded (12 bytes) */
  ivC: string;
  /** Versleutelde DEK onder KEK-C, base64 encoded (ciphertext + 16-byte auth tag) */
  wrappedDekC: string;

  /** Argon2id parameters gebruikt voor KEK-A */
  argon2Params: Argon2Params;

  /** Gemaskerde hint van herstelcode (bijv. "••••-••••-••••-ABCD") */
  recoveryCodeHint: string;

  /** Datum van kluiscreatie */
  aangemaaktOp: string;
  /** Datum van laatste kluisupdate */
  bijgewerktOp: string;
}

export interface WorkerDeriveRequest {
  type: "DERIVE_KEY";
  id: string;
  wachtwoord: string;
  salt: Uint8Array;
  params: Argon2Params;
}

export interface WorkerDeriveResponse {
  type: "DERIVE_KEY_SUCCESS";
  id: string;
  keyBytes: Uint8Array;
}

export interface WorkerDeriveError {
  type: "DERIVE_KEY_ERROR";
  id: string;
  error: string;
}

export type WorkerMessage = WorkerDeriveRequest;
export type WorkerResponse = WorkerDeriveResponse | WorkerDeriveError;
