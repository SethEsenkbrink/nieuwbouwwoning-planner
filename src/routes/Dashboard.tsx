import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { toonDatum } from "@/lib/datum";
import { useAuth } from "@/context/useAuth";
import { haalActiefProject, haalAfspraken, haalBetrokkenen } from "@/lib/projecten";
import type { ProjectMetId } from "@/lib/converters";

/**
 * Het dashboard toont waar je staat.
 *
 * Nu nog: het project, de opleverband en hoeveel partijen erbij horen.
 * Wat hier volgens ADR-0008 komt: de actielijst — wie wacht op een datum die
 * niet meer klopt, gesorteerd op wat er kapotgaat als je niets doet. Dat is de
 * volgende stap in docs/STATE.md.
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
  const [aantalBetrokkenen, setAantalBetrokkenen] = useState(0);
  const [aantalAfspraken, setAantalAfspraken] = useState(0);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

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

        setProject(gevonden);
        const [betrokkenen, afspraken] = await Promise.all([
          haalBetrokkenen(uid, gevonden.id),
          haalAfspraken(uid, gevonden.id),
        ]);
        if (!actueel) return;
        setAantalBetrokkenen(betrokkenen.length);
        setAantalAfspraken(afspraken.length);
      } catch {
        if (actueel) setFout("Je project kon niet worden geladen.");
      } finally {
        if (actueel) setBezigMetLaden(false);
      }
    })();

    return () => {
      actueel = false;
    };
  }, [uid, navigeer]);

  if (!uid || bezigMetLaden) return <Laadscherm />;

  if (fout) {
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

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Dashboard</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">{project.naam}</h1>
      {project.aannemer && <p className="mt-1 text-body text-slate">{project.aannemer}</p>}

      <div className="mt-s4 grid max-w-3xl gap-s2 sm:grid-cols-2">
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
        </section>

        <section className="brink-card p-s3">
          <h2 className="text-h3 text-ink">Betrokkenen</h2>
          <p className="mt-s2 text-body text-ink">
            {aantalBetrokkenen} {aantalBetrokkenen === 1 ? "partij" : "partijen"} ·{" "}
            {aantalAfspraken} {aantalAfspraken === 1 ? "afspraak" : "afspraken"}
          </p>
          <p className="mt-1 text-sm text-slate">
            Afspraken hangen aan een bouwmoment, niet aan een vaste datum. Schuift de bouw, dan
            schuiven ze mee.
          </p>
          <div className="mt-s3">
            <Link to="/betrokkenen">
              <Knop variant="secundair">Bekijk en pas aan</Knop>
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-s4 max-w-3xl">
        <Melding soort="info">
          De actielijst — wie er nog een datum heeft die niet meer klopt — komt in de volgende stap.
          De rekenkern eronder staat al.
        </Melding>
      </div>
    </AppShell>
  );
}
