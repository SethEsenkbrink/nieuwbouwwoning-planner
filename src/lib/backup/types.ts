import type { VaultMeta } from "@/crypto/types";

/**
 * Type-definities voor het `.woningdossier` streaming backup/restore formaat
 */

/**
 * Het onversleutelde manifest van een `.woningdossier`.
 *
 * Bevat bewust géén persoonsgegeven: alleen versies, tellers en de publieke
 * kluisparameters. Wie het archief in handen krijgt zonder wachtwoordzin of
 * herstelcode leert hieruit niets over de woning of de bewoner.
 */
export interface DossierManifest {
  /** Vaste herkenningsstring, zodat een vreemd zipbestand meteen afvalt. */
  formaat: "woningdossier";
  /** Versie van de archiefstructuur (zip-indeling, bestandsnamen). */
  formaatVersie: 1;
  /** Versie van het datamodel binnen `data.enc`. Stuurt de migratieketen. */
  schemaVersie: number;
  appVersie: string;
  aangemaaktOp: string;
  /** Welk cijfer er gebruikt is; expliciet, zodat een lezer niet hoeft te raden. */
  cipher: "AES-256-GCM";
  kluismeta: VaultMeta;
  /** Aantal records per tabel — maakt een onvolledige restore zichtbaar. */
  aantallen: Record<string, number>;
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
  versie: number;
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
