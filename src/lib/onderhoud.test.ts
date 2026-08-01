import { describe, expect, it } from "vitest";
import {
  berekenVolgendeOnderhoud,
  maakOnderhoudslijst,
  naarMaand,
  takenZonderStartpunt,
  telOnderhoud,
  toonInterval,
  toonMaand,
} from "@/lib/onderhoud";
import type { OnderdeelMetId, OnderhoudTaakMetId } from "@/lib/converters";

const VANDAAG = new Date(Date.UTC(2026, 7, 1)); // 1 augustus 2026
const d = (jaar: number, maand: number, dag: number) => new Date(Date.UTC(jaar, maand - 1, dag));

function taak(velden: Partial<OnderhoudTaakMetId> = {}): OnderhoudTaakMetId {
  return {
    id: velden.id ?? "t1",
    titel: "WTW-filters vervangen",
    intervalDagen: 182,
    waardenBron: "voorstel",
    ...velden,
  };
}

/**
 * Voor tests die met de uitkomst dóórrekenen. Een cast of een `!` zou hier een
 * ontbrekende stand stil doorlaten en pas verderop een onbegrijpelijke fout
 * geven; dit faalt op de plek waar het misgaat, met een leesbare melding.
 */
function moetLukken<T>(waarde: T | null | undefined, wat: string): T {
  if (waarde === null || waarde === undefined) {
    throw new Error(`verwachtte ${wat}, maar kreeg niets`);
  }
  return waarde;
}

function onderdeel(velden: Partial<OnderdeelMetId> = {}): OnderdeelMetId {
  return {
    id: velden.id ?? "o1",
    naam: "WTW-unit",
    categorie: "ventilatie",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    ...velden,
  };
}

describe("naarMaand", () => {
  /**
   * De kern van ADR-0014 §1: de DICHTSTBIJZIJNDE voorkomen, niet de
   * eerstvolgende erna. Anders levert één keer verkeerd afvinken negentien
   * maanden zonder beurt op, en plant die fout zich voort.
   */
  it("kiest de voorkomen ervóór als die dichterbij ligt", () => {
    // Maart 2027 → oktober 2026 (5 mnd terug) wint van oktober 2027 (7 mnd vooruit).
    expect(naarMaand(d(2027, 3, 15), 10)).toEqual(d(2026, 10, 15));
  });

  it("kiest de voorkomen erna als die dichterbij ligt", () => {
    // Augustus 2026 → oktober 2026 (2 mnd vooruit) wint van oktober 2025.
    expect(naarMaand(d(2026, 8, 15), 10)).toEqual(d(2026, 10, 15));
  });

  it("laat een datum die al in de doelmaand valt ongemoeid", () => {
    expect(naarMaand(d(2026, 10, 15), 10)).toEqual(d(2026, 10, 15));
  });

  it("behoudt de dag van de maand", () => {
    expect(naarMaand(d(2026, 8, 3), 10)).toEqual(d(2026, 10, 3));
  });

  /** Dezelfde maandlengte-valkuil die `overMaanden()` afvangt. */
  it("klemt op de laatste dag van een kortere doelmaand", () => {
    // 31 januari 2026 → februari 2026 heeft 28 dagen.
    expect(naarMaand(d(2026, 1, 31), 2)).toEqual(d(2026, 2, 28));
  });

  it("klemt correct in een schrikkeljaar", () => {
    expect(naarMaand(d(2028, 1, 31), 2)).toEqual(d(2028, 2, 29));
  });

  it("werkt over de jaargrens heen", () => {
    // Januari 2027 → december 2026 (1 mnd terug) wint van december 2027.
    expect(naarMaand(d(2027, 1, 10), 12)).toEqual(d(2026, 12, 10));
  });

  /**
   * De ondergrens. Zonder `nietVoor` kiest de functie hier oktober 2026 — de
   * vroegste van twee bijna even ver liggende kandidaten — en dat is precies de
   * dag van de laatste beurt. Met de ondergrens valt die kandidaat af.
   */
  it("kiest geen kandidaat op of vóór de ondergrens", () => {
    expect(naarMaand(d(2027, 4, 15), 10)).toEqual(d(2026, 10, 15));
    expect(naarMaand(d(2027, 4, 15), 10, d(2026, 10, 15))).toEqual(d(2027, 10, 15));
  });

  it("negeert de ondergrens als de dichtstbijzijnde er al na ligt", () => {
    expect(naarMaand(d(2026, 8, 15), 10, d(2026, 1, 1))).toEqual(d(2026, 10, 15));
  });
});

