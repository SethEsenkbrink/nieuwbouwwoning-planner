import type { Table } from "dexie";
import { ontsleutelBytes, versleutelBytes } from "@/crypto/crypto";
import { base64ToUint8Array, uint8ArrayToBase64 } from "@/crypto/kdf";
import { vereisSleutel } from "./sleutelregister";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Versleutelde opslaglaag boven Dexie
 *
 * ADR-0021 eist dat alle data at rest versleuteld is. Tot 15 augustus 2026 was
 * dat niet zo: elke tabel bewaarde platte domeinobjecten, waardoor de kluis,
 * de auto-lock en de hele Argon2id-hiërarchie feitelijk niets beschermden.
 * Wie het browserprofiel had, las het volledige dossier (A-01).
 *
 * ── Wat er op schijf staat ─────────────────────────────────────────────────
 *
 *   { id: "abc", projectId: "p1", enc: "<base64 van 12-byte IV + ciphertext>" }
 *
 * Alleen `id` en `projectId` blijven leesbaar. Dat zijn willekeurige UUID's
 * zonder betekenis, en ze zijn nodig als indexsleutel — zonder die twee kan
 * Dexie niets terugvinden. Alle inhoud (namen, adressen, bedragen, notities,
 * datums) zit in `enc`, per record versleuteld met AES-256-GCM onder een
 * eigen verse 12-byte IV uit `crypto.getRandomValues`.
 *
 * ── Waarom de inhoudsindexen weg zijn ──────────────────────────────────────
 *
 * Schema v1 indexeerde ook `naam`, `type`, `status`, `categorie` en diverse
 * datums. Op versleutelde waarden is dat onmogelijk én onwenselijk: een index
 * op `status` lekt precies de verdeling die je wilde verbergen. De datalaag
 * filterde die velden toch al in het geheugen via `.and(...)`, dus er gaat
 * geen enkele query verloren. Voor één huishouden gaat het om honderden tot
 * hooguit enkele duizenden records — in het geheugen sorteren en filteren is
 * daar ruimschoots snel genoeg.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Zoals een record op schijf staat.
 *
 * `enc` is base64 en geen Uint8Array. Dat is bewust: een Uint8Array overleeft
 * `JSON.stringify` niet — hij wordt `{"0":12,"1":34,...}` — en de backup
 * serialiseert hele tabellen naar JSON. Met ruwe bytes kwam een hersteld
 * record er onbruikbaar uit. Base64 overleeft JSON, structured clone én
 * handmatige inspectie, tegen ongeveer een derde meer opslag. Voor een
 * huishoudensdossier is dat verwaarloosbaar; stille corruptie niet.
 */
export interface VersleuteldRecord {
  id: string;
  projectId?: string;
  enc: string;
}

/**
 * Een tabel met versleutelde records.
 *
 * Generiek over het rijtype, zodat `haalVanProject(db.ankers, id)` gewoon
 * `Anker[]` teruggeeft en de aanroepers hun typen houden.
 */
export type VersleuteldeTabel<T = unknown> = Table<T, string>;

/** Versleutelt één record tot de vorm die op schijf gaat. */
async function verpak<T extends { id: string; projectId?: string }>(
  record: T,
): Promise<VersleuteldRecord> {
  const dek = vereisSleutel();
  const json = new TextEncoder().encode(JSON.stringify(record));
  const { ciphertext, iv } = await versleutelBytes(dek, json);

  const samen = new Uint8Array(iv.length + ciphertext.length);
  samen.set(iv, 0);
  samen.set(ciphertext, iv.length);

  const verpakt: VersleuteldRecord = { id: record.id, enc: uint8ArrayToBase64(samen) };
  if (record.projectId !== undefined) {
    verpakt.projectId = record.projectId;
  }
  return verpakt;
}

/**
 * Ontsleutelt één record.
 *
 * Records van vóór deze laag hebben geen `enc`-veld. Die worden ongewijzigd
 * teruggegeven zodat de app blijft werken tijdens de eenmalige hermigratie
 * (zie `hermigreerPlatteRecords`), en niet omvalt op data die er al stond.
 */
async function uitpak<T>(rij: unknown): Promise<T> {
  const kandidaat = rij as Partial<VersleuteldRecord>;
  if (!kandidaat.enc) {
    return rij as T;
  }

  const dek = vereisSleutel();
  const bytes = base64ToUint8Array(kandidaat.enc);
  if (bytes.length < 28) {
    throw new Error(`Record '${String(kandidaat.id)}' is corrupt of onvolledig.`);
  }

  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const plat = await ontsleutelBytes(dek, ciphertext, iv);
  return JSON.parse(new TextDecoder().decode(plat)) as T;
}

// ── Publieke opslagbewerkingen ─────────────────────────────────────────────
//
// De publieke signaturen praten in het lógische type (Anker, Betrokkene, ...),
// zodat aanroepers hun typen houden. Intern wordt de tabel behandeld als wat
// hij op schijf werkelijk is: een tabel met VersleuteldRecord-rijen. Die twee
// beelden lopen bewust uiteen, en dat verschil hoort hier opgesloten te zitten
// en nergens anders.

