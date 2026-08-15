/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Migratieketen voor het `.woningdossier` backupformaat
 *
 * ELKE stap hier is onsterfelijk. Een migratie verwijderen of samenvoegen
 * maakt elke backup die ooit met die schemaversie geschreven is onherstelbaar,
 * en dat is precies het dataverlies dat dit bestand moet voorkomen.
 *
 * Regels bij het toevoegen van een schemaversie:
 *   1. Verhoog `HUIDIGE_SCHEMA_VERSIE`.
 *   2. Voeg één `Migratie` toe met `van: N, naar: N + 1`. Geen gaten.
 *   3. Voeg een golden fixture toe onder `tests/fixtures/` voor de óude versie.
 *   4. Wijzig nooit een bestaande stap — schrijf een nieuwe.
 *
 * Een migratie moet onbekende velden ongemoeid laten. Een backup uit een
 * nieuwere app-versie kan velden bevatten die deze versie niet kent; die
 * moeten bij een export weer meekomen (zie `behoudOnbekendeVelden`).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** De schemaversie die deze build schrijft. */
export const HUIDIGE_SCHEMA_VERSIE = 1;

/** De oudste schemaversie die we nog kunnen lezen. */
export const OUDSTE_ONDERSTEUNDE_SCHEMA_VERSIE = 1;

/** Losse tabellen uit een backup, als generieke records. */
export type Tabellen = Record<string, Record<string, unknown>[]>;

export interface MigratieContext {
  tabellen: Tabellen;
}

export interface Migratie {
  van: number;
  naar: number;
  /** Korte omschrijving; komt in de diagnostiek terecht. */
  omschrijving: string;
  toepassen: (context: MigratieContext) => MigratieContext;
}

/**
 * De keten. Op dit moment één schemaversie, dus nog geen stappen.
 *
 * Zodra `HUIDIGE_SCHEMA_VERSIE` naar 2 gaat, hoort hier een stap
 * `{ van: 1, naar: 2, ... }` te staan — en dan blijft die daar staan.
 */
export const MIGRATIES: Migratie[] = [];

/**
 * Controleert dat de keten ononderbroken is van de oudste ondersteunde versie
 * tot de huidige. Draait bij het opstarten van een import én in de tests, zodat
 * een gat direct opvalt in plaats van pas bij een gebruiker met een oude backup.
 */
export function controleerKetenIsSluitend(): void {
  let verwacht = OUDSTE_ONDERSTEUNDE_SCHEMA_VERSIE;
  for (const migratie of MIGRATIES) {
    if (migratie.van !== verwacht) {
      throw new Error(
        `Gat in de migratieketen: verwachtte een stap vanaf versie ${String(verwacht)}, ` +
          `maar de volgende stap begint bij ${String(migratie.van)}.`,
      );
    }
    if (migratie.naar !== migratie.van + 1) {
      throw new Error(
        `Migratie ${String(migratie.van)}→${String(migratie.naar)} slaat versies over. ` +
          `Elke stap moet precies één versie opschuiven.`,
      );
    }
    verwacht = migratie.naar;
  }

  if (verwacht !== HUIDIGE_SCHEMA_VERSIE) {
    throw new Error(
      `Migratieketen eindigt op versie ${String(verwacht)}, maar HUIDIGE_SCHEMA_VERSIE is ` +
        `${String(HUIDIGE_SCHEMA_VERSIE)}. Ontbreekt er een migratiestap?`,
    );
  }
}

/**
 * Draait de keten vanaf de schemaversie die in het backupbestand staat.
 *
 * Weigert bewust twee gevallen in plaats van te gokken:
 * - een versie ouder dan we ondersteunen (de migratie bestaat niet meer);
 * - een versie nieuwer dan deze build kent (we weten niet wat de velden betekenen).
 */
export function migreer(tabellen: Tabellen, vanVersie: number): Tabellen {
  controleerKetenIsSluitend();

  if (!Number.isInteger(vanVersie) || vanVersie < 1) {
    throw new Error(`Ongeldige schemaversie in backup: ${String(vanVersie)}.`);
  }

  if (vanVersie < OUDSTE_ONDERSTEUNDE_SCHEMA_VERSIE) {
    throw new Error(
      `Deze backup heeft schemaversie ${String(vanVersie)}. De oudste versie die deze app nog ` +
        `kan lezen is ${String(OUDSTE_ONDERSTEUNDE_SCHEMA_VERSIE)}.`,
    );
  }

  if (vanVersie > HUIDIGE_SCHEMA_VERSIE) {
    throw new Error(
      `Deze backup komt uit een nieuwere versie van Woningdossier (schemaversie ` +
        `${String(vanVersie)}, deze app kent ${String(HUIDIGE_SCHEMA_VERSIE)}). Werk de app bij ` +
        `voordat je herstelt — herstellen met een oudere versie zou gegevens weggooien.`,
    );
  }

  let context: MigratieContext = { tabellen };
  for (const migratie of MIGRATIES) {
    if (migratie.van >= vanVersie) {
      context = migratie.toepassen(context);
    }
  }
  return context.tabellen;
}
