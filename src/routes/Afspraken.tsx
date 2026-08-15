import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Tekstvlak } from "@/components/Tekstvlak";
import { Keuzeveld, type Keuze } from "@/components/Keuzeveld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useVault as useAuth } from "@/context/useVault";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum } from "@/lib/datum";
import { maakOffset, splitsOffset, toonOffset, type Richting } from "@/lib/afspraken";
import { naarPlanningContext } from "@/lib/actielijst";
import { berekenDatum, type BerekendeBand, type PlanningContext } from "@/lib/planning";
import {
  haalActiefProject,
  haalAfspraken,
  haalAnkers,
  haalBetrokkenen,
  verwijderAfspraak,
  zetAfspraak,
} from "@/lib/projecten";
import type {
  AfspraakData,
  AfspraakMetId,
  AnkerMetId,
  BetrokkeneMetId,
  ProjectMetId,
} from "@/lib/converters";
import type { AfspraakStatus, AnkerType } from "@/types/model";
import { ANKER_TITELS, ANKER_VOLGORDE } from "@/data/ankers";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Afspraken — waar de planning zichtbaar en aanpasbaar wordt
 *
 * Tot dit scherm bestond, stonden afspraken wel in de database maar kon je ze
 * nergens zien. Het anker en de offset — de twee velden waar de hele
 * schuif-mechaniek op draait — waren onzichtbaar.
 *
 * DRIE DINGEN DIE HIER BEWUST ZO ZIJN
 *
 * 1. GEEN DATUMVELD. Je kiest een bouwmoment en een aantal dagen ervóór of
 *    erna; de datum eronder is het resultaat, niet de invoer. Dat is ADR-0008
 *    in de UI: zou je hier een datum invullen, dan schuift hij bij de volgende
 *    verschuiving niet mee.
 *
 * 2. HET MINTEKEN IS WEG. Niemand denkt "min vijfenveertig"; mensen denken
 *    "vijfenveertig dagen vóór de sleuteloverdracht". `splitsOffset` en
 *    `maakOffset` in `lib/afspraken.ts` doen de vertaling, met tests.
 *
 * 3. OPSLAAN IS EEN VOLLEDIGE OVERSCHRIJVING, DUS `gecommuniceerdeDatum` GAAT
 *    EXPLICIET MEE. Dat veld draagt de kern van de module — wat weet die partij
 *    nu. Vergeet je het bij een edit, dan lijkt de afspraak ineens nooit
 *    doorgegeven en staat hij morgen weer op de actielijst.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const STATUSOPTIES: readonly Keuze<AfspraakStatus>[] = [
  { waarde: "concept", label: "Concept", toelichting: "Nog niet naar buiten gebracht." },
  {
    waarde: "voorlopig",
    label: "Voorlopig",
    toelichting: "De partij is geïnformeerd, maar de datum ligt nog niet vast.",
  },
  {
    waarde: "bevestigd",
    label: "Bevestigd",
    toelichting: "Jullie zijn het allebei eens over de datum.",
  },
  { waarde: "afgerond", label: "Afgerond", toelichting: "Dit is gebeurd." },
  { waarde: "vervallen", label: "Vervallen", toelichting: "Gaat niet door." },
];

const STATUSKORT: Record<AfspraakStatus, string> = {
  concept: "concept",
  voorlopig: "voorlopig",
  bevestigd: "bevestigd",
  afgerond: "afgerond",
  vervallen: "vervallen",
};

const RICHTINGOPTIES: readonly Keuze<Richting>[] = [
  { waarde: "voor", label: "vóór het bouwmoment" },
  { waarde: "na", label: "ná het bouwmoment" },
];

const ANKEROPTIES: readonly Keuze<AnkerType>[] = ANKER_VOLGORDE.map((a) => ({
  waarde: a.type,
  label: a.titel,
  toelichting: a.uitleg,
}));

/** Lege waarden voor een nieuwe afspraak. */
const LEEG = {
  omschrijving: "",
  ankerType: "oplevering" as AnkerType,
  dagen: "0",
  richting: "na" as Richting,
  duur: "",
  status: "concept" as AfspraakStatus,
  waarschuwing: "",
  notitie: "",
};

