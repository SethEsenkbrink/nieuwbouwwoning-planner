import { describe, expect, it } from "vitest";
import {
  controleerOpleverband,
  naarOpslag,
  uitProject,
  type Opleverbandwaarden,
} from "@/lib/opleverband";

/**
 * De opleverband is het startpunt van vrijwel elke berekening in de app: valt
 * hij verkeerd dicht, dan schuift alles wat eraan hangt mee de mist in. Deze
 * tests dekken de twee dingen die stil fout kunnen gaan — een band die
 * achterstevoren loopt, en een oude bandbreedte die blijft staan onder een
 * datum die inmiddels is aangezegd.
 */

const dag = (tekst: string) => new Date(`${tekst}T00:00:00.000Z`);

const basis: Opleverbandwaarden = {
  status: "indicatief",
  verwacht: dag("2026-11-16"),
  vroegst: undefined,
  laatst: undefined,
  bron: "",
};

describe("controleerOpleverband", () => {
  it("keurt een gewone invoer goed", () => {
    expect(controleerOpleverband(basis)).toBeNull();
  });

  it("eist een verwachte datum", () => {
    expect(controleerOpleverband({ ...basis, verwacht: undefined })).toMatch(/verwachte/i);
  });

  it("weigert een vroegste datum die na de verwachte ligt", () => {
    const waarden: Opleverbandwaarden = {
      ...basis,
      status: "bandbreedte",
      vroegst: dag("2026-12-01"),
    };
    expect(controleerOpleverband(waarden)).toMatch(/vroegste/i);
  });

  it("weigert een laatste datum die vóór de verwachte ligt", () => {
    const waarden: Opleverbandwaarden = {
      ...basis,
      status: "bandbreedte",
      laatst: dag("2026-10-01"),
    };
    expect(controleerOpleverband(waarden)).toMatch(/laatste/i);
  });

  it("laat een omgekeerde band buiten bandbreedte met rust", () => {
    // Bij indicatief of aangezegd worden vroegst en laatst toch overschreven,
    // dus daar hoeft de gebruiker niet op gecorrigeerd te worden.
    const waarden: Opleverbandwaarden = { ...basis, vroegst: dag("2027-01-01") };
    expect(controleerOpleverband(waarden)).toBeNull();
  });
});

describe("naarOpslag", () => {
  it("laat de drie datums samenvallen bij indicatief", () => {
    const opslag = naarOpslag(basis);
    expect(opslag.opleverVroegst).toEqual(dag("2026-11-16"));
    expect(opslag.opleverLaatst).toEqual(dag("2026-11-16"));
  });

  it("wist een oude bandbreedte zodra de datum is aangezegd", () => {
    // Dit is de regel die het makkelijkst vergeten wordt: blijft de oude band
    // staan, dan toont de app een bereik dat er niet meer is.
    const waarden: Opleverbandwaarden = {
      ...basis,
      status: "aangezegd",
      vroegst: dag("2026-11-02"),
      laatst: dag("2026-12-14"),
    };
    const opslag = naarOpslag(waarden);
    expect(opslag.opleverVroegst).toEqual(dag("2026-11-16"));
    expect(opslag.opleverLaatst).toEqual(dag("2026-11-16"));
  });

  it("houdt vroegst en laatst apart bij een bandbreedte", () => {
    const waarden: Opleverbandwaarden = {
      ...basis,
      status: "bandbreedte",
      vroegst: dag("2026-11-02"),
      laatst: dag("2026-12-14"),
    };
    const opslag = naarOpslag(waarden);
    expect(opslag.opleverVroegst).toEqual(dag("2026-11-02"));
    expect(opslag.opleverLaatst).toEqual(dag("2026-12-14"));
  });

  it("valt bij een half ingevulde bandbreedte terug op de verwachte datum", () => {
    const waarden: Opleverbandwaarden = { ...basis, status: "bandbreedte" };
    const opslag = naarOpslag(waarden);
    expect(opslag.opleverVroegst).toEqual(dag("2026-11-16"));
    expect(opslag.opleverLaatst).toEqual(dag("2026-11-16"));
  });

  it("slaat geen brondatum op zonder bron", () => {
    const opslag = naarOpslag(basis);
    expect(opslag.opleverBron).toBeUndefined();
    expect(opslag.opleverBronDatum).toBeUndefined();
  });

  it("zet een brondatum zodra er een bron is", () => {
    const opslag = naarOpslag({ ...basis, bron: "  mail aannemer 12-07  " });
    expect(opslag.opleverBron).toBe("mail aannemer 12-07");
    expect(opslag.opleverBronDatum).toBeInstanceOf(Date);
  });

  it("gooit zonder verwachte datum", () => {
    expect(() => naarOpslag({ ...basis, verwacht: undefined })).toThrow();
  });
});

describe("uitProject", () => {
  it("valt terug op indicatief als er nog niets is ingevuld", () => {
    expect(uitProject({})).toEqual({
      status: "indicatief",
      verwacht: undefined,
      vroegst: undefined,
      laatst: undefined,
      bron: "",
    });
  });

  it("is de omkering van naarOpslag voor een bandbreedte", () => {
    const waarden: Opleverbandwaarden = {
      status: "bandbreedte",
      verwacht: dag("2026-11-16"),
      vroegst: dag("2026-11-02"),
      laatst: dag("2026-12-14"),
      bron: "bouwvergadering",
    };
    const opslag = naarOpslag(waarden);
    expect(
      uitProject({
        opleverStatus: opslag.opleverStatus,
        opleverVerwacht: opslag.opleverVerwacht,
        opleverVroegst: opslag.opleverVroegst,
        opleverLaatst: opslag.opleverLaatst,
        opleverBron: opslag.opleverBron,
      }),
    ).toEqual(waarden);
  });
});
