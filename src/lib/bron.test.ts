import { describe, expect, it } from "vitest";
import {
  bronVan,
  magOverschrijven,
  markeerAlsIngevoerd,
  markeerHerkomst,
  voegBerekendeWaardenSamen,
} from "./bron";

/**
 * De kern van bevinding A-10: er was geen enkele code die voorkwam dat een
 * herberekening een handmatig ingevoerde waarde overschrijft. Deze tests pinnen
 * die ene regel vast — een waarde met bron `ingevoerd` blijft staan.
 */

describe("Grendel op handmatige invoer", () => {
  it("overschrijft een handmatig ingevoerde waarde niet", () => {
    const bestaand = markeerAlsIngevoerd(
      { opleverdatum: "2026-09-01", aanneemsom: 400000 },
      ["opleverdatum"],
    );

    const { record, overgeslagen } = voegBerekendeWaardenSamen(bestaand, {
      opleverdatum: "2026-11-15",
      aanneemsom: 425000,
    });

    expect(record.opleverdatum).toBe("2026-09-01");
    expect(overgeslagen).toEqual(["opleverdatum"]);
    // Wat níét handmatig was, wordt wel bijgewerkt.
    expect(record.aanneemsom).toBe(425000);
  });

  it("meldt welke velden zijn overgeslagen, in plaats van stil over te slaan", () => {
    const bestaand = markeerAlsIngevoerd({ a: 1, b: 2, c: 3 }, ["a", "c"]);
    const { overgeslagen } = voegBerekendeWaardenSamen(bestaand, { a: 9, b: 9, c: 9 });
    expect(overgeslagen.sort()).toEqual(["a", "c"]);
  });

  it("werkt velden zonder vastgelegde herkomst gewoon bij", () => {
    const { record } = voegBerekendeWaardenSamen({ datum: "2026-01-01" }, { datum: "2026-02-01" });
    expect(record.datum).toBe("2026-02-01");
  });

  it("laat undefined de bestaande waarde niet wissen", () => {
    const { record } = voegBerekendeWaardenSamen(
      { datum: "2026-01-01" },
      { datum: undefined } as unknown as Partial<{ datum: string }>,
    );
    expect(record.datum).toBe("2026-01-01");
  });

  it("stempelt bijgewerkte velden als afgeleid", () => {
    const { bronnen } = voegBerekendeWaardenSamen({ datum: "2026-01-01" }, { datum: "2026-02-01" });
    expect(bronnen.datum).toBe("afgeleid");
  });

  it("beschermt een veld zodra de gebruiker het overneemt", () => {
    const eerst = voegBerekendeWaardenSamen({ datum: "2026-01-01" }, { datum: "2026-02-01" });
    expect(magOverschrijven(eerst.bronnen, "datum")).toBe(true);

    const daarna = markeerAlsIngevoerd(eerst.record, ["datum"]);
    const { record, overgeslagen } = voegBerekendeWaardenSamen(daarna, { datum: "2026-03-01" });

    expect(record.datum).toBe("2026-02-01");
    expect(overgeslagen).toEqual(["datum"]);
  });

  it("laat geïmporteerde waarden wél bijwerken", () => {
    // Import is geen handmatige invoer: die waarden mogen later door een
    // herberekening worden aangevuld.
    const geimporteerd = markeerHerkomst({ stand: 1200 }, ["stand"], "geïmporteerd");
    expect(bronVan((geimporteerd as Record<string, unknown>).bronnen as never, "stand")).toBe(
      "geïmporteerd",
    );

    const { record, overgeslagen } = voegBerekendeWaardenSamen(geimporteerd, { stand: 1300 });
    expect(record.stand).toBe(1300);
    expect(overgeslagen).toEqual([]);
  });

  it("behandelt een voorstel als overschrijfbaar", () => {
    const voorstel = markeerHerkomst({ bedrag: 100 }, ["bedrag"], "voorstel");
    const { record } = voegBerekendeWaardenSamen(voorstel, { bedrag: 250 });
    expect(record.bedrag).toBe(250);
  });
});
