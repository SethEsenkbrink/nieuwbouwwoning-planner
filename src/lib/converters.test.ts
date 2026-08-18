import { describe, expect, it } from "vitest";
import { Timestamp } from "@/types/model";
import {
  afspraakNaarOpslag,
  afspraakUitOpslag,
  ankerNaarOpslag,
  ankerUitOpslag,
  betrokkeneNaarOpslag,
  betrokkeneUitOpslag,
  meterNaarOpslag,
  meterUitOpslag,
  meterstandNaarOpslag,
  meterstandUitOpslag,
  onderdeelNaarOpslag,
  onderdeelUitOpslag,
  projectNaarOpslag,
  projectUitOpslag,
  zonderLegeVelden,
  type BetrokkeneData,
  type MeterData,
  type MeterstandData,
  type OnderdeelData,
  type ProjectData,
} from "@/lib/converters";

/**
 * Tests voor de rand van het systeem.
 *
 * Twee dingen die hier misgaan als niemand oplet:
 *   1. Een `undefined` die naar de opslag lekt — die weigert het document.
 *   2. Een `Timestamp` die als `Date` behandeld wordt (of andersom). Dat valt
 *      pas om ver van de oorzaak, meestal in een rekenfunctie.
 *
 * Daarom staat er op elke collectie een heen-en-weer-test.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("zonderLegeVelden", () => {
  it("laat undefined-velden weg", () => {
    expect(zonderLegeVelden({ a: 1, b: undefined, c: "x" })).toEqual({ a: 1, c: "x" });
  });

  it("behoudt null, 0 en lege string", () => {
    // Alleen `undefined` betekent "niet ingevuld". Nul is een waarde:
    // annuleertermijnDagen 0 betekent "niets te annuleren".
    expect(zonderLegeVelden({ a: 0, b: "", c: false })).toEqual({ a: 0, b: "", c: false });
  });
});

describe("project", () => {
  const project: ProjectData = {
    naam: "Ons huis in Almere",
    bouwnummer: "B-42",
    aannemer: "Bouwbedrijf Jansen",
    garantiewaarborg: "woningborg",
    koopsom: 425000,
    opleverStatus: "bandbreedte",
    opleverVroegst: d("2026-11-02"),
    opleverVerwacht: d("2026-11-16"),
    opleverLaatst: d("2026-12-14"),
    opleverBron: "mail aannemer 12-07",
    opleverBronDatum: d("2026-07-12"),
    aangemaaktOp: d("2026-07-30"),
  };

  it("overleeft een rondje opslag en terug", () => {
    const opgeslagen = projectNaarOpslag(project);
    const terug = projectUitOpslag("p1", opgeslagen);
    expect(terug).toEqual({ ...project, id: "p1" });
  });

  it("zet datums om naar Timestamp bij het schrijven", () => {
    const opgeslagen = projectNaarOpslag(project);
    expect(opgeslagen.opleverVerwacht).toBeInstanceOf(Timestamp);
    expect((opgeslagen.opleverVerwacht as Timestamp).toDate()).toEqual(d("2026-11-16"));
  });

  it("schrijft geen undefined-velden weg", () => {
    const opgeslagen = projectNaarOpslag({ naam: "Kaal", aangemaaktOp: d("2026-07-30") });
    expect(Object.keys(opgeslagen).sort()).toEqual(["aangemaaktOp", "naam"]);
    expect("opleverVerwacht" in opgeslagen).toBe(false);
  });

  it("leest een document zonder opleverdatum zonder te struikelen", () => {
    const terug = projectUitOpslag("p1", {
      naam: "Kaal",
      aangemaaktOp: Timestamp.fromDate(d("2026-07-30")),
    });
    expect(terug.opleverVerwacht).toBeUndefined();
    expect(terug.naam).toBe("Kaal");
  });

  it("weigert een onbekende opleverStatus in plaats van hem door te laten", () => {
    // Zulke data komt niet door de rules, maar kan wel uit een oudere
    // modelversie stammen. Dan liever leeg dan een waarde die nergens past.
    const terug = projectUitOpslag("p1", { naam: "X", opleverStatus: "ooit-eens" });
    expect(terug.opleverStatus).toBeUndefined();
  });

  it("accepteert een kale Date bij het lezen", () => {
    // Zo komt een net geschreven document terug vóór serverbevestiging.
    const terug = projectUitOpslag("p1", { naam: "X", opleverVerwacht: d("2026-11-16") });
    expect(terug.opleverVerwacht).toEqual(d("2026-11-16"));
  });
});

describe("anker", () => {
  it("overleeft een rondje opslag en terug", () => {
    const anker = {
      type: "dekvloer_gestort",
      titel: "Dekvloer begane grond",
      status: "bevestigd",
      verwachtOp: d("2026-09-08"),
      bron: "bouwvergadering 03-09",
    } as const;
    const terug = ankerUitOpslag("a1", ankerNaarOpslag(anker));
    expect(terug).toEqual({ ...anker, id: "a1" });
  });

  it("behoudt een anker zonder datum", () => {
    const terug = ankerUitOpslag(
      "a1",
      ankerNaarOpslag({ type: "ruwbouw_gereed", titel: "Ruwbouw", status: "verwacht" }),
    );
    expect(terug.verwachtOp).toBeUndefined();
    expect(terug.type).toBe("ruwbouw_gereed");
  });
});

describe("betrokkene", () => {
  const betrokkene: BetrokkeneData = {
    naam: "Keukenstudio Van Dijk",
    categorie: "installatie",
    aanlooptijdDagen: 70,
    annuleertermijnDagen: 21,
    communicatieregel: "direct",
    waardenBron: "voorstel",
  };

  it("overleeft een rondje opslag en terug", () => {
    const terug = betrokkeneUitOpslag("b1", betrokkeneNaarOpslag(betrokkene));
    expect(terug).toEqual({ ...betrokkene, id: "b1" });
  });

  it("behoudt annuleertermijn 0 als echte waarde", () => {
    // Nul betekent "niet van toepassing" (notaris, gemeente) en mag niet
    // wegvallen als leeg veld.
    const opgeslagen = betrokkeneNaarOpslag({ ...betrokkene, annuleertermijnDagen: 0 });
    expect(opgeslagen.annuleertermijnDagen).toBe(0);
    expect(betrokkeneUitOpslag("b1", opgeslagen).annuleertermijnDagen).toBe(0);
  });

  it("valt terug op handmatig bij een onbekende communicatieregel", () => {
    // De veiligste terugval: niets automatisch voorstellen.
    const terug = betrokkeneUitOpslag("b1", { naam: "X", communicatieregel: "soms" });
    expect(terug.communicatieregel).toBe("handmatig");
  });

  it("valt terug op voorstel bij een ontbrekende waardenBron", () => {
    // Liever onterecht een disclaimer tonen dan een gok als feit presenteren.
    const terug = betrokkeneUitOpslag("b1", { naam: "X" });
    expect(terug.waardenBron).toBe("voorstel");
  });
});

describe("afspraak", () => {
  it("overleeft een rondje opslag en terug", () => {
    const afspraak = {
      betrokkeneId: "b1",
      omschrijving: "Vloer leggen",
      ankerType: "dekvloer_gestort",
      offsetDagen: 42,
      status: "voorlopig",
      gecommuniceerdeDatum: d("2026-11-20"),
      waarschuwing: "Let op de droogtijd.",
    } as const;
    const terug = afspraakUitOpslag("af1", afspraakNaarOpslag(afspraak));
    expect(terug).toEqual({ ...afspraak, id: "af1" });
  });

  it("behoudt een negatieve offset", () => {
    // Huur opzeggen: sleuteloverdracht −45.
    const opgeslagen = afspraakNaarOpslag({
      betrokkeneId: "b1",
      omschrijving: "Huur opzeggen",
      ankerType: "sleuteloverdracht",
      offsetDagen: -45,
      status: "concept",
    });
    expect(afspraakUitOpslag("af1", opgeslagen).offsetDagen).toBe(-45);
  });

  it("slaat geen afspraakdatum op", () => {
    // De kern van ADR-0008. Deze test faalt zodra iemand een datumveld aan
    // Afspraak toevoegt dat geen `gecommuniceerde` datum is.
    const opgeslagen = afspraakNaarOpslag({
      betrokkeneId: "b1",
      omschrijving: "Vloer leggen",
      ankerType: "dekvloer_gestort",
      offsetDagen: 42,
      status: "concept",
    });
    const datumVelden = Object.entries(opgeslagen)
      .filter(([, waarde]) => waarde instanceof Timestamp)
      .map(([sleutel]) => sleutel);
    expect(datumVelden).toEqual([]);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Woningpaspoort — de eerste geneste map in het model (ADR-0013 §5)
 *
 * Twee dingen die hier stil fout kunnen gaan:
 *   1. `MetDatums` is niet recursief, dus `energielabelOpnameDatum` zou als
 *      `Timestamp` blijven staan als de omzetting hier niet expliciet is.
 *   2. Een lege map moet `undefined` worden. Een leeg object zou in de opslag
 *      een veld bezetten en in de UI als "ingevuld" tellen.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("woningpaspoort", () => {
  const paspoort: ProjectData["woningpaspoort"] = {
    adres: "Dorpsstraat 1",
    postcode: "1234 AB",
    plaats: "Almere",
    woningtype: "tussenwoning",
    bouwjaar: 2026,
    woonoppervlakte: 124,
    energielabel: "A++++",
    energielabelRegistratie: "0123456789",
    energielabelOpnameDatum: d("2026-09-01"),
  };

  it("schrijft de opnamedatum als Timestamp weg", () => {
    const data = projectNaarOpslag({ naam: "Ons huis", woningpaspoort: paspoort });
    const geschreven = data.woningpaspoort as Record<string, unknown>;
    expect(geschreven.energielabelOpnameDatum).toBeInstanceOf(Timestamp);
    expect(geschreven.adres).toBe("Dorpsstraat 1");
  });

  it("leest de opnamedatum terug als Date", () => {
    const gelezen = projectUitOpslag("p1", {
      naam: "Ons huis",
      aangemaaktOp: Timestamp.fromDate(d("2026-01-01")),
      woningpaspoort: {
        adres: "Dorpsstraat 1",
        energielabelOpnameDatum: Timestamp.fromDate(d("2026-09-01")),
      },
    });
    expect(gelezen.woningpaspoort?.energielabelOpnameDatum).toBeInstanceOf(Date);
    expect(gelezen.woningpaspoort?.energielabelOpnameDatum).toEqual(d("2026-09-01"));
  });

  /**
   * Zo bouwt `Woning.tsx` de map: lege velden worden weggelaten in plaats van
   * op `undefined` gezet. Blijft er niets over, dan mag er geen lege map naar
   * de opslag — die zou als "ingevuld" tellen.
   */
  it("laat een paspoort zonder enig gevuld veld weg", () => {
    const data = projectNaarOpslag({ naam: "Ons huis", woningpaspoort: {} });
    expect("woningpaspoort" in data).toBe(false);
    expect(Object.keys(data).sort()).toEqual(["naam"]);
  });

  it("geeft undefined terug als het paspoort geen map is", () => {
    const gelezen = projectUitOpslag("p1", {
      naam: "Ons huis",
      aangemaaktOp: Timestamp.fromDate(d("2026-01-01")),
      woningpaspoort: "Dorpsstraat 1, Almere",
    });
    expect(gelezen.woningpaspoort).toBeUndefined();
  });

  it("negeert een onbekend woningtype in plaats van het door te geven", () => {
    const gelezen = projectUitOpslag("p1", {
      naam: "Ons huis",
      aangemaaktOp: Timestamp.fromDate(d("2026-01-01")),
      woningpaspoort: { adres: "Dorpsstraat 1", woningtype: "woonboot" },
    });
    expect(gelezen.woningpaspoort?.woningtype).toBeUndefined();
    expect(gelezen.woningpaspoort?.adres).toBe("Dorpsstraat 1");
  });

  it("valt terug op afwezig bij een onbekende woningStatus", () => {
    const gelezen = projectUitOpslag("p1", {
      naam: "Ons huis",
      aangemaaktOp: Timestamp.fromDate(d("2026-01-01")),
      woningStatus: "bijna_klaar",
    });
    expect(gelezen.woningStatus).toBeUndefined();
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Onderdelen — de vrije specs-map en de terugvallen (ADR-0013)
 *
 * De terugvallen zijn hier belangrijker dan bij de andere collecties, omdat ze
 * juridische betekenis dragen: `montage` bepaalt of er installatiegarantie bij
 * hoort en `blijftBijWoning` wat er in het overdrachtsdossier komt.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("onderdelen", () => {
  const onderdeel: OnderdeelData = {
    naam: "Warmtepomp",
    categorie: "verwarming",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    merk: "NIBE",
    specs: { vermogen: "8 kW", koudemiddel: "R290" },
    installatieDatum: d("2026-09-15"),
    garantieMaanden: 60,
  };

  it("schrijft en leest een onderdeel heen en weer", () => {
    const data = onderdeelNaarOpslag(onderdeel);
    expect(data.installatieDatum).toBeInstanceOf(Timestamp);

    const gelezen = onderdeelUitOpslag("o1", {
      ...data,
      installatieDatum: Timestamp.fromDate(d("2026-09-15")),
    });
    expect(gelezen.installatieDatum).toEqual(d("2026-09-15"));
    expect(gelezen.specs).toEqual({ vermogen: "8 kW", koudemiddel: "R290" });
    expect(gelezen.montage).toBe("vast_geinstalleerd");
  });

  it("laat lege specwaarden weg bij het schrijven", () => {
    const data = onderdeelNaarOpslag({
      ...onderdeel,
      specs: { vermogen: "8 kW", scop: "", koudemiddel: "  " },
    });
    expect(data.specs).toEqual({ vermogen: "8 kW" });
  });

  it("laat een volledig lege specs-map weg", () => {
    const data = onderdeelNaarOpslag({ ...onderdeel, specs: { leeg: "" } });
    expect("specs" in data).toBe(false);
  });

  it("negeert specwaarden die geen string zijn", () => {
    const gelezen = onderdeelUitOpslag("o1", {
      naam: "Warmtepomp",
      categorie: "verwarming",
      montage: "vast_geinstalleerd",
      blijftBijWoning: true,
      specs: { vermogen: "8 kW", aantal: 3, genest: { iets: "x" } },
    });
    expect(gelezen.specs).toEqual({ vermogen: "8 kW" });
  });

  /** C2-vangnet: de map mag geen opslagbak worden, ook niet bij het lezen. */
  it("kapt een te grote specs-map af bij het lezen", () => {
    const veel: Record<string, string> = {};
    for (let i = 0; i < 50; i += 1) veel[`spec${i}`] = "waarde";

    const gelezen = onderdeelUitOpslag("o1", {
      naam: "Warmtepomp",
      categorie: "verwarming",
      montage: "vast_geinstalleerd",
      blijftBijWoning: true,
      specs: veel,
    });
    expect(Object.keys(gelezen.specs ?? {})).toHaveLength(30);
  });

  /**
   * Terugval op "nvt" en niet op een van de twee echte montagevormen: een
   * onbekende waarde mag geen installatiegarantie suggereren die er niet is.
   */
  it("valt bij een onbekende montagevorm terug op nvt", () => {
    const gelezen = onderdeelUitOpslag("o1", {
      naam: "Warmtepomp",
      categorie: "verwarming",
      montage: "een_beetje_vast",
      blijftBijWoning: true,
    });
    expect(gelezen.montage).toBe("nvt");
  });

  /**
   * Terugval op true: onterecht "blijft achter" tonen is minder schadelijk dan
   * een onderdeel stilzwijgend uit het overdrachtsdossier laten vallen.
   */
  it("valt bij een ontbrekende blijftBijWoning terug op true", () => {
    const gelezen = onderdeelUitOpslag("o1", {
      naam: "Warmtepomp",
      categorie: "verwarming",
      montage: "vast_geinstalleerd",
    });
    expect(gelezen.blijftBijWoning).toBe(true);
  });

  it("respecteert blijftBijWoning false", () => {
    const gelezen = onderdeelUitOpslag("o1", {
      naam: "Thuisbatterij",
      categorie: "opslag",
      montage: "plug_and_play",
      blijftBijWoning: false,
    });
    expect(gelezen.blijftBijWoning).toBe(false);
  });

  it("valt bij een onbekende categorie terug op overig", () => {
    const gelezen = onderdeelUitOpslag("o1", {
      naam: "Iets",
      categorie: "tuinkabouter",
      montage: "nvt",
      blijftBijWoning: true,
    });
    expect(gelezen.categorie).toBe("overig");
  });

  it("negeert een registratieplicht zonder instantie", () => {
    const gelezen = onderdeelUitOpslag("o1", {
      naam: "Thuisbatterij",
      categorie: "opslag",
      montage: "plug_and_play",
      blijftBijWoning: false,
      registratieplicht: { referentie: "EL-2026-88213" },
    });
    expect(gelezen.registratieplicht).toBeUndefined();
  });

  it("leest de aanmelddatum van een registratieplicht als Date", () => {
    const gelezen = onderdeelUitOpslag("o1", {
      naam: "Thuisbatterij",
      categorie: "opslag",
      montage: "plug_and_play",
      blijftBijWoning: false,
      registratieplicht: {
        instantie: "Netbeheerder via Energieleveren.nl",
        aangemeldOp: Timestamp.fromDate(d("2026-10-01")),
      },
    });
    expect(gelezen.registratieplicht?.aangemeldOp).toEqual(d("2026-10-01"));
  });

  it("schrijft geen registratieplicht weg zonder instantie", () => {
    const data = onderdeelNaarOpslag({
      ...onderdeel,
      registratieplicht: { instantie: "", referentie: "x" },
    });
    expect("registratieplicht" in data).toBe(false);
  });
});

// ── Meters en meterstanden (ADR-0015) ──────────────────────────────────────

describe("meterconverters", () => {
  const meter: MeterData = {
    soort: "stroom_normaal",
    eenheid: "kWh",
    waardenBron: "voorstel",
  };

  it("schrijft een minimale meter weg zonder lege velden", () => {
    const data = meterNaarOpslag(meter);
    expect(data).toEqual({ soort: "stroom_normaal", eenheid: "kWh", waardenBron: "voorstel" });
    expect("naam" in data).toBe(false);
    expect("meternummer" in data).toBe(false);
  });

  it("neemt alle optionele velden mee als ze gevuld zijn", () => {
    const data = meterNaarOpslag({
      ...meter,
      naam: "Tussenmeter warmtepomp",
      meternummer: "E0043007000123456",
      notitie: "Onderste display",
    });
    expect(data.naam).toBe("Tussenmeter warmtepomp");
    expect(data.meternummer).toBe("E0043007000123456");
    expect(data.notitie).toBe("Onderste display");
  });

  it("leest een volledige meter terug", () => {
    const gelezen = meterUitOpslag("m1", {
      soort: "gas",
      naam: "Gasmeter garage",
      eenheid: "m3",
      meternummer: "G4-0012",
      notitie: "Achter het luik",
      waardenBron: "eigen",
    });
    expect(gelezen).toEqual({
      id: "m1",
      soort: "gas",
      naam: "Gasmeter garage",
      eenheid: "m3",
      meternummer: "G4-0012",
      notitie: "Achter het luik",
      waardenBron: "eigen",
    });
  });

  it("valt bij een onbekende soort terug op overig", () => {
    const gelezen = meterUitOpslag("m1", {
      soort: "kernreactor",
      eenheid: "kWh",
      waardenBron: "eigen",
    });
    expect(gelezen.soort).toBe("overig");
  });

  it("valt bij een onbekende eenheid terug op kWh", () => {
    const gelezen = meterUitOpslag("m1", {
      soort: "water",
      eenheid: "emmers",
      waardenBron: "eigen",
    });
    expect(gelezen.eenheid).toBe("kWh");
  });

  /** ADR-0009: liever onterecht een disclaimer dan een schatting als eigen cijfer. */
  it("valt bij een ontbrekende waardenBron terug op voorstel", () => {
    const gelezen = meterUitOpslag("m1", { soort: "water", eenheid: "m3" });
    expect(gelezen.waardenBron).toBe("voorstel");
  });

  it("negeert een lege naam in plaats van hem als naam te bewaren", () => {
    const gelezen = meterUitOpslag("m1", {
      soort: "water",
      naam: "",
      eenheid: "m3",
      waardenBron: "eigen",
    });
    expect(gelezen.naam).toBeUndefined();
  });
});

describe("meterstandconverters", () => {
  const stand: MeterstandData = {
    meterId: "m1",
    opgenomenOp: d("2026-07-01"),
    stand: 12345,
  };

  it("schrijft de datum weg als Timestamp", () => {
    const data = meterstandNaarOpslag(stand);
    expect(data.opgenomenOp).toBeInstanceOf(Timestamp);
    expect(data.stand).toBe(12345);
  });

  it("leest de datum terug als Date", () => {
    const gelezen = meterstandUitOpslag("s1", {
      meterId: "m1",
      opgenomenOp: Timestamp.fromDate(d("2026-07-01")),
      stand: 12345,
    });
    expect(gelezen.opgenomenOp).toEqual(d("2026-07-01"));
    expect(gelezen.stand).toBe(12345);
  });

  it("bewaart decimalen, voor gas en water", () => {
    const gelezen = meterstandUitOpslag("s1", {
      meterId: "m1",
      opgenomenOp: Timestamp.fromDate(d("2026-07-01")),
      stand: 1234.567,
    });
    expect(gelezen.stand).toBeCloseTo(1234.567, 10);
  });

  it("accepteert een stand van nul — een vervangen meter begint daar", () => {
    const gelezen = meterstandUitOpslag("s1", {
      meterId: "m1",
      opgenomenOp: Timestamp.fromDate(d("2026-07-01")),
      stand: 0,
    });
    expect(gelezen.stand).toBe(0);
  });

  /**
   * Een negatieve stand zou het verbruik van twee opeenvolgende periodes
   * vergiftigen. Hij valt terug op 0, en de rekenkern markeert de periode
   * eromheen vanzelf als onbetrouwbaar.
   */
  it("weigert een negatieve stand en valt terug op nul", () => {
    const gelezen = meterstandUitOpslag("s1", {
      meterId: "m1",
      opgenomenOp: Timestamp.fromDate(d("2026-07-01")),
      stand: -500,
    });
    expect(gelezen.stand).toBe(0);
  });

  it("valt bij een stand die geen getal is terug op nul", () => {
    const gelezen = meterstandUitOpslag("s1", {
      meterId: "m1",
      opgenomenOp: Timestamp.fromDate(d("2026-07-01")),
      stand: "12345",
    });
    expect(gelezen.stand).toBe(0);
  });

  it("valt bij een ontbrekende datum terug op epoch in plaats van te crashen", () => {
    const gelezen = meterstandUitOpslag("s1", { meterId: "m1", stand: 100 });
    expect(gelezen.opgenomenOp).toEqual(new Date(0));
  });

  /**
   * De rules hebben hier een `keys().hasOnly(...)`, maar de converter is de
   * tweede laag: wat er ook in het document staat, er komt nooit een afgeleid
   * veld uit.
   */
  it("laat een opgeslagen verbruik niet doorlekken naar het model", () => {
    const gelezen = meterstandUitOpslag("s1", {
      meterId: "m1",
      opgenomenOp: Timestamp.fromDate(d("2026-07-01")),
      stand: 12345,
      verbruik: 350,
    });
    expect("verbruik" in gelezen).toBe(false);
  });

  /**
   * De tegenhanger van de rules-whitelist, aan de schrijfkant. De converter
   * noemt zijn velden expliciet, dus er kan er nooit één bijkomen zonder dat
   * iemand het opschrijft. Deze test legt die lijst vast: breidt hij uit, dan
   * moet ook `keys().hasOnly(...)` in de rules mee (en `verify:rules` zegt dat).
   */
  it("schrijft precies de vier velden weg die het model kent", () => {
    const data = meterstandNaarOpslag({
      ...stand,
      notitie: "Samen met de jaarafrekening",
    });
    expect(Object.keys(data).sort()).toEqual(["meterId", "notitie", "opgenomenOp", "stand"]);
  });
});
