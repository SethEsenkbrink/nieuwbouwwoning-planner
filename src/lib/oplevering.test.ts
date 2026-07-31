import { describe, expect, it } from "vitest";
import {
  bepaalOnderhoudstermijn,
  berekenGaranties,
  gebrekstand,
  overMaanden,
  sorteerGebreken,
  telGebreken,
} from "@/lib/oplevering";
import type { GebrekMetId } from "@/lib/converters";
import type { PlanningContext } from "@/lib/planning";

/**
 * De uiterste datum voor het 5%-depot wordt afgeleid (ADR-0012). Zou hij zijn
 * opgeslagen, dan staat hij verkeerd na de eerste verschuiving van de bouw —
 * en het is precies een datum waarvan de gebruiker aanneemt dat de app hem
 * bewaakt.
 */

const dag = (tekst: string) => new Date(`${tekst}T00:00:00.000Z`);
const VANDAAG = dag("2026-08-01");

const alleenOplevering: PlanningContext = {
  ankers: [],
  opleverband: { status: "aangezegd", verwacht: dag("2026-11-16") },
};

const gebrek = (id: string, extra: Partial<GebrekMetId> = {}): GebrekMetId => ({
  id,
  omschrijving: `Punt ${id}`,
  status: "open",
  ...extra,
});

describe("bepaalOnderhoudstermijn", () => {
  it("valt terug op 90 dagen na de oplevering en meldt dat", () => {
    const termijn = bepaalOnderhoudstermijn(alleenOplevering, VANDAAG);
    expect(termijn?.eindigtOp).toEqual(dag("2027-02-14"));
    expect(termijn?.bron).toBe("standaardtermijn");
  });

  it("gebruikt het anker zodra dat is ingevuld", () => {
    const metAnker: PlanningContext = {
      ...alleenOplevering,
      ankers: [
        { type: "einde_onderhoudstermijn", status: "bevestigd", verwachtOp: dag("2027-01-31") },
      ],
    };
    const termijn = bepaalOnderhoudstermijn(metAnker, VANDAAG);
    expect(termijn?.eindigtOp).toEqual(dag("2027-01-31"));
    expect(termijn?.bron).toBe("anker");
  });

  it("schuift mee als de opleverdatum verschuift", () => {
    // Dit is de hele reden dat de datum niet wordt opgeslagen.
    const later: PlanningContext = {
      ankers: [],
      opleverband: { status: "indicatief", verwacht: dag("2026-12-16") },
    };
    expect(bepaalOnderhoudstermijn(later, VANDAAG)?.eindigtOp).toEqual(dag("2027-03-16"));
  });

  it("telt de resterende dagen, negatief als de termijn voorbij is", () => {
    const verstreken: PlanningContext = {
      ankers: [],
      opleverband: { status: "aangezegd", verwacht: dag("2026-01-01") },
    };
    const termijn = bepaalOnderhoudstermijn(verstreken, VANDAAG);
    expect(termijn?.eindigtOp).toEqual(dag("2026-04-01"));
    expect(termijn?.dagenResterend).toBeLessThan(0);
  });

  it("geeft niets terug zonder opleverdatum", () => {
    expect(bepaalOnderhoudstermijn({ ankers: [] }, VANDAAG)).toBeNull();
  });

  it("negeert een anker dat zelf is teruggevallen op de oplevering", () => {
    // Zonder eigen datum levert het anker een terugval op; die telt niet als
    // bron, anders zou "standaardtermijn" nooit worden gemeld.
    const leegAnker: PlanningContext = {
      ...alleenOplevering,
      ankers: [{ type: "einde_onderhoudstermijn", status: "verwacht" }],
    };
    expect(bepaalOnderhoudstermijn(leegAnker, VANDAAG)?.bron).toBe("standaardtermijn");
  });
});

describe("gebrekstand", () => {
  it("noemt een hersteld punt hersteld, ook met een verlopen termijn", () => {
    const punt = gebrek("a", { status: "hersteld", hersteltermijn: dag("2026-01-01") });
    expect(gebrekstand(punt, VANDAAG)).toBe("hersteld");
  });

  it("markeert een verstreken hersteltermijn", () => {
    expect(gebrekstand(gebrek("a", { hersteltermijn: dag("2026-07-31") }), VANDAAG)).toBe(
      "termijn_verlopen",
    );
  });

  it("noemt vandaag nog niet verlopen", () => {
    expect(gebrekstand(gebrek("a", { hersteltermijn: dag("2026-08-01") }), VANDAAG)).toBe("open");
  });

  it("is open zonder hersteltermijn", () => {
    expect(gebrekstand(gebrek("a"), VANDAAG)).toBe("open");
  });
});