function ZekerheidRegel({ band }: { band: BerekendeBand | null }) {
  if (!band) {
    return (
      <p className="text-sm text-granite">
        Nog niet te berekenen — vul eerst een opleverdatum of bouwmoment in.
      </p>
    );
  }

  const datum = band.isPunt
    ? toonDatum(band.verwacht)
    : `tussen ${toonDatum(band.vroegst)} en ${toonDatum(band.laatst)}`;

  if (band.zekerheid === "teruggevallen") {
    return (
      <p className="text-sm text-clay-deep">
        {datum} — gerekend vanaf de oplevering, want “{ANKER_TITELS[band.gevraagdAnker]}” is nog
        niet bekend
      </p>
    );
  }

  return (
    <p className="text-sm text-slate">
      {datum}
      {band.zekerheid === "anker_verwacht" ? " — op basis van een verwachte datum" : ""}
    </p>
  );
}

export default function Afspraken() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [ankers, setAnkers] = useState<AnkerMetId[]>([]);
  const [betrokkenen, setBetrokkenen] = useState<BetrokkeneMetId[]>([]);
  const [afspraken, setAfspraken] = useState<AfspraakMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);

  /** Het id van de afspraak die bewerkt wordt, of het betrokkene-id bij een nieuwe. */
  const [bewerktId, setBewerktId] = useState<string | null>(null);
  const [nieuwBijBetrokkene, setNieuwBijBetrokkene] = useState<string | null>(null);
  const [verwijderId, setVerwijderId] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

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

        const [geladenAnkers, geladenBetrokkenen, geladenAfspraken] = await Promise.all([
          haalAnkers(uid, gevonden.id),
          haalBetrokkenen(uid, gevonden.id),
          haalAfspraken(uid, gevonden.id),
        ]);
        if (!actueel) return;

        setProject(gevonden);
        setAnkers(geladenAnkers);
        setBetrokkenen(geladenBetrokkenen);
        setAfspraken(geladenAfspraken);
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

  function sluitFormulier() {
    setBewerktId(null);
    setNieuwBijBetrokkene(null);
    setFormulier(LEEG);
  }

  function beginBewerken(afspraak: AfspraakMetId) {
    const { dagen, richting } = splitsOffset(afspraak.offsetDagen);
    setBewerktId(afspraak.id);
    setNieuwBijBetrokkene(null);
    setVerwijderId(null);
    setFout(null);
    setGelukt(null);
    setFormulier({
      omschrijving: afspraak.omschrijving,
      ankerType: afspraak.ankerType,
      dagen: String(dagen),
      richting,
      duur: afspraak.duurDagen === undefined ? "" : String(afspraak.duurDagen),
      status: afspraak.status,
      waarschuwing: afspraak.waarschuwing ?? "",
      notitie: afspraak.notitie ?? "",
    });
  }

  function beginToevoegen(betrokkeneId: string) {
    setNieuwBijBetrokkene(betrokkeneId);
    setBewerktId(null);
    setVerwijderId(null);
    setFout(null);
    setGelukt(null);
    setFormulier(LEEG);
  }

  /**
   * Bouwt het complete document. `bestaand` gaat erin zodat velden die niet in
   * het formulier staan — met name `gecommuniceerdeDatum` — bewaard blijven bij
   * de volledige overschrijving.
   */
  function bouwAfspraak(betrokkeneId: string, bestaand: AfspraakMetId | undefined): AfspraakData {
    const duur = formulier.duur.trim() === "" ? undefined : Number(formulier.duur);
    const waarschuwing = formulier.waarschuwing.trim();
    const notitie = formulier.notitie.trim();

    return {
      betrokkeneId,
      omschrijving: formulier.omschrijving.trim(),
      ankerType: formulier.ankerType,
      offsetDagen: maakOffset(Number(formulier.dagen), formulier.richting),
      status: formulier.status,
      ...(duur === undefined ? {} : { duurDagen: duur }),
      ...(waarschuwing === "" ? {} : { waarschuwing }),
      ...(notitie === "" ? {} : { notitie }),
      ...(bestaand?.gecommuniceerdeDatum === undefined
        ? {}
        : { gecommuniceerdeDatum: bestaand.gecommuniceerdeDatum }),
      ...(bestaand?.gecommuniceerdOp === undefined
        ? {}
        : { gecommuniceerdOp: bestaand.gecommuniceerdOp }),
    };
  }

  function controleer(): string | null {
    if (formulier.omschrijving.trim() === "") return "Vul een omschrijving in.";
    if (formulier.omschrijving.trim().length > 300)
      return "De omschrijving mag hooguit 300 tekens zijn.";

    const dagen = Number(formulier.dagen);
    if (!Number.isInteger(dagen) || dagen < 0 || dagen > 3650)
      return "Vul het aantal dagen in als heel getal tussen 0 en 3650.";

    if (formulier.duur.trim() !== "") {
      const duur = Number(formulier.duur);
      if (!Number.isInteger(duur) || duur < 0 || duur > 365)
        return "De duur moet een heel getal zijn tussen 0 en 365 dagen.";
    }

    if (formulier.waarschuwing.trim().length > 1000)
      return "De waarschuwing mag hooguit 1000 tekens zijn.";
    if (formulier.notitie.trim().length > 2000)
      return "De notitie mag hooguit 2000 tekens zijn.";

    return null;
  }

  async function bewaar(betrokkeneId: string, bestaand: AfspraakMetId | undefined) {
    if (!uid || !project) return;

    const melding = controleer();
    if (melding) {
      setFout(melding);
      return;
    }

    setBezig(true);
    setFout(null);
    try {
      await zetAfspraak(uid, project.id, bestaand?.id ?? null, bouwAfspraak(betrokkeneId, bestaand));
      setGelukt(bestaand ? "Afspraak bijgewerkt." : "Afspraak toegevoegd.");
      sluitFormulier();
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(afspraak: AfspraakMetId) {
    if (!uid || !project) return;

    setBezig(true);
    setFout(null);
    try {
      await verwijderAfspraak(uid, project.id, afspraak.id);
      setGelukt(`“${afspraak.omschrijving}” is verwijderd.`);
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

  const context: PlanningContext = naarPlanningContext(project, ankers);

  /** Het resultaat van wat er nu in het formulier staat — de datum als je opslaat. */
  const voorbeeld = berekenDatum(
    formulier.ankerType,
    maakOffset(Number(formulier.dagen) || 0, formulier.richting),
    context,
  );

  const formulierVelden = (betrokkeneId: string, bestaand: AfspraakMetId | undefined) => (
    <div className="mt-s2 flex flex-col gap-s2 border-t border-bone pt-s3">
      <Veld
        label="Wat gebeurt er?"
        hint="Bijvoorbeeld “inmeten keuken” of “verhuisbus ophalen”."
        value={formulier.omschrijving}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, omschrijving: e.target.value }));
        }}
      />

      <Keuzeveld
        label="Hangt aan welk bouwmoment?"
        waarde={formulier.ankerType}
        opties={ANKEROPTIES}
        onKies={(ankerType) => {
          setFormulier((f) => ({ ...f, ankerType }));
        }}
      />

      <div className="grid gap-s2 sm:grid-cols-2">
        <Veld
          label="Hoeveel dagen"
          hint="0 = op de dag van het bouwmoment zelf."
          inputMode="numeric"
          value={formulier.dagen}
          onChange={(e) => {
            setFormulier((f) => ({ ...f, dagen: e.target.value }));
          }}
        />
        <Keuzeveld
          label="Ervóór of erna"
          waarde={formulier.richting}
          opties={RICHTINGOPTIES}
          onKies={(richting) => {
            setFormulier((f) => ({ ...f, richting }));
          }}
        />
      </div>

      <div className="rounded-consent border border-taupe/40 bg-bone px-4 py-3">
        <p className="text-sm font-semibold text-charcoal">Dat wordt:</p>
        <ZekerheidRegel band={voorbeeld} />
        <p className="mt-1 text-sm text-granite">
          Er wordt geen datum opgeslagen. Schuift het bouwmoment, dan schuift deze afspraak mee.
        </p>
      </div>

      <div className="grid gap-s2 sm:grid-cols-2">
        <Veld
          label="Duur in dagen (optioneel)"
          hint="Hoelang de klus zelf duurt."
          inputMode="numeric"
          value={formulier.duur}
          onChange={(e) => {
            setFormulier((f) => ({ ...f, duur: e.target.value }));
          }}
        />
        <Keuzeveld
          label="Status"
          waarde={formulier.status}
          opties={STATUSOPTIES}
          onKies={(status) => {
            setFormulier((f) => ({ ...f, status }));
          }}
        />
      </div>

      <Veld
        label="Waarschuwing (optioneel)"
        hint="Iets wat je op dat moment beslist moet weten, bijvoorbeeld een droogtijd."
        value={formulier.waarschuwing}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, waarschuwing: e.target.value }));
        }}
      />

      <Tekstvlak
        label="Notitie (optioneel)"
        value={formulier.notitie}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, notitie: e.target.value }));
        }}
      />

      <div className="flex flex-wrap gap-s2">
        <Knop bezig={bezig} onClick={() => void bewaar(betrokkeneId, bestaand)}>
          {bestaand ? "Opslaan" : "Afspraak toevoegen"}
        </Knop>
        <Knop variant="secundair" onClick={sluitFormulier}>
          Annuleren
        </Knop>
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Afspraken</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Wat er wanneer moet gebeuren</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Elke afspraak hangt aan een bouwmoment plus een aantal dagen ervóór of erna. De datum
        eronder is het resultaat — die wordt nergens opgeslagen, zodat alles meeschuift als de
        bouw schuift.
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

      {betrokkenen.length === 0 && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="info">
            Er zijn nog geen betrokkenen. Een afspraak hoort altijd bij een partij —{" "}
            <Link to="/betrokkenen">voeg er eerst een toe</Link>.
          </Melding>
        </div>
      )}

      <div className="mt-s4 flex max-w-2xl flex-col gap-s3">
        {betrokkenen.map((betrokkene) => {
          const eigen = afspraken.filter((a) => a.betrokkeneId === betrokkene.id);

          return (
            <section key={betrokkene.id} className="brink-card p-s3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-h3 text-ink">{betrokkene.naam}</h2>
                <span className="text-sm text-granite">
                  {eigen.length} {eigen.length === 1 ? "afspraak" : "afspraken"}
                </span>
              </div>

              {eigen.length === 0 && nieuwBijBetrokkene !== betrokkene.id && (
                <p className="mt-s2 text-body text-slate">Nog geen afspraken voor deze partij.</p>
              )}

              <div className="mt-s2 flex flex-col gap-s2">
                {eigen.map((afspraak) => {
                  const band = berekenDatum(afspraak.ankerType, afspraak.offsetDagen, context);
                  const wordtBewerkt = bewerktId === afspraak.id;

                  return (
                    <article
                      key={afspraak.id}
                      className="rounded-consent border border-bone bg-lifted p-s3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-body font-semibold text-ink">
                          {afspraak.omschrijving}
                        </h3>
                        <span className="rounded-pill bg-bone px-3 py-1 text-sm text-granite">
                          {STATUSKORT[afspraak.status]}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate">
                        {toonOffset(afspraak.offsetDagen, ANKER_TITELS[afspraak.ankerType])}
                      </p>
                      <div className="mt-1">
                        <ZekerheidRegel band={band} />
                      </div>

                      <p className="mt-1 text-sm text-granite">
                        {afspraak.gecommuniceerdeDatum
                          ? `Deze partij weet: ${toonDatum(afspraak.gecommuniceerdeDatum)}`
                          : "Nog nooit doorgegeven"}
                      </p>

                      {afspraak.waarschuwing && (
                        <p className="mt-s2 text-sm text-charcoal">⚠ {afspraak.waarschuwing}</p>
                      )}

                      {verwijderId === afspraak.id ? (
                        <div className="mt-s2 flex flex-col gap-s2">
                          <Melding soort="fout">
                            “{afspraak.omschrijving}” definitief verwijderen? Dit kan niet
                            teruggedraaid worden.
                          </Melding>
                          <div className="flex flex-wrap gap-s2">
                            <Knop bezig={bezig} onClick={() => void verwijder(afspraak)}>
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
                          <div className="mt-s2 flex flex-wrap gap-s2">
                            <Knop
                              variant="secundair"
                              onClick={() => {
                                beginBewerken(afspraak);
                              }}
                            >
                              Aanpassen
                            </Knop>
                            <Knop
                              variant="secundair"
                              onClick={() => {
                                setVerwijderId(afspraak.id);
                                setBewerktId(null);
                              }}
                            >
                              Verwijderen
                            </Knop>
                          </div>
                        )
                      )}

                      {wordtBewerkt && formulierVelden(betrokkene.id, afspraak)}
                    </article>
                  );
                })}
              </div>

              {nieuwBijBetrokkene === betrokkene.id ? (
                <div className="mt-s2 rounded-consent border border-bone bg-lifted p-s3">
                  <h3 className="text-body font-semibold text-ink">Nieuwe afspraak</h3>
                  {formulierVelden(betrokkene.id, undefined)}
                </div>
              ) : (
                <div className="mt-s3">
                  <Knop
                    variant="secundair"
                    onClick={() => {
                      beginToevoegen(betrokkene.id);
                    }}
                  >
                    Afspraak toevoegen
                  </Knop>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
