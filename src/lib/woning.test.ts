import { describe, expect, it } from "vitest";
import {
  ENERGIELABEL_GELDIG_MAANDEN,
  adresregel,
  bepaalEnergielabelstand,
  isOpgeleverd,
  paspoortstand,
  woningStatusVan,
} from "@/lib/woning";
import type { WoningpaspoortData } from "@/lib/converters";

const VANDAAG = new Date(Date.UTC(2026, 7, 1)); // 1 augustus 2026

function paspoort(velden: Partial<WoningpaspoortData> = {}): WoningpaspoortData {
  return velden;
}

describe("woningStatusVan", () => {
  it("valt terug op in_aanbouw als het veld ontbreekt", () => {
    expect(woningStatusVan({})).toBe("in_aanbouw");
  });

  it("respecteert een expliciete status", () => {
    expect(woningStatusVan({ woningStatus: "opgeleverd" })).toBe("opgeleverd");
    expect(woningStatusVan({ woningStatus: "in_aanbouw" })).toBe("in_aanbouw");
  });

  /**
   * Het vangnet onder de migratiekeuze: een project van vóór blok E mist het
   * veld en moet als in aanbouw gelden. Draait dit om, dan krijgen bestaande
   * gebruikers de onderhoudslijst op een woning die nog niet bestaat.
   */
  it("beschouwt een project zonder woningStatus niet als opgeleverd", () => {
    expect(isOpgeleverd({})).toBe(false);
  });

  it("herkent een opgeleverde woning", () => {
    expect(isOpgeleverd({ woningStatus: "opgeleverd" })).toBe(true);
  });
});

describe("bepaalEnergielabelstand", () => {
  it("geeft null zonder paspoort", () => {
    expect(bepaalEnergielabelstand(undefined, VANDAAG)).toBeNull();
  });

  it("geeft null zonder opnamedatum, ook als er een label is ingevuld", () => {
    expect(bepaalEnergielabelstand(paspoort({ energielabel: "A++++" }), VANDAAG)).toBeNull();
  });

  it("telt tien jaar vanaf de opnamedatum", () => {
    const stand = bepaalEnergielabelstand(
      paspoort({ energielabelOpnameDatum: new Date(Date.UTC(2026, 0, 15)) }),
      VANDAAG,
    );
    expect(stand?.verlooptOp).toEqual(new Date(Date.UTC(2036, 0, 15)));
    expect(stand?.verlopen).toBe(false);
    expect(stand?.bijnaVerlopen).toBe(false);
  });

  it("de geldigheidsduur is 120 maanden", () => {
    expect(ENERGIELABEL_GELDIG_MAANDEN).toBe(120);
  });

  it("markeert een verlopen label", () => {
    const stand = bepaalEnergielabelstand(
      paspoort({ energielabelOpnameDatum: new Date(Date.UTC(2015, 0, 1)) }),
      VANDAAG,
    );
    expect(stand?.verlopen).toBe(true);
    expect(stand?.dagenResterend).toBeLessThan(0);
    expect(stand?.bijnaVerlopen).toBe(false);
  });

  it("markeert een label dat binnen 90 dagen verloopt", () => {
    // Opname 1 oktober 2016 → verloopt 1 oktober 2026, dat is 61 dagen na vandaag.
    const stand = bepaalEnergielabelstand(
      paspoort({ energielabelOpnameDatum: new Date(Date.UTC(2016, 9, 1)) }),
      VANDAAG,
    );
    expect(stand?.bijnaVerlopen).toBe(true);
    expect(stand?.verlopen).toBe(false);
    expect(stand?.dagenResterend).toBe(61);
  });

  it("een label dat vandaag verloopt telt nog niet als verlopen", () => {
    const stand = bepaalEnergielabelstand(
      paspoort({ energielabelOpnameDatum: new Date(Date.UTC(2016, 7, 1)) }),
      VANDAAG,
    );
    expect(stand?.dagenResterend).toBe(0);
    expect(stand?.verlopen).toBe(false);
    expect(stand?.bijnaVerlopen).toBe(true);
  });

  /**
   * De maandvalkuil uit `overMaanden()`: 29 februari plus tien jaar bestaat
   * niet, want 2036 is wél een schrikkeljaar maar 2034 niet. Hier klemt het op
   * de laatste dag van de doelmaand in plaats van door te schuiven naar maart.
   */
  it("klemt op de laatste dag van de maand bij een schrikkeldag", () => {
    const stand = bepaalEnergielabelstand(
      paspoort({ energielabelOpnameDatum: new Date(Date.UTC(2024, 1, 29)) }),
      VANDAAG,
    );
    expect(stand?.verlooptOp).toEqual(new Date(Date.UTC(2034, 1, 28)));
  });
});

describe("paspoortstand", () => {
  it("meldt een ontbrekend paspoort als leeg", () => {
    const stand = paspoortstand(undefined);
    expect(stand.leeg).toBe(true);
    expect(stand.ingevuld).toBe(0);
    expect(stand.ontbreekt).toHaveLength(stand.totaal);
  });

  it("telt alleen de kernvelden", () => {
    const stand = paspoortstand(paspoort({ adres: "Dorpsstraat 1", notaris: "Van Dijk" }));
    // Notaris is geen kernveld en telt dus niet mee.
    expect(stand.ingevuld).toBe(1);
    expect(stand.leeg).toBe(false);
    expect(stand.ontbreekt).not.toContain("adres");
  });

  it("is compleet als alle kernvelden gevuld zijn", () => {
    const stand = paspoortstand(
      paspoort({
        adres: "Dorpsstraat 1",
        postcode: "1234 AB",
        plaats: "Almere",
        woningtype: "tussenwoning",
        bouwjaar: 2026,
        woonoppervlakte: 124,
        energielabel: "A++++",
      }),
    );
    expect(stand.ingevuld).toBe(stand.totaal);
    expect(stand.ontbreekt).toHaveLength(0);
  });

  it("een paspoort met alleen lege velden telt als leeg", () => {
    expect(paspoortstand({}).leeg).toBe(true);
  });
});

describe("adresregel", () => {
  it("geeft null zonder adres", () => {
    expect(adresregel(undefined)).toBeNull();
    expect(adresregel(paspoort({ postcode: "1234 AB", plaats: "Almere" }))).toBeNull();
  });

  it("zet adres, postcode en plaats op één regel", () => {
    expect(
      adresregel(paspoort({ adres: "Dorpsstraat 1", postcode: "1234 AB", plaats: "Almere" })),
    ).toBe("Dorpsstraat 1, 1234 AB Almere");
  });

  it("laat het tweede deel weg als postcode en plaats ontbreken", () => {
    expect(adresregel(paspoort({ adres: "Dorpsstraat 1" }))).toBe("Dorpsstraat 1");
  });

  it("werkt met alleen een plaats", () => {
    expect(adresregel(paspoort({ adres: "Dorpsstraat 1", plaats: "Almere" }))).toBe(
      "Dorpsstraat 1, Almere",
    );
  });
});
