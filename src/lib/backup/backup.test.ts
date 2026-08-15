import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import * as fflate from "fflate";
import { WoningdossierDB } from "@/db/db";
import { initialiseerNieuweKluis } from "@/crypto/crypto";
import { exporteerDossier } from "./export";
import { importeerDossier } from "./import";
import { maakChecksumsTekst, valideerChecksums } from "./checksums";

describe("Checksums validatie", () => {
  it("genereert en valideert een geldige checksum lijst", async () => {
    const bestanden = {
      "bestand1.txt": new TextEncoder().encode("Hallo wereld"),
      "bestand2.json": new TextEncoder().encode('{"test": 123}'),
    };
    const checksums = await maakChecksumsTekst(bestanden);
    const validatie = await valideerChecksums(bestanden, checksums);
    expect(validatie.geldig).toBe(true);
    expect(validatie.fouten.length).toBe(0);
  });

  it("detecteert aangepaste bestandsinhoud via checksum", async () => {
    const bestanden = {
      "data.enc": new TextEncoder().encode("Originele payload"),
    };
    const checksums = await maakChecksumsTekst(bestanden);

    // Manipuleer bestand
    const gemanipuleerd = {
      "data.enc": new TextEncoder().encode("Gemanipuleerde payload"),
    };
    const validatie = await valideerChecksums(gemanipuleerd, checksums);
    expect(validatie.geldig).toBe(false);
    expect(validatie.fouten[0]).toContain("Checksum corrupt");
  });
});

describe("Dossier Export & Import Roundtrip", () => {
  it("exporteert en importeert een compleet dossier via wachtwoord", async () => {
    // 1. Maak mock database in memory
    const testDb = new WoningdossierDB();
    const wachtwoord = "MijnGeheimeWoningdossierPassphrase123!";
    const { meta, dek } = await initialiseerNieuweKluis(wachtwoord);

    // Vul test data
    await testDb.projecten.put({
      id: "proj-1",
      naam: "Kavel 42 De Nieuwe Akkers",
      aangemaaktOp: { seconds: 1700000000, nanoseconds: 0 } as never,
      bijgewerktOp: { seconds: 1700000000, nanoseconds: 0 } as never,
    } as never);

    await testDb.ankers.put({
      id: "ank-1",
      projectId: "proj-1",
      type: "start_bouw",
      status: "bevestigd",
    } as never);

    await testDb.meterstanden.put({
      id: "ms-1",
      projectId: "proj-1",
      meterId: "meter-elek",
      stand: 1250,
      opgenomenOp: { seconds: 1700000000, nanoseconds: 0 } as never,
    } as never);

    // 2. Exporteer
    const zipBytes = await exporteerDossier(testDb, dek, meta);
    expect(zipBytes.byteLength).toBeGreaterThan(100);

    // 3. Inspecteer zip content
    const unzipped = fflate.unzipSync(zipBytes);
    expect(unzipped["manifest.json"]).toBeDefined();
    expect(unzipped["data.enc"]).toBeDefined();
    expect(unzipped.CHECKSUMS).toBeDefined();

    // 4. Importeer in een schone doel-database
    const targetDb = new WoningdossierDB();
    const resultaat = await importeerDossier(zipBytes, wachtwoord, targetDb);

    expect(resultaat.projectNaam).toBe("Kavel 42 De Nieuwe Akkers");
    expect(resultaat.aantalRecords).toBe(3);

    // Verifieer records in targetDb
    const hersteldProject = await targetDb.projecten.get("proj-1");
    expect(hersteldProject?.naam).toBe("Kavel 42 De Nieuwe Akkers");

    const hersteldAnker = await targetDb.ankers.get("ank-1");
    expect(hersteldAnker?.type).toBe("start_bouw");

    const hersteldeStand = await targetDb.meterstanden.get("ms-1");
    expect(hersteldeStand?.stand).toBe(1250);

    await testDb.delete();
    await targetDb.delete();
  });

  it("importeert succesvol met de herstelcode", async () => {
    const testDb = new WoningdossierDB();
    const wachtwoord = "OrigineelWachtwoord123";
    const { meta, dek, herstelcode } = await initialiseerNieuweKluis(wachtwoord);

    await testDb.projecten.put({
      id: "proj-herstel",
      naam: "Project Herstelcode Test",
      aangemaaktOp: { seconds: 1700000000, nanoseconds: 0 } as never,
      bijgewerktOp: { seconds: 1700000000, nanoseconds: 0 } as never,
    } as never);

    const zipBytes = await exporteerDossier(testDb, dek, meta);

    const targetDb = new WoningdossierDB();
    const resultaat = await importeerDossier(zipBytes, herstelcode, targetDb);
    expect(resultaat.projectNaam).toBe("Project Herstelcode Test");

    await testDb.delete();
    await targetDb.delete();
  });

  it("weigert import bij onjuist wachtwoord", async () => {
    const testDb = new WoningdossierDB();
    const { meta, dek } = await initialiseerNieuweKluis("Wachtwoord123");
    const zipBytes = await exporteerDossier(testDb, dek, meta);

    const targetDb = new WoningdossierDB();
    await expect(
      importeerDossier(zipBytes, "FoutiefWachtwoord", targetDb),
    ).rejects.toThrow("Wachtwoordzin of herstelcode is onjuist");

    await testDb.delete();
    await targetDb.delete();
  });
});
