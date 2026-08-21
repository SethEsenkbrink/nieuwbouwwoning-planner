import { describe, expect, it } from "vitest";
import type { ProjectMetId } from "@/lib/converters";
import {
  LEGE_WIZARDWAARDEN,
  contractPatch,
  controleerStap,
  financieelPatch,
  hypotheekPatch,
  leesGetalInvoer,
  projectnaamVan,
  uitProject,
  woningpaspoortPatch,
  type Wizardwaarden,
} from "./waarden";

function waarden(patch: Partial<Wizardwaarden> = {}): Wizardwaarden {
  return { ...LEGE_WIZARDWAARDEN, ...patch };
}

describe("leesGetalInvoer", () => {
  it("leest een gewoon getal", () => {
    expect(leesGetalInvoer("2026")).toBe(2026);
  });

  it("accepteert de komma als decimaalteken", () => {
    // Dat is wat een Nederlands toetsenbord geeft.
    expect(leesGetalInvoer("3,85")).toBe(3.85);
  });

  it("geeft undefined bij leeg of onleesbaar", () => {
    expect(leesGetalInvoer("")).toBeUndefined();
    expect(leesGetalInvoer("   ")).toBeUndefined();
    expect(leesGetalInvoer("ongeveer vier")).toBeUndefined();
  });

  it("maakt van onleesbare invoer geen 0", () => {
    // Een rente van 0% zou anders als feit in het dossier belanden.
    expect(leesGetalInvoer("n.v.t.")).not.toBe(0);
  });
});

describe("projectnaamVan", () => {
  it("gebruikt de eigen naam als die er is", () => {
    expect(projectnaamVan(waarden({ naam: "Ons huis in Almere" }))).toBe("Ons huis in Almere");
  });

  it("valt terug op straat en huisnummer", () => {
    expect(projectnaamVan(waarden({ adres: "Hoveniersweg", huisnummer: "12" }))).toBe(
      "Hoveniersweg 12",
    );
  });

  it("valt daarna terug op de plaats", () => {
    expect(projectnaamVan(waarden({ plaats: "Almere" }))).toBe("Almere");
  });

  it("levert nooit een lege naam op", () => {
    expect(projectnaamVan(waarden())).toBe("Mijn nieuwbouwwoning");
    expect(projectnaamVan(waarden({ traject: "bestaandeBouw" }))).toBe("Mijn woning");
  });

  it("negeert een naam die alleen uit spaties bestaat", () => {
    expect(projectnaamVan(waarden({ naam: "   ", plaats: "Almere" }))).toBe("Almere");
  });
});

describe("woningpaspoortPatch", () => {
  it("laat lege velden helemaal weg", () => {
    // Niet op undefined zetten: exactOptionalPropertyTypes maakt daar een
    // ander ding van dan weglaten, en de opslaglaag weigert het.
    expect(woningpaspoortPatch(waarden())).toEqual({});
  });

  it("neemt de ingevulde velden mee en trimt ze", () => {
    const patch = woningpaspoortPatch(
      waarden({ adres: "  Hoveniersweg  ", plaats: "Almere", woningtype: "hoekwoning" }),
    );
    expect(patch).toEqual({ adres: "Hoveniersweg", plaats: "Almere", woningtype: "hoekwoning" });
  });

  it("zet getallen om en laat onleesbare invoer weg", () => {
    const patch = woningpaspoortPatch(
      waarden({ bouwjaar: "2026", woonoppervlakte: "128,5", perceeloppervlakte: "onbekend" }),
    );
    expect(patch).toEqual({ bouwjaar: 2026, woonoppervlakte: 128.5 });
  });

  it("bouwt de kadastermap alleen als er iets in staat", () => {
    expect(woningpaspoortPatch(waarden()).kadaster).toBeUndefined();
    expect(
      woningpaspoortPatch(waarden({ kadasterGemeente: "Almere", kadasterSectie: "K" })).kadaster,
    ).toEqual({ gemeente: "Almere", sectie: "K" });
  });

  it("neemt de transportdatum mee", () => {
    const datum = new Date("2026-09-01T00:00:00.000Z");
    expect(woningpaspoortPatch(waarden({ transportdatum: datum })).transportdatum).toBe(datum);
  });
});

