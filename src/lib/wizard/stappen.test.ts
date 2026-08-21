import { describe, expect, it } from "vitest";
import type { TrajectType } from "@/types/model";
import { VOLGORDE, isGeldigMoment, type Instapmoment } from "./instapmoment";
import {
  dichtstbijzijndeStap,
  openVerplichteStappen,
  stapIndex,
  stappenVoor,
  volgendeStap,
  voortgang,
  vorigeStap,
  type WizardStap,
} from "./stappen";

const TRAJECTEN: readonly TrajectType[] = ["nieuwbouw", "bestaandeBouw"];

/** Elke geldige combinatie van traject en moment. */
function alleCombinaties(): { traject: TrajectType; moment: Instapmoment }[] {
  const uit: { traject: TrajectType; moment: Instapmoment }[] = [];
  for (const traject of TRAJECTEN) {
    for (const moment of VOLGORDE) {
      if (isGeldigMoment(traject, moment)) uit.push({ traject, moment });
    }
  }
  return uit;
}

function ids(traject: TrajectType, moment: Instapmoment): WizardStap[] {
  return stappenVoor(traject, moment).map((s) => s.stap);
}

describe("stappenVoor — de vorm van het plan", () => {
  it("begint altijd met start en eindigt altijd met klaar", () => {
    for (const { traject, moment } of alleCombinaties()) {
      const plan = ids(traject, moment);
      expect(plan[0]).toBe("start");
      expect(plan.at(-1)).toBe("klaar");
    }
  });

  it("bevat nooit een stap dubbel", () => {
    for (const { traject, moment } of alleCombinaties()) {
      const plan = ids(traject, moment);
      expect(new Set(plan).size).toBe(plan.length);
    }
  });

  it("houdt bij elke combinatie dezelfde onderlinge volgorde aan", () => {
    const referentie = ids("nieuwbouw", "orientatie");
    for (const { traject, moment } of alleCombinaties()) {
      const plan = ids(traject, moment).filter((s) => referentie.includes(s));
      const verwacht = referentie.filter((s) => plan.includes(s));
      expect(plan).toEqual(verwacht);
    }
  });

  it("geeft elke stap een kop en een uitleg", () => {
    for (const { traject, moment } of alleCombinaties()) {
      for (const stap of stappenVoor(traject, moment)) {
        expect(stap.kop.length).toBeGreaterThan(0);
        expect(stap.uitleg.length).toBeGreaterThan(0);
        expect(stap.titel.length).toBeGreaterThan(0);
      }
    }
  });

  it("vraagt in elke combinatie naar het financiële beeld", () => {
    // Dit was de expliciete wens: het geld hoort in de wizard, niet ergens
    // verstopt in een submenu waar niemand komt.
    for (const { traject, moment } of alleCombinaties()) {
      expect(ids(traject, moment)).toContain("financieel");
    }
  });
});

