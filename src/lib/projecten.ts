import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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
  faseNaarFirestore,
  faseUitFirestore,
  gebrekNaarFirestore,
  gebrekUitFirestore,
  meerwerkNaarFirestore,
  meerwerkUitFirestore,
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

/**
 * Zet de woning van in aanbouw naar opgeleverd, of terug (ADR-0010 §1).
 *
 * Een eigen functie en geen `werkProjectBij({ woningStatus })`, omdat dit de
 * omslag van de hele app is: het dashboard wisselt van inhoud. Als dat ooit
 * meer moet doen — een anker zetten, een e-mail sturen — dan gebeurt dat hier
 * en niet op vijf plekken in de UI.
 *
 * Terugzetten naar `in_aanbouw` mag bewust: een oplevering kan mislukken.
 */
export async function zetWoningStatus(
  uid: string,
  projectId: string,
  status: WoningStatus,
): Promise<void> {
  await werkProjectBij(uid, projectId, { woningStatus: status });
}

/**
 * Schrijft het woningpaspoort weg.
 *
 * LET OP — DIT VERVANGT DE HELE MAP, NIET VELD VOOR VELD.
 * `updateDoc` met een map als waarde overschrijft die map integraal; alleen
 * met dot-notation (`"woningpaspoort.adres"`) werk je één veld bij. Dat is
 * hier precies goed: het formulier stuurt het complete paspoort mee, en
 * `paspoortNaarFirestore()` strip de lege velden. Zo kan een veld wél
 * leeggemaakt worden — bij een gewone `updateDoc` op losse velden zou dat niet
 * lukken, want `zonderLegeVelden()` haalt `undefined` eruit.
 *
 * Gevolg voor wie dit aanroept: **stuur altijd het hele paspoort mee.** Een
 * halve map betekent dat de rest verdwijnt.
 */
export async function werkWoningpaspoortBij(
  uid: string,
  projectId: string,
  paspoort: WoningpaspoortData,
): Promise<void> {
  await werkProjectBij(uid, projectId, { woningpaspoort: paspoort });
}

/**
 * Alle subcollecties onder een project. Komt er een collectie bij, dan hoort hij
 * hier ook bij — anders blijft er data achter die nergens meer bereikbaar is.
 */
const SUBCOLLECTIES = [
  "ankers",
  "betrokkenen",
  "afspraken",
  "phases",
  "tasks",
  "meerwerk",
  "termijnen",
  "gebreken",
  "nabudget",
  "onderdelen",
  "onderhoudstaken",
  "onderhoudslogboek",
] as const;

/**
 * Verwijdert een project en alles wat eronder hangt. Geeft terug hoeveel
 * onderliggende documenten zijn opgeruimd.
 *
 * TWEE DINGEN OM TE WETEN
 *
 * 1. **Dit is niet atomair.** Firestore kent geen recursieve delete vanuit de
 *    client; het gaat per collectie in batches. Valt de verbinding halverwege
 *    weg, dan is een deel weg en een deel niet. Daarom gaat het projectdocument
 *    als **laatste** — zolang dat er nog staat, vindt de app het project terug
 *    en kan de gebruiker het opnieuw proberen. Andersom zou hij achterblijven
 *    met onbereikbare data.
 * 2. Een batch mag 500 bewerkingen. Met 38 partijen en hun afspraken zit je daar
 *    ruim onder, maar de opdeling staat er zodat dat zo blijft.
 */
export async function verwijderProject(uid: string, projectId: string): Promise<number> {
  let verwijderd = 0;

  for (const naam of SUBCOLLECTIES) {
    const resultaat = await getDocs(subPad(uid, projectId, naam));
    for (let i = 0; i < resultaat.docs.length; i += 400) {
      const groep = resultaat.docs.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const d of groep) batch.delete(d.ref);
      await batch.commit();
      verwijderd += groep.length;
    }
  }

  await deleteDoc(projectPad(uid, projectId));
  return verwijderd;
}

// ── Ankers ─────────────────────────────────────────────────────────────────

