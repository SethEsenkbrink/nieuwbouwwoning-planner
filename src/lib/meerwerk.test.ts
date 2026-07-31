import { describe, expect, it } from "vitest";
import {
  beoordeelMeerwerk,
  sorteerMeerwerk,
  telMeerwerk,
  telZonderBedrag,
} from "@/lib/meerwerk";
import type { MeerwerkMetId } from "@/lib/converters";
import type { PlanningContext } from "@/lib/planning";

/**
 * De kern van ADR-0011: een vaste sluitingsdatum schuift NIET mee met de bouw,
 * een bouwmoment-deadline wél. Haal je die twee door elkaar, dan word je te
 * laat gewaarschuwd over de duurste beslissingen in het hele traject.
 */

const dag = (tekst: string) => new Date(`${tekst}T00:00:00.000Z`);
const VANDAAG = dag("2026-08-01");

const context: PlanningContext = {
  ankers: [{ type: "dekvloer_gestort", status: "verwacht", verwachtOp: dag("2026-09-15") }],
  opleverband: { status: "indicatief", verwacht: dag("2026-11-16") },
};

const item = (extra: Partial<MeerwerkMetId> = {}): MeerwerkMetId => ({
  id: "m1",
  omschrijving: "Extra wandcontactdozen",
  status: "overweeg",
  sluiting: "onbekend",
  ...extra,
});

describe("beoordeelMeerwerk — vaste datum", () => {
  it("gebruikt de opgeslagen datum en rekent er niets aan", () => {
    const beoordeling = beoordeelMeerwerk(
      item({ sluiting: "vaste_datum", sluitingsdatum: dag("2026-08-15") }),
      context,
      VANDAAG,
    );
    expect(beoordeling.sluitOp).toEqual(dag("2026-08-15"));
    expect(beoordeling.berekend).toBeUndefined();
    expect(beoordeling.dagenTotSluiting).toBe(14);
  });

  it("negeert een ankerveld dat is blijven staan", () => {
    // Precies waarom `sluiting` een expliciet veld is (ADR-0011): een
    // achtergebleven ankerveld mag het gedrag niet bepalen.
    const beoordeling = beoordeelMeerwerk(
      item({
        sluiting: "vaste_datum",
        sluitingsdatum: dag("2026-08-15"),
        sluitingAnkerType: "dekvloer_gestort",
        sluitingOffsetDagen: -14,
      }),
      context,
      VANDAAG,
    );
    expect(beoordeling.sluitOp).toEqual(dag("2026-08-15"));
  });

  it("meldt een gepasseerde datum als gesloten", () => {
    const beoordeling = beoordeelMeerwerk(
      item({ sluiting: "vaste_datum", sluitingsdatum: dag("2026-07-01") }),
      context,
      VANDAAG,
    );
    expect(beoordeling.stand).toBe("gesloten");
    expect(beoordeling.dagenTotSluiting).toBe(-31);
  });

  it("waarschuwt drie weken van tevoren, niet eerder", () => {
    const binnen = beoordeelMeerwerk(
      item({ sluiting: "vaste_datum", sluitingsdatum: dag("2026-08-22") }),
      context,
      VANDAAG,
    );
    const buiten = beoordeelMeerwerk(
      item({ sluiting: "vaste_datum", sluitingsdatum: dag("2026-08-23") }),
      context,
      VANDAAG,
    );
    expect(binnen.stand).toBe("sluit_binnenkort");
    expect(buiten.stand).toBe("open");
  });

  it("valt terug op onbekend als de datum ontbreekt", () => {
    expect(beoordeelMeerwerk(item({ sluiting: "vaste_datum" }), context, VANDAAG).stand).toBe(
      "onbekend",
    );
  });
});

