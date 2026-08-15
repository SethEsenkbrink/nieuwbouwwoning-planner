/**
 * Type-definities voor het Diagnostiek & Systeemaudit Systeem
 */

export type AuditStatus = "gezond" | "attentie" | "kritiek";

export type AuditCategorie =
  | "database_integriteit"
  | "relaties_en_verwijzingen"
  | "cryptografie_en_kluis"
  | "opfs_bestandsopslag"
  | "regelmotor_benchmark"
  | "zero_network_en_csp"
  | "opslag_en_quota";

export interface AuditItem {
  id: string;
  categorie: AuditCategorie;
  status: AuditStatus;
  titel: string;
  beschrijving: string;
  details?: Record<string, unknown> | string[] | undefined;
  reparatieMogelijk?: boolean | undefined;
  reparatieActieId?: string | undefined;
}

export interface TabelStatistiek {
  tabelNaam: string;
  aantalRecords: number;
  foutieveRecords: number;
  verweesdeVerwijzingen: number;
}

export interface SysteemAuditRapport {
  versie: 1;
  gegenereerdOp: string;
  algemeneScore: number; // 0 - 100
  algemeneStatus: AuditStatus;
  samenvatting: {
    totaalControles: number;
    gezond: number;
    attenties: number;
    kritiek: number;
  };
  tabellen: TabelStatistiek[];
  items: AuditItem[];
  omgeving: {
    userAgent: string;
    isPwa: boolean;
    isOnline: boolean;
    opfsOndersteund: boolean;
    webAuthnOndersteund: boolean;
    storageUsageBytes?: number | undefined;
    storageQuotaBytes?: number | undefined;
  };
  benchmark: {
    databaseQueryMs: number;
    regelmotorEvaluatieMs: number;
    totaalAuditMs: number;
  };
  aanbevelingen: {
    prioriteit: "hoog" | "gemiddeld" | "laag";
    titel: string;
    advies: string;
  }[];
}

export type LogNiveau = "debug" | "info" | "waarschuwing" | "fout";

export interface LogGebeurtenis {
  id: string;
  tijdstip: string;
  niveau: LogNiveau;
  categorie: string;
  bericht: string;
  context?: Record<string, unknown> | undefined;
}
