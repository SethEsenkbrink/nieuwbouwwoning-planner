import { describe, expect, it } from "vitest";
import {
  bepaalUrgentie,
  berekenDatum,
  bouwActielijst,
  laatsteGratisSchuifdatum,
  verschilInDagen,
  voegDagenToe,
  type AfspraakInvoer,
  type BetrokkeneInvoer,
  type PlanningContext,
} from "@/lib/planning";

/**
 * Tests voor de rekenmotor.
 *
 * Dit is de eerste echte businesslogica in het project en daarmee de trigger
 * uit ADR-0006 om te gaan testen. De scenario's zijn geen willekeurige
 * getallen: ze komen uit de situaties die in ADR-0008 en de standaardlijst
 * beschreven staan — de vloerenlegger met droogtijd, de keuken met een lange
 * aanlooptijd, de verhuisbus die pas bij aanzegging iets hoeft te weten.
 */

/** Korte notatie voor een datum op UTC-middernacht. */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const VANDAAG = d("2026-07-30");

describe("datumrekenwerk", () => {
  it("telt dagen op", () => {
    expect(voegDagenToe(d("2026-09-08"), 42)).toEqual(d("2026-10-20"));
  });

  it("telt negatieve offsets af", () => {
    expect(voegDagenToe(d("2026-11-16"), -45)).toEqual(d("2026-10-02"));
  });

  it("blijft kloppen over de overgang naar wintertijd", () => {
    // In Nederland gaat de klok terug in de nacht van 24 op 25 oktober 2026.
    // Wie in lokale tijd rekent, komt hier een dag naast uit.
    expect(voegDagenToe(d("2026-10-20"), 14)).toEqual(d("2026-11-03"));
    expect(verschilInDagen(d("2026-11-03"), d("2026-10-20"))).toBe(14);
  });

  it("blijft kloppen over een schrikkeldag", () => {
    expect(voegDagenToe(d("2028-02-27"), 3)).toEqual(d("2028-03-01"));
  });

  it("geeft een negatief verschil als de eerste datum eerder ligt", () => {
    expect(verschilInDagen(d("2026-07-30"), d("2026-08-06"))).toBe(-7);
  });
});

describe("berekenDatum — met een bekend anker", () => {
  const context: PlanningContext = {
    ankers: [
      { type: "dekvloer_gestort", status: "bevestigd", verwachtOp: d("2026-09-08") },
      { type: "ruwbouw_gereed", status: "verwacht", verwachtOp: d("2026-08-10") },
    ],
    opleverband: { status: "indicatief", verwacht: d("2026-11-16") },
  };

  it("rekent de vloerenlegger vanaf de dekvloer, niet vanaf de oplevering", () => {
    // Dit is de kern van ADR-0008: 42 dagen droogtijd ná het storten.
    const band = berekenDatum("dekvloer_gestort", 42, context);
    expect(band?.verwacht).toEqual(d("2026-10-20"));
    expect(band?.gebruiktAnker).toBe("dekvloer_gestort");
    expect(band?.zekerheid).toBe("anker_bevestigd");
  });

  it("markeert een nog niet bevestigd anker als verwacht", () => {
    const band = berekenDatum("ruwbouw_gereed", 0, context);
    expect(band?.zekerheid).toBe("anker_verwacht");
  });

  it("levert een punt op, geen band, bij een anker met één datum", () => {
    const band = berekenDatum("dekvloer_gestort", 42, context);
    expect(band?.isPunt).toBe(true);
    expect(band?.vroegst).toEqual(band?.laatst);
  });
});

