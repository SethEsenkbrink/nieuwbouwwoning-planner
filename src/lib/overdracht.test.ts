import { describe, expect, it } from "vitest";
import { stelDossierSamen, type Dossierbronnen } from "@/lib/overdracht";
import type {
  BetrokkeneMetId,
  MeterMetId,
  MeterstandMetId,
  OnderdeelMetId,
  OnderhoudLogregelMetId,
  ProjectMetId,
} from "@/lib/converters";

const VANDAAG = new Date(Date.UTC(2026, 7, 1)); // 1 augustus 2026
const OVERDRACHT = new Date(Date.UTC(2026, 7, 1));

function dag(jaar: number, maand1tot12: number, dagVanMaand: number): Date {
  return new Date(Date.UTC(jaar, maand1tot12 - 1, dagVanMaand));
}

function project(velden: Partial<ProjectMetId> = {}): ProjectMetId {
  return {
    id: "p1",
    naam: "Ons huis in Almere",
    aangemaaktOp: dag(2026, 1, 1),
    ...velden,
  };
}

function onderdeel(velden: Partial<OnderdeelMetId> = {}): OnderdeelMetId {
  return {
    id: velden.id ?? "o1",
    naam: "Warmtepomp",
    categorie: "verwarming",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    ...velden,
  };
}

