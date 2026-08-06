import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { Actielijst } from "@/components/Actielijst";
import { Kerncijfertegel } from "@/components/Kerncijfertegel";
import { Bouwvoortgangsbalk } from "@/components/Bouwvoortgangsbalk";
import { Voortgangsbalk } from "@/components/Voortgangsbalk";
import { toonAfstand, toonDatum, toonDatumMetAfstand, vandaag } from "@/lib/datum";
import { useAuth } from "@/context/useAuth";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import {
  haalActiefProject,
  haalAfspraken,
  haalAnkers,
  haalBetrokkenen,
  haalMeerwerk,
  haalMeters,
  haalMeterstanden,
  haalOnderdelen,
  haalOnderhoudstaken,
  haalTermijnen,
  maakGarantiecontrole,
  werkAfspraakBij,
} from "@/lib/projecten";
import { maakActielijst, telHandmatigeBetrokkenen } from "@/lib/actielijst";
import { type ActieRegel } from "@/lib/planning";
import {
  depotCijfer,
  maakBouwvoortgang,
  meerwerkCijfer,
  splitsOpAandacht,
} from "@/lib/dashboard";
import { toonBedrag } from "@/lib/bedrag";
import { telMeerwerk } from "@/lib/meerwerk";
import { telDepot } from "@/lib/depot";
import { adresregel, bepaalEnergielabelstand, isOpgeleverd } from "@/lib/woning";
import { telOpenstaandeRegistraties } from "@/lib/onderdelen";
import {
  dagenOverTijd,
  dagenTeGaan,
  garantiesZonderTaak,
  maakOnderhoudslijst,
} from "@/lib/onderhoud";
import { garantiecontroleVoor, type StandaardOnderhoud } from "@/data/onderhoud-standaard";
import { metersMetAchterstalligeOpname } from "@/lib/meterstanden";
import type {
  AfspraakMetId,
  AnkerMetId,
  BetrokkeneMetId,
  MeerwerkMetId,
  MeterMetId,
  MeterstandMetId,
  OnderdeelMetId,
  OnderhoudTaakMetId,
  ProjectMetId,
  TermijnMetId,
} from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Het dashboard — eerst waar je staat, dan wat er te doen is (ADR-0018)
 *
 * TOT 2 AUGUSTUS 2026 STOND DIT ANDERSOM. De actielijst opende het scherm,
 * want "dat verschil is het enige dat werk voor je oplevert" (ADR-0008,
 * principe 5). Dat klopt nog steeds, en tóch was het fout: wie het dashboard
 * opende zag een kop en dan meteen veertien kaarten werk, zonder ooit te zien
 * hoe het project ervoor stond. De reactie bij de live test was *"geen idee
 * hoe dit is opgebouwd"* en *"er is geen totaaloverzicht"* — over een scherm
 * dat een geldblok hééft, als zevende sectie onderaan.
 *
 * DE OPBOUW IS NU VIJF LAGEN, van beeld naar detail:
 *
 *   1. kop            waar gaat dit over, en wanneer krijg je de sleutel
 *   2. vier cijfers   hoe sta je ervoor — in één oogopslag
 *   3. grafieken      bouwvoortgang en geld
 *   4. wat er moet    urgent bovenaan, de rest achter een uitklap
 *   5. snel naar      de rest van de app
 *
 * DRIE REGELS DIE HIER GELDEN
 *
 * 1. **Rekenen gebeurt in `lib/dashboard.ts`**, niet in de render. De oude
 *    versie was 621 regels waarin acht secties elk hun eigen filter deden, en
 *    daar viel niets aan te testen.
 * 2. **"Niets ingevuld" is niet "nul".** Een leeg meerwerkbudget toont een
 *    streepje met een link, geen `€ 0` — dat las als een kapotte app.
 * 3. **Elke datum krijgt zijn afstand mee.** "28 okt 2026" zegt niets bij de
 *    veertiende regel; "over 12 weken — 28 okt 2026" wel.
 *
 * DE DOORGEGEVEN-KNOP IS GEEN AFVINKLIJSTJE. Hij schrijft
 * `gecommuniceerdeDatum`, en dat is het feit waar de hele module op draait.
 * Daarom staat hij nog steeds in de dichte regel en niet achter de uitklap.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const STATUSTEKST = {
  indicatief: "nog een schatting",
  bandbreedte: "tussen twee datums",
  aangezegd: "officieel aangezegd",
} as const;

