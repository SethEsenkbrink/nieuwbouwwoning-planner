import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { Actielijst } from "@/components/Actielijst";
import { toonDatum } from "@/lib/datum";
import { useAuth } from "@/context/useAuth";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import {
  haalActiefProject,
  haalAfspraken,
  haalAnkers,
  haalBetrokkenen,
  haalMeerwerk,
  haalOnderdelen,
  haalOnderhoudstaken,
  haalTermijnen,
  werkAfspraakBij,
} from "@/lib/projecten";
import { maakActielijst, telHandmatigeBetrokkenen } from "@/lib/actielijst";
import { opDag, type ActieRegel } from "@/lib/planning";
import { INVULBARE_ANKERS } from "@/data/ankers";
import { toonBedrag } from "@/lib/bedrag";
import { telMeerwerk } from "@/lib/meerwerk";
import { telDepot } from "@/lib/depot";
import { adresregel, bepaalEnergielabelstand, isOpgeleverd } from "@/lib/woning";
import { garantiesDieAflopen, telOpenstaandeRegistraties } from "@/lib/onderdelen";
import { maakOnderhoudslijst, toonInterval } from "@/lib/onderhoud";
import type {
  AfspraakMetId,
  AnkerMetId,
  BetrokkeneMetId,
  MeerwerkMetId,
  OnderdeelMetId,
  OnderhoudTaakMetId,
  ProjectMetId,
  TermijnMetId,
} from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Het dashboard — je werklijst, niet je planning
 *
 * Wat hier bovenaan staat is niet de opleverdatum maar de actielijst: de
 * afspraken waarvan de berekende datum afwijkt van wat die partij als laatste
 * van je hoorde. Dat verschil is het enige dat werk voor je oplevert
 * (ADR-0008, principe 5).
 *
 * DE DOORGEGEVEN-KNOP IS GEEN AFVINKLIJSTJE.
 * Hij schrijft `gecommuniceerdeDatum`, en dat is het feit waar de hele module
 * op draait: welke datum weet die partij nu. Drukt niemand hem in, dan blijven
 * berekend en gecommuniceerd uit elkaar lopen en is de lijst na twee
 * verschuivingen alleen nog ruis.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const STATUSTEKST = {
  indicatief: "indicatief — nog een schatting",
  bandbreedte: "bandbreedte — tussen twee datums",
  aangezegd: "aangezegd — formeel vastgelegd",
} as const;

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
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [bezigMetId, setBezigMetId] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

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
        ] = await Promise.all([
          haalAnkers(uid, gevonden.id),
          haalBetrokkenen(uid, gevonden.id),
          haalAfspraken(uid, gevonden.id),
          haalMeerwerk(uid, gevonden.id),
          haalTermijnen(uid, gevonden.id),
          haalOnderdelen(uid, gevonden.id),
          haalOnderhoudstaken(uid, gevonden.id),
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
        gecommuniceerdOp: new Date(),
        ...(afspraak?.status === "concept" ? { status: "voorlopig" as const } : {}),
      });
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Het doorgeven vastleggen"));
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

  const isBand =
    project.opleverStatus === "bandbreedte" &&
    project.opleverVroegst !== undefined &&
    project.opleverLaatst !== undefined &&
    project.opleverVroegst.getTime() !== project.opleverLaatst.getTime();

  const regels = maakActielijst(project, ankers, betrokkenen, afspraken, opDag(new Date()));
  const aantalHandmatig = telHandmatigeBetrokkenen(betrokkenen);
  const ankersMetDatum = ankers.filter(
    (a) => a.verwachtOp !== undefined && a.type !== "oplevering",
  ).length;

  const meerwerkstand = telMeerwerk(meerwerk, project.meerwerkbudget);
  const depotstand = telDepot(termijnen);

  // De omslag uit ADR-0010 §1: na de sleuteloverdracht verandert het dashboard
  // van inhoud, niet van plek. In `opgeleverd` staat de onderhoudslijst waar in
  // de bouwfase de schuif-impact-actielijst staat.
  const opgeleverd = isOpgeleverd(project);
  const adres = adresregel(project.woningpaspoort);
  const labelstand = bepaalEnergielabelstand(project.woningpaspoort, opDag(new Date()));
  const aflopend = garantiesDieAflopen(onderdelen, opDag(new Date()));
  const registratiesOpen = telOpenstaandeRegistraties(onderdelen);

  // DIT IS DE HERINNERING (ADR-0014 §3). Er gaat geen mail uit tot ronde 8, dus
  // deze lijst is het enige dat de gebruiker eraan herinnert. Alleen wat nu
  // aandacht vraagt — de volledige lijst staat op /onderhoud.
  const onderhoudNu = maakOnderhoudslijst(
    onderhoudstaken,
    onderdelen,
    project.opleverVerwacht,
    opDag(new Date()),
  ).filter((r) => r.stand.urgentie !== "later");

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">
          {opgeleverd ? "Woningdossier" : "Dashboard"}
        </span>
      </div>

      {/* Na de oplevering is het adres de betere kop dan de projectnaam: je
          beheert dan een huis, geen bouwproject. Staat er nog geen adres in het
          paspoort, dan valt hij terug op de naam. */}
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

      {/* Een verlopen energielabel blokkeert een verkoop en verdwijnt stil uit
          EP-online. Daarom staat het hier bovenaan en niet alleen op /woning. */}
      {opgeleverd && labelstand?.verlopen && (
        <div className="mt-s3 max-w-3xl">
          <Melding soort="fout">
            Het energielabel is verlopen op {toonDatum(labelstand.verlooptOp)}.{" "}
            <Link to="/woning" className="underline">
              Bekijk de woning
            </Link>
          </Melding>
        </div>
      )}

      {/* Een niet-aangemelde installatie heeft een consequentie bij de
          netbeheerder; dat hoort niet onderaan een lijst te verdwijnen. */}
      {registratiesOpen > 0 && (
        <div className="mt-s3 max-w-3xl">
          <Melding soort="fout">
            {registratiesOpen === 1
              ? "Eén onderdeel is nog niet aangemeld"
              : `${registratiesOpen} onderdelen zijn nog niet aangemeld`}{" "}
            bij de instantie die dat vereist.{" "}
            <Link to="/onderdelen" className="underline">
              Naar de onderdelen
            </Link>
          </Melding>
        </div>
      )}

      {/* ── De onderhoudslijst — de herinnering uit ADR-0014 §3 ──────────
          Staat vóór de garanties, want achterstallig onderhoud is werk dat
          klaarligt; een aflopende garantie is een kans die je kunt benutten. */}
      {opgeleverd && onderhoudNu.length > 0 && (
        <section className="mt-s4 max-w-3xl">
          <h2 className="text-h3 text-ink">
            {onderhoudNu.length === 1
              ? "Eén onderhoudsbeurt vraagt aandacht"
              : `${onderhoudNu.length} onderhoudsbeurten vragen aandacht`}
          </h2>
          <p className="mt-s2 text-body text-slate">
            Vink af wat je gedaan hebt — dan schuift de volgende keer vanzelf op en komt het in
            het logboek.
          </p>

          <div className="mt-s3 flex flex-col gap-2">
            {onderhoudNu.map(({ taak, stand, onderdeelNaam }) => (
              <div
                key={taak.id}
                className={`brink-card flex flex-wrap items-start justify-between gap-2 p-s3 ${
                  stand.urgentie === "achterstallig" ? "border border-clay/40" : ""
                }`}
              >
                <div>
                  <Link to="/onderhoud" className="text-body font-semibold text-ink underline">
                    {taak.titel}
                  </Link>
                  <p className="mt-1 text-sm text-slate">
                    {toonInterval(taak.intervalDagen)}
                    {onderdeelNaam && ` · ${onderdeelNaam}`}
                  </p>
                </div>
                <span
                  className={`rounded-pill px-3 py-1 text-sm ${
                    stand.urgentie === "achterstallig"
                      ? "bg-clay/15 text-clay-deep"
                      : "bg-bone text-charcoal"
                  }`}
                >
                  {stand.urgentie === "achterstallig"
                    ? `${Math.abs(stand.dagenResterend)} dagen over tijd`
                    : stand.dagenResterend === 0
                      ? "vandaag"
                      : `over ${stand.dagenResterend} dagen`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Het moment waarop informatie geld waard is: nog even laten nakijken
          vóórdat de garantie afloopt en het je eigen rekening wordt. */}
      {aflopend.length > 0 && (
        <section className="mt-s4 max-w-3xl">
          <h2 className="text-h3 text-ink">
            {aflopend.length === 1
              ? "Eén garantie loopt binnenkort af"
              : `${aflopend.length} garanties lopen binnenkort af`}
          </h2>
          <p className="mt-s2 text-body text-slate">
            Dit is het moment om het te laten nakijken — daarna is het je eigen rekening.
          </p>
          <ul className="mt-s2 flex flex-col gap-1">
            {aflopend.map(({ onderdeel, klok }) => (
              <li key={onderdeel.id} className="text-body text-ink">
                <Link to="/onderdelen" className="underline">
                  {onderdeel.naam}
                </Link>{" "}
                <span className="text-sm text-slate">
                  — nog {klok.dagenResterend} dagen, tot {toonDatum(klok.verstrijktOp)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── De actielijst staat bovenaan, want dit is het werk ───────────── */}
      <section className="mt-s4 max-w-3xl">
        <h2 className="text-h3 text-ink">
          {regels.length === 0
            ? "Niemand wacht op een nieuwe datum"
            : `${regels.length} ${regels.length === 1 ? "partij wacht" : "partijen wachten"} op een datum van jou`}
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
            <p className="mt-s2 text-body text-slate">
              Gesorteerd op wat er kapotgaat als je niets doet — niet op datum. Druk op
              “Doorgegeven” zodra je die partij gesproken hebt, anders blijft de regel staan.
            </p>
            <div className="mt-s3">
              <Actielijst
                regels={regels}
                betrokkenen={betrokkenen}
                berichtopties={{
                  projectnaam: project.naam,
                  afzender: gebruiker?.displayName ?? undefined,
                  opleverAangezegd: project.opleverStatus === "aangezegd",
                }}
                bezigMetId={bezigMetId}
                onDoorgegeven={(regel) => void markeerDoorgegeven(regel)}
              />
            </div>
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

      {/* ── De achtergrond: waar de lijst op gebaseerd is ────────────────── */}
      <div className="mt-s6 grid max-w-3xl gap-s2 sm:grid-cols-2">
        <section className="brink-card p-s3">
          <h2 className="text-h3 text-ink">Oplevering</h2>

          {project.opleverStatus ? (
            <>
              <p className="mt-s2 text-body text-ink">
                {isBand
                  ? `tussen ${toonDatum(project.opleverVroegst)} en ${toonDatum(project.opleverLaatst)}`
                  : toonDatum(project.opleverVerwacht)}
              </p>
              <p className="mt-1 text-sm text-slate">{STATUSTEKST[project.opleverStatus]}</p>
              {project.opleverBron && (
                <p className="mt-s2 text-sm text-granite">Bron: {project.opleverBron}</p>
              )}
            </>
          ) : (
            <p className="mt-s2 text-body text-slate">Nog geen opleverdatum ingevuld.</p>
          )}
          <div className="mt-s3">
            <Link to="/project">
              <Knop variant="secundair">Aanpassen</Knop>
            </Link>
          </div>
        </section>

        <section className="brink-card p-s3">
          <h2 className="text-h3 text-ink">Bouwmomenten</h2>
          <p className="mt-s2 text-body text-ink">
            {ankersMetDatum} van de {INVULBARE_ANKERS.length} bekend
          </p>
          <p className="mt-1 text-sm text-slate">
            Hoe meer je invult, hoe minder er vanaf de opleverdatum geschat hoeft te worden.
          </p>
          <div className="mt-s3">
            <Link to="/ankers">
              <Knop variant="secundair">Invullen</Knop>
            </Link>
          </div>
        </section>

        <section className="brink-card p-s3">
          <h2 className="text-h3 text-ink">Geld</h2>
          <dl className="mt-s2 grid grid-cols-[auto_1fr] gap-x-s2 gap-y-1 text-body">
            <dt className="text-slate">Meerwerk vastgelegd</dt>
            <dd className="text-ink">{toonBedrag(meerwerkstand.vastgelegd)}</dd>
            <dt className="text-slate">Depot betaald</dt>
            <dd className="text-ink">{toonBedrag(depotstand.betaald)}</dd>
          </dl>
          {depotstand.aantalTeDeclareren > 0 && (
            <p className="mt-s2 text-sm text-clay-deep">
              {depotstand.aantalTeDeclareren}{" "}
              {depotstand.aantalTeDeclareren === 1 ? "factuur" : "facturen"} nog niet bij de bank
              ingediend.
            </p>
          )}
          {meerwerkstand.ruimte !== undefined && meerwerkstand.ruimte < 0 && (
            <p className="mt-s2 text-sm text-clay-deep">
              {toonBedrag(Math.abs(meerwerkstand.ruimte))} over je meerwerkbudget.
            </p>
          )}
          <div className="mt-s3 flex flex-wrap gap-s2">
            <Link to="/meerwerk">
              <Knop variant="secundair">Meerwerk</Knop>
            </Link>
            <Link to="/bouwdepot">
              <Knop variant="secundair">Bouwdepot</Knop>
            </Link>
          </div>
        </section>

        <section className="brink-card p-s3">
          <h2 className="text-h3 text-ink">Betrokkenen</h2>
          <p className="mt-s2 text-body text-ink">
            {betrokkenen.length} {betrokkenen.length === 1 ? "partij" : "partijen"} ·{" "}
            {afspraken.length} {afspraken.length === 1 ? "afspraak" : "afspraken"}
          </p>
          <p className="mt-1 text-sm text-slate">
            Afspraken hangen aan een bouwmoment, niet aan een vaste datum.
          </p>
          <div className="mt-s3">
            <Link to="/betrokkenen">
              <Knop variant="secundair">Bekijk en pas aan</Knop>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