/**
 * Alle bouwmomenten, met hooguit één per type.
 *
 * Het model gaat uit van één anker per bouwmoment — `berekenDatum()` pakt de
 * eerste die hij vindt. Structureel is dat niet afgedwongen: twee tabbladen die
 * tegelijk hetzelfde anker aanmaken leveren twee documenten op, en dan rekent de
 * app met het ene terwijl het scherm het andere bewerkt.
 *
 * Hier wordt dat afgevangen bij het lezen: de eerste wint, de rest wordt
 * genegeerd. Zo is het gedrag in ieder geval overal hetzelfde. Een echte
 * garantie zou het document-id gelijkstellen aan het ankertype; dat is een
 * migratie waard zodra er productiedata is.
 */
export async function haalAnkers(uid: string, projectId: string): Promise<AnkerMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "ankers"));
  const gezien = new Set<string>();
  const ankers: AnkerMetId[] = [];

  for (const d of resultaat.docs) {
    const anker = ankerUitFirestore(d.id, d.data());
    if (gezien.has(anker.type)) continue;
    gezien.add(anker.type);
    ankers.push(anker);
  }

  return ankers;
}

/**
 * Schrijft een anker volledig weg: aanmaken als `ankerId` null is, anders
 * overschrijven. Geeft het id terug.
 *
 * WAAROM HIER WÉL `setDoc` EN NIET `updateDoc`.
 * `zonderLegeVelden()` gooit `undefined` eruit voordat Firestore het ziet — dat
 * moet, want Firestore weigert `undefined`. Gevolg bij een `updateDoc`: een
 * veld dat de gebruiker leegmaakt (de bron wissen) blijft gewoon staan, want er
 * wordt niets over verstuurd. Een volledige overschrijving heeft dat probleem
 * niet: wat niet meegestuurd wordt, is er daarna ook niet meer.
 *
 * Dat kan hier veilig, omdat het anker geen `aangemaaktOp` kent. Bij projecten
 * mag dit juist níét — daar eist de rule dat `aangemaaktOp` onveranderd blijft,
 * en die zou een overschrijving wissen.
 */
export async function zetAnker(
  uid: string,
  projectId: string,
  ankerId: string | null,
  anker: AnkerData,
): Promise<string> {
  // Geen id meegekregen, maar er bestaat al een anker van dit type? Dan is dat
  // het anker dat de gebruiker bedoelt. Zonder deze check ontstaat er een
  // tweede document waar `haalAnkers()` vervolgens overheen leest — en dan
  // bewerkt het scherm iets anders dan de rekenkern gebruikt.
  const doel = ankerId ?? (await vindAnkerIdVanType(uid, projectId, anker.type));

  const ref =
    doel === null
      ? doc(subPad(uid, projectId, "ankers"))
      : doc(db, "users", uid, "projects", projectId, "ankers", doel);
  await setDoc(ref, ankerNaarFirestore(anker));
  return ref.id;
}

async function vindAnkerIdVanType(
  uid: string,
  projectId: string,
  type: AnkerData["type"],
): Promise<string | null> {
  const resultaat = await getDocs(
    query(subPad(uid, projectId, "ankers"), where("type", "==", type), limit(1)),
  );
  return resultaat.docs[0]?.id ?? null;
}

/**
 * Verwijdert een bouwmoment.
 *
 * Wordt gebruikt als de gebruiker de datum leegmaakt: een anker zonder datum
 * telt in `berekenDatum()` toch niet mee, dus een leeg anker laten staan zou
 * alleen maar suggereren dat er iets bekend is. De afspraken die eraan hingen
 * blijven bestaan en vallen terug op de oplevering, met
 * `zekerheid: "teruggevallen"` (ADR-0009).
 */
export async function verwijderAnker(
  uid: string,
  projectId: string,
  ankerId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "ankers", ankerId));
}

// ── Betrokkenen ────────────────────────────────────────────────────────────

