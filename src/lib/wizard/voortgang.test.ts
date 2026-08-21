import { describe, expect, it } from "vitest";
import type { ProjectMetId } from "@/lib/converters";
import { LEGE_DOSSIERSTAND, afgerondeStappen, raadMoment, type Dossierstand } from "./voortgang";

function project(patch: Partial<ProjectMetId> = {}): ProjectMetId {
  return { id: "p1", naam: "Ons huis", aangemaaktOp: new Date("2026-01-05"), ...patch };
}

function stand(patch: Partial<Dossierstand> = {}): Dossierstand {
  return { ...LEGE_DOSSIERSTAND, project: project(), ...patch };
}

describe("raadMoment", () => {
  it("gaat uit van net gekocht als er nog geen project is", () => {
    expect(raadMoment(null)).toBe("net_gekocht");
  });

  it("noemt een leeg project oriëntatie", () => {
    expect(raadMoment(project())).toBe("orientatie");
  });

  it("herkent een getekend contract aan de koopsom of de aannemer", () => {
    expect(raadMoment(project({ koopsom: 385000 }))).toBe("net_gekocht");
    expect(raadMoment(project({ aannemer: "Van der Meer BV" }))).toBe("net_gekocht");
  });

  it("herkent een lopende bouw aan een verwachte opleverdatum", () => {
    expect(raadMoment(project({ opleverVerwacht: new Date("2026-11-01") }))).toBe("in_aanbouw");
  });

  it("kiest bij bestaande bouw een moment dat daar bestaat", () => {
    // in_aanbouw bestaat niet bij bestaande bouw; het raadwerk mag geen
    // moment opleveren dat de wizard niet kan tonen.
    const geraden = raadMoment(
      project({ traject: "bestaandeBouw", opleverVerwacht: new Date("2026-11-01") }),
    );
    expect(geraden).not.toBe("in_aanbouw");
  });

  it("herkent een aangezegde oplevering", () => {
    expect(raadMoment(project({ opleverStatus: "aangezegd" }))).toBe("bijna_oplevering");
  });

  it("laat woningStatus zwaarder wegen dan een opleverdatum", () => {
    // woningStatus zet de gebruiker bewust om (ADR-0010 §1). Dat is een
    // bewering, geen gevolgtrekking uit een datum die kan zijn blijven staan.
    const geraden = raadMoment(
      project({
        woningStatus: "opgeleverd",
        opleverStatus: "aangezegd",
        opschortingStatus: "vrijgegeven",
      }),
    );
    expect(geraden).toBe("in_beheer");
  });

  it("houdt iemand met een lopend depot in de nasleep van de oplevering", () => {
    expect(raadMoment(project({ woningStatus: "opgeleverd", opschortingStatus: "in_depot" }))).toBe(
      "net_opgeleverd",
    );
  });

  it("behandelt een onbekende depotstatus als nog lopend", () => {
    expect(raadMoment(project({ woningStatus: "opgeleverd" }))).toBe("net_opgeleverd");
  });
});

describe("afgerondeStappen", () => {
  it("geeft niets terug zonder project", () => {
    expect(afgerondeStappen({ ...LEGE_DOSSIERSTAND, project: null })).toEqual([]);
  });

  it("rekent start altijd af zodra er een project is", () => {
    expect(afgerondeStappen(stand())).toEqual(["start"]);
  });

  it("telt de woningstap zodra er een adres of bouwnummer is", () => {
    expect(afgerondeStappen(stand({ project: project({ woningpaspoort: { adres: "X" } })}))).toContain(
      "woning",
    );
    expect(afgerondeStappen(stand({ project: project({ bouwnummer: "42" }) }))).toContain("woning");
  });

  it("telt de contractstap bij een aannemer, notaris of polisnummer", () => {
    expect(afgerondeStappen(stand({ project: project({ aannemer: "X" }) }))).toContain("contract");
    expect(
      afgerondeStappen(stand({ project: project({ woningpaspoort: { notaris: "Y" } }) })),
    ).toContain("contract");
  });

  it("telt de financiële stap bij een koopsom of een hypotheek", () => {
    expect(afgerondeStappen(stand({ project: project({ koopsom: 1 }) }))).toContain("financieel");
    expect(
      afgerondeStappen(stand({ project: project({ hypotheek: { bedrag: 1 } }) })),
    ).toContain("financieel");
  });

  it("telt de planningstap bij een opleverdatum of een transportdatum", () => {
    expect(
      afgerondeStappen(stand({ project: project({ opleverVerwacht: new Date("2026-11-01") }) })),
    ).toContain("planning");
    expect(
      afgerondeStappen(
        stand({ project: project({ woningpaspoort: { transportdatum: new Date("2026-09-01") } }) }),
      ),
    ).toContain("planning");
  });

  it("telt de lijststappen op basis van de aantallen", () => {
    const gedaan = afgerondeStappen(
      stand({
        aantalBetrokkenen: 3,
        aantalOnderdelen: 2,
        aantalOnderhoudstaken: 7,
        aantalMeters: 1,
      }),
    );
    expect(gedaan).toContain("betrokkenen");
    expect(gedaan).toContain("onderdelen");
    expect(gedaan).toContain("onderhoud");
    expect(gedaan).toContain("meters");
  });

  it("telt een lijst met nul regels niet mee", () => {
    const gedaan = afgerondeStappen(stand({ aantalBetrokkenen: 0 }));
    expect(gedaan).not.toContain("betrokkenen");
  });

  it("levert nooit een stap dubbel", () => {
    const gedaan = afgerondeStappen(
      stand({
        project: project({
          bouwnummer: "42",
          aannemer: "X",
          koopsom: 1,
          hypotheek: { bedrag: 2 },
          opleverVerwacht: new Date("2026-11-01"),
          woningpaspoort: { adres: "Y", notaris: "Z", transportdatum: new Date("2026-09-01") },
        }),
        aantalBetrokkenen: 1,
      }),
    );
    expect(new Set(gedaan).size).toBe(gedaan.length);
  });
});
