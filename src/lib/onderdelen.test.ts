import { describe, expect, it } from "vitest";
import {
  berekenGarantieklok,
  garantiesDieAflopen,
  onderdeelstand,
  ordenSpecs,
  registratieOpenstaand,
  sorteerOnderdelen,
  telOpenstaandeRegistraties,
  telOverdracht,
} from "@/lib/onderdelen";
import type { OnderdeelMetId } from "@/lib/converters";

const VANDAAG = new Date(Date.UTC(2026, 7, 1)); // 1 augustus 2026

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

describe("berekenGarantieklok", () => {
  it("geeft null zonder installatiedatum", () => {
    expect(berekenGarantieklok(onderdeel({ garantieMaanden: 60 }), VANDAAG)).toBeNull();
  });

  it("geeft null zonder garantietermijn", () => {
    expect(
      berekenGarantieklok(
        onderdeel({ installatieDatum: new Date(Date.UTC(2026, 0, 1)) }),
        VANDAAG,
      ),
    ).toBeNull();
  });

  it("geeft null bij een garantie van nul maanden", () => {
    expect(
      berekenGarantieklok(
        onderdeel({ installatieDatum: new Date(Date.UTC(2026, 0, 1)), garantieMaanden: 0 }),
        VANDAAG,
      ),
    ).toBeNull();
  });

  it("telt de maanden vanaf de installatiedatum", () => {
    const klok = berekenGarantieklok(
      onderdeel({ installatieDatum: new Date(Date.UTC(2026, 0, 15)), garantieMaanden: 60 }),
      VANDAAG,
    );
    expect(klok?.verstrijktOp).toEqual(new Date(Date.UTC(2031, 0, 15)));
    expect(klok?.voorbij).toBe(false);
    expect(klok?.bijnaVoorbij).toBe(false);
  });

  it("markeert een verlopen garantie", () => {
    const klok = berekenGarantieklok(
      onderdeel({ installatieDatum: new Date(Date.UTC(2020, 0, 1)), garantieMaanden: 24 }),
      VANDAAG,
    );
    expect(klok?.voorbij).toBe(true);
    expect(klok?.bijnaVoorbij).toBe(false);
  });

  it("markeert een garantie die binnen 90 dagen afloopt", () => {
    // 1 oktober 2024 + 24 maanden = 1 oktober 2026 → 61 dagen na vandaag.
    const klok = berekenGarantieklok(
      onderdeel({ installatieDatum: new Date(Date.UTC(2024, 9, 1)), garantieMaanden: 24 }),
      VANDAAG,
    );
    expect(klok?.dagenResterend).toBe(61);
    expect(klok?.bijnaVoorbij).toBe(true);
    expect(klok?.voorbij).toBe(false);
  });

  /** Dezelfde maandvalkuil die `overMaanden()` afvangt. */
  it("klemt op de laatste dag van de doelmaand", () => {
    const klok = berekenGarantieklok(
      onderdeel({ installatieDatum: new Date(Date.UTC(2026, 7, 31)), garantieMaanden: 6 }),
      VANDAAG,
    );
    expect(klok?.verstrijktOp).toEqual(new Date(Date.UTC(2027, 1, 28)));
  });
});

describe("registratieplicht", () => {
  it("telt niet mee zonder registratieplicht", () => {
    expect(registratieOpenstaand(onderdeel())).toBe(false);
  });

  it("staat open zolang er niet is aangemeld", () => {
    expect(
      registratieOpenstaand(
        onderdeel({ registratieplicht: { instantie: "Netbeheerder via Energieleveren.nl" } }),
      ),
    ).toBe(true);
  });

  it("is afgehandeld zodra er een aanmelddatum staat", () => {
    expect(
      registratieOpenstaand(
        onderdeel({
          registratieplicht: {
            instantie: "Netbeheerder via Energieleveren.nl",
            aangemeldOp: new Date(Date.UTC(2026, 6, 1)),
          },
        }),
      ),
    ).toBe(false);
  });

  it("telt de openstaande meldingen", () => {
    const lijst = [
      onderdeel({ id: "a", registratieplicht: { instantie: "Netbeheerder" } }),
      onderdeel({
        id: "b",
        registratieplicht: { instantie: "Netbeheerder", aangemeldOp: VANDAAG },
      }),
      onderdeel({ id: "c" }),
    ];
    expect(telOpenstaandeRegistraties(lijst)).toBe(1);
  });
});

describe("telOverdracht", () => {
  /**
   * De scheiding komt uit `blijftBijWoning`, niet uit `montage` — ADR-0013 §2.
   * Een plug-in batterij die bij de woning verkocht wordt telt dus als
   * achterblijvend, ook al is hij roerend.
   */
  it("scheidt op blijftBijWoning en niet op montage", () => {
    const lijst = [
      onderdeel({ id: "a", montage: "vast_geinstalleerd", blijftBijWoning: true }),
      onderdeel({ id: "b", montage: "plug_and_play", blijftBijWoning: false }),
      onderdeel({ id: "c", montage: "plug_and_play", blijftBijWoning: true }),
      onderdeel({ id: "d", montage: "vast_geinstalleerd", blijftBijWoning: false }),
    ];
    expect(telOverdracht(lijst)).toEqual({ blijftAchter: 2, verhuistMee: 2 });
  });

  it("telt een lege lijst als nul", () => {
    expect(telOverdracht([])).toEqual({ blijftAchter: 0, verhuistMee: 0 });
  });
});

