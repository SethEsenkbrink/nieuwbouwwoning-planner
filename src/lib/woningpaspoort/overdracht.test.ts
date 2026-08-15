import { describe, expect, it } from "vitest";
import { Timestamp, type ProjectDoc, type OnderdeelDoc, type GarantieDoc, type MateriaalDoc, type OnderhoudLogregelDoc, type OnderhoudTaakDoc } from "@/types/model";
import { genereerWoningpaspoortHtml, stelOverdrachtsdossierSamen } from "./overdracht";

describe("Woningpaspoort Overdrachtsdossier", () => {
  it("stelt een overdrachtsdossier samen en filtert uitsluitend achterblijvende onderdelen", () => {
    const project: ProjectDoc = {
      id: "p1",
      naam: "Eikenlaan 4",
      traject: "nieuwbouw",
      aangemaaktOp: Timestamp.fromDate(new Date("2024-01-01")),
      woningpaspoort: {
        bouwjaar: 2024,
        woonoppervlakteM2: 145,
        energielabel: "A++++",
      },
    };

    const onderdelen: OnderdeelDoc[] = [
      {
        id: "o1",
        naam: "Warmtepomp NIBE",
        categorie: "verwarming",
        montage: "vast_geinstalleerd",
        blijftBijWoning: true,
        serienummer: "NB-88990",
      },
      {
        id: "o2",
        naam: "Verplaatsbare Mobiele Airco",
        categorie: "ventilatie",
        montage: "plug_and_play",
        blijftBijWoning: false,
      },
    ];

    const garanties: GarantieDoc[] = [
      {
        id: "g1",
        titel: "Woningborg Garantiecertificaat",
        type: "waarborgcertificaat",
        ingangsdatum: Timestamp.fromDate(new Date("2024-06-01")),
        looptijdJaren: 10,
      },
    ];

    const materialen: MateriaalDoc[] = [
      {
        id: "m1",
        naam: "Wandverf Woonkamer",
        categorie: "verf",
        kleurcode: "RAL 9010",
        glansgraad: "Extra Mat",
      },
    ];

    const taken: OnderhoudTaakDoc[] = [
      {
        id: "t1",
        titel: "Filters WTW vervangen",
        intervalDagen: 180,
        waardenBron: "eigen",
      },
    ];

    const log: OnderhoudLogregelDoc[] = [
      {
        id: "l1",
        taakId: "t1",
        uitgevoerdOp: Timestamp.fromDate(new Date("2025-06-01")),
        doorWie: "Installateur Jansen",
        notitie: "Groot onderhoud uitgevoerd",
      },
    ];

    const dossier = stelOverdrachtsdossierSamen(project, onderdelen, garanties, materialen, taken, log);
    expect(dossier.project.naam).toBe("Eikenlaan 4");
    expect(dossier.achterblijvendeOnderdelen).toHaveLength(1);
    expect(dossier.achterblijvendeOnderdelen[0]?.naam).toBe("Warmtepomp NIBE");
    expect(dossier.garanties).toHaveLength(1);
    expect(dossier.materialen).toHaveLength(1);
    expect(dossier.onderhoudsHistorie).toHaveLength(1);

    const html = genereerWoningpaspoortHtml(dossier);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Warmtepomp NIBE");
    expect(html).toContain("NB-88990");
    expect(html).toContain("Woningborg Garantiecertificaat");
    expect(html).toContain("RAL 9010");
    expect(html).not.toContain("Verplaatsbare Mobiele Airco");
  });
});
