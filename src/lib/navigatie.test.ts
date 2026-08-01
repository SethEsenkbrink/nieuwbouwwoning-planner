import { describe, expect, it } from "vitest";
import { actiefItem, actieveGroep, groepVan, NAVIGATIE } from "@/data/navigatie";

/**
 * De valkuil zit in `/`: dat is een prefix van elk pad. Zonder de exacte
 * afhandeling zou elk scherm "Dashboard" oplichten, en dan wijst de navigatie
 * altijd naar de verkeerde plek.
 */

describe("actieveGroep", () => {
  it("herkent het dashboard alleen op het exacte pad", () => {
    expect(actieveGroep("/")).toBe("dashboard");
  });

  it("wijst planningschermen aan de planningsgroep toe", () => {
    expect(actieveGroep("/tijdlijn")).toBe("planning");
    expect(actieveGroep("/ankers")).toBe("planning");
    expect(actieveGroep("/afspraken")).toBe("planning");
    expect(actieveGroep("/betrokkenen")).toBe("planning");
  });

  it("wijst geldschermen aan de geldgroep toe", () => {
    expect(actieveGroep("/meerwerk")).toBe("geld");
    expect(actieveGroep("/bouwdepot")).toBe("geld");
    expect(actieveGroep("/na-oplevering")).toBe("geld");
  });

  it("houdt oplevering en na-oplevering uit elkaar", () => {
    // `/na-oplevering` bevat het woord "oplevering" maar is een ander scherm.
    expect(actieveGroep("/oplevering")).toBe("oplevering");
    expect(actieveGroep("/na-oplevering")).toBe("geld");
  });

  it("zet het woningdossier bij Oplevering en niet bij Project", () => {
    // Het dossier begint waar het bouwtraject eindigt (ADR-0010).
    expect(actieveGroep("/woning")).toBe("oplevering");
    expect(actieveGroep("/onderdelen")).toBe("oplevering");
    expect(actieveGroep("/onderhoud")).toBe("oplevering");
    expect(actieveGroep("/meterstanden")).toBe("oplevering");
    expect(actieveGroep("/overdrachtsdossier")).toBe("oplevering");
  });

  it("laat de wizard onder Project vallen en niet onder Dashboard", () => {
    expect(actieveGroep("/project/nieuw")).toBe("project");
    expect(actieveGroep("/project")).toBe("project");
  });

  it("geeft niets terug voor een onbekend pad", () => {
    expect(actieveGroep("/bestaat-niet")).toBeNull();
    expect(actieveGroep("/inloggen")).toBeNull();
  });
});

describe("actiefItem", () => {
  it("geeft het exacte subitem terug", () => {
    expect(actiefItem("/ankers")).toBe("/ankers");
    expect(actiefItem("/na-oplevering")).toBe("/na-oplevering");
  });

  it("geeft niets terug voor een groep zonder subitems", () => {
    expect(actiefItem("/")).toBeNull();
    expect(actiefItem("/project")).toBeNull();
  });

  it("geeft het subitem binnen de opleveringsgroep terug", () => {
    expect(actiefItem("/oplevering")).toBe("/oplevering");
    expect(actiefItem("/woning")).toBe("/woning");
    expect(actiefItem("/onderdelen")).toBe("/onderdelen");
    expect(actiefItem("/onderhoud")).toBe("/onderhoud");
    expect(actiefItem("/meterstanden")).toBe("/meterstanden");
    expect(actiefItem("/overdrachtsdossier")).toBe("/overdrachtsdossier");
  });
});

describe("de structuur zelf", () => {
  it("heeft unieke sleutels", () => {
    const sleutels = NAVIGATIE.map((g) => g.sleutel);
    expect(new Set(sleutels).size).toBe(sleutels.length);
  });

  it("laat elke groep beginnen bij een pad dat hij zelf kent", () => {
    // Anders klik je op een groep en licht een ándere groep op.
    for (const groep of NAVIGATIE) {
      expect(actieveGroep(groep.pad)).toBe(groep.sleutel);
    }
  });

  it("vindt een groep terug op sleutel", () => {
    expect(groepVan("geld")?.label).toBe("Geld");
    expect(groepVan(null)).toBeUndefined();
    expect(groepVan("bestaat-niet")).toBeUndefined();
  });
});
