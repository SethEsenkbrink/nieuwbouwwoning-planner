import { describe, expect, it } from "vitest";
import {
  berekenPeriodes,
  conflicterendeMeters,
  decimalenVan,
  isTeruglevering,
  leesStandInvoer,
  meternaamVan,
  metersMetAchterstalligeOpname,
  opnamesVan,
  overzichtVoorAlleMeters,
  overzichtVoorMeter,
  sorteerOpnames,
  verbruikstrend,
} from "@/lib/meterstanden";
import type { MeterMetId, MeterstandMetId } from "@/lib/converters";

const VANDAAG = new Date(Date.UTC(2026, 7, 1)); // 1 augustus 2026

function dag(jaar: number, maand1tot12: number, dagVanMaand: number): Date {
  return new Date(Date.UTC(jaar, maand1tot12 - 1, dagVanMaand));
}

function meter(velden: Partial<MeterMetId> = {}): MeterMetId {
  return {
    id: velden.id ?? "m1",
    soort: "stroom_normaal",
    eenheid: "kWh",
    waardenBron: "voorstel",
    ...velden,
  };
}

function opname(velden: Partial<MeterstandMetId> = {}): MeterstandMetId {
  return {
    id: velden.id ?? "o1",
    meterId: "m1",
    opgenomenOp: dag(2026, 1, 1),
    stand: 0,
    ...velden,
  };
}

// ── Namen, eenheden en labels ──────────────────────────────────────────────

describe("meternaamVan", () => {
  it("gebruikt het bibliotheeklabel als er geen eigen naam is", () => {
    expect(meternaamVan(meter({ soort: "gas" }))).toBe("Gas");
  });

  it("geeft de eigen naam voorrang boven het label", () => {
    expect(meternaamVan(meter({ soort: "gas", naam: "Gasmeter garage" }))).toBe("Gasmeter garage");
  });

  it("negeert een lege eigen naam", () => {
    expect(meternaamVan(meter({ soort: "water", naam: "" }))).toBe("Water");
  });

  it("geeft een eigen meter zonder naam een leesbare terugval", () => {
    // `overig` heeft wél een label ("Eigen meter"), dus dit mag nooit leeg zijn.
    expect(meternaamVan(meter({ soort: "overig" }))).toBe("Eigen meter");
  });
});

describe("decimalenVan en isTeruglevering", () => {
  it("geeft stroom nul decimalen en gas er drie", () => {
    expect(decimalenVan(meter({ soort: "stroom_normaal" }))).toBe(0);
    expect(decimalenVan(meter({ soort: "gas", eenheid: "m3" }))).toBe(3);
  });

  /**
   * `overig` dekt zowel een laadpaal in kWh als een tussenmeter in m³, dus de
   * bibliotheek kan er geen zinnig getal voor geven. Dan bepaalt de eenheid
   * het — anders toont een eigen watermeter 12,345 m³ als "12".
   */
  it("kijkt bij een eigen meter naar de eenheid en niet naar de bibliotheek", () => {
    expect(decimalenVan(meter({ soort: "overig", eenheid: "kWh" }))).toBe(0);
    expect(decimalenVan(meter({ soort: "overig", eenheid: "m3" }))).toBe(3);
    expect(decimalenVan(meter({ soort: "overig", eenheid: "GJ" }))).toBe(3);
  });

  it("herkent alle drie de terugleververormen", () => {
    expect(isTeruglevering(meter({ soort: "teruglevering_enkel" }))).toBe(true);
    expect(isTeruglevering(meter({ soort: "teruglevering_normaal" }))).toBe(true);
    expect(isTeruglevering(meter({ soort: "teruglevering_dal" }))).toBe(true);
  });

  it("merkt een gewone stroommeter niet aan als teruglevering", () => {
    expect(isTeruglevering(meter({ soort: "stroom_normaal" }))).toBe(false);
  });
});

// ── Sorteren ───────────────────────────────────────────────────────────────

