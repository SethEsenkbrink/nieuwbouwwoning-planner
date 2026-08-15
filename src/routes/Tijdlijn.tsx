import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Datumveld } from "@/components/Datumveld";
import { Keuzeveld, type Keuze } from "@/components/Keuzeveld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useVault as useAuth } from "@/context/useVault";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum, vandaag } from "@/lib/datum";

import { sorteerTaken, taakUrgentie, telTaken, toonTermijn } from "@/lib/taken";
import {
  haalActiefProject,
  haalFases,
  haalTaken,
  verwijderTaak,
  zetFase,
  zetTaak,
  zorgVoorFases,
} from "@/lib/projecten";
import type { FaseMetId, TaakMetId } from "@/lib/converters";
import type { FaseStatus } from "@/types/model";
import { FASE_VOLGORDE, type Actiepunt } from "@/data/fases";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Tijdlijn — het traject van koop tot garantie, met je eigen taken erbij
 *
 * De zeven fases liggen vast: ze beschrijven het traject, niet de voorkeur van
 * de gebruiker. Wat per project verschilt is de status en de streefdatum, plus
 * de taken die je er zelf aan hangt.
 *
 * DE ACTIEPUNTEN WORDEN NIET AUTOMATISCH TAKEN.
 * Zeven fases met vier suggesties elk is een lijst van achtentwintig regels
 * waarvan de helft niet van toepassing is — en dan vinkt niemand meer iets af.
 * Ze staan als suggestie bij de fase, met één klik om er een eigen taak van te
 * maken. Die klik is het verschil tussen "de app zegt dat het moet" en "ik heb
 * besloten dat dit moet".
 *
 * De fases worden bij het eerste bezoek aangemaakt, niet in de wizard. Dat
 * scheelt zeven schrijfacties voor iemand die de app alleen even bekijkt.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const FASESTATUSOPTIES: readonly Keuze<FaseStatus>[] = [
  { waarde: "open", label: "Nog niet begonnen" },
  { waarde: "bezig", label: "Hier zitten we nu" },
  { waarde: "klaar", label: "Afgerond" },
];

const URGENTIESTIJL: Record<string, string> = {
  verlopen: "bg-clay text-canvas",
  vandaag: "bg-clay/15 text-clay-deep",
  binnenkort: "bg-bone text-charcoal",
  later: "bg-lifted text-granite border border-bone",
  geendatum: "bg-lifted text-granite border border-bone",
  klaar: "bg-olive/10 text-olive-deep",
};

function Actiepuntregel({
  punt,
  onMaakTaak,
}: {
  punt: Actiepunt;
  onMaakTaak: (titel: string) => void;
}) {
  return (
    <li className="border-t border-bone pt-s2 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-body text-ink">{punt.titel}</p>
        <button
          type="button"
          className="text-sm text-clay-deep underline hover:text-clay"
          onClick={() => {
            onMaakTaak(punt.titel);
          }}
        >
          Maak hier een taak van
        </button>
      </div>
      <p className="mt-1 text-sm text-slate">{punt.toelichting}</p>
      {punt.waarschuwing && <p className="mt-1 text-sm text-clay-deep">⚠ {punt.waarschuwing}</p>}
    </li>
  );
}