function logregel(velden: Partial<OnderhoudLogregelMetId> = {}): OnderhoudLogregelMetId {
  return {
    id: velden.id ?? "l1",
    taakId: "t1",
    uitgevoerdOp: dag(2026, 5, 1),
    ...velden,
  };
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

function meterstand(velden: Partial<MeterstandMetId> = {}): MeterstandMetId {
  return {
    id: velden.id ?? "s1",
    meterId: "m1",
    opgenomenOp: dag(2026, 7, 1),
    stand: 12345,
    ...velden,
  };
}

function betrokkene(velden: Partial<BetrokkeneMetId> = {}): BetrokkeneMetId {
  return {
    id: velden.id ?? "b1",
    naam: "Installatiebedrijf De Wit",
    categorie: "installatie",
    // Deze twee zijn verplicht op het model: `0` betekent "niet van
    // toepassing" en is een echte waarde, geen ontbrekend veld.
    aanlooptijdDagen: 0,
    annuleertermijnDagen: 0,
    communicatieregel: "handmatig",
    waardenBron: "voorstel",
    ...velden,
  };
}

function bronnen(overschrijf: Partial<Dossierbronnen> = {}): Dossierbronnen {
  return {
    project: project(),
    onderdelen: [],
    logboek: [],
    meters: [],
    meterstanden: [],
    betrokkenen: [],
    ...overschrijf,
  };
}

function dossier(overschrijf: Partial<Dossierbronnen> = {}, overdracht = OVERDRACHT) {
  return stelDossierSamen(bronnen(overschrijf), overdracht, VANDAAG);
}

// ── De kern van ADR-0013 §2: alleen wat bij de woning blijft ───────────────

describe("het blijftBijWoning-filter", () => {
  it("neemt alleen onderdelen mee die bij de woning blijven", () => {
    const d = dossier({
      onderdelen: [
        onderdeel({ id: "blijft", naam: "Warmtepomp", blijftBijWoning: true }),
        onderdeel({ id: "gaatmee", naam: "Thuisbatterij", blijftBijWoning: false }),
      ],
    });

    expect(d.onderdelen.map((o) => o.id)).toEqual(["blijft"]);
  });

  /**
   * Dit is het scenario waar ADR-0013 voor geschreven is: zonder het
   * onderscheid zou het dossier apparatuur beloven die de verkoper meeneemt.
   */
  it("laat een plug-and-play onderdeel dat blijft wél staan", () => {
    const d = dossier({
      onderdelen: [
        onderdeel({ id: "batterij", montage: "plug_and_play", blijftBijWoning: true }),
      ],
    });
    expect(d.onderdelen).toHaveLength(1);
  });

  it("laat een vast geïnstalleerd onderdeel dat meegaat wél weg", () => {
    const d = dossier({
      onderdelen: [
        onderdeel({ id: "zonwering", montage: "vast_geinstalleerd", blijftBijWoning: false }),
      ],
    });
    expect(d.onderdelen).toEqual([]);
  });

  it("telt hoeveel onderdelen er niet in staan", () => {
    const d = dossier({
      onderdelen: [
        onderdeel({ id: "a", blijftBijWoning: true }),
        onderdeel({ id: "b", blijftBijWoning: false }),
        onderdeel({ id: "c", blijftBijWoning: false }),
      ],
    });
    expect(d.verhuistMee).toBe(2);
  });

  it("sorteert op categorie en daarbinnen op naam", () => {
    const d = dossier({
      onderdelen: [
        onderdeel({ id: "1", naam: "Zonnepanelen", categorie: "opwekking" }),
        onderdeel({ id: "2", naam: "WTW-unit", categorie: "ventilatie" }),
        onderdeel({ id: "3", naam: "Afzuigkap", categorie: "ventilatie" }),
      ],
    });
    expect(d.onderdelen.map((o) => o.naam)).toEqual(["Zonnepanelen", "Afzuigkap", "WTW-unit"]);
  });
});

// ── Privacy: geen contactgegevens van derden (ADR-0016 §5) ─────────────────

describe("betrokkenen", () => {
  it("neemt alleen de bedrijfsnaam over, geen contactgegevens", () => {
    const d = dossier({
      onderdelen: [onderdeel({ installateurBetrokkeneId: "b1" })],
      betrokkenen: [
        betrokkene({
          id: "b1",
          naam: "Installatiebedrijf De Wit",
          contactpersoon: "Jan de Wit",
          email: "jan@dewit.nl",
          telefoon: "06-12345678",
        }),
      ],
    });

    const eerste = d.betrokkenen[0];
    expect(eerste?.naam).toBe("Installatiebedrijf De Wit");
    // Het type kent deze velden niet; deze test legt vast dat er ook geen
    // waarde doorlekt als er ooit een veld bij zou komen.
    expect(Object.keys(eerste ?? {}).sort()).toEqual(["categorie", "id", "naam", "werk"]);
  });

  it("zet bij het onderdeel alleen de bedrijfsnaam als installateur", () => {
    const d = dossier({
      onderdelen: [onderdeel({ installateurBetrokkeneId: "b1" })],
      betrokkenen: [betrokkene({ id: "b1", naam: "De Wit", contactpersoon: "Jan" })],
    });
    expect(d.onderdelen[0]?.installateur).toBe("De Wit");
  });

  /**
   * De betrokkenenlijst uit het bouwtraject bevat ook de notaris, de bank en
   * het verhuisbedrijf. Die hebben niets met de wóning te maken.
   */
  it("laat partijen weg die aan geen enkel blijvend onderdeel hangen", () => {
    const d = dossier({
      onderdelen: [onderdeel({ installateurBetrokkeneId: "b1" })],
      betrokkenen: [
        betrokkene({ id: "b1", naam: "De Wit" }),
        betrokkene({ id: "b2", naam: "Notaris Jansen", categorie: "financieel" }),
        betrokkene({ id: "b3", naam: "Verhuisbedrijf Snel", categorie: "verhuizing" }),
      ],
    });
    expect(d.betrokkenen.map((b) => b.naam)).toEqual(["De Wit"]);
  });

  it("laat de installateur van een meeverhuizend onderdeel ook weg", () => {
    const d = dossier({
      onderdelen: [onderdeel({ blijftBijWoning: false, installateurBetrokkeneId: "b1" })],
      betrokkenen: [betrokkene({ id: "b1" })],
    });
    expect(d.betrokkenen).toEqual([]);
  });

  it("bundelt meerdere onderdelen onder één bedrijf", () => {
    const d = dossier({
      onderdelen: [
        onderdeel({ id: "1", naam: "Warmtepomp", installateurBetrokkeneId: "b1" }),
        onderdeel({ id: "2", naam: "WTW-unit", installateurBetrokkeneId: "b1" }),
      ],
      betrokkenen: [betrokkene({ id: "b1" })],
    });

    expect(d.betrokkenen).toHaveLength(1);
    // Nederlandse collatie, niet ASCII: "Warmtepomp" komt vóór "WTW-unit"
    // omdat `localeCompare(…, "nl")` hoofdletterongevoelig vergelijkt en
    // "wa" < "wt". In ASCII zou "WTW" eerst komen, want 'T' (84) < 'a' (97).
    expect(d.betrokkenen[0]?.werk).toEqual(["Warmtepomp", "WTW-unit"]);
  });
});

// ── Het logboek ────────────────────────────────────────────────────────────

describe("logboek", () => {
  it("zet de nieuwste regel bovenaan", () => {
    const d = dossier({
      logboek: [
        logregel({ id: "oud", uitgevoerdOp: dag(2026, 1, 1) }),
        logregel({ id: "nieuw", uitgevoerdOp: dag(2026, 6, 1) }),
      ],
    });
    expect(d.logboek.map((r) => r.id)).toEqual(["nieuw", "oud"]);
  });

  it("noemt het onderdeel waar de regel bij hoort", () => {
    const d = dossier({
      onderdelen: [onderdeel({ id: "o1", naam: "WTW-unit" })],
      logboek: [logregel({ onderdeelId: "o1" })],
    });
    expect(d.logboek[0]?.wat).toBe("WTW-unit");
  });

  /**
   * De historie is het waardevolste deel van het dossier (ADR-0010) en mag
   * niet stil uitdunnen doordat een onderdeel verwijderd is.
   */
  /**
   * Een verwijderd onderdeel is iets ánders dan een meeverhuizend onderdeel:
   * geen belofte aan de koper maar een gat in de administratie. Het apparaat
   * kan er nog gewoon hangen, dus de regel blijft — onder de neutrale noemer.
   */
  it("houdt een regel van een verwijderd onderdeel, onder een neutrale noemer", () => {
    const d = dossier({ logboek: [logregel({ onderdeelId: "bestaat-niet", kosten: 60 })] });
    expect(d.logboek).toHaveLength(1);
    expect(d.logboek[0]?.wat).toBe("Onderhoud");
    expect(d.logboekKosten).toBe(60);
  });

  it("houdt een regel zonder onderdeel in het dossier", () => {
    const d = dossier({ logboek: [logregel({})] });
    expect(d.logboek[0]?.wat).toBe("Onderhoud");
  });

  /**
   * DE ACHTERDEUR. Het onderdelenblok laat een meeverhuizend apparaat terecht
   * weg, maar via het logboek stond het er alsnog — mét naam, mét kosten, in
   * een document dat de koper leest als onderhoud aan zíjn huis. Precies de
   * belofte die ADR-0013 §2 en ADR-0016 §4 doen, gebroken langs de zijkant.
   */
  it("laat een logregel van een meeverhuizend onderdeel wég", () => {
    const d = dossier({
      onderdelen: [onderdeel({ id: "o1", naam: "Thuisbatterij", blijftBijWoning: false })],
      logboek: [logregel({ onderdeelId: "o1" })],
    });
    expect(d.logboek).toEqual([]);
  });

  it("telt de kosten van een meeverhuizend onderdeel niet mee", () => {
    const d = dossier({
      onderdelen: [
        onderdeel({ id: "blijft", naam: "Warmtepomp", blijftBijWoning: true }),
        onderdeel({ id: "gaatmee", naam: "Thuisbatterij", blijftBijWoning: false }),
      ],
      logboek: [
        logregel({ id: "a", onderdeelId: "blijft", kosten: 120 }),
        logregel({ id: "b", onderdeelId: "gaatmee", kosten: 180 }),
      ],
    });

    expect(d.logboek).toHaveLength(1);
    expect(d.logboekKosten).toBe(120);
  });

  it("houdt algemeen onderhoud zónder onderdeel wél in het dossier", () => {
    // Dat gaat over het huis zelf en hoort er dus in.
    const d = dossier({ logboek: [logregel({ kosten: 90 })] });
    expect(d.logboek).toHaveLength(1);
    expect(d.logboekKosten).toBe(90);
  });

  it("telt de kosten op", () => {
    const d = dossier({
      logboek: [
        logregel({ id: "a", kosten: 45 }),
        logregel({ id: "b", kosten: 180 }),
        logregel({ id: "c" }),
      ],
    });
    expect(d.logboekKosten).toBe(225);
  });

  it("geeft nul kosten bij een leeg logboek", () => {
    expect(dossier().logboekKosten).toBe(0);
  });
});

// ── Meterstanden op de overdrachtsdatum ────────────────────────────────────

describe("meterstanden", () => {
  it("neemt de laatste stand op of vóór de overdrachtsdatum", () => {
    const d = dossier({
      meters: [meter()],
      meterstanden: [
        meterstand({ id: "a", opgenomenOp: dag(2026, 5, 1), stand: 11000 }),
        meterstand({ id: "b", opgenomenOp: dag(2026, 7, 1), stand: 12345 }),
      ],
    });
    expect(d.meterstanden[0]?.stand).toBe(12345);
  });

  /**
   * Stel je een dossier samen voor een overdracht die al geweest is, dan hoort
   * de stand van vorige week er niet in — er is afgerekend tot die datum.
   */
  it("negeert een stand van ná de overdrachtsdatum", () => {
    const d = dossier(
      {
        meters: [meter()],
        meterstanden: [
          meterstand({ id: "voor", opgenomenOp: dag(2026, 5, 1), stand: 11000 }),
          meterstand({ id: "na", opgenomenOp: dag(2026, 7, 20), stand: 12345 }),
        ],
      },
      dag(2026, 6, 1),
    );

    expect(d.meterstanden[0]?.stand).toBe(11000);
    expect(d.meterstanden[0]?.opgenomenOp).toEqual(dag(2026, 5, 1));
  });

  it("neemt een stand op de overdrachtsdatum zelf wél mee", () => {
    const d = dossier(
      {
        meters: [meter()],
        meterstanden: [meterstand({ opgenomenOp: dag(2026, 6, 1), stand: 12000 })],
      },
      dag(2026, 6, 1),
    );
    expect(d.meterstanden[0]?.stand).toBe(12000);
  });

  /**
   * Zichtbaar onvolledig is beter dan stilzwijgend ontbreken in een document
   * dat de eindafrekening moet onderbouwen.
   */
  it("houdt een meter zonder bruikbare opname in de lijst", () => {
    const d = dossier({ meters: [meter({ id: "m1" })] });
    expect(d.meterstanden).toHaveLength(1);
    expect(d.meterstanden[0]?.stand).toBeUndefined();
    expect(d.meterstanden[0]?.opgenomenOp).toBeUndefined();
  });

  it("neemt naam, eenheid en decimalen over uit de meter", () => {
    const d = dossier({ meters: [meter({ soort: "gas", eenheid: "m3" })] });
    expect(d.meterstanden[0]?.naam).toBe("Gas");
    expect(d.meterstanden[0]?.eenheid).toBe("m³");
    expect(d.meterstanden[0]?.decimalen).toBe(3);
  });

  it("houdt de meters van elkaar gescheiden", () => {
    const d = dossier({
      meters: [meter({ id: "m1" }), meter({ id: "m2", soort: "water", eenheid: "m3" })],
      meterstanden: [
        meterstand({ id: "a", meterId: "m1", stand: 100 }),
        meterstand({ id: "b", meterId: "m2", stand: 200 }),
      ],
    });
    expect(d.meterstanden.map((m) => m.stand)).toEqual([100, 200]);
  });
});

// ── De kop en het paspoort ─────────────────────────────────────────────────

describe("de kop", () => {
  it("gebruikt het adres als titel", () => {
    const d = dossier({
      project: project({
        woningpaspoort: { adres: "Beukenlaan 12", postcode: "1234 AB", plaats: "Almere" },
      }),
    });
    expect(d.kop.titel).toBe("Beukenlaan 12, 1234 AB Almere");
  });

  it("valt terug op de projectnaam zonder adres", () => {
    const d = dossier();
    expect(d.kop.titel).toBe("Ons huis in Almere");
    expect(d.kop.adres).toBeNull();
  });

  it("neemt de overdrachtsdatum over zoals meegegeven", () => {
    const d = dossier({}, dag(2027, 3, 15));
    expect(d.kop.overdrachtOp).toEqual(dag(2027, 3, 15));
  });

  it("neemt waarborg en polisnummer mee", () => {
    const d = dossier({
      project: project({
        garantiewaarborg: "woningborg",
        woningpaspoort: { waarborgpolisnummer: "WB-123456" },
      }),
    });
    expect(d.kop.garantiewaarborg).toBe("woningborg");
    expect(d.kop.waarborgpolisnummer).toBe("WB-123456");
  });
});

describe("het energielabel", () => {
  it("rekent de vervaldatum uit de opnamedatum", () => {
    const d = dossier({
      project: project({
        woningpaspoort: { energielabel: "A++++", energielabelOpnameDatum: dag(2026, 6, 1) },
      }),
    });
    expect(d.energielabel?.verlooptOp).toEqual(dag(2036, 6, 1));
    expect(d.energielabel?.verlopen).toBe(false);
  });

  it("geeft null zonder opnamedatum", () => {
    const d = dossier({ project: project({ woningpaspoort: { energielabel: "A" } }) });
    expect(d.energielabel).toBeNull();
  });
});

// ── Garanties tellen af vanaf vandaag, niet vanaf de overdracht ────────────

describe("garantieklokken", () => {
  it("rekent de garantie af vanaf vandaag en niet vanaf de overdrachtsdatum", () => {
    // Overdracht ligt een jaar in de toekomst; de garantie loopt vandaag nog.
    const d = dossier(
      {
        onderdelen: [
          onderdeel({ installatieDatum: dag(2026, 1, 1), garantieMaanden: 24 }),
        ],
      },
      dag(2027, 8, 1),
    );

    expect(d.onderdelen[0]?.garantie?.verstrijktOp).toEqual(dag(2028, 1, 1));
    expect(d.onderdelen[0]?.garantie?.voorbij).toBe(false);
  });

  it("geeft null zonder installatiedatum", () => {
    const d = dossier({ onderdelen: [onderdeel({ garantieMaanden: 60 })] });
    expect(d.onderdelen[0]?.garantie).toBeNull();
  });

  it("geeft null zonder garantietermijn", () => {
    const d = dossier({ onderdelen: [onderdeel({ installatieDatum: dag(2026, 1, 1) })] });
    expect(d.onderdelen[0]?.garantie).toBeNull();
  });

  it("geeft null bij een garantie van nul maanden", () => {
    const d = dossier({
      onderdelen: [onderdeel({ installatieDatum: dag(2026, 1, 1), garantieMaanden: 0 })],
    });
    expect(d.onderdelen[0]?.garantie).toBeNull();
  });
});

// ── Wat er structureel NIET in de structuur zit (ADR-0016 §4 en §5) ────────

describe("de vorm van het dossier", () => {
  /**
   * Dezelfde bewaking als bij `Dossierbetrokkene`: deze test faalt zodra
   * iemand een veld aan de kop toevoegt, en dwingt daarmee een bewuste keuze
   * af. Koopsom, meerwerkbudget en depotbedragen horen er niet in.
   */
  it("laat op de kop alleen de velden toe die ADR-0016 §4 noemt", () => {
    const d = dossier({
      project: project({
        koopsom: 425000,
        meerwerkbudget: 30000,
        garantiewaarborg: "woningborg",
        opleverStatus: "aangezegd",
        opleverVerwacht: dag(2026, 11, 16),
        woningpaspoort: { adres: "Beukenlaan 12", waarborgpolisnummer: "WB-1" },
      }),
    });

    expect(Object.keys(d.kop).sort()).toEqual([
      "adres",
      "garantiewaarborg",
      "opgeleverdOp",
      "overdrachtOp",
      "titel",
      "waarborgpolisnummer",
    ]);
  });

  /**
   * `Woningpaspoort` bevat ook `notaris` en `hypotheekverstrekker` — gegevens
   * over de verkóper. Die mogen niet in de structuur zitten, ook niet als de
   * huidige weergavelaag ze toevallig niet rendert.
   */
  it("projecteert het paspoort en neemt notaris en hypotheekverstrekker niet over", () => {
    const d = dossier({
      project: project({
        woningpaspoort: {
          adres: "Beukenlaan 12",
          bouwjaar: 2026,
          notaris: "Notaris Jansen",
          hypotheekverstrekker: "De Bank",
        },
      }),
    });

    expect(Object.keys(d.paspoort ?? {})).toEqual(["bouwjaar"]);
  });

  it("noemt het paspoort leeg als er alleen verkopergegevens in staan", () => {
    const d = dossier({
      project: project({ woningpaspoort: { notaris: "Notaris Jansen" } }),
    });
    expect(d.paspoort).toBeUndefined();
  });

  /** Een Drive-link van de verkoper hoort niet op een document voor de koper. */
  it("neemt documentUrl niet over in het dossier", () => {
    const d = dossier({
      onderdelen: [onderdeel({ documentUrl: "https://drive.google.com/file/d/abc/view" })],
    });
    expect(JSON.stringify(d)).not.toContain("drive.google.com");
  });
});

// ── De opleverdatum: alleen als hij een feit is ────────────────────────────

describe("opleverdatum op het voorblad", () => {
  it("toont hem bij een aangezegde oplevering", () => {
    const d = dossier({
      project: project({ opleverStatus: "aangezegd", opleverVerwacht: dag(2026, 11, 16) }),
    });
    expect(d.kop.opgeleverdOp).toEqual(dag(2026, 11, 16));
  });

  /**
   * Bij `indicatief` en `bandbreedte` is `opleverVerwacht` een schatting
   * (ADR-0008), en een schatting hoort niet als feit op een
   * overdrachtsdocument.
   */
  it("laat hem weg bij een indicatieve datum", () => {
    const d = dossier({
      project: project({ opleverStatus: "indicatief", opleverVerwacht: dag(2026, 11, 16) }),
    });
    expect(d.kop.opgeleverdOp).toBeUndefined();
  });

  it("laat hem weg bij een bandbreedte", () => {
    const d = dossier({
      project: project({ opleverStatus: "bandbreedte", opleverVerwacht: dag(2026, 11, 16) }),
    });
    expect(d.kop.opgeleverdOp).toBeUndefined();
  });
});

// ── Meters: volgorde en dubbele dag ────────────────────────────────────────

describe("volgorde en signalering van meters", () => {
  it("sorteert op de volgorde van de bibliotheek, niet op document-id", () => {
    const d = dossier({
      meters: [
        meter({ id: "w", soort: "water", eenheid: "m3" }),
        meter({ id: "eigen", soort: "overig", naam: "Laadpaal" }),
        meter({ id: "s", soort: "stroom_normaal" }),
      ],
    });
    expect(d.meterstanden.map((m) => m.meterId)).toEqual(["s", "w", "eigen"]);
  });

  it("meldt twee opnames op dezelfde dag in plaats van er stil één te kiezen", () => {
    const d = dossier({
      meters: [meter({ id: "m1" })],
      meterstanden: [
        meterstand({ id: "a", opgenomenOp: dag(2026, 7, 1), stand: 12345 }),
        meterstand({ id: "b", opgenomenOp: dag(2026, 7, 1), stand: 12354 }),
      ],
    });
    expect(d.meterstanden[0]?.meerdereOpDag).toBe(true);
  });

  it("meldt niets bij opnames op verschillende dagen", () => {
    const d = dossier({
      meters: [meter({ id: "m1" })],
      meterstanden: [
        meterstand({ id: "a", opgenomenOp: dag(2026, 6, 1), stand: 12000 }),
        meterstand({ id: "b", opgenomenOp: dag(2026, 7, 1), stand: 12345 }),
      ],
    });
    expect(d.meterstanden[0]?.meerdereOpDag).toBe(false);
  });
});

// ── Meldplicht ─────────────────────────────────────────────────────────────

describe("meldplicht", () => {
  it("meldt een openstaande registratieplicht bij het onderdeel", () => {
    const d = dossier({
      onderdelen: [
        onderdeel({
          naam: "Thuisbatterij",
          registratieplicht: { instantie: "Netbeheerder via Energieleveren.nl" },
        }),
      ],
    });
    expect(d.onderdelen[0]?.meldplichtOpen).toBe("Netbeheerder via Energieleveren.nl");
  });

  it("meldt niets zodra de aanmelding gedaan is", () => {
    const d = dossier({
      onderdelen: [
        onderdeel({
          registratieplicht: {
            instantie: "Netbeheerder via Energieleveren.nl",
            aangemeldOp: dag(2026, 4, 1),
          },
        }),
      ],
    });
    expect(d.onderdelen[0]?.meldplichtOpen).toBeUndefined();
  });
});

// ── Aandachtspunten ────────────────────────────────────────────────────────

describe("aandachtspunten", () => {
  it("noemt een ontbrekend adres", () => {
    expect(dossier().aandachtspunten.some((p) => p.includes("adres"))).toBe(true);
  });

  it("noemt een onbekende geldigheid van het energielabel", () => {
    expect(dossier().aandachtspunten.some((p) => p.includes("energielabel"))).toBe(true);
  });

  it("noemt een verlopen energielabel apart", () => {
    const d = dossier({
      project: project({
        woningpaspoort: { energielabel: "A", energielabelOpnameDatum: dag(2010, 1, 1) },
      }),
    });
    expect(d.aandachtspunten.some((p) => p.includes("verlopen"))).toBe(true);
  });

  it("noemt een openstaande meldplicht, want die gaat mee naar de koper", () => {
    const d = dossier({
      onderdelen: [
        onderdeel({ registratieplicht: { instantie: "Netbeheerder" }, serienummer: "X" }),
      ],
    });
    expect(d.aandachtspunten.some((p) => p.includes("meldplicht"))).toBe(true);
  });

  it("noemt ontbrekende serienummers", () => {
    const d = dossier({ onderdelen: [onderdeel({})] });
    expect(d.aandachtspunten.some((p) => p.includes("serienummer"))).toBe(true);
  });

  it("noemt een leeg logboek", () => {
    expect(dossier().aandachtspunten.some((p) => p.includes("logboek"))).toBe(true);
  });

  it("noemt ontbrekende meters", () => {
    expect(dossier().aandachtspunten.some((p) => p.includes("meters"))).toBe(true);
  });

  it("noemt een meter zonder stand op de overdrachtsdatum", () => {
    const d = dossier({ meters: [meter({ soort: "gas", eenheid: "m3" })] });
    expect(d.aandachtspunten.some((p) => p.includes("geen stand"))).toBe(true);
  });

  it("noemt twee opnames op dezelfde dag", () => {
    const d = dossier({
      meters: [meter({ id: "m1" })],
      meterstanden: [
        meterstand({ id: "a", opgenomenOp: dag(2026, 7, 1), stand: 12345 }),
        meterstand({ id: "b", opgenomenOp: dag(2026, 7, 1), stand: 12354 }),
      ],
    });
    expect(d.aandachtspunten.some((p) => p.includes("dezelfde dag"))).toBe(true);
  });

  it("zwijgt over meldplicht van een onderdeel dat meeverhuist", () => {
    // Die verplichting gaat niet mee naar de nieuwe eigenaar.
    const d = dossier({
      onderdelen: [
        onderdeel({
          blijftBijWoning: false,
          registratieplicht: { instantie: "Netbeheerder" },
        }),
      ],
    });
    expect(d.aandachtspunten.some((p) => p.includes("meldplicht"))).toBe(false);
  });

  it("houdt de lijst kort bij een compleet dossier", () => {
    const d = dossier({
      project: project({
        woningpaspoort: {
          adres: "Beukenlaan 12",
          postcode: "1234 AB",
          plaats: "Almere",
          energielabel: "A++++",
          energielabelOpnameDatum: dag(2026, 6, 1),
        },
      }),
      onderdelen: [onderdeel({ serienummer: "NIBE-123" })],
      logboek: [logregel({})],
      // Een meter zónder stand is óók een aandachtspunt: op dit document
      // hangt de eindafrekening met de leverancier. "Compleet" betekent dus
      // ook dat er een opname is.
      meters: [meter()],
      meterstanden: [meterstand({})],
    });
    expect(d.aandachtspunten).toEqual([]);
  });
});

// ── Een leeg project mag niet omvallen ─────────────────────────────────────

describe("lege staat", () => {
  it("levert een bruikbaar dossier op zonder enige data", () => {
    const d = dossier();

    expect(d.onderdelen).toEqual([]);
    expect(d.logboek).toEqual([]);
    expect(d.meterstanden).toEqual([]);
    expect(d.betrokkenen).toEqual([]);
    expect(d.verhuistMee).toBe(0);
    expect(d.paspoort).toBeUndefined();
    expect(d.kop.titel).toBe("Ons huis in Almere");
  });
});
