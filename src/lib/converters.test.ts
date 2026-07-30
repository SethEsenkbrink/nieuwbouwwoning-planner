import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  afspraakNaarFirestore,
  afspraakUitFirestore,
  ankerNaarFirestore,
  ankerUitFirestore,
  betrokkeneNaarFirestore,
  betrokkeneUitFirestore,
  projectNaarFirestore,
  projectUitFirestore,
  zonderLegeVelden,
  type BetrokkeneData,
  type ProjectData,
} from "@/lib/converters";

/**
 * Tests voor de rand van het systeem.
 *
 * Twee dingen die hier misgaan als niemand oplet:
 *   1. Een `undefined` die naar Firestore lekt — die weigert het document.
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

  it("overleeft een rondje Firestore en terug", () => {
    const opgeslagen = projectNaarFirestore(project);
    const terug = projectUitFirestore("p1", opgeslagen);
    expect(terug).toEqual({ ...project, id: "p1" });
  });

  it("zet datums om naar Timestamp bij het schrijven", () => {
    const opgeslagen = projectNaarFirestore(project);
    expect(opgeslagen.opleverVerwacht).toBeInstanceOf(Timestamp);
    expect((opgeslagen.opleverVerwacht as Timestamp).toDate()).toEqual(d("2026-11-16"));
  });

  it("schrijft geen undefined-velden weg", () => {
    const opgeslagen = projectNaarFirestore({ naam: "Kaal", aangemaaktOp: d("2026-07-30") });
    expect(Object.keys(opgeslagen).sort()).toEqual(["aangemaaktOp", "naam"]);
    expect("opleverVerwacht" in opgeslagen).toBe(false);
  });

  it("leest een document zonder opleverdatum zonder te struikelen", () => {
    const terug = projectUitFirestore("p1", {
      naam: "Kaal",
      aangemaaktOp: Timestamp.fromDate(d("2026-07-30")),
    });
    expect(terug.opleverVerwacht).toBeUndefined();
    expect(terug.naam).toBe("Kaal");
  });

  it("weigert een onbekende opleverStatus in plaats van hem door te laten", () => {
    // Zulke data komt niet door de rules, maar kan wel uit een oudere
    // modelversie stammen. Dan liever leeg dan een waarde die nergens past.
    const terug = projectUitFirestore("p1", { naam: "X", opleverStatus: "ooit-eens" });
    expect(terug.opleverStatus).toBeUndefined();
  });

  it("accepteert een kale Date bij het lezen", () => {
    // Zo komt een net geschreven document terug vóór serverbevestiging.
    const terug = projectUitFirestore("p1", { naam: "X", opleverVerwacht: d("2026-11-16") });
    expect(terug.opleverVerwacht).toEqual(d("2026-11-16"));
  });
});

describe("anker", () => {
  it("overleeft een rondje Firestore en terug", () => {
    const anker = {
      type: "dekvloer_gestort",
      titel: "Dekvloer begane grond",
      status: "bevestigd",
      verwachtOp: d("2026-09-08"),
      bron: "bouwvergadering 03-09",
    } as const;
    const terug = ankerUitFirestore("a1", ankerNaarFirestore(anker));
    expect(terug).toEqual({ ...anker, id: "a1" });
  });

  it("behoudt een anker zonder datum", () => {
    const terug = ankerUitFirestore(
      "a1",
      ankerNaarFirestore({ type: "ruwbouw_gereed", titel: "Ruwbouw", status: "verwacht" }),
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

  it("overleeft een rondje Firestore en terug", () => {
    const terug = betrokkeneUitFirestore("b1", betrokkeneNaarFirestore(betrokkene));
    expect(terug).toEqual({ ...betrokkene, id: "b1" });
  });

  it("behoudt annuleertermijn 0 als echte waarde", () => {
    // Nul betekent "niet van toepassing" (notaris, gemeente) en mag niet
    // wegvallen als leeg veld.
    const opgeslagen = betrokkeneNaarFirestore({ ...betrokkene, annuleertermijnDagen: 0 });
    expect(opgeslagen.annuleertermijnDagen).toBe(0);
    expect(betrokkeneUitFirestore("b1", opgeslagen).annuleertermijnDagen).toBe(0);
  });

  it("valt terug op handmatig bij een onbekende communicatieregel", () => {
    // De veiligste terugval: niets automatisch voorstellen.
    const terug = betrokkeneUitFirestore("b1", { naam: "X", communicatieregel: "soms" });
    expect(terug.communicatieregel).toBe("handmatig");
  });

  it("valt terug op voorstel bij een ontbrekende waardenBron", () => {
    // Liever onterecht een disclaimer tonen dan een gok als feit presenteren.
    const terug = betrokkeneUitFirestore("b1", { naam: "X" });
    expect(terug.waardenBron).toBe("voorstel");
  });
});

describe("afspraak", () => {
  it("overleeft een rondje Firestore en terug", () => {
    const afspraak = {
      betrokkeneId: "b1",
      omschrijving: "Vloer leggen",
      ankerType: "dekvloer_gestort",
      offsetDagen: 42,
      status: "voorlopig",
      gecommuniceerdeDatum: d("2026-11-20"),
      waarschuwing: "Let op de droogtijd.",
    } as const;
    const terug = afspraakUitFirestore("af1", afspraakNaarFirestore(afspraak));
    expect(terug).toEqual({ ...afspraak, id: "af1" });
  });

  it("behoudt een negatieve offset", () => {
    // Huur opzeggen: sleuteloverdracht −45.
    const opgeslagen = afspraakNaarFirestore({
      betrokkeneId: "b1",
      omschrijving: "Huur opzeggen",
      ankerType: "sleuteloverdracht",
      offsetDagen: -45,
      status: "concept",
    });
    expect(afspraakUitFirestore("af1", opgeslagen).offsetDagen).toBe(-45);
  });

  it("slaat geen afspraakdatum op", () => {
    // De kern van ADR-0008. Deze test faalt zodra iemand een datumveld aan
    // Afspraak toevoegt dat geen `gecommuniceerde` datum is.
    const opgeslagen = afspraakNaarFirestore({
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