describe("sorteerOpnames", () => {
  it("zet de oudste opname vooraan", () => {
    const gesorteerd = sorteerOpnames([
      opname({ id: "b", opgenomenOp: dag(2026, 3, 1) }),
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1) }),
      opname({ id: "c", opgenomenOp: dag(2026, 2, 1) }),
    ]);
    expect(gesorteerd.map((o) => o.id)).toEqual(["a", "c", "b"]);
  });

  it("valt bij dezelfde datum terug op het id, zodat de volgorde stabiel is", () => {
    const zelfdeDag = dag(2026, 1, 1);
    const gesorteerd = sorteerOpnames([
      opname({ id: "z", opgenomenOp: zelfdeDag }),
      opname({ id: "a", opgenomenOp: zelfdeDag }),
    ]);
    expect(gesorteerd.map((o) => o.id)).toEqual(["a", "z"]);
  });

  it("laat de meegegeven lijst ongemoeid", () => {
    const origineel = [
      opname({ id: "b", opgenomenOp: dag(2026, 3, 1) }),
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1) }),
    ];
    sorteerOpnames(origineel);
    expect(origineel.map((o) => o.id)).toEqual(["b", "a"]);
  });
});

describe("opnamesVan", () => {
  it("houdt alleen de opnames van de gevraagde meter over", () => {
    const alles = [
      opname({ id: "a", meterId: "m1", opgenomenOp: dag(2026, 1, 1) }),
      opname({ id: "b", meterId: "m2", opgenomenOp: dag(2026, 1, 2) }),
      opname({ id: "c", meterId: "m1", opgenomenOp: dag(2026, 1, 3) }),
    ];
    expect(opnamesVan(alles, "m1").map((o) => o.id)).toEqual(["a", "c"]);
  });
});

// ── Het verbruik ───────────────────────────────────────────────────────────

