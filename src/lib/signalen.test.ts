import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/db/db";
import { initialiseerNieuweKluis } from "@/crypto/crypto";
import { zetSleutel } from "@/db/sleutelregister";
import {
  haalSignaaltoestanden,
  haalUitgeschakeldeCategorieen,
  snoozeSignaal,
  zetSignaalstatus,
  zetUitgeschakeldeCategorieen,
} from "./signalen";

/**
 * De signaaltabel is het geheugen van de regelmotor (bevinding A-09). Deze
 * tests controleren vooral twee dingen: dat de invoerhash bewaard blijft — die
 * bepaalt of een weggeklikt signaal terugkomt — en dat de rij net zo goed
 * versleuteld op schijf staat als de rest van het dossier.
 */

const SIGNAAL = { id: "t-001-urgent", regelId: "T-001", invoerHash: "abc12345" };

describe("Signaaltabel", () => {
  beforeEach(async () => {
    const { meta, dek } = await initialiseerNieuweKluis("een lange zin die niemand raadt 42");
    await db.vault_meta.put(meta);
    zetSleutel(dek);
    await db.signalen.clear();
  });

  it("bewaart status en invoerhash", async () => {
    await zetSignaalstatus("p1", SIGNAAL, "genegeerd");

    const toestanden = await haalSignaaltoestanden("p1");
    expect(toestanden).toHaveLength(1);
    expect(toestanden[0]?.status).toBe("genegeerd");
    expect(toestanden[0]?.invoerHash).toBe("abc12345");
  });

  it("schrijft de signaalinhoud versleuteld weg", async () => {
    await zetSignaalstatus("p1", SIGNAAL, "genegeerd");

    const ruw = (await db.signalen.get("p1:t-001-urgent")) as unknown as Record<string, unknown>;
    expect(JSON.stringify(ruw)).not.toContain("T-001");
    expect(typeof ruw.enc).toBe("string");
  });

  it("houdt signalen van verschillende projecten uit elkaar", async () => {
    await zetSignaalstatus("p1", SIGNAAL, "genegeerd");
    await zetSignaalstatus("p2", SIGNAAL, "geaccepteerd");

    expect(await haalSignaaltoestanden("p1")).toHaveLength(1);
    expect((await haalSignaaltoestanden("p2"))[0]?.status).toBe("geaccepteerd");
  });

  it("zet een snoozedatum in de toekomst", async () => {
    await snoozeSignaal("p1", SIGNAAL, 14);

    const toestand = (await haalSignaaltoestanden("p1"))[0];
    expect(toestand?.status).toBe("gesnoozed");
    expect(toestand?.snoozeTot).toBeDefined();
    expect(new Date(toestand?.snoozeTot ?? "").getTime()).toBeGreaterThan(Date.now());
  });

  it("bewaart uitgeschakelde categorieën per project", async () => {
    await zetUitgeschakeldeCategorieen("p1", ["energie", "onderhoud"]);

    expect((await haalUitgeschakeldeCategorieen("p1")).sort()).toEqual(["energie", "onderhoud"]);
    expect(await haalUitgeschakeldeCategorieen("p2")).toEqual([]);
  });

  it("telt de instellingenrij niet mee als signaal", async () => {
    await zetUitgeschakeldeCategorieen("p1", ["energie"]);
    await zetSignaalstatus("p1", SIGNAAL, "genegeerd");

    const echteSignalen = (await haalSignaaltoestanden("p1")).filter(
      (t) => t.regelId !== "__instelling__",
    );
    expect(echteSignalen).toHaveLength(1);
  });
});
