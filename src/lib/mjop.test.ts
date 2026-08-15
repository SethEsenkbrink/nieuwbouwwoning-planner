import { describe, expect, it } from "vitest";
import { Timestamp, type OnderhoudTaakDoc } from "@/types/model";
import { berekenMjopKostenOverzicht } from "./mjop";

describe("MJOP-light kostenraming", () => {
  it("berekent 10-jaars raming voor jaarlijks en 5-jaarlijks onderhoud", () => {
    const taken: OnderhoudTaakDoc[] = [
      {
        id: "taak-1",
        titel: "WTW-filters vervangen",
        intervalDagen: 365,
        waardenBron: "gebruiker",
        geschatteKosten: 80,
      } as unknown as OnderhoudTaakDoc,
      {
        id: "taak-2",
        titel: "Buitenschilderwerk kozijnen",
        intervalDagen: 1825, // 5 jaar
        laatstUitgevoerdOp: Timestamp.fromDate(new Date("2024-06-01")),
        waardenBron: "gebruiker",
        geschatteKosten: 2500,
      } as unknown as OnderhoudTaakDoc,
    ];

    const raming = berekenMjopKostenOverzicht(taken, 10, 2026);
    expect(raming.length).toBe(10);
    expect(raming[0]?.jaar).toBe(2026);
    expect(raming[0]?.geschatteKosten).toBe(80); // WTW

    // In 2029 (2024 + 5 jaar): Schilderwerk (2500) + WTW (80) = 2580
    const jaar2029 = raming.find((r) => r.jaar === 2029);
    expect(jaar2029?.geschatteKosten).toBe(2580);
    expect(jaar2029?.aantalTaken).toBe(2);
  });
});
