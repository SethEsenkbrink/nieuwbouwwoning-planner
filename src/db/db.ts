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

  constructor() {
    super("woningdossier");
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
  }
}

export const db = new WoningdossierDB();
