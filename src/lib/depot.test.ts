import { describe, expect, it } from "vitest";
import { depotDekking, sorteerTermijnen, telDepot, termijnstand } from "@/lib/depot";
import type { TermijnMetId } from "@/lib/converters";

/**
 * Het getal dat ertoe doet is `teDeclareren`: een factuur die je hebt ontvangen
 * maar niet hebt ingediend. Dat is de enige stap in de keten waar jíj aan zet
 * bent — de andere twee liggen bij de aannemer en de bank. Verdwijnt dat getal
 * in een totaal, dan blijft er geld stilstaan zonder dat iets erover klaagt.
 */

const dag = (tekst: string) => new Date(`${tekst}T00:00:00.000Z`);

const termijn = (id: string, extra: Partial<TermijnMetId> = {}): TermijnMetId => ({
  id,
  omschrijving: `Termijn ${id}`,
  gefactureerd: false,
  gedeclareerdBijBank: false,
  betaald: false,
  ...extra,
});

describe("termijnstand", () => {
  it("kent de vier standen", () => {
    expect(termijnstand(termijn("a"))).toBe("open");
    expect(termijnstand(termijn("a", { gefactureerd: true }))).toBe("gefactureerd");
    expect(termijnstand(termijn("a", { gefactureerd: true, gedeclareerdBijBank: true }))).toBe(
      "gedeclareerd",
    );
    expect(
      termijnstand(
        termijn("a", { gefactureerd: true, gedeclareerdBijBank: true, betaald: true }),
      ),
    ).toBe("betaald");
  });

  it("laat de verst gevorderde stap tellen bij een vergeten vinkje", () => {
    // Betaald maar het declaratievinkje staat uit: dat is geen actiepunt.
    const raar = termijn("a", { gefactureerd: true, betaald: true });
    expect(termijnstand(raar)).toBe("betaald");
  });
});

describe("telDepot", () => {
  it("splitst de bedragen over de vier standen", () => {
    const termijnen = [
      termijn("1", { bedrag: 50000, gefactureerd: true, gedeclareerdBijBank: true, betaald: true }),
      termijn("2", { bedrag: 40000, gefactureerd: true, gedeclareerdBijBank: true }),
      termijn("3", { bedrag: 30000, gefactureerd: true }),
      termijn("4", { bedrag: 20000 }),
    ];
    const stand = telDepot(termijnen);

    expect(stand.totaal).toBe(140000);
    expect(stand.betaald).toBe(50000);
    expect(stand.wachtOpBank).toBe(40000);
    expect(stand.teDeclareren).toBe(30000);
    expect(stand.nogNietGefactureerd).toBe(20000);
  });

  it("telt hoeveel termijnen op jouw actie wachten", () => {
    const termijnen = [
      termijn("1", { bedrag: 1000, gefactureerd: true }),
      termijn("2", { bedrag: 2000, gefactureerd: true }),
      termijn("3", { bedrag: 3000, gefactureerd: true, gedeclareerdBijBank: true }),
    ];
    const stand = telDepot(termijnen);
    expect(stand.aantalTeDeclareren).toBe(2);
    expect(stand.teDeclareren).toBe(3000);
  });

  it("telt een termijn zonder bedrag als nul en meldt dat apart", () => {
    const stand = telDepot([termijn("1", { gefactureerd: true }), termijn("2", { bedrag: 100 })]);
    expect(stand.totaal).toBe(100);
    expect(stand.zonderBedrag).toBe(1);
  });

  it("geeft nullen terug bij een lege lijst", () => {
    const stand = telDepot([]);
    expect(stand).toEqual({
      aantal: 0,
      totaal: 0,
      nogNietGefactureerd: 0,
      teDeclareren: 0,
      wachtOpBank: 0,
      betaald: 0,
      aantalTeDeclareren: 0,
      zonderBedrag: 0,
    });
  });
});

describe("sorteerTermijnen", () => {
  it("houdt de nummering aan en zet 10 achter 2", () => {
    const termijnen = [
      termijn("c", { omschrijving: "10e termijn" }),
      termijn("a", { omschrijving: "2e termijn" }),
      termijn("b", { omschrijving: "1e termijn" }),
    ];
    expect(sorteerTermijnen(termijnen).map((t) => t.omschrijving)).toEqual([
      "1e termijn",
      "2e termijn",
      "10e termijn",
    ]);
  });

  it("zet gefactureerde termijnen op factuurdatum vooraan", () => {
    const termijnen = [
      termijn("b", { omschrijving: "Zzz", gefactureerdOp: dag("2026-03-01") }),
      termijn("a", { omschrijving: "Aaa" }),
      termijn("c", { omschrijving: "Bbb", gefactureerdOp: dag("2026-01-01") }),
    ];
    expect(sorteerTermijnen(termijnen).map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("laat de oorspronkelijke lijst met rust", () => {
    const termijnen = [termijn("b", { omschrijving: "B" }), termijn("a", { omschrijving: "A" })];
    sorteerTermijnen(termijnen);
    expect(termijnen.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("depotDekking", () => {
  it("rekent uit welk deel van de koopsom via het depot loopt", () => {
    const stand = telDepot([termijn("1", { bedrag: 200000 })]);
    expect(depotDekking(stand, 250000)).toBe(80);
  });

  it("geeft niets terug zonder koopsom", () => {
    const stand = telDepot([termijn("1", { bedrag: 1000 })]);
    expect(depotDekking(stand, undefined)).toBeUndefined();
    expect(depotDekking(stand, 0)).toBeUndefined();
  });
});
