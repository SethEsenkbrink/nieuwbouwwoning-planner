import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Bedragveld } from "@/components/Bedragveld";
import { Tekstvlak } from "@/components/Tekstvlak";
import { Datumveld } from "@/components/Datumveld";
import { Keuzeveld, type Keuze } from "@/components/Keuzeveld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useVault as useAuth } from "@/context/useVault";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum, vandaag } from "@/lib/datum";
import { leesBedragInvoer, toonBedrag } from "@/lib/bedrag";

import { naarPlanningContext } from "@/lib/actielijst";
import {
  bepaalOnderhoudstermijn,
  berekenGaranties,
  gebrekstand,
  sorteerGebreken,
  telGebreken,
  ONDERHOUDSTERMIJN_DAGEN,
  type Gebrekstand,
} from "@/lib/oplevering";
import {
  haalActiefProject,
  haalAnkers,
  haalGebreken,
  verwijderGebrek,
  werkProjectBij,
  zetGebrek,
} from "@/lib/projecten";
import type { AnkerMetId, GebrekData, GebrekMetId, ProjectMetId } from "@/lib/converters";
import type { OpschortingStatus } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Oplevering — de opleverpunten en het 5%-depot
 *
 * TWEE DINGEN DIE HIER GELD KOSTEN ALS JE NIETS DOET
 *
 * 1. **Het 5%-opschortingsrecht.** Je mag doorgaans 5% van de aanneemsom bij de
 *    notaris in depot houden tot de punten hersteld zijn — maar je moet het
 *    zelf inroepen. Doe je niets, dan gaat het bedrag alsnog naar de aannemer.
 * 2. **De hersteltermijn per punt.** Verstrijkt die, dan verschuift het gesprek
 *    van "wanneer komt u het maken" naar "waarom is het nog niet gemaakt".
 *
 * DE UITERSTE DATUM VOOR HET DEPOT WORDT AFGELEID (ADR-0012), uit het anker
 * `einde_onderhoudstermijn` of anders uit de oplevering plus 90 dagen. Bij de
 * tweede staat dat er expliciet bij — een standaardtermijn is geen contract.
 *
 * HET BEDRAG WORDT NIET UITGEREKEND. De 5% geldt over de aanneemsom, en de
 * koopsom die de app kent bevat ook de grond. Zelf rekenen levert stelselmatig
 * een te hoog bedrag op, en dat als feit tonen is erger dan een leeg veld.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const OPSCHORTINGOPTIES: readonly Keuze<OpschortingStatus>[] = [
  {
    waarde: "onbekend",
    label: "Nog niet over besloten",
    toelichting: "Je hebt nog geen keuze gemaakt. Let op de uiterste datum hieronder.",
  },
  {
    waarde: "in_depot",
    label: "Het bedrag staat in depot",
    toelichting: "Je hebt het opschortingsrecht ingeroepen; de notaris houdt het bedrag vast.",
  },
  {
    waarde: "vrijgegeven",
    label: "Vrijgegeven aan de aannemer",
    toelichting: "De punten zijn hersteld en je hebt de notaris opdracht gegeven te betalen.",
  },
  {
    waarde: "niet_gebruikt",
    label: "Niet gebruikt",
    toelichting: "Bewust niet gebruikt, of de termijn is verstreken.",
  },
];

const STANDSTIJL: Record<Gebrekstand, string> = {
  termijn_verlopen: "bg-clay text-canvas",
  open: "bg-bone text-charcoal",
  hersteld: "bg-olive/10 text-olive-deep",
};

const STANDLABEL: Record<Gebrekstand, string> = {
  termijn_verlopen: "termijn verlopen",
  open: "open",
  hersteld: "hersteld",
};

const LEEG = {
  omschrijving: "",
  locatie: "",
  gemeldOp: undefined as Date | undefined,
  hersteltermijn: undefined as Date | undefined,
};

