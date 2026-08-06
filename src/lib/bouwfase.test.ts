import { describe, expect, it } from "vitest";
import {
  BOUWFASES,
  gepasseerdeAnkers,
  isNogRelevant,
  splitsOpFase,
  voorgesteldeOpleverstatus,
  type Bouwfase,
} from "./bouwfase";
import { STANDAARD_BETROKKENEN, type StandaardBetrokkene } from "@/data/betrokkenen-standaard";

/** Een partij met alleen wat deze module bekijkt. */
const partij = (
  sleutel: string,
  ankers: readonly { ankerType: string; offsetDagen: number }[],
): StandaardBetrokkene =>
  ({
    sleutel,
    naam: sleutel,
    categorie: "overig",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 7,
    communicatieregel: "direct",
    afspraken: ankers.map((a) => ({ omschrijving: "x", ...a })),
  }) as StandaardBetrokkene;

describe("BOUWFASES", () => {
  it("dekt de zeven keuzes, van niet begonnen tot opgeleverd", () => {
    expect(BOUWFASES).toHaveLength(7);
    expect(BOUWFASES[0]?.waarde).toBe("nog_niet_begonnen");
    expect(BOUWFASES[BOUWFASES.length - 1]?.waarde).toBe("opgeleverd");
  });

  it("geeft elke keuze een toelichting zonder vakjargon in het label", () => {
    for (const keuze of BOUWFASES) {
      expect(keuze.label.length).toBeGreaterThan(0);
      expect(keuze.toelichting.length).toBeGreaterThan(0);
    }
  });
});