/** Eén compacte aandachtsregel: wat, waar het over gaat, waar je heen gaat. */
interface Aandachtspunt {
  sleutel: string;
  titel: string;
  toelichting: string;
  naar: string;
  ernstig: boolean;
}

function Aandachtslijst({ punten }: { punten: readonly Aandachtspunt[] }) {
  return (
    <div className="flex flex-col gap-2">
      {punten.map((punt) => (
        <Link
          key={punt.sleutel}
          to={punt.naar}
          className={`brink-card flex flex-wrap items-baseline justify-between gap-2 p-s3 ${
            punt.ernstig ? "border border-clay/40" : ""
          }`}
        >
          <span className={`text-body font-semibold ${punt.ernstig ? "text-clay-deep" : "text-ink"}`}>
            {punt.titel}
          </span>
          <span className="text-sm text-slate">{punt.toelichting}</span>
        </Link>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { gebruiker } = useAuth();
  const navigeer = useNavigate();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [ankers, setAnkers] = useState<AnkerMetId[]>([]);
  const [betrokkenen, setBetrokkenen] = useState<BetrokkeneMetId[]>([]);
  const [afspraken, setAfspraken] = useState<AfspraakMetId[]>([]);
  const [meerwerk, setMeerwerk] = useState<MeerwerkMetId[]>([]);
  const [termijnen, setTermijnen] = useState<TermijnMetId[]>([]);
  const [onderdelen, setOnderdelen] = useState<OnderdeelMetId[]>([]);
  const [onderhoudstaken, setOnderhoudstaken] = useState<OnderhoudTaakMetId[]>([]);
  const [meters, setMeters] = useState<MeterMetId[]>([]);
  const [meteropnames, setMeteropnames] = useState<MeterstandMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [bezigMetId, setBezigMetId] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [toonAlles, setToonAlles] = useState(false);

  const [herlaadTeller, setHerlaadTeller] = useState(0);
  const herlaad = useCallback(() => {
    setHerlaadTeller((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let actueel = true;

    void (async () => {
      try {
        const gevonden = await haalActiefProject(uid);
        if (!actueel) return;

        if (!gevonden) {
          void navigeer("/project/nieuw", { replace: true });
          return;
        }

        const [
          geladenAnkers,
          geladenBetrokkenen,
          geladenAfspraken,
          geladenMeerwerk,
          geladenTermijnen,
          geladenOnderdelen,
          geladenOnderhoud,
          geladenMeters,
          geladenOpnames,
        ] = await Promise.all([
          haalAnkers(uid, gevonden.id),
          haalBetrokkenen(uid, gevonden.id),
          haalAfspraken(uid, gevonden.id),
          haalMeerwerk(uid, gevonden.id),
          haalTermijnen(uid, gevonden.id),
          haalOnderdelen(uid, gevonden.id),
          haalOnderhoudstaken(uid, gevonden.id),
          haalMeters(uid, gevonden.id),
          haalMeterstanden(uid, gevonden.id),
        ]);
        if (!actueel) return;

        setProject(gevonden);
        setAnkers(geladenAnkers);
        setBetrokkenen(geladenBetrokkenen);
        setAfspraken(geladenAfspraken);
        setMeerwerk(geladenMeerwerk);
        setTermijnen(geladenTermijnen);
        setOnderdelen(geladenOnderdelen);
        setOnderhoudstaken(geladenOnderhoud);
        setMeters(geladenMeters);
        setMeteropnames(geladenOpnames);
      } catch (f) {
        if (actueel) setFout(opslagFoutmelding(f, "Laden"));
      } finally {
        if (actueel) setBezigMetLaden(false);
      }
    })();

    return () => {
      actueel = false;
    };
  }, [uid, navigeer, herlaadTeller]);

  /**
   * Legt vast dat deze partij de berekende datum van je heeft gehoord.
   *
   * Een afspraak die nog `concept` was gaat mee naar `voorlopig`: hij is nu
   * naar buiten gebracht, maar de datum is nog niet hard. Een afspraak die al
   * `bevestigd` is blijft dat — iets doorgeven is geen stap terug.
   */
  async function markeerDoorgegeven(regel: ActieRegel) {
    if (!uid || !project) return;

    const afspraak = afspraken.find((a) => a.id === regel.afspraakId);
    setBezigMetId(regel.afspraakId);
    setFout(null);
    try {
      await werkAfspraakBij(uid, project.id, regel.afspraakId, {
        gecommuniceerdeDatum: regel.berekend.verwacht,
        // BUG-02: een datum hoort hier op middernacht te staan, net als overal
        // elders. Met een kaal `new Date()` zit de kloktijd erin, en dan is deze
        // waarde nooit `===` aan een datum uit een `<input type="date">`.
        // `vandaag()` pakt bovendien de lókale dag — zie BUG-03.
        gecommuniceerdOp: vandaag(),
        ...(afspraak?.status === "concept" ? { status: "voorlopig" as const } : {}),
      });
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Het doorgeven vastleggen"));
    } finally {
      setBezigMetId(null);
    }
  }

  /**
   * Maakt een onderhoudstaak aan vanuit een aflopende garantie (blok E4).
   *
   * De taak wordt gekoppeld aan het onderdeel — dat is wat de garantiedeadline
   * laat werken. Zonder `onderdeelId` weet de rekenkern niet welke garantie
   * erbij hoort en blijft de taak gewoon op zijn interval staan.
   */
  async function plancontrole(onderdeelId: string, voorstel: StandaardOnderhoud) {
    if (!uid || !project) return;

    setBezigMetId(onderdeelId);
    setFout(null);
    try {
      await maakGarantiecontrole(uid, project.id, onderdeelId, {
        titel: voorstel.titel,
        omschrijving: voorstel.omschrijving,
        intervalDagen: voorstel.intervalDagen,
        ...(voorstel.waarschuwing ? { waarschuwing: voorstel.waarschuwing } : {}),
      });
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "De taak aanmaken"));
    } finally {
      setBezigMetId(null);
    }
  }

  if (!uid || bezigMetLaden) return <Laadscherm />;

  if (fout && !project) {
    return (
      <AppShell>
        <div className="max-w-xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      </AppShell>
    );
  }

  if (!project) return <Laadscherm />;

  const nu = vandaag();
  const opgeleverd = isOpgeleverd(project);
  const adres = adresregel(project.woningpaspoort);

  const isBand =
    project.opleverStatus === "bandbreedte" &&
    project.opleverVroegst !== undefined &&
    project.opleverLaatst !== undefined &&
    project.opleverVroegst.getTime() !== project.opleverLaatst.getTime();

  // ── Alles wat het scherm nodig heeft, in één keer afgeleid ──────────────
  const regels = maakActielijst(project, ankers, betrokkenen, afspraken, nu);
  const aantalHandmatig = telHandmatigeBetrokkenen(betrokkenen);
  const voortgang = maakBouwvoortgang(ankers, nu);
  const meerwerkstand = telMeerwerk(meerwerk, project.meerwerkbudget);
  const depotstand = telDepot(termijnen);
  const labelstand = bepaalEnergielabelstand(project.woningpaspoort, nu);
  const zonderTaak = garantiesZonderTaak(onderdelen, onderhoudstaken, nu);
  const meterAchterstand = metersMetAchterstalligeOpname(meters, meteropnames, nu);
  const registratiesOpen = telOpenstaandeRegistraties(onderdelen);
  const onderhoudNu = maakOnderhoudslijst(
    onderhoudstaken,
    onderdelen,
    project.opleverVerwacht,
    nu,
  ).filter((r) => r.stand.urgentie !== "later");

  // De actielijst is gesorteerd op urgentie; de splitsing houdt die volgorde
  // aan binnen elke groep (ADR-0018).
  const gesplitst = splitsOpAandacht(
    regels.map((r) => ({ ...r, urgentie: r.urgentie, datum: r.berekend.verwacht })),
    nu,
  );
  const zichtbareRegels = toonAlles ? regels : gesplitst.nu;

  const meerwerkKern = meerwerkCijfer(meerwerkstand);
  const depotKern = depotCijfer(depotstand, project.bouwdepotBedrag);

  // ── De losse aandachtspunten, samengevoegd tot één lijst ────────────────
  // Stonden tot 2 augustus als vijf aparte secties met elk een eigen kop en
  // inleiding onder elkaar. Dat leest als vijf problemen in plaats van als
  // één lijstje werk.
  const aandachtspunten: Aandachtspunt[] = [];

  if (opgeleverd && labelstand?.verlopen) {
    aandachtspunten.push({
      sleutel: "energielabel",
      titel: "Het energielabel is verlopen",
      toelichting: `${toonDatum(labelstand.verlooptOp)} — blokkeert een verkoop`,
      naar: "/woning",
      ernstig: true,
    });
  }

  if (registratiesOpen > 0) {
    aandachtspunten.push({
      sleutel: "registraties",
      titel:
        registratiesOpen === 1
          ? "Eén onderdeel is nog niet aangemeld"
          : `${registratiesOpen} onderdelen zijn nog niet aangemeld`,
      toelichting: "bij de instantie die dat vereist",
      naar: "/onderdelen",
      ernstig: true,
    });
  }

  if (opgeleverd) {
    for (const { taak, stand, onderdeelNaam } of onderhoudNu) {
      aandachtspunten.push({
        sleutel: `onderhoud-${taak.id}`,
        titel: taak.titel,
        toelichting: `${
          stand.urgentie === "achterstallig"
            ? dagenOverTijd(stand.dagenResterend)
            : stand.dagenResterend === 0
              ? "vandaag"
              : dagenTeGaan(stand.dagenResterend)
        }${onderdeelNaam ? ` · ${onderdeelNaam}` : ""}`,
        naar: "/onderhoud",
        ernstig: stand.urgentie === "achterstallig",
      });
    }

    for (const overzicht of meterAchterstand) {
      aandachtspunten.push({
        sleutel: `meter-${overzicht.meter.id}`,
        titel: `${overzicht.naam} — geen verse meterstand`,
        toelichting:
          overzicht.laatste === undefined
            ? "nog nooit genoteerd"
            : `laatste ${toonAfstand(overzicht.laatste.opgenomenOp, nu)}`,
        naar: "/meterstanden",
        ernstig: false,
      });
    }
  }

  return (
    <AppShell>
      {/* ── 1. Kop ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">
          {opgeleverd ? "Woningdossier" : "Dashboard"}
        </span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">
        {opgeleverd ? (adres ?? project.naam) : project.naam}
      </h1>
      {opgeleverd ? (
        <p className="mt-1 text-body text-slate">De sleutels zijn overgedragen.</p>
      ) : (
        project.aannemer && <p className="mt-1 text-body text-slate">{project.aannemer}</p>
      )}

      {fout && (
        <div className="mt-s3 max-w-3xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}

      {/* ── 2. Vier cijfers ────────────────────────────────────────────── */}
      {!opgeleverd && (
        <div className="mt-s4 grid max-w-3xl gap-s2 sm:grid-cols-2 lg:grid-cols-4">
          <Kerncijfertegel
            label="Tot de oplevering"
            waarde={
              isBand
                ? toonAfstand(project.opleverVroegst, nu)
                : toonAfstand(project.opleverVerwacht, nu)
            }
            onder={
              isBand
                ? `tot ${toonDatum(project.opleverLaatst)}`
                : project.opleverStatus
                  ? `${toonDatum(project.opleverVerwacht)} · ${STATUSTEKST[project.opleverStatus]}`
                  : undefined
            }
            naar="/project"
            leeg={!project.opleverStatus}
            legeTekst="Opleverdatum invullen"
          />

          <Kerncijfertegel
            label="Vragen om een datum"
            waarde={String(regels.length)}
            onder={
              regels.length === 0
                ? "iedereen is bij"
                : `${gesplitst.nu.length} kan niet wachten`
            }
            alarm={gesplitst.nu.length > 0}
            naar="/afspraken"
          />

          <Kerncijfertegel
            label="Meerwerk"
            waarde={toonBedrag(meerwerkKern.waarde)}
            onder={meerwerkKern.van === undefined ? undefined : `van ${toonBedrag(meerwerkKern.van)}`}
            alarm={meerwerkKern.alarm}
            naar="/meerwerk"
            leeg={!meerwerkKern.ingevuld}
            legeTekst="Budget invullen"
          />

          <Kerncijfertegel
            label="Bouwdepot betaald"
            waarde={toonBedrag(depotKern.waarde)}
            onder={
              depotstand.aantalTeDeclareren > 0
                ? `${depotstand.aantalTeDeclareren} nog niet ingediend`
                : depotKern.van === undefined
                  ? undefined
                  : `van ${toonBedrag(depotKern.van)}`
            }
            alarm={depotKern.alarm}
            naar="/bouwdepot"
            leeg={!depotKern.ingevuld}
            legeTekst="Depot invullen"
          />
        </div>
      )}

      {/* ── 3. Twee grafieken ──────────────────────────────────────────── */}
      {!opgeleverd && (
        <div className="mt-s4 grid max-w-3xl gap-s2 sm:grid-cols-2">
          <section className="brink-card p-s3">
            <h2 className="text-h3 text-ink">Bouwvoortgang</h2>
            <div className="mt-s3">
              <Bouwvoortgangsbalk voortgang={voortgang} />
            </div>
            <div className="mt-s3">
              <Link to="/ankers">
                <Knop variant="secundair">Bouwmomenten invullen</Knop>
              </Link>
            </div>
          </section>

          <section className="brink-card p-s3">
            <h2 className="text-h3 text-ink">Geld</h2>
            <div className="mt-s3">
              <Voortgangsbalk
                segmenten={[
                  { label: "Depot betaald", waarde: depotstand.betaald, kleur: "bg-olive" },
                  {
                    label: "Wacht op de bank",
                    waarde: depotstand.wachtOpBank,
                    kleur: "bg-olive/40",
                  },
                  {
                    label: "Nog niet ingediend",
                    waarde: depotstand.teDeclareren,
                    kleur: "bg-clay",
                    toelichting: depotstand.teDeclareren > 0 ? "hier ben jij aan zet" : undefined,
                  },
                ]}
                toon={toonBedrag}
                {...(project.bouwdepotBedrag === undefined
                  ? {}
                  : { totaal: project.bouwdepotBedrag })}
                restLabel="Nog in depot"
              />
            </div>
            <p className="mt-s3 text-sm text-slate">
              Meerwerk vastgelegd: {toonBedrag(meerwerkstand.vastgelegd)}
              {meerwerkstand.budget !== undefined && ` van ${toonBedrag(meerwerkstand.budget)}`}
            </p>
            <div className="mt-s3 flex flex-wrap gap-s2">
              <Link to="/bouwdepot">
                <Knop variant="secundair">Bouwdepot</Knop>
              </Link>
              <Link to="/meerwerk">
                <Knop variant="secundair">Meerwerk</Knop>
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* ── 4a. Losse aandachtspunten ──────────────────────────────────── */}
      {aandachtspunten.length > 0 && (
        <section className="mt-s4 max-w-3xl">
          <h2 className="text-h3 text-ink">
            {aandachtspunten.length === 1
              ? "Eén ding vraagt aandacht"
              : `${aandachtspunten.length} dingen vragen aandacht`}
          </h2>
          <div className="mt-s3">
            <Aandachtslijst punten={aandachtspunten} />
          </div>
        </section>
      )}

      {/* ── 4b. Aflopende garanties zonder onderhoudstaak (blok E4) ────── */}
      {opgeleverd && zonderTaak.length > 0 && (
        <section className="mt-s4 max-w-3xl">
          <h2 className="text-h3 text-ink">
            {zonderTaak.length === 1
              ? "Eén garantie loopt af zonder geplande controle"
              : `${zonderTaak.length} garanties lopen af zonder geplande controle`}
          </h2>
          <p className="mt-s2 text-body text-slate">
            Laat het nakijken zolang de garantie loopt — daarna is een defect je eigen rekening.
          </p>

          <div className="mt-s3 flex flex-col gap-2">
            {zonderTaak.map(({ onderdeel, verlooptOp }) => {
              const voorstel = garantiecontroleVoor(onderdeel.naam);
              return (
                <div
                  key={onderdeel.id}
                  className="brink-card flex flex-wrap items-center justify-between gap-2 p-s3"
                >
                  <div>
                    <p className="text-body font-semibold text-ink">{onderdeel.naam}</p>
                    <p className="mt-1 text-sm text-slate">
                      Garantie tot {toonDatumMetAfstand(verlooptOp, nu)}
                    </p>
                  </div>

                  {voorstel ? (
                    <Knop
                      variant="secundair"
                      bezig={bezigMetId === onderdeel.id}
                      onClick={() => void plancontrole(onderdeel.id, voorstel)}
                    >
                      Onderhoud inplannen
                    </Knop>
                  ) : (
                    <Link to="/onderhoud" className="text-sm text-olive-deep underline">
                      Taak toevoegen
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 4c. De actielijst ──────────────────────────────────────────── */}
      <section className="mt-s4 max-w-3xl">
        <h2 className="text-h3 text-ink">
          {regels.length === 0
            ? "Niemand wacht op een nieuwe datum"
            : gesplitst.nu.length === 0
              ? `${regels.length} ${regels.length === 1 ? "partij kan" : "partijen kunnen"} nog even wachten`
              : `${gesplitst.nu.length} ${gesplitst.nu.length === 1 ? "partij wacht" : "partijen wachten"} op een datum van jou`}
        </h2>

        {regels.length === 0 ? (
          <div className="mt-s2">
            <Melding soort="gelukt">
              {afspraken.length === 0
                ? "Er zijn nog geen afspraken om bij te houden."
                : "Iedereen weet de datum die nu uit je planning volgt. Schuift er een bouwmoment, dan verschijnt hier vanzelf wie je moet bijpraten."}
            </Melding>
          </div>
        ) : (
          <>
            {/* Deze zin stond veertien keer onder veertien knoppen. */}
            <p className="mt-s2 text-body text-slate">
              Gesorteerd op wat er kapotgaat als je niets doet — niet op datum. “Doorgegeven”
              legt vast dat die partij de nieuwe datum van je heeft gehoord; anders blijft de
              regel staan.
            </p>

            <div className="mt-s3">
              <Actielijst
                regels={zichtbareRegels}
                betrokkenen={betrokkenen}
                berichtopties={{
                  projectnaam: project.naam,
                  afzender: gebruiker?.displayName ?? undefined,
                  opleverAangezegd: project.opleverStatus === "aangezegd",
                }}
                bezigMetId={bezigMetId}
                onDoorgegeven={(regel) => void markeerDoorgegeven(regel)}
                nu={nu}
              />
            </div>

            {gesplitst.later.length > 0 && (
              <button
                type="button"
                className="mt-s3 text-sm text-slate underline hover:text-ink"
                onClick={() => {
                  setToonAlles((b) => !b);
                }}
              >
                {toonAlles
                  ? "Verberg wat kan wachten"
                  : `Toon de ${gesplitst.later.length} die kunnen wachten`}
              </button>
            )}
          </>
        )}

        {aantalHandmatig > 0 && (
          <p className="mt-s3 text-sm text-granite">
            {aantalHandmatig}{" "}
            {aantalHandmatig === 1
              ? "partij staat op “handmatig” en verschijnt hier nooit"
              : "partijen staan op “handmatig” en verschijnen hier nooit"}{" "}
            — die benader je zelf.{" "}
            <Link to="/betrokkenen" className="underline">
              Aanpassen bij betrokkenen
            </Link>
          </p>
        )}
      </section>

      {/* ── 5. Snel naar ───────────────────────────────────────────────── */}
      <section className="mt-s6 max-w-3xl">
        <h2 className="text-h3 text-ink">Snel naar</h2>
        <div className="mt-s3 flex flex-wrap gap-s2">
          <Link to="/tijdlijn">
            <Knop variant="secundair">Tijdlijn</Knop>
          </Link>
          <Link to="/ankers">
            <Knop variant="secundair">Bouwmomenten</Knop>
          </Link>
          <Link to="/betrokkenen">
            <Knop variant="secundair">
              Betrokkenen ({betrokkenen.length})
            </Knop>
          </Link>
          <Link to="/oplevering">
            <Knop variant="secundair">Oplevering</Knop>
          </Link>
          {opgeleverd && (
            <Link to="/overdrachtsdossier">
              <Knop variant="secundair">Dossier</Knop>
            </Link>
          )}
          <Link to="/project">
            <Knop variant="secundair">Projectgegevens</Knop>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