describe("sorteerGebreken", () => {
  it("zet verlopen termijnen bovenaan en herstelde punten onderaan", () => {
    const punten = [
      gebrek("hersteld", { status: "hersteld" }),
      gebrek("open"),
      gebrek("verlopen", { hersteltermijn: dag("2026-07-01") }),
    ];
    expect(sorteerGebreken(punten, VANDAAG).map((g) => g.id)).toEqual([
      "verlopen",
      "open",
      "hersteld",
    ]);
  });

  it("laat herstelde punten staan in plaats van ze te verbergen", () => {
    // Ze horen bij het proces-verbaal; bij een geschil wil je ze terug kunnen zien.
    const punten = [gebrek("a", { status: "hersteld" })];
    expect(sorteerGebreken(punten, VANDAAG)).toHaveLength(1);
  });

  it("sorteert binnen dezelfde stand op hersteltermijn", () => {
    const punten = [
      gebrek("b", { hersteltermijn: dag("2026-09-01") }),
      gebrek("a", { hersteltermijn: dag("2026-08-15") }),
    ];
    expect(sorteerGebreken(punten, VANDAAG).map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("laat de oorspronkelijke lijst met rust", () => {
    const punten = [gebrek("b", { hersteltermijn: dag("2026-09-01") }), gebrek("a")];
    sorteerGebreken(punten, VANDAAG);
    expect(punten.map((g) => g.id)).toEqual(["b", "a"]);
  });
});

describe("telGebreken", () => {
  it("telt open, hersteld en verlopen apart", () => {
    const punten = [
      gebrek("1"),
      gebrek("2", { hersteltermijn: dag("2026-07-01") }),
      gebrek("3", { status: "hersteld" }),
    ];
    expect(telGebreken(punten, VANDAAG)).toEqual({
      totaal: 3,
      open: 2,
      hersteld: 1,
      termijnVerlopen: 1,
    });
  });

  it("geeft nullen bij een lege lijst", () => {
    expect(telGebreken([], VANDAAG)).toEqual({
      totaal: 0,
      open: 0,
      hersteld: 0,
      termijnVerlopen: 0,
    });
  });
});

describe("overMaanden", () => {
  it("telt hele maanden op", () => {
    expect(overMaanden(dag("2026-11-16"), 3)).toEqual(dag("2027-02-16"));
    expect(overMaanden(dag("2026-11-16"), 120)).toEqual(dag("2036-11-16"));
  });

  it("klemt op de laatste dag van een kortere maand", () => {
    // De valkuil: `setMonth` maakt hier 3 maart van, want februari heeft geen 31e.
    expect(overMaanden(dag("2026-08-31"), 6)).toEqual(dag("2027-02-28"));
    expect(overMaanden(dag("2026-08-31"), 1)).toEqual(dag("2026-09-30"));
  });

  it("houdt rekening met een schrikkeljaar", () => {
    expect(overMaanden(dag("2027-08-31"), 6)).toEqual(dag("2028-02-29"));
  });
});

describe("berekenGaranties", () => {
  it("rekent alle vier de termijnen vanaf de oplevering", () => {
    const garanties = berekenGaranties(alleenOplevering, VANDAAG);
    expect(garanties?.map((g) => g.sleutel)).toEqual([
      "onderhoud",
      "kort",
      "algemeen",
      "constructief",
    ]);
    expect(garanties?.[0]?.verstrijktOp).toEqual(dag("2027-02-16"));
    expect(garanties?.[3]?.verstrijktOp).toEqual(dag("2036-11-16"));
  });

  it("markeert een termijn die binnen drie maanden afloopt", () => {
    // Oplevering 1 mei 2026 → onderhoudstermijn tot 1 augustus 2026, en
    // vandaag is 1 augustus: precies op de grens, dus nog niet verstreken.
    const context: PlanningContext = {
      ankers: [],
      opleverband: { status: "aangezegd", verwacht: dag("2026-05-01") },
    };
    const onderhoud = berekenGaranties(context, VANDAAG)?.[0];
    expect(onderhoud?.dagenResterend).toBe(0);
    expect(onderhoud?.bijnaVoorbij).toBe(true);
  });

  it("noemt een verstreken termijn niet bijna voorbij", () => {
    const context: PlanningContext = {
      ankers: [],
      opleverband: { status: "aangezegd", verwacht: dag("2020-01-01") },
    };
    const onderhoud = berekenGaranties(context, VANDAAG)?.[0];
    expect(onderhoud?.dagenResterend).toBeLessThan(0);
    expect(onderhoud?.bijnaVoorbij).toBe(false);
  });

  it("geeft niets terug zonder opleverdatum", () => {
    expect(berekenGaranties({ ankers: [] }, VANDAAG)).toBeNull();
  });
});
