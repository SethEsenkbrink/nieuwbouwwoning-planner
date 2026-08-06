import { describe, expect, it } from "vitest";
import {
  datumUitOffset,
  maakOffset,
  offsetUitDatum,
  splitsOffset,
  toonOffset,
} from "@/lib/afspraken";

/**
 * Klein maar niet triviaal: hier wordt een teken omgezet in taal en terug.
 * Gaat het mis, dan staat een afspraak een half jaar aan de verkeerde kant van
 * het bouwmoment zonder dat iets erover klaagt — de rekenkern accepteert elk
 * getal tussen −3650 en 3650.
 */

describe("splitsOffset", () => {
  it("maakt van een negatieve offset een positief getal met richting vóór", () => {
    expect(splitsOffset(-45)).toEqual({ dagen: 45, richting: "voor" });
  });

  it("houdt een positieve offset positief met richting ná", () => {
    expect(splitsOffset(42)).toEqual({ dagen: 42, richting: "na" });
  });

  it("behandelt nul als ná, want het teken doet er dan niet toe", () => {
    expect(splitsOffset(0)).toEqual({ dagen: 0, richting: "na" });
  });
});

describe("maakOffset", () => {
  it("zet richting vóór om in een negatief getal", () => {
    expect(maakOffset(45, "voor")).toBe(-45);
  });

  it("laat richting ná positief", () => {
    expect(maakOffset(42, "na")).toBe(42);
  });

  it("krijgt geen dubbel minteken bij een al negatieve invoer", () => {
    // Een gebruiker die "-45" intikt in een veld dat om dagen vraagt.
    expect(maakOffset(-45, "voor")).toBe(-45);
    expect(maakOffset(-45, "na")).toBe(45);
  });

  it("is de omkering van splitsOffset", () => {
    for (const offset of [-3650, -70, -1, 0, 1, 42, 3650]) {
      const { dagen, richting } = splitsOffset(offset);
      expect(maakOffset(dagen, richting)).toBe(offset);
    }
  });
});

describe("toonOffset", () => {
  it("noemt de dag zelf bij offset nul", () => {
    expect(toonOffset(0, "Oplevering")).toBe("op de dag van Oplevering");
  });

  it("zegt vóór bij een negatieve offset", () => {
    expect(toonOffset(-45, "Sleuteloverdracht")).toBe("45 dagen vóór Sleuteloverdracht");
  });

  it("zegt ná bij een positieve offset", () => {
    expect(toonOffset(42, "Dekvloer gestort")).toBe("42 dagen ná Dekvloer gestort");
  });

  it("gebruikt enkelvoud bij één dag", () => {
    expect(toonOffset(1, "Oplevering")).toBe("1 dag ná Oplevering");
    expect(toonOffset(-1, "Oplevering")).toBe("1 dag vóór Oplevering");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Denken in datums, opslaan als afstand
 *
 * De gebruiker typt "15 oktober"; het model bewaart "12 dagen ná Oplevering".
 * Zo blijft ADR-0008 overeind — schuift de bouw, dan schuift de afspraak mee —
 * terwijl niemand meer in offsets hoeft te denken.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Korte notatie voor een datum op UTC-middernacht. */
const dag = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("offsetUitDatum", () => {
  it("rekent een datum ná het anker om naar een positieve offset", () => {
    expect(offsetUitDatum(dag("2026-11-09"), dag("2026-10-28"))).toBe(12);
  });

  it("rekent een datum vóór het anker om naar een negatieve offset", () => {
    expect(offsetUitDatum(dag("2026-10-14"), dag("2026-10-28"))).toBe(-14);
  });

  it("geeft nul op de dag zelf", () => {
    expect(offsetUitDatum(dag("2026-10-28"), dag("2026-10-28"))).toBe(0);
  });

  /** Zomertijd maakt sommige dagen 23 uur; afronden vangt dat af. */
  it("blijft heel over de overgang naar wintertijd", () => {
    expect(offsetUitDatum(dag("2026-11-03"), dag("2026-10-20"))).toBe(14);
  });

  it("geeft undefined als het anker geen datum heeft", () => {
    expect(offsetUitDatum(dag("2026-11-09"), undefined)).toBeUndefined();
  });
});

describe("datumUitOffset", () => {
  it("is de omkering van offsetUitDatum", () => {
    const anker = dag("2026-10-28");
    for (const offset of [-45, -14, 0, 7, 42, 60]) {
      const datum = datumUitOffset(offset, anker);
      expect(offsetUitDatum(datum!, anker)).toBe(offset);
    }
  });

  it("geeft undefined zonder anker", () => {
    expect(datumUitOffset(7, undefined)).toBeUndefined();
  });
});
