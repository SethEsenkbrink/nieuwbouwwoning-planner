import { db } from "@/db/db";
import { wisSleutel } from "@/db/sleutelregister";
import { wisAlleBestanden } from "@/lib/opfs/storage";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Paniekknop — alles lokaal wissen
 *
 * Bedoeld voor het moment dat een apparaat uit handen gaat: verkoop, reparatie,
 * diefstal die je ziet aankomen, of gewoon een gedeelde computer waarop niets
 * mag achterblijven.
 *
 * Wist drie dingen, in deze volgorde:
 *   1. de sleutel uit het geheugen — als de rest halverwege faalt, is de data
 *      in elk geval niet meer te ontsleutelen in deze sessie;
 *   2. OPFS, waar de documenten staan;
 *   3. de volledige IndexedDB-database, inclusief vault_meta.
 *
 * Zonder `vault_meta` zijn de gewrapte DEK's weg. Zelfs als iemand later
 * onversleutelde resten van de schijf weet te vissen, ontbreekt daarmee de
 * enige route naar de sleutel.
 *
 * Dit is onomkeerbaar. De aanroeper hoort dat te bevestigen met iets zwaarders
 * dan een ja-knop; zie de gevarenzone in Projectinstellingen.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface PaniekResultaat {
  sleutelGewist: boolean;
  bestandenGewist: boolean;
  databaseGewist: boolean;
  /** Wat er misging, als er iets misging. Leeg bij volledig succes. */
  fouten: string[];
}

/**
 * Wist alle lokale gegevens.
 *
 * Gooit bewust niet bij een deelfout: als OPFS dwarsligt moet de database
 * alsnog weg. De aanroeper krijgt terug wat er wél en niet gelukt is, zodat de
 * UI geen "alles gewist" kan melden terwijl er iets is blijven staan.
 */
export async function wisAllesLokaal(): Promise<PaniekResultaat> {
  const fouten: string[] = [];

  // 1. Sleutel eerst. Dit kan niet falen en maakt de rest onleesbaar.
  wisSleutel();

  // 2. Documenten in OPFS.
  let bestandenGewist = false;
  try {
    await wisAlleBestanden();
    bestandenGewist = true;
  } catch (err) {
    fouten.push(`Documenten wissen mislukt: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. De hele database, inclusief vault_meta en de bewaarde backupmap.
  let databaseGewist = false;
  try {
    db.close();
    await db.delete();
    databaseGewist = true;
  } catch (err) {
    fouten.push(`Database wissen mislukt: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    sleutelGewist: true,
    bestandenGewist,
    databaseGewist,
    fouten,
  };
}
