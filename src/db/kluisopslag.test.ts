import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { db, versleuteldeTabellen } from "./db";
import { initialiseerNieuweKluis } from "@/crypto/crypto";
import { KluisVergrendeldFout, wisSleutel, zetSleutel } from "./sleutelregister";
import {
  bewaar,
  haal,
  haalVanProject,
  hermigreerPlatteRecords,
  verwijder,
  verwijderVanProject,
} from "./kluisopslag";

/**
 * Deze tests bestaan omdat de audit vaststelde dat álle woningdata plat in
 * IndexedDB stond, terwijl ADR-0021 versleuteling at rest eist (A-01). De kluis
 * beschermde toen niets: wie het browserprofiel had, las het hele dossier.
 *
 * De belangrijkste test hieronder is niet "kan ik het terugleze n" maar
 * "staat er werkelijk geen leesbare tekst op schijf".
 */

const WACHTWOORDZIN = "een lange zin die niemand raadt 42";

async function ontgrendel() {
  const { meta, dek } = await initialiseerNieuweKluis(WACHTWOORDZIN);
  await db.vault_meta.put(meta);
  zetSleutel(dek);
  return dek;
}

describe("Versleutelde opslaglaag", () => {
  beforeEach(async () => {
    wisSleutel();
    await Promise.all(versleuteldeTabellen(db).map((t) => t.clear()));
    await db.vault_meta.clear();
  });

  it("schrijft geen leesbare inhoud naar IndexedDB", async () => {
    await ontgrendel();

    await bewaar(db.betrokkenen, {
      id: "b1",
      projectId: "p1",
      naam: "Aannemersbedrijf Van Dijk",
      email: "contact@vandijk.example",
      telefoon: "0612345678",
      notitie: "Contractsom 412.500 euro, tekenen op 3 september",
    });

    // Lees de ruwe rij zoals hij daadwerkelijk op schijf staat.
    const ruw = (await db.betrokkenen.get("b1")) as unknown as Record<string, unknown>;
    const opSchijf = JSON.stringify(ruw);

    for (const geheim of [
      "Van Dijk",
      "vandijk.example",
      "0612345678",
      "412.500",
      "september",
    ]) {
      expect(opSchijf).not.toContain(geheim);
    }

    // Alleen de sleutelvelden mogen leesbaar zijn.
    expect(ruw.id).toBe("b1");
    expect(ruw.projectId).toBe("p1");
    expect(typeof ruw.enc).toBe("string");
    expect(Object.keys(ruw).sort()).toEqual(["enc", "id", "projectId"]);
  });

  it("leest hetzelfde record volledig terug", async () => {
    await ontgrendel();
    const origineel = {
      id: "b2",
      projectId: "p1",
      naam: "Installateur",
      bedrag: 1234.56,
      genest: { diep: ["a", "b"], vlag: true },
    };

    await bewaar(db.betrokkenen, origineel);
    const terug = await haal(db.betrokkenen, "b2");

    expect(terug).toEqual(origineel);
  });

  it("gebruikt een verse IV per record — twee identieke records geven andere ciphertext", async () => {
    await ontgrendel();
    const inhoud = { naam: "Zelfde inhoud", categorie: "bouw" };

    await bewaar(db.betrokkenen, { id: "x1", projectId: "p1", ...inhoud });
    await bewaar(db.betrokkenen, { id: "x2", projectId: "p1", ...inhoud });

    const a = (await db.betrokkenen.get("x1")) as unknown as { enc: string };
    const b = (await db.betrokkenen.get("x2")) as unknown as { enc: string };

    expect(a.enc).not.toEqual(b.enc);
    // De eerste 12 bytes zijn de IV; base64 codeert 3 bytes per 4 tekens, dus
    // de eerste 16 tekens dekken precies die 12 bytes. Ze moeten verschillen.
    expect(a.enc.slice(0, 16)).not.toEqual(b.enc.slice(0, 16));
  });

  it("weigert te lezen en te schrijven als de kluis vergrendeld is", async () => {
    await ontgrendel();
    await bewaar(db.betrokkenen, { id: "b3", projectId: "p1", naam: "Test" });

    wisSleutel();

    await expect(haal(db.betrokkenen, "b3")).rejects.toBeInstanceOf(KluisVergrendeldFout);
    await expect(
      bewaar(db.betrokkenen, { id: "b4", projectId: "p1", naam: "Test" }),
    ).rejects.toBeInstanceOf(KluisVergrendeldFout);
  });

  it("houdt projectId-queries werkend zonder inhoudsindexen", async () => {
    await ontgrendel();
    await bewaar(db.onderdelen, { id: "o1", projectId: "p1", naam: "Ketel" });
    await bewaar(db.onderdelen, { id: "o2", projectId: "p1", naam: "Kozijn" });
    await bewaar(db.onderdelen, { id: "o3", projectId: "p2", naam: "Anders" });

    const vanP1 = await haalVanProject(db.onderdelen, "p1");
    expect(vanP1).toHaveLength(2);
    expect(vanP1.map((o) => o.naam).sort()).toEqual(["Ketel", "Kozijn"]);
  });

  it("verwijdert zonder de kluis te hoeven ontgrendelen", async () => {
    await ontgrendel();
    await bewaar(db.onderdelen, { id: "o9", projectId: "p9", naam: "Weg hiermee" });

    wisSleutel();
    await verwijder(db.onderdelen, "o9");
    expect(await db.onderdelen.get("o9")).toBeUndefined();
  });

  it("verwijdert alle records van één project", async () => {
    await ontgrendel();
    await bewaar(db.onderdelen, { id: "p-a", projectId: "weg", naam: "A" });
    await bewaar(db.onderdelen, { id: "p-b", projectId: "weg", naam: "B" });
    await bewaar(db.onderdelen, { id: "p-c", projectId: "blijft", naam: "C" });

    const aantal = await verwijderVanProject(db.onderdelen, "weg");
    expect(aantal).toBe(2);
    expect(await db.onderdelen.count()).toBe(1);
  });

  it("hermigreert bestaande platte records naar versleutelde vorm", async () => {
    // Simuleer een kluis van vóór deze laag: plat weggeschreven, buiten de
    // opslaglaag om.
    await db.onderdelen.put({
      id: "oud-1",
      projectId: "p1",
      naam: "Stond hier al plat",
    } as never);

    await ontgrendel();
    const aantal = await hermigreerPlatteRecords([db.onderdelen]);
    expect(aantal).toBe(1);

    const ruw = (await db.onderdelen.get("oud-1")) as unknown as Record<string, unknown>;
    expect(JSON.stringify(ruw)).not.toContain("Stond hier al plat");
    expect(typeof ruw.enc).toBe("string");

    // En de inhoud is nog steeds correct te lezen.
    const terug = await haal(db.onderdelen, "oud-1");
    expect(terug?.naam).toBe("Stond hier al plat");
  });

  it("is veilig om herhaald te hermigreren", async () => {
    await ontgrendel();
    await bewaar(db.onderdelen, { id: "al-versleuteld", projectId: "p1", naam: "Klaar" });

    expect(await hermigreerPlatteRecords([db.onderdelen])).toBe(0);
    const terug = await haal(db.onderdelen, "al-versleuteld");
    expect(terug?.naam).toBe("Klaar");
  });
});
