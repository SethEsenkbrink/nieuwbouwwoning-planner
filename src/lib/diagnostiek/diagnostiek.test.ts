import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { WoningdossierDB } from "@/db/db";
import { Timestamp } from "@/types/model";
import { voerSysteemAuditUit } from "./audit";
import { haalLogGebeurtenissen, logEvent, wisLogGebeurtenissen } from "./logger";
import { genereerJsonRapport, genereerMarkdownRapport } from "./rapport";

describe("Diagnostiek & Systeemaudit Systeem", () => {
  it("logt gebeurtenissen en houdt de buffer up-to-date", () => {
    wisLogGebeurtenissen();
    logEvent("info", "test", "Testbericht", { key: "value" });
    const logs = haalLogGebeurtenissen();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.bericht).toBe("Testbericht");
    expect(logs[0]?.niveau).toBe("info");
  });

  it("voert een audit uit en detecteert verweesde relaties", async () => {
    const testDb = new WoningdossierDB();
    await testDb.projecten.put({
      id: "p1",
      naam: "Testproject",
      aangemaaktOp: Timestamp.fromDate(new Date("2026-01-01")),
    });

    // Voeg afspraak toe met een niet-bestaande betrokkeneId
    await testDb.afspraken.put({
      id: "a1",
      projectId: "p1",
      betrokkeneId: "betrokkene-onbekend-999",
      ankerType: "oplevering",
      titel: "Kozijnen inmeten",
      offsetDagen: -14,
      status: "bevestigd",
      gecommuniceerdeDatum: Timestamp.fromDate(new Date("2026-06-01")),
    });

    const rawKey = new Uint8Array(32);
    const dek = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

    const rapport = await voerSysteemAuditUit(dek, testDb);
    expect(rapport.algemeneScore).toBeLessThanOrEqual(100);
    expect(rapport.samenvatting.totaalControles).toBeGreaterThan(0);

    const verweesdItem = rapport.items.find((i) => i.id === "relatie-afspraken-verweesd");
    expect(verweesdItem).toBeDefined();
    expect(verweesdItem?.status).toBe("attentie");

    const md = genereerMarkdownRapport(rapport);
    expect(md).toContain("# Systeemdiagnose & Ontwikkelrapport");
    expect(md).toContain("Kozijnen inmeten");

    const json = genereerJsonRapport(rapport);
    expect(json).toContain("relatie-afspraken-verweesd");
  });
});
