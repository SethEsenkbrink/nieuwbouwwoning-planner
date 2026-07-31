import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { Projectgegevensformulier } from "@/components/Projectgegevensformulier";
import {
  LEGE_PROJECTGEGEVENS,
  type Projectgegevenswaarden,
} from "@/lib/projectgegevens";
import { Opleverbandformulier } from "@/components/Opleverbandformulier";
import { Impactmelding } from "@/components/Impactmelding";
import { useAuth } from "@/context/useAuth";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum } from "@/lib/datum";
import {
  controleerOpleverband,
  naarOpslag,
  uitProject,
  type Opleverbandwaarden,
} from "@/lib/opleverband";
import { naarAfspraakInvoer, naarBetrokkeneInvoer, naarPlanningContext } from "@/lib/actielijst";
import { opDag } from "@/lib/planning";
import { berekenImpact } from "@/lib/watals";
import {
  haalActiefProject,
  haalAfspraken,
  haalAnkers,
  haalBetrokkenen,
  verwijderProject,
  werkProjectBij,
} from "@/lib/projecten";
import type {
  AfspraakMetId,
  AnkerMetId,
  BetrokkeneMetId,
  ProjectMetId,
} from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Projectinstellingen — waar de opleverdatum verschuift
 *
 * Dit scherm bestaat vooral om één reden: **de opleverdatum aanpassen is de
 * handeling die het vaakst voorkomt.** Tot nu toe moest dat via de aanmaakwizard,
 * en dat is een omweg door een scherm dat bedoeld is om iets te beginnen, niet
 * om iets bij te stellen.
 *
 * De twee blokken staan bewust apart en slaan apart op. Projectgegevens
 * veranderen bijna nooit; de opleverdatum verandert steeds. Ze in één formulier
 * zetten betekent dat je bij elke verschuiving de hele rest opnieuw langs de
 * validatie haalt.
 *
 * Onder de opleverdatum staat wat de wijziging gaat kosten: hoeveel afspraken
 * eraan hangen. Dat is nog niet de volledige wat-als uit A6, maar wel het
 * belangrijkste deel ervan — je ziet vóór het opslaan dat dit geen losse datum
 * is.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default function Projectinstellingen() {
  const { gebruiker } = useAuth();
  const navigeer = useNavigate();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [afspraken, setAfspraken] = useState<AfspraakMetId[]>([]);
  const [ankers, setAnkers] = useState<AnkerMetId[]>([]);
  const [betrokkenen, setBetrokkenen] = useState<BetrokkeneMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);

  const [gegevens, setGegevens] = useState<Projectgegevenswaarden>(LEGE_PROJECTGEGEVENS);
  const [band, setBand] = useState<Opleverbandwaarden>(uitProject({}));
  const [bezigMetGegevens, setBezigMetGegevens] = useState(false);
  const [bezigMetBand, setBezigMetBand] = useState(false);

  // Verwijderen vraagt om de projectnaam intikken. Een knop met "weet je het
  // zeker?" klikt iemand op de automatische piloot weg; iets overtypen niet.
  const [toonGevarenzone, setToonGevarenzone] = useState(false);
  const [bevestiging, setBevestiging] = useState("");
  const [bezigMetVerwijderen, setBezigMetVerwijderen] = useState(false);

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
          setProject(null);
          return;
        }

        const [geladenAfspraken, geladenAnkers, geladenBetrokkenen] = await Promise.all([
          haalAfspraken(uid, gevonden.id),
          haalAnkers(uid, gevonden.id),
          haalBetrokkenen(uid, gevonden.id),
        ]);
        if (!actueel) return;

        setProject(gevonden);
        setAfspraken(geladenAfspraken);
        setAnkers(geladenAnkers);
        setBetrokkenen(geladenBetrokkenen);
        setGegevens({
          naam: gevonden.naam,
          bouwnummer: gevonden.bouwnummer ?? "",
          projectnaam: gevonden.projectnaam ?? "",
          aannemer: gevonden.aannemer ?? "",
          waarborg: gevonden.garantiewaarborg ?? "woningborg",
          koopsom: gevonden.koopsom === undefined ? "" : String(gevonden.koopsom),
          meerwerkbudget:
            gevonden.meerwerkbudget === undefined ? "" : String(gevonden.meerwerkbudget),
        });
        setBand(uitProject(gevonden));
      } catch (f) {
        if (actueel) setFout(opslagFoutmelding(f, "Laden"));
      } finally {
        if (actueel) setBezigMetLaden(false);
      }
    })();

    return () => {
      actueel = false;
    };
  }, [uid, herlaadTeller]);

  function leesBedrag(tekst: string): number | undefined | "fout" {
    const schoon = tekst.trim().replace(/[.\s]/g, "");
    if (schoon === "") return undefined;
    const getal = Number(schoon);
    if (!Number.isFinite(getal) || getal < 0) return "fout";
    return Math.round(getal);
  }

  async function bewaarGegevens() {
    if (!uid || !project) return;

    if (gegevens.naam.trim() === "") {
      setFout("Geef je project een naam.");
      return;
    }

    const koopsom = leesBedrag(gegevens.koopsom);
    const meerwerkbudget = leesBedrag(gegevens.meerwerkbudget);
    if (koopsom === "fout" || meerwerkbudget === "fout") {
      setFout("Vul bedragen in als een getal, zonder euroteken.");
      return;
    }

    setBezigMetGegevens(true);
    setFout(null);
    setGelukt(null);
    try {
      await werkProjectBij(uid, project.id, {
        naam: gegevens.naam.trim(),
        bouwnummer: gegevens.bouwnummer.trim() || undefined,
        projectnaam: gegevens.projectnaam.trim() || undefined,
        aannemer: gegevens.aannemer.trim() || undefined,
        garantiewaarborg: gegevens.waarborg,
        koopsom,
        meerwerkbudget,
      });
      setGelukt("Projectgegevens opgeslagen.");
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetGegevens(false);
    }
  }

  async function bewaarBand() {
    if (!uid || !project) return;

    const melding = controleerOpleverband(band);
    if (melding) {
      setFout(melding);
      return;
    }

    setBezigMetBand(true);
    setFout(null);
    setGelukt(null);
    try {
      await werkProjectBij(uid, project.id, naarOpslag(band));
      setGelukt(
        afspraken.length === 0
          ? "Opleverdatum opgeslagen."
          : `Opleverdatum opgeslagen. Controleer op het dashboard wie er nog een oude datum heeft.`,
      );
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetBand(false);
    }
  }

  async function verwijder() {
    if (!uid || !project) return;

    setBezigMetVerwijderen(true);
    setFout(null);
    try {
      await verwijderProject(uid, project.id);
      void navigeer("/project/nieuw", { replace: true });
    } catch (f) {
      setFout(opslagFoutmelding(f, "Verwijderen"));
      setBezigMetVerwijderen(false);
    }
  }

  if (!uid || bezigMetLaden) return <Laadscherm />;

  if (!project) {
    return (
      <AppShell>
        <div className="max-w-xl">
          <Melding soort="info">
            Je hebt nog geen project. <Link to="/project/nieuw">Maak er eerst een aan.</Link>
          </Melding>
        </div>
      </AppShell>
    );
  }

  /**
   * Wat er gebeurt als je deze band opslaat. Alleen te berekenen zodra er een
   * verwachte datum staat — zonder die datum valt er niets te vergelijken.
   */
  const impact =
    band.verwacht === undefined
      ? null
      : berekenImpact(
          afspraken.map(naarAfspraakInvoer),
          betrokkenen.map(naarBetrokkeneInvoer),
          naarPlanningContext(project, ankers),
          naarPlanningContext({ ...project, ...naarOpslag(band) }, ankers),
          opDag(new Date()),
        );

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Project</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Projectinstellingen</h1>

      {fout && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}
      {gelukt && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="gelukt">{gelukt}</Melding>
        </div>
      )}

      {/* ── De opleverdatum staat bovenaan: dit is wat er steeds verandert ── */}
      <section className="brink-card mt-s4 max-w-xl p-s3">
        <h2 className="text-h3 text-ink">Opleverdatum</h2>
        <p className="mt-s2 text-body text-slate">
          De datum schuift bijna altijd. Daarom slaat de app niet alleen een datum op, maar ook
          hoe zeker die is — dat bepaalt wie je nu al kunt inplannen en wie beter nog even kan
          wachten.
        </p>

        {project.opleverVerwacht && (
          <p className="mt-s2 text-sm text-granite">
            Nu opgeslagen: {toonDatum(project.opleverVerwacht)}
            {project.opleverBronDatum && ` · vastgelegd op ${toonDatum(project.opleverBronDatum)}`}
          </p>
        )}

        <div className="mt-s3">
          <Opleverbandformulier
            waarden={band}
            onWijzig={(patch) => {
              setBand((b) => ({ ...b, ...patch }));
            }}
          />
        </div>

        {impact && impact.aantalGeraakt > 0 && (
          <div className="mt-s3">
            <Impactmelding impact={impact} />
          </div>
        )}

        <div className="mt-s3">
          <Knop bezig={bezigMetBand} onClick={() => void bewaarBand()}>
            Opleverdatum opslaan
          </Knop>
        </div>
      </section>

      {/* ── De vaste gegevens ───────────────────────────────────────────── */}
      <section className="brink-card mt-s3 max-w-xl p-s3">
        <h2 className="text-h3 text-ink">Projectgegevens</h2>
        <p className="mt-s2 text-body text-slate">
          Deze veranderen zelden. Ze staan hier zodat je ze kunt aanvullen zodra je ze weet.
        </p>

        <div className="mt-s3">
          <Projectgegevensformulier
            waarden={gegevens}
            onWijzig={(patch) => {
              setGegevens((g) => ({ ...g, ...patch }));
            }}
            toonBedragen
          />
        </div>

        <div className="mt-s3">
          <Knop bezig={bezigMetGegevens} onClick={() => void bewaarGegevens()}>
            Projectgegevens opslaan
          </Knop>
        </div>
      </section>

      {/* ── Opnieuw beginnen ────────────────────────────────────────────── */}
      <section className="brink-card mt-s6 max-w-xl border border-clay/30 p-s3">
        <h2 className="text-h3 text-ink">Opnieuw beginnen</h2>
        <p className="mt-s2 text-body text-slate">
          Dit verwijdert het project met alles wat eronder hangt: bouwmomenten, betrokkenen,
          afspraken en de rest. Daarna kun je opnieuw beginnen met de wizard.
        </p>

        {!toonGevarenzone ? (
          <div className="mt-s3">
            <Knop
              variant="secundair"
              onClick={() => {
                setToonGevarenzone(true);
                setBevestiging("");
                setFout(null);
              }}
            >
              Project verwijderen
            </Knop>
          </div>
        ) : (
          <div className="mt-s3 flex flex-col gap-s2">
            <Melding soort="fout">
              Dit kan niet teruggedraaid worden. Er zijn {afspraken.length}{" "}
              {afspraken.length === 1 ? "afspraak" : "afspraken"} en {betrokkenen.length}{" "}
              {betrokkenen.length === 1 ? "partij" : "partijen"} die hiermee verdwijnen.
            </Melding>

            <Veld
              label={`Typ “${project.naam}” om te bevestigen`}
              value={bevestiging}
              onChange={(e) => {
                setBevestiging(e.target.value);
              }}
            />

            <div className="flex flex-wrap gap-s2">
              <Knop
                bezig={bezigMetVerwijderen}
                disabled={bevestiging.trim() !== project.naam}
                onClick={() => void verwijder()}
              >
                Definitief verwijderen
              </Knop>
              <Knop
                variant="secundair"
                onClick={() => {
                  setToonGevarenzone(false);
                }}
              >
                Annuleren
              </Knop>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