describe("stappenVoor — wat er per instapmoment wegvalt", () => {
  it("slaat de planning over voor wie er al woont", () => {
    expect(ids("nieuwbouw", "in_beheer")).not.toContain("planning");
    expect(ids("bestaandeBouw", "in_beheer")).not.toContain("planning");
  });

  it("vraagt niet meer naar betrokkenen zodra de sleutel er is", () => {
    expect(ids("nieuwbouw", "bijna_oplevering")).toContain("betrokkenen");
    expect(ids("nieuwbouw", "net_opgeleverd")).not.toContain("betrokkenen");
    expect(ids("nieuwbouw", "in_beheer")).not.toContain("betrokkenen");
  });

  it("toont onderdelen en onderhoud pas vanaf de sleutel", () => {
    for (const vroeg of ["orientatie", "net_gekocht", "in_aanbouw", "bijna_oplevering"] as const) {
      expect(ids("nieuwbouw", vroeg)).not.toContain("onderdelen");
      expect(ids("nieuwbouw", vroeg)).not.toContain("onderhoud");
    }
    expect(ids("nieuwbouw", "net_opgeleverd")).toContain("onderdelen");
    expect(ids("nieuwbouw", "in_beheer")).toContain("onderhoud");
  });

  it("toont de opleverstap alleen rond de oplevering zelf", () => {
    expect(ids("nieuwbouw", "in_aanbouw")).not.toContain("oplevering");
    expect(ids("nieuwbouw", "bijna_oplevering")).toContain("oplevering");
    expect(ids("nieuwbouw", "net_opgeleverd")).toContain("oplevering");
    expect(ids("nieuwbouw", "in_beheer")).not.toContain("oplevering");
  });

  it("vraagt meterstanden vanaf het moment dat ze bewijs worden", () => {
    expect(ids("nieuwbouw", "in_aanbouw")).not.toContain("meters");
    expect(ids("nieuwbouw", "bijna_oplevering")).toContain("meters");
    expect(ids("bestaandeBouw", "in_beheer")).toContain("meters");
  });

  it("maakt van in_beheer een onderhoudswizard en niet een bouwwizard", () => {
    const plan = ids("nieuwbouw", "in_beheer");
    expect(plan).toEqual(["start", "woning", "contract", "financieel", "onderdelen", "onderhoud", "meters", "klaar"]);
  });

  it("geeft iemand die oriënteert de kortste wizard", () => {
    const orientatie = ids("nieuwbouw", "orientatie").length;
    for (const moment of ["net_gekocht", "in_aanbouw", "bijna_oplevering"] as const) {
      expect(ids("nieuwbouw", moment).length).toBeGreaterThanOrEqual(orientatie);
    }
  });
});

describe("stappenVoor — verplicht versus optioneel", () => {
  function verplichte(traject: TrajectType, moment: Instapmoment): WizardStap[] {
    return stappenVoor(traject, moment)
      .filter((s) => s.verplicht)
      .map((s) => s.stap);
  }

  it("verplicht bij oriëntatie niets buiten start en klaar", () => {
    // Wie oriënteert heeft geen aanneemsom. Die verplicht stellen levert een
    // verzonnen getal op dat daarna als feit in het dossier staat.
    expect(verplichte("nieuwbouw", "orientatie")).toEqual(["start", "klaar"]);
  });

  it("verplicht de woning en het geld zodra er getekend is", () => {
    const verplicht = verplichte("nieuwbouw", "net_gekocht");
    expect(verplicht).toContain("woning");
    expect(verplicht).toContain("contract");
    expect(verplicht).toContain("financieel");
  });

  it("maakt onderhoud verplicht voor wie als beheerder instapt", () => {
    expect(verplichte("nieuwbouw", "in_beheer")).toContain("onderhoud");
    expect(verplichte("nieuwbouw", "net_opgeleverd")).not.toContain("onderhoud");
  });

  it("houdt betrokkenen, onderdelen en meters altijd optioneel", () => {
    for (const { traject, moment } of alleCombinaties()) {
      for (const stap of stappenVoor(traject, moment)) {
        if (stap.stap === "betrokkenen" || stap.stap === "onderdelen" || stap.stap === "meters") {
          expect(stap.verplicht).toBe(false);
        }
      }
    }
  });

  it("verplicht nooit een stap die niet in het plan zit", () => {
    for (const { traject, moment } of alleCombinaties()) {
      const plan = ids(traject, moment);
      for (const stap of verplichte(traject, moment)) {
        expect(plan).toContain(stap);
      }
    }
  });
});

