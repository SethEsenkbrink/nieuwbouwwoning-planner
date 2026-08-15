/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Roulerend backupschema
 *
 * Drie reeksen die elkaar aanvullen:
 *   dagelijks-1 t/m -7      één week terug, per dag
 *   wekelijks-1 t/m -4      vier weken terug
 *   maandelijks-1 t/m -12   een jaar terug, per maand
 *
 * Samen 23 bestanden. Dat dekt zowel "ik heb gisteren iets kapotgemaakt" als
 * "ik ontdek pas na acht maanden dat er iets weg is".
 *
 * ── Waarom slots op datum en niet op volgnummer ───────────────────────────
 *
 * Een teller die bij elke backup opschuift lijkt eenvoudiger, maar gaat stuk
 * zodra de app een tijd niet geopend wordt: dan draait de hele dagreeks in één
 * middag rond en overschrijf je zeven keer dezelfde dag. Door het slot uit de
 * dátum af te leiden ligt vast wélk bestand bij welke dag hoort, ongeacht hoe
 * vaak of hoe onregelmatig er een backup draait.
 *
 * ── Zelfherstellend ───────────────────────────────────────────────────────
 *
 * Een slot wordt alleen herschreven als de bestaande inhoud ouder is dan de
 * periode van dat slot. Wie de app tien keer op één dag opent, krijgt dus één
 * dagbackup en geen tien. Wie hem twee maanden dichtlaat, krijgt bij de
 * eerstvolgende start alle drie de reeksen bijgewerkt.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Rotatie = "dagelijks" | "wekelijks" | "maandelijks";

export interface BackupSlot {
  rotatie: Rotatie;
  /** 1-gebaseerd volgnummer binnen de reeks. */
  nummer: number;
  bestandsnaam: string;
}

/** Aantal slots per reeks. */
export const SLOTS_PER_ROTATIE: Record<Rotatie, number> = {
  dagelijks: 7,
  wekelijks: 4,
  maandelijks: 12,
};

/**
 * Hoe oud de inhoud van een slot mag zijn voordat hij wordt herschreven.
 *
 * Voor `maandelijks` bewust 28 en niet 30: een maand met 31 dagen zou anders
 * kunnen betekenen dat een slot net niet wordt bijgewerkt en er een gat valt.
 */
const VERVALT_NA_DAGEN: Record<Rotatie, number> = {
  dagelijks: 1,
  wekelijks: 7,
  maandelijks: 28,
};

const MS_PER_DAG = 24 * 60 * 60 * 1000;

/** ISO-weekdag: maandag = 1 ... zondag = 7. */
function isoWeekdag(datum: Date): number {
  const dag = datum.getDay();
  return dag === 0 ? 7 : dag;
}

function bestandsnaamVoor(rotatie: Rotatie, nummer: number): string {
  return `woningdossier-${rotatie}-${String(nummer)}.woningdossier`;
}

/**
 * Bepaalt in welk slot van elke reeks een backup op deze datum thuishoort.
 *
 * - dagelijks: ISO-weekdag (maandag = 1)
 * - wekelijks: week binnen de maand, waarbij dag 29-31 in week 4 vallen zodat
 *   er nooit een vijfde week ontstaat
 * - maandelijks: maandnummer
 */
export function bepaalSlots(datum: Date): Record<Rotatie, BackupSlot> {
  const dagNummer = isoWeekdag(datum);
  const weekNummer = Math.min(4, Math.ceil(datum.getDate() / 7));
  const maandNummer = datum.getMonth() + 1;

  return {
    dagelijks: {
      rotatie: "dagelijks",
      nummer: dagNummer,
      bestandsnaam: bestandsnaamVoor("dagelijks", dagNummer),
    },
    wekelijks: {
      rotatie: "wekelijks",
      nummer: weekNummer,
      bestandsnaam: bestandsnaamVoor("wekelijks", weekNummer),
    },
    maandelijks: {
      rotatie: "maandelijks",
      nummer: maandNummer,
      bestandsnaam: bestandsnaamVoor("maandelijks", maandNummer),
    },
  };
}

/**
 * Alle 23 bestandsnamen die het schema kan gebruiken.
 *
 * Handig om te tonen wat er in de map hoort te staan, en om op te ruimen wat
 * er niet bij hoort.
 */
export function alleSlots(): BackupSlot[] {
  const slots: BackupSlot[] = [];
  for (const rotatie of ["dagelijks", "wekelijks", "maandelijks"] as const) {
    for (let nummer = 1; nummer <= SLOTS_PER_ROTATIE[rotatie]; nummer++) {
      slots.push({ rotatie, nummer, bestandsnaam: bestandsnaamVoor(rotatie, nummer) });
    }
  }
  return slots;
}

/**
 * Bepaalt welke slots vernieuwd moeten worden.
 *
 * `bestaandeLeeftijden` bevat per bestandsnaam het tijdstip van de laatste
 * schrijfactie. Ontbreekt een naam, dan bestaat dat bestand nog niet en moet
 * het sowieso geschreven worden.
 */
export function bepaalTeSchrijvenSlots(
  datum: Date,
  bestaandeLeeftijden: Map<string, Date>,
): BackupSlot[] {
  const slots = bepaalSlots(datum);
  const teSchrijven: BackupSlot[] = [];

  for (const slot of Object.values(slots)) {
    const laatst = bestaandeLeeftijden.get(slot.bestandsnaam);
    if (!laatst) {
      teSchrijven.push(slot);
      continue;
    }

    const ouderdomDagen = (datum.getTime() - laatst.getTime()) / MS_PER_DAG;
    if (ouderdomDagen >= VERVALT_NA_DAGEN[slot.rotatie]) {
      teSchrijven.push(slot);
    }
  }

  return teSchrijven;
}
