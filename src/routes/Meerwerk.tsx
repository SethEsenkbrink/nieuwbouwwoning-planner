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
import { useAuth } from "@/context/useAuth";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum, vandaag } from "@/lib/datum";
import { leesBedragInvoer, toonBedrag } from "@/lib/bedrag";
import { Voortgangsbalk } from "@/components/Voortgangsbalk";

import { maakOffset, splitsOffset, type Richting } from "@/lib/afspraken";
import { naarPlanningContext } from "@/lib/actielijst";
import {
  beoordeelMeerwerk,
  sorteerMeerwerk,
  telMeerwerk,
  telZonderBedrag,
  type Meerwerkstand,
} from "@/lib/meerwerk";
import {
  haalActiefProject,
  haalAnkers,
  haalMeerwerk,
  verwijderMeerwerk,
  zetMeerwerk,
} from "@/lib/projecten";
import type { AnkerMetId, MeerwerkData, MeerwerkMetId, ProjectMetId } from "@/lib/converters";
import type { AnkerType, MeerwerkSluiting, MeerwerkStatus } from "@/types/model";
import { ANKER_TITELS, ANKER_VOLGORDE } from "@/data/ankers";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Meerwerk — de duurste beslissingen van het hele traject
 *
 * De deadline kent drie vormen (ADR-0011), en het onderscheid is de kern van
 * dit scherm:
 *
 *   vaste_datum  de administratieve sluitingsdatum van de aannemer. Ligt vóór
 *                de start van de bouw en schuift NIET mee als de bouw schuift.
 *                Dit is het normale geval, en dus de standaard in het formulier.
 *   bouwmoment   meerwerk dat tijdens de bouw opkomt. Schuift wél mee.
 *   onbekend     genoteerd, maar de datum is nog niet bekend.
 *
 * Zou de vaste datum als anker + offset zijn opgeslagen, dan schuift een
 * deadline die vaststaat mee met een bouw die verschuift — en word je te laat
 * gewaarschuwd over precies de beslissingen waar het meeste geld in zit.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const STATUSOPTIES: readonly Keuze<MeerwerkStatus>[] = [
  { waarde: "overweeg", label: "Overweeg", toelichting: "Je denkt erover na; nog niets besteld." },
  { waarde: "besteld", label: "Besteld", toelichting: "Doorgegeven aan de aannemer." },
  {
    waarde: "bevestigd",
    label: "Bevestigd",
    toelichting: "De aannemer heeft het bevestigd; dit gaat gebeuren.",
  },
];

const SLUITINGOPTIES: readonly Keuze<MeerwerkSluiting>[] = [
  {
    waarde: "vaste_datum",
    label: "Vaste sluitingsdatum",
    toelichting:
      "De datum waarop de aannemer de keuzelijst sluit. Ligt meestal vóór de start van de bouw " +
      "en schuift niet mee als de bouw verschuift.",
  },
  {
    waarde: "bouwmoment",
    label: "Gekoppeld aan een bouwmoment",
    toelichting:
      "Voor meerwerk dat tijdens de bouw opkomt: “nog vóórdat de dekvloer wordt gestort”. Deze " +
      "datum schuift wél mee met de bouw.",
  },
  {
    waarde: "onbekend",
    label: "Nog niet bekend",
    toelichting: "Je hebt de wens genoteerd maar weet nog niet tot wanneer het kan.",
  },
];

const RICHTINGOPTIES: readonly Keuze<Richting>[] = [
  { waarde: "voor", label: "vóór het bouwmoment" },
  { waarde: "na", label: "ná het bouwmoment" },
];

const ANKEROPTIES: readonly Keuze<AnkerType>[] = ANKER_VOLGORDE.map((a) => ({
  waarde: a.type,
  label: a.titel,
  toelichting: a.uitleg,
}));

const STANDSTIJL: Record<Meerwerkstand, string> = {
  gesloten: "bg-bone text-granite",
  sluit_binnenkort: "bg-clay text-canvas",
  open: "bg-lifted text-granite border border-bone",
  onbekend: "bg-lifted text-granite border border-bone",
};

const LEEG = {
  omschrijving: "",
  bedrag: "",
  status: "overweeg" as MeerwerkStatus,
  sluiting: "vaste_datum" as MeerwerkSluiting,
  datum: undefined as Date | undefined,
  ankerType: "start_bouw" as AnkerType,
  dagen: "0",
  richting: "voor" as Richting,
  notitie: "",
};

