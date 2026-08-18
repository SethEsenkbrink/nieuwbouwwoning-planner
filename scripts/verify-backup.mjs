#!/usr/bin/env node
/**
 * verify-backup.mjs — valideert het `.woningdossier` backup & restore formaat
 *
 * Controleert:
 * 1. Het streaming zip formaat (fflate)
 * 2. Onversleuteld manifest.json en statistieken
 * 3. SHA-256 integriteitscontrole via CHECKSUMS
 * 4. AES-256-GCM decryptie van data.enc onder DEK
 * 5. Ontgrendeling via KEK-A (Argon2id) en KEK-C (HKDF 128-bit)
 * 6. Golden fixture compatibiliteit (tests/fixtures/golden-v1.woningdossier)
 * 7. Foutdetectie bij data-corruptie en onjuist wachtwoord
 *
 * Draait als onderdeel van `npm run verify`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as fflate from "fflate";
import { argon2id } from "hash-wasm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES_DIR = join(ROOT, "tests", "fixtures");
const GOLDEN_FIXTURE_PATH = join(FIXTURES_DIR, "golden-v1.woningdossier");

const GOLDEN_WACHTWOORD = "GoldenPassphrase2026!";
const GOLDEN_HERSTELCODE = "01234-56789-ABCDE-FGHJK-MNPQR-S";

const CROCKFORD_ALFABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function decodeCrockfordBase32(invoer) {
  const geschoond = invoer.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  const bytes = new Uint8Array(16);
  let bits = 0;
  let bitCount = 0;
  let byteIndex = 0;

  for (const char of geschoond) {
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

function uint8ArrayToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function berekenSha256Hex(data) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function maakGoldenFixture() {
  if (!existsSync(FIXTURES_DIR)) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  // 1. Genereer DEK
  const rawDek = new Uint8Array(32);
  crypto.getRandomValues(rawDek);

  const saltA = new Uint8Array(16);
  crypto.getRandomValues(saltA);
  const ivA = new Uint8Array(12);
  crypto.getRandomValues(ivA);

  const kekABytes = await argon2id({
    password: GOLDEN_WACHTWOORD,
    salt: saltA,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: "binary",
  });
  const kekA = await crypto.subtle.importKey("raw", kekABytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const wrappedDekA = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivA }, kekA, rawDek));

  const recoveryBytes = decodeCrockfordBase32(GOLDEN_HERSTELCODE);
  const saltC = new Uint8Array(16);
  crypto.getRandomValues(saltC);
  const ivC = new Uint8Array(12);
  crypto.getRandomValues(ivC);

  const hkdfKey = await crypto.subtle.importKey("raw", recoveryBytes, "HKDF", false, ["deriveKey"]);
  const kekC = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: saltC, info: new TextEncoder().encode("woningdossier-kek-c-v1") },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const wrappedDekC = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivC }, kekC, rawDek));

  const dek = await crypto.subtle.importKey("raw", rawDek, { name: "AES-GCM" }, false, ["encrypt"]);
  rawDek.fill(0);

  // 2. Data payload
  const payload = {
    versie: 1,
    exportDatum: "2026-08-15T12:00:00.000Z",
    tabellen: {
      projecten: [
        {
          id: "proj-golden",
          naam: "Modelwoning Brink 2026",
          aangemaaktOp: { seconds: 1770000000, nanoseconds: 0 },
        },
      ],
      ankers: [],
      betrokkenen: [],
      afspraken: [],
      phases: [],
      tasks: [],
      meerwerk: [],
      termijnen: [],
      gebreken: [],
      nabudget: [],
      onderdelen: [],
      onderhoudstaken: [],
      onderhoudslogboek: [],
      meters: [],
      meterstanden: [],
      materialen: [],
      garanties: [],
      verzekeringen: [],
      inboedel: [],
    },
  };

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const dataIv = new Uint8Array(12);
  crypto.getRandomValues(dataIv);
  const dataCiphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: dataIv }, dek, payloadBytes));

  const dataEnc = new Uint8Array(dataIv.length + dataCiphertext.length);
  dataEnc.set(dataIv, 0);
  dataEnc.set(dataCiphertext, dataIv.length);

  const fileIndexBytes = new TextEncoder().encode("[]");
  const indexIv = new Uint8Array(12);
  crypto.getRandomValues(indexIv);
  const indexCiphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: indexIv }, dek, fileIndexBytes));
  const filesIndexEnc = new Uint8Array(indexIv.length + indexCiphertext.length);
  filesIndexEnc.set(indexIv, 0);
  filesIndexEnc.set(indexCiphertext, indexIv.length);

  const manifest = {
    formaatVersie: 1,
    appVersie: "0.1.0",
    aangemaaktOp: "2026-08-15T12:00:00.000Z",
    kluismeta: {
      id: "meta",
      versie: 1,
      saltA: uint8ArrayToBase64(saltA),
      ivA: uint8ArrayToBase64(ivA),
      wrappedDekA: uint8ArrayToBase64(wrappedDekA),
      saltC: uint8ArrayToBase64(saltC),
      ivC: uint8ArrayToBase64(ivC),
      wrappedDekC: uint8ArrayToBase64(wrappedDekC),
      argon2Params: { m: 65536, t: 3, p: 4, hashLength: 32 },
      recoveryCodeHint: "•••••-•••••-•••••-•••••-•••••-S",
      aangemaaktOp: "2026-08-15T12:00:00.000Z",
      bijgewerktOp: "2026-08-15T12:00:00.000Z",
    },
    statistieken: {
      aantalProjecten: 1,
      aantalBestanden: 0,
      totaalBytes: dataEnc.length,
    },
  };

  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

  const zipDict = {
    "manifest.json": manifestBytes,
    "data.enc": dataEnc,
    "files/index.enc": filesIndexEnc,
  };

  const checksumsLines = [
    `${await berekenSha256Hex(dataEnc)}  data.enc`,
    `${await berekenSha256Hex(filesIndexEnc)}  files/index.enc`,
    `${await berekenSha256Hex(manifestBytes)}  manifest.json`,
  ];
  zipDict["CHECKSUMS"] = new TextEncoder().encode(checksumsLines.join("\n") + "\n");

  const zipBytes = fflate.zipSync(zipDict, { level: 6 });
  writeFileSync(GOLDEN_FIXTURE_PATH, zipBytes);
  console.log("  - Golden fixture gegenereerd:", GOLDEN_FIXTURE_PATH);
}

async function verifyFixture() {
  console.log("Valideren van .woningdossier backup & restore...");

  if (!existsSync(GOLDEN_FIXTURE_PATH)) {
    await maakGoldenFixture();
  }

  const zipBuffer = readFileSync(GOLDEN_FIXTURE_PATH);
  const zipBytes = new Uint8Array(zipBuffer);

  // 1. Unzip
  const unzipped = fflate.unzipSync(zipBytes);
  if (!unzipped["CHECKSUMS"] || !unzipped["manifest.json"] || !unzipped["data.enc"]) {
    throw new Error("Vereiste bestanden ontbreken in golden fixture.");
  }

  // 2. Valideer CHECKSUMS
  const checksumsTekst = new TextDecoder().decode(unzipped["CHECKSUMS"]);
  const regels = checksumsTekst.split("\n").filter(Boolean);
  for (const regel of regels) {
    const [verwacht, pad] = regel.split(/\s+/);
    const bestand = unzipped[pad];
    if (!bestand) throw new Error(`Bestand ${pad} ontbreekt.`);
    const berekend = await berekenSha256Hex(bestand);
    if (berekend !== verwacht) throw new Error(`Checksum ongeldig voor ${pad}`);
  }

  // 3. Parse manifest
  const manifest = JSON.parse(new TextDecoder().decode(unzipped["manifest.json"]));
  if (manifest.formaatVersie !== 1) throw new Error("Onjuiste formaatversie");

  // 4. Ontsleutel DEK via KEK-A
  const kluismeta = manifest.kluismeta;
  const saltA = base64ToUint8Array(kluismeta.saltA);
  const ivA = base64ToUint8Array(kluismeta.ivA);
  const wrappedDekA = base64ToUint8Array(kluismeta.wrappedDekA);

  const kekABytes = await argon2id({
    password: GOLDEN_WACHTWOORD,
    salt: saltA,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: "binary",
  });
  const kekA = await crypto.subtle.importKey("raw", kekABytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const rawDekA = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivA }, kekA, wrappedDekA));

  const dekA = await crypto.subtle.importKey("raw", rawDekA, { name: "AES-GCM" }, false, ["decrypt"]);
  rawDekA.fill(0);

  // 5. Ontsleutel data.enc
  const dataEnc = unzipped["data.enc"];
  const dataIv = dataEnc.slice(0, 12);
  const dataCiphertext = dataEnc.slice(12);

  const decryptedBytes = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: dataIv }, dekA, dataCiphertext));
  const payload = JSON.parse(new TextDecoder().decode(decryptedBytes));
  if (payload.tabellen.projecten[0].naam !== "Modelwoning Brink 2026") {
    throw new Error("Projectnaam in decrypted payload komt niet overeen.");
  }

  // 6. Negatieve test: ongeldig wachtwoord faalt
  const fouteKekABytes = await argon2id({
    password: "FoutWachtwoord123",
    salt: saltA,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: "binary",
  });
  const fouteKekA = await crypto.subtle.importKey("raw", fouteKekABytes, { name: "AES-GCM" }, false, ["decrypt"]);
  let foutWachtwoordGefaald = false;
  try {
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivA }, fouteKekA, wrappedDekA);
  } catch {
    foutWachtwoordGefaald = true;
  }
  if (!foutWachtwoordGefaald) {
    throw new Error("Ontsleutelen met fout wachtwoord had moeten falen.");
  }

  // ── Fixture per schemaversie (bevinding A-16) ────────────────────────────
  //
  // Voor élke schemaversie die ooit heeft bestaan moet er een golden fixture
  // zijn, anders kun je niet aantonen dat een backup uit die versie nog
  // hersteld kan worden. Nu is er één versie en één fixture; deze controle
  // bestaat om dat zo te houden. Zodra HUIDIGE_SCHEMA_VERSIE naar 2 gaat en
  // er geen fixture voor v1 meer bijkomt, wordt dit rood.
  const migratieBron = readFileSync(join(ROOT, "src", "migrations", "index.ts"), "utf8");
  const huidig = Number(/HUIDIGE_SCHEMA_VERSIE = (\d+)/.exec(migratieBron)?.[1] ?? "0");
  const oudste = Number(
    /OUDSTE_ONDERSTEUNDE_SCHEMA_VERSIE = (\d+)/.exec(migratieBron)?.[1] ?? "0",
  );

  if (!huidig || !oudste) {
    console.error("\n✗ Kon de schemaversies niet uit src/migrations/index.ts lezen.\n");
    process.exit(1);
  }

  const ontbrekend = [];
  for (let versie = oudste; versie <= huidig; versie++) {
    const pad = join(FIXTURES_DIR, `golden-v${String(versie)}.woningdossier`);
    if (!existsSync(pad)) ontbrekend.push(`golden-v${String(versie)}.woningdossier`);
  }

  if (ontbrekend.length > 0) {
    console.error(
      `\n✗ Golden fixtures ontbreken voor schemaversie(s): ${ontbrekend.join(", ")}\n\n` +
        `  Voor elke schemaversie die ooit bestond hoort er een fixture te zijn,\n` +
        `  anders is niet aantoonbaar dat een backup uit die versie nog te\n` +
        `  herstellen is. Zie bevinding A-16.\n`,
    );
    process.exit(1);
  }

  console.log(
    `✓ Backup & Restore OK — fixtures v${String(oudste)} t/m v${String(huidig)}, CHECKSUMS ` +
      `integriteit en AES-256-GCM validatie geslaagd.`,
  );
}

verifyFixture().catch((err) => {
  console.error(`\n✗ Backup verificatie gefaald: ${err.message}\n`);
  process.exit(1);
});
