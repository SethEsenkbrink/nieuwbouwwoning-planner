import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Datumveld } from "@/components/Datumveld";
import { Keuzeveld, type Keuze } from "@/components/Keuzeveld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useAuth } from "@/context/useAuth";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum, vandaag } from "@/lib/datum";
import { Impactmelding } from "@/components/Impactmelding";
import { naarAfspraakInvoer, naarBetrokkeneInvoer, naarPlanningContext } from "@/lib/actielijst";

import { berekenImpact } from "@/lib/watals";
import {
  haalActiefProject,
  haalAfspraken,
  haalAnkers,
  haalBetrokkenen,
  verwijderAnker,
  zetAnker,
} from "@/lib/projecten";
import type {
  AfspraakMetId,
  AnkerMetId,
  BetrokkeneMetId,
  ProjectMetId,
} from "@/lib/converters";
import type { AnkerStatus, AnkerType } from "@/types/model";
import {
  ANKERSTATUS_LABELS,
  ANKER_VOLGORDE,
  INVULBARE_ANKERS,
  type AnkerBeschrijving,
} from "@/data/ankers";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Bouwmomenten — het scherm waar de planning zijn houvast vandaan haalt
 *
 * Afspraken hangen aan een bouwmoment plus een offset, nooit aan een vaste
 * datum (ADR-0008). Dit scherm is de plek waar die bouwmomenten een datum
 * krijgen. Vul je er één in, dan schuiven alle afspraken die eraan hangen
 * automatisch mee.
 *
 * DRIE DINGEN DIE HIER BEWUST ZO ZIJN
 *
 * 1. NIETS INVULLEN IS EEN GELDIGE TOESTAND. Wie net begint kent alleen een
 *    indicatieve opleverdatum. Elke afspraak valt dan terug op de oplevering
 *    met `zekerheid: "teruggevallen"`. De app moet in die toestand bruikbaar
 *    zijn én er eerlijk over zijn — vandaar dat elke lege rij laat zien hoeveel
 *    afspraken erdoor onnauwkeurig worden.
 *
 * 2. DE DATUM LEEGMAKEN VERWIJDERT HET BOUWMOMENT. Een anker zonder datum telt
 *    in `berekenDatum()` toch niet mee; het laten staan zou alleen maar
 *    suggereren dat er iets bekend is.
 *
 * 3. DE OPLEVERING IS HIER NIET BEWERKBAAR. Die leeft als band op het project
 *    (vroegst / verwacht / laatst + staat), en `berekenDatum()` geeft die band
 *    voorrang boven een los `oplevering`-anker. Twee plekken om hem in te
 *    vullen zou betekenen dat er één stilletjes genegeerd wordt.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const STATUSOPTIES: readonly Keuze<AnkerStatus>[] = [
  { waarde: "verwacht", label: "Verwacht", toelichting: ANKERSTATUS_LABELS.verwacht },
  { waarde: "bevestigd", label: "Bevestigd", toelichting: ANKERSTATUS_LABELS.bevestigd },
  { waarde: "gepasseerd", label: "Gepasseerd", toelichting: ANKERSTATUS_LABELS.gepasseerd },
];

const OPLEVERSTATUSTEKST = {
  indicatief: "indicatief — nog een schatting",
  bandbreedte: "bandbreedte — tussen twee datums",
  aangezegd: "aangezegd — formeel vastgelegd",
} as const;

/** Hoeveel afspraken er aan elk bouwmoment hangen. */
function telPerAnker(afspraken: readonly AfspraakMetId[]): Partial<Record<AnkerType, number>> {
  const telling: Partial<Record<AnkerType, number>> = {};
  for (const afspraak of afspraken) {
    telling[afspraak.ankerType] = (telling[afspraak.ankerType] ?? 0) + 1;
  }
  return telling;
}