describe("berekenPeriodes", () => {
  it("geeft niets terug bij nul of één opname", () => {
    expect(berekenPeriodes([])).toEqual([]);
    expect(berekenPeriodes([opname({ stand: 100 })])).toEqual([]);
  });

  it("rekent verbruik en gemiddelde per dag uit", () => {
    // 1 januari → 31 januari = 30 dagen, 300 kWh erbij.
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 1000 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 31), stand: 1300 }),
    ]);

    expect(periodes).toHaveLength(1);
    expect(periodes[0]?.dagen).toBe(30);
    expect(periodes[0]?.verbruik).toBe(300);
    expect(periodes[0]?.perDag).toBe(10);
    expect(periodes[0]?.betrouwbaar).toBe(true);
  });

  it("levert bij n opnames n-1 periodes op", () => {
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 0 }),
      opname({ id: "b", opgenomenOp: dag(2026, 2, 1), stand: 100 }),
      opname({ id: "c", opgenomenOp: dag(2026, 3, 1), stand: 250 }),
      opname({ id: "d", opgenomenOp: dag(2026, 4, 1), stand: 300 }),
    ]);
    expect(periodes).toHaveLength(3);
    expect(periodes.map((p) => p.verbruik)).toEqual([100, 150, 50]);
  });

  it("rekent ook als de opnames in de verkeerde volgorde binnenkomen", () => {
    const periodes = berekenPeriodes([
      opname({ id: "b", opgenomenOp: dag(2026, 1, 31), stand: 1300 }),
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 1000 }),
    ]);
    expect(periodes[0]?.verbruik).toBe(300);
  });

  it("accepteert nul verbruik als geldige uitkomst", () => {
    // Een terugleveringsmeter in december: nul is een normale waarde en mag
    // niet als onbetrouwbaar worden weggezet.
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 12, 1), stand: 4200 }),
      opname({ id: "b", opgenomenOp: dag(2026, 12, 31), stand: 4200 }),
    ]);
    expect(periodes[0]?.betrouwbaar).toBe(true);
    expect(periodes[0]?.verbruik).toBe(0);
    expect(periodes[0]?.perDag).toBe(0);
  });

  it("rekent met decimalen, voor gas en water", () => {
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 120.5 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 11), stand: 123 }),
    ]);
    expect(periodes[0]?.verbruik).toBeCloseTo(2.5, 10);
    expect(periodes[0]?.perDag).toBeCloseTo(0.25, 10);
  });

  // ── De kern van ADR-0015 §4: een dalende stand wordt gemarkeerd ──────────

  it("markeert een gedaalde stand als onbetrouwbaar in plaats van negatief verbruik", () => {
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 12000 }),
      opname({ id: "b", opgenomenOp: dag(2026, 2, 1), stand: 120 }),
    ]);

    expect(periodes[0]?.betrouwbaar).toBe(false);
    expect(periodes[0]?.reden).toBe("stand_gedaald");
    expect(periodes[0]?.verbruik).toBeNull();
    expect(periodes[0]?.perDag).toBeNull();
  });

  it("rekent een omgelopen meter NIET stilzwijgend recht", () => {
    // 99900 → 150 is bij een vijfcijferige meter waarschijnlijk een omloop van
    // 250. De app mag dat niet gokken: het kan net zo goed een typefout zijn.
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 99900 }),
      opname({ id: "b", opgenomenOp: dag(2026, 2, 1), stand: 150 }),
    ]);
    expect(periodes[0]?.verbruik).toBeNull();
    expect(periodes[0]?.reden).toBe("stand_gedaald");
  });

  it("bewaart de standen van een onbetrouwbare periode, zodat de fout zichtbaar blijft", () => {
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 500 }),
      opname({ id: "b", opgenomenOp: dag(2026, 2, 1), stand: 50 }),
    ]);
    expect(periodes[0]?.standVan).toBe(500);
    expect(periodes[0]?.standTot).toBe(50);
  });

  it("markeert twee opnames op dezelfde dag in plaats van te delen door nul", () => {
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 100 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 1), stand: 105 }),
    ]);

    expect(periodes[0]?.betrouwbaar).toBe(false);
    expect(periodes[0]?.reden).toBe("zelfde_dag");
    expect(periodes[0]?.perDag).toBeNull();
    // En vooral: geen Infinity. Dat zou door de hele trend heen lekken.
    expect(periodes[0]?.perDag).not.toBe(Infinity);
  });

  it("laat een dalende stand voorgaan op dezelfde dag", () => {
    // Beide gelden, maar "stand gedaald" is de bruikbaarste melding: die zegt
    // de gebruiker wat hij moet nakijken.
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 100 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 1), stand: 90 }),
    ]);
    expect(periodes[0]?.reden).toBe("stand_gedaald");
  });

  /**
   * De vervolgperiode begint bij één van twee opnames van dezelfde dag, en
   * welke dat is hangt af van het Firestore-document-id — dat is willekeurig.
   * Zou alleen de nul-dagen-periode gemarkeerd zijn, dan koos de app hier stil
   * een van beide waarden. Precies wat ADR-0015 §4 elders afwijst.
   */
  it("markeert ook de periode ná twee opnames op dezelfde dag", () => {
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 12345 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 1), stand: 12354 }),
      opname({ id: "c", opgenomenOp: dag(2026, 2, 1), stand: 12600 }),
    ]);

    expect(periodes).toHaveLength(2);
    expect(periodes[0]?.reden).toBe("zelfde_dag");
    expect(periodes[1]?.reden).toBe("volgt_op_zelfde_dag");
    expect(periodes[1]?.verbruik).toBeNull();
  });

  it("herstelt zich daarna weer", () => {
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 12345 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 1), stand: 12354 }),
      opname({ id: "c", opgenomenOp: dag(2026, 2, 1), stand: 12600 }),
      opname({ id: "d", opgenomenOp: dag(2026, 3, 1), stand: 12900 }),
    ]);

    expect(periodes[2]?.betrouwbaar).toBe(true);
    expect(periodes[2]?.verbruik).toBe(300);
  });

  it("markeert een gewone reeks niet per ongeluk als volgt_op_zelfde_dag", () => {
    const periodes = berekenPeriodes([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 0 }),
      opname({ id: "b", opgenomenOp: dag(2026, 2, 1), stand: 100 }),
      opname({ id: "c", opgenomenOp: dag(2026, 3, 1), stand: 250 }),
    ]);
    expect(periodes.every((p) => p.betrouwbaar)).toBe(true);
  });
});

// ── Invoer lezen ───────────────────────────────────────────────────────────

