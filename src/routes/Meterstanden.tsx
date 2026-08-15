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
import { useVault as useAuth } from "@/context/useVault";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum, vandaag } from "@/lib/datum";

import { isOpgeleverd } from "@/lib/woning";
import {
  conflicterendeMeters,
  decimalenVan,
  isTeruglevering,
  leesStandInvoer,
  overzichtVoorAlleMeters,
  toonEenheid,
  toonPerDag,
  toonStand,
  type Meterstandsoverzicht,
  type Verbruiksperiode,
  type Verbruikstrend,
} from "@/lib/meterstanden";
import {
  METERBIBLIOTHEEK,
  METEREENHEIDOPTIES,
  OPNAME_VERS_DAGEN,
  meterdefinitieVoor,
} from "@/data/meters-standaard";
import {
  haalActiefProject,
  haalMeters,
  haalMeterstanden,
  verwijderMeter,
  verwijderMeterstand,
  zetMeter,
  zetMeterstand,
} from "@/lib/projecten";
import type { MeterMetId, MeterstandMetId, ProjectMetId } from "@/lib/converters";
import type { Metereenheid, Metersoort } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Meterstanden (ADR-0015, blok E7)
 *
 * TWEE SOORTEN DOCUMENTEN OP ÉÉN SCHERM: de meter (wát je meet) en de opname
 * (wat hij aanwees). Dat onderscheid is de kern van ADR-0015 §1 — zou de
 * meternaam op elke opname staan, dan splitst één typefout de reeks stil in
 * tweeën.
 *
 * ER STAAT NERGENS EEN VERBRUIK OPGESLAGEN. Alles wat je hieronder aan
 * getallen ziet komt uit `lib/meterstanden.ts` en wordt bij elke render
 * opnieuw gerekend uit de standen. Corrigeer je een verkeerd overgetypte
 * stand, dan kloppen de periodes ervóór én erná meteen weer.
 *
 * EEN GEDAALDE STAND WORDT GETOOND, NIET WEGGEREKEND. Een typefout, een
 * vervangen meter of een omloop bij 99999 leveren alle drie een negatief
 * verschil op, en de app kan niet weten welke van de drie het was. De periode
 * krijgt daarom een melding in plaats van een getal (ADR-0015 §4).
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface Meterformulier {
  soort: Metersoort;
  naam: string;
  eenheid: Metereenheid;
  meternummer: string;
  notitie: string;
}

const LEGE_METER: Meterformulier = {
  soort: "stroom_normaal",
  naam: "",
  eenheid: "kWh",
  meternummer: "",
  notitie: "",
};

interface Opnameformulier {
  opgenomenOp: Date | undefined;
  stand: string;
  notitie: string;
}

const LEGE_OPNAME: Opnameformulier = {
  opgenomenOp: undefined,
  stand: "",
  notitie: "",
};

const SOORTOPTIES = METERBIBLIOTHEEK.map((m) => ({
  waarde: m.soort,
  label: m.label,
  toelichting: m.waarom,
}));

/** De uitleg bij een onbetrouwbare periode. Zegt wát je moet nakijken. */
function redenTekst(periode: Verbruiksperiode): string {
  switch (periode.reden) {
    case "zelfde_dag":
      return (
        "Twee opnames op dezelfde dag — een gemiddelde per dag is dan niet te geven. " +
        "Verwijder de opname die niet klopt."
      );
    case "volgt_op_zelfde_dag":
      return (
        "Het beginpunt is één van twee opnames van dezelfde dag, en welke dat is ligt niet " +
        "vast. Verwijder de overbodige opname; daarna klopt deze periode weer."
      );
    default:
      return (
        "De stand is gedaald. Meestal een typefout; anders is de meter vervangen (die begint " +
        "opnieuw bij 0) of omgelopen. Controleer de ingevoerde waarde."
      );
  }
}