describe("hypotheekPatch", () => {
  it("geeft niets terug als er niets is ingevuld", () => {
    // Een map met alleen de standaardlooptijd erin telt in de UI als
    // "ingevuld" en levert een maandlast op die nergens op slaat.
    expect(hypotheekPatch(waarden())).toBeUndefined();
  });

  it("blijft leeg als alleen de looptijd op zijn standaard staat", () => {
    expect(hypotheekPatch(waarden({ hypotheekLooptijdJaren: "30" }))).toBeUndefined();
  });

  it("rekent de looptijd om naar maanden zodra er iets echt is ingevuld", () => {
    const patch = hypotheekPatch(
      waarden({ hypotheekBedrag: "380.000", hypotheekLooptijdJaren: "30" }),
    );
    expect(patch?.bedrag).toBe(380000);
    expect(patch?.looptijdMaanden).toBe(360);
  });

  it("leest een rente met komma", () => {
    const patch = hypotheekPatch(waarden({ hypotheekRente: "3,85" }));
    expect(patch?.rente).toBe(3.85);
  });

  it("neemt de passeerdatum mee — daar hangt de 24-maandenregel aan", () => {
    const datum = new Date("2026-03-16T00:00:00.000Z");
    expect(hypotheekPatch(waarden({ passeerdatum: datum }))?.passeerdatum).toBe(datum);
  });
});

describe("financieelPatch", () => {
  it("laat alles weg wat leeg is", () => {
    expect(financieelPatch(waarden())).toEqual({});
  });

  it("leest bedragen in Nederlandse schrijfwijze", () => {
    const patch = financieelPatch(
      waarden({ koopsom: "385.000", meerwerkbudget: "25.000", bouwdepot: "185.000" }),
    );
    expect(patch.koopsom).toBe(385000);
    expect(patch.meerwerkbudget).toBe(25000);
    expect(patch.bouwdepotBedrag).toBe(185000);
  });

  it("neemt de hypotheek als geneste map mee", () => {
    const patch = financieelPatch(waarden({ hypotheekBedrag: "380.000", hypotheekVorm: "lineair" }));
    expect(patch.hypotheek?.bedrag).toBe(380000);
    expect(patch.hypotheek?.vorm).toBe("lineair");
  });

  it("neemt het 5%-depotbedrag mee", () => {
    expect(financieelPatch(waarden({ opschortingBedrag: "17.500" })).opschortingBedrag).toBe(17500);
  });
});

describe("contractPatch", () => {
  it("zet de waarborg altijd, ook als de rest leeg is", () => {
    // De waarborg heeft een standaardkeuze en is nooit "niet ingevuld".
    expect(contractPatch(waarden())).toEqual({ garantiewaarborg: "woningborg" });
  });

  it("neemt aannemer, bouwnummer en projectnaam mee", () => {
    const patch = contractPatch(
      waarden({ aannemer: "Van der Meer BV", bouwnummer: "42", ontwikkelaar: "De Hovenbuurt" }),
    );
    expect(patch).toEqual({
      aannemer: "Van der Meer BV",
      bouwnummer: "42",
      projectnaam: "De Hovenbuurt",
      garantiewaarborg: "woningborg",
    });
  });
});

describe("controleerStap — woning", () => {
  it("eist bij een verplichte stap een adres of een bouwnummer", () => {
    const fout = controleerStap("woning", waarden({ naam: "Ons huis" }), true);
    expect(fout).toContain("adres");
  });

  it("neemt genoegen met een bouwnummer als het adres nog niet bestaat", () => {
    expect(controleerStap("woning", waarden({ naam: "Ons huis", bouwnummer: "42" }), true)).toBeNull();
  });

  it("eist niets als de stap optioneel is", () => {
    expect(controleerStap("woning", waarden(), false)).toBeNull();
  });

  it("weigert een bouwjaar dat geen getal is", () => {
    expect(controleerStap("woning", waarden({ bouwjaar: "vorig jaar" }), false)).toContain(
      "geen getal",
    );
  });

  it("weigert een bouwjaar van twee cijfers", () => {
    // "26" zou als jaar 26 na Christus in de opslag belanden.
    expect(controleerStap("woning", waarden({ bouwjaar: "26" }), false)).toContain("vier cijfers");
  });

  it("weigert een oppervlakte die geen getal is", () => {
    expect(controleerStap("woning", waarden({ woonoppervlakte: "ruim" }), false)).toContain(
      "woonoppervlakte",
    );
  });
});

