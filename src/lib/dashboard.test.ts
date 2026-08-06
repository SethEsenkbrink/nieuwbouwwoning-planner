import { describe, expect, it } from "vitest";
import {
  ankerIndex,
  depotCijfer,
  maakBouwvoortgang,
  meerwerkCijfer,
  splitsOpAandacht,
  type AnkerStand,
} from "./dashboard";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const NU = d("2026-08-02");

describe("maakBouwvoortgang", () => {
  it("telt zeven momenten — de oplevering hoort er niet bij", () => {
    const voortgang = maakBouwvoortgang([], NU);
    expect(voortgang.totaal).toBe(7);
    expect(voortgang.momenten.map((m) => m.type)).not.toContain("oplevering");
  });

  it("zet alles op onbekend zonder ankers", () => {
    const voortgang = maakBouwvoortgang([], NU);
    expect(voortgang.gepasseerd).toBe(0);
    expect(voortgang.bekend).toBe(0);
    expect(voortgang.laatstGepasseerd).toBeUndefined();
    expect(voortgang.volgende).toBeUndefined();
  });

  it("onderscheidt gepasseerd, bekend en onbekend", () => {
    const ankers: AnkerStand[] = [
      { type: "start_bouw", status: "gepasseerd", verwachtOp: d("2026-01-15") },
      { type: "ruwbouw_gereed", status: "verwacht", verwachtOp: d("2026-09-01") },
    ];
    const voortgang = maakBouwvoortgang(ankers, NU);

    expect(voortgang.gepasseerd).toBe(1);
    expect(voortgang.bekend).toBe(1);
    expect(voortgang.momenten.find((m) => m.type === "wind_waterdicht")?.stand).toBe("onbekend");
  });

  /**
   * Dit is wat de fasekeuze uit de wizard (blok W1) gaat invullen: je weet dát
   * de ruwbouw staat, maar niet meer op welke dag. Zonder deze regel zou zo'n
   * moment als "onbekend" tellen en bleef de balk leeg bij een woning die er
   * al staat.
   */
  it("telt een gepasseerd moment zonder datum toch als gepasseerd", () => {
    const voortgang = maakBouwvoortgang([{ type: "start_bouw", status: "gepasseerd" }], NU);
    expect(voortgang.gepasseerd).toBe(1);
    expect(voortgang.momenten[0]?.datum).toBeUndefined();
  });

  /**
   * Zonder deze regel blijft de balk staan op de dag dat de gebruiker hem voor
   * het laatst bijwerkte. Een datum die verstreken is, is verstreken — ook als
   * niemand de status heeft omgezet.
   */
  it("telt een verstreken datum als gepasseerd, ook bij status verwacht", () => {
    const voortgang = maakBouwvoortgang(
      [{ type: "start_bouw", status: "verwacht", verwachtOp: d("2026-01-15") }],
      NU,
    );
    expect(voortgang.gepasseerd).toBe(1);
  });

  it("laat een datum van vandaag nog niet als gepasseerd tellen", () => {
    const voortgang = maakBouwvoortgang(
      [{ type: "start_bouw", status: "verwacht", verwachtOp: NU }],
      NU,
    );
    expect(voortgang.gepasseerd).toBe(0);
    expect(voortgang.bekend).toBe(1);
  });

  it("wijst het laatste gepasseerde moment aan als 'waar staan we'", () => {
    const ankers: AnkerStand[] = [
      { type: "start_bouw", status: "gepasseerd" },
      { type: "begane_grond_gestort", status: "gepasseerd" },
      { type: "ruwbouw_gereed", status: "gepasseerd" },
    ];
    expect(maakBouwvoortgang(ankers, NU).laatstGepasseerd?.type).toBe("ruwbouw_gereed");
  });

  /** De volgorde volgt `ANKER_VOLGORDE`, niet de volgorde van de invoer. */
  it("houdt de chronologische volgorde aan, ook bij omgekeerde invoer", () => {
    const ankers: AnkerStand[] = [
      { type: "dekvloer_gestort", status: "gepasseerd" },
      { type: "start_bouw", status: "gepasseerd" },
    ];
    const voortgang = maakBouwvoortgang(ankers, NU);
    expect(voortgang.laatstGepasseerd?.type).toBe("dekvloer_gestort");
    expect(voortgang.momenten[0]?.type).toBe("start_bouw");
  });

  it("wijst het eerstvolgende bekende moment aan", () => {
    const ankers: AnkerStand[] = [
      { type: "start_bouw", status: "gepasseerd" },
      { type: "dekvloer_gestort", status: "verwacht", verwachtOp: d("2026-11-01") },
      { type: "ruwbouw_gereed", status: "verwacht", verwachtOp: d("2026-09-01") },
    ];
    expect(maakBouwvoortgang(ankers, NU).volgende?.type).toBe("ruwbouw_gereed");
  });
});

