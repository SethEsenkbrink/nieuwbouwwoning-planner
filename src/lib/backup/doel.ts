import { db } from "@/db/db";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Backupdoel — de map waar de roulerende backups landen
 *
 * De File System Access API geeft een `FileSystemDirectoryHandle` terug die
 * structured-cloneable is en dus in IndexedDB bewaard kan blijven. Daardoor
 * hoeft de gebruiker de map maar één keer te kiezen.
 *
 * Maar: een bewaarde handle betekent níét dat we er nog in mogen schrijven.
 * De browser trekt de toestemming in bij het sluiten van het tabblad, en soms
 * eerder. Daarom wordt de permissie bij élke start opnieuw nagegaan
 * (`controleerToegang`), en pas na een gebruikersgebaar opnieuw gevraagd
 * (`vraagToegangOpnieuw`) — `requestPermission` weigert buiten een klik.
 *
 * Zonder deze API is er geen stille fallback mogelijk: een browser die geen
 * map kan onthouden, kan ook niet ongevraagd wegschrijven. Daar valt het
 * schema terug op een gewone download, en dat hoort de UI eerlijk te melden.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Toegang = "verleend" | "moet-opnieuw-gevraagd" | "geweigerd" | "geen-map";

/** Of deze browser een map kan laten kiezen en onthouden. */
export function ondersteuntBackupmap(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

interface HandlePermissie {
  queryPermission?: (opties: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (opties: { mode: "readwrite" }) => Promise<PermissionState>;
}

/**
 * Laat de gebruiker een map kiezen en bewaart de handle.
 *
 * Moet vanuit een klik aangeroepen worden; de browser weigert de picker
 * daarbuiten.
 */
export async function kiesBackupmap(): Promise<FileSystemDirectoryHandle | null> {
  if (!ondersteuntBackupmap()) return null;

  const picker = (
    window as unknown as {
      showDirectoryPicker: (opties?: {
        mode?: "readwrite";
        id?: string;
      }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;

  try {
    const handle = await picker({ mode: "readwrite", id: "woningdossier-backups" });
    await db.backup_doel.put({ id: "doel", handle, gekozenOp: new Date().toISOString() });
    return handle;
  } catch {
    // De gebruiker heeft de keuze afgebroken. Dat is geen fout.
    return null;
  }
}

/** Haalt de eerder gekozen map op, of `null`. */
export async function haalBewaardeBackupmap(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const record = await db.backup_doel.get("doel");
    return record?.handle ?? null;
  } catch {
    return null;
  }
}

/** Vergeet de gekozen map. */
export async function vergeetBackupmap(): Promise<void> {
  await db.backup_doel.delete("doel");
}

/**
 * Controleert of we nog in de bewaarde map mogen schrijven.
 *
 * Vraagt niets — dat kan alleen na een klik. Deze functie is bedoeld om bij
 * het opstarten vast te stellen of er iets aan de gebruiker gevraagd moet
 * worden.
 */
export async function controleerToegang(
  handle: FileSystemDirectoryHandle | null,
): Promise<Toegang> {
  if (!handle) return "geen-map";

  const metPermissie = handle as unknown as HandlePermissie;
  if (!metPermissie.queryPermission) {
    // Oudere implementatie zonder permissie-API: pas bij schrijven blijkt het.
    return "verleend";
  }

  try {
    const staat = await metPermissie.queryPermission({ mode: "readwrite" });
    if (staat === "granted") return "verleend";
    if (staat === "prompt") return "moet-opnieuw-gevraagd";
    return "geweigerd";
  } catch {
    return "moet-opnieuw-gevraagd";
  }
}

/**
 * Vraagt de toestemming opnieuw. Moet vanuit een klik aangeroepen worden.
 */
export async function vraagToegangOpnieuw(
  handle: FileSystemDirectoryHandle,
): Promise<Toegang> {
  const metPermissie = handle as unknown as HandlePermissie;
  if (!metPermissie.requestPermission) return "verleend";

  try {
    const staat = await metPermissie.requestPermission({ mode: "readwrite" });
    return staat === "granted" ? "verleend" : "geweigerd";
  } catch {
    return "geweigerd";
  }
}

// ── Lezen en schrijven binnen de map ───────────────────────────────────────

/**
 * Geeft per bestandsnaam het tijdstip van de laatste wijziging.
 *
 * De rotatielogica gebruikt dit om te bepalen welke slots vernieuwd moeten
 * worden; zie `rotatie.ts`.
 */
export async function haalSlotLeeftijden(
  map: FileSystemDirectoryHandle,
): Promise<Map<string, Date>> {
  const leeftijden = new Map<string, Date>();

  try {
    const iterable = map as unknown as {
      values: () => AsyncIterable<FileSystemHandle>;
    };
    for await (const item of iterable.values()) {
      if (item.kind !== "file") continue;
      if (!item.name.endsWith(".woningdossier")) continue;

      const bestand = await (item as FileSystemFileHandle).getFile();
      leeftijden.set(item.name, new Date(bestand.lastModified));
    }
  } catch {
    // Map niet leesbaar: behandel als leeg, dan wordt alles opnieuw geschreven.
  }

  return leeftijden;
}

/**
 * Schrijft bytes naar een bestand in de map en leest ze meteen terug.
 *
 * De terugleescontrole staat hier bewust en niet alleen in `export.ts`: daar
 * wordt gecontroleerd of het archief klópt, hier of het ook daadwerkelijk zo
 * op schijf is beland. Een volle schijf of een ingetrokken permissie faalt
 * precies op dit punt, en dat mag niet als "backup geslaagd" eindigen.
 */
export async function schrijfEnControleer(
  map: FileSystemDirectoryHandle,
  bestandsnaam: string,
  bytes: Uint8Array,
): Promise<void> {
  const handle = await map.getFileHandle(bestandsnaam, { create: true });
  const writable = await handle.createWritable();
  await writable.write(bytes as unknown as FileSystemWriteChunkType);
  await writable.close();

  const terug = await (await handle.getFile()).arrayBuffer();
  if (terug.byteLength !== bytes.length) {
    throw new Error(
      `Backup '${bestandsnaam}' is onvolledig weggeschreven: ` +
        `${String(terug.byteLength)} van ${String(bytes.length)} bytes.`,
    );
  }
}
