import { describe, expect, it } from "vitest";
import {
  ontbrekendeStandaardposten,
  sorteerNabudget,
  telbaarBedrag,
  telNabudget,
} from "@/lib/nabudget";
import type { NabudgetMetId } from "@/lib/converters";

/**
 * Twee bedragen per post: wat je dacht, en wat het werd. De valkuil zit in het
 * optellen — tel je beide, dan telt een betaalde post dubbel en klopt het
 * totaal nergens meer.
 */

const post = (id: string, extra: Partial<NabudgetMetId> = {}): NabudgetMetId => ({
  id,
  omschrijving: `Post ${id}`,
  status: "geraamd",
  ...extra,
});

describe("telbaarBedrag", () => {
  it("gebruikt het werkelijke bedrag zodra dat er is", () => {
    expect(telbaarBedrag(post("a", { geraamd: 4000, werkelijk: 5200 }))).toBe(5200);
  });

  it("valt terug op de raming", () => {
    expect(telbaarBedrag(post("a", { geraamd: 4000 }))).toBe(4000);
  });

  it("telt een post zonder bedrag als nul", () => {
    expect(telbaarBedrag(post("a"))).toBe(0);
  });
});

describe("telNabudget", () => {
  it("telt niet dubbel als beide bedragen bekend zijn", () => {
    const stand = telNabudget([post("a", { geraamd: 4000, werkelijk: 5200, status: "betaald" })]);
    expect(stand.totaal).toBe(5200);
    expect(stand.betaald).toBe(5200);
  });

  it("splitst geraamd, besteld en betaald", () => {
    const posten = [
      post("1", { geraamd: 1000 }),
      post("2", { geraamd: 2000, status: "besteld" }),
      post("3", { werkelijk: 3000, status: "betaald" }),
    ];
    const stand = telNabudget(posten);
    expect(stand.geraamd).toBe(1000);
    expect(stand.besteld).toBe(2000);
    expect(stand.betaald).toBe(3000);
    expect(stand.totaal).toBe(6000);
  });

  it("rekent de afwijking alleen over posten waar beide bedragen bekend zijn", () => {
    const posten = [
      post("duurder", { geraamd: 4000, werkelijk: 5200 }),
      post("meegevallen", { geraamd: 3000, werkelijk: 2500 }),
      post("onbekend", { geraamd: 9999 }),
    ];
    expect(telNabudget(posten).afwijking).toBe(700);
  });

  it("telt posten zonder enig bedrag apart", () => {
    expect(telNabudget([post("a"), post("b", { geraamd: 100 })]).zonderBedrag).toBe(1);
  });

  it("geeft nullen bij een lege lijst", () => {
    expect(telNabudget([])).toEqual({
      aantal: 0,
      totaal: 0,
      geraamd: 0,
      besteld: 0,
      betaald: 0,
      afwijking: 0,
      begroot: 0,
      werkelijk: 0,
      nogVerplicht: 0,
      zonderBedrag: 0,
    });
  });
});

describe("sorteerNabudget", () => {
  it("zet wat nog moet gebeuren bovenaan en betaald onderaan", () => {
    const posten = [
      post("betaald", { status: "betaald", geraamd: 100 }),
      post("geraamd", { geraamd: 100 }),
      post("besteld", { status: "besteld", geraamd: 100 }),
    ];
    expect(sorteerNabudget(posten).map((p) => p.id)).toEqual(["geraamd", "besteld", "betaald"]);
  });

  it("zet binnen dezelfde status het duurste eerst", () => {
    const posten = [post("klein", { geraamd: 500 }), post("groot", { geraamd: 8000 })];
    expect(sorteerNabudget(posten).map((p) => p.id)).toEqual(["groot", "klein"]);
  });

  it("laat de oorspronkelijke lijst met rust", () => {
    const posten = [post("b", { geraamd: 100 }), post("a", { geraamd: 900 })];
    sorteerNabudget(posten);
    expect(posten.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("ontbrekendeStandaardposten", () => {
  it("laat weg wat al in de lijst staat, ongeacht hoofdletters", () => {
    const posten = [post("a", { omschrijving: "Tuinaanleg" })];
    const standaard = [{ omschrijving: "tuinaanleg" }, { omschrijving: "Oprit en bestrating" }];
    expect(ontbrekendeStandaardposten(posten, standaard)).toEqual(["Oprit en bestrating"]);
  });

  it("geeft alles terug als er nog niets is", () => {
    const standaard = [{ omschrijving: "Vloerafwerking" }, { omschrijving: "Tuinaanleg" }];
    expect(ontbrekendeStandaardposten([], standaard)).toHaveLength(2);
  });
});

describe("De financiële drieslag (B5.4)", () => {
  /**
   * Begroot, werkelijk en nog verplicht beantwoorden elk een andere vraag.
   * Ze moeten los van elkaar kloppen, ook als een post nog geen raming heeft
   * of juist duurder uitviel dan begroot.
   */
  const posten = [
    { id: "1", omschrijving: "Tuin", geraamd: 5000, status: "geraamd" },
    { id: "2", omschrijving: "Vloer", geraamd: 8000, werkelijk: 9500, status: "betaald" },
    { id: "3", omschrijving: "Zonwering", geraamd: 3000, status: "besteld" },
    { id: "4", omschrijving: "Nog onbekend", status: "geraamd" },
  ] as unknown as Parameters<typeof telNabudget>[0];

  it("telt begroot over alle ramingen, ongeacht status", () => {
    expect(telNabudget(posten).begroot).toBe(16000);
  });

  it("telt werkelijk alleen over wat betaald is", () => {
    expect(telNabudget(posten).werkelijk).toBe(9500);
  });

  it("telt nog verplicht alleen over wat besteld maar niet betaald is", () => {
    expect(telNabudget(posten).nogVerplicht).toBe(3000);
  });

  it("houdt nog verplicht los van wat nog te begroten valt", () => {
    // Post 1 is geraamd maar nog niet besteld: die ligt niet vast en hoort
    // dus niet bij nogVerplicht.
    const stand = telNabudget(posten);
    expect(stand.nogVerplicht).not.toBe(stand.geraamd);
  });
});
