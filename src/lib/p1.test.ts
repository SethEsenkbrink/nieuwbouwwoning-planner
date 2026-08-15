import { describe, expect, it } from "vitest";
import { parseP1Csv } from "./p1";

describe("P1 Smart Meter CSV Parser", () => {
  it("parst een standaard puntkomma-gescheiden DSMR export", () => {
    const csv = `Datum;1.8.1;1.8.2;2.8.1;2.8.2;Gas
2026-05-01 00:00:00;1250,500;1400,200;300,100;150,000;850,123
2026-05-02 00:00:00;1255,200;1408,600;310,400;155,200;852,450`;

    const result = parseP1Csv(csv);
    expect(result.foutmeldingen).toHaveLength(0);
    expect(result.succesvolleRijen).toBe(2);
    expect(result.gevondenMeters).toContain("stroom_dal");
    expect(result.gevondenMeters).toContain("stroom_normaal");
    expect(result.gevondenMeters).toContain("teruglevering_dal");
    expect(result.gevondenMeters).toContain("teruglevering_normaal");
    expect(result.gevondenMeters).toContain("gas");

    expect(result.rijen[0]?.standen.stroom_dal).toBe(1250.5);
    expect(result.rijen[0]?.standen.gas).toBe(850.123);
  });

  it("parst komma-gescheiden Home Assistant sensor statistics CSV", () => {
    const csv = `timestamp,electricity_delivered_low,electricity_delivered_high,gas_delivered
2026-06-01T12:00:00Z,2000.10,3500.50,1200.00
2026-06-02T12:00:00Z,2005.30,3510.80,1201.20`;

    const result = parseP1Csv(csv);
    expect(result.foutmeldingen).toHaveLength(0);
    expect(result.succesvolleRijen).toBe(2);
    expect(result.rijen[1]?.standen.stroom_normaal).toBe(3510.8);
  });

  it("geeft foutmelding bij ontbrekende datumkolom of ongeldig bestand", () => {
    const csv = `levering;teruglevering
100;20`;

    const result = parseP1Csv(csv);
    expect(result.foutmeldingen.length).toBeGreaterThan(0);
    expect(result.succesvolleRijen).toBe(0);
  });
});
