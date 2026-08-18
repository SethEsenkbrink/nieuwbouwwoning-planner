import { describe, expect, it } from "vitest";
import { magBewerken, QUICK_CAPTURE_PADEN } from "./useModus";

/**
 * B8.2: op mobiel mag er buiten quick-capture niets bewerkt worden. De regel
 * staat bewust los van de DOM zodat hij hier zonder browser te toetsen is —
 * de regel zelf is belangrijker dan de plek waar hij wordt toegepast.
 */
describe("Mobiele modus", () => {
  it("staat op desktop overal bewerken toe", () => {
    for (const pad of ["/", "/onderdelen", "/snel", "/projectinstellingen"]) {
      expect(magBewerken("desktop", pad)).toBe(true);
    }
  });

  it("staat op mobiel alleen quick-capture toe", () => {
    for (const pad of QUICK_CAPTURE_PADEN) {
      expect(magBewerken("mobiel", pad)).toBe(true);
    }
    for (const pad of ["/", "/onderdelen", "/woning", "/projectinstellingen"]) {
      expect(magBewerken("mobiel", pad)).toBe(false);
    }
  });

  it("rekent subpaden van quick-capture mee, maar geen naamgenoten", () => {
    expect(magBewerken("mobiel", "/snel/foto")).toBe(true);
    expect(magBewerken("mobiel", "/snelweg")).toBe(false);
  });
});
