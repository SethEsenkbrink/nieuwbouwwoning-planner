import { describe, expect, it } from "vitest";
import { initialiseerNieuweKluis } from "@/crypto/crypto";
import {
  bestaatBestand,
  leesBestand,
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
