import { db } from "@/db/db";
import { bewaar, haalVanProject } from "@/db/kluisopslag";
import type { RegelCategorie, SignaalStatus } from "@/rules/types";
import type { SignaalToestand } from "@/rules/engine";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Signaaltabel — wat de gebruiker met een signaal deed
 *
 * De regelmotor is puur en onthoudt niets. Deze module is het geheugen: welk
 * signaal is geaccepteerd, genegeerd of gesnoozed, en welke invoerhash gold
 * op dat moment.
 *
 * Die hash is de kern. Zonder hem zou een weggeklikt signaal ofwel voor altijd
 * weg zijn (ook als de situatie verandert en het weer relevant wordt), ofwel
 * bij elke herberekening terugkomen (bevinding A-09). Met hem komt het precies
 * terug wanneer de onderliggende gegevens wijzigen.
 *
 * De records gaan door dezelfde versleutelde opslaglaag als de rest: een
 * signaal verraadt anders welke problemen er in het dossier spelen.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface SignaalRecord {
  /** `${projectId}:${signaalId}` — één rij per signaal per project. */
  id: string;
  projectId: string;
  signaalId: string;
  regelId: string;
  status: SignaalStatus;
  invoerHash: string;
  /** ISO-datum tot wanneer gesnoozed. */
  snoozeTot?: string;
  bijgewerktOp: string;
}

function maakId(projectId: string, signaalId: string): string {
  return `${projectId}:${signaalId}`;
}

/** Haalt alle bewaarde signaaltoestanden van één project op. */
export async function haalSignaaltoestanden(projectId: string): Promise<SignaalToestand[]> {
  const records = (await haalVanProject(db.signalen, projectId)) as unknown as SignaalRecord[];
  return records.map((r) => ({
    regelId: r.regelId,
    signaalId: r.signaalId,
    status: r.status,
    invoerHash: r.invoerHash,
    ...(r.snoozeTot ? { snoozeTot: r.snoozeTot } : {}),
  }));
}

/**
 * Legt vast wat de gebruiker met een signaal deed.
 *
 * De invoerhash van dát moment gaat mee, niet de huidige: dat is precies wat
 * later de vergelijking mogelijk maakt.
 */
export async function zetSignaalstatus(
  projectId: string,
  signaal: { id: string; regelId: string; invoerHash?: string },
  status: SignaalStatus,
  snoozeTot?: string,
): Promise<void> {
  const record: SignaalRecord = {
    id: maakId(projectId, signaal.id),
    projectId,
    signaalId: signaal.id,
    regelId: signaal.regelId,
    status,
    invoerHash: signaal.invoerHash ?? "",
    bijgewerktOp: new Date().toISOString(),
    ...(snoozeTot ? { snoozeTot } : {}),
  };

  await bewaar(db.signalen, record as unknown as { id: string; projectId?: string } & Record<string, unknown>);
}

/** Snoozet een signaal een aantal dagen vooruit. */
export async function snoozeSignaal(
  projectId: string,
  signaal: { id: string; regelId: string; invoerHash?: string },
  dagen: number,
): Promise<void> {
  const tot = new Date();
  tot.setDate(tot.getDate() + dagen);
  await zetSignaalstatus(projectId, signaal, "gesnoozed", tot.toISOString().slice(0, 10));
}

// ── Categorieschakelaars ───────────────────────────────────────────────────

/**
 * Welke regelcategorieën uitstaan.
 *
 * Bewust in dezelfde tabel als de signalen en niet in localStorage: het is
 * projectgebonden instelling en hoort dus mee in de backup, niet in een los
 * hoekje van de browser dat bij een herstel niet meekomt.
 */
const INSTELLINGEN_SIGNAAL_ID = "__categorieen__";

export async function haalUitgeschakeldeCategorieen(
  projectId: string,
): Promise<RegelCategorie[]> {
  const records = (await haalVanProject(db.signalen, projectId)) as unknown as (SignaalRecord & {
    categorieen?: RegelCategorie[];
  })[];
  const instelling = records.find((r) => r.signaalId === INSTELLINGEN_SIGNAAL_ID);
  return instelling?.categorieen ?? [];
}

export async function zetUitgeschakeldeCategorieen(
  projectId: string,
  categorieen: readonly RegelCategorie[],
): Promise<void> {
  await bewaar(db.signalen, {
    id: maakId(projectId, INSTELLINGEN_SIGNAAL_ID),
    projectId,
    signaalId: INSTELLINGEN_SIGNAAL_ID,
    regelId: "__instelling__",
    status: "geaccepteerd",
    invoerHash: "",
    categorieen: [...categorieen],
    bijgewerktOp: new Date().toISOString(),
  });
}