/** De tabel zoals hij op schijf werkelijk is. */
type OpslagTabel = Table<VersleuteldRecord, string>;

/** Een tabel, ongeacht rijtype. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EnigeTabel = Table<any, any, any>;

/**
 * Het rijtype van een tabel, afgeleid uit de tabel zelf.
 *
 * Dexie's EntityTable is invariant in T, dus `Table<T>` als parametertype
 * accepteert `db.ankers` niet. Het rijtype uit het Table-type infereren wel, en dat houdt
 * de aanroepers hun echte typen: `haalVanProject(db.ankers, id)` geeft
 * gewoon `Anker[]`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RijType<Tb> = Tb extends Table<infer R, any, any> ? R : never;

/**
 * Kijkt naar een tabel als wat hij op schijf werkelijk is.
 *
 * Dit is bewust de énige plek waar het logische type (Anker, Betrokkene, ...)
 * en het opslagtype (VersleuteldRecord) elkaar raken. `EnigeTabel` is
 * `Table<any, ...>` omdat Dexie's EntityTable invariant is; die `any` wordt
 * hier meteen weer vastgelegd op één concreet type en gaat niet verder de
 * module in.
 */
function alsOpslag(tabel: EnigeTabel): OpslagTabel {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return tabel;
}

/** Schrijft één record versleuteld weg. */
export async function bewaar<Tb extends EnigeTabel>(
  tabel: Tb,
  record: { id: string; projectId?: string } & Record<string, unknown>,
): Promise<void> {
  await alsOpslag(tabel).put(await verpak(record));
}

/** Schrijft meerdere records versleuteld weg. */
export async function bewaarVeel<Tb extends EnigeTabel>(
  tabel: Tb,
  records: ({ id: string; projectId?: string } & Record<string, unknown>)[],
): Promise<void> {
  if (records.length === 0) return;
  const verpakt = await Promise.all(records.map((r) => verpak(r)));
  await alsOpslag(tabel).bulkPut(verpakt);
}

/** Haalt één record op id op, of `undefined`. */
export async function haal<Tb extends EnigeTabel>(
  tabel: Tb,
  id: string,
): Promise<RijType<Tb> | undefined> {
  const rij: unknown = await alsOpslag(tabel).get(id);
  if (!rij) return undefined;
  return uitpak<RijType<Tb>>(rij);
}

/** Haalt alle records van één project op. */
export async function haalVanProject<Tb extends EnigeTabel>(
  tabel: Tb,
  projectId: string,
): Promise<RijType<Tb>[]> {
  const rijen: unknown[] = await alsOpslag(tabel).where("projectId").equals(projectId).toArray();
  return Promise.all(rijen.map((rij) => uitpak<RijType<Tb>>(rij)));
}

/** Haalt alle records van een tabel op. */
export async function haalAlle<Tb extends EnigeTabel>(tabel: Tb): Promise<RijType<Tb>[]> {
  const rijen: unknown[] = await alsOpslag(tabel).toArray();
  return Promise.all(rijen.map((rij) => uitpak<RijType<Tb>>(rij)));
}

/** Verwijdert één record. Vereist geen sleutel: de id staat plat. */
export async function verwijder(tabel: EnigeTabel, id: string): Promise<void> {
  await alsOpslag(tabel).delete(id);
}

/** Verwijdert alle records van één project. Geeft het aantal terug. */
export async function verwijderVanProject(tabel: EnigeTabel, projectId: string): Promise<number> {
  return alsOpslag(tabel).where("projectId").equals(projectId).delete();
}

/** Telt records van één project zonder ze te ontsleutelen. */
export async function telVanProject(tabel: EnigeTabel, projectId: string): Promise<number> {
  return alsOpslag(tabel).where("projectId").equals(projectId).count();
}

/**
 * Hermigreert records die nog plat op schijf staan.
 *
 * Nodig voor kluizen die zijn aangemaakt vóór deze opslaglaag bestond: hun data
 * staat onversleuteld in IndexedDB. Draait direct na ontgrendelen en laat
 * records die al een `enc`-veld hebben met rust, dus herhaald aanroepen is
 * veilig. Geeft het aantal hermigreerde records terug.
 */
export async function hermigreerPlatteRecords(tabellen: EnigeTabel[]): Promise<number> {
  let hermigreerd = 0;

  for (const tabel of tabellen) {
    const rijen: unknown[] = await alsOpslag(tabel).toArray();
    const plat = rijen.filter((rij) => !(rij as Partial<VersleuteldRecord>).enc);
    if (plat.length === 0) continue;

    const verpakt = await Promise.all(
      plat.map((rij) => verpak(rij as { id: string; projectId?: string })),
    );
    await alsOpslag(tabel).bulkPut(verpakt);
    hermigreerd += verpakt.length;
  }

  return hermigreerd;
}