describe("berekenDatum — terugval als het anker ontbreekt", () => {
  // De situatie van gebruiker #1: alleen een indicatieve opleverdatum.
  const alleenOplevering: PlanningContext = {
    ankers: [],
    opleverband: { status: "indicatief", verwacht: d("2026-11-16") },
  };

  it("valt terug op de oplevering en zegt dat er is teruggevallen", () => {
    const band = berekenDatum("dekvloer_gestort", 42, alleenOplevering);
    expect(band?.zekerheid).toBe("teruggevallen");
    expect(band?.gebruiktAnker).toBe("oplevering");
    expect(band?.gevraagdAnker).toBe("dekvloer_gestort");
  });

  it("rekent de offset gewoon door op de terugvaldatum", () => {
    const band = berekenDatum("dekvloer_gestort", 42, alleenOplevering);
    expect(band?.verwacht).toEqual(d("2026-12-28"));
  });

  it("noemt een berekening op de oplevering zelf niet teruggevallen", () => {
    const band = berekenDatum("oplevering", 7, alleenOplevering);
    expect(band?.zekerheid).toBe("anker_verwacht");
    expect(band?.gevraagdAnker).toBe("oplevering");
  });

  it("negeert een anker zonder datum", () => {
    // Je weet dát de dekvloer komt, niet wanneer. Dat is geen anker om op te rekenen.
    const band = berekenDatum("dekvloer_gestort", 42, {
      ankers: [{ type: "dekvloer_gestort", status: "verwacht" }],
      opleverband: { status: "indicatief", verwacht: d("2026-11-16") },
    });
    expect(band?.zekerheid).toBe("teruggevallen");
  });

  it("geeft null als er niets bekend is om op te rekenen", () => {
    expect(berekenDatum("oplevering", 0, { ankers: [] })).toBeNull();
  });
});

describe("berekenDatum — de opleverdatum als band", () => {
  const bandbreedte: PlanningContext = {
    ankers: [],
    opleverband: {
      status: "bandbreedte",
      vroegst: d("2026-11-02"),
      verwacht: d("2026-11-16"),
      laatst: d("2026-12-14"),
    },
  };

  it("schuift alle drie de datums mee met de offset", () => {
    const band = berekenDatum("oplevering", 7, bandbreedte);
    expect(band?.vroegst).toEqual(d("2026-11-09"));
    expect(band?.verwacht).toEqual(d("2026-11-23"));
    expect(band?.laatst).toEqual(d("2026-12-21"));
    expect(band?.isPunt).toBe(false);
  });

  it("wordt een punt zodra de datum is aangezegd", () => {
    const aangezegd: PlanningContext = {
      ankers: [],
      opleverband: {
        status: "aangezegd",
        vroegst: d("2026-11-16"),
        verwacht: d("2026-11-16"),
        laatst: d("2026-11-16"),
      },
    };
    const band = berekenDatum("oplevering", 0, aangezegd);
    expect(band?.isPunt).toBe(true);
    expect(band?.zekerheid).toBe("anker_bevestigd");
  });

  it("vult ontbrekende randen van de band aan met de verwachte datum", () => {
    const band = berekenDatum("oplevering", 0, {
      ankers: [],
      opleverband: { status: "indicatief", verwacht: d("2026-11-16") },
    });
    expect(band?.vroegst).toEqual(d("2026-11-16"));
    expect(band?.laatst).toEqual(d("2026-11-16"));
  });
});

describe("laatsteGratisSchuifdatum", () => {
  it("rekent terug vanaf de vroegste datum, niet de verwachte", () => {
    // Valt het mee en vervroegt de oplevering, dan valt de deur eerder dicht.
    const band = berekenDatum("oplevering", 0, {
      ankers: [],
      opleverband: {
        status: "bandbreedte",
        vroegst: d("2026-11-02"),
        verwacht: d("2026-11-16"),
        laatst: d("2026-12-14"),
      },
    });
    expect(band).not.toBeNull();
    expect(laatsteGratisSchuifdatum(band!, 21)).toEqual(d("2026-10-12"));
  });
});

// ── Urgentie ───────────────────────────────────────────────────────────────

const keuken: BetrokkeneInvoer = {
  id: "b-keuken",
  naam: "Keukenleverancier",
  aanlooptijdDagen: 70,
  annuleertermijnDagen: 21,
  communicatieregel: "direct",
};

