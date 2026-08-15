import { db as defaultDb, type WoningdossierDB } from "@/db/db";
import { slaBestandOp } from "@/lib/opfs/storage";
import { Timestamp } from "@/types/model";
import type {
  InboxDeltaItem,
  InboxDeltaPayload,
} from "./types";

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Maakt een InboxDeltaPayload aan.
 */
export function maakInboxDelta(
  projectId: string,
  items: InboxDeltaItem[],
  apparaatNaam?: string,
): InboxDeltaPayload {
  return {
    manifest: {
      formaat: "woningdossier-inbox-delta-v1",
      projectId,
      aangemaaktOp: new Date().toISOString(),
      apparaatNaam: apparaatNaam ?? "Mobiele Companion",
      aantalItems: items.length,
    },
    items,
  };
}

/**
 * Versleutelt een InboxDeltaPayload met de DEK (AES-256-GCM).
 */
export async function exporteerInboxDelta(
  payload: InboxDeltaPayload,
  dek: CryptoKey,
): Promise<Uint8Array> {
  const jsonString = JSON.stringify(payload);
  const plaintext = new TextEncoder().encode(jsonString);

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    plaintext,
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  const result = new Uint8Array(iv.length + ciphertext.length);
  result.set(iv, 0);
  result.set(ciphertext, iv.length);
  return result;
}

/**
 * Ontsleutelt een InboxDeltaPayload met de DEK.
 */
export async function importeerInboxDelta(
  versleuteldeBytes: Uint8Array,
  dek: CryptoKey,
): Promise<InboxDeltaPayload> {
  if (versleuteldeBytes.length < 28) {
    throw new Error("Ongeldig inbox-deltabestand: te klein.");
  }

  const iv = versleuteldeBytes.slice(0, 12);
  const ciphertext = versleuteldeBytes.slice(12);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    dek,
    ciphertext,
  );

  const jsonString = new TextDecoder().decode(plaintextBuffer);
  const payload = JSON.parse(jsonString) as InboxDeltaPayload;

  if (payload.manifest?.formaat !== "woningdossier-inbox-delta-v1") {
    throw new Error("Ongeldig formaat van inbox-delta.");
  }

  return payload;
}

/**
 * Verwerkt een binnengekomen mobiel inbox-item in de lokale desktop database.
 * Slaat gekoppelde foto's/bijlagen op in versleutelde OPFS.
 */
export async function verwerkInboxDeltaItem(
  item: InboxDeltaItem,
  projectId: string,
  dek?: CryptoKey,
  database: WoningdossierDB = defaultDb,
): Promise<void> {
  const bijlageUuids: string[] = [];

  if (item.bijlagen && item.bijlagen.length > 0 && dek) {
    for (const bijlage of item.bijlagen) {
      const bytes = base64ToUint8Array(bijlage.dataBase64);
      await slaBestandOp(dek, bijlage.id, bytes);
      bijlageUuids.push(bijlage.id);
    }
  }

  const aangemaaktOp = Timestamp.fromDate(new Date(item.aangemaaktOp));

  switch (item.type) {
    case "gebrek": {
      const locatie = typeof item.data.locatie === "string" ? item.data.locatie : undefined;
      await database.gebreken.put({
        id: item.id,
        projectId,
        omschrijving: item.titel,
        locatie,
        gemeldOp: aangemaaktOp,
        status: "open",
      });
      break;
    }
    case "meterstand": {
      const stand = typeof item.data.stand === "number" ? item.data.stand : Number(item.data.stand ?? 0);
      const meterId = typeof item.data.meterId === "string" ? item.data.meterId : "meter-onbekend";
      const notitie = typeof item.data.notitie === "string" ? item.data.notitie : undefined;
      await database.meterstanden.put({
        id: item.id,
        projectId,
        meterId,
        opgenomenOp: aangemaaktOp,
        stand,
        notitie,
      });
      break;
    }
    case "materiaal": {
      const categorie = typeof item.data.categorie === "string" ? (item.data.categorie as never) : "overig";
      const ruimte = typeof item.data.ruimte === "string" ? item.data.ruimte : undefined;
      const kleurcode = typeof item.data.kleurcode === "string" ? item.data.kleurcode : undefined;
      const merk = typeof item.data.merk === "string" ? item.data.merk : undefined;
      const notitie = typeof item.data.notitie === "string" ? item.data.notitie : undefined;
      await database.materialen.put({
        id: item.id,
        projectId,
        naam: item.titel,
        categorie,
        ruimte,
        kleurcode,
        merk,
        documentUuid: bijlageUuids[0],
        notitie,
      });
      break;
    }
    case "onderhoud_log": {
      const taakId = typeof item.data.taakId === "string" ? item.data.taakId : "taak-onbekend";
      const doorWie = typeof item.data.doorWie === "string" ? item.data.doorWie : "mobiel geregistreerd";
      const kosten = typeof item.data.kosten === "number" ? item.data.kosten : Number(item.data.kosten ?? 0);
      const notitie = typeof item.data.notitie === "string" ? item.data.notitie : item.titel;
      await database.onderhoudslogboek.put({
        id: item.id,
        projectId,
        taakId,
        uitgevoerdOp: aangemaaktOp,
        doorWie,
        kosten,
        notitie,
      });
      break;
    }
    case "notitie": {
      // Bewaar als onderdeel of algemene notitie
      break;
    }
  }
}