describe("berekenVolgendeOnderhoud — startpunt", () => {
  it("geeft null zonder enig startpunt", () => {
    expect(berekenVolgendeOnderhoud(taak(), {}, VANDAAG)).toBeNull();
  });

  it("rekent vanaf de laatste uitvoering als die er is", () => {
    const stand = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2026, 6, 1), intervalDagen: 182 }),
      { opleverdatum: d(2026, 1, 1) },
      VANDAAG,
    );
    expect(stand?.bron).toBe("uitgevoerd");
    expect(stand?.gerekendVanaf).toEqual(d(2026, 6, 1));
    expect(stand?.volgendeOp).toEqual(d(2026, 11, 30));
  });

  it("valt terug op de installatiedatum van het onderdeel", () => {
    const stand = berekenVolgendeOnderhoud(
      taak({ intervalDagen: 365 }),
      { onderdeel: onderdeel({ installatieDatum: d(2026, 3, 1) }), opleverdatum: d(2026, 1, 1) },
      VANDAAG,
    );
    expect(stand?.bron).toBe("installatie");
    expect(stand?.gerekendVanaf).toEqual(d(2026, 3, 1));
  });

  it("valt als laatste terug op de opleverdatum", () => {
    const stand = berekenVolgendeOnderhoud(
      taak({ intervalDagen: 365 }),
      { opleverdatum: d(2026, 1, 15) },
      VANDAAG,
    );
    expect(stand?.bron).toBe("oplevering");
    expect(stand?.gerekendVanaf).toEqual(d(2026, 1, 15));
  });

  /**
   * De volgorde is niet willekeurig: een echte beurt is betrouwbaarder dan een
   * installatiedatum, en die weer betrouwbaarder dan de opleverdatum. De UI
   * toont die bron, zodat een aanname niet als feit overkomt (ADR-0009).
   */
  it("laat een echte beurt zwaarder wegen dan de installatiedatum", () => {
    const stand = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2026, 6, 1) }),
      { onderdeel: onderdeel({ installatieDatum: d(2026, 3, 1) }) },
      VANDAAG,
    );
    expect(stand?.bron).toBe("uitgevoerd");
  });

  it("negeert een onderdeel zonder installatiedatum", () => {
    const stand = berekenVolgendeOnderhoud(
      taak(),
      { onderdeel: onderdeel(), opleverdatum: d(2026, 1, 1) },
      VANDAAG,
    );
    expect(stand?.bron).toBe("oplevering");
  });
});

describe("berekenVolgendeOnderhoud — urgentie", () => {
  it("markeert achterstallig onderhoud", () => {
    const stand = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2025, 1, 1), intervalDagen: 365 }),
      {},
      VANDAAG,
    );
    expect(stand?.urgentie).toBe("achterstallig");
    expect(stand?.dagenResterend).toBeLessThan(0);
  });

  it("markeert een beurt die vandaag valt als nu", () => {
    // 1 augustus 2026 min 182 dagen = 31 januari 2026.
    const stand = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2026, 1, 31), intervalDagen: 182 }),
      {},
      VANDAAG,
    );
    expect(stand?.dagenResterend).toBe(0);
    expect(stand?.urgentie).toBe("nu");
  });

  it("markeert een beurt binnen 30 dagen als binnenkort", () => {
    const stand = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2026, 2, 15), intervalDagen: 182 }),
      {},
      VANDAAG,
    );
    expect(stand?.dagenResterend).toBe(15);
    expect(stand?.urgentie).toBe("binnenkort");
  });

  it("noemt de rest later", () => {
    const stand = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2026, 7, 1), intervalDagen: 365 }),
      {},
      VANDAAG,
    );
    expect(stand?.urgentie).toBe("later");
  });
});

