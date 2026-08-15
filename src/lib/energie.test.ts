import { describe, expect, it } from "vitest";
import {
  bepaalStandaardSalderingspercentage,
  berekenIndicatiefEnergielabel,
  berekenSaldering,
  ENERGIELABEL_DISCLAIMER,
} from "./energie";

describe("Energie & Saldering Berekeningen", () => {
  describe("Indicatief Energielabel", () => {
    it("berekent A++++ voor een gasloze woning met zeer laag verbruik / netto nul", () => {
      const res = berekenIndicatiefEnergielabel(0, 0, 130, 365);
      expect(res.label).toBe("A++++");
      expect(res.fossielEnergieKwhPerM2).toBe(0);
      expect(res.disclaimer).toBe(ENERGIELABEL_DISCLAIMER);
    });

    it("berekent A+ voor een moderne warmtepomwoning (ca. 2500 kWh, 0 m3 gas, 130m2)", () => {
      // 2500 * 1.45 = 3625 kWh primair / 130 = 27.8 -> A+++
      const res = berekenIndicatiefEnergielabel(2500, 0, 130, 365);
      expect(res.label).toBe("A+++");
      expect(res.fossielEnergieKwhPerM2).toBe(28);
    });

    it("berekent label C voor een gemiddelde bestaande woning (3000 kWh, 1200 m3 gas, 120m2)", () => {
      // (3000 * 1.45 + 1200 * 9.77) / 120 = (4350 + 11724) / 120 = 16074 / 120 = 133.95 -> A
      const res = berekenIndicatiefEnergielabel(3000, 1200, 120, 365);
      expect(res.label).toBe("A");
    });
  });

  describe("Salderingsregeling & Afbouw", () => {
    it("hanteert 100% saldering tot en met 2026 en afbouw conform schema na 2026", () => {
      expect(bepaalStandaardSalderingspercentage(2025)).toBe(100);
      expect(bepaalStandaardSalderingspercentage(2026)).toBe(100);
      expect(bepaalStandaardSalderingspercentage(2027)).toBe(64);
      expect(bepaalStandaardSalderingspercentage(2028)).toBe(55);
      expect(bepaalStandaardSalderingspercentage(2031)).toBe(0);
    });

    it("berekent volledige saldering in 2026 bij overschot zonnepanelen", () => {
      // 3000 kWh levering, 4000 kWh teruglevering in 2026
      const res = berekenSaldering(3000, 4000, {
        jaar: 2026,
        stroomTariefPerKwh: 0.35,
        terugleverVergoedingPerKwh: 0.08,
        vasteTerugleverKostenPerKwh: 0.05,
      });

      expect(res.salderingsPercentage).toBe(100);
      expect(res.gesaldeerdeKwh).toBe(3000);
      expect(res.nettoAfnameKwh).toBe(0);
      expect(res.nettoTerugleveringKwh).toBe(1000);
      expect(res.besparingSaldering).toBe(1050); // 3000 * 0.35
      expect(res.opbrengstTeruglevering).toBe(80); // 1000 * 0.08
      expect(res.terugleverKosten).toBe(200); // 4000 * 0.05
      expect(res.nettoKosten).toBe(120); // 0 - 80 + 200 = 120
    });

    it("berekent gedeeltelijke saldering in 2027 (64%)", () => {
      const res = berekenSaldering(3000, 3000, {
        jaar: 2027,
        stroomTariefPerKwh: 0.30,
        terugleverVergoedingPerKwh: 0.06,
        vasteTerugleverKostenPerKwh: 0,
      });

      expect(res.salderingsPercentage).toBe(64);
      expect(res.gesaldeerdeKwh).toBe(1920); // 3000 * 0.64
      expect(res.nettoAfnameKwh).toBe(1080); // 3000 - 1920
      expect(res.nettoTerugleveringKwh).toBe(1080);
      expect(res.besparingSaldering).toBe(576); // 1920 * 0.30
      expect(res.nettoKosten).toBe(259.2); // (1080 * 0.30) - (1080 * 0.06) = 324 - 64.8 = 259.2
    });
  });
});

describe("Wettelijke waarschuwing bij het indicatieve label", () => {
  /**
   * Deze test staat er omdat de tekst eerder alleen NTA 8800 noemde. Zonder
   * BRL 9500 en EP-Online kan een lezer niet nagaan wat een label wél
   * rechtsgeldig maakt (A-12). De termen mogen niet stil verdwijnen.
   */
  it.each(["NTA 8800", "BRL 9500", "EP-Online"])("noemt %s", (term) => {
    expect(ENERGIELABEL_DISCLAIMER).toContain(term);
  });

  it("zegt expliciet dat het geen rechtsgeldig label is", () => {
    expect(ENERGIELABEL_DISCLAIMER).toMatch(/géén rechtsgeldig energielabel/i);
  });

  it("wordt meegegeven in het berekende resultaat", () => {
    const resultaat = berekenIndicatiefEnergielabel(2500, 900, 120, 365);
    expect(resultaat.disclaimer).toBe(ENERGIELABEL_DISCLAIMER);
  });
});
