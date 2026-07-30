import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  afspraakNaarFirestore,
  afspraakUitFirestore,
  ankerNaarFirestore,
  ankerUitFirestore,
  betrokkeneNaarFirestore,
  betrokkeneUitFirestore,
  projectNaarFirestore,
  projectUitFirestore,
  type AfspraakData,
  type AfspraakMetId,
  type AnkerData,
  type AnkerMetId,
  type BetrokkeneData,
  type BetrokkeneMetId,
  type ProjectData,
  type ProjectMetId,
} from "@/lib/converters";
import { bepaalWaardenBron } from "@/lib/betrokkenen";
import { STANDAARD_BETROKKENEN, type StandaardBetrokkene } from "@/data/betrokkenen-standaard";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Datalaag — het enige bestand dat met Firestore praat
 *
 * Componenten roepen deze functies aan; ze importeren zelf nooit de
 * Firebase-SDK (WORKFLOW.md §6). Zo staat alle kennis van paden, batches en
 * serverTimestamps op één plek.
 *
 * DRIE VALKUILEN DIE HIER ZIJN AFGEVANGEN
 *
 * 1. WIJZIGEN GAAT VIA `updateDoc`, NOOIT VIA `setDoc` ZONDER MERGE.
 *    De rules eisen dat `aangemaaktOp` onveranderd blijft. Een volledige
 *    overschrijving wist dat veld en wordt geweigerd — met een generieke
 *    "Missing or insufficient permissions", die niets zegt over de oorzaak.
 *
 * 2. `aangemaaktOp` MOET `serverTimestamp()` ZIJN BIJ HET AANMAKEN.
 *    De rules controleren `== request.time`. Een clientklok die een seconde
 *    afwijkt, is al genoeg om de write te laten mislukken.
 *
 * 3. `waardenBron` GAAT NAAR "eigen" IN DEZE LAAG, NIET IN EEN FORMULIER.
 *    Vergeet een component het, dan blijft de disclaimer hangen op cijfers die
 *    de gebruiker zelf invulde (ADR-0009). Hier kan dat niet gebeuren.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Paden ──────────────────────────────────────────────────────────────────

const projectenPad = (uid: string) => collection(db, "users", uid, "projects");
const projectPad = (uid: string, projectId: string) => doc(db, "users", uid, "projects", projectId);
const subPad = (uid: string, projectId: string, naam: string) =>
  collection(db, "users", uid, "projects", projectId, naam);

// ── Project ────────────────────────────────────────────────────────────────

/** Velden die de gebruiker zelf invult. De rest zet deze laag. */
export type NieuwProject = Omit<ProjectData, "aangemaaktOp" | "bijgewerktOp">;

/**
 * Zelfde velden, maar `undefined` is hier een geldige waarde.
 *
 * Nodig omdat `exactOptionalPropertyTypes` aan staat: een formulier met een
 * leeggemaakt veld levert `undefined` op, en dat mag je dan niet zomaar aan een
 * optioneel veld toewijzen. De converter gooit ze er alsnog uit vóór Firestore
 * ze te zien krijgt.
 */
export type ProjectInvoer = { [K in keyof NieuwProject]?: NieuwProject[K] | undefined };

/**
 * Maakt een project aan en geeft het id terug.
 *
 * `aangemaaktOp` gaat als `serverTimestamp()` mee en wordt daarom niet door de
 * converter gehaald — die maakt er een `Timestamp` van, en dat is precies wat
 * de rules hier níét accepteren.
 */
export async function maakProject(
  uid: string,
  gegevens: ProjectInvoer & { naam: string },
): Promise<string> {
  const nieuweRef = doc(projectenPad(uid));
  const batch = writeBatch(db);
  batch.set(nieuweRef, {
    ...projectNaarFirestore(gegevens),
    aangemaaktOp: serverTimestamp(),
  });
  await batch.commit();
  return nieuweRef.id;
}

/**
 * Het project waar de gebruiker aan werkt.
 *
 * Er is er voorlopig één per gebruiker (PROJECT.md §9: niet beginnen met
 * multi-project). Het oudste wint, zodat een per ongeluk dubbel aangemaakt
 * project niet ineens het actieve wordt. `null` betekent: nog niets aangemaakt,
 * stuur de gebruiker naar de wizard.
 */
export async function haalActiefProject(uid: string): Promise<ProjectMetId | null> {
  const resultaat = await getDocs(query(projectenPad(uid), orderBy("aangemaaktOp"), limit(1)));
  const eerste = resultaat.docs[0];
  return eerste ? projectUitFirestore(eerste.id, eerste.data()) : null;
}

export async function haalProject(uid: string, projectId: string): Promise<ProjectMetId | null> {
  const snapshot = await getDoc(projectPad(uid, projectId));
  return snapshot.exists() ? projectUitFirestore(snapshot.id, snapshot.data()) : null;
}

/** Wijzigt bestaande velden. Velden die je niet meestuurt blijven staan. */
export async function werkProjectBij(
  uid: string,
  projectId: string,
  wijzigingen: ProjectInvoer,
): Promise<void> {
  await updateDoc(projectPad(uid, projectId), {
    ...projectNaarFirestore(wijzigingen),
    bijgewerktOp: serverTimestamp(),
  });
}