export default function Meterstanden() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [meters, setMeters] = useState<MeterMetId[]>([]);
  const [opnames, setOpnames] = useState<MeterstandMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);

  const [meterformulier, setMeterformulier] = useState<Meterformulier | null>(null);
  const [bewerkteMeter, setBewerkteMeter] = useState<string | null>(null);
  const [teVerwijderenMeter, setTeVerwijderenMeter] = useState<string | null>(null);

  const [opnameVoor, setOpnameVoor] = useState<string | null>(null);
  const [opname, setOpname] = useState<Opnameformulier>({ ...LEGE_OPNAME });

  const [bezigMetOpslaan, setBezigMetOpslaan] = useState(false);
  const [bezigMetId, setBezigMetId] = useState<string | null>(null);
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

        const [geladenMeters, geladenOpnames] = await Promise.all([
          haalMeters(uid, gevonden.id),
          haalMeterstanden(uid, gevonden.id),
        ]);
        if (!actueel) return;

        setProject(gevonden);
        setMeters(geladenMeters);
        setOpnames(geladenOpnames);
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

  function wijzigMeter(patch: Partial<Meterformulier>) {
    setMeterformulier((f) => (f === null ? f : { ...f, ...patch }));
  }

  /**
   * Bij het wisselen van soort gaat de eenheid mee uit de bibliotheek. Alleen
   * bij `overig` blijft hij vrij — daar is geen voorstel voor.
   */
  function kiesSoort(soort: Metersoort) {
    const definitie = meterdefinitieVoor(soort);
    wijzigMeter({
      soort,
      ...(soort === "overig" || definitie === undefined ? {} : { eenheid: definitie.eenheid }),
    });
  }

  function beginBewerken(meter: MeterMetId) {
    setMeterformulier({
      soort: meter.soort,
      naam: meter.naam ?? "",
      eenheid: meter.eenheid,
      meternummer: meter.meternummer ?? "",
      notitie: meter.notitie ?? "",
    });
    setBewerkteMeter(meter.id);
    setOpnameVoor(null);
    setFout(null);
    setGelukt(null);
  }

  async function bewaarMeter() {
    if (!uid || !project || !meterformulier) return;

    // Bij `overig` is er geen bibliotheeklabel om op terug te vallen, dus dan
    // moet de gebruiker zelf een naam geven — anders staat er straks een
    // naamloze meter in de lijst.
    if (meterformulier.soort === "overig" && meterformulier.naam.trim() === "") {
      setFout("Geef je eigen meter een naam, bijvoorbeeld “Tussenmeter warmtepomp”.");
      return;
    }

    const bestaand = bewerkteMeter ? meters.find((m) => m.id === bewerkteMeter) : undefined;
    const definitie = meterdefinitieVoor(meterformulier.soort);
    // `waardenBron` gaat naar `eigen` zodra de eenheid afwijkt van wat de
    // bibliotheek voorstelt (ADR-0009). Blijft hij gelijk, dan is het nog
    // steeds ons voorstel en hoort de disclaimer te blijven staan.
    const eigenEenheid = definitie !== undefined && definitie.eenheid !== meterformulier.eenheid;

    setBezigMetOpslaan(true);
    setFout(null);
    setGelukt(null);
    try {
      await zetMeter(uid, project.id, bewerkteMeter, {
        soort: meterformulier.soort,
        eenheid: meterformulier.eenheid,
        waardenBron: eigenEenheid || bestaand?.waardenBron === "eigen" ? "eigen" : "voorstel",
        ...(meterformulier.naam.trim() ? { naam: meterformulier.naam.trim() } : {}),
        ...(meterformulier.meternummer.trim()
          ? { meternummer: meterformulier.meternummer.trim() }
          : {}),
        ...(meterformulier.notitie.trim() ? { notitie: meterformulier.notitie.trim() } : {}),
      });

      setGelukt(bewerkteMeter ? "Meter bijgewerkt." : "Meter toegevoegd.");
      setMeterformulier(null);
      setBewerkteMeter(null);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetOpslaan(false);
    }
  }

  async function bewaarOpname(meter: MeterMetId) {
    if (!uid || !project) return;

    const waarde = leesStandInvoer(opname.stand);
    if (waarde === undefined) {
      setFout("Vul de meterstand in als een getal van nul of hoger, bijvoorbeeld 12345,678.");
      return;
    }

    const nu = vandaag();
    const datum = opname.opgenomenOp ?? nu;

    // Een datum in de toekomst is altijd een typefout — meestal in het
    // jaartal. En het is de gevaarlijkste soort, want er komt géén melding
    // uit: het verbruik per dag wordt gedeeld door een veel te groot aantal
    // dagen en de uitkomst ziet er plausibel uit. 1300 kWh over "396 dagen"
    // levert 0,76 per dag in plaats van 9,68 — factor 12 mis, betrouwbaar
    // gemarkeerd. Zie ADR-0015 §4: liever zichtbaar niets dan stil fout.
    if (datum.getTime() > nu.getTime()) {
      setFout("Die datum ligt in de toekomst. Controleer het jaartal.");
      return;
    }

    // Waarschuwen vóór het opslaan in plaats van erna: de gebruiker heeft het
    // getal nog voor zich en kan het meteen nakijken. Opslaan mag wél — het
    // kan een vervangen meter zijn, en dan is de stand gewoon juist.
    const eerdere = opnames
      .filter((o) => o.meterId === meter.id && o.opgenomenOp.getTime() <= datum.getTime())
      .sort((a, b) => a.opgenomenOp.getTime() - b.opgenomenOp.getTime())
      .at(-1);

    setBezigMetId(meter.id);
    setFout(null);
    setGelukt(null);
    try {
      await zetMeterstand(uid, project.id, null, {
        meterId: meter.id,
        opgenomenOp: datum,
        stand: waarde,
        ...(opname.notitie.trim() ? { notitie: opname.notitie.trim() } : {}),
      });

      setGelukt(
        eerdere !== undefined && waarde < eerdere.stand
          ? "Opname vastgelegd — let op: deze stand is lager dan de vorige. Controleer of het " +
              "geen typefout is."
          : "Opname vastgelegd.",
      );
      setOpnameVoor(null);
      setOpname({ ...LEGE_OPNAME });
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetId(null);
    }
  }

  async function verwijderDeMeter(meterId: string) {
    if (!uid || !project) return;

    setBezigMetId(meterId);
    setFout(null);
    try {
      const aantal = await verwijderMeter(uid, project.id, meterId);
      setGelukt(
        aantal === 0
          ? "Meter verwijderd."
          : `Meter verwijderd, samen met ${aantal === 1 ? "één opname" : `${aantal} opnames`}.`,
      );
      setTeVerwijderenMeter(null);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Verwijderen"));
    } finally {
      setBezigMetId(null);
    }
  }

  async function verwijderDeOpname(opnameId: string) {
    if (!uid || !project) return;

    setBezigMetId(opnameId);
    setFout(null);
    try {
      await verwijderMeterstand(uid, project.id, opnameId);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Verwijderen"));
    } finally {
      setBezigMetId(null);
    }
  }

  if (bezigMetLaden) return <Laadscherm />;

  if (!project) {
    return (
      <AppShell>
        <h1 className="text-h2 text-ink">Meterstanden</h1>
        <p className="mt-s3 max-w-2xl text-body text-slate">
          Er is nog geen project. Maak er eerst één aan.
        </p>
        <div className="mt-s3">
          <Link to="/project/nieuw" className="underline">
            Project aanmaken
          </Link>
        </div>
      </AppShell>
    );
  }

  const nu = vandaag();
  const overzichten = overzichtVoorAlleMeters(meters, opnames, nu);
  const conflicten = conflicterendeMeters(meters);
  const achterstallig = overzichten.filter((o) => o.opnameAchterstallig).length;

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Woning</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Meterstanden</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Noteer wat de meter aanwijst; het verbruik ertussen rekent de app uit. Er wordt nooit
        een verbruik opgeslagen — corrigeer je een stand, dan klopt de rest vanzelf weer.
      </p>

      {!isOpgeleverd(project) && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="info">
            De woning staat nog op “in aanbouw”. Meterstanden gaan pas lopen na de
            sleuteloverdracht — je kunt de meters alvast klaarzetten.{" "}
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

      {conflicten.map((melding) => (
        <div key={melding} className="mt-s3 max-w-2xl">
          <Melding soort="info">{melding}</Melding>
        </div>
      ))}

      {meters.length > 0 && achterstallig > 0 && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="fout">
            {achterstallig === 1
              ? "Van één meter is er langer dan een maand geen stand genoteerd"
              : `Van ${achterstallig} meters is er langer dan een maand geen stand genoteerd`}
            . Zonder tweede stand valt er geen verbruik te berekenen.
          </Melding>
        </div>
      )}

      {/* ── Meter toevoegen ─────────────────────────────────────────────── */}
      {meterformulier === null && (
        <div className="mt-s4">
          <Knop
            onClick={() => {
              setMeterformulier({ ...LEGE_METER });
              setBewerkteMeter(null);
              setOpnameVoor(null);
              setGelukt(null);
            }}
          >
            Meter toevoegen
          </Knop>
        </div>
      )}

      {meterformulier !== null && (
        <section className="brink-card mt-s4 max-w-2xl p-s3">
          <h2 className="text-h3 text-ink">
            {bewerkteMeter ? "Meter aanpassen" : "Nieuwe meter"}
          </h2>

          <div className="mt-s3 flex flex-col gap-s3">
            <Keuzeveld
              label="Wat meet deze meter?"
              waarde={meterformulier.soort}
              opties={SOORTOPTIES}
              onKies={kiesSoort}
            />

            <Veld
              label={meterformulier.soort === "overig" ? "Naam" : "Eigen naam (optioneel)"}
              hint={
                meterformulier.soort === "overig"
                  ? "Bijvoorbeeld “Tussenmeter warmtepomp” of “Laadpaal”."
                  : "Leeg laten gebruikt de standaardnaam. Handig bij twee meters van hetzelfde soort."
              }
              value={meterformulier.naam}
              onChange={(e) => {
                wijzigMeter({ naam: e.target.value });
              }}
            />

            {/* De eenheid staat bij een bekende soort vast: die is geen keuze
                maar een eigenschap van de meter, en een keuzelijst zou alleen
                maar fouten uitnodigen. */}
            {meterformulier.soort === "overig" ? (
              <Keuzeveld
                label="Eenheid"
                waarde={meterformulier.eenheid}
                opties={METEREENHEIDOPTIES}
                onKies={(eenheid) => {
                  wijzigMeter({ eenheid });
                }}
              />
            ) : (
              <p className="text-body text-slate">
                Eenheid: <span className="text-ink">{toonEenheid(meterformulier.eenheid)}</span>
              </p>
            )}

            <Veld
              label="Meternummer (optioneel)"
              hint="Het nummer op de meter zelf. Handig bij een storing of een verhuizing."
              value={meterformulier.meternummer}
              onChange={(e) => {
                wijzigMeter({ meternummer: e.target.value });
              }}
            />

            <Tekstvlak
              label="Notitie (optioneel)"
              value={meterformulier.notitie}
              onChange={(e) => {
                wijzigMeter({ notitie: e.target.value });
              }}
            />
          </div>

          <div className="mt-s3 flex flex-wrap gap-s2">
            <Knop
              bezig={bezigMetOpslaan}
              onClick={() => {
                void bewaarMeter();
              }}
            >
              Opslaan
            </Knop>
            <Knop
              variant="secundair"
              onClick={() => {
                setMeterformulier(null);
                setBewerkteMeter(null);
              }}
            >
              Annuleren
            </Knop>
          </div>
        </section>
      )}

      {/* ── De meters ───────────────────────────────────────────────────── */}
      {meters.length === 0 && meterformulier === null && (
        <div className="mt-s4 max-w-2xl">
          <Melding soort="info">
            Er staan nog geen meters. Begin met de meters die je in de meterkast ziet: bij een
            all-electric woning met zonnepanelen zijn dat er meestal vier — stroom normaal en
            dal, plus teruglevering normaal en dal.
          </Melding>
        </div>
      )}

      <div className="mt-s4 flex flex-col gap-s3">
        {overzichten.map((overzicht) => (
          <Meterkaart
            key={overzicht.meter.id}
            overzicht={overzicht}
            bezigMetId={bezigMetId}
            opnameOpen={opnameVoor === overzicht.meter.id}
            historieOpen={toonHistorie === overzicht.meter.id}
            opname={opname}
            opnames={opnames.filter((o) => o.meterId === overzicht.meter.id)}
            teVerwijderen={teVerwijderenMeter === overzicht.meter.id}
            onOpnameOpenen={() => {
              setOpnameVoor(overzicht.meter.id);
              setOpname({ ...LEGE_OPNAME });
              setMeterformulier(null);
              setGelukt(null);
              setFout(null);
            }}
            onOpnameSluiten={() => {
              setOpnameVoor(null);
            }}
            onOpnameWijzigen={(patch) => {
              setOpname((o) => ({ ...o, ...patch }));
            }}
            onOpnameBewaren={() => {
              void bewaarOpname(overzicht.meter);
            }}
            onHistorieWisselen={() => {
              setToonHistorie((h) => (h === overzicht.meter.id ? null : overzicht.meter.id));
            }}
            onBewerken={() => {
              beginBewerken(overzicht.meter);
            }}
            onVerwijderenVragen={() => {
              setTeVerwijderenMeter(overzicht.meter.id);
            }}
            onVerwijderenAfbreken={() => {
              setTeVerwijderenMeter(null);
            }}
            onVerwijderen={() => {
              void verwijderDeMeter(overzicht.meter.id);
            }}
            onOpnameVerwijderen={(opnameId) => {
              void verwijderDeOpname(opnameId);
            }}
          />
        ))}
      </div>

      <p className="mt-s4 max-w-2xl text-sm text-granite">
        Een opname geldt als actueel tot {OPNAME_VERS_DAGEN} dagen na de datum. Daarna komt de
        meter op het dashboard te staan. De taak “Meterstanden noteren” op{" "}
        <Link to="/onderhoud" className="underline">
          onderhoud
        </Link>{" "}
        is dezelfde herinnering.
      </p>
    </AppShell>
  );
}