describe("leesStandInvoer", () => {
  it("leest een gewoon getal", () => {
    expect(leesStandInvoer("12345")).toBe(12345);
    expect(leesStandInvoer("  12345  ")).toBe(12345);
  });

  it("leest de komma als decimaalteken", () => {
    expect(leesStandInvoer("1234,567")).toBeCloseTo(1234.567, 10);
  });

  it("accepteert nul", () => {
    expect(leesStandInvoer("0")).toBe(0);
  });

  /**
   * Dit is de stille fout: zonder deze behandeling wordt "12.345" gelezen als
   * 12,345 — een factor 1000 mis, en dat valt bij een eerste opname helemaal
   * niet op.
   */
  it("herkent de punt als duizendtalscheiding", () => {
    expect(leesStandInvoer("12.345")).toBe(12345);
    expect(leesStandInvoer("1.234.567")).toBe(1234567);
  });

  it("leest duizendtallen én decimalen samen", () => {
    expect(leesStandInvoer("1.234,5")).toBeCloseTo(1234.5, 10);
  });

  it("weigert een negatieve waarde", () => {
    expect(leesStandInvoer("-500")).toBeUndefined();
  });

  it("weigert tekst en lege invoer", () => {
    expect(leesStandInvoer("")).toBeUndefined();
    expect(leesStandInvoer("   ")).toBeUndefined();
    expect(leesStandInvoer("veel")).toBeUndefined();
    expect(leesStandInvoer("12kWh")).toBeUndefined();
  });

  it("weigert twee decimaaltekens", () => {
    expect(leesStandInvoer("12,34,5")).toBeUndefined();
  });
});

// ── De trend ───────────────────────────────────────────────────────────────

describe("verbruikstrend", () => {
  it("geeft null zonder een enkele bruikbare periode", () => {
    expect(verbruikstrend([])).toBeNull();
    expect(verbruikstrend([opname({ stand: 10 })])).toBeNull();
  });

  it("geeft richting 'onbekend' bij precies één periode", () => {
    const trend = verbruikstrend([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 0 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 11), stand: 100 }),
    ]);
    expect(trend?.richting).toBe("onbekend");
    expect(trend?.vorige).toBeUndefined();
    expect(trend?.verschilProcent).toBeUndefined();
  });

  it("rekent een stijging uit ten opzichte van de vorige periode", () => {
    // 10/dag → 15/dag = +50%
    const trend = verbruikstrend([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 0 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 11), stand: 100 }),
      opname({ id: "c", opgenomenOp: dag(2026, 1, 21), stand: 250 }),
    ]);
    expect(trend?.verschilProcent).toBeCloseTo(50, 10);
    expect(trend?.richting).toBe("meer");
  });

  it("rekent een daling uit", () => {
    // 20/dag → 10/dag = −50%
    const trend = verbruikstrend([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 0 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 11), stand: 200 }),
      opname({ id: "c", opgenomenOp: dag(2026, 1, 21), stand: 300 }),
    ]);
    expect(trend?.verschilProcent).toBeCloseTo(-50, 10);
    expect(trend?.richting).toBe("minder");
  });

  it("noemt een verschil binnen de marge 'gelijk'", () => {
    // 100/10 dagen → 101/10 dagen = +1%, onder de marge van 2%.
    const trend = verbruikstrend([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 0 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 11), stand: 100 }),
      opname({ id: "c", opgenomenOp: dag(2026, 1, 21), stand: 201 }),
    ]);
    expect(trend?.richting).toBe("gelijk");
  });

  it("vergelijkt op verbruik per dag en niet op totalen, ook bij ongelijke periodes", () => {
    // Periode 1: 10 dagen, 100 → 10/dag.
    // Periode 2: 20 dagen, 200 → 10/dag. Totaal verdubbelt, tempo niet.
    const trend = verbruikstrend([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 0 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 11), stand: 100 }),
      opname({ id: "c", opgenomenOp: dag(2026, 1, 31), stand: 300 }),
    ]);
    expect(trend?.richting).toBe("gelijk");
    expect(trend?.verschilProcent).toBeCloseTo(0, 10);
  });

  it("deelt niet door nul als de vorige periode nul verbruik had", () => {
    const trend = verbruikstrend([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 500 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 11), stand: 500 }),
      opname({ id: "c", opgenomenOp: dag(2026, 1, 21), stand: 600 }),
    ]);
    expect(trend?.richting).toBe("meer");
    expect(trend?.verschilProcent).toBeUndefined();
    expect(Number.isFinite(trend?.verschilProcent ?? 0)).toBe(true);
  });

  it("noemt twee nul-periodes gelijk", () => {
    const trend = verbruikstrend([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 500 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 11), stand: 500 }),
      opname({ id: "c", opgenomenOp: dag(2026, 1, 21), stand: 500 }),
    ]);
    expect(trend?.richting).toBe("gelijk");
  });

  it("slaat een onbetrouwbare periode over in plaats van de trend te blokkeren", () => {
    // Eén typefout in het midden mag niet betekenen dat er nooit meer een
    // trend te zien is.
    const trend = verbruikstrend([
      opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 0 }),
      opname({ id: "b", opgenomenOp: dag(2026, 1, 11), stand: 100 }), // 10/dag
      opname({ id: "c", opgenomenOp: dag(2026, 1, 21), stand: 5 }), // gedaald
      opname({ id: "d", opgenomenOp: dag(2026, 1, 31), stand: 155 }), // 15/dag
    ]);

    expect(trend).not.toBeNull();
    expect(trend?.verschilProcent).toBeCloseTo(50, 10);
    expect(trend?.richting).toBe("meer");
  });
});

