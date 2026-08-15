import { db } from "@/db/db";
import { Timestamp } from "@/types/model";
import {
  afspraakNaarFirestore,
  afspraakUitFirestore,
  ankerNaarFirestore,
  ankerUitFirestore,
  betrokkeneNaarFirestore,
  betrokkeneUitFirestore,
  faseNaarFirestore,
  faseUitFirestore,
  gebrekNaarFirestore,
  gebrekUitFirestore,
  meerwerkNaarFirestore,
  meerwerkUitFirestore,
  meterNaarFirestore,
  meterUitFirestore,
  meterstandNaarFirestore,
  meterstandUitFirestore,
  nabudgetNaarFirestore,
  nabudgetUitFirestore,
  onderdeelNaarFirestore,
  onderdeelUitFirestore,
  onderhoudLogregelNaarFirestore,
  onderhoudLogregelUitFirestore,
  onderhoudTaakNaarFirestore,
  onderhoudTaakUitFirestore,
  projectNaarFirestore,
  projectUitFirestore,
  taakNaarFirestore,
  taakUitFirestore,
  termijnNaarFirestore,
  termijnUitFirestore,
  type AfspraakData,
  type AfspraakMetId,
  type AnkerData,
  type AnkerMetId,
  type BetrokkeneData,
  type BetrokkeneMetId,
  type FaseData,
  type FaseMetId,
  type GebrekData,
  type GebrekMetId,
  type MeerwerkData,
  type MeerwerkMetId,
  type MeterData,
  type MeterMetId,
  type MeterstandData,
  type MeterstandMetId,
  type NabudgetData,
  type NabudgetMetId,
  type OnderdeelData,
  type OnderdeelMetId,
  type OnderhoudLogregelMetId,
  type OnderhoudTaakData,
  type OnderhoudTaakMetId,
  type ProjectData,
  type ProjectMetId,
  type TaakData,
  type TaakMetId,
  type TermijnData,
  type TermijnMetId,
  type WoningpaspoortData,
} from "@/lib/converters";
import type { WoningStatus } from "@/types/model";
import { bepaalWaardenBron } from "@/lib/betrokkenen";
import { STANDAARD_BETROKKENEN, type StandaardBetrokkene } from "@/data/betrokkenen-standaard";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Datalaag — 100% Lokaal met Dexie (IndexedDB)
 *
 * Alle functies persisteren data direct in de browser database zonder enige
 * netwerkverbinding.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Project ────────────────────────────────────────────────────────────────

export type NieuwProject = Omit<ProjectData, "aangemaaktOp" | "bijgewerktOp">;
export type ProjectInvoer = { [K in keyof NieuwProject]?: NieuwProject[K] | undefined };

/**
 * Maakt een nieuw lokaal project aan en geeft het gegenereerde ID terug.
 */
export async function maakProject(
  _uid: string,
  gegevens: ProjectInvoer & { naam: string },
): Promise<string> {
  const id = crypto.randomUUID();
  const nu = Timestamp.now();
  const data = {
    ...projectNaarFirestore(gegevens),
    id,
    aangemaaktOp: nu,
    bijgewerktOp: nu,
  };
  await db.projecten.put(data);
  return id;
}

/**
 * Haalt het actieve project op (oudste aangemaakt).
 */
export async function haalActiefProject(_uid: string): Promise<ProjectMetId | null> {
  const alle = await db.projecten.toArray();
  if (alle.length === 0 || !alle[0]) return null;
  alle.sort((a, b) => {
    const tA = a.aangemaaktOp ? a.aangemaaktOp.toMillis() : 0;
    const tB = b.aangemaaktOp ? b.aangemaaktOp.toMillis() : 0;
    return tA - tB;
  });
  const eerste = alle[0];
  if (!eerste) return null;
  return projectUitFirestore(eerste.id, eerste);
}

export async function haalProject(_uid: string, projectId: string): Promise<ProjectMetId | null> {
  const record = await db.projecten.get(projectId);
  if (!record) return null;
  return projectUitFirestore(record.id, record);
}