export default function Tijdlijn() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [projectId, setProjectId] = useState<string | null>(null);
  const [fases, setFases] = useState<FaseMetId[]>([]);
  const [taken, setTaken] = useState<TaakMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  /** Bij welke fase staat het taakformulier open. */
  const [nieuwBijFase, setNieuwBijFase] = useState<string | null>(null);
  const [nieuweTitel, setNieuweTitel] = useState("");
  const [nieuweDeadline, setNieuweDeadline] = useState<Date | undefined>(undefined);

  const [herlaadTeller, setHerlaadTeller] = useState(0);
  const herlaad = useCallback(() => {
    setHerlaadTeller((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let actueel = true;

    void (async () => {
      try {
        const project = await haalActiefProject(uid);
        if (!actueel) return;

        if (!project) {
          setProjectId(null);
          return;
        }

        // Eerste bezoek: de zeven fases aanmaken. `zorgVoorFases` doet niets
        // als ze er al staan, dus dit kan niet stapelen.
        let geladenFases = await haalFases(uid, project.id);
        if (geladenFases.length === 0) {
          await zorgVoorFases(
            uid,
            project.id,
            FASE_VOLGORDE.map((f, i) => ({
              type: f.type,
              titel: f.titel,
              status: "open" as const,
              volgorde: i,
            })),
          );
          geladenFases = await haalFases(uid, project.id);
        }

        const geladenTaken = await haalTaken(uid, project.id);
        if (!actueel) return;

        setProjectId(project.id);
        setFases(geladenFases);
        setTaken(geladenTaken);
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

  async function wijzigFase(fase: FaseMetId, patch: Partial<FaseMetId>) {
    if (!uid || !projectId) return;
    const samen = { ...fase, ...patch };

    setBezig(true);
    setFout(null);
    try {
      await zetFase(uid, projectId, fase.id, {
        type: samen.type,
        titel: samen.titel,
        status: samen.status,
        ...(samen.streefdatum === undefined ? {} : { streefdatum: samen.streefdatum }),
        ...(samen.volgorde === undefined ? {} : { volgorde: samen.volgorde }),
      });
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function voegTaakToe(faseId: string, titel: string, deadline: Date | undefined) {
    if (!uid || !projectId) return;
    if (titel.trim() === "") {
      setFout("Geef de taak een naam.");
      return;
    }

    setBezig(true);
    setFout(null);
    try {
      await zetTaak(uid, projectId, null, {
        titel: titel.trim(),
        status: "open",
        bron: "handmatig",
        phaseId: faseId,
        ...(deadline === undefined ? {} : { deadline }),
      });
      setGelukt("Taak toegevoegd.");
      setNieuwBijFase(null);
      setNieuweTitel("");
      setNieuweDeadline(undefined);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function wisselAf(taak: TaakMetId) {
    if (!uid || !projectId) return;

    setBezig(true);
    setFout(null);
    try {
      await zetTaak(uid, projectId, taak.id, {
        titel: taak.titel,
        status: taak.status === "klaar" ? "open" : "klaar",
        bron: taak.bron,
        ...(taak.deadline === undefined ? {} : { deadline: taak.deadline }),
        ...(taak.phaseId === undefined ? {} : { phaseId: taak.phaseId }),
        ...(taak.notitie === undefined ? {} : { notitie: taak.notitie }),
      });
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function wisTaak(taak: TaakMetId) {
    if (!uid || !projectId) return;

    setBezig(true);
    setFout(null);
    try {
      await verwijderTaak(uid, projectId, taak.id);
      setGelukt(`“${taak.titel}” is verwijderd.`);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Verwijderen"));
    } finally {
      setBezig(false);
    }
  }

  if (!uid || bezigMetLaden) return <Laadscherm />;

  if (!projectId) {
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

  const nu = vandaag();
  const stand = telTaken(taken, nu);

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Tijdlijn</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Van koop tot garantie</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Zeven fases, met per fase de dingen die vaak misgaan. De actiepunten zijn suggesties —
        pas als je er een taak van maakt, gaan ze meetellen.
      </p>

      {stand.open > 0 && (
        <p className="mt-s3 text-body text-charcoal">
          <strong>{stand.open}</strong> open {stand.open === 1 ? "taak" : "taken"}
          {stand.verlopen > 0 && (
            <span className="text-clay-deep">
              {" "}
              · {stand.verlopen} over de datum
            </span>
          )}
          {stand.dezeWeek > 0 && <span> · {stand.dezeWeek} deze week</span>}
        </p>
      )}

      {fout && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}
      {gelukt && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="gelukt">{gelukt}</Melding>
        </div>
      )}

      <div className="mt-s4 flex max-w-2xl flex-col gap-s3">
        {fases.map((fase) => {
          const beschrijving = FASE_VOLGORDE.find((f) => f.type === fase.type);
          const eigenTaken = sorteerTaken(
            taken.filter((t) => t.phaseId === fase.id),
            nu,
          );

          return (
            <section
              key={fase.id}
              className={[
                "brink-card p-s3",
                fase.status === "bezig" ? "ring-2 ring-clay" : "",
                fase.status === "klaar" ? "opacity-70" : "",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-h3 text-ink">{fase.titel}</h2>
                {fase.streefdatum && (
                  <span className="text-sm text-granite">
                    streefdatum {toonDatum(fase.streefdatum)}
                  </span>
                )}
              </div>

              {beschrijving && <p className="mt-1 text-body text-slate">{beschrijving.uitleg}</p>}

              <div className="mt-s3 grid gap-s2 sm:grid-cols-2">
                <Keuzeveld
                  label="Status"
                  waarde={fase.status}
                  opties={FASESTATUSOPTIES}
                  disabled={bezig}
                  onKies={(status) => {
                    void wijzigFase(fase, { status });
                  }}
                />
                <Datumveld
                  label="Streefdatum (optioneel)"
                  waarde={fase.streefdatum}
                  disabled={bezig}
                  onKies={(streefdatum) => {
                    void wijzigFase(fase, { streefdatum });
                  }}
                />
              </div>

              {beschrijving && beschrijving.actiepunten.length > 0 && (
                <details className="mt-s3">
                  <summary className="cursor-pointer text-body font-semibold text-ink">
                    Waar het hier vaak misgaat ({beschrijving.actiepunten.length})
                  </summary>
                  <ul className="mt-s2 flex flex-col gap-s2">
                    {beschrijving.actiepunten.map((punt) => (
                      <Actiepuntregel
                        key={punt.titel}
                        punt={punt}
                        onMaakTaak={(titel) => {
                          setNieuwBijFase(fase.id);
                          setNieuweTitel(titel);
                          setNieuweDeadline(undefined);
                          setFout(null);
                          setGelukt(null);
                        }}
                      />
                    ))}
                  </ul>
                </details>
              )}

              {eigenTaken.length > 0 && (
                <ul className="mt-s3 flex flex-col gap-s2">
                  {eigenTaken.map((taak) => {
                    const urgentie = taakUrgentie(taak, nu);
                    const termijn = toonTermijn(taak, nu);

                    return (
                      <li
                        key={taak.id}
                        className="flex flex-wrap items-center gap-s2 rounded-consent border border-bone bg-lifted px-4 py-3"
                      >
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 accent-clay"
                          checked={taak.status === "klaar"}
                          disabled={bezig}
                          aria-label={`${taak.titel} afvinken`}
                          onChange={() => {
                            void wisselAf(taak);
                          }}
                        />
                        <span
                          className={[
                            "flex-1 text-body",
                            taak.status === "klaar" ? "text-granite line-through" : "text-ink",
                          ].join(" ")}
                        >
                          {taak.titel}
                        </span>

                        {termijn && (
                          <span
                            className={`rounded-pill px-3 py-1 text-sm ${URGENTIESTIJL[urgentie] ?? ""}`}
                          >
                            {termijn}
                          </span>
                        )}

                        <button
                          type="button"
                          className="text-sm text-slate underline hover:text-ink"
                          onClick={() => {
                            void wisTaak(taak);
                          }}
                        >
                          Verwijderen
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {nieuwBijFase === fase.id ? (
                <div className="mt-s3 flex flex-col gap-s2 border-t border-bone pt-s3">
                  <Veld
                    label="Taak"
                    value={nieuweTitel}
                    onChange={(e) => {
                      setNieuweTitel(e.target.value);
                    }}
                  />
                  <Datumveld
                    label="Deadline (optioneel)"
                    waarde={nieuweDeadline}
                    onKies={setNieuweDeadline}
                  />
                  <div className="flex flex-wrap gap-s2">
                    <Knop
                      bezig={bezig}
                      onClick={() => void voegTaakToe(fase.id, nieuweTitel, nieuweDeadline)}
                    >
                      Toevoegen
                    </Knop>
                    <Knop
                      variant="secundair"
                      onClick={() => {
                        setNieuwBijFase(null);
                      }}
                    >
                      Annuleren
                    </Knop>
                  </div>
                </div>
              ) : (
                <div className="mt-s3">
                  <Knop
                    variant="secundair"
                    onClick={() => {
                      setNieuwBijFase(fase.id);
                      setNieuweTitel("");
                      setNieuweDeadline(undefined);
                      setFout(null);
                      setGelukt(null);
                    }}
                  >
                    Taak toevoegen
                  </Knop>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-s4 max-w-2xl text-sm text-granite">
        De termijnen bij de actiepunten zijn wat gangbaar is bij nieuwbouw met een Woningborg- of
        SWK-garantie. Ze staan er als geheugensteun; je eigen contract is leidend.
      </p>
    </AppShell>
  );
}
