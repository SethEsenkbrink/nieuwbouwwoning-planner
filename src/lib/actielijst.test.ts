import { describe, expect, it } from "vitest";
import {
  maakActielijst,
  naarAnkerInvoer,
  naarPlanningContext,
  telHandmatigeBetrokkenen,
} from "@/lib/actielijst";
import type { AfspraakMetId, AnkerMetId, BetrokkeneMetId, ProjectData } from "@/lib/converters";

/**
 * De vertaling van Firestore-documenten naar de rekenmotor.
 *
 * De rekenmotor zelf is al getest in `planning.test.ts`. Wat hier getest wordt
 * is de laag ertussen — en die heeft precies twee manieren om stil fout te
 * gaan: een opleverband meesturen die er niet is, en een anker meesturen dat
 * geen datum heeft. In beide gevallen komt er een lijst uit die er correct
 * uitziet en het niet is.
 */

const dag = (tekst: string) => new Date(`${tekst}T00:00:00.000Z`);
const VANDAAG = dag("2026-08-01");

const project: Pick<
  ProjectData,
  "opleverStatus" | "opleverVroegst" | "opleverVerwacht" | "opleverLaatst"
> = {
  opleverStatus: "indicatief",
  opleverVerwacht: dag("2026-11-16"),
};

const keuken: BetrokkeneMetId = {
  id: "b1",
  naam: "Keukenleverancier",
  categorie: "afbouw",
  aanlooptijdDagen: 70,
  annuleertermijnDagen: 21,
  communicatieregel: "direct",
  waardenBron: "voorstel",
};

const inmeten: AfspraakMetId = {
  id: "a1",
  betrokkeneId: "b1",
  omschrijving: "Inmeten keuken",
  ankerType: "ruwbouw_gereed",
  offsetDagen: 0,
  status: "concept",
};

describe("naarAnkerInvoer", () => {
  it("laat een anker zonder datum staan", () => {
    // Wegfilteren zou dezelfde regel op twee plekken zetten: `planning.ts`
    // slaat een anker zonder datum zelf al over.
    const zonderDatum: AnkerMetId = {
      id: "k1",
      type: "dekvloer_gestort",
      titel: "Dekvloer gestort",
      status: "verwacht",
    };
    expect(naarAnkerInvoer(zonderDatum)).toEqual({
      type: "dekvloer_gestort",
      status: "verwacht",
    });
  });

  it("neemt de datum mee als hij er is", () => {
    const metDatum: AnkerMetId = {
      id: "k2",
      type: "ruwbouw_gereed",
      titel: "Ruwbouw gereed",
      status: "bevestigd",
      verwachtOp: dag("2026-09-01"),
    };
    expect(naarAnkerInvoer(metDatum).verwachtOp).toEqual(dag("2026-09-01"));
  });
});

describe("naarPlanningContext", () => {
  it("laat de opleverband weg zolang er geen opleverstatus is", () => {
    // Een datum zonder staat zou stilzwijgend als "verwacht" gelden, en dan
    // bepaalt niets meer of je een partij definitief mag boeken (ADR-0008).
    const context = naarPlanningContext({ opleverVerwacht: dag("2026-11-16") }, []);
    expect(context.opleverband).toBeUndefined();
  });

  it("neemt de band over zodra de staat bekend is", () => {
    const context = naarPlanningContext(project, []);
    expect(context.opleverband).toEqual({
      status: "indicatief",
      verwacht: dag("2026-11-16"),
    });
  });

  it("houdt vroegst en laatst uit elkaar bij een bandbreedte", () => {
    const context = naarPlanningContext(
      {
        opleverStatus: "bandbreedte",
        opleverVroegst: dag("2026-11-02"),
        opleverVerwacht: dag("2026-11-16"),
        opleverLaatst: dag("2026-12-14"),
      },
      [],
    );
    expect(context.opleverband?.vroegst).toEqual(dag("2026-11-02"));
    expect(context.opleverband?.laatst).toEqual(dag("2026-12-14"));
  });
});

