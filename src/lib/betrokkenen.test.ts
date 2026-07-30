import { describe, expect, it } from "vitest";
import { bepaalWaardenBron } from "@/lib/betrokkenen";

/**
 * Deze regel bepaalt of de UI "voorstel — controleer bij je leverancier" toont.
 * Gaat hij fout, dan presenteert de app een schatting als feit (constraint C5)
 * of blijft er een disclaimer staan op een cijfer dat de gebruiker zelf heeft
 * opgezocht. Beide ondermijnen het vertrouwen in de getallen.
 */

const voorstel = {
  aanlooptijdDagen: 70,
  annuleertermijnDagen: 21,
  waardenBron: "voorstel",
} as const;

describe("bepaalWaardenBron", () => {
  it("blijft voorstel als er niets aan de termijnen verandert", () => {
    expect(bepaalWaardenBron(voorstel, { email: "info@keuken.nl" })).toBe("voorstel");
  });

  it("blijft voorstel als dezelfde waarde opnieuw wordt opgeslagen", () => {
    // Een formulier stuurt vaak alle velden mee, ook de ongewijzigde.
    expect(bepaalWaardenBron(voorstel, { aanlooptijdDagen: 70 })).toBe("voorstel");
  });

  it("wordt eigen zodra de aanlooptijd wordt aangepast", () => {
    expect(bepaalWaardenBron(voorstel, { aanlooptijdDagen: 56 })).toBe("eigen");
  });

  it("wordt eigen zodra de annuleertermijn wordt aangepast", () => {
    expect(bepaalWaardenBron(voorstel, { annuleertermijnDagen: 30 })).toBe("eigen");
  });

  it("wordt eigen bij een wijziging naar nul", () => {
    // Nul is een geldige waarde ("niets te annuleren"), geen leeg veld.
    expect(bepaalWaardenBron(voorstel, { annuleertermijnDagen: 0 })).toBe("eigen");
  });

  it("blijft eigen, ook als er daarna niets meer aan de termijnen verandert", () => {
    const eigen = { ...voorstel, waardenBron: "eigen" } as const;
    expect(bepaalWaardenBron(eigen, { notitie: "gebeld op 3 augustus" })).toBe("eigen");
  });
});
