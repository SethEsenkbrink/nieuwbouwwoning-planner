import { describe, expect, it } from "vitest";
import { berekenImpact } from "@/lib/watals";
import type { AfspraakInvoer, BetrokkeneInvoer, PlanningContext } from "@/lib/planning";

/**
 * De wat-als beantwoordt vóór het opslaan de enige vraag die er op dat moment
 * toe doet: kost dit geld, en heeft iemand haast?
 *
 * De valkuil zit in wélke datum je voor de annuleertermijn gebruikt. Reken je
 * op de nieuwe datum, dan lijkt een verschuiving naar later ineens gratis —
 * terwijl de partij nog steeds op de oude datum staat en díé afspraak verzet
 * moet worden.
 */

const dag = (tekst: string) => new Date(`${tekst}T00:00:00.000Z`);
const VANDAAG = dag("2026-08-01");

const keuken: BetrokkeneInvoer = {
  id: "b1",
  naam: "Keukenhuis",
  aanlooptijdDagen: 70,
  annuleertermijnDagen: 21,
  communicatieregel: "direct",
};

const inmeten: AfspraakInvoer = {
  id: "a1",
  betrokkeneId: "b1",
  omschrijving: "inmeten keuken",
  ankerType: "ruwbouw_gereed",
  offsetDagen: 0,
  status: "concept",
};

const metRuwbouw = (datum: string): PlanningContext => ({
  ankers: [{ type: "ruwbouw_gereed", status: "verwacht", verwachtOp: dag(datum) }],
  opleverband: { status: "indicatief", verwacht: dag("2026-11-16") },
});

