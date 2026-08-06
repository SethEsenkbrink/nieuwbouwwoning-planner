import { describe, expect, it } from "vitest";
import {
  alsInvoerwaarde,
  toonAfstand,
  toonDatum,
  toonDatumMetAfstand,
  uitInvoerwaarde,
  vandaag,
} from "./datum";

/** Korte notatie voor een datum op UTC-middernacht. */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("toonDatum", () => {
  it("toont een streepje bij geen datum", () => {
    expect(toonDatum(undefined)).toBe("—");
  });

  /**
   * In UTC lezen is geen detail. Zou dit in lokale tijd gebeuren, dan toont
   * een UTC-middernacht in de Nederlandse zomertijd de vorige dag.
   */
  it("leest in UTC en verschuift dus niet in de zomertijd", () => {
    expect(toonDatum(d("2026-08-02"))).toBe("2 aug 2026");
    expect(toonDatum(d("2026-11-16"))).toBe("16 nov 2026");
  });
});

describe("invoerwaarden", () => {
  it("gaat heen en weer zonder een dag te verliezen", () => {
    for (const iso of ["2026-01-01", "2026-08-02", "2026-10-25", "2026-12-31"]) {
      expect(alsInvoerwaarde(uitInvoerwaarde(iso))).toBe(iso);
    }
  });

  it("geeft undefined bij een leeg veld", () => {
    expect(uitInvoerwaarde("")).toBeUndefined();
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BUG-03 — `vandaag()` pakt de lokale dag
 *
 * Deze tests zijn met opzet tijdzone-onafhankelijk geschreven. `new Date(jaar,
 * maand, dag, uur)` is de lokale-tijd-constructor, dus `getFullYear()` en
 * consorten geven gegarandeerd terug wat erin ging — of de testrunner nu in
 * Amsterdam of in UTC draait. Een test die alleen in één tijdzone slaagt,
 * bewijst niets over de bug die hij hoort af te dekken.
 *
 * Let op: de maand is nul-gebaseerd, dus 7 is augustus.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("vandaag", () => {
  it("zet de lokale dag op UTC-middernacht", () => {
    expect(vandaag(new Date(2026, 7, 2, 14, 0))).toEqual(d("2026-08-02"));
  });

  /** Dit is het scenario van BUG-03: 01:30 's nachts in de zomertijd. */
  it("blijft op dezelfde dag midden in de nacht", () => {
    expect(vandaag(new Date(2026, 7, 2, 1, 30))).toEqual(d("2026-08-02"));
    expect(vandaag(new Date(2026, 7, 2, 0, 1))).toEqual(d("2026-08-02"));
  });

  it("blijft op dezelfde dag vlak voor middernacht", () => {
    expect(vandaag(new Date(2026, 7, 2, 23, 59))).toEqual(d("2026-08-02"));
  });

  it("klopt rond de jaarwisseling", () => {
    expect(vandaag(new Date(2026, 11, 31, 23, 30))).toEqual(d("2026-12-31"));
    expect(vandaag(new Date(2027, 0, 1, 0, 30))).toEqual(d("2027-01-01"));
  });

  it("is idempotent op een datum die er al op staat", () => {
    const eerste = vandaag(new Date(2026, 7, 2, 9, 0));
    expect(vandaag(eerste)).toEqual(eerste);
  });
});

describe("toonAfstand", () => {
  const nu = d("2026-08-02");

  it("noemt de dag zelf bij naam", () => {
    expect(toonAfstand(d("2026-08-02"), nu)).toBe("vandaag");
    expect(toonAfstand(d("2026-08-03"), nu)).toBe("morgen");
    expect(toonAfstand(d("2026-08-01"), nu)).toBe("gisteren");
  });

  it("telt dichtbij in dagen", () => {
    expect(toonAfstand(d("2026-08-07"), nu)).toBe("over 5 dagen");
    expect(toonAfstand(d("2026-08-15"), nu)).toBe("over 13 dagen");
  });

  it("telt verder weg in weken", () => {
    expect(toonAfstand(d("2026-08-16"), nu)).toBe("over 2 weken");
    expect(toonAfstand(d("2026-10-21"), nu)).toBe("over 11 weken");
    expect(toonAfstand(d("2026-10-28"), nu)).toBe("over 12 weken");
  });

  /** Voorbij een half jaar zegt "over 37 weken" minder dan "over 9 maanden". */
  it("telt ver weg in maanden", () => {
    expect(toonAfstand(d("2027-04-15"), nu)).toBe("over 9 maanden");
  });

  it("maakt verstreken datums herkenbaar", () => {
    expect(toonAfstand(d("2026-07-30"), nu)).toBe("3 dagen te laat");
    expect(toonAfstand(d("2026-07-05"), nu)).toBe("4 weken te laat");
    expect(toonAfstand(d("2026-04-02"), nu)).toBe("4 maanden te laat");
  });

  it("geeft een streepje bij geen datum", () => {
    expect(toonAfstand(undefined, nu)).toBe("—");
  });

  /**
   * De grenzen liggen op 14 en 180 dagen. Vastgepind omdat een verschuiving
   * hier stil is: "over 13 dagen" en "over 2 weken" zijn allebei plausibel,
   * dus een fout in de drempel valt bij het lezen niet op.
   */
  it("wisselt van eenheid op de afgesproken grenzen", () => {
    // 13 dagen is de laatste in dagen, 14 de eerste in weken.
    expect(toonAfstand(d("2026-08-15"), nu)).toBe("over 13 dagen");
    expect(toonAfstand(d("2026-08-16"), nu)).toBe("over 2 weken");
    // 179 dagen is de laatste in weken, 180 de eerste in maanden.
    expect(toonAfstand(d("2027-01-28"), nu)).toBe("over 26 weken");
    expect(toonAfstand(d("2027-01-29"), nu)).toBe("over 6 maanden");
  });
});

describe("toonDatumMetAfstand", () => {
  const nu = d("2026-08-02");

  /** De volgorde is de hele wijziging: eerst hoe dringend, dan welke dag. */
  it("zet de afstand vóór de datum", () => {
    expect(toonDatumMetAfstand(d("2026-10-28"), nu)).toBe("over 12 weken — 28 okt 2026");
    expect(toonDatumMetAfstand(d("2026-08-03"), nu)).toBe("morgen — 3 aug 2026");
  });

  it("geeft een streepje bij geen datum", () => {
    expect(toonDatumMetAfstand(undefined, nu)).toBe("—");
  });
});