const bus: BetrokkeneInvoer = {
  id: "b-bus",
  naam: "Busverhuur",
  aanlooptijdDagen: 7,
  annuleertermijnDagen: 2,
  communicatieregel: "bij_aanzegging",
};

const basisAfspraak: AfspraakInvoer = {
  id: "af-1",
  betrokkeneId: "b-keuken",
  omschrijving: "Levering en montage",
  ankerType: "oplevering",
  offsetDagen: 7,
  status: "voorlopig",
};

function bandOp(datum: string) {
  const band = berekenDatum("oplevering", 0, {
    ankers: [],
    opleverband: { status: "indicatief", verwacht: d(datum) },
  });
  if (!band) throw new Error("test-opzet klopt niet");
  return band;
}

describe("bepaalUrgentie", () => {
  it("geeft geen urgentie als de partij de juiste datum al heeft", () => {
    const band = bandOp("2026-11-16");
    const uitkomst = bepaalUrgentie(
      { ...basisAfspraak, gecommuniceerdeDatum: d("2026-11-16") },
      keuken,
      band,
      VANDAAG,
      "indicatief",
    );
    expect(uitkomst.urgentie).toBe("geen");
  });

  it("is kritiek als de annuleertermijn binnen een week verloopt", () => {
    // Oplevering over 24 dagen, annuleertermijn 21 dagen → nog 3 dagen speling.
    const band = bandOp("2026-08-23");
    const uitkomst = bepaalUrgentie(
      { ...basisAfspraak, gecommuniceerdeDatum: d("2026-09-01") },
      keuken,
      band,
      VANDAAG,
      "indicatief",
    );
    expect(uitkomst.urgentie).toBe("kritiek");
    expect(uitkomst.reden).toContain("3 dagen");
  });

  it("is kritiek als de annuleertermijn al gepasseerd is", () => {
    const band = bandOp("2026-08-10");
    const uitkomst = bepaalUrgentie(
      { ...basisAfspraak, gecommuniceerdeDatum: d("2026-09-01") },
      keuken,
      band,
      VANDAAG,
      "indicatief",
    );
    expect(uitkomst.urgentie).toBe("kritiek");
    expect(uitkomst.reden).toContain("kost een wijziging geld");
  });

  it("is kritiek als de partij naar een achterhaalde datum toewerkt", () => {
    // De oude datum ligt binnen de aanlooptijd: ze zijn al bezig en staan
    // straks voor niets klaar.
    const band = bandOp("2027-03-01"); // nieuwe datum ligt ver weg
    const uitkomst = bepaalUrgentie(
      { ...basisAfspraak, gecommuniceerdeDatum: d("2026-09-15") },
      keuken,
      band,
      VANDAAG,
      "indicatief",
    );
    expect(uitkomst.urgentie).toBe("kritiek");
    expect(uitkomst.reden).toContain("voor niets klaar");
  });

  it("is hoog als de nieuwe datum binnen de aanlooptijd valt", () => {
    // 90 dagen vooruit, aanlooptijd 70 → nog geen kritiek, wel handelen.
    const band = bandOp("2026-09-20");
    const uitkomst = bepaalUrgentie(
      { ...basisAfspraak, gecommuniceerdeDatum: d("2026-11-01") },
      { ...keuken, annuleertermijnDagen: 0 },
      band,
      VANDAAG,
      "indicatief",
    );
    expect(uitkomst.urgentie).toBe("hoog");
  });

  it("zet een bij_aanzegging-partij op wacht zolang de datum niet vaststaat", () => {
    const band = bandOp("2027-01-15");
    const uitkomst = bepaalUrgentie(
      {
        ...basisAfspraak,
        betrokkeneId: "b-bus",
        gecommuniceerdeDatum: d("2026-12-01"),
      },
      bus,
      band,
      VANDAAG,
      "indicatief",
    );
    expect(uitkomst.urgentie).toBe("wacht");
  });

  it("haalt diezelfde partij van wacht af zodra de datum is aangezegd", () => {
    const band = bandOp("2027-01-15");
    const uitkomst = bepaalUrgentie(
      {
        ...basisAfspraak,
        betrokkeneId: "b-bus",
        gecommuniceerdeDatum: d("2026-12-01"),
      },
      bus,
      band,
      VANDAAG,
      "aangezegd",
    );
    expect(uitkomst.urgentie).toBe("normaal");
  });

  it("laat kritiek zwaarder wegen dan de bij_aanzegging-rem", () => {
    // Een bus die je morgen niet meer gratis kunt annuleren, moet je bellen —
    // ook al is de opleverdatum nog niet aangezegd.
    const band = bandOp("2026-08-01");
    const uitkomst = bepaalUrgentie(
      {
        ...basisAfspraak,
        betrokkeneId: "b-bus",
        gecommuniceerdeDatum: d("2026-08-10"),
      },
      bus,
      band,
      VANDAAG,
      "indicatief",
    );
    expect(uitkomst.urgentie).toBe("kritiek");
  });

  it("laat een handmatige partij met rust", () => {
    const band = bandOp("2026-08-05");
    const uitkomst = bepaalUrgentie(
      { ...basisAfspraak, gecommuniceerdeDatum: d("2026-12-01") },
      { ...keuken, communicatieregel: "handmatig" },
      band,
      VANDAAG,
      "indicatief",
    );
    expect(uitkomst.urgentie).toBe("geen");
  });

  it("negeert afgeronde en vervallen afspraken", () => {
    const band = bandOp("2026-08-05");
    for (const status of ["afgerond", "vervallen"] as const) {
      const uitkomst = bepaalUrgentie(
        { ...basisAfspraak, status, gecommuniceerdeDatum: d("2026-12-01") },
        keuken,
        band,
        VANDAAG,
        "indicatief",
      );
      expect(uitkomst.urgentie).toBe("geen");
    }
  });

  it("ziet een nog niet doorgegeven afspraak als openstaand werk", () => {
    const band = bandOp("2027-06-01");
    const uitkomst = bepaalUrgentie(basisAfspraak, keuken, band, VANDAAG, "indicatief");
    expect(uitkomst.urgentie).toBe("normaal");
    expect(uitkomst.reden).toContain("nog niet doorgegeven");
  });
});

