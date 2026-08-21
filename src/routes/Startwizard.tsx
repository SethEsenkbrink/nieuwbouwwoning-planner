import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { Stapvoortgang } from "@/components/wizard/Stapvoortgang";
import { Opleverbandformulier } from "@/components/Opleverbandformulier";
import { Wizardstap } from "@/components/wizard/Wizardstap";
import { Keuzelijst } from "@/components/wizard/Keuzelijst";
import { keuzeSamenvatting } from "@/lib/wizard/keuzetekst";
import { Woningstap } from "@/components/wizard/Woningstap";
import { Contractstap } from "@/components/wizard/Contractstap";
import { Financieelstap } from "@/components/wizard/Financieelstap";
import { useVault as useAuth } from "@/context/useVault";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import {
  controleerOpleverband,
  naarOpslag as opleverbandNaarOpslag,
  uitProject as opleverbandUitProject,
  type Opleverbandwaarden,
} from "@/lib/opleverband";
import {
  haalActiefProject,
  haalBetrokkenen,
  haalMeters,
  haalOnderdelen,
  haalOnderhoudstaken,
  maakProject,
  voegStandaardBetrokkenenToe,
  voegStandaardOnderhoudToe,
  werkProjectBij,
  zetAnker,
  zetMeter,
  zetOnderdeel,
} from "@/lib/projecten";
import { ANKER_TITELS, INVULBARE_ANKERS } from "@/data/ankers";
import { STANDAARD_BETROKKENEN } from "@/data/betrokkenen-standaard";
import { STANDAARD_ONDERDELEN } from "@/data/onderdelen-standaard";
import { STANDAARD_ONDERHOUD } from "@/data/onderhoud-standaard";
import { METERBIBLIOTHEEK } from "@/data/meters-standaard";
import { ALLE_CATEGORIEEN } from "@/lib/converters";
import {
  dichtstbijzijndeMoment,
  gepasseerdeAnkers,
  momentenVoor,
  woningStatusVoor,
} from "@/lib/wizard/instapmoment";
import {
  dichtstbijzijndeStap,
  openVerplichteStappen,
  stapIndex,
  stappenVoor,
  voortgang,
  volgendeStap,
  vorigeStap,
  type WizardStap,
} from "@/lib/wizard/stappen";
import {
  LEGE_WIZARDWAARDEN,
  contractPatch,
  controleerStap,
  financieelPatch,
  projectnaamVan,
  uitProject as waardenUitProject,
  woningpaspoortPatch,
  type Wizardwaarden,
} from "@/lib/wizard/waarden";
import { afgerondeStappen, raadMoment } from "@/lib/wizard/voortgang";
import type { BetrokkeneCategorie, TrajectType } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De startwizard — één keer doorlopen, daarna staat het dossier
 *
 * DE OUDE WIZARD HAD DRIE STAPPEN en ging ervan uit dat je aan het begin van
 * een nieuwbouwtraject stond. Wie zijn sleutel al had, kreeg vragen over een
 * opleverdatum die allang geweest was; wie er vier jaar woonde kreeg geen
 * enkele vraag over onderhoud. Het financiële beeld ontbrak volledig — de
 * hypotheekmap was niet eens naar de opslag te krijgen (zie de convertercommit
 * die daaraan voorafging).
 *
 * WAT DIT SCHERM WEL EN NIET DOET. Het beslist niets zelf. Welke stappen er
 * zijn, welke verplicht zijn en wat er bij welk instapmoment hoort, staat in
 * `src/lib/wizard/` — puur, zonder React, met tests. Dit bestand voert uit:
 * het toont de stap, valideert via `controleerStap`, en schrijft weg.
 *
 * ER WORDT NA ELKE STAP OPGESLAGEN, niet aan het eind. Dat kost een extra
 * schrijfactie per stap, maar je kunt de wizard sluiten en later verdergaan
 * zonder iets kwijt te raken. Bij een wizard van negen stappen is dat het
 * verschil tussen af en afgehaakt.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CATEGORIELABELS: Record<BetrokkeneCategorie, string> = {
  installatie: "Installatie en techniek",
  afbouw: "Afbouw",
  tuin: "Tuin en buiten",
  verhuizing: "Verhuizing",
  huidige_woning: "Huidige woning",
  nuts: "Nutsvoorzieningen en diensten",
  financieel: "Financieel en juridisch",
  overig: "Overig",
};

