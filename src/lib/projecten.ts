import { db } from "@/db/db";
import {
  bewaar,
  haal,
  haalAlle,
  haalVanProject,
  telVanProject,
  verwijder,
  verwijderVanProject,
} from "@/db/kluisopslag";
import { Timestamp } from "@/types/model";
import { markeerAlsIngevoerd, voegBerekendeWaardenSamen } from "@/lib/bron";
import {
  afspraakNaarOpslag,
  afspraakUitOpslag,
  ankerNaarOpslag,
  ankerUitOpslag,
  betrokkeneNaarOpslag,
  betrokkeneUitOpslag,
  faseNaarOpslag,
  faseUitOpslag,
  gebrekNaarOpslag,
  gebrekUitOpslag,
  meerwerkNaarOpslag,
  meerwerkUitOpslag,
  meterNaarOpslag,
  meterUitOpslag,
  meterstandNaarOpslag,
  meterstandUitOpslag,
  nabudgetNaarOpslag,
  nabudgetUitOpslag,
  onderdeelNaarOpslag,
  onderdeelUitOpslag,
  onderhoudLogregelNaarOpslag,
  onderhoudLogregelUitOpslag,
  onderhoudTaakNaarOpslag,
  onderhoudTaakUitOpslag,
  projectNaarOpslag,
  projectUitOpslag,
  taakNaarOpslag,
  taakUitOpslag,
  termijnNaarOpslag,
  termijnUitOpslag,
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
    ...projectNaarOpslag(gegevens),
    id,
    aangemaaktOp: nu,
    bijgewerktOp: nu,
  };
  await bewaar(db.projecten, data);
  return id;
}

/**
 * Haalt het actieve project op (oudste aangemaakt).
 */
export async function haalActiefProject(_uid: string): Promise<ProjectMetId | null> {
  const alle = await haalAlle(db.projecten);
  if (alle.length === 0 || !alle[0]) return null;
  alle.sort((a, b) => {
    const tA = a.aangemaaktOp ? a.aangemaaktOp.toMillis() : 0;
    const tB = b.aangemaaktOp ? b.aangemaaktOp.toMillis() : 0;
    return tA - tB;
  });
  const eerste = alle[0];
  if (!eerste) return null;
  return projectUitOpslag(eerste.id, eerste);
}

export async function haalProject(_uid: string, projectId: string): Promise<ProjectMetId | null> {
  const record = await haal(db.projecten, projectId);
  if (!record) return null;
  return projectUitOpslag(record.id, record);
}

/**
 * Werkt het project bij met wijzigingen die de gebruiker zelf heeft gemaakt.
 *
 * De gewijzigde velden worden als `ingevoerd` gemarkeerd en zijn daarmee
 * beschermd tegen elke latere automatische bewerking (bevinding A-10).
 */
export async function werkProjectBij(
  _uid: string,
  projectId: string,
  wijzigingen: ProjectInvoer,
): Promise<void> {
  const bestaand = await haal(db.projecten, projectId);
  if (!bestaand) return;
  const conversie = projectNaarOpslag(wijzigingen);

  const bijgewerkt: { id: string; projectId?: string } & Record<string, unknown> =
    markeerAlsIngevoerd(
      {
        ...bestaand,
        ...conversie,
        bijgewerktOp: Timestamp.now(),
      },
      Object.keys(conversie),
    );

  await bewaar(db.projecten, bijgewerkt);
}

/**
 * Werkt het project bij met dóór de app berekende waarden.
 *
 * Slaat velden over die de gebruiker zelf heeft ingevuld en geeft terug welke
 * dat waren, zodat de aanroeper dat kan tonen in plaats van stil af te wijken
 * van wat de berekening zei.
 */
