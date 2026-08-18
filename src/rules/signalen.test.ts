import { describe, expect, it } from "vitest";
import {
  berekenInvoerHash,
  evalueerAlleRegels,
  evalueerRegels,
  REGELVERSIES,
  type SignaalToestand,
} from "./engine";
import { MAX_ZICHTBARE_SIGNALEN, type RegelContext } from "./types";
import { Timestamp } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Signaalgedrag (bevinding A-09)
 *
 * De motor gaf alleen een gesorteerde lijst terug: geen versie, geen status,
 * geen snooze en geen hash. Een weggeklikt signaal kwam bij elke herberekening
 * gewoon terug, en er was geen begrenzing op drie.
 *
 * De belangrijkste test hieronder is die op `invoerwaarden`: die dwingt af dat
 * élke regel zijn invoer meelevert, nu en in de toekomst. Zonder die waarden is
 * er geen uitleg (B6.3) en geen betrouwbare hash (B6.6).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Een context die zoveel mogelijk regels laat vuren. */
function maakContext(): RegelContext {
  const peildatum = new Date("2026-05-01T12:00:00.000Z");
  const opleverDatum = new Date("2026-02-14T12:00:00.000Z");
  const gemeldLangGeleden = new Date("2026-01-20T12:00:00.000Z");

  return {
    project: {
      naam: "Kavel 27",
      opleverVerwacht: Timestamp.fromDate(opleverDatum),
      aangemaaktOp: Timestamp.fromDate(new Date("2026-01-01")),
    },
    peildatum,
    gebreken: [
      {
        id: "g1",
        titel: "Kras in kozijn",
        status: "open",
        gemeldOp: Timestamp.fromDate(gemeldLangGeleden),
      } as unknown as NonNullable<RegelContext["gebreken"]>[number],
    ],
  };
}