// ── Het overzicht per meter ────────────────────────────────────────────────

describe("overzichtVoorMeter", () => {
  it("noemt een meter zonder enkele opname achterstallig", () => {
    const overzicht = overzichtVoorMeter(meter(), [], VANDAAG);
    expect(overzicht.opnameAchterstallig).toBe(true);
    expect(overzicht.laatste).toBeUndefined();
    expect(overzicht.dagenSindsOpname).toBeUndefined();
    expect(overzicht.periodes).toEqual([]);
    expect(overzicht.trend).toBeNull();
  });

  it("noemt een verse opname niet achterstallig", () => {
    // 20 dagen geleden, ruim binnen de 35.
    const overzicht = overzichtVoorMeter(
      meter(),
      [opname({ opgenomenOp: dag(2026, 7, 12), stand: 100 })],
      VANDAAG,
    );
    expect(overzicht.dagenSindsOpname).toBe(20);
    expect(overzicht.opnameAchterstallig).toBe(false);
  });

  it("noemt een opname van meer dan 35 dagen oud wél achterstallig", () => {
    const overzicht = overzichtVoorMeter(
      meter(),
      [opname({ opgenomenOp: dag(2026, 6, 1), stand: 100 })],
      VANDAAG,
    );
    expect(overzicht.dagenSindsOpname).toBe(61);
    expect(overzicht.opnameAchterstallig).toBe(true);
  });

  it("slaat precies op de grens van 35 dagen nog niet aan", () => {
    // 27 juni + 35 dagen = 1 augustus. Op de dag zelf nog vers.
    const overzicht = overzichtVoorMeter(
      meter(),
      [opname({ opgenomenOp: dag(2026, 6, 27), stand: 100 })],
      VANDAAG,
    );
    expect(overzicht.dagenSindsOpname).toBe(35);
    expect(overzicht.opnameAchterstallig).toBe(false);
  });

  /**
   * De invoer weigert een toekomstdatum, maar data die vóór die regel is
   * opgeslagen kan er nog zijn. Zonder afkapping lekt "-240 dagen geleden" de
   * UI in.
   */
  it("kapt dagenSindsOpname af op nul bij een datum in de toekomst", () => {
    const overzicht = overzichtVoorMeter(
      meter(),
      [opname({ opgenomenOp: dag(2027, 3, 1), stand: 100 })],
      VANDAAG,
    );
    expect(overzicht.dagenSindsOpname).toBe(0);
    expect(overzicht.opnameAchterstallig).toBe(false);
  });

  it("kijkt alleen naar de opnames van deze meter", () => {
    const overzicht = overzichtVoorMeter(
      meter({ id: "m1" }),
      [
        opname({ id: "a", meterId: "m1", opgenomenOp: dag(2026, 7, 1), stand: 100 }),
        opname({ id: "b", meterId: "m2", opgenomenOp: dag(2026, 7, 20), stand: 999 }),
      ],
      VANDAAG,
    );
    expect(overzicht.laatste?.id).toBe("a");
    expect(overzicht.periodes).toEqual([]);
  });

  it("telt hoeveel periodes er niet klopten", () => {
    const overzicht = overzichtVoorMeter(
      meter(),
      [
        opname({ id: "a", opgenomenOp: dag(2026, 1, 1), stand: 100 }),
        opname({ id: "b", opgenomenOp: dag(2026, 2, 1), stand: 50 }), // gedaald
        opname({ id: "c", opgenomenOp: dag(2026, 3, 1), stand: 150 }),
      ],
      VANDAAG,
    );
    expect(overzicht.aantalOnbetrouwbaar).toBe(1);
    expect(overzicht.periodes).toHaveLength(2);
  });
});

