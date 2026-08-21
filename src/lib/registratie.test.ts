import { describe, expect, it } from "vitest";
import { bepaalRegistratiescherm } from "./registratie";

/**
 * De belangrijkste van deze vier is de tweede: ontgrendeld én een verse
 * herstelcode. Precies die combinatie stuurde de gebruiker weg vóórdat hij
 * zijn code had gezien, omdat `initialiseerKluis()` de kluis zelf ontgrendelt.
 */
describe("bepaalRegistratiescherm", () => {
  it("toont het formulier bij een vergrendelde kluis zonder code", () => {
    expect(bepaalRegistratiescherm(false, false)).toBe("formulier");
  });

  it("toont de herstelcode zodra die er is — ook al is de kluis nu open", () => {
    expect(bepaalRegistratiescherm(true, true)).toBe("herstelcode");
  });

  it("stuurt door bij een open kluis zonder verse code", () => {
    expect(bepaalRegistratiescherm(true, false)).toBe("doorsturen");
  });

  it("toont de code ook als de kluis intussen weer vergrendeld is", () => {
    // De auto-lock kan toeslaan terwijl het codescherm openstaat. De code
    // wegnemen zou hem onherstelbaar verliezen.
    expect(bepaalRegistratiescherm(false, true)).toBe("herstelcode");
  });

  it("stuurt nooit door zolang er een code te tonen is", () => {
    for (const ontgrendeld of [true, false]) {
      expect(bepaalRegistratiescherm(ontgrendeld, true)).not.toBe("doorsturen");
    }
  });
});
