import type { Metersoort } from "@/types/model";

export interface P1Rij {
  datum: Date;
  standen: Partial<Record<Metersoort, number>>;
}

export interface P1ImportResultaat {
  totaalRijen: number;
  succesvolleRijen: number;
  eersteDatum?: Date;
  laatsteDatum?: Date;
  gevondenMeters: Metersoort[];
  rijen: P1Rij[];
  foutmeldingen: string[];
}

function parseDatumString(tekst: string): Date | null {
  const opgeschoond = tekst.trim().replace(/^["']|["']$/g, "");
  if (!opgeschoond) return null;

  // 1. ISO datum (bijv. 2026-05-12T14:30:00 of 2026-05-12 14:30:00)
  const dIso = new Date(opgeschoond.replace(" ", "T"));
  if (!isNaN(dIso.getTime())) return dIso;

  // 2. NL datum: DD-MM-YYYY of DD/MM/YYYY
  const matchNL = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/.exec(opgeschoond);
  if (matchNL) {
    const dag = parseInt(matchNL[1]!, 10);
    const maand = parseInt(matchNL[2]!, 10) - 1;
    const jaar = parseInt(matchNL[3]!, 10);
    const uur = matchNL[4] ? parseInt(matchNL[4], 10) : 0;
    const min = matchNL[5] ? parseInt(matchNL[5], 10) : 0;
    const sec = matchNL[6] ? parseInt(matchNL[6], 10) : 0;
    const d = new Date(Date.UTC(jaar, maand, dag, uur, min, sec));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function parseGetal(tekst: string): number | null {
  const opgeschoond = tekst
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  if (!/^-?\d+(\.\d+)?$/.test(opgeschoond)) return null;
  const num = Number(opgeschoond);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/**
 * Splitst een CSV regel rekening houdend met quotes en scheidingstekens (, ; \t)
 */
function splitCsvRegel(regel: string, scheidingsteken: string): string[] {
  const result: string[] = [];
  let huidig = "";
  let inQuotes = false;

  for (const char of regel) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === scheidingsteken && !inQuotes) {
      result.push(huidig.trim());
      huidig = "";
    } else {
      huidig += char;
    }
  }
  result.push(huidig.trim());
  return result;
}

/**
 * Detecteert de metersoort op basis van een kolomnaam (OBIS code of standaard benaming).
 */
function mapKolomNaarMetersoort(kolomHeader: string): Metersoort | null {
  const h = kolomHeader.toLowerCase().trim().replace(/[^a-z0-9._-]/g, "");

  if (
    h.includes("1.8.1") ||
    h.includes("stroom_dal") ||
    h.includes("levering_dal") ||
    h.includes("delivered_low") ||
    h.includes("low_tariff") ||
    h.includes("tariff_1") ||
    h.includes("stroom_laag") ||
    h.includes("dal_levering")
  ) {
    return "stroom_dal";
  }
  if (
    h.includes("1.8.2") ||
    h.includes("stroom_normaal") ||
    h.includes("levering_normaal") ||
    h.includes("delivered_high") ||
    h.includes("high_tariff") ||
    h.includes("tariff_2") ||
    h.includes("stroom_hoog") ||
    h.includes("piek_levering")
  ) {
    return "stroom_normaal";
  }
  if (
    h.includes("2.8.1") ||
    h.includes("teruglevering_dal") ||
    h.includes("returned_low") ||
    h.includes("export_low") ||
    h.includes("terug_dal") ||
    h.includes("export_dal")
  ) {
    return "teruglevering_dal";
  }
  if (
    h.includes("2.8.2") ||
    h.includes("teruglevering_normaal") ||
    h.includes("returned_high") ||
    h.includes("export_high") ||
    h.includes("terug_normaal") ||
    h.includes("export_normaal")
  ) {
    return "teruglevering_normaal";
  }
  if (
    h.includes("1.8.0") ||
    h.includes("stroom_enkel") ||
    h.includes("stroom_totaal") ||
    h.includes("elektra_totaal") ||
    h.includes("delivered_total") ||
    h === "stroom"
  ) {
    return "stroom_enkel";
  }
  if (
    h.includes("2.8.0") ||
    h.includes("teruglevering_enkel") ||
    h.includes("teruglevering_totaal") ||
    h.includes("returned_total") ||
    h.includes("teruglevering")
  ) {
    return "teruglevering_enkel";
  }
  if (h.includes("24.2.1") || h.includes("gas") || h.includes("gasverbruik") || h.includes("gas_delivered")) {
    return "gas";
  }
  if (h.includes("water") || h.includes("drinkwater")) {
    return "water";
  }
  if (h.includes("warmte") || h.includes("stadswarmte")) {
    return "warmte";
  }

  return null;
}

/**
 * Parsed een P1 export CSV bestand (lokaal in de browser, 0 netwerk).
 */
export function parseP1Csv(csvInhoud: string): P1ImportResultaat {
  const regels = csvInhoud.split(/\r?\n/).filter((r) => r.trim().length > 0);
  const resultaat: P1ImportResultaat = {
    totaalRijen: 0,
    succesvolleRijen: 0,
    gevondenMeters: [],
    rijen: [],
    foutmeldingen: [],
  };

  if (regels.length < 2) {
    resultaat.foutmeldingen.push("Het CSV-bestand bevat te weinig regels.");
    return resultaat;
  }

  // 1. Detecteer scheidingsteken uit de eerste regel
  const headerRegel = regels[0]!;
  const delimiters = [";", ",", "\t"];
  let gekozenDelimiter = ";";
  let maxKolommen = 0;

  for (const d of delimiters) {
    const k = headerRegel.split(d).length;
    if (k > maxKolommen) {
      maxKolommen = k;
      gekozenDelimiter = d;
    }
  }

  const headers = splitCsvRegel(headerRegel, gekozenDelimiter);
  let datumKolomIndex = -1;
  const kolomMapping = new Map<number, Metersoort>();

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]!.toLowerCase().trim();
    if (
      datumKolomIndex === -1 &&
      (h.includes("datum") || h.includes("date") || h.includes("time") || h.includes("timestamp") || h.includes("opgenomen"))
    ) {
      datumKolomIndex = i;
    } else {
      const soort = mapKolomNaarMetersoort(headers[i]!);
      if (soort) {
        kolomMapping.set(i, soort);
        if (!resultaat.gevondenMeters.includes(soort)) {
          resultaat.gevondenMeters.push(soort);
        }
      }
    }
  }

  if (datumKolomIndex === -1) {
    resultaat.foutmeldingen.push("Geen datum- of tijdskolom herkend in het CSV-bestand.");
    return resultaat;
  }

  if (kolomMapping.size === 0) {
    resultaat.foutmeldingen.push("Geen geldige meterstandkolommen herkend (bijv. 1.8.1, 1.8.2, 2.8.1, 2.8.2, gas).");
    return resultaat;
  }

  // 2. Parse gegevensrijen
  for (let r = 1; r < regels.length; r++) {
    resultaat.totaalRijen++;
    const velden = splitCsvRegel(regels[r]!, gekozenDelimiter);
    if (velden.length <= datumKolomIndex) continue;

    const datum = parseDatumString(velden[datumKolomIndex]!);
    if (!datum) continue;

    const standen: Partial<Record<Metersoort, number>> = {};
    let heeftStanden = false;

    for (const [index, soort] of kolomMapping.entries()) {
      if (index < velden.length) {
        const getal = parseGetal(velden[index]!);
        if (getal !== null) {
          standen[soort] = getal;
          heeftStanden = true;
        }
      }
    }

    if (heeftStanden) {
      resultaat.rijen.push({ datum, standen });
      resultaat.succesvolleRijen++;

      if (!resultaat.eersteDatum || datum < resultaat.eersteDatum) {
        resultaat.eersteDatum = datum;
      }
      if (!resultaat.laatsteDatum || datum > resultaat.laatsteDatum) {
        resultaat.laatsteDatum = datum;
      }
    }
  }

  // Sorteer chronologisch
  resultaat.rijen.sort((a, b) => a.datum.getTime() - b.datum.getTime());

  return resultaat;
}
