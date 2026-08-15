import { describe, expect, it } from "vitest";
import { Timestamp } from "@/types/model";
import { evalueerRegels } from "./engine";
import type { RegelContext } from "./types";

describe("Deterministische Regelmotor", () => {
  it("signaleert naderende 5%-depot termijn 14 dagen van tevoren", () => {
    const peildatum = new Date("2026-05-01T12:00:00.000Z");
    // Oplevering was 76 dagen geleden -> verval over 14 dagen (90 - 76 = 14)
    const opleverDatum = new Date("2026-02-14T12:00:00.000Z");

    const context: RegelContext = {
      project: {
        naam: "Kavel 12",
        opleverVerwacht: Timestamp.fromDate(opleverDatum),
        aangemaaktOp: Timestamp.fromDate(new Date("2026-01-01")),
      },
      peildatum,
    };

    const signalen = evalueerRegels(context);
    const depotSignaal = signalen.find((s) => s.regelId === "T-001");
    expect(depotSignaal).toBeDefined();
    expect(depotSignaal?.niveau).toBe("attentie");
    expect(depotSignaal?.titel).toContain("5%-depot vervaldatum nadert");
  });

  it("signaleert dringende 5%-depot waarschuwing 4 dagen van tevoren", () => {
    const peildatum = new Date("2026-05-11T12:00:00.000Z");
    // Oplevering was 86 dagen geleden -> verval over 4 dagen
    const opleverDatum = new Date("2026-02-14T12:00:00.000Z");

    const context: RegelContext = {
      project: {
        naam: "Kavel 12",
        opleverVerwacht: Timestamp.fromDate(opleverDatum),
        aangemaaktOp: Timestamp.fromDate(new Date("2026-01-01")),
      },
      peildatum,
    };

    const signalen = evalueerRegels(context);
    const depotSignaal = signalen.find((s) => s.regelId === "T-001");
    expect(depotSignaal).toBeDefined();
    expect(depotSignaal?.niveau).toBe("waarschuwing");
    expect(depotSignaal?.titel).toContain("minder dan 7 dagen");
  });

  it("signaleert langdurig openstaand gebrek ouder dan 30 en 90 dagen", () => {
    const peildatum = new Date("2026-06-01T12:00:00.000Z");
    const gemeld40DagenTerug = new Date("2026-04-22T12:00:00.000Z");
    const gemeld100DagenTerug = new Date("2026-02-21T12:00:00.000Z");

    const context: RegelContext = {
      project: {
        naam: "Kavel 12",
        aangemaaktOp: Timestamp.fromDate(new Date("2026-01-01")),
      },
      gebreken: [
        {
          id: "geb-1",
          omschrijving: "Kras op raamkozijn woonkamer",
          status: "open",
          gemeldOp: Timestamp.fromDate(gemeld40DagenTerug),
        },
        {
          id: "geb-2",
          omschrijving: "Lekkage standleiding zolder",
          status: "open",
          gemeldOp: Timestamp.fromDate(gemeld100DagenTerug),
        },
      ],
      peildatum,
    };

    const signalen = evalueerRegels(context);
    const g1 = signalen.find((s) => s.id.includes("geb-1"));
    const g2 = signalen.find((s) => s.id.includes("geb-2"));

    expect(g1?.niveau).toBe("waarschuwing");
    expect(g2?.niveau).toBe("urgent");
  });

  it("signaleert naderende en verstreken sluitingsdatums van meerwerk", () => {
    const peildatum = new Date("2026-04-10T12:00:00.000Z");

    const context: RegelContext = {
      project: {
        naam: "Kavel 12",
        aangemaaktOp: Timestamp.fromDate(new Date("2026-01-01")),
      },
      meerwerk: [
        {
          id: "mw-1",
          omschrijving: "Uitbouw 2.40m achterzijde",
          sluiting: "vaste_datum",
          status: "overweeg",
          sluitingsdatum: Timestamp.fromDate(new Date("2026-04-12T12:00:00.000Z")), // 2 dagen
        },
        {
          id: "mw-2",
          omschrijving: "Extra wandcontactdozen keuken",
          sluiting: "vaste_datum",
          status: "overweeg",
          sluitingsdatum: Timestamp.fromDate(new Date("2026-04-01T12:00:00.000Z")), // verstreken
        },
      ],
      peildatum,
    };

    const signalen = evalueerRegels(context);
    const s1 = signalen.find((s) => s.id.includes("mw-1"));
    const s2 = signalen.find((s) => s.id.includes("mw-2"));

    expect(s1?.niveau).toBe("waarschuwing");
    expect(s2?.niveau).toBe("urgent");
  });

  it("signaleert meerwerkbudget overschrijding", () => {
    const context: RegelContext = {
      project: {
        naam: "Kavel 12",
        meerwerkbudget: 15000,
        aangemaaktOp: Timestamp.fromDate(new Date("2026-01-01")),
      },
      meerwerk: [
        {
          id: "mw-1",
          omschrijving: "Uitbouw",
          sluiting: "vaste_datum",
          status: "besteld",
          bedrag: 12000,
        },
        {
          id: "mw-2",
          omschrijving: "Dakkapel",
          sluiting: "vaste_datum",
          status: "bevestigd",
          bedrag: 5500,
        },
      ],
      peildatum: new Date("2026-01-15"),
    };

    const signalen = evalueerRegels(context);
    const budgetSignaal = signalen.find((s) => s.regelId === "F-002");
    expect(budgetSignaal).toBeDefined();
    expect(budgetSignaal?.niveau).toBe("waarschuwing");
    expect(budgetSignaal?.titel).toContain("2.500");
  });

  it("signaleert 24-maanden bouwdepot looptijd", () => {
    const passeerdatum = new Date("2024-05-01T12:00:00.000Z");
    const peildatum = new Date("2026-04-01T12:00:00.000Z"); // 23 maanden verstreken (1 maand resterend)

    const context: RegelContext = {
      project: {
        naam: "Kavel 12",
        hypotheek: {
          passeerdatum: Timestamp.fromDate(passeerdatum),
          bedrag: 400000,
        },
        aangemaaktOp: Timestamp.fromDate(new Date("2024-01-01")),
      },
      peildatum,
    };

    const signalen = evalueerRegels(context);
    const depotSignaal = signalen.find((s) => s.regelId === "F-001");
    expect(depotSignaal).toBeDefined();
    expect(depotSignaal?.niveau).toBe("waarschuwing");
    expect(depotSignaal?.titel).toContain("verloopt binnen 1 maand");
  });

  it("signaleert naderende garantievervaldatum (10 dagen)", () => {
    const peildatum = new Date("2026-06-01T12:00:00.000Z");
    const ingangsdatum = new Date("2021-06-11T12:00:00.000Z"); // 5 jaar garantie verloopt op 2026-06-11 (10 dagen)

    const context: RegelContext = {
      project: {
        naam: "Kavel 12",
        aangemaaktOp: Timestamp.fromDate(new Date("2021-01-01")),
      },
      garanties: [
        {
          id: "gar-1",
          titel: "Buitenschilderwerk garantie",
          type: "uitvoerdersgarantie",
          ingangsdatum: Timestamp.fromDate(ingangsdatum),
          looptijdJaren: 5,
        },
      ],
      peildatum,
    };

    const signalen = evalueerRegels(context);
    const gSignaal = signalen.find((s) => s.regelId === "G-001");
    expect(gSignaal).toBeDefined();
    expect(gSignaal?.niveau).toBe("waarschuwing");
    expect(gSignaal?.titel).toContain("10 dagen");
  });

  it("signaleert achterstallige onderhoudstaak", () => {
    const peildatum = new Date("2026-06-01T12:00:00.000Z");
    const laatstUitgevoerd = new Date("2025-01-01T12:00:00.000Z"); // 1 jaar interval = 2026-01-01, nu 5 maanden te laat

    const context: RegelContext = {
      project: {
        naam: "Kavel 12",
        aangemaaktOp: Timestamp.fromDate(new Date("2025-01-01")),
      },
      onderhoudstaken: [
        {
          id: "taak-wtw",
          titel: "WTW-filters vervangen",
          intervalDagen: 180, // halfjaarlijks
          laatstUitgevoerdOp: Timestamp.fromDate(laatstUitgevoerd),
          waardenBron: "eigen",
        },
      ],
      peildatum,
    };

    const signalen = evalueerRegels(context);
    const oSignaal = signalen.find((s) => s.regelId === "O-001");
    expect(oSignaal).toBeDefined();
    expect(oSignaal?.niveau).toBe("waarschuwing");
    expect(oSignaal?.titel).toContain("Onderhoud achterstallig");
  });

  it("signaleert ontbrekende meterstandopname na 70 dagen", () => {
    const peildatum = new Date("2026-06-01T12:00:00.000Z");
    const laatsteOpname = new Date("2026-03-23T12:00:00.000Z"); // 70 dagen geleden

    const context: RegelContext = {
      project: {
        naam: "Kavel 12",
        aangemaaktOp: Timestamp.fromDate(new Date("2026-01-01")),
      },
      meterstanden: [
        {
          id: "ms-1",
          meterId: "meter-stroom",
          opgenomenOp: Timestamp.fromDate(laatsteOpname),
          stand: 2450.5,
        },
      ],
      peildatum,
    };

    const signalen = evalueerRegels(context);
    const eSignaal = signalen.find((s) => s.regelId === "E-002");
    expect(eSignaal).toBeDefined();
    expect(eSignaal?.niveau).toBe("attentie");
    expect(eSignaal?.titel).toContain("Tijd voor nieuwe meterstanden");
  });
});