describe("onderdeelstand en sortering", () => {
  const registratie = onderdeel({
    id: "registratie",
    naam: "Thuisbatterij",
    categorie: "opslag",
    registratieplicht: { instantie: "Netbeheerder" },
  });
  const afloopt = onderdeel({
    id: "afloopt",
    naam: "Omvormer",
    categorie: "opwekking",
    installatieDatum: new Date(Date.UTC(2024, 9, 1)),
    garantieMaanden: 24,
  });
  const voorbij = onderdeel({
    id: "voorbij",
    naam: "Cv-ketel",
    categorie: "verwarming",
    installatieDatum: new Date(Date.UTC(2020, 0, 1)),
    garantieMaanden: 24,
  });
  const normaal = onderdeel({ id: "normaal", naam: "WTW-unit", categorie: "ventilatie" });

  it("bepaalt de stand per onderdeel", () => {
    expect(onderdeelstand(registratie, VANDAAG)).toBe("registratie_open");
    expect(onderdeelstand(afloopt, VANDAAG)).toBe("garantie_loopt_af");
    expect(onderdeelstand(voorbij, VANDAAG)).toBe("garantie_voorbij");
    expect(onderdeelstand(normaal, VANDAAG)).toBe("normaal");
  });

  it("laat een openstaande registratie zwaarder wegen dan een aflopende garantie", () => {
    const gesorteerd = sorteerOnderdelen([voorbij, normaal, afloopt, registratie], VANDAAG);
    expect(gesorteerd.map((o) => o.id)).toEqual(["registratie", "afloopt", "normaal", "voorbij"]);
  });

  it("sorteert binnen dezelfde stand op categorie en dan op naam", () => {
    const a = onderdeel({ id: "a", naam: "Zonwering", categorie: "zonwering" });
    const b = onderdeel({ id: "b", naam: "Boiler", categorie: "warm_water" });
    const c = onderdeel({ id: "c", naam: "Anode", categorie: "warm_water" });
    const gesorteerd = sorteerOnderdelen([a, b, c], VANDAAG);
    expect(gesorteerd.map((o) => o.id)).toEqual(["c", "b", "a"]);
  });

  it("laat de invoerlijst ongemoeid", () => {
    const invoer = [voorbij, registratie];
    sorteerOnderdelen(invoer, VANDAAG);
    expect(invoer.map((o) => o.id)).toEqual(["voorbij", "registratie"]);
  });
});

describe("garantiesDieAflopen", () => {
  it("geeft alleen wat binnen 90 dagen afloopt, dichtstbijzijnd eerst", () => {
    const lijst = [
      onderdeel({
        id: "ver",
        installatieDatum: new Date(Date.UTC(2026, 0, 1)),
        garantieMaanden: 60,
      }),
      onderdeel({
        id: "later",
        installatieDatum: new Date(Date.UTC(2024, 9, 1)),
        garantieMaanden: 24,
      }),
      onderdeel({
        id: "eerder",
        installatieDatum: new Date(Date.UTC(2024, 7, 15)),
        garantieMaanden: 24,
      }),
      onderdeel({ id: "geen-datum", garantieMaanden: 24 }),
    ];
    expect(garantiesDieAflopen(lijst, VANDAAG).map((r) => r.onderdeel.id)).toEqual([
      "eerder",
      "later",
    ]);
  });

  it("geeft een lege lijst als er niets afloopt", () => {
    expect(garantiesDieAflopen([onderdeel()], VANDAAG)).toEqual([]);
  });
});

describe("ordenSpecs", () => {
  const volgorde = ["vermogen", "scop", "koudemiddel"];

  it("geeft een lege lijst zonder specs", () => {
    expect(ordenSpecs(undefined, volgorde)).toEqual([]);
  });

  it("volgt de volgorde van de bibliotheek en niet het alfabet", () => {
    const specs = { koudemiddel: "R290", vermogen: "7,5 kW", scop: "4,8" };
    expect(ordenSpecs(specs, volgorde).map((r) => r.sleutel)).toEqual([
      "vermogen",
      "scop",
      "koudemiddel",
    ]);
  });

  it("slaat ontbrekende sleutels over", () => {
    expect(ordenSpecs({ scop: "4,8" }, volgorde)).toEqual([{ sleutel: "scop", waarde: "4,8" }]);
  });

  it("zet eigen sleutels achteraan, alfabetisch", () => {
    const specs = { zelfbedacht: "x", vermogen: "7,5 kW", aanvullend: "y" };
    expect(ordenSpecs(specs, volgorde).map((r) => r.sleutel)).toEqual([
      "vermogen",
      "aanvullend",
      "zelfbedacht",
    ]);
  });
});