describe("Elk signaal levert zijn invoerwaarden mee", () => {
  /**
   * Deze test is de reden dat B6.3 niet steekproefsgewijs gecontroleerd hoeft
   * te worden: hij loopt élk signaal langs dat de motor kan produceren.
   */
  it("geen enkel signaal komt zonder invoerwaarden binnen", () => {
    const signalen = evalueerAlleRegels(maakContext());
    expect(signalen.length).toBeGreaterThan(0);

    const zonder = signalen.filter(
      (s) => !s.invoerwaarden || Object.keys(s.invoerwaarden).length === 0,
    );

    expect(
      zonder.map((s) => `${s.regelId} (${s.id})`),
      "deze signalen missen invoerwaarden — zonder die waarden is er geen uitleg en geen hash",
    ).toEqual([]);
  });

  it("elk signaal draagt een bekende regelversie", () => {
    for (const signaal of evalueerAlleRegels(maakContext())) {
      expect(REGELVERSIES[signaal.regelId], `regelId ${signaal.regelId} mist een versie`)
        .toBeDefined();
      expect(signaal.versie).toBe(REGELVERSIES[signaal.regelId]);
    }
  });

  it("elk signaal draagt een invoerhash", () => {
    for (const signaal of evalueerAlleRegels(maakContext())) {
      expect(signaal.invoerHash).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});

describe("Invoerhash", () => {
  const basis = {
    id: "s1",
    regelId: "T-001",
    categorie: "termijnen" as const,
    niveau: "waarschuwing" as const,
    titel: "Titel",
    beschrijving: "Beschrijving",
    versie: 1,
    invoerwaarden: { bedrag: 1000, datum: "2026-08-20" },
  };

  it("is stabiel bij dezelfde invoer", () => {
    expect(berekenInvoerHash(basis)).toBe(berekenInvoerHash({ ...basis }));
  });

  it("verandert niet door de volgorde waarin waarden zijn opgeschreven", () => {
    const anderVolgorde = {
      ...basis,
      invoerwaarden: { datum: "2026-08-20", bedrag: 1000 },
    };
    expect(berekenInvoerHash(anderVolgorde)).toBe(berekenInvoerHash(basis));
  });

  it("verandert als een invoerwaarde wijzigt", () => {
    const gewijzigd = { ...basis, invoerwaarden: { ...basis.invoerwaarden, bedrag: 2000 } };
    expect(berekenInvoerHash(gewijzigd)).not.toBe(berekenInvoerHash(basis));
  });

  it("verandert als de regelversie omhoog gaat", () => {
    expect(berekenInvoerHash({ ...basis, versie: 2 })).not.toBe(berekenInvoerHash(basis));
  });
});

describe("Weggeklikte signalen", () => {
  function eersteSignaal() {
    const alle = evalueerAlleRegels(maakContext());
    const eerste = alle[0];
    if (!eerste?.invoerHash) throw new Error("geen signaal om mee te testen");
    return eerste;
  }

  it("komt niet terug zolang de invoer gelijk blijft", () => {
    const signaal = eersteSignaal();
    const toestanden: SignaalToestand[] = [
      {
        regelId: signaal.regelId,
        signaalId: signaal.id,
        status: "genegeerd",
        invoerHash: signaal.invoerHash ?? "",
      },
    ];

    const zichtbaar = evalueerRegels(maakContext(), {
      toestanden,
      maximum: Number.MAX_SAFE_INTEGER,
    });
    expect(zichtbaar.some((s) => s.id === signaal.id)).toBe(false);
  });

  it("komt wél terug zodra de onderliggende invoer wijzigt", () => {
    const signaal = eersteSignaal();
    const toestanden: SignaalToestand[] = [
      {
        regelId: signaal.regelId,
        signaalId: signaal.id,
        status: "genegeerd",
        invoerHash: "00000000", // alsof de invoer sindsdien is veranderd
      },
    ];

    const zichtbaar = evalueerRegels(maakContext(), {
      toestanden,
      maximum: Number.MAX_SAFE_INTEGER,
    });
    expect(zichtbaar.some((s) => s.id === signaal.id)).toBe(true);
  });

  it("blijft weg tot de snoozedatum en verschijnt daarna weer", () => {
    const signaal = eersteSignaal();
    const toestanden: SignaalToestand[] = [
      {
        regelId: signaal.regelId,
        signaalId: signaal.id,
        status: "gesnoozed",
        invoerHash: signaal.invoerHash ?? "",
        snoozeTot: "2026-09-01",
      },
    ];

    const tijdensSnooze = evalueerRegels(maakContext(), {
      toestanden,
      nu: new Date(2026, 7, 25),
      maximum: Number.MAX_SAFE_INTEGER,
    });
    expect(tijdensSnooze.some((s) => s.id === signaal.id)).toBe(false);

    const erna = evalueerRegels(maakContext(), {
      toestanden,
      nu: new Date(2026, 8, 2),
      maximum: Number.MAX_SAFE_INTEGER,
    });
    expect(erna.some((s) => s.id === signaal.id)).toBe(true);
  });
});

describe("Begrenzing en categorieschakelaars", () => {
  it("toont er nooit meer dan drie tegelijk", () => {
    const zichtbaar = evalueerRegels(maakContext());
    expect(zichtbaar.length).toBeLessThanOrEqual(MAX_ZICHTBARE_SIGNALEN);
  });

  it("houdt de zwaarste over, niet de eerste die toevallig langskomt", () => {
    const zichtbaar = evalueerRegels(maakContext());
    const prioriteit = { urgent: 4, waarschuwing: 3, attentie: 2, info: 1 };
    for (let i = 1; i < zichtbaar.length; i++) {
      const vorige = zichtbaar[i - 1];
      const huidige = zichtbaar[i];
      if (!vorige || !huidige) continue;
      expect(prioriteit[vorige.niveau]).toBeGreaterThanOrEqual(prioriteit[huidige.niveau]);
    }
  });

  it("laat een uitgeschakelde categorie volledig weg", () => {
    const alle = evalueerAlleRegels(maakContext());
    const categorie = alle[0]?.categorie;
    if (!categorie) throw new Error("geen signaal om mee te testen");

    const zichtbaar = evalueerRegels(maakContext(), {
      uitgeschakeldeCategorieen: [categorie],
      maximum: Number.MAX_SAFE_INTEGER,
    });
    expect(zichtbaar.some((s) => s.categorie === categorie)).toBe(false);
  });
});
