import { describe, expect, it } from "vitest";
import { maakConceptbericht, mailtoLink } from "@/lib/bericht";
import type { ActieRegel, BerekendeBand } from "@/lib/planning";

/**
 * Deze tests bewaken één ding boven alles: **een bericht mag nooit meer
 * zekerheid uitstralen dan de app heeft.**
 *
 * In de UI staat bij een teruggevallen berekening een waarschuwing. In een mail
 * aan de leverancier verdwijnt die context volledig — hij leest een datum en zet
 * die in zijn agenda. Verdwijnt het voorbehoud uit de tekst, dan presenteert de
 * app een schatting als een afspraak, namens de gebruiker (constraint C5).
 */

const dag = (tekst: string) => new Date(`${tekst}T00:00:00.000Z`);

const punt: BerekendeBand = {
  vroegst: dag("2026-11-16"),
  verwacht: dag("2026-11-16"),
  laatst: dag("2026-11-16"),
  isPunt: true,
  zekerheid: "anker_bevestigd",
  gebruiktAnker: "ruwbouw_gereed",
  gevraagdAnker: "ruwbouw_gereed",
};

const basis: ActieRegel = {
  afspraakId: "a1",
  betrokkeneId: "b1",
  betrokkeneNaam: "Keukenhuis Almere",
  omschrijving: "inmeten keuken",
  urgentie: "hoog",
  reden: "Ze moeten dit nu weten.",
  berekend: punt,
};

const opties = { projectnaam: "Ons huis in Almere", afzender: "Seth", opleverAangezegd: false };

describe("maakConceptbericht — aanhef en onderwerp", () => {
  it("gebruikt de contactpersoon als die bekend is", () => {
    expect(maakConceptbericht(basis, "Jan", opties).tekst).toContain("Beste Jan,");
  });

  it("valt terug op de bedrijfsnaam zonder contactpersoon", () => {
    expect(maakConceptbericht(basis, undefined, opties).tekst).toContain("Beste Keukenhuis Almere,");
  });

  it("negeert een contactpersoon die alleen uit spaties bestaat", () => {
    expect(maakConceptbericht(basis, "   ", opties).tekst).toContain("Beste Keukenhuis Almere,");
  });

  it("meldt in het onderwerp dat het om een wijziging gaat", () => {
    const gewijzigd: ActieRegel = {
      ...basis,
      gecommuniceerdeDatum: dag("2026-10-01"),
      verschilDagen: 46,
    };
    expect(maakConceptbericht(gewijzigd, "Jan", opties).onderwerp).toMatch(/^Gewijzigde datum:/);
    expect(maakConceptbericht(basis, "Jan", opties).onderwerp).toMatch(/^Planning/);
  });

  it("laat de projectnaam weg als die er niet is", () => {
    const zonder = maakConceptbericht(basis, "Jan", { opleverAangezegd: false });
    expect(zonder.onderwerp).not.toContain("(");
  });
});

describe("maakConceptbericht — de kern", () => {
  it("noemt bij een eerste melding alleen de nieuwe datum", () => {
    const tekst = maakConceptbericht(basis, "Jan", opties).tekst;
    expect(tekst).toContain("16 nov 2026");
    expect(tekst).not.toContain("Eerder gaf ik");
  });

  it("noemt bij een wijziging beide datums en het verschil", () => {
    const gewijzigd: ActieRegel = {
      ...basis,
      gecommuniceerdeDatum: dag("2026-10-01"),
      verschilDagen: 46,
    };
    const tekst = maakConceptbericht(gewijzigd, "Jan", opties).tekst;
    expect(tekst).toContain("1 okt 2026");
    expect(tekst).toContain("16 nov 2026");
    expect(tekst).toContain("46 dagen later");
  });

  it("zegt eerder in plaats van later bij een vervroeging", () => {
    const vervroegd: ActieRegel = {
      ...basis,
      gecommuniceerdeDatum: dag("2026-12-01"),
      verschilDagen: -15,
    };
    expect(maakConceptbericht(vervroegd, "Jan", opties).tekst).toContain("15 dagen eerder");
  });

  it("gebruikt enkelvoud bij één dag", () => {
    const eenDag: ActieRegel = {
      ...basis,
      gecommuniceerdeDatum: dag("2026-11-15"),
      verschilDagen: 1,
    };
    expect(maakConceptbericht(eenDag, "Jan", opties).tekst).toContain("1 dag later");
  });

  it("noemt een bereik in plaats van één datum bij een band", () => {
    const band: ActieRegel = {
      ...basis,
      berekend: {
        ...punt,
        vroegst: dag("2026-11-02"),
        laatst: dag("2026-12-14"),
        isPunt: false,
        zekerheid: "anker_verwacht",
      },
    };
    const tekst = maakConceptbericht(band, "Jan", opties).tekst;
    expect(tekst).toContain("tussen 2 nov 2026 en 14 dec 2026");
  });
});

