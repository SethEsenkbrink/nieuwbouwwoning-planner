import { describe, expect, it } from "vitest";
import { leesBedragInvoer, toonBedrag, toonBedragInvoer } from "./bedrag";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BUG-01 uit de live test van 1 augustus 2026
 *
 * Zes schermen schoonden een bedrag op met `.replace(/[.\s]/g, "")`. Dat haalt
 * de punt weg maar laat de komma staan, dus `1250,50` werd `Number("1250,50")`
 * en dat is NaN. De gebruiker kreeg "Vul het bedrag in als een getal" te zien
 * voor een bedrag dat hij correct had ingetypt.
 *
 * De tests hieronder pinnen alle vier de schrijfwijzen vast die een Nederlander
 * gebruikt, plus de stille fout die het gevaarlijkst is: een duizendtalpunt die
 * als decimaalteken gelezen wordt.
 * ═══════════════════════════════════════════════════════════════════════════
 */

describe("leesBedragInvoer", () => {
  it("leest een gewoon bedrag", () => {
    expect(leesBedragInvoer("1250")).toBe(1250);
    expect(leesBedragInvoer("  1250  ")).toBe(1250);
  });

  it("accepteert nul", () => {
    expect(leesBedragInvoer("0")).toBe(0);
  });

  /**
   * De vier schrijfwijzen uit de bevindingenlijst. De onderste twee werden
   * vóór deze fix geweigerd.
   */
  it("leest alle vier de gangbare schrijfwijzen", () => {
    expect(leesBedragInvoer("1250")).toBe(1250);
    expect(leesBedragInvoer("1.250")).toBe(1250);
    expect(leesBedragInvoer("1250,50")).toBe(1251);
    expect(leesBedragInvoer("1.250,50")).toBe(1251);
  });

  /**
   * Dit is de stille fout. Zonder de duizendtalregel wordt "1.250" gelezen als
   * 1,25 en dus afgerond op één euro — een factor 1000 mis in een bedrag dat
   * er verder normaal uitziet.
   */
  it("herkent de punt als duizendtalscheiding", () => {
    expect(leesBedragInvoer("1.250")).toBe(1250);
    expect(leesBedragInvoer("325.000")).toBe(325000);
    expect(leesBedragInvoer("1.234.567")).toBe(1234567);
  });

  /**
   * Maar níét als er geen drie cijfers achter staan: "1.25" is een
   * decimaalteken en geen duizendtal.
   */
  it("laat een punt met minder dan drie cijfers erachter met rust", () => {
    expect(leesBedragInvoer("1.25")).toBe(1);
    expect(leesBedragInvoer("12.5")).toBe(13);
  });

  it("accepteert een ingetypt euroteken", () => {
    expect(leesBedragInvoer("€1250")).toBe(1250);
    expect(leesBedragInvoer("€ 1.250,50")).toBe(1251);
    expect(leesBedragInvoer("1250 €")).toBe(1250);
  });

  /**
   * Uit een gekopieerd bedrag komt vaak een harde spatie (U+00A0) mee in
   * plaats van een gewone. Expliciet als escape geschreven: een onzichtbaar
   * teken in een test bewijst niets, want niemand kan zien wat er staat.
   */
  it("accepteert zowel een gewone als een harde spatie", () => {
    expect(leesBedragInvoer("€ 1 250")).toBe(1250);
    expect(leesBedragInvoer("€\u00a01\u00a0250")).toBe(1250);
  });

  it("rondt af op hele euro's, naar boven vanaf een halve cent", () => {
    expect(leesBedragInvoer("1250,49")).toBe(1250);
    expect(leesBedragInvoer("1250,50")).toBe(1251);
    expect(leesBedragInvoer("1250,99")).toBe(1251);
  });

  it("weigert een negatief bedrag", () => {
    expect(leesBedragInvoer("-500")).toBeUndefined();
    expect(leesBedragInvoer("€ -500")).toBeUndefined();
  });

  it("weigert tekst en lege invoer", () => {
    expect(leesBedragInvoer("")).toBeUndefined();
    expect(leesBedragInvoer("   ")).toBeUndefined();
    expect(leesBedragInvoer("veel")).toBeUndefined();
    expect(leesBedragInvoer("1250 euro")).toBeUndefined();
  });

  /**
   * `String.replace` met een string-patroon vervangt alleen de eerste
   * treffer. Bij twee komma's blijft er dus één staan en valt de invoer
   * terecht buiten de regex — vastgepind zodat een latere refactor naar
   * `replaceAll` deze weigering niet stilzwijgend omdraait.
   */
  it("weigert twee decimaaltekens", () => {
    expect(leesBedragInvoer("1,5,5")).toBeUndefined();
    expect(leesBedragInvoer("1,50,")).toBeUndefined();
  });
});

describe("toonBedragInvoer", () => {
  it("toont duizendtalpunten zonder euroteken", () => {
    expect(toonBedragInvoer(1250)).toBe("1.250");
    expect(toonBedragInvoer(325000)).toBe("325.000");
  });

  it("geeft een lege string bij niets ingevuld", () => {
    expect(toonBedragInvoer(undefined)).toBe("");
  });

  it("toont nul als nul, niet als leeg", () => {
    expect(toonBedragInvoer(0)).toBe("0");
  });

  /** Wat je terugziet moet lezen zoals je het opnieuw zou intypen. */
  it("levert iets op dat leesBedragInvoer weer terugleest", () => {
    for (const bedrag of [0, 1, 999, 1250, 325000, 1234567]) {
      expect(leesBedragInvoer(toonBedragInvoer(bedrag))).toBe(bedrag);
    }
  });
});

describe("toonBedrag", () => {
  it("toont een streepje bij niets ingevuld", () => {
    expect(toonBedrag(undefined)).toBe("—");
  });

  it("onderscheidt nul euro van niets ingevuld", () => {
    expect(toonBedrag(0)).toBe("€ 0");
  });

  it("rondt af en zet er duizendtalpunten in", () => {
    expect(toonBedrag(1250.4)).toBe("€ 1.250");
    expect(toonBedrag(325000)).toBe("€ 325.000");
  });
});
