import { describe, expect, it } from "vitest";
import {
  alleSlots,
  bepaalSlots,
  bepaalTeSchrijvenSlots,
  SLOTS_PER_ROTATIE,
} from "./rotatie";

/**
 * Het roulerende schema ontbrak volledig (A-08). Deze tests pinnen vooral het
 * gedrag vast dat een naïeve implementatie met een ophogende teller fout doet:
 * onregelmatig gebruik mag de reeks niet in één dag rondtrekken.
 */

describe("Slotindeling", () => {
  it("kent 7 dagelijkse, 4 wekelijkse en 12 maandelijkse slots", () => {
    expect(SLOTS_PER_ROTATIE).toEqual({ dagelijks: 7, wekelijks: 4, maandelijks: 12 });
    expect(alleSlots()).toHaveLength(23);
  });

  it("geeft elk slot een unieke bestandsnaam", () => {
    const namen = alleSlots().map((s) => s.bestandsnaam);
    expect(new Set(namen).size).toBe(23);
  });

  it("gebruikt de ISO-weekdag voor het dagelijkse slot", () => {
    // 2026-08-17 is een maandag, 2026-08-23 een zondag.
    expect(bepaalSlots(new Date(2026, 7, 17)).dagelijks.nummer).toBe(1);
    expect(bepaalSlots(new Date(2026, 7, 23)).dagelijks.nummer).toBe(7);
  });

  it("laat dag 29 tot en met 31 in week 4 vallen, zodat er nooit een week 5 is", () => {
    for (const dag of [29, 30, 31]) {
      expect(bepaalSlots(new Date(2026, 0, dag)).wekelijks.nummer).toBe(4);
    }
    expect(bepaalSlots(new Date(2026, 0, 1)).wekelijks.nummer).toBe(1);
    expect(bepaalSlots(new Date(2026, 0, 8)).wekelijks.nummer).toBe(2);
  });

  it("gebruikt het maandnummer voor het maandelijkse slot", () => {
    expect(bepaalSlots(new Date(2026, 0, 15)).maandelijks.nummer).toBe(1);
    expect(bepaalSlots(new Date(2026, 11, 15)).maandelijks.nummer).toBe(12);
  });

  it("wijst dezelfde dag altijd hetzelfde slot toe, ongeacht het jaar", () => {
    const a = bepaalSlots(new Date(2026, 7, 17));
    const b = bepaalSlots(new Date(2027, 7, 16)); // ook een maandag
    expect(a.dagelijks.bestandsnaam).toBe(b.dagelijks.bestandsnaam);
  });
});

describe("Bepalen wat er geschreven moet worden", () => {
  const maandag = new Date(2026, 7, 17, 12, 0, 0);

  it("schrijft alles als de map nog leeg is", () => {
    const slots = bepaalTeSchrijvenSlots(maandag, new Map());
    expect(slots.map((s) => s.rotatie).sort()).toEqual([
      "dagelijks",
      "maandelijks",
      "wekelijks",
    ]);
  });

  it("doet niets als alle slots vandaag al geschreven zijn", () => {
    const zojuist = new Date(maandag.getTime() - 60 * 1000);
    const bestaand = new Map(
      Object.values(bepaalSlots(maandag)).map((s) => [s.bestandsnaam, zojuist]),
    );
    expect(bepaalTeSchrijvenSlots(maandag, bestaand)).toHaveLength(0);
  });

  it("schrijft tien keer op één dag niet tien dagbackups", () => {
    // Dit is precies wat een ophogende teller fout doet: die zou de hele
    // dagreeks in één middag rondtrekken en zeven dagen overschrijven.
    const bestaand = new Map<string, Date>();
    const slots = bepaalSlots(maandag);
    bestaand.set(slots.dagelijks.bestandsnaam, new Date(maandag.getTime() - 3600 * 1000));
    bestaand.set(slots.wekelijks.bestandsnaam, new Date(maandag.getTime() - 3600 * 1000));
    bestaand.set(slots.maandelijks.bestandsnaam, new Date(maandag.getTime() - 3600 * 1000));

    for (let poging = 0; poging < 10; poging++) {
      expect(bepaalTeSchrijvenSlots(maandag, bestaand)).toHaveLength(0);
    }
  });

  it("vernieuwt het dagslot zodra het een dag oud is", () => {
    const slots = bepaalSlots(maandag);
    const bestaand = new Map([
      [slots.dagelijks.bestandsnaam, new Date(maandag.getTime() - 25 * 3600 * 1000)],
      [slots.wekelijks.bestandsnaam, new Date(maandag.getTime() - 3600 * 1000)],
      [slots.maandelijks.bestandsnaam, new Date(maandag.getTime() - 3600 * 1000)],
    ]);

    const teSchrijven = bepaalTeSchrijvenSlots(maandag, bestaand);
    expect(teSchrijven).toHaveLength(1);
    expect(teSchrijven[0]?.rotatie).toBe("dagelijks");
  });

  it("werkt na twee maanden stilte alle drie de reeksen bij", () => {
    const langGeleden = new Date(maandag.getTime() - 60 * 24 * 3600 * 1000);
    const bestaand = new Map(
      Object.values(bepaalSlots(maandag)).map((s) => [s.bestandsnaam, langGeleden]),
    );

    expect(bepaalTeSchrijvenSlots(maandag, bestaand)).toHaveLength(3);
  });

  it("vernieuwt het maandslot pas na 28 dagen, niet na 30", () => {
    const slots = bepaalSlots(maandag);
    const negenentwintig = new Date(maandag.getTime() - 29 * 24 * 3600 * 1000);
    const zevenentwintig = new Date(maandag.getTime() - 27 * 24 * 3600 * 1000);

    const wel = new Map([[slots.maandelijks.bestandsnaam, negenentwintig]]);
    const niet = new Map([[slots.maandelijks.bestandsnaam, zevenentwintig]]);

    expect(
      bepaalTeSchrijvenSlots(maandag, wel).some((s) => s.rotatie === "maandelijks"),
    ).toBe(true);
    expect(
      bepaalTeSchrijvenSlots(maandag, niet).some((s) => s.rotatie === "maandelijks"),
    ).toBe(false);
  });
});