// ── Ankers ─────────────────────────────────────────────────────────────────

export async function haalAnkers(uid: string, projectId: string): Promise<AnkerMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "ankers"));
  return resultaat.docs.map((d) => ankerUitFirestore(d.id, d.data()));
}

export async function voegAnkerToe(
  uid: string,
  projectId: string,
  anker: AnkerData,
): Promise<string> {
  const ref = doc(subPad(uid, projectId, "ankers"));
  const batch = writeBatch(db);
  batch.set(ref, ankerNaarFirestore(anker));
  await batch.commit();
  return ref.id;
}

export async function werkAnkerBij(
  uid: string,
  projectId: string,
  ankerId: string,
  wijzigingen: Partial<AnkerData>,
): Promise<void> {
  await updateDoc(
    doc(db, "users", uid, "projects", projectId, "ankers", ankerId),
    ankerNaarFirestore(wijzigingen),
  );
}

// ── Betrokkenen ────────────────────────────────────────────────────────────

export async function haalBetrokkenen(uid: string, projectId: string): Promise<BetrokkeneMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "betrokkenen"));
  return resultaat.docs
    .map((d) => betrokkeneUitFirestore(d.id, d.data()))
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

/**
 * Wijzigt een betrokkene en zet `waardenBron` mee op "eigen" zodra de
 * gebruiker een van de twee termijnen aanpast. Zie ADR-0009.
 */
export async function werkBetrokkeneBij(
  uid: string,
  projectId: string,
  betrokkene: BetrokkeneMetId,
  wijzigingen: Partial<BetrokkeneData>,
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "projects", projectId, "betrokkenen", betrokkene.id), {
    ...betrokkeneNaarFirestore(wijzigingen),
    waardenBron: bepaalWaardenBron(betrokkene, wijzigingen),
  });
}

// ── Afspraken ──────────────────────────────────────────────────────────────

export async function haalAfspraken(uid: string, projectId: string): Promise<AfspraakMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "afspraken"));
  return resultaat.docs.map((d) => afspraakUitFirestore(d.id, d.data()));
}

export async function werkAfspraakBij(
  uid: string,
  projectId: string,
  afspraakId: string,
  wijzigingen: Partial<AfspraakData>,
): Promise<void> {
  await updateDoc(
    doc(db, "users", uid, "projects", projectId, "afspraken", afspraakId),
    afspraakNaarFirestore(wijzigingen),
  );
}

// ── De standaardbibliotheek uitrollen ──────────────────────────────────────

/**
 * Zet een betrokkene uit de bibliotheek om naar op te slaan data.
 * `waardenBron` staat op "voorstel": de cijfers zijn schattingen van de app
 * totdat de gebruiker ze bevestigt of aanpast.
 */
function uitBibliotheek(standaard: StandaardBetrokkene): DocumentData {
  return betrokkeneNaarFirestore({
    naam: standaard.naam,
    categorie: standaard.categorie,
    aanlooptijdDagen: standaard.aanlooptijdDagen,
    annuleertermijnDagen: standaard.annuleertermijnDagen,
    communicatieregel: standaard.communicatieregel,
    waardenBron: "voorstel",
  });
}

/**
 * Maakt de aangevinkte standaardpartijen aan, mét hun afspraken.
 *
 * In één batch, om twee redenen: het is één handeling voor de gebruiker, en de
 * afspraken verwijzen naar de betrokkene-id's. Die id's worden client-side
 * gegenereerd met `doc(collectie)` vóórdat er iets naar de server gaat — anders
 * zou je moeten wachten op elke afzonderlijke write om het id te weten.
 *
 * Een batch is atomair: alles lukt, of niets. Geen half ingevulde projecten.
 * De limiet is 500 bewerkingen; met 38 partijen à hooguit twee afspraken zit je
 * daar ruim onder.
 */
export async function voegStandaardBetrokkenenToe(
  uid: string,
  projectId: string,
  sleutels: readonly string[],
): Promise<number> {
  const gekozen = STANDAARD_BETROKKENEN.filter((b) => sleutels.includes(b.sleutel));
  if (gekozen.length === 0) return 0;

  const batch = writeBatch(db);
  const betrokkenenRef = subPad(uid, projectId, "betrokkenen");
  const afsprakenRef = subPad(uid, projectId, "afspraken");

  for (const standaard of gekozen) {
    const betrokkeneRef = doc(betrokkenenRef);
    batch.set(betrokkeneRef, uitBibliotheek(standaard));

    for (const afspraak of standaard.afspraken) {
      batch.set(
        doc(afsprakenRef),
        afspraakNaarFirestore({
          betrokkeneId: betrokkeneRef.id,
          omschrijving: afspraak.omschrijving,
          ankerType: afspraak.ankerType,
          offsetDagen: afspraak.offsetDagen,
          status: "concept",
          ...(afspraak.waarschuwing !== undefined ? { waarschuwing: afspraak.waarschuwing } : {}),
        }),
      );
    }
  }

  await batch.commit();
  return gekozen.length;
}
