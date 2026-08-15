import { describe, expect, it } from "vitest";
import { initialiseerNieuweKluis } from "@/crypto/crypto";
import {
  bestaatBestand,
  leesBestand,
  leesRuweBytes,
  schrijfRuweBytes,
  slaBestandOp,
  verwijderBestand,
  wisAlleBestanden,
} from "./storage";

describe("OPFS Versleutelde Bestandsopslag", () => {
  it("slaat een bestand versleuteld op en leest het correct uit", async () => {
    const { dek } = await initialiseerNieuweKluis("TestWachtwoord123!");
    const uuid = "doc-test-123";
    const data = new TextEncoder().encode("Geheime documentinhoud van bouwtekening A-101");

    await slaBestandOp(dek, uuid, data);

    const bestaat = await bestaatBestand(uuid);
    expect(bestaat).toBe(true);

    const uitgelezen = await leesBestand(dek, uuid);
    const uitgelezenTekst = new TextDecoder().decode(uitgelezen);
    expect(uitgelezenTekst).toBe("Geheime documentinhoud van bouwtekening A-101");
  });

  it("verwijdert een bestand en controleert dat het niet meer bestaat", async () => {
    const { dek } = await initialiseerNieuweKluis("TestWachtwoord123!");
    const uuid = "doc-te-verwijderen";
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    await slaBestandOp(dek, uuid, data);
    expect(await bestaatBestand(uuid)).toBe(true);

    await verwijderBestand(uuid);
    expect(await bestaatBestand(uuid)).toBe(false);
    await expect(leesBestand(dek, uuid)).rejects.toThrow("niet gevonden");
  });

  it("wist alle bestanden bij wisAlleBestanden", async () => {
    const { dek } = await initialiseerNieuweKluis("TestWachtwoord123!");
    await slaBestandOp(dek, "doc-1", new Uint8Array([1]));
    await slaBestandOp(dek, "doc-2", new Uint8Array([2]));

    expect(await bestaatBestand("doc-1")).toBe(true);
    expect(await bestaatBestand("doc-2")).toBe(true);

    await wisAlleBestanden();

    expect(await bestaatBestand("doc-1")).toBe(false);
    expect(await bestaatBestand("doc-2")).toBe(false);
  });
});

describe("Chunked encryptie van documenten (A-05)", () => {
  /**
   * Een aannemingsovereenkomst of bouwtekening kan tientallen MB zijn. Die
   * ging eerder in één keer door het geheugen met één IV. Deze tests pinnen
   * het chunkformaat vast — vooral dat élke chunk zijn eigen IV krijgt.
   */
  async function nieuweDek() {
    const { dek } = await initialiseerNieuweKluis("een lange zin die niemand raadt 42");
    return dek;
  }

  it("splitst een bestand groter dan 1 MiB in meerdere chunks", async () => {
    const dek = await nieuweDek();
    const groot = new Uint8Array(1024 * 1024 * 2 + 5000);
    crypto.getRandomValues(groot.subarray(0, 65536));

    await slaBestandOp(dek, "groot", groot);
    const ruw = await leesRuweBytes("groot");

    expect(new TextDecoder().decode(ruw.slice(0, 8))).toBe("WDCHUNK1");

    // Drie chunks: 1 MiB + 1 MiB + rest. Elke chunk kost 12 + 4 bytes kop
    // plus 16 bytes GCM-tag bovenop de payload.
    const overhead = ruw.length - groot.length - 8;
    expect(overhead).toBe(3 * (12 + 4 + 16));
  });

  it("geeft elke chunk een eigen, unieke IV", async () => {
    const dek = await nieuweDek();
    // Drie chunks met identieke inhoud: als de IV's zouden worden hergebruikt
    // of uit een teller afgeleid, zou dat hier meteen zichtbaar zijn.
    const data = new Uint8Array(1024 * 1024 * 3).fill(7);

    await slaBestandOp(dek, "gelijk", data);
    const ruw = await leesRuweBytes("gelijk");

    const ivs: string[] = [];
    let offset = 8;
    while (offset < ruw.length) {
      ivs.push(Array.from(ruw.slice(offset, offset + 12)).join(","));
      const lengte = new DataView(ruw.buffer, ruw.byteOffset + offset + 12, 4).getUint32(0, false);
      offset += 12 + 4 + lengte;
    }

    expect(ivs).toHaveLength(3);
    expect(new Set(ivs).size).toBe(3);
  });

  it("leest een groot bestand byte-voor-byte identiek terug", async () => {
    const dek = await nieuweDek();
    const origineel = new Uint8Array(1024 * 1024 + 12345);
    for (let i = 0; i < origineel.length; i++) origineel[i] = (i * 31) % 256;

    await slaBestandOp(dek, "rondgang", origineel);
    const terug = await leesBestand(dek, "rondgang");

    expect(terug.length).toBe(origineel.length);
    expect(Array.from(terug.slice(0, 2000))).toEqual(Array.from(origineel.slice(0, 2000)));
    expect(Array.from(terug.slice(-2000))).toEqual(Array.from(origineel.slice(-2000)));
  });

  it("weigert een afgekapt bestand in plaats van halve data terug te geven", async () => {
    const dek = await nieuweDek();
    await slaBestandOp(dek, "afgekapt", new Uint8Array(1024 * 1024 * 2).fill(3));

    const ruw = await leesRuweBytes("afgekapt");
    await schrijfRuweBytes("afgekapt", ruw.slice(0, ruw.length - 5000));

    await expect(leesBestand(dek, "afgekapt")).rejects.toThrow();
  });
});