export async function haalBetrokkenen(uid: string, projectId: string): Promise<BetrokkeneMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "betrokkenen"));
  return resultaat.docs
    .map((d) => betrokkeneUitFirestore(d.id, d.data()))
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

/**
 * Schrijft een betrokkene volledig weg: aanmaken als `bestaand` null is, anders
 * overschrijven.
 *
 * `waardenBron` wordt hier bepaald en komt bewust niet uit het formulier — dat
 * is de eis uit ADR-0009. Twee gevallen:
 *
 * - **Nieuw:** `"eigen"`. Iemand die zelf een partij toevoegt, tikt zijn eigen
 *   termijnen in. Die als voorstel van de app labelen zou onzin zijn.
 * - **Bestaand:** `bepaalWaardenBron()` beslist. Eenmaal "eigen" blijft "eigen".
 */
export async function zetBetrokkene(
  uid: string,
  projectId: string,
  bestaand: BetrokkeneMetId | null,
  gegevens: Omit<BetrokkeneData, "waardenBron">,
): Promise<string> {
  const ref =
    bestaand === null
      ? doc(subPad(uid, projectId, "betrokkenen"))
      : doc(db, "users", uid, "projects", projectId, "betrokkenen", bestaand.id);

  await setDoc(ref, {
    ...betrokkeneNaarFirestore(gegevens),
    waardenBron: bestaand === null ? "eigen" : bepaalWaardenBron(bestaand, gegevens),
  });
  return ref.id;
}

/**
 * Verwijdert een betrokkene **en al zijn afspraken**, in één batch.
 *
 * De cascade is geen gemak maar een noodzaak. Een afspraak zonder betrokkene
 * wordt door `bouwActielijst()` overgeslagen (die zoekt de partij op en gaat
 * verder als hij hem niet vindt) en verschijnt op `/afspraken` evenmin, want
 * daar staat alles per partij gegroepeerd. Het document zou dus blijven bestaan
 * zonder dat het ergens te zien of te verwijderen is.
 *
 * Een batch is atomair: alle afspraken en de partij verdwijnen samen, of er
 * verdwijnt niets. De limiet van 500 bewerkingen is hier geen risico.
 */
export async function verwijderBetrokkene(
  uid: string,
  projectId: string,
  betrokkeneId: string,
): Promise<number> {
  const afspraken = await getDocs(
    query(subPad(uid, projectId, "afspraken"), where("betrokkeneId", "==", betrokkeneId)),
  );

  const batch = writeBatch(db);
  for (const afspraak of afspraken.docs) {
    batch.delete(afspraak.ref);
  }
  batch.delete(doc(db, "users", uid, "projects", projectId, "betrokkenen", betrokkeneId));
  await batch.commit();

  return afspraken.size;
}

// ── Afspraken ──────────────────────────────────────────────────────────────

export async function haalAfspraken(uid: string, projectId: string): Promise<AfspraakMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "afspraken"));
  return resultaat.docs.map((d) => afspraakUitFirestore(d.id, d.data()));
}

/**
 * Wijzigt losse velden. Gebruik dit als je precies weet welke velden je aanraakt —
 * bijvoorbeeld de doorgegeven-knop, die alleen `gecommuniceerdeDatum` schrijft.
 *
 * Wil je een veld léégmaken, dan werkt dit niet: `zonderLegeVelden()` haalt
 * `undefined` eruit voordat Firestore het ziet, dus er wordt niets over
 * verstuurd en de oude waarde blijft staan. Gebruik dan `zetAfspraak`.
 */
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

/**
 * Schrijft een afspraak volledig weg: aanmaken als `afspraakId` null is, anders
 * overschrijven. Nodig voor het bewerkformulier, waar een leeggemaakte
 * waarschuwing of notitie ook echt weg moet.
 *
 * ⚠️ LET OP: DIT IS EEN VOLLEDIGE OVERSCHRIJVING.
 * Wat je niet meestuurt, is daarna weg — inclusief `gecommuniceerdeDatum` en
 * `gecommuniceerdOp`. Die twee dragen de kern van ADR-0008 (wat weet die partij
 * nu), dus de aanroeper moet ze expliciet meenemen. In de praktijk: bouw het
 * object op uit de bestaande afspraak plus je wijzigingen, niet uit alleen de
 * formuliervelden.
 *
 * Dit mag hier omdat een afspraak geen `aangemaaktOp` kent. Bij projecten mag
 * het niet: daar eist de rule dat dat veld onveranderd blijft.
 */
