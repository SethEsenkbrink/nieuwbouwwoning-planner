import { describe, expect, it } from "vitest";
import { sorteerTaken, taakUrgentie, telTaken, toonTermijn } from "@/lib/taken";
import type { TaakMetId } from "@/lib/converters";

/**
 * Een takenlijst die op aanmaakdatum staat, laat verlopen taken onderaan
 * verdwijnen — en precies die wil je zien. Deze tests bewaken die volgorde, en
 * de grens tussen "vandaag" en "te laat", want daar zit de eenvoudigste fout:
 * een taak die vandaag moet, is niet verlopen.
 */

const dag = (tekst: string) => new Date(`${tekst}T00:00:00.000Z`);
const VANDAAG = dag("2026-08-01");

const taak = (id: string, extra: Partial<TaakMetId> = {}): TaakMetId => ({
  id,
  titel: `Taak ${id}`,
  status: "open",
  bron: "handmatig",
  ...extra,
});

describe("taakUrgentie", () => {
  it("noemt een deadline van gisteren verlopen", () => {
    expect(taakUrgentie(taak("a", { deadline: dag("2026-07-31") }), VANDAAG)).toBe("verlopen");
  });

  it("noemt vandaag niet verlopen", () => {
    expect(taakUrgentie(taak("a", { deadline: dag("2026-08-01") }), VANDAAG)).toBe("vandaag");
  });

  it("noemt zeven dagen nog binnenkort en acht dagen later", () => {
    expect(taakUrgentie(taak("a", { deadline: dag("2026-08-08") }), VANDAAG)).toBe("binnenkort");
    expect(taakUrgentie(taak("a", { deadline: dag("2026-08-09") }), VANDAAG)).toBe("later");
  });

  it("kent een taak zonder deadline apart", () => {
    expect(taakUrgentie(taak("a"), VANDAAG)).toBe("geendatum");
  });

  it("laat een afgevinkte taak nooit verlopen zijn", () => {
    const klaar = taak("a", { status: "klaar", deadline: dag("2020-01-01") });
    expect(taakUrgentie(klaar, VANDAAG)).toBe("klaar");
  });
});

describe("sorteerTaken", () => {
  it("zet verlopen bovenaan en afgevinkt onderaan", () => {
    const taken = [
      taak("later", { deadline: dag("2026-12-01") }),
      taak("klaar", { status: "klaar" }),
      taak("verlopen", { deadline: dag("2026-07-20") }),
      taak("vandaag", { deadline: dag("2026-08-01") }),
    ];
    expect(sorteerTaken(taken, VANDAAG).map((t) => t.id)).toEqual([
      "verlopen",
      "vandaag",
      "later",
      "klaar",
    ]);
  });

  it("sorteert binnen dezelfde groep op deadline", () => {
    const taken = [
      taak("b", { deadline: dag("2026-07-30") }),
      taak("a", { deadline: dag("2026-07-25") }),
    ];
    expect(sorteerTaken(taken, VANDAAG).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("zet taken zonder deadline achter die mét", () => {
    const taken = [taak("zonder"), taak("met", { deadline: dag("2026-12-01") })];
    expect(sorteerTaken(taken, VANDAAG).map((t) => t.id)).toEqual(["met", "zonder"]);
  });

  it("sorteert taken zonder deadline alfabetisch", () => {
    const taken = [taak("b", { titel: "Zonnescherm" }), taak("a", { titel: "Aanrecht" })];
    expect(sorteerTaken(taken, VANDAAG).map((t) => t.titel)).toEqual(["Aanrecht", "Zonnescherm"]);
  });

  it("laat de oorspronkelijke lijst met rust", () => {
    const taken = [taak("b", { deadline: dag("2026-12-01") }), taak("a")];
    sorteerTaken(taken, VANDAAG);
    expect(taken.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("telTaken", () => {
  it("telt open, verlopen, deze week en klaar apart", () => {
    const taken = [
      taak("1", { deadline: dag("2026-07-20") }),
      taak("2", { deadline: dag("2026-08-03") }),
      taak("3", { deadline: dag("2026-12-01") }),
      taak("4"),
      taak("5", { status: "klaar" }),
    ];
    expect(telTaken(taken, VANDAAG)).toEqual({ open: 4, verlopen: 1, dezeWeek: 1, klaar: 1 });
  });
});

describe("toonTermijn", () => {
  it("zegt vandaag zonder getal", () => {
    expect(toonTermijn(taak("a", { deadline: dag("2026-08-01") }), VANDAAG)).toBe("vandaag");
  });

  it("telt te laat in hele dagen", () => {
    expect(toonTermijn(taak("a", { deadline: dag("2026-07-30") }), VANDAAG)).toBe("2 dagen te laat");
    expect(toonTermijn(taak("a", { deadline: dag("2026-07-31") }), VANDAAG)).toBe("1 dag te laat");
  });

  it("telt vooruit in hele dagen", () => {
    expect(toonTermijn(taak("a", { deadline: dag("2026-08-02") }), VANDAAG)).toBe("over 1 dag");
    expect(toonTermijn(taak("a", { deadline: dag("2026-08-05") }), VANDAAG)).toBe("over 4 dagen");
  });

  it("zegt niets bij een afgevinkte taak of zonder deadline", () => {
    expect(toonTermijn(taak("a"), VANDAAG)).toBeNull();
    expect(toonTermijn(taak("a", { status: "klaar", deadline: dag("2026-08-05") }), VANDAAG)).toBeNull();
  });
});
