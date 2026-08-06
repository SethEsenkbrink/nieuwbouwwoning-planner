import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Bedragveld } from "@/components/Bedragveld";
import { Datumveld } from "@/components/Datumveld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { Voortgangsbalk } from "@/components/Voortgangsbalk";
import { useAuth } from "@/context/useAuth";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum, vandaag } from "@/lib/datum";

import { leesBedragInvoer, toonBedrag } from "@/lib/bedrag";
import { depotDekking, sorteerTermijnen, telDepot, termijnstand } from "@/lib/depot";
import {
  haalActiefProject,
  haalTermijnen,
  verwijderTermijn,
  zetTermijn,
} from "@/lib/projecten";
import type { ProjectMetId, TermijnData, TermijnMetId } from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Bouwdepot — drie stappen die los van elkaar slepen
 *
 * De aannemer factureert → jij declareert bij de bank → de bank betaalt. Drie
 * booleans in plaats van één statusveld, omdat ze in de praktijk niet netjes
 * gelijk oplopen (`PROJECT.md` §5).
 *
 * BOVENAAN STAAT WAT JIJ MOET DOEN, NIET WAT ER AL BETAALD IS.
 * Een factuur die je hebt ontvangen maar niet hebt ingediend, is de enige stap
 * in de keten waar jíj aan zet bent — en het is geld dat stilstaat terwijl de
 * aannemer op betaling wacht. Een depotoverzicht dat alleen het totaal toont,
 * laat precies dat actiepunt weg.
 *
 * De vinkjes zetten automatisch de bijbehorende datum op vandaag, en wissen hem
 * weer als je het vinkje uitzet. Een betaaldatum bij een termijn die niet
 * betaald is, is erger dan geen datum.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const LEEG = { omschrijving: "", bedrag: "" };