export async function werkProjectBij(
  _uid: string,
  projectId: string,
  wijzigingen: ProjectInvoer,
): Promise<void> {
  const bestaand = await db.projecten.get(projectId);
  if (!bestaand) return;
  const conversie = projectNaarFirestore(wijzigingen);
  const bijgewerkt = {
    ...bestaand,
    ...conversie,
    bijgewerktOp: Timestamp.now(),
  };
  await db.projecten.put(bijgewerkt);
}

export async function zetWoningStatus(
  uid: string,
  projectId: string,
  status: WoningStatus,
): Promise<void> {
  await werkProjectBij(uid, projectId, { woningStatus: status });
}

export async function werkWoningpaspoortBij(
  uid: string,
  projectId: string,
  paspoort: WoningpaspoortData,
): Promise<void> {
  await werkProjectBij(uid, projectId, { woningpaspoort: paspoort });
}

export async function verwijderProject(_uid: string, projectId: string): Promise<number> {
  let verwijderd = 0;
  verwijderd += await db.ankers.where("projectId").equals(projectId).delete();
  verwijderd += await db.betrokkenen.where("projectId").equals(projectId).delete();
  verwijderd += await db.afspraken.where("projectId").equals(projectId).delete();
  verwijderd += await db.phases.where("projectId").equals(projectId).delete();
  verwijderd += await db.tasks.where("projectId").equals(projectId).delete();
  verwijderd += await db.meerwerk.where("projectId").equals(projectId).delete();
  verwijderd += await db.termijnen.where("projectId").equals(projectId).delete();
  verwijderd += await db.gebreken.where("projectId").equals(projectId).delete();
  verwijderd += await db.nabudget.where("projectId").equals(projectId).delete();
  verwijderd += await db.onderdelen.where("projectId").equals(projectId).delete();
  verwijderd += await db.onderhoudstaken.where("projectId").equals(projectId).delete();
  verwijderd += await db.onderhoudslogboek.where("projectId").equals(projectId).delete();
  verwijderd += await db.meters.where("projectId").equals(projectId).delete();
  verwijderd += await db.meterstanden.where("projectId").equals(projectId).delete();
  await db.projecten.delete(projectId);
  return verwijderd;
}

// ── Ankers ─────────────────────────────────────────────────────────────────

export async function haalAnkers(_uid: string, projectId: string): Promise<AnkerMetId[]> {
  const records = await db.ankers.where("projectId").equals(projectId).toArray();
  const gezien = new Set<string>();
  const ankers: AnkerMetId[] = [];

  for (const d of records) {
    const anker = ankerUitFirestore(d.id, d);
    if (gezien.has(anker.type)) continue;
    gezien.add(anker.type);
    ankers.push(anker);
  }

  return ankers;
}

export async function zetAnker(
  uid: string,
  projectId: string,
  ankerId: string | null,
  anker: AnkerData,
): Promise<string> {
  const doel = ankerId ?? (await vindAnkerIdVanType(uid, projectId, anker.type));
  const id = doel ?? crypto.randomUUID();
  await db.ankers.put({
    ...ankerNaarFirestore(anker),
    id,
    projectId,
  });
  return id;
}

async function vindAnkerIdVanType(
  _uid: string,
  projectId: string,
  type: AnkerData["type"],
): Promise<string | null> {
  const record = await db.ankers.where("projectId").equals(projectId).and((a) => a.type === type).first();
  return record?.id ?? null;
}

export async function verwijderAnker(
  _uid: string,
  _projectId: string,
  ankerId: string,
): Promise<void> {
  await db.ankers.delete(ankerId);
}

// ── Betrokkenen ────────────────────────────────────────────────────────────