describe("berekenVolgendeOnderhoud — voorkeursmaand", () => {
  /**
   * Het scenario uit ADR-0014: goten voor het laatst gedaan in maart, interval
   * een jaar. Zonder correctie zou de volgende beurt in maart vallen — precies
   * de verkeerde maand, en die fout plant zich voort bij elke beurt.
   */
  it("verschuift dakgotenwerk naar het najaar", () => {
    const zonder = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2026, 3, 15), intervalDagen: 365 }),
      {},
      VANDAAG,
    );
    expect(zonder?.volgendeOp).toEqual(d(2027, 3, 15));
    expect(zonder?.verschovenNaarMaand).toBe(false);

    const met = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2026, 3, 15), intervalDagen: 365, voorkeursmaand: 10 }),
      {},
      VANDAAG,
    );
    // Oktober 2026 ligt vijf maanden vóór maart 2027; oktober 2027 zeven
    // maanden erna. De dichtstbijzijnde wint, dus de goten schuiven naar voren
    // in plaats van negentien maanden te wachten.
    expect(met?.volgendeOp).toEqual(d(2026, 10, 15));
    expect(met?.verschovenNaarMaand).toBe(true);
  });

  it("laat de datum staan als hij al in de voorkeursmaand valt", () => {
    const stand = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2025, 10, 15), intervalDagen: 365, voorkeursmaand: 10 }),
      {},
      VANDAAG,
    );
    expect(stand?.volgendeOp).toEqual(d(2026, 10, 15));
    expect(stand?.verschovenNaarMaand).toBe(false);
  });

  it("houdt de reeks stabiel over meerdere beurten", () => {
    // Eenmaal gecorrigeerd naar oktober blijft hij in oktober.
    const eerste = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2026, 3, 15), intervalDagen: 365, voorkeursmaand: 10 }),
      {},
      VANDAAG,
    );
    const tweede = berekenVolgendeOnderhoud(
      taak({
        laatstUitgevoerdOp: moetLukken(eerste, "een eerste stand").volgendeOp,
        intervalDagen: 365,
        voorkeursmaand: 10,
      }),
      {},
      VANDAAG,
    );
    expect(tweede?.volgendeOp.getUTCMonth()).toBe(9); // oktober
    expect(tweede?.volgendeOp.getUTCFullYear()).toBe(2027);
  });

  /**
   * REGRESSIETEST — gevonden bij de verificatiepass van sessie 06.
   *
   * Een interval korter dan een jaar kan de correctie naar het verleden laten
   * schuiven. Zonder ondergrens landt deze taak op 15 oktober 2026: de dag van
   * de beurt zelf. De taak zou dan meteen achterstallig zijn en dat blijven,
   * want elke keer afvinken levert dezelfde datum op.
   */
  it("schuift nooit tot op of vóór de laatste beurt", () => {
    const stand = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2026, 10, 15), intervalDagen: 182, voorkeursmaand: 10 }),
      {},
      VANDAAG,
    );
    expect(stand?.volgendeOp).toEqual(d(2027, 10, 15));
    expect(stand?.volgendeOp.getTime()).toBeGreaterThan(d(2026, 10, 15).getTime());
  });

  /** Bij een maandelijks interval liep de reeks zelfs achteruit. */
  it("laat een kort interval met voorkeursmaand niet achteruit lopen", () => {
    let laatst = d(2026, 10, 15);
    for (let i = 0; i < 4; i += 1) {
      const stand = berekenVolgendeOnderhoud(
        taak({ laatstUitgevoerdOp: laatst, intervalDagen: 30, voorkeursmaand: 10 }),
        {},
        VANDAAG,
      );
      const volgende = moetLukken(stand, `een stand in ronde ${i + 1}`).volgendeOp;
      expect(volgende.getTime()).toBeGreaterThan(laatst.getTime());
      laatst = volgende;
    }
  });

  it("werkt ook op een meerjarig interval", () => {
    const stand = berekenVolgendeOnderhoud(
      taak({ laatstUitgevoerdOp: d(2026, 5, 1), intervalDagen: 1825, voorkeursmaand: 6 }),
      {},
      VANDAAG,
    );
    expect(stand?.volgendeOp.getUTCMonth()).toBe(5); // juni
    expect(stand?.volgendeOp.getUTCFullYear()).toBe(2031);
  });
});

