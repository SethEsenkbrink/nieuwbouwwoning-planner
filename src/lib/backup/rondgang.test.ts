import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/db/db";
import { bewaar, haal } from "@/db/kluisopslag";
import { zetSleutel } from "@/db/sleutelregister";
import { initialiseerNieuweKluis } from "@/crypto/crypto";
import { lijstBestandUuids, leesBestand, slaBestandOp, wisAlleBestanden } from "@/lib/opfs/storage";
import { exporteerDossier } from "./export";
import { importeerDossier } from "./import";
import {
  controleerKetenIsSluitend,
  HUIDIGE_SCHEMA_VERSIE,
  migreer,
  OUDSTE_ONDERSTEUNDE_SCHEMA_VERSIE,
} from "@/migrations";
import type { DossierManifest } from "./types";
import * as fflate from "fflate";

/**
 * De hersteltest uit de audit (B4 a–f), als vaste test.
 *
 * Hij bestond niet, en juist daardoor kon `bestandenIndex = []` maandenlang
 * onopgemerkt blijven: elke bestaande test controleerde de databasetabellen en
 * geen enkele controleerde de bijlagen (A-02).
 */

const WACHTWOORDZIN = "een lange zin die niemand raadt 42";

async function maakDataset(aantalRecords: number, aantalBestanden: number) {
  const { meta, dek, herstelcode } = await initialiseerNieuweKluis(WACHTWOORDZIN);
  await db.vault_meta.put(meta);
  // Schrijf via de versleutelde opslaglaag, precies zoals de app dat doet.
  zetSleutel(dek);

  await bewaar(db.projecten, {
    id: "project-1",
    naam: "Kavel 27",
    aangemaaktOp: new Date().toISOString(),
    bijgewerktOp: new Date().toISOString(),
  });

  for (let i = 0; i < aantalRecords; i++) {
    await bewaar(db.onderdelen, {
      id: `onderdeel-${String(i)}`,
      projectId: "project-1",
      naam: `Onderdeel ${String(i)}`,
      categorie: "installatie",
    });
  }

  const bestandsInhoud: Record<string, Uint8Array> = {};
  for (let i = 0; i < aantalBestanden; i++) {
    const uuid = `bestand-${String(i)}`;
    const inhoud = new TextEncoder().encode(`inhoud van bijlage ${String(i)}`);
    bestandsInhoud[uuid] = inhoud;
    await slaBestandOp(dek, uuid, inhoud);
  }

  return { meta, dek, herstelcode, bestandsInhoud };
}

async function wisAlles() {
  await Promise.all([
    db.vault_meta.clear(),
    db.projecten.clear(),
    db.onderdelen.clear(),
  ]);
  await wisAlleBestanden();
}