export async function zetAfspraak(
  uid: string,
  projectId: string,
  afspraakId: string | null,
  afspraak: AfspraakData,
): Promise<string> {
  const ref =
    afspraakId === null
      ? doc(subPad(uid, projectId, "afspraken"))
      : doc(db, "users", uid, "projects", projectId, "afspraken", afspraakId);
  await setDoc(ref, afspraakNaarFirestore(afspraak));
  return ref.id;
}

export async function verwijderAfspraak(
  uid: string,
  projectId: string,
  afspraakId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "afspraken", afspraakId));
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

// ── Fases ──────────────────────────────────────────────────────────────────

/**
 * De zeven fases, chronologisch. Sorteren gebeurt op `volgorde`; een fase
 * zonder dat veld belandt achteraan in plaats van willekeurig ertussen.
 */
export async function haalFases(uid: string, projectId: string): Promise<FaseMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "phases"));
  return resultaat.docs
    .map((d) => faseUitFirestore(d.id, d.data()))
    .sort((a, b) => (a.volgorde ?? 99) - (b.volgorde ?? 99));
}

/**
 * Schrijft een fase volledig weg. Net als bij ankers mag dat met `setDoc`: een
 * fase kent geen `aangemaaktOp`, en een leeggemaakte streefdatum moet ook echt
 * verdwijnen.
 */
export async function zetFase(
  uid: string,
  projectId: string,
  faseId: string | null,
  fase: FaseData,
): Promise<string> {
  const ref =
    faseId === null
      ? doc(subPad(uid, projectId, "phases"))
      : doc(db, "users", uid, "projects", projectId, "phases", faseId);
  await setDoc(ref, faseNaarFirestore(fase));
  return ref.id;
}

/**
 * Maakt de zeven fases in één batch aan, in de vaste volgorde.
 *
 * Doet niets als er al fases zijn. Dat is geen beleefdheid maar noodzaak: dit
 * wordt aangeroepen zodra het tijdlijnscherm opent, en zonder die check zou elk
 * bezoek zeven nieuwe documenten opleveren.
 */
export async function zorgVoorFases(
  uid: string,
  projectId: string,
  fases: readonly FaseData[],
): Promise<boolean> {
  const bestaand = await getDocs(query(subPad(uid, projectId, "phases"), limit(1)));
  if (!bestaand.empty) return false;

  const batch = writeBatch(db);
  const pad = subPad(uid, projectId, "phases");
  for (const fase of fases) {
    batch.set(doc(pad), faseNaarFirestore(fase));
  }
  await batch.commit();
  return true;
}

// ── Taken ──────────────────────────────────────────────────────────────────

export async function haalTaken(uid: string, projectId: string): Promise<TaakMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "tasks"));
  return resultaat.docs.map((d) => taakUitFirestore(d.id, d.data()));
}

/** Aanmaken als `taakId` null is, anders volledig overschrijven. */
export async function zetTaak(
  uid: string,
  projectId: string,
  taakId: string | null,
  taak: TaakData,
): Promise<string> {
  const ref =
    taakId === null
      ? doc(subPad(uid, projectId, "tasks"))
      : doc(db, "users", uid, "projects", projectId, "tasks", taakId);
  await setDoc(ref, taakNaarFirestore(taak));
  return ref.id;
}

export async function verwijderTaak(
  uid: string,
  projectId: string,
  taakId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "tasks", taakId));
}

// ── Meerwerk ───────────────────────────────────────────────────────────────

export async function haalMeerwerk(uid: string, projectId: string): Promise<MeerwerkMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "meerwerk"));
  return resultaat.docs.map((d) => meerwerkUitFirestore(d.id, d.data()));
}