describe("maakActielijst", () => {
  it("valt terug op de oplevering als het gevraagde anker ontbreekt", () => {
    const regels = maakActielijst(project, [], [keuken], [inmeten], VANDAAG);

    expect(regels).toHaveLength(1);
    expect(regels[0]?.berekend.zekerheid).toBe("teruggevallen");
    expect(regels[0]?.berekend.gevraagdAnker).toBe("ruwbouw_gereed");
    expect(regels[0]?.berekend.gebruiktAnker).toBe("oplevering");
  });

  it("rekent vanaf het echte anker zodra dat een datum heeft", () => {
    const ruwbouw: AnkerMetId = {
      id: "k3",
      type: "ruwbouw_gereed",
      titel: "Ruwbouw gereed",
      status: "bevestigd",
      verwachtOp: dag("2026-09-10"),
    };

    const regels = maakActielijst(project, [ruwbouw], [keuken], [inmeten], VANDAAG);

    expect(regels[0]?.berekend.zekerheid).toBe("anker_bevestigd");
    expect(regels[0]?.berekend.verwacht).toEqual(dag("2026-09-10"));
  });

  it("negeert een anker dat wel bestaat maar geen datum heeft", () => {
    const leeg: AnkerMetId = {
      id: "k4",
      type: "ruwbouw_gereed",
      titel: "Ruwbouw gereed",
      status: "verwacht",
    };

    const regels = maakActielijst(project, [leeg], [keuken], [inmeten], VANDAAG);
    expect(regels[0]?.berekend.zekerheid).toBe("teruggevallen");
  });

  it("levert niets op zonder opleverband en zonder ankers", () => {
    // Er is dan domweg niets om op te rekenen. Een lege lijst is eerlijker dan
    // een lijst met verzonnen datums.
    const regels = maakActielijst({}, [], [keuken], [inmeten], VANDAAG);
    expect(regels).toHaveLength(0);
  });

  it("laat een partij die je zelf beheert buiten de lijst", () => {
    const handmatig: BetrokkeneMetId = { ...keuken, communicatieregel: "handmatig" };
    const regels = maakActielijst(project, [], [handmatig], [inmeten], VANDAAG);
    expect(regels).toHaveLength(0);
  });

  it("laat een afspraak zonder betrokkene weg in plaats van te crashen", () => {
    const wees: AfspraakMetId = { ...inmeten, id: "a2", betrokkeneId: "bestaat-niet" };
    const regels = maakActielijst(project, [], [keuken], [wees], VANDAAG);
    expect(regels).toHaveLength(0);
  });

  it("zet een afspraak die gelijkloopt niet op de lijst", () => {
    // Berekend en gecommuniceerd zijn gelijk: er valt niets door te geven.
    const gelijk: AfspraakMetId = {
      ...inmeten,
      gecommuniceerdeDatum: dag("2026-11-16"),
    };
    const regels = maakActielijst(project, [], [keuken], [gelijk], VANDAAG);
    expect(regels).toHaveLength(0);
  });

  it("sorteert kritiek boven normaal", () => {
    // De bus staat over drie dagen op de stoep met een datum die niet klopt.
    const bus: BetrokkeneMetId = {
      ...keuken,
      id: "b2",
      naam: "Busverhuur",
      aanlooptijdDagen: 7,
      annuleertermijnDagen: 2,
    };
    const verhuizing: AfspraakMetId = {
      id: "a3",
      betrokkeneId: "b2",
      omschrijving: "Verhuisbus",
      ankerType: "oplevering",
      offsetDagen: 0,
      status: "concept",
      gecommuniceerdeDatum: dag("2026-08-04"),
    };

    const regels = maakActielijst(project, [], [keuken, bus], [inmeten, verhuizing], VANDAAG);

    expect(regels[0]?.betrokkeneNaam).toBe("Busverhuur");
    expect(regels[0]?.urgentie).toBe("kritiek");
    expect(regels[1]?.urgentie).toBe("normaal");
  });
});

describe("telHandmatigeBetrokkenen", () => {
  it("telt alleen de partijen die je zelf benadert", () => {
    const handmatig: BetrokkeneMetId = { ...keuken, id: "b3", communicatieregel: "handmatig" };
    expect(telHandmatigeBetrokkenen([keuken, handmatig])).toBe(1);
  });
});