describe("ankerIndex", () => {
  it("geeft de chronologische positie", () => {
    expect(ankerIndex("start_bouw")).toBe(0);
    expect(ankerIndex("start_bouw")).toBeLessThan(ankerIndex("oplevering"));
    expect(ankerIndex("oplevering")).toBeLessThan(ankerIndex("sleuteloverdracht"));
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * "Niets ingevuld" is niet hetzelfde als "nul"
 *
 * Het oude dashboard toonde `€ 0` bij een leeg meerwerkbudget. Dat leest als
 * een kapotte app in plaats van als een leeg veld, en het was de tweede
 * opmerking in de live test van 2 augustus.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("meerwerkCijfer", () => {
  it("is niet ingevuld zonder budget en zonder meerwerk", () => {
    expect(meerwerkCijfer({ vastgelegd: 0 }).ingevuld).toBe(false);
  });

  it("is wél ingevuld zodra er meerwerk is, ook zonder budget", () => {
    const cijfer = meerwerkCijfer({ vastgelegd: 8000 });
    expect(cijfer.ingevuld).toBe(true);
    expect(cijfer.van).toBeUndefined();
  });

  it("is wél ingevuld zodra er een budget is, ook zonder meerwerk", () => {
    const cijfer = meerwerkCijfer({ vastgelegd: 0, budget: 15000, ruimte: 15000 });
    expect(cijfer.ingevuld).toBe(true);
    expect(cijfer.van).toBe(15000);
  });

  it("slaat alarm boven het budget", () => {
    expect(meerwerkCijfer({ vastgelegd: 18000, budget: 15000, ruimte: -3000 }).alarm).toBe(true);
  });

  /** Zonder budget weet de app niet of € 8.000 veel is. Dat is geen alarm. */
  it("slaat geen alarm zonder budget", () => {
    expect(meerwerkCijfer({ vastgelegd: 80000 }).alarm).toBe(false);
  });

  it("slaat geen alarm bij precies op het budget", () => {
    expect(meerwerkCijfer({ vastgelegd: 15000, budget: 15000, ruimte: 0 }).alarm).toBe(false);
  });
});

describe("depotCijfer", () => {
  it("is niet ingevuld zonder depotbedrag en zonder betaalde termijn", () => {
    expect(depotCijfer({ betaald: 0, aantalTeDeclareren: 0 }, undefined).ingevuld).toBe(false);
  });

  it("zet het betaalde bedrag af tegen het depot", () => {
    const cijfer = depotCijfer({ betaald: 120000, aantalTeDeclareren: 0 }, 280000);
    expect(cijfer.waarde).toBe(120000);
    expect(cijfer.van).toBe(280000);
  });

  /**
   * Wachten op de bank is geen werk; een factuur die nog niet is ingediend
   * wel. Dat is het enige punt in het depotproces waar de gebruiker zelf aan
   * zet is, en dus het enige dat de tegel mag laten oplichten.
   */
  it("slaat alarm bij een factuur die nog niet is ingediend", () => {
    expect(depotCijfer({ betaald: 0, aantalTeDeclareren: 2 }, 280000).alarm).toBe(true);
    expect(depotCijfer({ betaald: 0, aantalTeDeclareren: 0 }, 280000).alarm).toBe(false);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Veertien regels waarvan er twaalf kunnen wachten, is geen werklijst
 *
 * Precies wat er bij de live test van 2 augustus op het dashboard stond. De
 * splitsing heeft twee ingangen omdat urgentie en tijd niet hetzelfde zijn.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("splitsOpAandacht", () => {
  const regel = (urgentie: string, datum?: string) => ({
    urgentie,
    ...(datum === undefined ? {} : { datum: d(datum) }),
  });

  it("zet urgente regels bovenaan, ook als de datum ver weg is", () => {
    // De keuken met tien weken aanlooptijd: nú bellen, juist omdat het pas
    // over drie maanden gebeurt.
    const { nu, later } = splitsOpAandacht([regel("hoog", "2026-12-01")], NU);
    expect(nu).toHaveLength(1);
    expect(later).toHaveLength(0);
  });

  it("zet kritiek altijd bovenaan", () => {
    expect(splitsOpAandacht([regel("kritiek", "2027-06-01")], NU).nu).toHaveLength(1);
  });

  it("zet wat binnen dertig dagen speelt bovenaan, ook bij lage urgentie", () => {
    const { nu } = splitsOpAandacht([regel("normaal", "2026-08-20")], NU);
    expect(nu).toHaveLength(1);
  });

  it("laat een niet-urgente regel ver weg wachten", () => {
    const { nu, later } = splitsOpAandacht([regel("normaal", "2026-12-01")], NU);
    expect(nu).toHaveLength(0);
    expect(later).toHaveLength(1);
  });

  /** Een verstreken datum is niet "voorbij", die is te laat. */
  it("zet een verstreken datum bovenaan", () => {
    expect(splitsOpAandacht([regel("normaal", "2026-07-01")], NU).nu).toHaveLength(1);
  });

  it("zet de grens op precies dertig dagen", () => {
    expect(splitsOpAandacht([regel("normaal", "2026-09-01")], NU).nu).toHaveLength(1);
    expect(splitsOpAandacht([regel("normaal", "2026-09-02")], NU).later).toHaveLength(1);
  });

  /**
   * Zonder datum valt er niets te plannen, en de regel zou anders elke dag
   * bovenaan blijven staan zonder dat er iets verandert.
   */
  it("laat een regel zonder datum wachten, tenzij hij urgent is", () => {
    expect(splitsOpAandacht([regel("normaal")], NU).later).toHaveLength(1);
    expect(splitsOpAandacht([regel("hoog")], NU).nu).toHaveLength(1);
  });

  it("houdt de volgorde binnen elke groep aan", () => {
    const regels = [regel("normaal", "2026-12-01"), regel("hoog", "2026-12-05"), regel("normaal", "2026-11-01")];
    const { nu, later } = splitsOpAandacht(regels, NU);
    expect(nu).toHaveLength(1);
    expect(later.map((r) => r.datum)).toEqual([d("2026-12-01"), d("2026-11-01")]);
  });

  it("respecteert een eigen venster", () => {
    expect(splitsOpAandacht([regel("normaal", "2026-08-20")], NU, 7).later).toHaveLength(1);
    expect(splitsOpAandacht([regel("normaal", "2026-08-20")], NU, 90).nu).toHaveLength(1);
  });

  it("geeft twee lege lijsten bij lege invoer", () => {
    const { nu, later } = splitsOpAandacht([], NU);
    expect(nu).toHaveLength(0);
    expect(later).toHaveLength(0);
  });
});
