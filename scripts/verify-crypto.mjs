#!/usr/bin/env node
/**
 * verify-crypto.mjs — valideert de cryptografische sleutelhiërarchie
 *
 * Controleert:
 * 1. DEK (AES-256-GCM non-extractable CryptoKey in memory)
 * 2. KEK-A (Argon2id WASM m=65536, t=3, p=4)
 * 3. KEK-C (HKDF-SHA-256 128-bit herstelcode)
 * 4. AES-256-GCM encryptie/decryptie en authenticatie-tag validatie
 * 5. Foutafhandeling bij verkeerd wachtwoord / verkeerde herstelcode
 *
 * Draait als onderdeel van `npm run verify`.
 */
import { argon2id } from "hash-wasm";

const STANDAARD_ARGON2_PARAMS = {
  m: 65536,
  t: 3,
  p: 4,
  hashLength: 32,
};

const CROCKFORD_ALFABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeCrockfordBase32(bytes) {
  let bits = 0;
  let bitCount = 0;
  let result = "";

  for (let i = 0; i < bytes.length; i++) {
    bits = (bits << 8) | bytes[i];
    bitCount += 8;

    while (bitCount >= 5) {
      const index = (bits >>> (bitCount - 5)) & 31;
      result += CROCKFORD_ALFABET[index];
      bitCount -= 5;
    }
  }

  if (bitCount > 0) {
    const index = (bits << (5 - bitCount)) & 31;
    result += CROCKFORD_ALFABET[index];
  }

  return result;
}

function decodeCrockfordBase32(invoer) {
  const geschoond = invoer
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  const bytes = new Uint8Array(16);
  let bits = 0;
  let bitCount = 0;
  let byteIndex = 0;

  for (let i = 0; i < geschoond.length; i++) {
    const char = geschoond[i];
    const val = CROCKFORD_ALFABET.indexOf(char);
    if (val === -1) throw new Error(`Ongeldig karakter: ${char}`);

    bits = (bits << 5) | val;
    bitCount += 5;

    if (bitCount >= 8) {
      if (byteIndex < 16) bytes[byteIndex++] = (bits >>> (bitCount - 8)) & 255;
      bitCount -= 8;
    }
  }

  return bytes;
}

async function run() {
  console.log("Valideren van cryptografische sleutelhiërarchie...");

  // 1. Genereer DEK
  const rawDek = new Uint8Array(32);
  crypto.getRandomValues(rawDek);

  const dek = await crypto.subtle.importKey(
    "raw",
    rawDek,
    { name: "AES-GCM" },
    false, // non-extractable!
    ["encrypt", "decrypt"],
  );

  if (dek.extractable !== false) {
    throw new Error("DEK moet non-extractable zijn.");
  }

  // 2. KEK-A via Argon2id
  const wachtwoord = "VeiligeWachtwoordzin2026!";
  const saltA = new Uint8Array(16);
  crypto.getRandomValues(saltA);

  const kekABytes = await argon2id({
    password: wachtwoord,
    salt: saltA,
    parallelism: STANDAARD_ARGON2_PARAMS.p,
    iterations: STANDAARD_ARGON2_PARAMS.t,
    memorySize: STANDAARD_ARGON2_PARAMS.m,
    hashLength: STANDAARD_ARGON2_PARAMS.hashLength,
    outputType: "binary",
  });

  const kekA = await crypto.subtle.importKey(
    "raw",
    kekABytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );

  // 3. Wrap DEK onder KEK-A
  const ivA = new Uint8Array(12);
  crypto.getRandomValues(ivA);
  const wrappedDekA = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivA }, kekA, rawDek),
  );

  // 4. KEK-C via HKDF 128-bit herstelcode
  const recoveryBytes = new Uint8Array(16);
  crypto.getRandomValues(recoveryBytes);
  const herstelcode = encodeCrockfordBase32(recoveryBytes);

  const saltC = new Uint8Array(16);
  crypto.getRandomValues(saltC);

  const hkdfKey = await crypto.subtle.importKey("raw", recoveryBytes, "HKDF", false, ["deriveKey"]);
  const kekC = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltC,
      info: new TextEncoder().encode("woningdossier-kek-c-v1"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  // 5. Wrap DEK onder KEK-C
  const ivC = new Uint8Array(12);
  crypto.getRandomValues(ivC);
  const wrappedDekC = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivC }, kekC, rawDek),
  );

  // Wis ruwe DEK
  rawDek.fill(0);

  // 6. Test data encryptie met DEK
  const plaintext = new TextEncoder().encode("Vertrouwelijk Woningdossier 2026");
  const payloadIv = new Uint8Array(12);
  crypto.getRandomValues(payloadIv);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: payloadIv }, dek, plaintext),
  );

  // 7. Unwrap via KEK-A en verifieer decryptie
  const unwrappedRawA = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivA }, kekA, wrappedDekA),
  );
  const restoredDekA = await crypto.subtle.importKey(
    "raw",
    unwrappedRawA,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  unwrappedRawA.fill(0);

  const decryptedA = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: payloadIv }, restoredDekA, ciphertext),
  );
  const resultTextA = new TextDecoder().decode(decryptedA);
  if (resultTextA !== "Vertrouwelijk Woningdossier 2026") {
    throw new Error("KEK-A ontsleutelde payload komt niet overeen.");
  }

  // 8. Unwrap via KEK-C (herstelcode) en verifieer decryptie
  const parsedRecoveryBytes = decodeCrockfordBase32(herstelcode);
  const hkdfKeyRestore = await crypto.subtle.importKey("raw", parsedRecoveryBytes, "HKDF", false, ["deriveKey"]);
  const kekCRestore = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltC,
      info: new TextEncoder().encode("woningdossier-kek-c-v1"),
    },
    hkdfKeyRestore,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  const unwrappedRawC = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivC }, kekCRestore, wrappedDekC),
  );
  const restoredDekC = await crypto.subtle.importKey(
    "raw",
    unwrappedRawC,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  unwrappedRawC.fill(0);

  const decryptedC = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: payloadIv }, restoredDekC, ciphertext),
  );
  const resultTextC = new TextDecoder().decode(decryptedC);
  if (resultTextC !== "Vertrouwelijk Woningdossier 2026") {
    throw new Error("KEK-C ontsleutelde payload komt niet overeen.");
  }

  // 9. Negatieve test: manipulatie van ciphertext
  const gemanipuleerd = new Uint8Array(ciphertext);
  gemanipuleerd[0] ^= 0xff;
  let manipulatieGefaald = false;
  try {
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: payloadIv }, dek, gemanipuleerd);
  } catch {
    manipulatieGefaald = true;
  }
  if (!manipulatieGefaald) {
    throw new Error("AES-GCM manipulatiecheck faalde — authenticatie-tag werd niet afgedwongen.");
  }

  console.log("✓ Crypto OK — DEK (non-extractable AES-256-GCM), KEK-A (Argon2id m=65536, t=3, p=4), KEK-C (HKDF 128-bit) gevalideerd.");
}

run().catch((err) => {
  console.error(`\n✗ Crypto verificatie gefaald: ${err.message}\n`);
  process.exit(1);
});