describe("maakOnderhoudslijst", () => {
  const opgelopen = taak({
    id: "achterstallig",
    titel: "Zout bijvullen",
    intervalDagen: 30,
    laatstUitgevoerdOp: d(2026, 1, 1),
  });
  const komt = taak({
    id: "binnenkort",
    titel: "Filters vervangen",
    intervalDagen: 182,
    laatstUitgevoerdOp: d(2026, 2, 15),
  });
  const later = taak({
    id: "later",
    titel: "Cv-onderhoud",
    intervalDagen: 365,
    laatstUitgevoerdOp: d(2026, 7, 1),
  });
  const geenStartpunt = taak({ id: "onbekend", titel: "Dakgoot" });

  it("sorteert op urgentie en dan op datum", () => {
    const lijst = maakOnderhoudslijst([later, komt, opgelopen], [], undefined, VANDAAG);
    expect(lijst.map((r) => r.taak.id)).toEqual(["achterstallig", "binnenkort", "later"]);
  });

  it("laat taken zonder startpunt weg uit de lijst", () => {
    const lijst = maakOnderhoudslijst([komt, geenStartpunt], [], undefined, VANDAAG);
    expect(lijst.map((r) => r.taak.id)).toEqual(["binnenkort"]);
  });

  it("geeft die taken apart terug zodat ze niet stil verdwijnen", () => {
    const zonder = takenZonderStartpunt([komt, geenStartpunt], [], undefined, VANDAAG);
    expect(zonder.map((t) => t.id)).toEqual(["onbekend"]);
  });

  it("koppelt de naam van het onderdeel mee", () => {
    const metOnderdeel = taak({ id: "gekoppeld", onderdeelId: "o1", laatstUitgevoerdOp: VANDAAG });
    const lijst = maakOnderhoudslijst([metOnderdeel], [onderdeel()], undefined, VANDAAG);
    expect(lijst[0]?.onderdeelNaam).toBe("WTW-unit");
  });

  it("laat de invoerlijst ongemoeid", () => {
    const invoer = [later, opgelopen];
    maakOnderhoudslijst(invoer, [], undefined, VANDAAG);
    expect(invoer.map((t) => t.id)).toEqual(["later", "achterstallig"]);
  });

  it("telt de standen, inclusief wat niet te berekenen is", () => {
    const stand = telOnderhoud([opgelopen, komt, later, geenStartpunt], [], undefined, VANDAAG);
    expect(stand).toEqual({ totaal: 4, achterstallig: 1, binnenkort: 1, onbekend: 1 });
  });
});

describe("toonInterval", () => {
  it("vertaalt gangbare intervallen naar woorden", () => {
    expect(toonInterval(30)).toBe("maandelijks");
    expect(toonInterval(90)).toBe("per kwartaal");
    expect(toonInterval(182)).toBe("halfjaarlijks");
    expect(toonInterval(365)).toBe("jaarlijks");
    expect(toonInterval(730)).toBe("elke 2 jaar");
    expect(toonInterval(3650)).toBe("elke 10 jaar");
  });

  it("valt terug op maanden, weken en dagen", () => {
    expect(toonInterval(60)).toBe("elke 2 maanden");
    expect(toonInterval(7)).toBe("wekelijks");
    expect(toonInterval(14)).toBe("elke 2 weken");
    expect(toonInterval(45)).toBe("elke 45 dagen");
  });
});

describe("toonMaand", () => {
  it("geeft de Nederlandse maandnaam", () => {
    expect(toonMaand(1)).toBe("januari");
    expect(toonMaand(10)).toBe("oktober");
    expect(toonMaand(12)).toBe("december");
  });

  it("geeft undefined buiten 1–12", () => {
    expect(toonMaand(undefined)).toBeUndefined();
    expect(toonMaand(0)).toBeUndefined();
    expect(toonMaand(13)).toBeUndefined();
  });
});
