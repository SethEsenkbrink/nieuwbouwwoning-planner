import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Keuzeveld } from "@/components/Keuzeveld";
import { Datumveld } from "@/components/Datumveld";
import { Tekstvlak } from "@/components/Tekstvlak";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useAuth } from "@/context/useAuth";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum } from "@/lib/datum";
import { toonBedrag } from "@/lib/bedrag";
import { opDag } from "@/lib/planning";
import { isOpgeleverd } from "@/lib/woning";
import {
  maakOnderhoudslijst,
  takenZonderStartpunt,
  telOnderhoud,
  toonInterval,
  toonMaand,
  type Onderhoudsregel,
} from "@/lib/onderhoud";
import { STANDAARD_ONDERHOUD } from "@/data/onderhoud-standaard";
import {
  haalActiefProject,
  haalOnderdelen,
  haalOnderhoudslogboek,
  haalOnderhoudstaken,
  verwijderLogregel,
  verwijderOnderhoudstaak,
  vinkOnderhoudAf,
  voegStandaardOnderhoudToe,
  zetOnderhoudstaak,
} from "@/lib/projecten";
import type {
  OnderdeelMetId,
  OnderhoudLogregelMetId,
  OnderhoudTaakMetId,
  ProjectMetId,
} from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Onderhoud — het terugkerende werk (ADR-0014, blok E3)
 *
 * DIT SCHERM IS DE HERINNERING. ADR-0010 §4 wilde e-mail; ADR-0014 §3 stelt dat
 * uit tot ronde 8 en legt de taak hier neer. Daarom staat achterstallig werk
 * bovenaan en niet verstopt achter een filter, en daarom staat dezelfde lijst
 * ook op het dashboard.
 *
 * AFVINKEN SCHRIJFT ALTIJD EEN LOGREGEL. Dat gebeurt in de datalaag als één
 * batch (ADR-0014 §2): `laatstUitgevoerdOp` bijwerken én vastleggen wat er is
 * gedaan. Zonder die tweede stap overschrijft elke beurt de vorige en blijft er
 * een datum over zonder verhaal.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface Taakformulier {
  titel: string;
  omschrijving: string;
  intervalDagen: string;
  voorkeursmaand: string;
  onderdeelId: string;
  waarschuwing: string;
}

const LEEG: Taakformulier = {
  titel: "",
  omschrijving: "",
  intervalDagen: "365",
  voorkeursmaand: "",
  onderdeelId: "",
  waarschuwing: "",
};

/** Wat er bij het afvinken wordt vastgelegd. */
interface Afvinkformulier {
  uitgevoerdOp: Date | undefined;
  doorWie: string;
  kosten: string;
  notitie: string;
}

const MAANDOPTIES = [
  { waarde: "", label: "Geen voorkeursmaand" },
  ...Array.from({ length: 12 }, (_, i) => ({
    waarde: String(i + 1),
    label: toonMaand(i + 1) ?? "",
  })),
];

