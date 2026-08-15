import { describe, expect, it } from "vitest";
import {
  initialiseerNieuweKluis,
  ontgrendelMetHerstelcode,
  ontgrendelMetWachtwoord,
  ontsleutelTekst,
  versleutelTekst,
} from "./crypto";
import {
  decodeCrockfordBase32,
  encodeCrockfordBase32,
  genereerHerstelcode,
  maskeerHerstelcode,
} from "./herstelcode";

describe("Herstelcode (Crockford Base32)", () => {
  it("genereert een geldige 128-bit herstelcode", () => {
    const { code, bytes } = genereerHerstelcode();
    expect(bytes.length).toBe(16);
    expect(code).toMatch(/^[0-9A-HJKMNP-Z]{5}-[0-9A-HJKMNP-Z]{5}-[0-9A-HJKMNP-Z]{5}-[0-9A-HJKMNP-Z]{5}-[0-9A-HJKMNP-Z]{5}-[0-9A-HJKMNP-Z]$/);
  });

  it("encodeert en decodeert 16 bytes roundtrip", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const encoded = encodeCrockfordBase32(bytes);
    expect(encoded.length).toBe(26);
    const decoded = decodeCrockfordBase32(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it("normaliseert O naar 0 en I/L naar 1", () => {
    const bytes = new Uint8Array(16);
    bytes.fill(42);
    const encoded = encodeCrockfordBase32(bytes);
    const metFouten = encoded.replace(/0/g, "O").replace(/1/g, "I");
    const decoded = decodeCrockfordBase32(metFouten);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it("maskeert herstelcode voor weergave in UI", () => {
    const code = "01234-56789-ABCDE-FGHJK-MNPQR-S";
    const gemaskeerd = maskeerHerstelcode(code);
    expect(gemaskeerd).toBe("•••••-•••••-•••••-•••••-•••••-S");
  });

  it("weigert ongeldige byte-lengtes en karakters", () => {
    expect(() => encodeCrockfordBase32(new Uint8Array(10))).toThrow("Ongeldige byte-lengte");
    expect(() => decodeCrockfordBase32("TE-KORT")).toThrow("Ongeldige herstelcode-lengte");
  });
});

describe("Cryptografische Sleutelhiërarchie (DEK, KEK-A, KEK-C)", () => {
  it("creëert een nieuwe kluis en versleutelt/ontsleutelt data", async () => {
    const wachtwoord = "MijnGeheimeWoningdossierWachtwoordzin!123";
    const { meta, dek, herstelcode } = await initialiseerNieuweKluis(wachtwoord);

    expect(meta.versie).toBe(1);
    expect(dek.extractable).toBe(false);
    expect(dek.algorithm.name).toBe("AES-GCM");
    expect(herstelcode.length).toBeGreaterThan(20);

    // Versleutel een payload
    const geheim = "Vertrouwelijke documenten en meterstanden 2026";
    const { ciphertext, iv } = await versleutelTekst(dek, geheim);
    expect(ciphertext).not.toBe(geheim);

    // Ontsleutel met de actieve DEK in het geheugen
    const ontcijferd = await ontsleutelTekst(dek, ciphertext, iv);
    expect(ontcijferd).toBe(geheim);

    // Ontgrendel met KEK-A (wachtwoordzin) en controleer decryptie
    const ontgrendeldeDekA = await ontgrendelMetWachtwoord(meta, wachtwoord);
    expect(ontgrendeldeDekA.extractable).toBe(false);
    const ontcijferdA = await ontsleutelTekst(ontgrendeldeDekA, ciphertext, iv);
    expect(ontcijferdA).toBe(geheim);

    // Ontgrendel met KEK-C (herstelcode) en controleer decryptie
    const ontgrendeldeDekC = await ontgrendelMetHerstelcode(meta, herstelcode);
    expect(ontgrendeldeDekC.extractable).toBe(false);
    const ontcijferdC = await ontsleutelTekst(ontgrendeldeDekC, ciphertext, iv);
    expect(ontcijferdC).toBe(geheim);
  });

  it("weigert ontgrendelen met een onjuist wachtwoord", async () => {
    const { meta } = await initialiseerNieuweKluis("JuistWachtwoord12345");
    await expect(ontgrendelMetWachtwoord(meta, "FoutWachtwoord54321")).rejects.toThrow(
      "Onjuiste wachtwoordzin",
    );
  });

  it("weigert ontgrendelen met een onjuiste herstelcode", async () => {
    const { meta } = await initialiseerNieuweKluis("JuistWachtwoord12345");
    const { code: andereCode } = genereerHerstelcode();
    await expect(ontgrendelMetHerstelcode(meta, andereCode)).rejects.toThrow(
      "Ongeldige herstelcode",
    );
  });

  it("detecteert manipulatie in versleutelde data (AES-GCM authenticatie-tag)", async () => {
    const { dek } = await initialiseerNieuweKluis("TestWachtwoord123");
    const { ciphertext, iv } = await versleutelTekst(dek, "Originele Tekst");

    // Manipuleer 1 karakter in de ciphertext base64
    const gemanipuleerd = ciphertext.slice(0, -2) + (ciphertext.endsWith("AA") ? "BB" : "AA");
    await expect(ontsleutelTekst(dek, gemanipuleerd, iv)).rejects.toThrow();
  });
});