// ── Actielijst ─────────────────────────────────────────────────────────────

describe("bouwActielijst", () => {
  const context: PlanningContext = {
    ankers: [],
    opleverband: { status: "indicatief", verwacht: d("2026-09-15") },
  };

  const betrokkenen: BetrokkeneInvoer[] = [keuken, bus];

  it("laat afspraken weg die al kloppen", () => {
    const afspraken: AfspraakInvoer[] = [
      {
        ...basisAfspraak,
        gecommuniceerdeDatum: d("2026-09-22"), // oplevering +7, klopt precies
      },
    ];
    expect(bouwActielijst(afspraken, betrokkenen, context, VANDAAG)).toHaveLength(0);
  });

  it("sorteert op wat er kapotgaat, niet op datum", () => {
    const afspraken: AfspraakInvoer[] = [
      {
        id: "af-ver-weg",
        betrokkeneId: "b-bus",
        omschrijving: "Bus ophalen",
        ankerType: "oplevering",
        offsetDagen: 400, // ver in de toekomst → wacht
        status: "voorlopig",
        gecommuniceerdeDatum: d("2027-01-01"),
      },
      {
        id: "af-kritiek",
        betrokkeneId: "b-keuken",
        omschrijving: "Levering en montage",
        ankerType: "oplevering",
        offsetDagen: 7,
        status: "voorlopig",
        gecommuniceerdeDatum: d("2026-10-05"),
      },
    ];
    const lijst = bouwActielijst(afspraken, betrokkenen, context, VANDAAG);
    expect(lijst.map((r) => r.afspraakId)).toEqual(["af-kritiek", "af-ver-weg"]);
    expect(lijst[0]?.urgentie).toBe("kritiek");
  });

  it("berekent het verschil met wat de partij denkt te weten", () => {
    const afspraken: AfspraakInvoer[] = [
      { ...basisAfspraak, gecommuniceerdeDatum: d("2026-09-15") },
    ];
    const lijst = bouwActielijst(afspraken, betrokkenen, context, VANDAAG);
    expect(lijst[0]?.verschilDagen).toBe(7);
  });

  it("geeft de laatste gratis schuifdatum mee", () => {
    const afspraken: AfspraakInvoer[] = [
      { ...basisAfspraak, gecommuniceerdeDatum: d("2026-10-05") },
    ];
    const lijst = bouwActielijst(afspraken, betrokkenen, context, VANDAAG);
    expect(lijst[0]?.laatsteGratisSchuifdatum).toEqual(d("2026-09-01"));
  });

  it("laat de laatste gratis schuifdatum weg als er niets te annuleren valt", () => {
    const notaris: BetrokkeneInvoer = {
      id: "b-notaris",
      naam: "Notaris",
      aanlooptijdDagen: 21,
      annuleertermijnDagen: 0,
      communicatieregel: "direct",
    };
    const afspraken: AfspraakInvoer[] = [
      {
        id: "af-notaris",
        betrokkeneId: "b-notaris",
        omschrijving: "Transportakte grond",
        ankerType: "oplevering",
        offsetDagen: 7,
        status: "voorlopig",
        gecommuniceerdeDatum: d("2026-10-05"),
      },
    ];
    const lijst = bouwActielijst(afspraken, [notaris], context, VANDAAG);
    expect(lijst[0]?.laatsteGratisSchuifdatum).toBeUndefined();
  });

  it("neemt de waarschuwing mee naar de actielijst", () => {
    const afspraken: AfspraakInvoer[] = [
      {
        ...basisAfspraak,
        gecommuniceerdeDatum: d("2026-10-05"),
        waarschuwing: "Let op de droogtijd van de dekvloer.",
      },
    ];
    const lijst = bouwActielijst(afspraken, betrokkenen, context, VANDAAG);
    expect(lijst[0]?.waarschuwing).toContain("droogtijd");
  });

  it("slaat een afspraak over waarvan de betrokkene ontbreekt", () => {
    const afspraken: AfspraakInvoer[] = [{ ...basisAfspraak, betrokkeneId: "bestaat-niet" }];
    expect(bouwActielijst(afspraken, betrokkenen, context, VANDAAG)).toHaveLength(0);
  });

  it("geeft een lege lijst als er nog geen enkele datum bekend is", () => {
    const afspraken: AfspraakInvoer[] = [{ ...basisAfspraak }];
    expect(bouwActielijst(afspraken, betrokkenen, { ankers: [] }, VANDAAG)).toHaveLength(0);
  });

  it("markeert regels die op een teruggevallen berekening rusten", () => {
    // Gebruiker #1: alleen een opleverdatum, maar wel een vloerenlegger die aan
    // de dekvloer hangt. De regel mag verschijnen, maar niet doen alsof de
    // datum hard is.
    const legger: BetrokkeneInvoer = {
      id: "b-vloer",
      naam: "Vloerenlegger",
      aanlooptijdDagen: 21,
      annuleertermijnDagen: 14,
      communicatieregel: "direct",
    };
    const afspraken: AfspraakInvoer[] = [
      {
        id: "af-vloer",
        betrokkeneId: "b-vloer",
        omschrijving: "Vloer leggen",
        ankerType: "dekvloer_gestort",
        offsetDagen: 42,
        status: "concept",
      },
    ];
    const lijst = bouwActielijst(afspraken, [legger], context, VANDAAG);
    expect(lijst).toHaveLength(1);
    expect(lijst[0]?.berekend.zekerheid).toBe("teruggevallen");
    expect(lijst[0]?.berekend.gevraagdAnker).toBe("dekvloer_gestort");
  });
});