export default function Oplevering() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [ankers, setAnkers] = useState<AnkerMetId[]>([]);
  const [gebreken, setGebreken] = useState<GebrekMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const [bewerktId, setBewerktId] = useState<string | null>(null);
  const [nieuw, setNieuw] = useState(false);
  const [verwijderId, setVerwijderId] = useState<string | null>(null);
  const [formulier, setFormulier] = useState(LEEG);

  // Het depotblok slaat apart op van de opleverpunten.
  const [status, setStatus] = useState<OpschortingStatus>("onbekend");
  const [bedrag, setBedrag] = useState("");
  const [notitie, setNotitie] = useState("");
  const [bezigMetDepot, setBezigMetDepot] = useState(false);

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

        const [geladenAnkers, geladenGebreken] = await Promise.all([
          haalAnkers(uid, gevonden.id),
          haalGebreken(uid, gevonden.id),
        ]);
        if (!actueel) return;

        setProject(gevonden);
        setAnkers(geladenAnkers);
        setGebreken(geladenGebreken);
        setStatus(gevonden.opschortingStatus ?? "onbekend");
        setBedrag(gevonden.opschortingBedrag === undefined ? "" : String(gevonden.opschortingBedrag));
        setNotitie(gevonden.opschortingNotitie ?? "");
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

  async function bewaarDepot() {
    if (!uid || !project) return;

    const leeg = bedrag.trim() === "";
    const getal = leeg ? undefined : leesBedragInvoer(bedrag);
    if (!leeg && getal === undefined) {
      setFout("Dit bedrag kan ik niet lezen. Bijvoorbeeld: 1250 of 1.250,50.");
      return;
    }

    setBezigMetDepot(true);
    setFout(null);
    setGelukt(null);
    try {
      await werkProjectBij(uid, project.id, {
        opschortingStatus: status,
        opschortingBedrag: getal,
        opschortingNotitie: notitie.trim() || undefined,
      });
      setGelukt("Opgeslagen.");
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetDepot(false);
    }
  }

  function beginBewerken(gebrek: GebrekMetId) {
    setBewerktId(gebrek.id);
    setNieuw(false);
    setVerwijderId(null);
    setFout(null);
    setGelukt(null);
    setFormulier({
      omschrijving: gebrek.omschrijving,
      locatie: gebrek.locatie ?? "",
      gemeldOp: gebrek.gemeldOp,
      hersteltermijn: gebrek.hersteltermijn,
    });
  }

  function bouwGebrek(bestaand: GebrekMetId | null): GebrekData {
    const locatie = formulier.locatie.trim();
    return {
      omschrijving: formulier.omschrijving.trim(),
      status: bestaand?.status ?? "open",
      ...(locatie === "" ? {} : { locatie }),
      ...(formulier.gemeldOp === undefined ? {} : { gemeldOp: formulier.gemeldOp }),
      ...(formulier.hersteltermijn === undefined
        ? {}
        : { hersteltermijn: formulier.hersteltermijn }),
    };
  }

  async function bewaarGebrek(bestaand: GebrekMetId | null) {
    if (!uid || !project) return;

    if (formulier.omschrijving.trim() === "") {
      setFout("Beschrijf wat er niet klopt.");
      return;
    }
    if (formulier.omschrijving.trim().length > 1000)
      return setFout("De omschrijving mag hooguit 1000 tekens zijn.");
    if (formulier.locatie.trim().length > 200)
      return setFout("De locatie mag hooguit 200 tekens zijn.");

    setBezig(true);
    setFout(null);
    try {
      await zetGebrek(uid, project.id, bestaand?.id ?? null, bouwGebrek(bestaand));
      setGelukt(bestaand ? "Opleverpunt bijgewerkt." : "Opleverpunt toegevoegd.");
      setBewerktId(null);
      setNieuw(false);
      setFormulier(LEEG);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function wisselHersteld(gebrek: GebrekMetId) {
    if (!uid || !project) return;

    setBezig(true);
    setFout(null);
    try {
      await zetGebrek(uid, project.id, gebrek.id, {
        omschrijving: gebrek.omschrijving,
        status: gebrek.status === "hersteld" ? "open" : "hersteld",
        ...(gebrek.locatie === undefined ? {} : { locatie: gebrek.locatie }),
        ...(gebrek.gemeldOp === undefined ? {} : { gemeldOp: gebrek.gemeldOp }),
        ...(gebrek.hersteltermijn === undefined
          ? {}
          : { hersteltermijn: gebrek.hersteltermijn }),
      });
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(gebrek: GebrekMetId) {
    if (!uid || !project) return;

    setBezig(true);
    setFout(null);
    try {
      await verwijderGebrek(uid, project.id, gebrek.id);
      setGelukt("Opleverpunt verwijderd.");
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

  const nu = vandaag();
  const context = naarPlanningContext(project, ankers);
  const termijn = bepaalOnderhoudstermijn(context, nu);
  const stand = telGebreken(gebreken, nu);
  const gesorteerd = sorteerGebreken(gebreken, nu);
  const garanties = berekenGaranties(context, nu);

  const formulierVelden = (bestaand: GebrekMetId | null) => (
    <div className="mt-s2 flex flex-col gap-s2 border-t border-bone pt-s3">
      <Tekstvlak
        label="Wat klopt er niet?"
        value={formulier.omschrijving}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, omschrijving: e.target.value }));
        }}
      />
      <Veld
        label="Waar in de woning? (optioneel)"
        hint="Bijvoorbeeld “slaapkamer 2, kozijn noordzijde”."
        value={formulier.locatie}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, locatie: e.target.value }));
        }}
      />
      <div className="grid gap-s2 sm:grid-cols-2">
        <Datumveld
          label="Gemeld op (optioneel)"
          waarde={formulier.gemeldOp}
          onKies={(gemeldOp) => {
            setFormulier((f) => ({ ...f, gemeldOp }));
          }}
        />
        <Datumveld
          label="Hersteltermijn (optioneel)"
          hint="De datum waarop de aannemer het hersteld zou hebben."
          waarde={formulier.hersteltermijn}
          onKies={(hersteltermijn) => {
            setFormulier((f) => ({ ...f, hersteltermijn }));
          }}
        />
      </div>
      <div className="flex flex-wrap gap-s2">
        <Knop bezig={bezig} onClick={() => void bewaarGebrek(bestaand)}>
          {bestaand ? "Opslaan" : "Opleverpunt toevoegen"}
        </Knop>
        <Knop
          variant="secundair"
          onClick={() => {
            setBewerktId(null);
            setNieuw(false);
            setFormulier(LEEG);
          }}
        >
          Annuleren
        </Knop>
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Oplevering</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Opleverpunten en het 5%-depot</h1>

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

      {stand.termijnVerlopen > 0 && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="fout">
            Bij {stand.termijnVerlopen}{" "}
            {stand.termijnVerlopen === 1 ? "punt is" : "punten is"} de afgesproken hersteltermijn
            verstreken.
          </Melding>
        </div>
      )}

      {/* ── Het 5%-depot ────────────────────────────────────────────────── */}
      <section className="brink-card mt-s4 max-w-2xl p-s3">
        <h2 className="text-h3 text-ink">Het 5%-depot</h2>
        <p className="mt-s2 text-body text-slate">
          Bij nieuwbouw mag je meestal 5% van de <strong>aanneemsom</strong> bij de notaris in
          depot houden totdat de opleverpunten hersteld zijn. Dat gaat niet vanzelf: je moet het
          zelf aangeven. Doe je niets, dan gaat het bedrag alsnog naar de aannemer.
        </p>

        {termijn ? (
          <div className="mt-s3">
            <Melding soort={termijn.dagenResterend < 0 ? "fout" : "info"}>
              {termijn.dagenResterend < 0 ? (
                <>
                  De onderhoudstermijn liep tot {toonDatum(termijn.eindigtOp)} en is{" "}
                  {Math.abs(termijn.dagenResterend)} dagen geleden verstreken.
                </>
              ) : (
                <>
                  De onderhoudstermijn loopt tot {toonDatum(termijn.eindigtOp)} — nog{" "}
                  {termijn.dagenResterend} dagen.
                </>
              )}{" "}
              {termijn.bron === "standaardtermijn" && (
                <>
                  Gerekend met de standaardtermijn van {ONDERHOUDSTERMIJN_DAGEN} dagen na de
                  oplevering, omdat het bouwmoment “einde onderhoudstermijn” nog niet is
                  ingevuld.{" "}
                  <Link to="/ankers" className="underline">
                    Vul de echte datum in
                  </Link>{" "}
                  als je die kent — je eigen contract is leidend.
                </>
              )}
            </Melding>
          </div>
        ) : (
          <p className="mt-s3 text-sm text-granite">
            Nog geen opleverdatum bekend, dus de termijn is nog niet te bepalen.{" "}
            <Link to="/project" className="underline">
              Vul hem in bij je project.
            </Link>
          </p>
        )}

        <div className="mt-s3 flex flex-col gap-s2">
          <Keuzeveld
            label="Wat heb je gedaan?"
            waarde={status}
            opties={OPSCHORTINGOPTIES}
            onKies={setStatus}
          />
          <Bedragveld
            label="Bedrag in depot (optioneel)"
            hint="Kijk in je aannemingsovereenkomst. De app rekent dit niet zelf uit: de 5% geldt over de aanneemsom, en de koopsom bevat ook de grond."
            waarde={bedrag}
            onWijzig={setBedrag}
          />
          <Tekstvlak
            label="Notitie (optioneel)"
            value={notitie}
            onChange={(e) => {
              setNotitie(e.target.value);
            }}
          />
          <div>
            <Knop bezig={bezigMetDepot} onClick={() => void bewaarDepot()}>
              Opslaan
            </Knop>
          </div>
        </div>

        {project.opschortingBedrag !== undefined && (
          <p className="mt-s3 text-sm text-granite">
            Nu vastgelegd: {toonBedrag(project.opschortingBedrag)}.
          </p>
        )}
      </section>

      {/* ── Garantietermijnen ───────────────────────────────────────────── */}
      <section className="brink-card mt-s3 max-w-2xl p-s3">
        <h2 className="text-h3 text-ink">Garantietermijnen</h2>
        <p className="mt-s2 text-body text-slate">
          Alle termijnen lopen vanaf de oplevering, dus ze schuiven mee als die verschuift. Ze
          worden daarom niet opgeslagen maar telkens opnieuw berekend.
        </p>

        {garanties ? (
          <ul className="mt-s3 flex flex-col gap-s2">
            {garanties.map((garantie) => (
              <li
                key={garantie.sleutel}
                className={[
                  "rounded-consent border px-4 py-3",
                  garantie.dagenResterend < 0
                    ? "border-bone bg-bone/50"
                    : garantie.bijnaVoorbij
                      ? "border-clay/30 bg-clay/10"
                      : "border-bone bg-lifted",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3
                    className={`text-body font-semibold ${
                      garantie.dagenResterend < 0 ? "text-granite" : "text-ink"
                    }`}
                  >
                    {garantie.titel}
                  </h3>
                  <span
                    className={`text-sm ${
                      garantie.bijnaVoorbij ? "text-clay-deep" : "text-granite"
                    }`}
                  >
                    {garantie.dagenResterend < 0
                      ? `verlopen op ${toonDatum(garantie.verstrijktOp)}`
                      : `tot ${toonDatum(garantie.verstrijktOp)} · nog ${garantie.dagenResterend} dagen`}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate">{garantie.uitleg}</p>
                {garantie.voorHetAfloopt && garantie.dagenResterend >= 0 && (
                  <p
                    className={`mt-1 text-sm ${
                      garantie.bijnaVoorbij ? "text-clay-deep" : "text-granite"
                    }`}
                  >
                    Vóór het afloopt: {garantie.voorHetAfloopt}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-s3 text-sm text-granite">
            Nog geen opleverdatum bekend, dus er valt nog niets af te tellen.
          </p>
        )}

        <p className="mt-s3 text-sm text-granite">
          Fabrieksgaranties per apparaat (cv-ketel, kozijnen, dakbedekking) staan hier bewust
          niet bij: die hangen aan het specifieke merk en type, en dat komt in het
          onderdelenregister.
        </p>
      </section>

      {/* ── De opleverpunten ────────────────────────────────────────────── */}
      <section className="mt-s6 max-w-2xl">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-h3 text-ink">Opleverpunten</h2>
          {stand.totaal > 0 && (
            <span className="text-sm text-granite">
              {stand.open} open · {stand.hersteld} hersteld
            </span>
          )}
        </div>
        <p className="mt-s2 text-body text-slate">
          Alles wat bij de oplevering niet klopte. Zet erbij waar het zit en wanneer de aannemer
          het hersteld zou hebben — herstelde punten blijven staan, want ze horen bij het
          proces-verbaal.
        </p>

        <div className="mt-s3">
          {nieuw ? (
            <div className="brink-card p-s3">
              <h3 className="text-body font-semibold text-ink">Nieuw opleverpunt</h3>
              {formulierVelden(null)}
            </div>
          ) : (
            <Knop
              onClick={() => {
                setNieuw(true);
                setBewerktId(null);
                setVerwijderId(null);
                setFout(null);
                setGelukt(null);
                setFormulier(LEEG);
              }}
            >
              Opleverpunt toevoegen
            </Knop>
          )}
        </div>

        {gebreken.length === 0 && !nieuw && (
          <div className="mt-s3">
            <Melding soort="info">
              Nog geen opleverpunten. Neem ze over uit het proces-verbaal van oplevering — wat
              daar niet in staat, is later lastiger hard te maken.
            </Melding>
          </div>
        )}

        <div className="mt-s3 flex flex-col gap-s2">
          {gesorteerd.map((gebrek) => {
            const huidig = gebrekstand(gebrek, nu);
            const wordtBewerkt = bewerktId === gebrek.id;

            return (
              <article key={gebrek.id} className="brink-card p-s3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <label className="flex flex-1 items-start gap-s2">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 accent-clay"
                      checked={gebrek.status === "hersteld"}
                      disabled={bezig}
                      aria-label="Als hersteld markeren"
                      onChange={() => {
                        void wisselHersteld(gebrek);
                      }}
                    />
                    <span
                      className={`text-body ${
                        gebrek.status === "hersteld" ? "text-granite line-through" : "text-ink"
                      }`}
                    >
                      {gebrek.omschrijving}
                    </span>
                  </label>
                  <span className={`rounded-pill px-3 py-1 text-sm ${STANDSTIJL[huidig]}`}>
                    {STANDLABEL[huidig]}
                  </span>
                </div>

                <dl className="mt-s2 grid grid-cols-[auto_1fr] gap-x-s2 gap-y-1 text-sm">
                  {gebrek.locatie && (
                    <>
                      <dt className="text-slate">Locatie</dt>
                      <dd className="text-ink">{gebrek.locatie}</dd>
                    </>
                  )}
                  {gebrek.gemeldOp && (
                    <>
                      <dt className="text-slate">Gemeld op</dt>
                      <dd className="text-ink">{toonDatum(gebrek.gemeldOp)}</dd>
                    </>
                  )}
                  {gebrek.hersteltermijn && (
                    <>
                      <dt className="text-slate">Hersteltermijn</dt>
                      <dd className={huidig === "termijn_verlopen" ? "text-clay-deep" : "text-ink"}>
                        {toonDatum(gebrek.hersteltermijn)}
                      </dd>
                    </>
                  )}
                </dl>

                {verwijderId === gebrek.id ? (
                  <div className="mt-s2 flex flex-col gap-s2">
                    <Melding soort="fout">
                      Dit opleverpunt verwijderen? Het verdwijnt daarmee ook uit je eigen
                      administratie van wat er gemeld is.
                    </Melding>
                    <div className="flex flex-wrap gap-s2">
                      <Knop bezig={bezig} onClick={() => void verwijder(gebrek)}>
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
                  !wordtBewerkt && (
                    <div className="mt-s3 flex flex-wrap gap-s2">
                      <Knop
                        variant="secundair"
                        onClick={() => {
                          beginBewerken(gebrek);
                        }}
                      >
                        Aanpassen
                      </Knop>
                      <Knop
                        variant="secundair"
                        onClick={() => {
                          setVerwijderId(gebrek.id);
                          setBewerktId(null);
                        }}
                      >
                        Verwijderen
                      </Knop>
                    </div>
                  )
                )}

                {wordtBewerkt && formulierVelden(gebrek)}
              </article>
            );
          })}
        </div>
      </section>

      <p className="mt-s4 max-w-2xl text-sm text-granite">
        De genoemde termijnen zijn wat gangbaar is bij nieuwbouw met een Woningborg- of
        SWK-garantie. Dit is geen juridisch advies; je eigen contract is leidend.
      </p>
    </AppShell>
  );
}
