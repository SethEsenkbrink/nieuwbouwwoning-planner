import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Veld } from "@/components/Veld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useVault as useAuth } from "@/context/useVault";
import { haalActiefProject, haalOnderhoudstaken } from "@/lib/projecten";
import { berekenMjopKostenOverzicht } from "@/lib/mjop";
import type { OnderhoudTaakDoc } from "@/types/model";
import type { ProjectMetId } from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Meerjarenonderhoud (MJOP-light)
 *
 * Rekent de onderhoudstaken door naar een kostenraming per jaar. `src/lib/mjop.ts`
 * had tot deze route geen enkele importeur (bevinding A-06).
 *
 * De raming is bewust grof: interval en geschatte kosten per taak, meer niet.
 * Dat is precies genoeg om te zien in welk jaar een piek valt, en niet zoveel
 * dat het de indruk wekt een offerte te zijn.
 * ═══════════════════════════════════════════════════════════════════════════
 */

function euro(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(bedrag);
}

export default function Mjop() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [taken, setTaken] = useState<OnderhoudTaakDoc[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [horizon, setHorizon] = useState("10");

  useEffect(() => {
    if (!uid) return;
    let actueel = true;

    void (async () => {
      try {
        const gevonden = await haalActiefProject(uid);
        if (!actueel) return;
        setProject(gevonden);
        if (!gevonden) return;

        const opgehaald = await haalOnderhoudstaken(uid, gevonden.id);
        if (actueel) setTaken(opgehaald as unknown as OnderhoudTaakDoc[]);
      } catch (err) {
        if (actueel) setFout(err instanceof Error ? err.message : String(err));
      } finally {
        if (actueel) setBezigMetLaden(false);
      }
    })();

    return () => {
      actueel = false;
    };
  }, [uid]);

  const overzicht = useMemo(() => {
    const jaren = Number(horizon.trim());
    const veiligeHorizon = Number.isFinite(jaren) ? Math.min(30, Math.max(1, jaren)) : 10;
    return berekenMjopKostenOverzicht(taken, veiligeHorizon);
  }, [taken, horizon]);

  const totaal = useMemo(
    () => overzicht.reduce((som, jaar) => som + jaar.geschatteKosten, 0),
    [overzicht],
  );

  // De duurste jaren vallen op als je weet waar het maximum ligt.
  const hoogste = useMemo(
    () => overzicht.reduce((max, jaar) => Math.max(max, jaar.geschatteKosten), 0),
    [overzicht],
  );

  if (bezigMetLaden) return <Laadscherm />;

  if (!project) {
    return (
      <AppShell>
        <div className="max-w-xl">
          <Melding soort="info">Je hebt nog geen project.</Melding>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mt-s2 text-h2 text-ink">Meerjarenonderhoud</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Een raming van je onderhoudskosten per jaar, op basis van het interval en de geschatte
        kosten per taak. Het is een richtbedrag om op te reserveren, geen offerte.
      </p>

      {fout && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}

      {taken.length === 0 ? (
        <div className="mt-s4 max-w-2xl">
          <Melding soort="info">
            Er zijn nog geen onderhoudstaken. Voeg ze toe bij{" "}
            <Link to="/onderhoud">Onderhoud</Link>, dan verschijnt hier de raming.
          </Melding>
        </div>
      ) : (
        <>
          <section className="brink-card mt-s4 max-w-md p-s3">
            <Veld
              label="Horizon (jaren)"
              value={horizon}
              onChange={(e) => {
                setHorizon(e.target.value);
              }}
            />
            <p className="mt-s2 text-body text-slate">
              Totaal over deze periode: <strong className="text-ink">{euro(totaal)}</strong>, over{" "}
              {taken.length} {taken.length === 1 ? "taak" : "taken"}.
            </p>
          </section>

          <section className="mt-s4 max-w-2xl">
            <ol className="flex flex-col gap-s2">
              {overzicht.map((jaar) => (
                <li key={jaar.jaar} className="brink-card p-s3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-h4 text-ink">{jaar.jaar}</h2>
                    <span className="text-body text-ink">{euro(jaar.geschatteKosten)}</span>
                  </div>

                  {/* Een balk maakt een piekjaar sneller zichtbaar dan een getal. */}
                  <div
                    className="mt-s2 h-2 w-full overflow-hidden rounded-pill bg-bone"
                    role="img"
                    aria-label={`${euro(jaar.geschatteKosten)} in ${String(jaar.jaar)}`}
                  >
                    <div
                      className="h-full bg-ink"
                      style={{
                        width: `${String(hoogste > 0 ? (jaar.geschatteKosten / hoogste) * 100 : 0)}%`,
                      }}
                    />
                  </div>

                  {jaar.taken.length > 0 && (
                    <ul className="mt-s2 flex flex-col gap-1">
                      {jaar.taken.map((taak) => (
                        <li
                          key={`${String(jaar.jaar)}-${taak.taakId}`}
                          className="flex flex-wrap items-baseline justify-between gap-2"
                        >
                          <span className="text-body text-slate">{taak.titel}</span>
                          <span className="text-body text-slate">{euro(taak.kosten)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {jaar.aantalTaken === 0 && (
                    <p className="mt-s2 text-body text-slate">Geen onderhoud gepland.</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </AppShell>
  );
}