// ── Het trendblok ──────────────────────────────────────────────────────────

/**
 * EEN EIGEN COMPONENT MET EEN VROEGE RETURN, en niet een `&&`-keten in de
 * kaart. Die keten (`trend !== null && trend.laatste.perDag !== null && …`)
 * lokt `prefer-optional-chain` uit, en de voorgestelde fix
 * (`trend?.laatste.perDag !== null`) is stuk: bij `trend === null` levert dat
 * `undefined !== null` op — dus `true` — waarna het blok rendert en op
 * `trend.laatste` crasht.
 *
 * Zelfde soort val als bij `opDezelfdeDag()` in `lib/overdracht.ts`: de
 * lintfix zou een bug introduceren die de compiler niet ziet.
 */
function Trendblok({
  trend,
  decimalen,
  eenheid,
  teruglevering,
}: {
  trend: Verbruikstrend;
  decimalen: number;
  eenheid: string;
  teruglevering: boolean;
}) {
  const perDag = trend.laatste.perDag;
  if (perDag === null) return null;

  return (
    <div className="mt-s3 rounded-consent bg-bone px-4 py-3">
      <p className="text-body text-ink">
        {toonPerDag(perDag, decimalen)} {eenheid} per dag
        {teruglevering ? " teruggeleverd" : " verbruikt"}
      </p>
      <p className="mt-1 text-sm text-slate">
        Over {trend.laatste.dagen} dagen, van {toonDatum(trend.laatste.van)} tot{" "}
        {toonDatum(trend.laatste.tot)}.
      </p>

      {trend.richting !== "onbekend" && trend.vorige !== undefined && (
        <p className="mt-2 text-sm text-slate">
          {trend.richting === "gelijk"
            ? "Vrijwel gelijk aan de periode ervoor."
            : trend.verschilProcent === undefined
              ? "Meer dan de periode ervoor — die stond op nul."
              : `${Math.abs(Math.round(trend.verschilProcent))}% ${
                  trend.richting === "meer" ? "meer" : "minder"
                } dan de periode ervoor.`}
        </p>
      )}
    </div>
  );
}

