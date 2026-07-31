import { describe, expect, it } from "vitest";
import { maakOffset, splitsOffset, toonOffset } from "@/lib/afspraken";

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
