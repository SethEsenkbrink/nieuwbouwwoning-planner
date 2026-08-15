import type { VaultMeta } from "@/crypto/types";

/**
 * Type-definities voor het `.woningdossier` streaming backup/restore formaat
 */

export interface DossierManifest {
  formaatVersie: 1;
  appVersie: string;
  aangemaaktOp: string;
  kluismeta: VaultMeta;
  statistieken: {
    aantalProjecten: number;
    aantalBestanden: number;
    totaalBytes: number;
  };
}

export interface BestandIndexItem {
  uuid: string;
  naam: string;
  mimeType: string;
  grootte: number;
  sha256: string;
  gekoppeldAan?: {
    type: "onderdeel" | "gebrek" | "project" | "factuur";
    id: string;
  };
  toegevoegdOp: string;
}

export interface DossierDatabasePayload {
  versie: 1;
  exportDatum: string;
  tabellen: {
    projecten: Record<string, unknown>[];
    ankers: Record<string, unknown>[];
    betrokkenen: Record<string, unknown>[];
    afspraken: Record<string, unknown>[];
    phases: Record<string, unknown>[];
    tasks: Record<string, unknown>[];
    meerwerk: Record<string, unknown>[];
    termijnen: Record<string, unknown>[];
    gebreken: Record<string, unknown>[];
    nabudget: Record<string, unknown>[];
    onderdelen: Record<string, unknown>[];
    onderhoudstaken: Record<string, unknown>[];
    onderhoudslogboek: Record<string, unknown>[];
    meters: Record<string, unknown>[];
    meterstanden: Record<string, unknown>[];
    materialen: Record<string, unknown>[];
    garanties: Record<string, unknown>[];
    verzekeringen: Record<string, unknown>[];
    inboedel: Record<string, unknown>[];
  };
}
