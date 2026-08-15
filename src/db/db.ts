import Dexie, { type EntityTable } from "dexie";
import type {
  Afspraak,
  Anker,
  Betrokkene,
  GarantieItem,
  Gebrek,
  InboedelItem,
  MateriaalItem,
  MeerwerkItem,
  Meter,
  Meterstand,
  MetId,
  Nabudgetpost,
  Onderdeel,
  OnderhoudLogregel,
  OnderhoudTaak,
  Phase,
  Project,
  Task,
  Termijn,
  VerzekeringItem,
} from "@/types/model";
import type { VaultMeta } from "@/crypto/types";

export type StoredRecord<T> = T & MetId & { projectId: string };
export type StoredProject = Project & MetId;

/** De bewaarde backupmap. Bevat geen dossierinhoud — zie versie 3 hieronder. */
export interface BackupDoel {
  id: "doel";
  handle: FileSystemDirectoryHandle;
  gekozenOp: string;
}

/**
 * Dexie IndexedDB instantie — Woningdossier
 *
 * Versie 1: Volledige lokale opslag voor alle woningdossier-entiteiten en kluis-metadata.
 */
export class WoningdossierDB extends Dexie {
  vault_meta!: EntityTable<VaultMeta, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projecten!: EntityTable<StoredProject & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ankers!: EntityTable<StoredRecord<Anker> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  betrokkenen!: EntityTable<StoredRecord<Betrokkene> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  afspraken!: EntityTable<StoredRecord<Afspraak> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phases!: EntityTable<StoredRecord<Phase> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks!: EntityTable<StoredRecord<Task> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meerwerk!: EntityTable<StoredRecord<MeerwerkItem> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  termijnen!: EntityTable<StoredRecord<Termijn> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gebreken!: EntityTable<StoredRecord<Gebrek> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nabudget!: EntityTable<StoredRecord<Nabudgetpost> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onderdelen!: EntityTable<StoredRecord<Onderdeel> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onderhoudstaken!: EntityTable<StoredRecord<OnderhoudTaak> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onderhoudslogboek!: EntityTable<StoredRecord<OnderhoudLogregel> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meters!: EntityTable<StoredRecord<Meter> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meterstanden!: EntityTable<StoredRecord<Meterstand> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  materialen!: EntityTable<StoredRecord<MateriaalItem> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  garanties!: EntityTable<StoredRecord<GarantieItem> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verzekeringen!: EntityTable<StoredRecord<VerzekeringItem> & Record<string, any>, "id">;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inboedel!: EntityTable<StoredRecord<InboedelItem> & Record<string, any>, "id">;
  backup_doel!: EntityTable<BackupDoel, "id">;

  constructor() {
    super("woningdossier");

    // Versie 1 — platte opslag. Blijft staan omdat Dexie de keten nodig heeft
    // om bestaande databases te kunnen openen; hij wordt niet meer geschreven.
    this.version(1).stores({
      vault_meta: "id, versie",
      projecten: "id, naam, aangemaaktOp, bijgewerktOp",
      ankers: "id, projectId, type, status",
      betrokkenen: "id, projectId, categorie",
      afspraken: "id, projectId, betrokkeneId, ankerType, status",
      phases: "id, projectId, type, status, volgorde",
      tasks: "id, projectId, phaseId, status",
      meerwerk: "id, projectId, phaseId, status",
      termijnen: "id, projectId",
      gebreken: "id, projectId, status",
      nabudget: "id, projectId, status",
      onderdelen: "id, projectId, categorie, montage",
      onderhoudstaken: "id, projectId, onderdeelId",
      onderhoudslogboek: "id, projectId, taakId, uitgevoerdOp",
      meters: "id, projectId, soort",
      meterstanden: "id, projectId, meterId, opgenomenOp",
      materialen: "id, projectId, categorie, ruimte",
      garanties: "id, projectId, type, ingangsdatum",
      verzekeringen: "id, projectId, soort",
      inboedel: "id, projectId, ruimte",
    });

    // ── Versie 2 — versleutelde opslag ────────────────────────────────────
    //
    // Alleen `id` en `projectId` blijven als index over. Elke inhoudsindex
    // (naam, type, status, categorie, datums) is bewust weg: die velden zitten
    // nu in het versleutelde `enc`-veld, en een index erop zou precies de
    // gegevens lekken die versleuteling moet beschermen (A-01).
    //
    // De datalaag filterde die velden toch al in het geheugen via `.and(...)`,
    // dus er verdwijnt geen enkele query. `vault_meta` blijft plat: dat zijn
    // per definitie de publieke kluisparameters (zouten, IV's, wrapped keys).
    //
    // Dexie laat bestaande rijen bij een index-wijziging staan. De platte
    // records die er al zijn worden na het ontgrendelen hermigreerd door
    // `hermigreerPlatteRecords` — dat kan hier niet, want versleutelen vereist
    // de DEK en die bestaat op dit moment nog niet.
    this.version(2).stores({
      vault_meta: "id, versie",
      projecten: "id",
      ankers: "id, projectId",
      betrokkenen: "id, projectId",
      afspraken: "id, projectId",
      phases: "id, projectId",
      tasks: "id, projectId",
      meerwerk: "id, projectId",
      termijnen: "id, projectId",
      gebreken: "id, projectId",
      nabudget: "id, projectId",
      onderdelen: "id, projectId",
      onderhoudstaken: "id, projectId",
      onderhoudslogboek: "id, projectId",
      meters: "id, projectId",
      meterstanden: "id, projectId",
      materialen: "id, projectId",
      garanties: "id, projectId",
      verzekeringen: "id, projectId",
      inboedel: "id, projectId",
    });

    // ── Versie 3 — bewaarde backupmap ─────────────────────────────────────
    //
    // Eén record met de FileSystemDirectoryHandle van de gekozen backupmap.
    // Handles zijn structured-cloneable, dus IndexedDB kan ze bewaren; de
    // gebruiker hoeft de map daardoor maar één keer aan te wijzen.
    //
    // Bewust níét versleuteld: een handle bevat geen dossierinhoud, en hij
    // moet leesbaar zijn vóórdat de kluis ontgrendeld is — anders kun je bij
    // het opstarten niet controleren of de permissie nog geldt.
    this.version(3).stores({
      backup_doel: "id",
    });
  }
}

/**
 * Alle tabellen die versleuteld horen te zijn.
 *
 * `vault_meta` staat er bewust niet bij: dat zijn de publieke kluisparameters
 * die je nodig hebt vóórdat je kunt ontsleutelen.
 */
export function versleuteldeTabellen(database: WoningdossierDB) {
  return [
    database.projecten,
    database.ankers,
    database.betrokkenen,
    database.afspraken,
    database.phases,
    database.tasks,
    database.meerwerk,
    database.termijnen,
    database.gebreken,
    database.nabudget,
    database.onderdelen,
    database.onderhoudstaken,
    database.onderhoudslogboek,
    database.meters,
    database.meterstanden,
    database.materialen,
    database.garanties,
    database.verzekeringen,
    database.inboedel,
  ];
}

export const db = new WoningdossierDB();