describe("controleerStap — financieel", () => {
  it("weigert een onleesbaar bedrag, ook bij een optionele stap", () => {
    // Anders slaat de wizard stil niets op en denkt de gebruiker dat het is
    // gelukt.
    expect(controleerStap("financieel", waarden({ koopsom: "ongeveer vier ton" }), false)).toContain(
      "koopsom",
    );
  });

  it("eist de koopsom zodra de stap verplicht is", () => {
    expect(controleerStap("financieel", waarden(), true)).toContain("koopsom");
  });

  it("laat een compleet ingevuld formulier door", () => {
    const compleet = waarden({
      koopsom: "385.000",
      meerwerkbudget: "25.000",
      bouwdepot: "185.000",
      hypotheekBedrag: "380.000",
      hypotheekRente: "3,85",
      depotRente: "3,85",
    });
    expect(controleerStap("financieel", compleet, true)).toBeNull();
  });

  it("vangt een rente waar iemand het bedrag heeft ingevuld", () => {
    const fout = controleerStap("financieel", waarden({ koopsom: "1", hypotheekRente: "380000" }), true);
    expect(fout).toContain("percentage");
  });

  it("weigert een negatieve rente", () => {
    expect(controleerStap("financieel", waarden({ koopsom: "1", depotRente: "-2" }), true)).toContain(
      "depotrente",
    );
  });

  it("accepteert een rente van 0 — dat komt voor bij een depot", () => {
    expect(controleerStap("financieel", waarden({ koopsom: "1", depotRente: "0" }), true)).toBeNull();
  });
});

describe("uitProject", () => {
  const project: ProjectMetId = {
    id: "p1",
    naam: "Ons huis in Almere",
    traject: "bestaandeBouw",
    koopsom: 385000,
    bouwdepotBedrag: 185000,
    aannemer: "Van der Meer BV",
    woningpaspoort: { adres: "Hoveniersweg", huisnummer: "12", woningtype: "hoekwoning" },
    hypotheek: { bedrag: 380000, rente: 3.85, vorm: "annuitair", looptijdMaanden: 360 },
    aangemaaktOp: new Date("2026-01-05T00:00:00.000Z"),
  };

  it("vult het formulier met wat er al staat", () => {
    const gevuld = uitProject(project, "in_beheer");
    expect(gevuld.naam).toBe("Ons huis in Almere");
    expect(gevuld.traject).toBe("bestaandeBouw");
    expect(gevuld.adres).toBe("Hoveniersweg");
    expect(gevuld.huisnummer).toBe("12");
    expect(gevuld.woningtype).toBe("hoekwoning");
    expect(gevuld.aannemer).toBe("Van der Meer BV");
    expect(gevuld.moment).toBe("in_beheer");
  });

  it("rekent de looptijd terug naar jaren", () => {
    expect(uitProject(project, "in_beheer").hypotheekLooptijdJaren).toBe("30");
  });

  it("toont bedragen in de schrijfwijze van het invoerveld", () => {
    const gevuld = uitProject(project, "in_beheer");
    expect(gevuld.koopsom).toBe("385.000");
    expect(gevuld.bouwdepot).toBe("185.000");
  });

  it("laat de naam leeg bij een placeholdernaam", () => {
    // "Naamloos project" is de terugvalwaarde van de converter, geen keuze van
    // de gebruiker. Die in het naamveld zetten zou hem als eigen naam opslaan.
    const naamloos = uitProject({ ...project, naam: "Naamloos project" }, "in_beheer");
    expect(naamloos.naam).toBe("");
  });

  it("overleeft een project waar bijna niets in staat", () => {
    const leeg: ProjectMetId = { id: "p2", naam: "X", aangemaaktOp: new Date(0) };
    const gevuld = uitProject(leeg, "orientatie");
    expect(gevuld.traject).toBe("nieuwbouw");
    expect(gevuld.koopsom).toBe("");
    expect(gevuld.hypotheekVorm).toBe("");
    expect(gevuld.hypotheekLooptijdJaren).toBe("30");
  });

  it("is heen en terug stabiel voor de financiële velden", () => {
    const gevuld = uitProject(project, "in_beheer");
    const terug = financieelPatch(gevuld);
    expect(terug.koopsom).toBe(385000);
    expect(terug.bouwdepotBedrag).toBe(185000);
    expect(terug.hypotheek?.bedrag).toBe(380000);
    expect(terug.hypotheek?.rente).toBe(3.85);
    expect(terug.hypotheek?.looptijdMaanden).toBe(360);
  });
});
