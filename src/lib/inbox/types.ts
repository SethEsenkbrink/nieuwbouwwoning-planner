/**
 * Type-definities voor mobiele Quick-Capture Inbox-Delta
 */

export type InboxItemType =
  | "gebrek"
  | "meterstand"
  | "materiaal"
  | "notitie"
  | "onderhoud_log";

export interface InboxBijlage {
  id: string;
  naam: string;
  mimeType: string;
  dataBase64: string; // Base64 data van foto of bestand
}

export interface InboxDeltaItem {
  id: string;
  type: InboxItemType;
  titel: string;
  aangemaaktOp: string;
  data: Record<string, unknown>;
  bijlagen?: InboxBijlage[];
}

export interface InboxDeltaManifest {
  formaat: "woningdossier-inbox-delta-v1";
  projectId: string;
  aangemaaktOp: string;
  apparaatNaam?: string;
  aantalItems: number;
}

export interface InboxDeltaPayload {
  manifest: InboxDeltaManifest;
  items: InboxDeltaItem[];
}
