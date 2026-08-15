import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { WoningdossierDB } from "@/db/db";
import { exporteerInboxDelta, importeerInboxDelta, maakInboxDelta, verwerkInboxDeltaItem } from "./delta";
import type { InboxDeltaItem } from "./types";

describe("Mobiele Quick-Capture Inbox-Delta", () => {
  it("creëert, versleutelt en ontsleutelt een inbox-delta pakket", async () => {
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);
    const dek = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

    const items: InboxDeltaItem[] = [
      {
        id: "item-1",
        type: "gebrek",
        titel: "Kras op voordeur",
        aangemaaktOp: "2026-06-01T10:00:00.000Z",
        data: { locatie: "Entree hal" },
      },
      {
        id: "item-2",
        type: "meterstand",
        titel: "Meterstand elektra",
        aangemaaktOp: "2026-06-01T10:05:00.000Z",
        data: { meterId: "meter-1", stand: 1450.2 },
      },
    ];

    const delta = maakInboxDelta("proj-test", items, "iPhone 15");
    const versleuteld = await exporteerInboxDelta(delta, dek);
    expect(versleuteld.length).toBeGreaterThan(50);

    const ontsleuteld = await importeerInboxDelta(versleuteld, dek);
    expect(ontsleuteld.manifest.formaat).toBe("woningdossier-inbox-delta-v1");
    expect(ontsleuteld.manifest.projectId).toBe("proj-test");
    expect(ontsleuteld.items).toHaveLength(2);
    expect(ontsleuteld.items[0]?.titel).toBe("Kras op voordeur");
  });

  it("verwerkt een inbox-item correct in de database", async () => {
    const testDb = new WoningdossierDB();
    const item: InboxDeltaItem = {
      id: "gebrek-mobiel-1",
      type: "gebrek",
      titel: "Lekkende kraan bijkeuken",
      aangemaaktOp: "2026-06-01T12:00:00.000Z",
      data: { locatie: "Bijkeuken" },
    };

    await verwerkInboxDeltaItem(item, "proj-1", undefined, testDb);
    const opgeslagen = await testDb.gebreken.get("gebrek-mobiel-1");
    expect(opgeslagen).toBeDefined();
    expect(opgeslagen?.omschrijving).toBe("Lekkende kraan bijkeuken");
    expect(opgeslagen?.locatie).toBe("Bijkeuken");
    expect(opgeslagen?.status).toBe("open");
  });
});