describe("berekenImpact", () => {
  it("laat een afspraak die niet verschuift buiten de lijst", () => {
    const impact = berekenImpact(
      [inmeten],
      [keuken],
      metRuwbouw("2026-10-01"),
      metRuwbouw("2026-10-01"),
      VANDAAG,
    );
    expect(impact.aantalGeraakt).toBe(0);
  });

  it("meldt hoeveel dagen een afspraak opschuift", () => {
    const impact = berekenImpact(
      [inmeten],
      [keuken],
      metRuwbouw("2026-10-01"),
      metRuwbouw("2026-10-15"),
      VANDAAG,
    );
    expect(impact.aantalGeraakt).toBe(1);
    expect(impact.regels[0]?.verschovenDagen).toBe(14);
  });

  it("telt een vervroeging als negatief", () => {
    const impact = berekenImpact(
      [inmeten],
      [keuken],
      metRuwbouw("2026-10-15"),
      metRuwbouw("2026-10-01"),
      VANDAAG,
    );
    expect(impact.regels[0]?.verschovenDagen).toBe(-14);
  });

  it("rekent de annuleertermijn op de OUDE datum", () => {
    // Oude datum 10 aug, annuleertermijn 21 dagen → gratis verzetten kon tot
    // 20 juli. Vandaag is 1 augustus, dus dat venster is dicht: dit kost geld,
    // ook al ligt de nieuwe datum nog ver weg.
    const impact = berekenImpact(
      [inmeten],
      [keuken],
      metRuwbouw("2026-08-10"),
      metRuwbouw("2026-12-01"),
      VANDAAG,
    );
    expect(impact.regels[0]?.kostGeld).toBe(true);
    expect(impact.regels[0]?.gratisTot).toEqual(dag("2026-07-20"));
    expect(impact.aantalKostGeld).toBe(1);
  });

  it("kost geen geld als de annuleertermijn nog loopt", () => {
    const impact = berekenImpact(
      [inmeten],
      [keuken],
      metRuwbouw("2026-10-01"),
      metRuwbouw("2026-10-15"),
      VANDAAG,
    );
    expect(impact.regels[0]?.kostGeld).toBe(false);
  });

  it("kost nooit geld bij een partij zonder annuleertermijn", () => {
    const gemeente: BetrokkeneInvoer = { ...keuken, annuleertermijnDagen: 0 };
    const impact = berekenImpact(
      [inmeten],
      [gemeente],
      metRuwbouw("2026-08-02"),
      metRuwbouw("2026-12-01"),
      VANDAAG,
    );
    expect(impact.regels[0]?.kostGeld).toBe(false);
    expect(impact.regels[0]?.gratisTot).toBeUndefined();
  });

  it("markeert haast als de nieuwe datum binnen de aanlooptijd valt", () => {
    // 70 dagen aanlooptijd, nieuwe datum over 44 dagen.
    const impact = berekenImpact(
      [inmeten],
      [keuken],
      metRuwbouw("2026-12-01"),
      metRuwbouw("2026-09-14"),
      VANDAAG,
    );
    expect(impact.regels[0]?.heeftHaast).toBe(true);
    expect(impact.aantalHaast).toBe(1);
  });

  it("markeert geen haast als de nieuwe datum ruim buiten de aanlooptijd ligt", () => {
    const impact = berekenImpact(
      [inmeten],
      [keuken],
      metRuwbouw("2026-12-01"),
      metRuwbouw("2027-03-01"),
      VANDAAG,
    );
    expect(impact.regels[0]?.heeftHaast).toBe(false);
  });

  it("slaat afgeronde en vervallen afspraken over", () => {
    const afgerond: AfspraakInvoer = { ...inmeten, id: "a2", status: "afgerond" };
    const vervallen: AfspraakInvoer = { ...inmeten, id: "a3", status: "vervallen" };
    const impact = berekenImpact(
      [afgerond, vervallen],
      [keuken],
      metRuwbouw("2026-10-01"),
      metRuwbouw("2026-11-01"),
      VANDAAG,
    );
    expect(impact.aantalGeraakt).toBe(0);
  });

  it("slaat een afspraak zonder betrokkene over in plaats van te crashen", () => {
    const wees: AfspraakInvoer = { ...inmeten, betrokkeneId: "bestaat-niet" };
    const impact = berekenImpact(
      [wees],
      [keuken],
      metRuwbouw("2026-10-01"),
      metRuwbouw("2026-11-01"),
      VANDAAG,
    );
    expect(impact.aantalGeraakt).toBe(0);
  });

  it("laat afspraken aan een ander bouwmoment ongemoeid", () => {
    // Deze hangt aan de oplevering; die verandert in dit scenario niet.
    const verhuizing: AfspraakInvoer = {
      ...inmeten,
      id: "a4",
      ankerType: "oplevering",
      omschrijving: "verhuisbus",
    };
    const impact = berekenImpact(
      [inmeten, verhuizing],
      [keuken],
      metRuwbouw("2026-10-01"),
      metRuwbouw("2026-11-01"),
      VANDAAG,
    );
    expect(impact.aantalGeraakt).toBe(1);
    expect(impact.regels[0]?.omschrijving).toBe("inmeten keuken");
  });

  it("zet wat geld kost bovenaan, daarna wat haast heeft", () => {
    const bus: BetrokkeneInvoer = {
      id: "b2",
      naam: "Busverhuur",
      aanlooptijdDagen: 14,
      annuleertermijnDagen: 0,
      communicatieregel: "direct",
    };
    const verhuizing: AfspraakInvoer = {
      id: "a5",
      betrokkeneId: "b2",
      omschrijving: "verhuisbus",
      ankerType: "ruwbouw_gereed",
      offsetDagen: 5,
      status: "concept",
    };

    // Oud: 10 aug. Voor de keuken is de annuleertermijn (21 dagen) al verstreken;
    // de bus heeft er geen, maar krijgt wel haast door de korte aanlooptijd.
    const impact = berekenImpact(
      [verhuizing, inmeten],
      [keuken, bus],
      metRuwbouw("2026-08-10"),
      metRuwbouw("2026-08-06"),
      VANDAAG,
    );

    expect(impact.regels[0]?.betrokkeneNaam).toBe("Keukenhuis");
    expect(impact.regels[0]?.kostGeld).toBe(true);
    expect(impact.regels[1]?.betrokkeneNaam).toBe("Busverhuur");
    expect(impact.regels[1]?.heeftHaast).toBe(true);
  });
});