export default function Bouwdepot() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [termijnen, setTermijnen] = useState<TermijnMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const [nieuw, setNieuw] = useState(false);
  const [verwijderId, setVerwijderId] = useState<string | null>(null);
  const [formulier, setFormulier] = useState(LEEG);

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

        const geladen = await haalTermijnen(uid, gevonden.id);
        if (!actueel) return;

        setProject(gevonden);
        setTermijnen(geladen);
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

  /** Het hele document, zodat een overschrijving niets ongemerkt wist. */
  function alsData(termijn: TermijnMetId, patch: Partial<TermijnData> = {}): TermijnData {
    const samen = { ...termijn, ...patch };
    return {
      omschrijving: samen.omschrijving,
      gefactureerd: samen.gefactureerd,
      gedeclareerdBijBank: samen.gedeclareerdBijBank,
      betaald: samen.betaald,
      ...(samen.bedrag === undefined ? {} : { bedrag: samen.bedrag }),
      ...(samen.gefactureerdOp === undefined ? {} : { gefactureerdOp: samen.gefactureerdOp }),
      ...(samen.gedeclareerdOp === undefined ? {} : { gedeclareerdOp: samen.gedeclareerdOp }),
      ...(samen.betaaldOp === undefined ? {} : { betaaldOp: samen.betaaldOp }),
    };
  }

  /**
   * Zet een vinkje om, inclusief de bijbehorende datum. Aanzetten vult vandaag
   * in als er nog niets staat; uitzetten wist de datum, want een betaaldatum bij
   * een onbetaalde termijn is misleidend.
   */
  async function wisselStap(
    termijn: TermijnMetId,
    vinkje: "gefactureerd" | "gedeclareerdBijBank" | "betaald",
    datumveld: "gefactureerdOp" | "gedeclareerdOp" | "betaaldOp",
  ) {
    if (!uid || !project) return;

    const aan = !termijn[vinkje];
    setBezig(true);
    setFout(null);
    try {
      await zetTermijn(
        uid,
        project.id,
        termijn.id,
        alsData(termijn, {
          [vinkje]: aan,
          // BUG-02: een aangevinkte dag hoort op middernacht te staan, net als
          // overal elders. Met een kaal `new Date()` zit de kloktijd erin, en dan
          // is deze waarde nooit `===` aan een datum uit een `<input type="date">`.
          // `vandaag()` pakt bovendien de lókale dag — zie BUG-03.
          [datumveld]: aan ? (termijn[datumveld] ?? vandaag()) : undefined,
        }),
      );
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function wijzigDatum(
    termijn: TermijnMetId,
    datumveld: "gefactureerdOp" | "gedeclareerdOp" | "betaaldOp",
    datum: Date | undefined,
  ) {
    if (!uid || !project) return;

    setBezig(true);
    setFout(null);
    try {
      await zetTermijn(uid, project.id, termijn.id, alsData(termijn, { [datumveld]: datum }));
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function voegToe() {
    if (!uid || !project) return;

    if (formulier.omschrijving.trim() === "") {
      setFout("Geef de termijn een omschrijving, bijvoorbeeld “3e termijn — ruwe vloer”.");
      return;
    }
    const leeg = formulier.bedrag.trim() === "";
    const bedrag = leeg ? undefined : leesBedragInvoer(formulier.bedrag);
    if (!leeg && bedrag === undefined) {
      setFout("Dit bedrag kan ik niet lezen. Bijvoorbeeld: 1250 of 1.250,50.");
      return;
    }

    setBezig(true);
    setFout(null);
    try {
      await zetTermijn(uid, project.id, null, {
        omschrijving: formulier.omschrijving.trim(),
        gefactureerd: false,
        gedeclareerdBijBank: false,
        betaald: false,
        ...(bedrag === undefined ? {} : { bedrag }),
      });
      setGelukt("Termijn toegevoegd.");
      setNieuw(false);
      setFormulier(LEEG);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(termijn: TermijnMetId) {
    if (!uid || !project) return;

    setBezig(true);
    setFout(null);
    try {
      await verwijderTermijn(uid, project.id, termijn.id);
      setGelukt(`“${termijn.omschrijving}” is verwijderd.`);
      setVerwijderId(null);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Verwijderen"));
    } finally {
      setBezig(false);
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

  const stand = telDepot(termijnen);
  const gesorteerd = sorteerTermijnen(termijnen);
  const dekking = depotDekking(stand, project.koopsom);

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Bouwdepot</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Wat er al betaald is, en wat nog niet</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Elke bouwtermijn doorloopt drie stappen: de aannemer factureert, jij declareert bij de
        bank, en de bank betaalt. Die drie lopen zelden gelijk op — daarom staan ze los van
        elkaar.
      </p>

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

      {stand.aantalTeDeclareren > 0 && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="fout">
            {stand.aantalTeDeclareren}{" "}
            {stand.aantalTeDeclareren === 1 ? "factuur staat" : "facturen staan"} nog niet bij de
            bank ingediend — samen {toonBedrag(stand.teDeclareren)}. Zolang je dat niet doet,
            wacht de aannemer op zijn geld.
          </Melding>
        </div>
      )}

      {/* ── Het totaalbeeld ─────────────────────────────────────────────── */}
      <section className="brink-card mt-s4 max-w-2xl p-s3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-h3 text-ink">Stand van het depot</h2>
          <span className="text-body text-ink">{toonBedrag(stand.totaal)} totaal</span>
        </div>

        <div className="mt-s3">
          <Voortgangsbalk
            toon={toonBedrag}
            segmenten={[
              { label: "Betaald", waarde: stand.betaald, kleur: "bg-olive" },
              {
                label: "Wacht op de bank",
                waarde: stand.wachtOpBank,
                kleur: "bg-olive-light",
                toelichting: "Ingediend; de bank moet nog uitbetalen.",
              },
              {
                label: "Nog te declareren",
                waarde: stand.teDeclareren,
                kleur: "bg-clay",
                toelichting: "Hier ben jij aan zet.",
              },
              {
                label: "Nog niet gefactureerd",
                waarde: stand.nogNietGefactureerd,
                kleur: "bg-taupe",
              },
            ]}
          />
        </div>

        {dekking !== undefined && (
          <p className="mt-s3 text-sm text-granite">
            De termijnen samen zijn {dekking}% van de koopsom ({toonBedrag(project.koopsom)}).
            Het verschil zit meestal in de grond, die bij de notaris is voldaan.
          </p>
        )}

        {stand.zonderBedrag > 0 && (
          <p className="mt-s2 text-sm text-granite">
            {stand.zonderBedrag} {stand.zonderBedrag === 1 ? "termijn heeft" : "termijnen hebben"}{" "}
            nog geen bedrag — de bedragen hierboven zijn dus een ondergrens.
          </p>
        )}

        {project.koopsom === undefined && (
          <p className="mt-s2 text-sm text-granite">
            Geen koopsom ingevuld.{" "}
            <Link to="/project" className="underline">
              Doe dat bij je projectgegevens
            </Link>{" "}
            om te zien welk deel via het depot loopt.
          </p>
        )}
      </section>

      {/* ── Toevoegen ───────────────────────────────────────────────────── */}
      <div className="mt-s3 max-w-2xl">
        {nieuw ? (
          <section className="brink-card p-s3">
            <h2 className="text-h3 text-ink">Nieuwe termijn</h2>
            <div className="mt-s3 flex flex-col gap-s2">
              <Veld
                label="Omschrijving"
                hint="Zoals op de factuur, bijvoorbeeld “3e termijn — ruwe vloer”."
                value={formulier.omschrijving}
                onChange={(e) => {
                  setFormulier((f) => ({ ...f, omschrijving: e.target.value }));
                }}
              />
              <Bedragveld
                label="Bedrag (optioneel)"
                hint="Wat de aannemer voor deze termijn factureert."
                waarde={formulier.bedrag}
                onWijzig={(tekst) => {
                  setFormulier((f) => ({ ...f, bedrag: tekst }));
                }}
              />
              <div className="flex flex-wrap gap-s2">
                <Knop bezig={bezig} onClick={() => void voegToe()}>
                  Toevoegen
                </Knop>
                <Knop
                  variant="secundair"
                  onClick={() => {
                    setNieuw(false);
                  }}
                >
                  Annuleren
                </Knop>
              </div>
            </div>
          </section>
        ) : (
          <Knop
            onClick={() => {
              setNieuw(true);
              setVerwijderId(null);
              setFout(null);
              setGelukt(null);
              setFormulier(LEEG);
            }}
          >
            Termijn toevoegen
          </Knop>
        )}
      </div>

      {termijnen.length === 0 && !nieuw && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="info">
            Nog geen termijnen. Het termijnschema staat in je aannemingsovereenkomst — neem het
            hier over, dan zie je straks in één oogopslag wat er nog openstaat.
          </Melding>
        </div>
      )}

      {/* ── De termijnen ────────────────────────────────────────────────── */}
      <div className="mt-s4 flex max-w-2xl flex-col gap-s2">
        {gesorteerd.map((termijn) => {
          const huidig = termijnstand(termijn);

          return (
            <article key={termijn.id} className="brink-card p-s3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-body font-semibold text-ink">{termijn.omschrijving}</h3>
                <span className="text-body text-ink">{toonBedrag(termijn.bedrag)}</span>
              </div>

              {huidig === "gefactureerd" && (
                <p className="mt-1 text-sm text-clay-deep">
                  Nog niet ingediend bij de bank — hier ben jij aan zet.
                </p>
              )}

              <div className="mt-s3 flex flex-col gap-s2">
                {(
                  [
                    ["gefactureerd", "gefactureerdOp", "Gefactureerd door de aannemer"],
                    ["gedeclareerdBijBank", "gedeclareerdOp", "Gedeclareerd bij de bank"],
                    ["betaald", "betaaldOp", "Betaald door de bank"],
                  ] as const
                ).map(([vinkje, datumveld, label]) => (
                  <div key={vinkje} className="flex flex-wrap items-center gap-s2">
                    <label className="flex flex-1 items-center gap-s2">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-clay"
                        checked={termijn[vinkje]}
                        disabled={bezig}
                        onChange={() => {
                          void wisselStap(termijn, vinkje, datumveld);
                        }}
                      />
                      <span
                        className={`text-body ${termijn[vinkje] ? "text-ink" : "text-slate"}`}
                      >
                        {label}
                      </span>
                    </label>

                    {termijn[vinkje] && (
                      <div className="w-44">
                        <Datumveld
                          label="op"
                          waarde={termijn[datumveld]}
                          disabled={bezig}
                          onKies={(datum) => {
                            void wijzigDatum(termijn, datumveld, datum);
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {verwijderId === termijn.id ? (
                <div className="mt-s3 flex flex-col gap-s2">
                  <Melding soort="fout">
                    “{termijn.omschrijving}” verwijderen? Dit kan niet teruggedraaid worden.
                  </Melding>
                  <div className="flex flex-wrap gap-s2">
                    <Knop bezig={bezig} onClick={() => void verwijder(termijn)}>
                      Ja, verwijderen
                    </Knop>
                    <Knop
                      variant="secundair"
                      onClick={() => {
                        setVerwijderId(null);
                      }}
                    >
                      Annuleren
                    </Knop>
                  </div>
                </div>
              ) : (
                <div className="mt-s3 flex flex-wrap items-center gap-s2">
                  <Knop
                    variant="secundair"
                    onClick={() => {
                      setVerwijderId(termijn.id);
                    }}
                  >
                    Verwijderen
                  </Knop>
                  {termijn.betaaldOp && (
                    <span className="text-sm text-granite">
                      Betaald op {toonDatum(termijn.betaaldOp)}
                    </span>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
