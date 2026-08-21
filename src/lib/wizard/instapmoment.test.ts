import { describe, expect, it } from "vitest";
import {
  VOLGORDE,
  dichtstbijzijndeMoment,
  gepasseerdeAnkers,
  isGeldigMoment,
  isOpOfNa,
  isVoor,
  momentenVoor,
  woningStatusVoor,
} from "./instapmoment";

describe("momentenVoor", () => {
  it("geeft bij nieuwbouw alle zes de momenten", () => {
    const momenten = momentenVoor("nieuwbouw").map((k) => k.moment);
    expect(momenten).toEqual(VOLGORDE);
  });

  it("laat in_aanbouw weg bij bestaande bouw — er wordt niets gebouwd", () => {
    const momenten = momentenVoor("bestaandeBouw").map((k) => k.moment);
    expect(momenten).not.toContain("in_aanbouw");
    expect(momenten).toHaveLength(5);
  });

  it("houdt de chronologische volgorde aan, ook bij bestaande bouw", () => {
    for (const traject of ["nieuwbouw", "bestaandeBouw"] as const) {
      const indexen = momentenVoor(traject).map((k) => VOLGORDE.indexOf(k.moment));
      const gesorteerd = [...indexen].sort((a, b) => a - b);
      expect(indexen).toEqual(gesorteerd);
    }
  });

  it("geeft elk moment een label, een toelichting en een gevolg", () => {
    for (const traject of ["nieuwbouw", "bestaandeBouw"] as const) {
      for (const keuze of momentenVoor(traject)) {
        expect(keuze.label.length).toBeGreaterThan(0);
        expect(keuze.toelichting.length).toBeGreaterThan(0);
        expect(keuze.gevolg.length).toBeGreaterThan(0);
      }
    }
  });

  it("gebruikt bij bestaande bouw andere woorden dan bij nieuwbouw", () => {
    // "oplevering" is een nieuwbouwterm; bij bestaande bouw heet het transport.
    const bestaand = momentenVoor("bestaandeBouw")
      .map((k) => `${k.label} ${k.toelichting}`)
      .join(" ")
      .toLowerCase();
    expect(bestaand).toContain("transport");
    expect(bestaand).not.toContain("aanneemsom");
  });
});

describe("volgorde-hulpjes", () => {
  it("isOpOfNa telt het moment zelf mee", () => {
    expect(isOpOfNa("net_opgeleverd", "net_opgeleverd")).toBe(true);
    expect(isOpOfNa("in_beheer", "net_opgeleverd")).toBe(true);
    expect(isOpOfNa("in_aanbouw", "net_opgeleverd")).toBe(false);
  });

  it("isVoor is het strikte spiegelbeeld", () => {
    for (const a of VOLGORDE) {
      for (const b of VOLGORDE) {
        expect(isVoor(a, b)).toBe(!isOpOfNa(a, b));
      }
    }
  });
});

describe("isGeldigMoment en dichtstbijzijndeMoment", () => {
  it("in_aanbouw bestaat niet bij bestaande bouw", () => {
    expect(isGeldigMoment("nieuwbouw", "in_aanbouw")).toBe(true);
    expect(isGeldigMoment("bestaandeBouw", "in_aanbouw")).toBe(false);
  });

  it("laat een geldig moment ongemoeid", () => {
    expect(dichtstbijzijndeMoment("bestaandeBouw", "net_gekocht")).toBe("net_gekocht");
  });

  it("verplaatst in_aanbouw naar het dichtstbijzijnde bij een trajectwissel", () => {
    // Iemand staat op "de bouw is bezig" en zet het traject om naar bestaande
    // bouw. Die keuze bestaat daar niet; hij mag niet in een lege wizard komen.
    const verplaatst = dichtstbijzijndeMoment("bestaandeBouw", "in_aanbouw");
    expect(isGeldigMoment("bestaandeBouw", verplaatst)).toBe(true);
    expect(["net_gekocht", "bijna_oplevering"]).toContain(verplaatst);
  });

  it("geeft altijd een moment terug dat binnen het traject bestaat", () => {
    for (const traject of ["nieuwbouw", "bestaandeBouw"] as const) {
      for (const moment of VOLGORDE) {
        expect(isGeldigMoment(traject, dichtstbijzijndeMoment(traject, moment))).toBe(true);
      }
    }
  });
});

describe("woningStatusVoor", () => {
  it("staat op in_aanbouw tot de sleutel er is", () => {
    expect(woningStatusVoor("orientatie")).toBe("in_aanbouw");
    expect(woningStatusVoor("net_gekocht")).toBe("in_aanbouw");
    expect(woningStatusVoor("in_aanbouw")).toBe("in_aanbouw");
    expect(woningStatusVoor("bijna_oplevering")).toBe("in_aanbouw");
  });

  it("gaat naar opgeleverd zodra de sleutel er is", () => {
    expect(woningStatusVoor("net_opgeleverd")).toBe("opgeleverd");
    expect(woningStatusVoor("in_beheer")).toBe("opgeleverd");
  });
});

describe("gepasseerdeAnkers", () => {
  it("neemt niets aan vóór de bouw begint", () => {
    expect(gepasseerdeAnkers("orientatie")).toEqual([]);
    expect(gepasseerdeAnkers("net_gekocht")).toEqual([]);
  });

  it("is conservatief tijdens de bouw — alleen de start staat vast", () => {
    // Of de ruwbouw al staat weten we niet. Een gepasseerd anker ligt vast en
    // schuift niet meer mee, dus een verkeerde is duurder dan een ontbrekende.
    expect(gepasseerdeAnkers("in_aanbouw")).toEqual(["start_bouw"]);
  });

  it("zet oplevering en sleuteloverdracht pas na de sleutel", () => {
    expect(gepasseerdeAnkers("bijna_oplevering")).not.toContain("oplevering");
    expect(gepasseerdeAnkers("net_opgeleverd")).toContain("oplevering");
    expect(gepasseerdeAnkers("net_opgeleverd")).toContain("sleuteloverdracht");
  });

  it("zet het einde van de onderhoudstermijn alleen bij in_beheer", () => {
    expect(gepasseerdeAnkers("net_opgeleverd")).not.toContain("einde_onderhoudstermijn");
    expect(gepasseerdeAnkers("in_beheer")).toContain("einde_onderhoudstermijn");
  });

  it("groeit monotoon: een later moment neemt nooit een anker terug", () => {
    let vorige: readonly string[] = [];
    for (const moment of VOLGORDE) {
      const nu = gepasseerdeAnkers(moment);
      for (const anker of vorige) {
        expect(nu).toContain(anker);
      }
      vorige = nu;
    }
  });

  it("levert geen dubbele ankers op", () => {
    for (const moment of VOLGORDE) {
      const ankers = gepasseerdeAnkers(moment);
      expect(new Set(ankers).size).toBe(ankers.length);
    }
  });
});