export async function werkBerekendeProjectwaardenBij(
  _uid: string,
  projectId: string,
  berekend: ProjectInvoer,
): Promise<{ overgeslagen: string[] }> {
  const bestaand = await haal(db.projecten, projectId);
  if (!bestaand) return { overgeslagen: [] };

  const conversie = projectNaarOpslag(berekend);
  const { record, overgeslagen } = voegBerekendeWaardenSamen(
    bestaand as { id: string; projectId?: string } & Record<string, unknown>,
    { ...conversie, bijgewerktOp: Timestamp.now() },
  );

  await bewaar(db.projecten, record);
  return { overgeslagen };
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
  verwijderd += await verwijderVanProject(db.ankers, projectId);
  verwijderd += await verwijderVanProject(db.betrokkenen, projectId);
  verwijderd += await verwijderVanProject(db.afspraken, projectId);
  verwijderd += await verwijderVanProject(db.phases, projectId);
  verwijderd += await verwijderVanProject(db.tasks, projectId);
  verwijderd += await verwijderVanProject(db.meerwerk, projectId);
  verwijderd += await verwijderVanProject(db.termijnen, projectId);
  verwijderd += await verwijderVanProject(db.gebreken, projectId);
  verwijderd += await verwijderVanProject(db.nabudget, projectId);
  verwijderd += await verwijderVanProject(db.onderdelen, projectId);
  verwijderd += await verwijderVanProject(db.onderhoudstaken, projectId);
  verwijderd += await verwijderVanProject(db.onderhoudslogboek, projectId);
  verwijderd += await verwijderVanProject(db.meters, projectId);
  verwijderd += await verwijderVanProject(db.meterstanden, projectId);
  await verwijder(db.projecten, projectId);
  return verwijderd;
}

// ── Ankers ─────────────────────────────────────────────────────────────────