/**
 * Aanmaken als `itemId` null is, anders volledig overschrijven.
 *
 * Overschrijven is hier belangrijker dan elders: bij het wisselen van
 * `vaste_datum` naar `bouwmoment` moet het oude datumveld écht verdwijnen. Met
 * een `updateDoc` blijft het staan, want `zonderLegeVelden()` stuurt `undefined`
 * niet mee — en dan staan er twee deadlines in één document (ADR-0011).
 */
export async function zetMeerwerk(
  uid: string,
  projectId: string,
  itemId: string | null,
  item: MeerwerkData,
): Promise<string> {
  const ref =
    itemId === null
      ? doc(subPad(uid, projectId, "meerwerk"))
      : doc(db, "users", uid, "projects", projectId, "meerwerk", itemId);
  await setDoc(ref, meerwerkNaarFirestore(item));
  return ref.id;
}

export async function verwijderMeerwerk(
  uid: string,
  projectId: string,
  itemId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "meerwerk", itemId));
}

// ── Termijnen (bouwdepot) ──────────────────────────────────────────────────

export async function haalTermijnen(uid: string, projectId: string): Promise<TermijnMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "termijnen"));
  return resultaat.docs.map((d) => termijnUitFirestore(d.id, d.data()));
}

/**
 * Aanmaken als `termijnId` null is, anders volledig overschrijven.
 *
 * Overschrijven is hier nodig omdat een vinkje uitzetten óók de bijbehorende
 * datum moet wissen: `zonderLegeVelden()` stuurt `undefined` niet mee, dus met
 * een `updateDoc` zou er een betaaldatum blijven staan bij een termijn die
 * volgens de app niet betaald is.
 */
export async function zetTermijn(
  uid: string,
  projectId: string,
  termijnId: string | null,
  termijn: TermijnData,
): Promise<string> {
  const ref =
    termijnId === null
      ? doc(subPad(uid, projectId, "termijnen"))
      : doc(db, "users", uid, "projects", projectId, "termijnen", termijnId);
  await setDoc(ref, termijnNaarFirestore(termijn));
  return ref.id;
}

export async function verwijderTermijn(
  uid: string,
  projectId: string,
  termijnId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "termijnen", termijnId));
}

// ── Gebreken (opleverpunten) ───────────────────────────────────────────────

export async function haalGebreken(uid: string, projectId: string): Promise<GebrekMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "gebreken"));
  return resultaat.docs.map((d) => gebrekUitFirestore(d.id, d.data()));
}

/**
 * Aanmaken als `gebrekId` null is, anders volledig overschrijven.
 *
 * Overschrijven, zodat een gewiste hersteltermijn ook echt verdwijnt. Een
 * termijn die blijft staan bij een punt zonder afspraak suggereert dat de
 * aannemer ergens aan gehouden is.
 */
export async function zetGebrek(
  uid: string,
  projectId: string,
  gebrekId: string | null,
  gebrek: GebrekData,
): Promise<string> {
  const ref =
    gebrekId === null
      ? doc(subPad(uid, projectId, "gebreken"))
      : doc(db, "users", uid, "projects", projectId, "gebreken", gebrekId);
  await setDoc(ref, gebrekNaarFirestore(gebrek));
  return ref.id;
}

export async function verwijderGebrek(
  uid: string,
  projectId: string,
  gebrekId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "gebreken", gebrekId));
}

// ── Nabudget ───────────────────────────────────────────────────────────────

export async function haalNabudget(uid: string, projectId: string): Promise<NabudgetMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "nabudget"));
  return resultaat.docs.map((d) => nabudgetUitFirestore(d.id, d.data()));
}

/** Aanmaken als `postId` null is, anders volledig overschrijven. */
export async function zetNabudget(
  uid: string,
  projectId: string,
  postId: string | null,
  post: NabudgetData,
): Promise<string> {
  const ref =
    postId === null
      ? doc(subPad(uid, projectId, "nabudget"))
      : doc(db, "users", uid, "projects", projectId, "nabudget", postId);
  await setDoc(ref, nabudgetNaarFirestore(post));
  return ref.id;
}