describe("beoordeelMeerwerk — bouwmoment", () => {
  it("leidt de datum af van het anker plus de offset", () => {
    const beoordeling = beoordeelMeerwerk(
      item({
        sluiting: "bouwmoment",
        sluitingAnkerType: "dekvloer_gestort",
        sluitingOffsetDagen: -14,
      }),
      context,
      VANDAAG,
    );
    expect(beoordeling.sluitOp).toEqual(dag("2026-09-01"));
    expect(beoordeling.berekend?.zekerheid).toBe("anker_verwacht");
  });

  it("schuift mee als het bouwmoment schuift", () => {
    // Dit is het verschil met een vaste datum, in één test.
    const geschoven: PlanningContext = {
      ...context,
      ankers: [{ type: "dekvloer_gestort", status: "verwacht", verwachtOp: dag("2026-10-15") }],
    };
    const item2 = item({
      sluiting: "bouwmoment",
      sluitingAnkerType: "dekvloer_gestort",
      sluitingOffsetDagen: -14,
    });

    expect(beoordeelMeerwerk(item2, context, VANDAAG).sluitOp).toEqual(dag("2026-09-01"));
    expect(beoordeelMeerwerk(item2, geschoven, VANDAAG).sluitOp).toEqual(dag("2026-10-01"));
  });

  it("meldt het als er is teruggevallen op de oplevering", () => {
    const beoordeling = beoordeelMeerwerk(
      item({ sluiting: "bouwmoment", sluitingAnkerType: "wind_waterdicht", sluitingOffsetDagen: 0 }),
      context,
      VANDAAG,
    );
    expect(beoordeling.berekend?.zekerheid).toBe("teruggevallen");
  });

  it("gebruikt offset nul als die ontbreekt", () => {
    const beoordeling = beoordeelMeerwerk(
      item({ sluiting: "bouwmoment", sluitingAnkerType: "dekvloer_gestort" }),
      context,
      VANDAAG,
    );
    expect(beoordeling.sluitOp).toEqual(dag("2026-09-15"));
  });
});

describe("sorteerMeerwerk", () => {
  it("zet wat binnenkort sluit bovenaan en wat dicht is onderaan", () => {
    const beoordelingen = [
      item({ id: "dicht", sluiting: "vaste_datum", sluitingsdatum: dag("2026-07-01") }),
      item({ id: "onbekend" }),
      item({ id: "open", sluiting: "vaste_datum", sluitingsdatum: dag("2026-12-01") }),
      item({ id: "bijna", sluiting: "vaste_datum", sluitingsdatum: dag("2026-08-10") }),
    ].map((i) => beoordeelMeerwerk(i, context, VANDAAG));

    expect(sorteerMeerwerk(beoordelingen).map((b) => b.item.id)).toEqual([
      "bijna",
      "open",
      "onbekend",
      "dicht",
    ]);
  });
});

describe("telMeerwerk", () => {
  it("splitst overwogen, besteld en bevestigd", () => {
    const items = [
      item({ id: "1", status: "overweeg", bedrag: 1000 }),
      item({ id: "2", status: "besteld", bedrag: 2500 }),
      item({ id: "3", status: "bevestigd", bedrag: 4000 }),
    ];
    const stand = telMeerwerk(items, 10000);

    expect(stand.overwogen).toBe(1000);
    expect(stand.besteld).toBe(2500);
    expect(stand.bevestigd).toBe(4000);
    expect(stand.vastgelegd).toBe(6500);
    expect(stand.maximaal).toBe(7500);
    expect(stand.ruimte).toBe(3500);
  });

  it("rekent ruimte op vastgelegd, niet op maximaal", () => {
    // Wat je overweegt heb je nog niet uitgegeven. Dat meetellen zou de app
    // laten waarschuwen over geld dat je misschien nooit uitgeeft.
    const items = [item({ id: "1", status: "overweeg", bedrag: 9000 })];
    expect(telMeerwerk(items, 5000).ruimte).toBe(5000);
  });

  it("geeft een negatieve ruimte bij overschrijding", () => {
    const items = [item({ id: "1", status: "bevestigd", bedrag: 12000 })];
    expect(telMeerwerk(items, 10000).ruimte).toBe(-2000);
  });

  it("laat budget en ruimte weg als er geen budget is", () => {
    const stand = telMeerwerk([item({ bedrag: 100, status: "besteld" })], undefined);
    expect(stand.budget).toBeUndefined();
    expect(stand.ruimte).toBeUndefined();
    expect(stand.vastgelegd).toBe(100);
  });

  it("telt een item zonder bedrag als nul", () => {
    expect(telMeerwerk([item({ status: "besteld" })], 1000).vastgelegd).toBe(0);
  });
});

describe("telZonderBedrag", () => {
  it("telt de items waarvan de prijs nog niet bekend is", () => {
    expect(telZonderBedrag([item({ id: "1" }), item({ id: "2", bedrag: 500 })])).toBe(1);
  });
});
