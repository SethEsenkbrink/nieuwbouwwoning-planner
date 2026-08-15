import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/db/db";
import { initialiseerNieuweKluis } from "@/crypto/crypto";
import { bewaar } from "@/db/kluisopslag";
import { isOntgrendeld, zetSleutel } from "@/db/sleutelregister";
import { bestaatBestand, slaBestandOp } from "@/lib/opfs/storage";
import { wisAllesLokaal } from "./paniek";

/**
 * De paniekknop ontbrak volledig (A-11). Deze tests controleren niet alleen
 * dat er iets gewist wordt, maar dat er níéts overblijft — met name
 * `vault_meta`, want daarin zitten de gewrapte DEK's.
 */

describe("Paniekknop", () => {
  it("wist sleutel, documenten en de volledige database", async () => {
    const { meta, dek } = await initialiseerNieuweKluis("een lange zin die niemand raadt 42");
    await db.vault_meta.put(meta);
    zetSleutel(dek);

    await bewaar(db.onderdelen, { id: "o1", projectId: "p1", naam: "Ketel" });
    await slaBestandOp(dek, "doc-1", new TextEncoder().encode("contractinhoud"));

    expect(isOntgrendeld()).toBe(true);
    expect(await bestaatBestand("doc-1")).toBe(true);

    const resultaat = await wisAllesLokaal();

    expect(resultaat.fouten).toEqual([]);
    expect(resultaat.sleutelGewist).toBe(true);
    expect(resultaat.bestandenGewist).toBe(true);
    expect(resultaat.databaseGewist).toBe(true);

    // De sleutel is weg uit het geheugen.
    expect(isOntgrendeld()).toBe(false);
    // Het document is weg.
    expect(await bestaatBestand("doc-1")).toBe(false);

    // En vooral: vault_meta is weg, dus de gewrapte DEK's bestaan niet meer.
    await db.open();
    expect(await db.vault_meta.count()).toBe(0);
    expect(await db.onderdelen.count()).toBe(0);
  });
});