describe("maakConceptbericht — het voorbehoud", () => {
  it("waarschuwt expliciet bij een teruggevallen berekening", () => {
    // Dit is de belangrijkste test van dit bestand.
    const teruggevallen: ActieRegel = {
      ...basis,
      berekend: {
        ...punt,
        zekerheid: "teruggevallen",
        gebruiktAnker: "oplevering",
        gevraagdAnker: "dekvloer_gestort",
      },
    };
    const tekst = maakConceptbericht(teruggevallen, "Jan", opties).tekst;
    expect(tekst).toContain("indicatief");
    expect(tekst.toLowerCase()).toContain("dekvloer gestort");
  });

  it("blijft een slag om de arm houden zolang de oplevering niet is aangezegd", () => {
    const tekst = maakConceptbericht(basis, "Jan", opties).tekst;
    expect(tekst).toMatch(/nog niet formeel aangezegd/);
  });

  it("mag pas definitief klinken als het anker vaststaat én de datum is aangezegd", () => {
    const tekst = maakConceptbericht(basis, "Jan", { ...opties, opleverAangezegd: true }).tekst;
    expect(tekst).toContain("definitief inplannen");
    expect(tekst).not.toMatch(/kan nog schuiven/);
  });

  it("noemt bij een verwacht anker dat het nog kan schuiven", () => {
    const verwacht: ActieRegel = {
      ...basis,
      berekend: { ...punt, zekerheid: "anker_verwacht" },
    };
    const tekst = maakConceptbericht(verwacht, "Jan", { ...opties, opleverAangezegd: true }).tekst;
    expect(tekst).toContain("richtdatum");
  });
});

describe("maakConceptbericht — annuleertermijn en afzender", () => {
  it("noemt de laatste gratis schuifdatum als die bekend is", () => {
    const met: ActieRegel = { ...basis, laatsteGratisSchuifdatum: dag("2026-10-26") };
    expect(maakConceptbericht(met, "Jan", opties).tekst).toContain("26 okt 2026");
  });

  it("laat die zin weg als er niets te annuleren valt", () => {
    expect(maakConceptbericht(basis, "Jan", opties).tekst).not.toContain("kosteloos verzet");
  });

  it("eindigt met de afzender", () => {
    expect(maakConceptbericht(basis, "Jan", opties).tekst.trimEnd()).toMatch(/Seth$/);
  });

  it("eindigt netjes zonder afzender", () => {
    const tekst = maakConceptbericht(basis, "Jan", { opleverAangezegd: false }).tekst;
    expect(tekst.trimEnd()).toMatch(/Met vriendelijke groet,$/);
  });
});

describe("mailtoLink", () => {
  it("codeert spaties als %20 en niet als plusteken", () => {
    const link = mailtoLink("info@keukenhuis.nl", { onderwerp: "een twee", tekst: "drie vier" });
    expect(link).toContain("subject=een%20twee");
    expect(link).not.toContain("+");
  });

  it("zet het adres vooraan", () => {
    const link = mailtoLink("info@keukenhuis.nl", { onderwerp: "x", tekst: "y" });
    expect(link.startsWith("mailto:info%40keukenhuis.nl?")).toBe(true);
  });
});