export async function verwijderNabudget(
  uid: string,
  projectId: string,
  postId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "nabudget", postId));
}

/**
 * Zet de aangevinkte standaardposten in één batch klaar, zonder bedrag.
 *
 * Bewust zonder richtbedragen: de spreiding per post is enorm (laminaat of
 * gietvloer, zelf leggen of laten leggen) en een verzonnen getal blijft als
 * anker in je hoofd hangen. Zie `src/data/nabudget-standaard.ts`.
 */
export async function voegStandaardNabudgetToe(
  uid: string,
  projectId: string,
  omschrijvingen: readonly string[],
): Promise<number> {
  if (omschrijvingen.length === 0) return 0;

  const batch = writeBatch(db);
  const pad = subPad(uid, projectId, "nabudget");
  for (const omschrijving of omschrijvingen) {
    batch.set(doc(pad), nabudgetNaarFirestore({ omschrijving, status: "geraamd" }));
  }
  await batch.commit();
  return omschrijvingen.length;
}

// ── Onderdelen — het register van wat er in de woning zit (ADR-0013) ───────

export async function haalOnderdelen(uid: string, projectId: string): Promise<OnderdeelMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "onderdelen"));
  return resultaat.docs.map((d) => onderdeelUitFirestore(d.id, d.data()));
}

/**
 * Aanmaken als `onderdeelId` null is, anders volledig overschrijven.
 *
 * Overschrijven en niet bijwerken, om dezelfde reden als bij gebreken en
 * termijnen: `zonderLegeVelden()` strip `undefined`, dus een `updateDoc` kan
 * een veld niet leegmaken. Bij een onderdeel is dat extra vervelend — een
 * serienummer of een specwaarde die blijft hangen na correctie is precies het
 * getal dat je bij een storing verkeerd doorgeeft.
 *
 * LET OP: `specs` en `registratieplicht` zijn geneste maps en worden dus
 * integraal vervangen. Stuur ze altijd compleet mee.
 */
export async function zetOnderdeel(
  uid: string,
  projectId: string,
  onderdeelId: string | null,
  onderdeel: OnderdeelData,
): Promise<string> {
  const ref =
    onderdeelId === null
      ? doc(subPad(uid, projectId, "onderdelen"))
      : doc(db, "users", uid, "projects", projectId, "onderdelen", onderdeelId);
  await setDoc(ref, onderdeelNaarFirestore(onderdeel));
  return ref.id;
}

export async function verwijderOnderdeel(
  uid: string,
  projectId: string,
  onderdeelId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "onderdelen", onderdeelId));
}

/**
 * Legt vast dat een registratieplicht is afgehandeld.
 *
 * Eigen functie omdat dit het equivalent is van de doorgegeven-knop op de
 * actielijst: het schrijft het feit dat de buitenwereld op de hoogte is, en
 * daarmee verdwijnt de regel. Het hele onderdeel gaat mee, want de map wordt
 * integraal vervangen.
 */
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
  uid: string,
  projectId: string,
): Promise<OnderhoudTaakMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "onderhoudstaken"));
  return resultaat.docs.map((d) => onderhoudTaakUitFirestore(d.id, d.data()));
}

/**
 * Aanmaken als `taakId` null is, anders volledig overschrijven.
 *
 * Overschrijven om dezelfde reden als bij de andere collecties: een
 * `updateDoc` kan `voorkeursmaand` of `laatstUitgevoerdOp` niet wissen, want
 * `zonderLegeVelden()` strip `undefined`. Een voorkeursmaand die blijft hangen
 * na het uitzetten zou de reeks stil blijven verschuiven.
 */
export async function zetOnderhoudstaak(
  uid: string,
  projectId: string,
  taakId: string | null,
  taak: OnderhoudTaakData,
): Promise<string> {
  const ref =
    taakId === null
      ? doc(subPad(uid, projectId, "onderhoudstaken"))
      : doc(db, "users", uid, "projects", projectId, "onderhoudstaken", taakId);
  await setDoc(ref, onderhoudTaakNaarFirestore(taak));
  return ref.id;
}