const TRAJECTKEUZES: readonly { waarde: TrajectType; label: string; uitleg: string }[] = [
  {
    waarde: "nieuwbouw",
    label: "Nieuwbouw",
    uitleg:
      "Je koopt of kocht een woning die nog gebouwd wordt of net gebouwd is, met een koop-/aannemingsovereenkomst.",
  },
  {
    waarde: "bestaandeBouw",
    label: "Bestaande bouw",
    uitleg:
      "Je koopt of kocht een bestaande woning, met een koopovereenkomst en een transport bij de notaris.",
  },
];

function maandNaam(maand: number | undefined): string {
  if (maand === undefined) return "";
  const namen = [
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
  ];
  return namen[maand - 1] ?? "";
}

function intervalTekst(dagen: number): string {
  if (dagen >= 360) {
    const jaren = Math.round(dagen / 365);
    return jaren === 1 ? "elk jaar" : `elke ${String(jaren)} jaar`;
  }
  const maanden = Math.round(dagen / 30);
  return maanden <= 1 ? "elke maand" : `elke ${String(maanden)} maanden`;
}

export default function Startwizard() {
  const { gebruiker } = useAuth();
  const navigeer = useNavigate();
  const uid = gebruiker?.uid;

  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const [waarden, setWaarden] = useState<Wizardwaarden>(LEGE_WIZARDWAARDEN);
  const [band, setBand] = useState<Opleverbandwaarden>(opleverbandUitProject({}));
  const [stap, setStap] = useState<WizardStap>("start");
  const [afgerond, setAfgerond] = useState<readonly WizardStap[]>([]);

  const [gekozenBetrokkenen, setGekozenBetrokkenen] = useState<readonly string[]>([]);
  const [gekozenOnderdelen, setGekozenOnderdelen] = useState<readonly string[]>([]);
  const [gekozenOnderhoud, setGekozenOnderhoud] = useState<readonly string[]>([]);
  const [gekozenMeters, setGekozenMeters] = useState<readonly string[]>([]);

  // ── Laden: verdergaan waar je gebleven was ───────────────────────────────
  useEffect(() => {
    if (!uid) return;
    let actueel = true;

    void (async () => {
      try {
        const bestaand = await haalActiefProject(uid);
        if (!actueel) return;

        if (!bestaand) {
          setBezigMetLaden(false);
          return;
        }

        const [betrokkenen, onderdelen, onderhoud, meters] = await Promise.all([
          haalBetrokkenen(uid, bestaand.id),
          haalOnderdelen(uid, bestaand.id),
          haalOnderhoudstaken(uid, bestaand.id),
          haalMeters(uid, bestaand.id),
        ]);
        if (!actueel) return;

        const geraden = raadMoment(bestaand);
        setProjectId(bestaand.id);
        setWaarden(waardenUitProject(bestaand, geraden));
        setBand(opleverbandUitProject(bestaand));
        setAfgerond(
          afgerondeStappen({
            project: bestaand,
            aantalBetrokkenen: betrokkenen.length,
            aantalOnderdelen: onderdelen.length,
            aantalOnderhoudstaken: onderhoud.length,
            aantalMeters: meters.length,
          }),
        );
      } catch (f) {
        if (actueel) setFout(opslagFoutmelding(f, "Laden"));
      } finally {
        if (actueel) setBezigMetLaden(false);
      }
    })();

    return () => {
      actueel = false;
    };
  }, [uid]);

  const plan = useMemo(
    () => stappenVoor(waarden.traject, waarden.moment),
    [waarden.traject, waarden.moment],
  );

  /**
   * Verandert het stappenplan onder je handen — je wisselt van traject of van
   * instapmoment — dan kan de stap waar je stond verdwenen zijn.
   *
   * Dit wordt tijdens het renderen afgeleid en niet in een effect met
   * `setStap()` rechtgezet. Dat laatste geeft een cascade van renders: eerst
   * een render met een stap die niet bestaat, dan pas de correctie. Hier is er
   * geen tussenstand — `dichtstbijzijndeStap` zoekt de laatste stap die nog
   * bestaat en niet verder ligt dan waar je was, zodat je werk zichtbaar
   * blijft.
   */
  const effectieveStap = useMemo(
    () => (stapIndex(plan, stap) >= 0 ? stap : dichtstbijzijndeStap(plan, stap)),
    [plan, stap],
  );

  const huidige = useMemo(
    () => plan.find((s) => s.stap === effectieveStap) ?? plan[0],
    [plan, effectieveStap],
  );

  const stand = useMemo(() => voortgang(plan, afgerond), [plan, afgerond]);

  const wijzig = useCallback((patch: Partial<Wizardwaarden>) => {
    setWaarden((huidig) => ({ ...huidig, ...patch }));
    setFout(null);
  }, []);

  const wisselTraject = useCallback((traject: TrajectType) => {
    setWaarden((huidig) => ({
      ...huidig,
      traject,
      // Het gekozen moment bestaat misschien niet binnen het nieuwe traject.
      moment: dichtstbijzijndeMoment(traject, huidig.moment),
    }));
    setFout(null);
  }, []);

  function markeerAf(gedaan: WizardStap) {
    setAfgerond((huidig) => (huidig.includes(gedaan) ? huidig : [...huidig, gedaan]));
  }

  function gaNaarVolgende() {
    const volgende = volgendeStap(plan, stap);
    if (volgende) setStap(volgende);
  }

  /**
   * Zorgt dat er een project is om naartoe te schrijven.
   *
   * Het project wordt aangemaakt zodra je stap 1 verlaat en niet aan het eind
   * van de wizard: sluit je het scherm halverwege, dan staat je werk er nog.
   */
  async function zorgVoorProject(): Promise<string | null> {
    if (!uid) return null;
    if (projectId) return projectId;

    const id = await maakProject(uid, {
      naam: projectnaamVan(waarden),
      traject: waarden.traject,
    });
    setProjectId(id);
    return id;
  }

  // ── Opslaan per stap ─────────────────────────────────────────────────────

  async function bewaarStap(overslaan = false): Promise<void> {
    if (!uid || !huidige) return;

    if (!overslaan) {
      const melding = controleerStap(huidige.stap, waarden, huidige.verplicht);
      if (melding) {
        setFout(melding);
        return;
      }
    }

    setBezig(true);
    setFout(null);

    try {
      const id = await zorgVoorProject();
      if (!id) return;

      switch (huidige.stap) {
        case "start":
          await werkProjectBij(uid, id, {
            naam: projectnaamVan(waarden),
            traject: waarden.traject,
          });
          break;

        case "woning": {
          if (overslaan) break;
          const paspoort = woningpaspoortPatch(waarden);
          await werkProjectBij(uid, id, {
            naam: projectnaamVan(waarden),
            ...(Object.keys(paspoort).length === 0 ? {} : { woningpaspoort: paspoort }),
          });
          break;
        }

        case "contract": {
          if (overslaan) break;
          // Notaris, polisnummer, transportdatum en kadaster horen bij het
          // paspoort; de aannemer en het bouwnummer bij het project zelf.
          const paspoort = woningpaspoortPatch(waarden);
          await werkProjectBij(uid, id, {
            ...contractPatch(waarden),
            ...(Object.keys(paspoort).length === 0 ? {} : { woningpaspoort: paspoort }),
          });
          break;
        }

        case "planning": {
          if (overslaan) break;
          if (waarden.traject === "nieuwbouw") {
            const melding = controleerOpleverband(band);
            if (melding) {
              setFout(melding);
              return;
            }
            await werkProjectBij(uid, id, opleverbandNaarOpslag(band));
          } else {
            const paspoort = woningpaspoortPatch(waarden);
            await werkProjectBij(uid, id, {
              ...(Object.keys(paspoort).length === 0 ? {} : { woningpaspoort: paspoort }),
            });
          }
          break;
        }

        case "financieel":
          if (overslaan) break;
          await werkProjectBij(uid, id, financieelPatch(waarden));
          break;

        case "betrokkenen":
          if (overslaan || gekozenBetrokkenen.length === 0) break;
          await voegStandaardBetrokkenenToe(uid, id, gekozenBetrokkenen);
          break;

        case "oplevering":
          if (overslaan) break;
          await werkProjectBij(uid, id, financieelPatch(waarden));
          break;

        case "onderdelen":
          if (overslaan || gekozenOnderdelen.length === 0) break;
          for (const sleutel of gekozenOnderdelen) {
            const standaard = STANDAARD_ONDERDELEN.find((o) => o.sleutel === sleutel);
            if (!standaard) continue;
            await zetOnderdeel(uid, id, null, {
              naam: standaard.naam,
              categorie: standaard.categorie,
              montage: standaard.montage,
              blijftBijWoning: standaard.blijftBijWoning,
            });
          }
          break;

        case "onderhoud": {
          if (overslaan || gekozenOnderhoud.length === 0) break;
          const taken = STANDAARD_ONDERHOUD.filter((t) => gekozenOnderhoud.includes(t.sleutel)).map(
            (t) => ({
              titel: t.titel,
              omschrijving: t.omschrijving,
              intervalDagen: t.intervalDagen,
              ...(t.voorkeursmaand === undefined ? {} : { voorkeursmaand: t.voorkeursmaand }),
              ...(t.waarschuwing === undefined ? {} : { waarschuwing: t.waarschuwing }),
            }),
          );
          await voegStandaardOnderhoudToe(uid, id, taken);
          break;
        }

        case "meters":
          if (overslaan || gekozenMeters.length === 0) break;
          for (const soort of gekozenMeters) {
            const definitie = METERBIBLIOTHEEK.find((m) => m.soort === soort);
            if (!definitie) continue;
            await zetMeter(uid, id, null, {
              soort: definitie.soort,
              naam: definitie.label,
              eenheid: definitie.eenheid,
              waardenBron: "voorstel",
            });
          }
          break;

        case "klaar":
          await rondAf(uid, id);
          return;
      }

      if (!overslaan) markeerAf(huidige.stap);
      gaNaarVolgende();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  /**
   * De laatste handeling: de woningstatus zetten en de bouwmomenten die al
   * geweest zijn op `gepasseerd`.
   *
   * De oplevering zit bewust niet bij de weggeschreven ankers. Die datum leeft
   * als band op het project, en een los `oplevering`-anker zou een tweede
   * waarheid zijn die stilletjes genegeerd wordt — zie de kop van
   * `src/data/ankers.ts`.
   */
  async function rondAf(uid_: string, id: string): Promise<void> {
    await werkProjectBij(uid_, id, { woningStatus: woningStatusVoor(waarden.moment) });

    const gepasseerd = gepasseerdeAnkers(waarden.moment);
    for (const beschrijving of INVULBARE_ANKERS) {
      if (!gepasseerd.includes(beschrijving.type)) continue;
      await zetAnker(uid_, id, null, {
        type: beschrijving.type,
        titel: ANKER_TITELS[beschrijving.type],
        status: "gepasseerd",
      });
    }

    void navigeer("/", { replace: true });
  }

  if (!uid || bezigMetLaden || !huidige) return <Laadscherm />;

  const positie = stapIndex(plan, huidige.stap);
  const isLaatste = positie === plan.length - 1;
  const terug = vorigeStap(plan, huidige.stap);
  const openVerplicht = openVerplichteStappen(plan, afgerond);

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Startwizard</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Je dossier inrichten</h1>

      {/* ── Voortgang ────────────────────────────────────────────────────
          Een balk en geen stapindicator met negen bolletjes: bij dit aantal
          stappen wordt die onleesbaar, en het aantal stappen verschilt per
          instapmoment. */}
      <div className="mt-s3 max-w-2xl">
        <Stapvoortgang
          label={`Stap ${String(positie + 1)} van ${String(plan.length)} — ${huidige.titel}`}
          gedaan={stand.gedaan}
          totaal={stand.totaal}
        />
        <p className="mt-s1 text-sm text-granite">
          {stand.gedaan} van de {stand.totaal} onderdelen ingevuld. Je kunt tussendoor stoppen;
          alles wordt per stap bewaard.
        </p>
      </div>

      {/* ── De stap zelf ─────────────────────────────────────────────────── */}
      <Wizardstap
        kop={huidige.kop}
        uitleg={huidige.uitleg}
        fout={fout}
        bezig={bezig}
        onTerug={
          terug
            ? () => {
                setFout(null);
                setStap(terug);
              }
            : undefined
        }
        onVerder={() => void bewaarStap(false)}
        onOverslaan={
          huidige.verplicht || isLaatste ? undefined : () => void bewaarStap(true)
        }
        verderLabel={isLaatste ? "Naar mijn dossier" : "Verder"}
      >
        {huidige.stap === "start" && (
          <div className="flex flex-col gap-s4">
            <fieldset className="border-0 p-0">
              <legend className="text-body font-semibold text-ink">Wat voor woning is het?</legend>
              <div className="mt-s2 grid gap-s2 sm:grid-cols-2">
                {TRAJECTKEUZES.map((keuze) => (
                  <label
                    key={keuze.waarde}
                    className={[
                      "brink-card flex cursor-pointer gap-3 p-s2 transition-colors",
                      waarden.traject === keuze.waarde ? "ring-2 ring-clay" : "",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="traject"
                      className="mt-1 size-4 shrink-0 accent-clay"
                      checked={waarden.traject === keuze.waarde}
                      onChange={() => {
                        wisselTraject(keuze.waarde);
                      }}
                    />
                    <span className="flex flex-col gap-1">
                      <span className="text-body font-semibold text-ink">{keuze.label}</span>
                      <span className="text-sm text-slate">{keuze.uitleg}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="border-0 p-0">
              <legend className="text-body font-semibold text-ink">
                En waar sta je op dit moment?
              </legend>
              <p className="mt-1 text-sm text-slate">
                Hier hangt de rest van de wizard aan. Kies wat het dichtst in de buurt komt.
              </p>

              <div className="mt-s2 flex flex-col gap-s2">
                {momentenVoor(waarden.traject).map((keuze) => {
                  const aan = waarden.moment === keuze.moment;
                  return (
                    <label
                      key={keuze.moment}
                      className={[
                        "brink-card flex cursor-pointer gap-3 p-s2 transition-colors",
                        aan ? "ring-2 ring-clay" : "",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="moment"
                        className="mt-1 size-4 shrink-0 accent-clay"
                        checked={aan}
                        onChange={() => {
                          wijzig({ moment: keuze.moment });
                        }}
                      />
                      <span className="flex flex-col gap-1">
                        <span className="text-body font-semibold text-ink">{keuze.label}</span>
                        <span className="text-sm text-slate">{keuze.toelichting}</span>
                        {aan && (
                          <span className="mt-1 text-sm text-olive-deep">→ {keuze.gevolg}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {huidige.stap === "woning" && (
          <Woningstap
            waarden={waarden}
            onWijzig={wijzig}
            traject={waarden.traject}
            moment={waarden.moment}
          />
        )}

        {huidige.stap === "contract" && (
          <Contractstap waarden={waarden} onWijzig={wijzig} traject={waarden.traject} />
        )}

        {huidige.stap === "planning" &&
          (waarden.traject === "nieuwbouw" ? (
            <Opleverbandformulier
              waarden={band}
              onWijzig={(patch) => {
                setBand((b) => ({ ...b, ...patch }));
                setFout(null);
              }}
            />
          ) : (
            <Contractstap waarden={waarden} onWijzig={wijzig} traject={waarden.traject} />
          ))}

        {huidige.stap === "financieel" && (
          <Financieelstap
            waarden={waarden}
            onWijzig={wijzig}
            traject={waarden.traject}
            moment={waarden.moment}
          />
        )}

        {huidige.stap === "oplevering" && (
          <Financieelstap
            waarden={waarden}
            onWijzig={wijzig}
            traject={waarden.traject}
            moment={waarden.moment}
          />
        )}

        {huidige.stap === "betrokkenen" && (
          <>
            <Keuzelijst
              groepen={ALLE_CATEGORIEEN.map((categorie) => ({
                titel: CATEGORIELABELS[categorie],
                regels: STANDAARD_BETROKKENEN.filter((b) => b.categorie === categorie).map((b) => ({
                  sleutel: b.sleutel,
                  naam: b.naam,
                  detail: `${String(b.aanlooptijdDagen)} dagen aanloop · ${
                    b.annuleertermijnDagen > 0
                      ? `tot ${String(b.annuleertermijnDagen)} dagen gratis verzetten`
                      : "niet te annuleren"
                  }`,
                  ...(b.toelichting === undefined ? {} : { toelichting: b.toelichting }),
                })),
              })).filter((groep) => groep.regels.length > 0)}
              gekozen={gekozenBetrokkenen}
              onWissel={(sleutel) => {
                setGekozenBetrokkenen((h) =>
                  h.includes(sleutel) ? h.filter((s) => s !== sleutel) : [...h, sleutel],
                );
              }}
              boven={
                <Melding soort="info">
                  De aanlooptijden en annuleertermijnen zijn <strong>voorstellen</strong> op basis
                  van gangbare praktijk — geen normen. Controleer ze bij je eigen leverancier; dat
                  kan straks per partij.
                </Melding>
              }
            />
            <p className="mt-s3 text-sm text-granite">
              {keuzeSamenvatting(
                gekozenBetrokkenen.length,
                STANDAARD_BETROKKENEN.length,
                "partij",
                "partijen",
              )}
            </p>
          </>
        )}

        {huidige.stap === "onderdelen" && (
          <>
            <Keuzelijst
              groepen={[
                {
                  regels: STANDAARD_ONDERDELEN.map((o) => ({
                    sleutel: o.sleutel,
                    naam: o.naam,
                    detail: o.waarom,
                    ...(o.garantieMaanden === undefined
                      ? {}
                      : {
                          toelichting: `Gangbare fabrieksgarantie: ${String(
                            Math.round(o.garantieMaanden / 12),
                          )} jaar — een voorstel, geen belofte.`,
                        }),
                  })),
                },
              ]}
              gekozen={gekozenOnderdelen}
              onWissel={(sleutel) => {
                setGekozenOnderdelen((h) =>
                  h.includes(sleutel) ? h.filter((s) => s !== sleutel) : [...h, sleutel],
                );
              }}
              boven={
                <Melding soort="info">
                  Vink aan wat er in jouw woning zit. Merk, type en serienummer vul je later per
                  onderdeel in — die staan op het typeplaatje en in je opleverdossier.
                </Melding>
              }
            />
            <p className="mt-s3 text-sm text-granite">
              {keuzeSamenvatting(
                gekozenOnderdelen.length,
                STANDAARD_ONDERDELEN.length,
                "installatie",
                "installaties",
              )}
            </p>
          </>
        )}

        {huidige.stap === "onderhoud" && (
          <>
            <Keuzelijst
              groepen={[
                {
                  regels: STANDAARD_ONDERHOUD.map((t) => ({
                    sleutel: t.sleutel,
                    naam: t.titel,
                    detail: `${intervalTekst(t.intervalDagen)}${
                      t.voorkeursmaand === undefined
                        ? ""
                        : ` · het liefst in ${maandNaam(t.voorkeursmaand)}`
                    }${t.zelfTeDoen ? " · zelf te doen" : " · monteur nodig"}`,
                    toelichting: t.omschrijving,
                  })),
                },
              ]}
              gekozen={gekozenOnderhoud}
              onWissel={(sleutel) => {
                setGekozenOnderhoud((h) =>
                  h.includes(sleutel) ? h.filter((s) => s !== sleutel) : [...h, sleutel],
                );
              }}
              boven={
                <Melding soort="info">
                  De intervallen zijn <strong>voorstellen</strong>. Het onderhoudsvoorschrift van
                  de fabrikant wint altijd — bij een warmtepomp of een WTW-unit staat het gewoon in
                  de handleiding.
                </Melding>
              }
            />
            <p className="mt-s3 text-sm text-granite">
              {keuzeSamenvatting(
                gekozenOnderhoud.length,
                STANDAARD_ONDERHOUD.length,
                "taak",
                "taken",
              )}
            </p>
          </>
        )}

        {huidige.stap === "meters" && (
          <>
            <Keuzelijst
              groepen={[
                {
                  regels: METERBIBLIOTHEEK.map((m) => ({
                    sleutel: m.soort,
                    naam: m.label,
                    detail: `in ${m.eenheid}`,
                    toelichting: m.waarom,
                  })),
                },
              ]}
              gekozen={gekozenMeters}
              onWissel={(soort) => {
                setGekozenMeters((h) =>
                  h.includes(soort) ? h.filter((s) => s !== soort) : [...h, soort],
                );
              }}
              boven={
                <Melding soort="info">
                  Kies één stroomvorm: enkeltarief óf normaal en dal. Welke je hebt hangt af van je
                  contract, niet van je woning.
                </Melding>
              }
            />
            <p className="mt-s3 text-sm text-granite">
              {keuzeSamenvatting(gekozenMeters.length, METERBIBLIOTHEEK.length, "meter", "meters")}
            </p>
          </>
        )}

        {huidige.stap === "klaar" && (
          <div className="flex flex-col gap-s3">
            <dl className="flex flex-col gap-1.5">
              {plan
                .filter((s) => s.stap !== "start" && s.stap !== "klaar")
                .map((s) => (
                  <div key={s.stap} className="flex items-center justify-between gap-s2">
                    <dt className="text-body text-slate">{s.titel}</dt>
                    <dd
                      className={[
                        "text-body font-semibold",
                        afgerond.includes(s.stap) ? "text-olive-deep" : "text-granite",
                      ].join(" ")}
                    >
                      {afgerond.includes(s.stap) ? "ingevuld" : "later"}
                    </dd>
                  </div>
                ))}
            </dl>

            {openVerplicht.length > 0 ? (
              <Melding soort="fout">
                Deze onderdelen zijn nodig voordat de app iets zinnigs kan tonen:{" "}
                {openVerplicht.map((s) => s.titel).join(", ")}. Ga even terug en vul ze aan.
              </Melding>
            ) : (
              <Melding soort="gelukt">
                Alles wat op dit moment nodig is, staat erin. De rest kun je vanuit het dashboard
                aanvullen wanneer het zover is.
              </Melding>
            )}

            <p className="text-body text-slate">
              Vergeet niet een backup te maken zodra je iets van belang hebt ingevuld. Er is geen
              server die dat voor je doet — dat is het hele idee, maar het betekent wel dat de
              backup jouw taak is.
            </p>
          </div>
        )}
      </Wizardstap>

      {/* ── Ontsnappingsluik ─────────────────────────────────────────────
          Zonder deze knop is de wizard een val: je kunt er alleen doorheen,
          niet omheen. Wat je hebt ingevuld staat al opgeslagen. */}
      <div className="mt-s3 max-w-2xl">
        <Knop
          variant="secundair"
          onClick={() => {
            void navigeer("/", { replace: true });
          }}
        >
          Later verdergaan — naar het dashboard
        </Knop>
      </div>
    </AppShell>
  );
}