export default function Meerwerk() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [ankers, setAnkers] = useState<AnkerMetId[]>([]);
  const [items, setItems] = useState<MeerwerkMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const [bewerktId, setBewerktId] = useState<string | null>(null);
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

        const [geladenAnkers, geladenItems] = await Promise.all([
          haalAnkers(uid, gevonden.id),
          haalMeerwerk(uid, gevonden.id),
        ]);
        if (!actueel) return;

        setProject(gevonden);
        setAnkers(geladenAnkers);
        setItems(geladenItems);
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
    setNieuw(false);
    setFormulier(LEEG);
  }

  function beginBewerken(item: MeerwerkMetId) {
    const { dagen, richting } = splitsOffset(item.sluitingOffsetDagen ?? 0);
    setBewerktId(item.id);
    setNieuw(false);
    setVerwijderId(null);
    setFout(null);
    setGelukt(null);
    setFormulier({
      omschrijving: item.omschrijving,
      bedrag: item.bedrag === undefined ? "" : String(item.bedrag),
      status: item.status,
      sluiting: item.sluiting,
      datum: item.sluitingsdatum,
      ankerType: item.sluitingAnkerType ?? "start_bouw",
      dagen: String(dagen),
      richting,
      notitie: item.notitie ?? "",
    });
  }

  function controleer(): string | null {
    if (formulier.omschrijving.trim() === "") return "Vul een omschrijving in.";
    if (formulier.omschrijving.trim().length > 300)
      return "De omschrijving mag hooguit 300 tekens zijn.";

    if (formulier.bedrag.trim() !== "" && leesBedragInvoer(formulier.bedrag) === undefined)
      return "Dit bedrag kan ik niet lezen. Bijvoorbeeld: 1250 of 1.250,50.";

    if (formulier.sluiting === "vaste_datum" && !formulier.datum)
      return "Vul de sluitingsdatum in, of kies “nog niet bekend”.";

    if (formulier.sluiting === "bouwmoment") {
      const dagen = Number(formulier.dagen);
      if (!Number.isInteger(dagen) || dagen < 0 || dagen > 3650)
        return "Vul het aantal dagen in als heel getal tussen 0 en 3650.";
    }

    if (formulier.notitie.trim().length > 2000)
      return "De notitie mag hooguit 2000 tekens zijn.";

    return null;
  }

  /**
   * Bouwt het document. Alleen de velden die bij de gekozen `sluiting` horen
   * gaan mee — `zetMeerwerk` overschrijft volledig, dus een oude datum of een
   * oud ankerveld verdwijnt daarmee ook echt.
   */
  function bouwItem(): MeerwerkData {
    // `controleer()` heeft de invoer al goedgekeurd; hier blijft alleen het
    // onderscheid tussen "leeg gelaten" en "een bedrag ingevuld" over.
    const bedrag =
      formulier.bedrag.trim() === "" ? undefined : leesBedragInvoer(formulier.bedrag);
    const notitie = formulier.notitie.trim();

    return {
      omschrijving: formulier.omschrijving.trim(),
      status: formulier.status,
      sluiting: formulier.sluiting,
      ...(bedrag === undefined ? {} : { bedrag }),
      ...(formulier.sluiting === "vaste_datum" && formulier.datum
        ? { sluitingsdatum: formulier.datum }
        : {}),
      ...(formulier.sluiting === "bouwmoment"
        ? {
            sluitingAnkerType: formulier.ankerType,
            sluitingOffsetDagen: maakOffset(Number(formulier.dagen), formulier.richting),
          }
        : {}),
      ...(notitie === "" ? {} : { notitie }),
    };
  }

  async function bewaar(bestaandId: string | null) {
    if (!uid || !project) return;

    const melding = controleer();
    if (melding) {
      setFout(melding);
      return;
    }

    setBezig(true);
    setFout(null);
    try {
      await zetMeerwerk(uid, project.id, bestaandId, bouwItem());
      setGelukt(bestaandId ? "Meerwerk bijgewerkt." : "Meerwerk toegevoegd.");
      sluitFormulier();
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(item: MeerwerkMetId) {
    if (!uid || !project) return;

    setBezig(true);
    setFout(null);
    try {
      await verwijderMeerwerk(uid, project.id, item.id);
      setGelukt(`“${item.omschrijving}” is verwijderd.`);
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
  const beoordeeld = sorteerMeerwerk(items.map((i) => beoordeelMeerwerk(i, context, nu)));
  const budget = telMeerwerk(items, project.meerwerkbudget);
  const zonderBedrag = telZonderBedrag(items);
  const sluitBinnenkort = beoordeeld.filter((b) => b.stand === "sluit_binnenkort");

  const formulierVelden = (bestaandId: string | null) => (
    <div className="mt-s2 flex flex-col gap-s2 border-t border-bone pt-s3">
      <Veld
        label="Wat wil je laten doen?"
        hint="Bijvoorbeeld “extra wandcontactdozen woonkamer”."
        value={formulier.omschrijving}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, omschrijving: e.target.value }));
        }}
      />

      <div className="grid gap-s2 sm:grid-cols-2">
        <Bedragveld
          label="Bedrag (optioneel)"
          hint="Leeg laten mag; de optelling telt het dan als nul."
          waarde={formulier.bedrag}
          onWijzig={(tekst) => {
            setFormulier((f) => ({ ...f, bedrag: tekst }));
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

      <Keuzeveld
        label="Tot wanneer kun je dit kiezen?"
        waarde={formulier.sluiting}
        opties={SLUITINGOPTIES}
        onKies={(sluiting) => {
          setFormulier((f) => ({ ...f, sluiting }));
        }}
      />

      {formulier.sluiting === "vaste_datum" && (
        <Datumveld
          label="Sluitingsdatum"
          hint="Zoals de aannemer hem heeft opgegeven."
          waarde={formulier.datum}
          onKies={(datum) => {
            setFormulier((f) => ({ ...f, datum }));
          }}
        />
      )}

      {formulier.sluiting === "bouwmoment" && (
        <>
          <Keuzeveld
            label="Welk bouwmoment?"
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
        </>
      )}

      <Tekstvlak
        label="Notitie (optioneel)"
        value={formulier.notitie}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, notitie: e.target.value }));
        }}
      />

      <div className="flex flex-wrap gap-s2">
        <Knop bezig={bezig} onClick={() => void bewaar(bestaandId)}>
          {bestaandId ? "Opslaan" : "Meerwerk toevoegen"}
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
        <span className="text-eyebrow uppercase text-slate">Meerwerk</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Wat je extra laat doen</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Meerwerk sluit meestal vóór de start van de bouw: zodra er gebouwd wordt, gaat de
        keuzelijst dicht. Komt er tijdens de bouw alsnog iets beschikbaar, dan koppel je dat aan
        het bouwmoment waar het van afhangt.
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

      {sluitBinnenkort.length > 0 && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="fout">
            {sluitBinnenkort.length}{" "}
            {sluitBinnenkort.length === 1 ? "keuze sluit" : "keuzes sluiten"} binnenkort:{" "}
            {sluitBinnenkort.map((b) => b.item.omschrijving).join(", ")}.
          </Melding>
        </div>
      )}

      {/* ── Budget ──────────────────────────────────────────────────────── */}
      <section className="brink-card mt-s4 max-w-2xl p-s3">
        <h2 className="text-h3 text-ink">Budget</h2>

        <div className="mt-s3">
          <Voortgangsbalk
            toon={toonBedrag}
            {...(budget.budget === undefined ? {} : { totaal: budget.budget })}
            restLabel="Ruimte over"
            segmenten={[
              { label: "Bevestigd", waarde: budget.bevestigd, kleur: "bg-olive" },
              { label: "Besteld", waarde: budget.besteld, kleur: "bg-olive-light" },
              {
                label: "Nog in overweging",
                waarde: budget.overwogen,
                kleur: "bg-taupe",
                toelichting: "Telt niet mee in de ruimte — dit heb je nog niet uitgegeven.",
              },
            ]}
          />
        </div>

        {budget.budget !== undefined && budget.ruimte !== undefined ? (
          <>
            <p
              className={`mt-s2 text-body ${budget.ruimte < 0 ? "text-clay-deep" : "text-charcoal"}`}
            >
              {budget.ruimte < 0
                ? `${toonBedrag(Math.abs(budget.ruimte))} over je budget van ${toonBedrag(budget.budget)}.`
                : `${toonBedrag(budget.ruimte)} over van je budget van ${toonBedrag(budget.budget)}.`}
              {budget.overwogen > 0 &&
                ` Zet je alles door wat je nog overweegt, dan kom je op ${toonBedrag(budget.maximaal)}.`}
            </p>
          </>
        ) : (
          <p className="mt-s2 text-sm text-granite">
            Geen meerwerkbudget ingevuld.{" "}
            <Link to="/project" className="underline">
              Doe dat bij je projectgegevens
            </Link>{" "}
            om te zien hoeveel ruimte je nog hebt.
          </p>
        )}

        {zonderBedrag > 0 && (
          <p className="mt-s2 text-sm text-granite">
            {zonderBedrag} {zonderBedrag === 1 ? "item heeft" : "items hebben"} nog geen bedrag —
            de bovenstaande bedragen zijn dus een ondergrens.
          </p>
        )}
      </section>

      {/* ── Toevoegen ───────────────────────────────────────────────────── */}
      <div className="mt-s3 max-w-2xl">
        {nieuw ? (
          <section className="brink-card p-s3">
            <h2 className="text-h3 text-ink">Nieuw meerwerk</h2>
            {formulierVelden(null)}
          </section>
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
            Meerwerk toevoegen
          </Knop>
        )}
      </div>

      {items.length === 0 && !nieuw && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="info">
            Nog geen meerwerk genoteerd. Vraag de meerwerklijst en de sluitingsdatums op bij je
            aannemer — die data komen sneller dan je denkt.
          </Melding>
        </div>
      )}

      {/* ── De lijst ────────────────────────────────────────────────────── */}
      <div className="mt-s4 flex max-w-2xl flex-col gap-s2">
        {beoordeeld.map((beoordeling) => {
          const item = beoordeling.item;
          const wordtBewerkt = bewerktId === item.id;

          return (
            <article key={item.id} className="brink-card p-s3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-body font-semibold text-ink">{item.omschrijving}</h3>
                <span className="text-body text-ink">{toonBedrag(item.bedrag)}</span>
              </div>

              <div className="mt-s2 flex flex-wrap items-center gap-s2">
                <span className="rounded-pill bg-bone px-3 py-1 text-sm text-granite">
                  {item.status}
                </span>
                {beoordeling.sluitOp && (
                  <span className={`rounded-pill px-3 py-1 text-sm ${STANDSTIJL[beoordeling.stand]}`}>
                    {beoordeling.stand === "gesloten"
                      ? `gesloten op ${toonDatum(beoordeling.sluitOp)}`
                      : `sluit ${toonDatum(beoordeling.sluitOp)}`}
                    {beoordeling.dagenTotSluiting !== undefined &&
                      beoordeling.dagenTotSluiting >= 0 &&
                      ` · over ${String(beoordeling.dagenTotSluiting)} ${beoordeling.dagenTotSluiting === 1 ? "dag" : "dagen"}`}
                  </span>
                )}
                {beoordeling.stand === "onbekend" && (
                  <span className="rounded-pill bg-lifted px-3 py-1 text-sm text-granite">
                    sluitingsdatum onbekend
                  </span>
                )}
              </div>

              {beoordeling.berekend && (
                <p className="mt-1 text-sm text-slate">
                  Gekoppeld aan {ANKER_TITELS[beoordeling.berekend.gevraagdAnker]}
                  {beoordeling.berekend.zekerheid === "teruggevallen" && (
                    <span className="text-clay-deep">
                      {" "}
                      — dat bouwmoment is nog niet bekend, dus dit is gerekend vanaf de oplevering
                    </span>
                  )}
                </p>
              )}

              {item.notitie && <p className="mt-s2 text-sm text-granite">{item.notitie}</p>}

              {verwijderId === item.id ? (
                <div className="mt-s2 flex flex-col gap-s2">
                  <Melding soort="fout">
                    “{item.omschrijving}” verwijderen? Dit kan niet teruggedraaid worden.
                  </Melding>
                  <div className="flex flex-wrap gap-s2">
                    <Knop bezig={bezig} onClick={() => void verwijder(item)}>
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
                        beginBewerken(item);
                      }}
                    >
                      Aanpassen
                    </Knop>
                    <Knop
                      variant="secundair"
                      onClick={() => {
                        setVerwijderId(item.id);
                        setBewerktId(null);
                      }}
                    >
                      Verwijderen
                    </Knop>
                  </div>
                )
              )}

              {wordtBewerkt && formulierVelden(item.id)}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