export default function Ankers() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [ankers, setAnkers] = useState<AnkerMetId[]>([]);
  const [afspraken, setAfspraken] = useState<AfspraakMetId[]>([]);
  const [betrokkenen, setBetrokkenen] = useState<BetrokkeneMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);

  const [bewerktType, setBewerktType] = useState<AnkerType | null>(null);
  const [datum, setDatum] = useState<Date | undefined>(undefined);
  const [status, setStatus] = useState<AnkerStatus>("verwacht");
  const [bron, setBron] = useState("");
  const [bezig, setBezig] = useState(false);

  // Ophogen betekent "haal opnieuw op" — zo blijft het laden één effect zonder
  // dat er synchroon state gezet wordt in de effect-body.
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
          setAnkers([]);
          setAfspraken([]);
          setBetrokkenen([]);
          return;
        }

        const [geladenAnkers, geladenAfspraken, geladenBetrokkenen] = await Promise.all([
          haalAnkers(uid, gevonden.id),
          haalAfspraken(uid, gevonden.id),
          haalBetrokkenen(uid, gevonden.id),
        ]);
        if (!actueel) return;
        setProject(gevonden);
        setAnkers(geladenAnkers);
        setAfspraken(geladenAfspraken);
        setBetrokkenen(geladenBetrokkenen);
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

  function beginBewerken(beschrijving: AnkerBeschrijving, bestaand: AnkerMetId | undefined) {
    setBewerktType(beschrijving.type);
    setDatum(bestaand?.verwachtOp);
    setStatus(bestaand?.status ?? "verwacht");
    setBron(bestaand?.bron ?? "");
    setFout(null);
    setGelukt(null);
  }

  async function bewaar(beschrijving: AnkerBeschrijving, bestaand: AnkerMetId | undefined) {
    if (!uid || !project) return;

    setBezig(true);
    setFout(null);
    try {
      if (datum === undefined) {
        // Leeg opslaan = het bouwmoment is niet (meer) bekend.
        if (bestaand) {
          await verwijderAnker(uid, project.id, bestaand.id);
          setGelukt(`${beschrijving.titel} is weer onbekend gemaakt.`);
        }
      } else {
        const schoneBron = bron.trim();
        await zetAnker(uid, project.id, bestaand?.id ?? null, {
          type: beschrijving.type,
          titel: beschrijving.titel,
          verwachtOp: datum,
          status,
          ...(schoneBron === "" ? {} : { bron: schoneBron }),
        });
        setGelukt(`${beschrijving.titel} staat op ${toonDatum(datum)}.`);
      }
      setBewerktType(null);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
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

  const perType = new Map(ankers.map((a) => [a.type, a]));
  const telling = telPerAnker(afspraken);
  const aantalBekend = INVULBARE_ANKERS.filter(
    (b) => perType.get(b.type)?.verwachtOp !== undefined,
  ).length;

  // Afspraken die aan een onbekend bouwmoment hangen en dus terugvallen op de
  // opleverdatum. Dit getal is de reden dat dit scherm bestaat.
  const aantalTeruggevallen = ANKER_VOLGORDE.filter(
    (b) => b.type !== "oplevering" && perType.get(b.type)?.verwachtOp === undefined,
  ).reduce((som, b) => som + (telling[b.type] ?? 0), 0);

  /**
   * De ankerlijst zoals hij eruit zou zien als je nu opslaat. `titel` doet er
   * niet toe: `naarAnkerInvoer` kijkt alleen naar type, status en datum.
   */
  function ankersNaWijziging(): AnkerMetId[] {
    if (bewerktType === null) return ankers;
    const zonder = ankers.filter((a) => a.type !== bewerktType);
    if (datum === undefined) return zonder;
    return [...zonder, { id: "concept", type: bewerktType, titel: "", status, verwachtOp: datum }];
  }

  const impact =
    bewerktType === null
      ? null
      : berekenImpact(
          afspraken.map(naarAfspraakInvoer),
          betrokkenen.map(naarBetrokkeneInvoer),
          naarPlanningContext(project, ankers),
          naarPlanningContext(project, ankersNaWijziging()),
          vandaag(),
        );

  const isBand =
    project.opleverStatus === "bandbreedte" &&
    project.opleverVroegst !== undefined &&
    project.opleverLaatst !== undefined &&
    project.opleverVroegst.getTime() !== project.opleverLaatst.getTime();

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Bouwmomenten</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Waar je planning aan vasthangt</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Je afspraken hangen aan een bouwmoment, niet aan een vaste datum. Vul een moment in en
        alles wat eraan hangt schuift mee. Wat je niet weet laat je leeg — dan rekent de app
        vanaf de oplevering en zegt er eerlijk bij dat het een schatting is.
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

      {aantalTeruggevallen > 0 && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="info">
            {aantalTeruggevallen} {aantalTeruggevallen === 1 ? "afspraak wordt" : "afspraken worden"}{" "}
            nu vanaf de opleverdatum gerekend, omdat het bouwmoment waaraan{" "}
            {aantalTeruggevallen === 1 ? "hij hangt" : "ze hangen"} nog niet bekend is. Dat werkt,
            maar het kan er weken naast zitten — zeker bij de dekvloer en de ruwbouw.
          </Melding>
        </div>
      )}

      <p className="mt-s3 text-sm text-granite">
        {aantalBekend} van de {INVULBARE_ANKERS.length} bouwmomenten ingevuld.
      </p>

      <div className="mt-s3 flex max-w-2xl flex-col gap-s2">
        {ANKER_VOLGORDE.map((beschrijving) => {
          const bestaand = perType.get(beschrijving.type);
          const aantal = telling[beschrijving.type] ?? 0;
          const isOplevering = beschrijving.type === "oplevering";
          const wordtBewerkt = bewerktType === beschrijving.type;

          return (
            <article key={beschrijving.type} className="brink-card p-s3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-body font-semibold text-ink">{beschrijving.titel}</h2>
                {aantal > 0 && (
                  <span className="rounded-pill bg-bone px-3 py-1 text-sm text-granite">
                    {aantal} {aantal === 1 ? "afspraak" : "afspraken"}
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-slate">{beschrijving.uitleg}</p>

              {isOplevering ? (
                // De band van het project, niet bewerkbaar op dit scherm.
                <div className="mt-s2 flex flex-wrap items-end justify-between gap-s2">
                  <div>
                    {project.opleverStatus ? (
                      <>
                        <p className="text-body text-ink">
                          {isBand
                            ? `tussen ${toonDatum(project.opleverVroegst)} en ${toonDatum(project.opleverLaatst)}`
                            : toonDatum(project.opleverVerwacht)}
                        </p>
                        <p className="mt-1 text-sm text-slate">
                          {OPLEVERSTATUSTEKST[project.opleverStatus]}
                        </p>
                        {project.opleverBron && (
                          <p className="mt-1 text-sm text-granite">Bron: {project.opleverBron}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-body text-slate">Nog geen opleverdatum ingevuld.</p>
                    )}
                  </div>
                  <Link to="/project">
                    <Knop variant="secundair">Opleverdatum aanpassen</Knop>
                  </Link>
                </div>
              ) : wordtBewerkt ? (
                <div className="mt-s2 flex flex-col gap-s2">
                  <Datumveld
                    label="Datum"
                    hint="Leeglaten betekent: dit moment is nog niet bekend."
                    waarde={datum}
                    onKies={setDatum}
                  />
                  <Keuzeveld
                    label="Hoe hard is deze datum?"
                    waarde={status}
                    opties={STATUSOPTIES}
                    onKies={setStatus}
                    disabled={datum === undefined}
                  />
                  <Veld
                    label="Bron"
                    hint="Waar komt deze datum vandaan? Bijvoorbeeld “bouwvergadering 03-09”."
                    value={bron}
                    disabled={datum === undefined}
                    onChange={(e) => {
                      setBron(e.target.value);
                    }}
                  />

                  {datum === undefined && bestaand && (
                    <Melding soort="info">
                      Zonder datum verdwijnt dit bouwmoment. De {aantal}{" "}
                      {aantal === 1 ? "afspraak die" : "afspraken die"} eraan{" "}
                      {aantal === 1 ? "hangt" : "hangen"} blijven bestaan en worden weer vanaf de
                      oplevering gerekend.
                    </Melding>
                  )}

                  {impact && impact.aantalGeraakt > 0 && <Impactmelding impact={impact} />}

                  <div className="flex gap-s2">
                    <Knop bezig={bezig} onClick={() => void bewaar(beschrijving, bestaand)}>
                      Opslaan
                    </Knop>
                    <Knop
                      variant="secundair"
                      onClick={() => {
                        setBewerktType(null);
                      }}
                    >
                      Annuleren
                    </Knop>
                  </div>
                </div>
              ) : (
                <div className="mt-s2 flex flex-wrap items-end justify-between gap-s2">
                  <div>
                    {bestaand?.verwachtOp ? (
                      <>
                        <p className="text-body text-ink">{toonDatum(bestaand.verwachtOp)}</p>
                        <p className="mt-1 text-sm text-slate">
                          {ANKERSTATUS_LABELS[bestaand.status]}
                        </p>
                        {bestaand.bron && (
                          <p className="mt-1 text-sm text-granite">Bron: {bestaand.bron}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-body text-slate">Nog niet bekend</p>
                        {aantal > 0 && (
                          <p className="mt-1 text-sm text-granite">
                            {aantal === 1 ? "Deze afspraak wordt" : "Deze afspraken worden"} nu
                            vanaf de opleverdatum gerekend.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <Knop
                    variant="secundair"
                    onClick={() => {
                      beginBewerken(beschrijving, bestaand);
                    }}
                  >
                    {bestaand?.verwachtOp ? "Aanpassen" : "Datum invullen"}
                  </Knop>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