export default function Onderhoud() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [taken, setTaken] = useState<OnderhoudTaakMetId[]>([]);
  const [onderdelen, setOnderdelen] = useState<OnderdeelMetId[]>([]);
  const [logboek, setLogboek] = useState<OnderhoudLogregelMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);

  const [formulier, setFormulier] = useState<Taakformulier | null>(null);
  const [bewerktId, setBewerktId] = useState<string | null>(null);
  const [bezigMetOpslaan, setBezigMetOpslaan] = useState(false);
  const [bezigMetId, setBezigMetId] = useState<string | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<string | null>(null);

  const [afvinkt, setAfvinkt] = useState<string | null>(null);
  const [afvink, setAfvink] = useState<Afvinkformulier>({
    uitgevoerdOp: undefined,
    doorWie: "",
    kosten: "",
    notitie: "",
  });

  const [gekozenStandaard, setGekozenStandaard] = useState<Set<string>>(new Set());
  const [toonBibliotheek, setToonBibliotheek] = useState(false);
  const [toonHistorie, setToonHistorie] = useState<string | null>(null);

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

        const [geladenTaken, geladenOnderdelen, geladenLogboek] = await Promise.all([
          haalOnderhoudstaken(uid, gevonden.id),
          haalOnderdelen(uid, gevonden.id),
          haalOnderhoudslogboek(uid, gevonden.id),
        ]);
        if (!actueel) return;

        setProject(gevonden);
        setTaken(geladenTaken);
        setOnderdelen(geladenOnderdelen);
        setLogboek(geladenLogboek);
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

  function wijzig(patch: Partial<Taakformulier>) {
    setFormulier((f) => (f === null ? f : { ...f, ...patch }));
  }

  function beginBewerken(taak: OnderhoudTaakMetId) {
    setFormulier({
      titel: taak.titel,
      omschrijving: taak.omschrijving ?? "",
      intervalDagen: String(taak.intervalDagen),
      voorkeursmaand: taak.voorkeursmaand === undefined ? "" : String(taak.voorkeursmaand),
      onderdeelId: taak.onderdeelId ?? "",
      waarschuwing: taak.waarschuwing ?? "",
    });
    setBewerktId(taak.id);
    setFout(null);
    setGelukt(null);
  }

  async function bewaar() {
    if (!uid || !project || !formulier) return;

    if (formulier.titel.trim() === "") {
      setFout("Geef de taak een titel.");
      return;
    }

    const interval = Number(formulier.intervalDagen.trim());
    if (!Number.isInteger(interval) || interval < 1 || interval > 18250) {
      setFout("Vul het interval in als een heel aantal dagen tussen 1 en 18250.");
      return;
    }

    const bestaand = bewerktId ? taken.find((t) => t.id === bewerktId) : undefined;
    const maand =
      formulier.voorkeursmaand === "" ? undefined : Number(formulier.voorkeursmaand);

    setBezigMetOpslaan(true);
    setFout(null);
    setGelukt(null);
    try {
      await zetOnderhoudstaak(uid, project.id, bewerktId, {
        titel: formulier.titel.trim(),
        intervalDagen: interval,
        // Zodra de gebruiker een taak aanpast, is het interval van hem en niet
        // meer van onze bibliotheek — dan verdwijnt de disclaimer (ADR-0009).
        waardenBron: "eigen",
        ...(formulier.omschrijving.trim() ? { omschrijving: formulier.omschrijving.trim() } : {}),
        ...(formulier.onderdeelId ? { onderdeelId: formulier.onderdeelId } : {}),
        ...(maand === undefined ? {} : { voorkeursmaand: maand }),
        ...(formulier.waarschuwing.trim() ? { waarschuwing: formulier.waarschuwing.trim() } : {}),
        // De uitvoerdatum is een feit en mag niet wegvallen bij het bewerken —
        // `setDoc` overschrijft immers het hele document.
        ...(bestaand?.laatstUitgevoerdOp
          ? { laatstUitgevoerdOp: bestaand.laatstUitgevoerdOp }
          : {}),
      });

      setGelukt(bewerktId ? "Taak bijgewerkt." : "Taak toegevoegd.");
      setFormulier(null);
      setBewerktId(null);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetOpslaan(false);
    }
  }

  async function bevestigAfvinken(taak: OnderhoudTaakMetId) {
    if (!uid || !project) return;

    const kosten = afvink.kosten.trim();
    const bedrag = kosten === "" ? undefined : Number(kosten.replace(",", "."));
    if (bedrag !== undefined && (!Number.isFinite(bedrag) || bedrag < 0)) {
      setFout("Vul de kosten in als een bedrag, of laat het leeg.");
      return;
    }

    setBezigMetId(taak.id);
    setFout(null);
    try {
      await vinkOnderhoudAf(uid, project.id, taak, afvink.uitgevoerdOp ?? opDag(new Date()), {
        ...(afvink.doorWie.trim() ? { doorWie: afvink.doorWie.trim() } : {}),
        ...(bedrag === undefined ? {} : { kosten: Math.round(bedrag) }),
        ...(afvink.notitie.trim() ? { notitie: afvink.notitie.trim() } : {}),
      });
      setGelukt(`${taak.titel} afgevinkt en vastgelegd in het logboek.`);
      setAfvinkt(null);
      setAfvink({ uitgevoerdOp: undefined, doorWie: "", kosten: "", notitie: "" });
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetId(null);
    }
  }

  async function verwijder(taakId: string) {
    if (!uid || !project) return;

    setBezigMetId(taakId);
    setFout(null);
    try {
      await verwijderOnderhoudstaak(uid, project.id, taakId);
      setTeVerwijderen(null);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Verwijderen"));
    } finally {
      setBezigMetId(null);
    }
  }

  async function verwijderRegel(logId: string) {
    if (!uid || !project) return;

    setBezigMetId(logId);
    setFout(null);
    try {
      await verwijderLogregel(uid, project.id, logId);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Verwijderen"));
    } finally {
      setBezigMetId(null);
    }
  }

  async function voegStandaardToe() {
    if (!uid || !project || gekozenStandaard.size === 0) return;

    setBezigMetOpslaan(true);
    setFout(null);
    try {
      const teVoegen = STANDAARD_ONDERHOUD.filter((s) => gekozenStandaard.has(s.sleutel)).map(
        (s) => {
          // Koppel aan een onderdeel dat de gebruiker al heeft, als de naam
          // overeenkomt. Lukt dat niet, dan blijft de taak los staan.
          const onderdeel = onderdelen.find(
            (o) => o.naam.toLowerCase() === standaardOnderdeelnaam(s.onderdeelSleutel),
          );
          return {
            titel: s.titel,
            omschrijving: s.omschrijving,
            intervalDagen: s.intervalDagen,
            ...(s.voorkeursmaand === undefined ? {} : { voorkeursmaand: s.voorkeursmaand }),
            ...(onderdeel ? { onderdeelId: onderdeel.id } : {}),
            ...(s.waarschuwing ? { waarschuwing: s.waarschuwing } : {}),
          };
        },
      );

      const aantal = await voegStandaardOnderhoudToe(uid, project.id, teVoegen);
      setGelukt(`${aantal} ${aantal === 1 ? "taak" : "taken"} toegevoegd.`);
      setGekozenStandaard(new Set());
      setToonBibliotheek(false);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetOpslaan(false);
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

  const vandaag = opDag(new Date());
  const opleverdatum = project.opleverVerwacht;
  const lijst = maakOnderhoudslijst(taken, onderdelen, opleverdatum, vandaag);
  const zonderStartpunt = takenZonderStartpunt(taken, onderdelen, opleverdatum, vandaag);
  const standen = telOnderhoud(taken, onderdelen, opleverdatum, vandaag);
  const alGekozen = new Set(taken.map((t) => t.titel.toLowerCase()));

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Woning</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Onderhoud</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Wat er terugkomt, en wanneer. De volgende beurt wordt berekend uit de laatste keer plus
        het interval — er staat nooit een vaste datum opgeslagen.
      </p>

      {!isOpgeleverd(project) && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="info">
            De woning staat nog op “in aanbouw”. Je kunt het onderhoud alvast klaarzetten; de
            berekening gebruikt dan de opleverdatum als startpunt.{" "}
            <Link to="/woning" className="underline">
              Fase aanpassen
            </Link>
          </Melding>
        </div>
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

      {standen.achterstallig > 0 && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="fout">
            {standen.achterstallig === 1
              ? "Eén beurt is over tijd"
              : `${standen.achterstallig} beurten zijn over tijd`}
            . Vink af wat je gedaan hebt, of stel het interval bij als het niet klopt.
          </Melding>
        </div>
      )}

      {/* ── Taken toevoegen ─────────────────────────────────────────────── */}
      {formulier === null && !toonBibliotheek && (
        <div className="mt-s4 flex flex-wrap gap-s2">
          <Knop
            onClick={() => {
              setToonBibliotheek(true);
              setGelukt(null);
            }}
          >
            Uit de lijst kiezen
          </Knop>
          <Knop
            variant="secundair"
            onClick={() => {
              setFormulier({ ...LEEG });
              setBewerktId(null);
              setGelukt(null);
            }}
          >
            Eigen taak toevoegen
          </Knop>
        </div>
      )}

      {toonBibliotheek && (
        <section className="brink-card mt-s4 max-w-2xl p-s3">
          <h2 className="text-h3 text-ink">Standaardonderhoud</h2>
          <p className="mt-s2 text-body text-slate">
            Vink aan wat op jouw woning van toepassing is. De intervallen zijn voorstellen —
            het voorschrift van de fabrikant gaat altijd voor.
          </p>

          <div className="mt-s3 flex flex-col gap-2">
            {STANDAARD_ONDERHOUD.map((standaard) => {
              const alAanwezig = alGekozen.has(standaard.titel.toLowerCase());
              return (
                <label
                  key={standaard.sleutel}
                  className={`flex items-start gap-2 text-body ${alAanwezig ? "text-granite" : "text-ink"}`}
                >
                  <input
                    type="checkbox"
                    disabled={alAanwezig}
                    checked={gekozenStandaard.has(standaard.sleutel)}
                    onChange={(e) => {
                      setGekozenStandaard((huidig) => {
                        const nieuw = new Set(huidig);
                        if (e.target.checked) nieuw.add(standaard.sleutel);
                        else nieuw.delete(standaard.sleutel);
                        return nieuw;
                      });
                    }}
                    className="mt-1 size-4 rounded-xs border-bone text-olive"
                  />
                  <span>
                    {standaard.titel}
                    {alAanwezig && " — staat er al"}
                    <span className="mt-1 block text-sm text-slate">
                      {toonInterval(standaard.intervalDagen)}
                      {standaard.voorkeursmaand !== undefined &&
                        ` · in ${toonMaand(standaard.voorkeursmaand)}`}
                      {standaard.zelfTeDoen ? " · zelf te doen" : " · vakman"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-s3 flex flex-wrap gap-s2">
            <Knop
              bezig={bezigMetOpslaan}
              disabled={gekozenStandaard.size === 0}
              onClick={() => void voegStandaardToe()}
            >
              {gekozenStandaard.size === 0
                ? "Niets geselecteerd"
                : `${gekozenStandaard.size} toevoegen`}
            </Knop>
            <Knop
              variant="secundair"
              onClick={() => {
                setToonBibliotheek(false);
                setGekozenStandaard(new Set());
              }}
            >
              Annuleren
            </Knop>
          </div>
        </section>
      )}

      {formulier !== null && (
        <section className="brink-card mt-s4 max-w-2xl p-s3">
          <h2 className="text-h3 text-ink">{bewerktId ? "Taak bewerken" : "Eigen taak"}</h2>

          <div className="mt-s3 flex flex-col gap-s2">
            <Veld
              label="Titel"
              value={formulier.titel}
              onChange={(e) => {
                wijzig({ titel: e.target.value });
              }}
            />

            <Tekstvlak
              label="Omschrijving"
              value={formulier.omschrijving}
              onChange={(e) => {
                wijzig({ omschrijving: e.target.value });
              }}
            />

            <div className="grid gap-s2 sm:grid-cols-2">
              <Veld
                label="Interval (dagen)"
                inputMode="numeric"
                hint="30 = maandelijks, 182 = halfjaarlijks, 365 = jaarlijks."
                value={formulier.intervalDagen}
                onChange={(e) => {
                  wijzig({ intervalDagen: e.target.value });
                }}
              />
              <Keuzeveld<string>
                label="Voorkeursmaand"
                hint="Alleen bij seizoenswerk. De datum schuift dan naar de dichtstbijzijnde keer dat die maand langskomt."
                waarde={formulier.voorkeursmaand}
                opties={MAANDOPTIES}
                onKies={(voorkeursmaand) => {
                  wijzig({ voorkeursmaand });
                }}
              />
            </div>

            <Keuzeveld<string>
              label="Hoort bij onderdeel"
              hint="Koppelen betekent dat de installatiedatum als startpunt telt zolang je nog niet hebt afgevinkt."
              waarde={formulier.onderdeelId}
              opties={[
                { waarde: "", label: "Niet gekoppeld" },
                ...onderdelen.map((o) => ({ waarde: o.id, label: o.naam })),
              ]}
              onKies={(onderdeelId) => {
                wijzig({ onderdeelId });
              }}
            />

            <Tekstvlak
              label="Waarschuwing"
              hint="Wat er misgaat als je het overslaat. Verschijnt bij de taak."
              value={formulier.waarschuwing}
              onChange={(e) => {
                wijzig({ waarschuwing: e.target.value });
              }}
            />
          </div>

          <div className="mt-s3 flex flex-wrap gap-s2">
            <Knop bezig={bezigMetOpslaan} onClick={() => void bewaar()}>
              {bewerktId ? "Wijzigingen opslaan" : "Taak toevoegen"}
            </Knop>
            <Knop
              variant="secundair"
              onClick={() => {
                setFormulier(null);
                setBewerktId(null);
              }}
            >
              Annuleren
            </Knop>
          </div>
        </section>
      )}

      {/* ── De lijst ────────────────────────────────────────────────────── */}
      <section className="mt-s6 max-w-2xl">
        <h2 className="text-h3 text-ink">
          {taken.length === 0
            ? "Nog geen onderhoud vastgelegd"
            : `${taken.length} ${taken.length === 1 ? "taak" : "taken"}`}
        </h2>

        {taken.length > 0 && (
          <p className="mt-s2 text-sm text-granite">
            {standen.achterstallig} over tijd · {standen.binnenkort} binnen een maand
            {standen.onbekend > 0 && ` · ${standen.onbekend} zonder startpunt`}
          </p>
        )}

        {taken.length === 0 ? (
          <div className="mt-s2">
            <Melding soort="info">
              Begin bij wat het vaakst terugkomt: WTW-filters, zout in de waterontharder en het
              testen van de rookmelders. Dat zijn de drie die je zonder lijst vergeet.
            </Melding>
          </div>
        ) : (
          <div className="mt-s3 flex flex-col gap-s2">
            {lijst.map((regel) => (
              <Onderhoudskaart
                key={regel.taak.id}
                regel={regel}
                logboek={logboek.filter((l) => l.taakId === regel.taak.id)}
                bezig={bezigMetId === regel.taak.id}
                afvinkt={afvinkt === regel.taak.id}
                afvink={afvink}
                toonHistorie={toonHistorie === regel.taak.id}
                teVerwijderen={teVerwijderen === regel.taak.id}
                onStartAfvinken={() => {
                  setAfvinkt(regel.taak.id);
                  setAfvink({
                    uitgevoerdOp: vandaag,
                    doorWie: "",
                    kosten: "",
                    notitie: "",
                  });
                  setGelukt(null);
                }}
                onWijzigAfvink={(patch) => {
                  setAfvink((a) => ({ ...a, ...patch }));
                }}
                onBevestigAfvinken={() => void bevestigAfvinken(regel.taak)}
                onAnnuleerAfvinken={() => {
                  setAfvinkt(null);
                }}
                onBewerken={() => {
                  beginBewerken(regel.taak);
                }}
                onToonHistorie={() => {
                  setToonHistorie(toonHistorie === regel.taak.id ? null : regel.taak.id);
                }}
                onVraagVerwijderen={() => {
                  setTeVerwijderen(regel.taak.id);
                }}
                onAnnuleerVerwijderen={() => {
                  setTeVerwijderen(null);
                }}
                onVerwijderen={() => void verwijder(regel.taak.id)}
                onVerwijderRegel={(logId) => void verwijderRegel(logId)}
              />
            ))}

            {zonderStartpunt.map((taak) => (
              <article key={taak.id} className="brink-card p-s3">
                <h3 className="text-body font-semibold text-ink">{taak.titel}</h3>
                <p className="mt-s2 text-sm text-slate">
                  {toonInterval(taak.intervalDagen)} — maar er is nog geen startpunt. Vul een
                  opleverdatum in bij het project, koppel de taak aan een onderdeel met een
                  installatiedatum, of vink hem één keer af.
                </p>
                <div className="mt-s3 flex flex-wrap gap-s2">
                  <Knop
                    variant="secundair"
                    onClick={() => {
                      beginBewerken(taak);
                    }}
                  >
                    Bewerken
                  </Knop>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

/** Vertaalt een onderdeelsleutel uit de bibliotheek naar de naam die erbij hoort. */
function standaardOnderdeelnaam(sleutel: string | undefined): string {
  if (!sleutel) return "";
  const namen: Record<string, string> = {
    warmtepomp: "warmtepomp",
    cv_ketel: "cv-ketel",
    wtw_unit: "wtw-unit (balansventilatie)",
    boiler: "boiler / warmtapwatervat",
    waterontharder: "waterontharder",
    drinkwaterfilter: "drinkwaterfilter",
    groepenkast: "groepenkast",
    zonnepanelen: "zonnepanelen",
    rookmelders: "rookmelders",
    kozijnen: "kozijnen en beglazing",
    hang_en_sluitwerk: "hang- en sluitwerk",
    dakbedekking: "dakbedekking",
    zonwering: "zonwering",
    vloerverwarmingsverdeler: "vloerverwarmingsverdeler",
  };
  return namen[sleutel] ?? "";
}

interface KaartProps {
  regel: Onderhoudsregel;
  logboek: readonly OnderhoudLogregelMetId[];
  bezig: boolean;
  afvinkt: boolean;
  afvink: Afvinkformulier;
  toonHistorie: boolean;
  teVerwijderen: boolean;
  onStartAfvinken: () => void;
  onWijzigAfvink: (patch: Partial<Afvinkformulier>) => void;
  onBevestigAfvinken: () => void;
  onAnnuleerAfvinken: () => void;
  onBewerken: () => void;
  onToonHistorie: () => void;
  onVraagVerwijderen: () => void;
  onAnnuleerVerwijderen: () => void;
  onVerwijderen: () => void;
  onVerwijderRegel: (logId: string) => void;
}

const BRONTEKST = {
  uitgevoerd: "gerekend vanaf de laatste beurt",
  installatie: "gerekend vanaf de installatiedatum — nog nooit afgevinkt",
  oplevering: "gerekend vanaf de opleverdatum — een aanname, nog nooit afgevinkt",
} as const;

function Onderhoudskaart({
  regel,
  logboek,
  bezig,
  afvinkt,
  afvink,
  toonHistorie,
  teVerwijderen,
  onStartAfvinken,
  onWijzigAfvink,
  onBevestigAfvinken,
  onAnnuleerAfvinken,
  onBewerken,
  onToonHistorie,
  onVraagVerwijderen,
  onAnnuleerVerwijderen,
  onVerwijderen,
  onVerwijderRegel,
}: KaartProps) {
  const { taak, stand, onderdeelNaam } = regel;
  const overTijd = stand.urgentie === "achterstallig";

  return (
    <article className={`brink-card p-s3 ${overTijd ? "border border-clay/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-body font-semibold text-ink">{taak.titel}</h3>
          <p className="mt-1 text-sm text-slate">
            {toonInterval(taak.intervalDagen)}
            {taak.voorkeursmaand !== undefined && ` · in ${toonMaand(taak.voorkeursmaand)}`}
            {onderdeelNaam && ` · ${onderdeelNaam}`}
          </p>
        </div>
        <span
          className={`rounded-pill px-3 py-1 text-sm ${
            overTijd ? "bg-clay/15 text-clay-deep" : "bg-bone text-charcoal"
          }`}
        >
          {overTijd
            ? `${Math.abs(stand.dagenResterend)} dagen over tijd`
            : stand.dagenResterend === 0
              ? "vandaag"
              : `over ${stand.dagenResterend} dagen`}
        </span>
      </div>

      <p className="mt-s2 text-body text-ink">
        Volgende keer: {toonDatum(stand.volgendeOp)}
      </p>
      <p className="mt-1 text-sm text-granite">
        {BRONTEKST[stand.bron]}
        {stand.verschovenNaarMaand &&
          ` · verschoven naar ${toonMaand(taak.voorkeursmaand)}`}
      </p>

      {taak.waardenBron === "voorstel" && (
        <p className="mt-1 text-sm text-granite">
          Voorstel — controleer het interval in het onderhoudsvoorschrift van je installatie.
        </p>
      )}

      {taak.omschrijving && <p className="mt-s2 text-body text-slate">{taak.omschrijving}</p>}

      {taak.waarschuwing && (
        <div className="mt-s2">
          <Melding soort="info">{taak.waarschuwing}</Melding>
        </div>
      )}

      {/* ── Afvinken ─────────────────────────────────────────────────── */}
      {afvinkt ? (
        <div className="mt-s3 rounded-consent border border-bone p-s3">
          <h4 className="text-body font-semibold text-ink">Beurt vastleggen</h4>
          <p className="mt-1 text-sm text-slate">
            Dit werkt de volgende datum bij én schrijft een regel in het logboek.
          </p>

          <div className="mt-s2 flex flex-col gap-s2">
            <Datumveld
              label="Uitgevoerd op"
              waarde={afvink.uitgevoerdOp}
              onKies={(uitgevoerdOp) => {
                onWijzigAfvink({ uitgevoerdOp });
              }}
            />
            <div className="grid gap-s2 sm:grid-cols-2">
              <Veld
                label="Door wie"
                placeholder="Zelf, of de naam van het bedrijf"
                value={afvink.doorWie}
                onChange={(e) => {
                  onWijzigAfvink({ doorWie: e.target.value });
                }}
              />
              <Veld
                label="Kosten (€)"
                inputMode="numeric"
                value={afvink.kosten}
                onChange={(e) => {
                  onWijzigAfvink({ kosten: e.target.value });
                }}
              />
            </div>
            <Veld
              label="Notitie"
              placeholder="Bijv. het besteld filtertype"
              value={afvink.notitie}
              onChange={(e) => {
                onWijzigAfvink({ notitie: e.target.value });
              }}
            />
          </div>

          <div className="mt-s3 flex flex-wrap gap-s2">
            <Knop bezig={bezig} onClick={onBevestigAfvinken}>
              Vastleggen
            </Knop>
            <Knop variant="secundair" onClick={onAnnuleerAfvinken}>
              Annuleren
            </Knop>
          </div>
        </div>
      ) : (
        <div className="mt-s3 flex flex-wrap items-center gap-s2">
          <Knop onClick={onStartAfvinken}>Gedaan</Knop>
          <Knop variant="secundair" onClick={onBewerken}>
            Bewerken
          </Knop>

          {logboek.length > 0 && (
            <button type="button" onClick={onToonHistorie} className="text-sm text-slate underline">
              {toonHistorie
                ? "Historie verbergen"
                : `Historie (${logboek.length}${logboek.length === 1 ? " beurt" : " beurten"})`}
            </button>
          )}

          {teVerwijderen ? (
            <>
              <Knop bezig={bezig} onClick={onVerwijderen}>
                Definitief verwijderen
              </Knop>
              <Knop variant="secundair" onClick={onAnnuleerVerwijderen}>
                Annuleren
              </Knop>
            </>
          ) : (
            <button
              type="button"
              onClick={onVraagVerwijderen}
              className="text-sm text-slate underline"
            >
              Verwijderen
            </button>
          )}
        </div>
      )}

      {/* ── Historie ─────────────────────────────────────────────────── */}
      {toonHistorie && logboek.length > 0 && (
        <ul className="mt-s3 flex flex-col gap-2 border-t border-bone pt-s3">
          {logboek.map((log) => (
            <li key={log.id} className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-body text-ink">{toonDatum(log.uitgevoerdOp)}</p>
                <p className="text-sm text-slate">
                  {log.doorWie ?? "—"}
                  {log.kosten !== undefined && ` · ${toonBedrag(log.kosten)}`}
                </p>
                {log.notitie && <p className="text-sm text-granite">{log.notitie}</p>}
              </div>
              <button
                type="button"
                onClick={() => {
                  onVerwijderRegel(log.id);
                }}
                className="text-sm text-slate underline"
              >
                Wissen
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