describe("overzichtVoorAlleMeters", () => {
  it("zet achterstallige meters bovenaan", () => {
    const meters = [
      meter({ id: "vers", soort: "stroom_normaal" }),
      meter({ id: "oud", soort: "stroom_dal" }),
    ];
    const opnames = [
      opname({ id: "a", meterId: "vers", opgenomenOp: dag(2026, 7, 25), stand: 10 }),
      opname({ id: "b", meterId: "oud", opgenomenOp: dag(2026, 1, 1), stand: 10 }),
    ];

    const overzicht = overzichtVoorAlleMeters(meters, opnames, VANDAAG);
    expect(overzicht.map((o) => o.meter.id)).toEqual(["oud", "vers"]);
  });

  it("sorteert daarna op de volgorde van de bibliotheek, niet alfabetisch", () => {
    // Alle drie even achterstallig; stroom hoort vóór gas vóór water, ook al
    // is dat niet de alfabetische volgorde van de labels.
    const meters = [
      meter({ id: "w", soort: "water" }),
      meter({ id: "g", soort: "gas" }),
      meter({ id: "s", soort: "stroom_enkel" }),
    ];
    const overzicht = overzichtVoorAlleMeters(meters, [], VANDAAG);
    expect(overzicht.map((o) => o.meter.id)).toEqual(["s", "g", "w"]);
  });

  it("zet eigen meters achteraan", () => {
    const meters = [
      meter({ id: "eigen", soort: "overig", naam: "Aardappelschilmachine" }),
      meter({ id: "gas", soort: "gas" }),
    ];
    const overzicht = overzichtVoorAlleMeters(meters, [], VANDAAG);
    expect(overzicht.map((o) => o.meter.id)).toEqual(["gas", "eigen"]);
  });
});

describe("metersMetAchterstalligeOpname", () => {
  it("houdt alleen de meters over die aandacht vragen", () => {
    const meters = [meter({ id: "vers" }), meter({ id: "oud", soort: "gas" })];
    const opnames = [
      opname({ id: "a", meterId: "vers", opgenomenOp: dag(2026, 7, 25), stand: 10 }),
      opname({ id: "b", meterId: "oud", opgenomenOp: dag(2026, 1, 1), stand: 10 }),
    ];

    const lijst = metersMetAchterstalligeOpname(meters, opnames, VANDAAG);
    expect(lijst.map((o) => o.meter.id)).toEqual(["oud"]);
  });

  it("geeft een lege lijst als alles bijgehouden is", () => {
    const opnames = [opname({ meterId: "m1", opgenomenOp: dag(2026, 7, 25), stand: 10 })];
    expect(metersMetAchterstalligeOpname([meter()], opnames, VANDAAG)).toEqual([]);
  });
});

// ── Conflicterende meters ──────────────────────────────────────────────────

describe("conflicterendeMeters", () => {
  it("zegt niets bij een normale dubbeltarief-opstelling", () => {
    const meters = [
      meter({ id: "a", soort: "stroom_normaal" }),
      meter({ id: "b", soort: "stroom_dal" }),
      meter({ id: "c", soort: "teruglevering_normaal" }),
      meter({ id: "d", soort: "teruglevering_dal" }),
    ];
    expect(conflicterendeMeters(meters)).toEqual([]);
  });

  it("zegt niets bij een enkeltarief-opstelling", () => {
    const meters = [
      meter({ id: "a", soort: "stroom_enkel" }),
      meter({ id: "b", soort: "teruglevering_enkel" }),
    ];
    expect(conflicterendeMeters(meters)).toEqual([]);
  });

  it("waarschuwt bij enkeltarief naast normaaltarief", () => {
    const meters = [
      meter({ id: "a", soort: "stroom_enkel" }),
      meter({ id: "b", soort: "stroom_normaal" }),
    ];
    expect(conflicterendeMeters(meters)).toHaveLength(1);
    expect(conflicterendeMeters(meters)[0]).toContain("dubbel");
  });

  it("waarschuwt per combinatie, niet één keer voor alles", () => {
    const meters = [
      meter({ id: "a", soort: "stroom_enkel" }),
      meter({ id: "b", soort: "stroom_normaal" }),
      meter({ id: "c", soort: "stroom_dal" }),
    ];
    expect(conflicterendeMeters(meters)).toHaveLength(2);
  });

  it("blokkeert niets — het is en blijft een lijst meldingen", () => {
    const meters = [
      meter({ id: "a", soort: "stroom_enkel" }),
      meter({ id: "b", soort: "stroom_normaal" }),
    ];
    expect(Array.isArray(conflicterendeMeters(meters))).toBe(true);
  });
});