export async function haalBetrokkenen(_uid: string, projectId: string): Promise<BetrokkeneMetId[]> {
  const records = await db.betrokkenen.where("projectId").equals(projectId).toArray();
  return records
    .map((d) => betrokkeneUitFirestore(d.id, d))
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

export async function zetBetrokkene(
  _uid: string,
  projectId: string,
  bestaand: BetrokkeneMetId | null,
  gegevens: Omit<BetrokkeneData, "waardenBron">,
): Promise<string> {
  const id = bestaand?.id ?? crypto.randomUUID();
  await db.betrokkenen.put({
    ...betrokkeneNaarFirestore(gegevens),
    waardenBron: bestaand === null ? "eigen" : bepaalWaardenBron(bestaand, gegevens),
    id,
    projectId,
  });
  return id;
}

export async function verwijderBetrokkene(
  _uid: string,
  projectId: string,
  betrokkeneId: string,
): Promise<number> {
  const afspraken = await db.afspraken.where("projectId").equals(projectId).and((a) => a.betrokkeneId === betrokkeneId).toArray();
  for (const a of afspraken) {
    await db.afspraken.delete(a.id);
  }
  await db.betrokkenen.delete(betrokkeneId);
  return afspraken.length;
}

// ── Afspraken ──────────────────────────────────────────────────────────────

export async function haalAfspraken(_uid: string, projectId: string): Promise<AfspraakMetId[]> {
  const records = await db.afspraken.where("projectId").equals(projectId).toArray();
  return records.map((d) => afspraakUitFirestore(d.id, d));
}

export async function werkAfspraakBij(
  _uid: string,
  _projectId: string,
  afspraakId: string,
  wijzigingen: Partial<AfspraakData>,
): Promise<void> {
  const bestaand = await db.afspraken.get(afspraakId);
  if (!bestaand) return;
  await db.afspraken.put({
    ...bestaand,
    ...afspraakNaarFirestore(wijzigingen),
  });
}

export async function zetAfspraak(
  _uid: string,
  projectId: string,
  afspraakId: string | null,
  afspraak: AfspraakData,
): Promise<string> {
  const id = afspraakId ?? crypto.randomUUID();
  await db.afspraken.put({
    ...afspraakNaarFirestore(afspraak),
    id,
    projectId,
  });
  return id;
}

export async function verwijderAfspraak(
  _uid: string,
  _projectId: string,
  afspraakId: string,
): Promise<void> {
  await db.afspraken.delete(afspraakId);
}

// ── De standaardbibliotheek uitrollen ──────────────────────────────────────

function uitBibliotheek(standaard: StandaardBetrokkene): Record<string, unknown> {
  return betrokkeneNaarFirestore({
    naam: standaard.naam,
    categorie: standaard.categorie,
    aanlooptijdDagen: standaard.aanlooptijdDagen,
    annuleertermijnDagen: standaard.annuleertermijnDagen,
    communicatieregel: standaard.communicatieregel,
    waardenBron: "voorstel",
  });
}

export async function voegStandaardBetrokkenenToe(
  _uid: string,
  projectId: string,
  sleutels: readonly string[],
): Promise<number> {
  const gekozen = STANDAARD_BETROKKENEN.filter((b) => sleutels.includes(b.sleutel));
  if (gekozen.length === 0) return 0;

  await db.transaction("rw", [db.betrokkenen, db.afspraken], async () => {
    for (const standaard of gekozen) {
      const betrokkeneId = crypto.randomUUID();
      await db.betrokkenen.put({
        ...uitBibliotheek(standaard),
        id: betrokkeneId,
        projectId,
      });

      for (const afspraak of standaard.afspraken) {
        const afspraakId = crypto.randomUUID();
        await db.afspraken.put({
          ...afspraakNaarFirestore({
            betrokkeneId,
            omschrijving: afspraak.omschrijving,
            ankerType: afspraak.ankerType,
            offsetDagen: afspraak.offsetDagen,
            status: "concept",
            ...(afspraak.waarschuwing !== undefined ? { waarschuwing: afspraak.waarschuwing } : {}),
          }),
          id: afspraakId,
          projectId,
        });
      }
    }
  });

  return gekozen.length;
}

// ── Fases ──────────────────────────────────────────────────────────────────

export async function haalFases(_uid: string, projectId: string): Promise<FaseMetId[]> {
  const records = await db.phases.where("projectId").equals(projectId).toArray();
  return records
    .map((d) => faseUitFirestore(d.id, d))
    .sort((a, b) => (a.volgorde ?? 99) - (b.volgorde ?? 99));
}

export async function zetFase(
  _uid: string,
  projectId: string,
  faseId: string | null,
  fase: FaseData,
): Promise<string> {
  const id = faseId ?? crypto.randomUUID();
  await db.phases.put({
    ...faseNaarFirestore(fase),
    id,
    projectId,
  });
  return id;
}

export async function zorgVoorFases(
  _uid: string,
  projectId: string,
  fases: readonly FaseData[],
): Promise<boolean> {
  const count = await db.phases.where("projectId").equals(projectId).count();
  if (count > 0) return false;

  await db.transaction("rw", db.phases, async () => {
    for (const fase of fases) {
      await db.phases.put({
        ...faseNaarFirestore(fase),
        id: crypto.randomUUID(),
        projectId,
      });
    }
  });
  return true;
}

// ── Taken ──────────────────────────────────────────────────────────────────

export async function haalTaken(_uid: string, projectId: string): Promise<TaakMetId[]> {
  const records = await db.tasks.where("projectId").equals(projectId).toArray();
  return records.map((d) => taakUitFirestore(d.id, d));
}

export async function zetTaak(
  _uid: string,
  projectId: string,
  taakId: string | null,
  taak: TaakData,
): Promise<string> {
  const id = taakId ?? crypto.randomUUID();
  await db.tasks.put({
    ...taakNaarFirestore(taak),
    id,
    projectId,
  });
  return id;
}

export async function verwijderTaak(
  _uid: string,
  _projectId: string,
  taakId: string,
): Promise<void> {
  await db.tasks.delete(taakId);
}

// ── Meerwerk ───────────────────────────────────────────────────────────────

export async function haalMeerwerk(_uid: string, projectId: string): Promise<MeerwerkMetId[]> {
  const records = await db.meerwerk.where("projectId").equals(projectId).toArray();
  return records.map((d) => meerwerkUitFirestore(d.id, d));
}

export async function zetMeerwerk(
  _uid: string,
  projectId: string,
  itemId: string | null,
  item: MeerwerkData,
): Promise<string> {
  const id = itemId ?? crypto.randomUUID();
  await db.meerwerk.put({
    ...meerwerkNaarFirestore(item),
    id,
    projectId,
  });
  return id;
}

export async function verwijderMeerwerk(
  _uid: string,
  _projectId: string,
  itemId: string,
): Promise<void> {
  await db.meerwerk.delete(itemId);
}

// ── Termijnen (bouwdepot) ──────────────────────────────────────────────────

export async function haalTermijnen(_uid: string, projectId: string): Promise<TermijnMetId[]> {
  const records = await db.termijnen.where("projectId").equals(projectId).toArray();
  return records.map((d) => termijnUitFirestore(d.id, d));
}

export async function zetTermijn(
  _uid: string,
  projectId: string,
  termijnId: string | null,
  termijn: TermijnData,
): Promise<string> {
  const id = termijnId ?? crypto.randomUUID();
  await db.termijnen.put({
    ...termijnNaarFirestore(termijn),
    id,
    projectId,
  });
  return id;
}

export async function verwijderTermijn(
  _uid: string,
  _projectId: string,
  termijnId: string,
): Promise<void> {
  await db.termijnen.delete(termijnId);
}

// ── Gebreken (opleverpunten) ───────────────────────────────────────────────

export async function haalGebreken(_uid: string, projectId: string): Promise<GebrekMetId[]> {
  const records = await db.gebreken.where("projectId").equals(projectId).toArray();
  return records.map((d) => gebrekUitFirestore(d.id, d));
}

export async function zetGebrek(
  _uid: string,
  projectId: string,
  gebrekId: string | null,
  gebrek: GebrekData,
): Promise<string> {
  const id = gebrekId ?? crypto.randomUUID();
  await db.gebreken.put({
    ...gebrekNaarFirestore(gebrek),
    id,
    projectId,
  });
  return id;
}

export async function verwijderGebrek(
  _uid: string,
  _projectId: string,
  gebrekId: string,
): Promise<void> {
  await db.gebreken.delete(gebrekId);
}

// ── Nabudget ───────────────────────────────────────────────────────────────

export async function haalNabudget(_uid: string, projectId: string): Promise<NabudgetMetId[]> {
  const records = await db.nabudget.where("projectId").equals(projectId).toArray();
  return records.map((d) => nabudgetUitFirestore(d.id, d));
}

export async function zetNabudget(
  _uid: string,
  projectId: string,
  postId: string | null,
  post: NabudgetData,
): Promise<string> {
  const id = postId ?? crypto.randomUUID();
  await db.nabudget.put({
    ...nabudgetNaarFirestore(post),
    id,
    projectId,
  });
  return id;
}

export async function verwijderNabudget(
  _uid: string,
  _projectId: string,
  postId: string,
): Promise<void> {
  await db.nabudget.delete(postId);
}

export async function voegStandaardNabudgetToe(
  _uid: string,
  projectId: string,
  omschrijvingen: readonly string[],
): Promise<number> {
  if (omschrijvingen.length === 0) return 0;

  await db.transaction("rw", db.nabudget, async () => {
    for (const omschrijving of omschrijvingen) {
      await db.nabudget.put({
        ...nabudgetNaarFirestore({ omschrijving, status: "geraamd" }),
        id: crypto.randomUUID(),
        projectId,
      });
    }
  });
  return omschrijvingen.length;
}

// ── Onderdelen — het register van wat er in de woning zit (ADR-0013) ───────

export async function haalOnderdelen(_uid: string, projectId: string): Promise<OnderdeelMetId[]> {
  const records = await db.onderdelen.where("projectId").equals(projectId).toArray();
  return records.map((d) => onderdeelUitFirestore(d.id, d));
}

export async function zetOnderdeel(
  _uid: string,
  projectId: string,
  onderdeelId: string | null,
  onderdeel: OnderdeelData,
): Promise<string> {
  const id = onderdeelId ?? crypto.randomUUID();
  await db.onderdelen.put({
    ...onderdeelNaarFirestore(onderdeel),
    id,
    projectId,
  });
  return id;
}

export async function verwijderOnderdeel(
  _uid: string,
  _projectId: string,
  onderdeelId: string,
): Promise<void> {
  await db.onderdelen.delete(onderdeelId);
}

export async function meldRegistratieAan(
  uid: string,
  projectId: string,
  onderdeel: OnderdeelMetId,
  aangemeldOp: Date,
  referentie?: string,
): Promise<void> {
  if (!onderdeel.registratieplicht) return;

  const { id, ...rest } = onderdeel;
  await zetOnderdeel(uid, projectId, id, {
    ...rest,
    registratieplicht: {
      ...onderdeel.registratieplicht,
      aangemeldOp,
      ...(referentie ? { referentie } : {}),
    },
  });
}

// ── Onderhoud — taken en logboek (ADR-0014) ────────────────────────────────

export async function haalOnderhoudstaken(
  _uid: string,
  projectId: string,
): Promise<OnderhoudTaakMetId[]> {
  const records = await db.onderhoudstaken.where("projectId").equals(projectId).toArray();
  return records.map((d) => onderhoudTaakUitFirestore(d.id, d));
}

export async function zetOnderhoudstaak(
  _uid: string,
  projectId: string,
  taakId: string | null,
  taak: OnderhoudTaakData,
): Promise<string> {
  const id = taakId ?? crypto.randomUUID();
  await db.onderhoudstaken.put({
    ...onderhoudTaakNaarFirestore(taak),
    id,
    projectId,
  });
  return id;
}

export async function verwijderOnderhoudstaak(
  _uid: string,
  _projectId: string,
  taakId: string,
): Promise<void> {
  await db.onderhoudstaken.delete(taakId);
}

export async function vinkOnderhoudAf(
  _uid: string,
  projectId: string,
  taak: OnderhoudTaakMetId,
  uitgevoerdOp: Date,
  extra: { doorWie?: string; kosten?: number; notitie?: string } = {},
): Promise<void> {
  const { id, ...rest } = taak;
  await db.transaction("rw", [db.onderhoudstaken, db.onderhoudslogboek], async () => {
    await db.onderhoudstaken.put({
      ...onderhoudTaakNaarFirestore({ ...rest, laatstUitgevoerdOp: uitgevoerdOp }),
      id,
      projectId,
    });

    await db.onderhoudslogboek.put({
      ...onderhoudLogregelNaarFirestore({
        taakId: id,
        ...(taak.onderdeelId ? { onderdeelId: taak.onderdeelId } : {}),
        uitgevoerdOp,
        ...(extra.doorWie ? { doorWie: extra.doorWie } : {}),
        ...(extra.kosten === undefined ? {} : { kosten: extra.kosten }),
        ...(extra.notitie ? { notitie: extra.notitie } : {}),
      }),
      id: crypto.randomUUID(),
      projectId,
    });
  });
}

export async function haalOnderhoudslogboek(
  _uid: string,
  projectId: string,
): Promise<OnderhoudLogregelMetId[]> {
  const records = await db.onderhoudslogboek.where("projectId").equals(projectId).toArray();
  return records
    .map((d) => onderhoudLogregelUitFirestore(d.id, d))
    .sort((a, b) => b.uitgevoerdOp.getTime() - a.uitgevoerdOp.getTime());
}

export async function verwijderLogregel(
  _uid: string,
  _projectId: string,
  logId: string,
): Promise<void> {
  await db.onderhoudslogboek.delete(logId);
}

export async function voegStandaardOnderhoudToe(
  _uid: string,
  projectId: string,
  taken: readonly {
    titel: string;
    omschrijving?: string;
    intervalDagen: number;
    voorkeursmaand?: number;
    onderdeelId?: string;
    waarschuwing?: string;
  }[],
): Promise<number> {
  if (taken.length === 0) return 0;

  await db.transaction("rw", db.onderhoudstaken, async () => {
    for (const taak of taken) {
      await db.onderhoudstaken.put({
        ...onderhoudTaakNaarFirestore({ ...taak, waardenBron: "voorstel" }),
        id: crypto.randomUUID(),
        projectId,
      });
    }
  });
  return taken.length;
}

export async function maakGarantiecontrole(
  uid: string,
  projectId: string,
  onderdeelId: string,
  taak: {
    titel: string;
    omschrijving?: string;
    intervalDagen: number;
    waarschuwing?: string;
  },
): Promise<string> {
  return zetOnderhoudstaak(uid, projectId, null, {
    ...taak,
    onderdeelId,
    waardenBron: "voorstel",
  });
}

// ── Meters en meterstanden (ADR-0015) ──────────────────────────────────────

export async function haalMeters(_uid: string, projectId: string): Promise<MeterMetId[]> {
  const records = await db.meters.where("projectId").equals(projectId).toArray();
  return records.map((d) => meterUitFirestore(d.id, d));
}

export async function zetMeter(
  _uid: string,
  projectId: string,
  meterId: string | null,
  meter: MeterData,
): Promise<string> {
  const id = meterId ?? crypto.randomUUID();
  await db.meters.put({
    ...meterNaarFirestore(meter),
    id,
    projectId,
  });
  return id;
}

export async function verwijderMeter(
  _uid: string,
  projectId: string,
  meterId: string,
): Promise<number> {
  const standRecords = await db.meterstanden.where("projectId").equals(projectId).toArray();
  const vanDezeMeter = standRecords.filter((d) => meterstandUitFirestore(d.id, d).meterId === meterId);

  await db.transaction("rw", [db.meters, db.meterstanden], async () => {
    for (const s of vanDezeMeter) {
      await db.meterstanden.delete(s.id);
    }
    await db.meters.delete(meterId);
  });

  return vanDezeMeter.length;
}

export async function haalMeterstanden(
  _uid: string,
  projectId: string,
): Promise<MeterstandMetId[]> {
  const records = await db.meterstanden.where("projectId").equals(projectId).toArray();
  return records
    .map((d) => meterstandUitFirestore(d.id, d))
    .sort((a, b) => a.opgenomenOp.getTime() - b.opgenomenOp.getTime());
}

export async function zetMeterstand(
  _uid: string,
  projectId: string,
  opnameId: string | null,
  stand: MeterstandData,
): Promise<string> {
  const id = opnameId ?? crypto.randomUUID();
  await db.meterstanden.put({
    ...meterstandNaarFirestore(stand),
    id,
    projectId,
  });
  return id;
}

export async function verwijderMeterstand(
  _uid: string,
  _projectId: string,
  opnameId: string,
): Promise<void> {
  await db.meterstanden.delete(opnameId);
}