// ── De kaart per meter ─────────────────────────────────────────────────────

interface MeterkaartProps {
  overzicht: Meterstandsoverzicht;
  bezigMetId: string | null;
  opnameOpen: boolean;
  historieOpen: boolean;
  opname: Opnameformulier;
  opnames: readonly MeterstandMetId[];
  teVerwijderen: boolean;
  onOpnameOpenen: () => void;
  onOpnameSluiten: () => void;
  onOpnameWijzigen: (patch: Partial<Opnameformulier>) => void;
  onOpnameBewaren: () => void;
  onHistorieWisselen: () => void;
  onBewerken: () => void;
  onVerwijderenVragen: () => void;
  onVerwijderenAfbreken: () => void;
  onVerwijderen: () => void;
  onOpnameVerwijderen: (opnameId: string) => void;
}

function Meterkaart({
  overzicht,
  bezigMetId,
  opnameOpen,
  historieOpen,
  opname,
  opnames,
  teVerwijderen,
  onOpnameOpenen,
  onOpnameSluiten,
  onOpnameWijzigen,
  onOpnameBewaren,
  onHistorieWisselen,
  onBewerken,
  onVerwijderenVragen,
  onVerwijderenAfbreken,
  onVerwijderen,
  onOpnameVerwijderen,
}: MeterkaartProps) {
  const { meter, naam, laatste, dagenSindsOpname, trend, periodes } = overzicht;
  const decimalen = decimalenVan(meter);
  const eenheid = toonEenheid(meter.eenheid);
  const teruglevering = isTeruglevering(meter);

  return (
    <section className="brink-card max-w-2xl p-s3">
      <div className="flex flex-wrap items-start justify-between gap-s2">
        <div>
          <h2 className="text-h3 text-ink">{naam}</h2>
          <p className="mt-1 text-sm text-slate">
            {meterdefinitieVoor(meter.soort)?.label ?? "Eigen meter"} · {eenheid}
            {meter.meternummer && ` · nr. ${meter.meternummer}`}
          </p>
        </div>

        {overzicht.opnameAchterstallig && (
          <span className="rounded-pill bg-clay/10 px-3 py-1 text-sm text-clay-deep">
            {laatste === undefined ? "Nog geen stand" : "Stand verouderd"}
          </span>
        )}
      </div>

      {/* ── De laatste stand ──────────────────────────────────────────── */}
      {laatste === undefined ? (
        <p className="mt-s3 text-body text-slate">
          Nog geen enkele stand genoteerd. Vanaf de tweede opname rekent de app het verbruik
          uit.
        </p>
      ) : (
        <div className="mt-s3">
          <p className="text-h3 text-ink">
            {toonStand(laatste.stand, decimalen)} {eenheid}
          </p>
          <p className="mt-1 text-sm text-slate">
            Opgenomen op {toonDatum(laatste.opgenomenOp)}
            {dagenSindsOpname !== undefined &&
              (dagenSindsOpname === 0
                ? " · vandaag"
                : dagenSindsOpname === 1
                  ? " · gisteren"
                  : ` · ${dagenSindsOpname} dagen geleden`)}
          </p>
        </div>
      )}

      {/* ── De trend ──────────────────────────────────────────────────── */}
      {trend !== null && (
        <Trendblok
          trend={trend}
          decimalen={decimalen}
          eenheid={eenheid}
          teruglevering={teruglevering}
        />
      )}

      {overzicht.aantalOnbetrouwbaar > 0 && (
        <p className="mt-s2 text-sm text-clay-deep">
          {overzicht.aantalOnbetrouwbaar === 1
            ? "Eén periode kon niet berekend worden"
            : `${overzicht.aantalOnbetrouwbaar} periodes konden niet berekend worden`}
          . Zie de historie hieronder.
        </p>
      )}

      {/* ── Knoppen ───────────────────────────────────────────────────── */}
      {!opnameOpen && !teVerwijderen && (
        <div className="mt-s3 flex flex-wrap gap-s2">
          <Knop onClick={onOpnameOpenen}>Stand noteren</Knop>
          {opnames.length > 0 && (
            <Knop variant="secundair" onClick={onHistorieWisselen}>
              {historieOpen ? "Historie verbergen" : `Historie (${opnames.length})`}
            </Knop>
          )}
          <Knop variant="secundair" onClick={onBewerken}>
            Aanpassen
          </Knop>
          <Knop variant="secundair" onClick={onVerwijderenVragen}>
            Verwijderen
          </Knop>
        </div>
      )}

      {/* ── Stand noteren ─────────────────────────────────────────────── */}
      {opnameOpen && (
        <div className="mt-s3 flex flex-col gap-s3 border-t border-bone pt-s3">
          <Datumveld
            label="Wanneer heb je gekeken?"
            hint="Leeg laten gebruikt vandaag."
            waarde={opname.opgenomenOp}
            onKies={(d) => {
              onOpnameWijzigen({ opgenomenOp: d });
            }}
          />
          <Veld
            label={`Stand in ${eenheid}`}
            hint={
              decimalen > 0
                ? "Neem de cijfers achter de komma mee — die staan meestal in een ander vlak op de meter."
                : "Alleen de hele eenheden; de kleine cijfers achter de komma kun je overslaan."
            }
            inputMode="decimal"
            value={opname.stand}
            onChange={(e) => {
              onOpnameWijzigen({ stand: e.target.value });
            }}
          />
          <Tekstvlak
            label="Notitie (optioneel)"
            value={opname.notitie}
            onChange={(e) => {
              onOpnameWijzigen({ notitie: e.target.value });
            }}
          />

          <div className="flex flex-wrap gap-s2">
            <Knop bezig={bezigMetId === meter.id} onClick={onOpnameBewaren}>
              Vastleggen
            </Knop>
            <Knop variant="secundair" onClick={onOpnameSluiten}>
              Annuleren
            </Knop>
          </div>
        </div>
      )}

      {/* ── Verwijderen ───────────────────────────────────────────────── */}
      {teVerwijderen && (
        <div className="mt-s3 border-t border-bone pt-s3">
          <Melding soort="fout">
            Deze meter verwijderen haalt ook{" "}
            {opnames.length === 1 ? "de opname" : `alle ${opnames.length} opnames`} weg. Dat is
            niet terug te draaien.
          </Melding>
          <div className="mt-s3 flex flex-wrap gap-s2">
            <Knop bezig={bezigMetId === meter.id} onClick={onVerwijderen}>
              Definitief verwijderen
            </Knop>
            <Knop variant="secundair" onClick={onVerwijderenAfbreken}>
              Annuleren
            </Knop>
          </div>
        </div>
      )}

      {/* ── Historie ──────────────────────────────────────────────────── */}
      {historieOpen && (
        <div className="mt-s3 border-t border-bone pt-s3">
          <h3 className="text-body font-semibold text-ink">Alle opnames</h3>

          <ul className="mt-s2 flex flex-col gap-2">
            {[...opnames]
              .sort((a, b) => b.opgenomenOp.getTime() - a.opgenomenOp.getTime())
              .map((o) => (
                <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-body text-ink">
                    {toonDatum(o.opgenomenOp)} — {toonStand(o.stand, decimalen)} {eenheid}
                    {o.notitie && <span className="text-slate"> · {o.notitie}</span>}
                  </span>
                  <button
                    type="button"
                    disabled={bezigMetId === o.id}
                    onClick={() => {
                      onOpnameVerwijderen(o.id);
                    }}
                    className="text-sm text-slate underline disabled:opacity-50"
                  >
                    Verwijderen
                  </button>
                </li>
              ))}
          </ul>

          {periodes.length > 0 && (
            <>
              <h3 className="mt-s3 text-body font-semibold text-ink">Verbruik per periode</h3>
              <ul className="mt-s2 flex flex-col gap-2">
                {/* De index hoort in de key: bij drie of meer opnames op
                    dezelfde dag zijn `van` en `tot` van twee opeenvolgende
                    periodes identiek, en dan hergebruikt React de verkeerde
                    DOM-knoop. De volgorde van deze lijst is stabiel, dus de
                    index is hier een veilige aanvulling. */}
                {[...periodes].reverse().map((p, i) => (
                  <li
                    key={`${i}-${p.van.toISOString()}-${p.tot.toISOString()}`}
                    className="text-body"
                  >
                    <span className="text-ink">
                      {toonDatum(p.van)} → {toonDatum(p.tot)}
                    </span>{" "}
                    {p.betrouwbaar && p.verbruik !== null && p.perDag !== null ? (
                      <span className="text-slate">
                        {toonStand(p.verbruik, decimalen)} {eenheid} in {p.dagen} dagen (
                        {toonPerDag(p.perDag, decimalen)} per dag)
                      </span>
                    ) : (
                      <span className="text-clay-deep">{redenTekst(p)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