export async function haalAnkers(_uid: string, projectId: string): Promise<AnkerMetId[]> {
  const records = await haalVanProject(db.ankers, projectId);
  const gezien = new Set<string>();
  const ankers: AnkerMetId[] = [];

  for (const d of records) {
    const anker = ankerUitOpslag(d.id, d);
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
  await bewaar(db.ankers, {
    ...ankerNaarOpslag(anker),
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
  const alleAnkers = await haalVanProject(db.ankers, projectId);
  const record = alleAnkers.find((a) => a.type === type);
  return record?.id ?? null;
}

export async function verwijderAnker(
  _uid: string,
  _projectId: string,
  ankerId: string,
): Promise<void> {
  await verwijder(db.ankers, ankerId);
}

// ── Betrokkenen ────────────────────────────────────────────────────────────

export async function haalBetrokkenen(_uid: string, projectId: string): Promise<BetrokkeneMetId[]> {
  const records = await haalVanProject(db.betrokkenen, projectId);
  return records
    .map((d) => betrokkeneUitOpslag(d.id, d))
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

export async function zetBetrokkene(
  _uid: string,
  projectId: string,
  bestaand: BetrokkeneMetId | null,
  gegevens: Omit<BetrokkeneData, "waardenBron">,
): Promise<string> {
  const id = bestaand?.id ?? crypto.randomUUID();
  await bewaar(db.betrokkenen, {
    ...betrokkeneNaarOpslag(gegevens),
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
  const alleAfspraken = await haalVanProject(db.afspraken, projectId);
  const afspraken = alleAfspraken.filter((a) => a.betrokkeneId === betrokkeneId);
  for (const a of afspraken) {
    await verwijder(db.afspraken, a.id);
  }
  await verwijder(db.betrokkenen, betrokkeneId);
  return afspraken.length;
}

// ── Afspraken ──────────────────────────────────────────────────────────────

export async function haalAfspraken(_uid: string, projectId: string): Promise<AfspraakMetId[]> {
  const records = await haalVanProject(db.afspraken, projectId);
  return records.map((d) => afspraakUitOpslag(d.id, d));
}

export async function werkAfspraakBij(
  _uid: string,
  _projectId: string,
  afspraakId: string,
  wijzigingen: Partial<AfspraakData>,
): Promise<void> {
  const bestaand = await haal(db.afspraken, afspraakId);
  if (!bestaand) return;
  await bewaar(db.afspraken, {
    ...bestaand,
    ...afspraakNaarOpslag(wijzigingen),
  });
}

export async function zetAfspraak(
  _uid: string,
  projectId: string,
  afspraakId: string | null,
  afspraak: AfspraakData,
): Promise<string> {
  const id = afspraakId ?? crypto.randomUUID();
  await bewaar(db.afspraken, {
    ...afspraakNaarOpslag(afspraak),
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
  await verwijder(db.afspraken, afspraakId);
}

// ── De standaardbibliotheek uitrollen ──────────────────────────────────────

function uitBibliotheek(standaard: StandaardBetrokkene): Record<string, unknown> {
  return betrokkeneNaarOpslag({
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
      await bewaar(db.betrokkenen, {
        ...uitBibliotheek(standaard),
        id: betrokkeneId,
        projectId,
      });

      for (const afspraak of standaard.afspraken) {
        const afspraakId = crypto.randomUUID();
        await bewaar(db.afspraken, {
          ...afspraakNaarOpslag({
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
  const records = await haalVanProject(db.phases, projectId);
  return records
    .map((d) => faseUitOpslag(d.id, d))
    .sort((a, b) => (a.volgorde ?? 99) - (b.volgorde ?? 99));
}

export async function zetFase(
  _uid: string,
  projectId: string,
  faseId: string | null,
  fase: FaseData,
): Promise<string> {
  const id = faseId ?? crypto.randomUUID();
  await bewaar(db.phases, {
    ...faseNaarOpslag(fase),
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
  const count = await telVanProject(db.phases, projectId);
  if (count > 0) return false;

  await db.transaction("rw", db.phases, async () => {
    for (const fase of fases) {
      await bewaar(db.phases, {
        ...faseNaarOpslag(fase),
        id: crypto.randomUUID(),
        projectId,
      });
    }
  });
  return true;
}

// ── Taken ──────────────────────────────────────────────────────────────────

export async function haalTaken(_uid: string, projectId: string): Promise<TaakMetId[]> {
  const records = await haalVanProject(db.tasks, projectId);
  return records.map((d) => taakUitOpslag(d.id, d));
}

export async function zetTaak(
  _uid: string,
  projectId: string,
  taakId: string | null,
  taak: TaakData,
): Promise<string> {
  const id = taakId ?? crypto.randomUUID();
  await bewaar(db.tasks, {
    ...taakNaarOpslag(taak),
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
  await verwijder(db.tasks, taakId);
}

// ── Meerwerk ───────────────────────────────────────────────────────────────

export async function haalMeerwerk(_uid: string, projectId: string): Promise<MeerwerkMetId[]> {
  const records = await haalVanProject(db.meerwerk, projectId);
  return records.map((d) => meerwerkUitOpslag(d.id, d));
}

export async function zetMeerwerk(
  _uid: string,
  projectId: string,
  itemId: string | null,
  item: MeerwerkData,
): Promise<string> {
  const id = itemId ?? crypto.randomUUID();
  await bewaar(db.meerwerk, {
    ...meerwerkNaarOpslag(item),
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
  await verwijder(db.meerwerk, itemId);
}

// ── Termijnen (bouwdepot) ──────────────────────────────────────────────────

export async function haalTermijnen(_uid: string, projectId: string): Promise<TermijnMetId[]> {
  const records = await haalVanProject(db.termijnen, projectId);
  return records.map((d) => termijnUitOpslag(d.id, d));
}

export async function zetTermijn(
  _uid: string,
  projectId: string,
  termijnId: string | null,
  termijn: TermijnData,
): Promise<string> {
  const id = termijnId ?? crypto.randomUUID();
  await bewaar(db.termijnen, {
    ...termijnNaarOpslag(termijn),
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
  await verwijder(db.termijnen, termijnId);
}

// ── Gebreken (opleverpunten) ───────────────────────────────────────────────

export async function haalGebreken(_uid: string, projectId: string): Promise<GebrekMetId[]> {
  const records = await haalVanProject(db.gebreken, projectId);
  return records.map((d) => gebrekUitOpslag(d.id, d));
}

export async function zetGebrek(
  _uid: string,
  projectId: string,
  gebrekId: string | null,
  gebrek: GebrekData,
): Promise<string> {
  const id = gebrekId ?? crypto.randomUUID();
  await bewaar(db.gebreken, {
    ...gebrekNaarOpslag(gebrek),
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
  await verwijder(db.gebreken, gebrekId);
}

// ── Nabudget ───────────────────────────────────────────────────────────────

export async function haalNabudget(_uid: string, projectId: string): Promise<NabudgetMetId[]> {
  const records = await haalVanProject(db.nabudget, projectId);
  return records.map((d) => nabudgetUitOpslag(d.id, d));
}

export async function zetNabudget(
  _uid: string,
  projectId: string,
  postId: string | null,
  post: NabudgetData,
): Promise<string> {
  const id = postId ?? crypto.randomUUID();
  await bewaar(db.nabudget, {
    ...nabudgetNaarOpslag(post),
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
  await verwijder(db.nabudget, postId);
}

export async function voegStandaardNabudgetToe(
  _uid: string,
  projectId: string,
  omschrijvingen: readonly string[],
): Promise<number> {
  if (omschrijvingen.length === 0) return 0;

  await db.transaction("rw", db.nabudget, async () => {
    for (const omschrijving of omschrijvingen) {
      await bewaar(db.nabudget, {
        ...nabudgetNaarOpslag({ omschrijving, status: "geraamd" }),
        id: crypto.randomUUID(),
        projectId,
      });
    }
  });
  return omschrijvingen.length;
}

// ── Onderdelen — het register van wat er in de woning zit (ADR-0013) ───────

export async function haalOnderdelen(_uid: string, projectId: string): Promise<OnderdeelMetId[]> {
  const records = await haalVanProject(db.onderdelen, projectId);
  return records.map((d) => onderdeelUitOpslag(d.id, d));
}

export async function zetOnderdeel(
  _uid: string,
  projectId: string,
  onderdeelId: string | null,
  onderdeel: OnderdeelData,
): Promise<string> {
  const id = onderdeelId ?? crypto.randomUUID();
  await bewaar(db.onderdelen, {
    ...onderdeelNaarOpslag(onderdeel),
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
  await verwijder(db.onderdelen, onderdeelId);
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
  const records = await haalVanProject(db.onderhoudstaken, projectId);
  return records.map((d) => onderhoudTaakUitOpslag(d.id, d));
}

export async function zetOnderhoudstaak(
  _uid: string,
  projectId: string,
  taakId: string | null,
  taak: OnderhoudTaakData,
): Promise<string> {
  const id = taakId ?? crypto.randomUUID();
  await bewaar(db.onderhoudstaken, {
    ...onderhoudTaakNaarOpslag(taak),
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
  await verwijder(db.onderhoudstaken, taakId);
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
    await bewaar(db.onderhoudstaken, {
      ...onderhoudTaakNaarOpslag({ ...rest, laatstUitgevoerdOp: uitgevoerdOp }),
      id,
      projectId,
    });

    await bewaar(db.onderhoudslogboek, {
      ...onderhoudLogregelNaarOpslag({
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
  const records = await haalVanProject(db.onderhoudslogboek, projectId);
  return records
    .map((d) => onderhoudLogregelUitOpslag(d.id, d))
    .sort((a, b) => b.uitgevoerdOp.getTime() - a.uitgevoerdOp.getTime());
}

export async function verwijderLogregel(
  _uid: string,
  _projectId: string,
  logId: string,
): Promise<void> {
  await verwijder(db.onderhoudslogboek, logId);
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
      await bewaar(db.onderhoudstaken, {
        ...onderhoudTaakNaarOpslag({ ...taak, waardenBron: "voorstel" }),
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
  const records = await haalVanProject(db.meters, projectId);
  return records.map((d) => meterUitOpslag(d.id, d));
}

export async function zetMeter(
  _uid: string,
  projectId: string,
  meterId: string | null,
  meter: MeterData,
): Promise<string> {
  const id = meterId ?? crypto.randomUUID();
  await bewaar(db.meters, {
    ...meterNaarOpslag(meter),
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
  const standRecords = await haalVanProject(db.meterstanden, projectId);
  const vanDezeMeter = standRecords.filter((d) => meterstandUitOpslag(d.id, d).meterId === meterId);

  await db.transaction("rw", [db.meters, db.meterstanden], async () => {
    for (const s of vanDezeMeter) {
      await verwijder(db.meterstanden, s.id);
    }
    await verwijder(db.meters, meterId);
  });

  return vanDezeMeter.length;
}

export async function haalMeterstanden(
  _uid: string,
  projectId: string,
): Promise<MeterstandMetId[]> {
  const records = await haalVanProject(db.meterstanden, projectId);
  return records
    .map((d) => meterstandUitOpslag(d.id, d))
    .sort((a, b) => a.opgenomenOp.getTime() - b.opgenomenOp.getTime());
}

export async function zetMeterstand(
  _uid: string,
  projectId: string,
  opnameId: string | null,
  stand: MeterstandData,
): Promise<string> {
  const id = opnameId ?? crypto.randomUUID();
  await bewaar(db.meterstanden, {
    ...meterstandNaarOpslag(stand),
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
  await verwijder(db.meterstanden, opnameId);
}