describe("navigatie door het plan", () => {
  const plan = stappenVoor("nieuwbouw", "in_aanbouw");

  it("loopt van de eerste naar de laatste stap en stopt daar", () => {
    let huidig: WizardStap | null = "start";
    const bezocht: WizardStap[] = [];
    while (huidig !== null) {
      bezocht.push(huidig);
      huidig = volgendeStap(plan, huidig);
    }
    expect(bezocht).toEqual(plan.map((s) => s.stap));
  });

  it("geeft null terug vóór de eerste en na de laatste stap", () => {
    expect(vorigeStap(plan, "start")).toBeNull();
    expect(volgendeStap(plan, "klaar")).toBeNull();
  });

  it("is elkaars omgekeerde in het midden", () => {
    for (const definitie of plan.slice(1, -1)) {
      const volgende = volgendeStap(plan, definitie.stap);
      expect(volgende).not.toBeNull();
      if (volgende) expect(vorigeStap(plan, volgende)).toBe(definitie.stap);
    }
  });

  it("kent een onbekende stap geen positie toe", () => {
    expect(stapIndex(plan, "onderhoud")).toBe(-1);
  });
});

describe("dichtstbijzijndeStap", () => {
  it("laat een bestaande stap staan", () => {
    const plan = stappenVoor("nieuwbouw", "in_aanbouw");
    expect(dichtstbijzijndeStap(plan, "financieel")).toBe("financieel");
  });

  it("valt terug op de laatste stap die niet verder ligt dan waar je was", () => {
    // Iemand stond op "betrokkenen" en wisselt naar in_beheer, waar die stap
    // niet bestaat. Terugvallen naar het begin zou zijn werk onzichtbaar maken.
    const beheerplan = stappenVoor("nieuwbouw", "in_beheer");
    expect(dichtstbijzijndeStap(beheerplan, "betrokkenen")).toBe("financieel");
  });

  it("geeft altijd een stap terug die in het plan zit", () => {
    const alleStappen: WizardStap[] = [
      "start",
      "woning",
      "contract",
      "planning",
      "financieel",
      "betrokkenen",
      "oplevering",
      "onderdelen",
      "onderhoud",
      "meters",
      "klaar",
    ];
    for (const { traject, moment } of alleCombinaties()) {
      const plan = stappenVoor(traject, moment);
      for (const stap of alleStappen) {
        expect(ids(traject, moment)).toContain(dichtstbijzijndeStap(plan, stap));
      }
    }
  });
});

describe("voortgang", () => {
  const plan = stappenVoor("nieuwbouw", "in_aanbouw");

  it("telt start en klaar niet mee", () => {
    // Anders begint elke wizard op 9% zonder dat er iets is gebeurd.
    expect(voortgang(plan, []).percentage).toBe(0);
    expect(voortgang(plan, ["start", "klaar"]).percentage).toBe(0);
  });

  it("komt op 100 als alle inhoudelijke stappen af zijn", () => {
    const alles = plan.map((s) => s.stap);
    const uitkomst = voortgang(plan, alles);
    expect(uitkomst.percentage).toBe(100);
    expect(uitkomst.gedaan).toBe(uitkomst.totaal);
  });

  it("rekent een deel correct door", () => {
    const inhoudelijk = plan.filter((s) => s.stap !== "start" && s.stap !== "klaar");
    const helft = inhoudelijk.slice(0, 2).map((s) => s.stap);
    expect(voortgang(plan, helft).gedaan).toBe(2);
    expect(voortgang(plan, helft).totaal).toBe(inhoudelijk.length);
  });
});

describe("openVerplichteStappen", () => {
  it("noemt de verplichte stappen die nog open staan", () => {
    const plan = stappenVoor("nieuwbouw", "net_gekocht");
    const open = openVerplichteStappen(plan, []).map((s) => s.stap);
    expect(open).toContain("woning");
    expect(open).toContain("financieel");
    expect(open).not.toContain("start");
    expect(open).not.toContain("klaar");
  });

  it("wordt leeg zodra alles verplichte is afgerond", () => {
    const plan = stappenVoor("nieuwbouw", "net_gekocht");
    const alles = plan.map((s) => s.stap);
    expect(openVerplichteStappen(plan, alles)).toEqual([]);
  });

  it("noemt bij oriëntatie niets, want daar is niets verplicht", () => {
    const plan = stappenVoor("nieuwbouw", "orientatie");
    expect(openVerplichteStappen(plan, [])).toEqual([]);
  });
});