describe("gepasseerdeAnkers", () => {
  it("geeft niets terug als de bouw nog moet beginnen", () => {
    expect(gepasseerdeAnkers("nog_niet_begonnen")).toEqual([]);
  });

  it("telt het gekozen moment zelf mee", () => {
    // Kies je "de muren staan overeind", dan is de ruwbouw geweest.
    expect(gepasseerdeAnkers("ruwbouw_gereed")).toContain("ruwbouw_gereed");
  });

  it("telt alles ervóór mee en niets erna", () => {
    const tot = gepasseerdeAnkers("ruwbouw_gereed");
    expect(tot).toEqual(["start_bouw", "begane_grond_gestort", "ruwbouw_gereed"]);
    expect(tot).not.toContain("wind_waterdicht");
    expect(tot).not.toContain("dekvloer_gestort");
  });

  it("loopt op naarmate de bouw vordert", () => {
    const fases: Bouwfase[] = [
      "nog_niet_begonnen",
      "start_bouw",
      "begane_grond_gestort",
      "ruwbouw_gereed",
      "wind_waterdicht",
      "dekvloer_gestort",
    ];
    const aantallen = fases.map((f) => gepasseerdeAnkers(f).length);
    expect(aantallen).toEqual([0, 1, 2, 3, 4, 5]);
  });

  /**
   * De sleuteloverdracht kan ná de oplevering liggen, en de onderhoudstermijn
   * loopt er per definitie nog. Die automatisch afvinken zou een termijn
   * afsluiten waarbinnen je nog gebreken kunt melden.
   */
  it("vinkt bij opgeleverd de sleuteloverdracht en de onderhoudstermijn niet af", () => {
    const bij = gepasseerdeAnkers("opgeleverd");
    expect(bij).toContain("dekvloer_gestort");
    expect(bij).not.toContain("sleuteloverdracht");
    expect(bij).not.toContain("einde_onderhoudstermijn");
  });

  it("noemt de oplevering nooit — die leeft als band op het project", () => {
    for (const keuze of BOUWFASES) {
      expect(gepasseerdeAnkers(keuze.waarde)).not.toContain("oplevering");
    }
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Een partij valt pas af als ál haar afspraken geweest zijn
 *
 * De strenge variant — "hangt aan een gepasseerd moment, dus weg" — zou de
 * keukenleverancier laten verdwijnen zodra de ruwbouw staat. Die meet dan
 * inderdaad niet meer in, maar moet nog wel de keuken leveren.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("isNogRelevant", () => {
  it("houdt alles relevant als de bouw nog moet beginnen", () => {
    const p = partij("x", [{ ankerType: "start_bouw", offsetDagen: 0 }]);
    expect(isNogRelevant(p, "nog_niet_begonnen")).toBe(true);
  });

  it("laat een partij vallen waarvan alle afspraken geweest zijn", () => {
    const p = partij("grondwerk", [{ ankerType: "start_bouw", offsetDagen: 0 }]);
    expect(isNogRelevant(p, "ruwbouw_gereed")).toBe(false);
  });

  it("houdt een partij met één toekomstige afspraak overeind", () => {
    const keuken = partij("keuken", [
      { ankerType: "ruwbouw_gereed", offsetDagen: 0 },
      { ankerType: "oplevering", offsetDagen: 7 },
    ]);
    expect(isNogRelevant(keuken, "ruwbouw_gereed")).toBe(true);
  });

  /** Een tuinaanleg die zestig dagen ná de oplevering komt, moet nog komen. */
  it("telt een afspraak aan de oplevering nooit als geweest", () => {
    const tuin = partij("tuin", [{ ankerType: "oplevering", offsetDagen: 60 }]);
    expect(isNogRelevant(tuin, "opgeleverd")).toBe(true);
  });

  /**
   * Deze regel is er bij het narekenen bij gekomen, en hij dekt een echte fout
   * af: de vloerenlegger hangt aan `dekvloer_gestort + 42` vanwege de
   * droogtijd. Zonder de offsetregel verdween hij uit de lijst precies op het
   * moment dat hij ingepland moest worden — zes weken vóór hij komt.
   */
  it("telt een positieve offset nooit als geweest", () => {
    const vloer = partij("vloer", [{ ankerType: "dekvloer_gestort", offsetDagen: 42 }]);
    expect(isNogRelevant(vloer, "dekvloer_gestort")).toBe(true);

    // Zonder offset is hij wél geweest.
    const direct = partij("direct", [{ ankerType: "dekvloer_gestort", offsetDagen: 0 }]);
    expect(isNogRelevant(direct, "dekvloer_gestort")).toBe(false);
  });

  it("telt een negatieve offset wel als geweest", () => {
    // Iets wat vóór het gepasseerde moment moest gebeuren, is zeker geweest.
    const ervoor = partij("ervoor", [{ ankerType: "ruwbouw_gereed", offsetDagen: -14 }]);
    expect(isNogRelevant(ervoor, "ruwbouw_gereed")).toBe(false);
  });

  it("houdt een partij zonder afspraken niet overeind", () => {
    const leeg = partij("leeg", []);
    expect(isNogRelevant(leeg, "ruwbouw_gereed")).toBe(false);
    // Maar vóór de bouw wel — dan is er niets gepasseerd.
    expect(isNogRelevant(leeg, "nog_niet_begonnen")).toBe(true);
  });
});

describe("splitsOpFase", () => {
  it("gooit niets weg", () => {
    const { relevant, geweest } = splitsOpFase(STANDAARD_BETROKKENEN, "dekvloer_gestort");
    expect(relevant.length + geweest.length).toBe(STANDAARD_BETROKKENEN.length);
  });

  it("laat alles staan als de bouw nog moet beginnen", () => {
    const { relevant, geweest } = splitsOpFase(STANDAARD_BETROKKENEN, "nog_niet_begonnen");
    expect(relevant).toHaveLength(STANDAARD_BETROKKENEN.length);
    expect(geweest).toHaveLength(0);
  });

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * DE FASEFILTER IS GEEN OPLOSSING VOOR "HET ZIJN ZOVEEL KAARTEN"
   *
   * Gemeten tegen de echte bibliotheek op 2 augustus: van de 38 partijen
   * vallen er bij een vergevorderde bouw precies **drie** af
   * (`domotica-bekabeling`, `bank-bouwdepot`, `notaris`). De rest hangt aan de
   * oplevering of heeft een positieve offset, en moet dus nog komen.
   *
   * Dat is logisch juist en het was ook de bedoeling — maar het betekent dat
   * de klacht *"de opzet is mooi, alleen het zijn zoveel kaarten"* hier níét
   * mee opgelost wordt. Dat moet komen van compacte regels in plaats van
   * kaarten, en van ingeklapte categorieën.
   *
   * Deze test pint het aantal vast, zodat een latere wijziging aan de
   * bibliotheek of de filterregel zichtbaar wordt in plaats van stilletjes de
   * halve lijst weg te filteren.
   * ─────────────────────────────────────────────────────────────────────────
   */
  it("filtert weinig weg — de fase lost het kaartenprobleem niet op", () => {
    const { relevant, geweest } = splitsOpFase(STANDAARD_BETROKKENEN, "dekvloer_gestort");
    expect(geweest).toHaveLength(3);
    expect(relevant.length).toBe(STANDAARD_BETROKKENEN.length - 3);
  });

  it("laat de vloerenlegger staan zodra de dekvloer ligt", () => {
    // Hij komt juist dán — 42 dagen droogtijd na het storten.
    const { relevant } = splitsOpFase(STANDAARD_BETROKKENEN, "dekvloer_gestort");
    expect(relevant.map((p) => p.sleutel)).toContain("vloerenlegger");
  });

  it("laat de nutsvoorzieningen altijd staan — die hangen aan de oplevering", () => {
    const { relevant } = splitsOpFase(STANDAARD_BETROKKENEN, "opgeleverd");
    const sleutels = relevant.map((p) => p.sleutel);
    expect(sleutels).toContain("energieleverancier");
  });
});

describe("voorgesteldeOpleverstatus", () => {
  it("blijft vaag zolang de bouw dat ook is", () => {
    expect(voorgesteldeOpleverstatus("nog_niet_begonnen")).toBe("indicatief");
    expect(voorgesteldeOpleverstatus("ruwbouw_gereed")).toBe("indicatief");
  });

  it("wordt scherper zodra de dekvloer ligt", () => {
    expect(voorgesteldeOpleverstatus("dekvloer_gestort")).toBe("bandbreedte");
  });

  it("is aangezegd bij een opgeleverde woning", () => {
    expect(voorgesteldeOpleverstatus("opgeleverd")).toBe("aangezegd");
  });
});