export async function verwijderOnderhoudstaak(
  uid: string,
  projectId: string,
  taakId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "onderhoudstaken", taakId));
}

/**
 * Vinkt een beurt af.
 *
 * DIT DOET TWEE DINGEN ATOMAIR (ADR-0014 §2):
 *   1. `laatstUitgevoerdOp` op de taak bijwerken — daarmee schuift de volgende
 *      beurt op;
 *   2. een logregel wegschrijven met wat er precies gebeurd is.
 *
 * Eén `writeBatch`, zodat er nooit een bijgewerkte taak zonder logregel kan
 * ontstaan. Zou stap 2 los mislukken, dan was de vorige beurt onherroepelijk
 * overschreven zonder dat er iets voor in de plaats kwam — en historie is niet
 * te reconstrueren.
 *
 * De taak gaat compleet mee omdat `setDoc` hem overschrijft; een half object
 * zou de rest wissen.
 */
export async function vinkOnderhoudAf(
  uid: string,
  projectId: string,
  taak: OnderhoudTaakMetId,
  uitgevoerdOp: Date,
  extra: { doorWie?: string; kosten?: number; notitie?: string } = {},
): Promise<void> {
  const batch = writeBatch(db);

  const { id, ...rest } = taak;
  batch.set(
    doc(db, "users", uid, "projects", projectId, "onderhoudstaken", id),
    onderhoudTaakNaarFirestore({ ...rest, laatstUitgevoerdOp: uitgevoerdOp }),
  );

  batch.set(
    doc(subPad(uid, projectId, "onderhoudslogboek")),
    onderhoudLogregelNaarFirestore({
      taakId: id,
      ...(taak.onderdeelId ? { onderdeelId: taak.onderdeelId } : {}),
      uitgevoerdOp,
      ...(extra.doorWie ? { doorWie: extra.doorWie } : {}),
      ...(extra.kosten === undefined ? {} : { kosten: extra.kosten }),
      ...(extra.notitie ? { notitie: extra.notitie } : {}),
    }),
  );

  await batch.commit();
}

export async function haalOnderhoudslogboek(
  uid: string,
  projectId: string,
): Promise<OnderhoudLogregelMetId[]> {
  const resultaat = await getDocs(subPad(uid, projectId, "onderhoudslogboek"));
  return resultaat.docs
    .map((d) => onderhoudLogregelUitFirestore(d.id, d.data()))
    .sort((a, b) => b.uitgevoerdOp.getTime() - a.uitgevoerdOp.getTime());
}

/**
 * Corrigeert of verwijdert een logregel.
 *
 * `laatstUitgevoerdOp` op de taak wordt hier NIET bijgewerkt: dat zou betekenen
 * dat het verwijderen van een oude regel stilzwijgend de planning verschuift.
 * Wie een vergissing herstelt, past de taak apart aan — zichtbaar in plaats van
 * als bijwerking.
 */
export async function verwijderLogregel(
  uid: string,
  projectId: string,
  logId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "projects", projectId, "onderhoudslogboek", logId));
}

/**
 * Zet de aangevinkte standaardtaken in één batch klaar.
 *
 * `waardenBron` staat op `voorstel`: de intervallen komen uit de bibliotheek en
 * zijn schattingen (ADR-0009). Past de gebruiker er één aan, dan gaat dat veld
 * naar `eigen` — en dat gebeurt in deze laag, niet in een formulier.
 */
export async function voegStandaardOnderhoudToe(
  uid: string,
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

  const batch = writeBatch(db);
  for (const taak of taken) {
    batch.set(
      doc(subPad(uid, projectId, "onderhoudstaken")),
      onderhoudTaakNaarFirestore({ ...taak, waardenBron: "voorstel" }),
    );
  }
  await batch.commit();
  return taken.length;
}