describe("Backup-rondgang: export, wissen, herstel", () => {
  beforeEach(async () => {
    await wisAlles();
  });

  it("herstelt 20 records en 3 bijlagen met de wachtwoordzin", async () => {
    const { meta, dek, bestandsInhoud } = await maakDataset(20, 3);

    const zip = await exporteerDossier(db, dek, meta);
    await wisAlles();

    expect(await db.onderdelen.count()).toBe(0);
    expect(await lijstBestandUuids()).toHaveLength(0);

    const resultaat = await importeerDossier(zip, WACHTWOORDZIN, db);

    expect(await db.onderdelen.count()).toBe(20);
    expect(resultaat.aantalBestanden).toBe(3);
    expect((await lijstBestandUuids()).sort()).toEqual(Object.keys(bestandsInhoud).sort());

    // De inhoud moet byte-voor-byte terug zijn, niet alleen het aantal.
    for (const [uuid, verwacht] of Object.entries(bestandsInhoud)) {
      const teruggelezen = await leesBestand(resultaat.dek, uuid);
      expect(new TextDecoder().decode(teruggelezen)).toBe(new TextDecoder().decode(verwacht));
    }
  });

  it("herstelt dezelfde backup ook met de herstelcode", async () => {
    const { meta, dek, herstelcode, bestandsInhoud } = await maakDataset(20, 3);

    const zip = await exporteerDossier(db, dek, meta);
    await wisAlles();

    const resultaat = await importeerDossier(zip, herstelcode, db);

    expect(await db.onderdelen.count()).toBe(20);
    expect(resultaat.aantalBestanden).toBe(3);
    for (const uuid of Object.keys(bestandsInhoud)) {
      await expect(leesBestand(resultaat.dek, uuid)).resolves.toBeDefined();
    }
  });

  it("behoudt onbekende velden uit een nieuwere backup", async () => {
    const { meta, dek } = await maakDataset(1, 0);

    await bewaar(db.onderdelen, {
      id: "onderdeel-vreemd",
      projectId: "project-1",
      naam: "Met extra veld",
      ditVeldKentDezeVersieNiet: { diep: ["waarde", 42] },
    });

    const zip = await exporteerDossier(db, dek, meta);
    await wisAlles();
    await importeerDossier(zip, WACHTWOORDZIN, db);

    const hersteld = await haal(db.onderdelen, "onderdeel-vreemd");
    expect(hersteld?.ditVeldKentDezeVersieNiet).toEqual({ diep: ["waarde", 42] });
  });

  it("schrijft een volledig manifest zonder persoonsgegevens", async () => {
    const { meta, dek } = await maakDataset(2, 1);
    const zip = await exporteerDossier(db, dek, meta);

    const uitgepakt = fflate.unzipSync(zip);
    const manifest = JSON.parse(
      new TextDecoder().decode(uitgepakt["manifest.json"]),
    ) as DossierManifest;

    expect(manifest.formaat).toBe("woningdossier");
    expect(manifest.schemaVersie).toBe(HUIDIGE_SCHEMA_VERSIE);
    expect(manifest.cipher).toBe("AES-256-GCM");
    expect(manifest.aantallen.onderdelen).toBe(2);
    expect(manifest.statistieken.aantalBestanden).toBe(1);

    // De projectnaam mag nergens onversleuteld in het manifest opduiken.
    expect(JSON.stringify(manifest)).not.toContain("Kavel 27");
  });

  it("schrijft files/<uuid>.enc als losse entries in het archief", async () => {
    const { meta, dek } = await maakDataset(1, 2);
    const zip = await exporteerDossier(db, dek, meta);

    const entries = Object.keys(fflate.unzipSync(zip));
    expect(entries).toContain("files/bestand-0.enc");
    expect(entries).toContain("files/bestand-1.enc");
    expect(entries).toContain("files/index.enc");
  });

  it("weigert een archief waarvan de ciphertext gemanipuleerd is", async () => {
    const { meta, dek } = await maakDataset(3, 0);
    const zip = await exporteerDossier(db, dek, meta);

    const uitgepakt = fflate.unzipSync(zip);
    const dataEnc = uitgepakt["data.enc"];
    if (!dataEnc || dataEnc.length <= 20) throw new Error("data.enc ontbreekt of is te kort.");
    dataEnc.set([(dataEnc.at(20) ?? 0) ^ 0xff], 20);
    const gemanipuleerd = fflate.zipSync(uitgepakt, { level: 6 });

    await expect(importeerDossier(gemanipuleerd, WACHTWOORDZIN, db)).rejects.toThrow(
      /Integriteitscontrole mislukt/,
    );
  });
});

describe("Migratieketen", () => {
  it("is ononderbroken van de oudste ondersteunde versie tot de huidige", () => {
    expect(() => {
      controleerKetenIsSluitend();
    }).not.toThrow();
  });

  it("weigert een backup uit een nieuwere schemaversie in plaats van te gokken", () => {
    expect(() => migreer({}, HUIDIGE_SCHEMA_VERSIE + 1)).toThrow(/nieuwere versie/);
  });

  it("weigert een schemaversie ouder dan we nog kunnen lezen", () => {
    if (OUDSTE_ONDERSTEUNDE_SCHEMA_VERSIE > 1) {
      expect(() => migreer({}, OUDSTE_ONDERSTEUNDE_SCHEMA_VERSIE - 1)).toThrow();
    }
    expect(() => migreer({}, 0)).toThrow(/Ongeldige schemaversie/);
  });
});
