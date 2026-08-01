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
import { opDag } from "@/lib/planning";
import {
  berekenGarantieklok,
  ordenSpecs,
  registratieOpenstaand,
  sorteerOnderdelen,
  telOpenstaandeRegistraties,
  telOverdracht,
} from "@/lib/onderdelen";
import {
  MONTAGEOPTIES,
  ONDERDEELCATEGORIEEN,
  STANDAARD_ONDERDELEN,
  standaardOnderdeel,
  type StandaardOnderdeel,
} from "@/data/onderdelen-standaard";
import {
  haalBetrokkenen,
  haalActiefProject,
  haalOnderdelen,
  meldRegistratieAan,
  verwijderOnderdeel,
  zetOnderdeel,
} from "@/lib/projecten";
import type { BetrokkeneMetId, OnderdeelMetId, ProjectMetId } from "@/lib/converters";
import type { Montage, OnderdeelCategorie } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Onderdelen — wat er in de woning zit (ADR-0013, blok E2)
 *
 * INVULLEN IS KIEZEN, NIET BEDENKEN. Je begint met een onderdeel uit de
 * bibliotheek; die vult de categorie, de montagevorm, de gangbare
 * garantietermijn en — het belangrijkste — de lijst met specvelden die er bij
 * dát type toe doen. Een warmtepomp vraagt om koudemiddel en SCOP, een batterij
 * om kWh en cyclusgarantie. Zelf verzinnen wat relevant is, is precies wat
 * niemand doet.
 *
 * DRIE DINGEN DIE HIER GEEN OPSMUK ZIJN
 *
 * 1. `montage` en `blijftBijWoning` staan los van elkaar (ADR-0013 §2). Een
 *    plug-in batterij is roerend en verhuist mee; een vaste installatie blijft.
 *    Maar er zijn uitzonderingen in beide richtingen, dus de bibliotheek stelt
 *    voor en de gebruiker beslist.
 * 2. Een openstaande registratieplicht staat bovenaan. Bij een thuisbatterij
 *    vanaf 0,8 kW is aanmelden bij de netbeheerder verplicht — ook plug-and-play
 *    — en zonder melding mag die je teruglevering weigeren.
 * 3. `documentUrl` is een LINK. Er wordt nooit een bestand opgeslagen (C2).
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface Formulier {
  sleutel: string | null;
  naam: string;
  categorie: OnderdeelCategorie;
  merk: string;
  type: string;
  serienummer: string;
  specs: Record<string, string>;
  montage: Montage;
  blijftBijWoning: boolean;
  installatieDatum: Date | undefined;
  installateurBetrokkeneId: string;
  garantieMaanden: string;
  registratieInstantie: string;
  registratieToelichting: string;
  documentUrl: string;
  notitie: string;
}

const LEEG: Formulier = {
  sleutel: null,
  naam: "",
  categorie: "overig",
  merk: "",
  type: "",
  serienummer: "",
  specs: {},
  montage: "vast_geinstalleerd",
  blijftBijWoning: true,
  installatieDatum: undefined,
  installateurBetrokkeneId: "",
  garantieMaanden: "",
  registratieInstantie: "",
  registratieToelichting: "",
  documentUrl: "",
  notitie: "",
};

function uitStandaard(standaard: StandaardOnderdeel): Formulier {
  return {
    ...LEEG,
    sleutel: standaard.sleutel,
    naam: standaard.naam,
    categorie: standaard.categorie,
    montage: standaard.montage,
    blijftBijWoning: standaard.blijftBijWoning,
    garantieMaanden:
      standaard.garantieMaanden === undefined ? "" : String(standaard.garantieMaanden),
    registratieInstantie: standaard.registratieplicht?.instantie ?? "",
    registratieToelichting: standaard.registratieplicht?.toelichting ?? "",
  };
}

function uitOnderdeel(onderdeel: OnderdeelMetId): Formulier {
  return {
    sleutel: null,
    naam: onderdeel.naam,
    categorie: onderdeel.categorie,
    merk: onderdeel.merk ?? "",
    type: onderdeel.type ?? "",
    serienummer: onderdeel.serienummer ?? "",
    specs: { ...onderdeel.specs },
    montage: onderdeel.montage,
    blijftBijWoning: onderdeel.blijftBijWoning,
    installatieDatum: onderdeel.installatieDatum,
    installateurBetrokkeneId: onderdeel.installateurBetrokkeneId ?? "",
    garantieMaanden:
      onderdeel.garantieMaanden === undefined ? "" : String(onderdeel.garantieMaanden),
    registratieInstantie: onderdeel.registratieplicht?.instantie ?? "",
    registratieToelichting: onderdeel.registratieplicht?.toelichting ?? "",
    documentUrl: onderdeel.documentUrl ?? "",
    notitie: onderdeel.notitie ?? "",
  };
}

/**
 * Bij welk standaardonderdeel hoort dit opgeslagen onderdeel? Nodig om de
 * specvolgorde en de veldlabels terug te vinden. Match op naam, want de sleutel
 * wordt niet opgeslagen: de bibliotheek is een hulpmiddel bij het invullen, geen
 * verwijzing die moet blijven kloppen als de lijst verandert.
 */
function bijbehorendeStandaard(onderdeel: OnderdeelMetId): StandaardOnderdeel | undefined {
  return STANDAARD_ONDERDELEN.find(
    (s) => s.naam.toLowerCase() === onderdeel.naam.toLowerCase(),
  );
}

const CATEGORIELABEL: Record<string, string> = Object.fromEntries(
  ONDERDEELCATEGORIEEN.map((c) => [c.waarde, c.label]),
);

export default function Onderdelen() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [onderdelen, setOnderdelen] = useState<OnderdeelMetId[]>([]);
  const [betrokkenen, setBetrokkenen] = useState<BetrokkeneMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);

  const [formulier, setFormulier] = useState<Formulier | null>(null);
  const [bewerktId, setBewerktId] = useState<string | null>(null);
  const [bezigMetOpslaan, setBezigMetOpslaan] = useState(false);
  const [bezigMetId, setBezigMetId] = useState<string | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<string | null>(null);
  const [nieuweSpec, setNieuweSpec] = useState("");

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

        const [geladenOnderdelen, geladenBetrokkenen] = await Promise.all([
          haalOnderdelen(uid, gevonden.id),
          haalBetrokkenen(uid, gevonden.id),
        ]);
        if (!actueel) return;

        setProject(gevonden);
        setOnderdelen(geladenOnderdelen);
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

  function wijzig(patch: Partial<Formulier>) {
    setFormulier((f) => (f === null ? f : { ...f, ...patch }));
  }

  function zetSpec(sleutel: string, waarde: string) {
    setFormulier((f) => (f === null ? f : { ...f, specs: { ...f.specs, [sleutel]: waarde } }));
  }

  function beginNieuw(standaard: StandaardOnderdeel | null) {
    setFormulier(standaard ? uitStandaard(standaard) : { ...LEEG });
    setBewerktId(null);
    setFout(null);
    setGelukt(null);
    setNieuweSpec("");
  }

  function beginBewerken(onderdeel: OnderdeelMetId) {
    setFormulier(uitOnderdeel(onderdeel));
    setBewerktId(onderdeel.id);
    setFout(null);
    setGelukt(null);
    setNieuweSpec("");
  }

  async function bewaar() {
    if (!uid || !project || !formulier) return;

    if (formulier.naam.trim() === "") {
      setFout("Geef het onderdeel een naam.");
      return;
    }

    // Geheel getal, want de rules eisen `is int` (optionalInt). Zonder deze
    // check komt "60.5" door de UI en wordt hij pas door Firestore geweigerd —
    // met een permissiefout die niets zegt over de oorzaak.
    const maanden = formulier.garantieMaanden.trim();
    const garantieMaanden = maanden === "" ? undefined : Number(maanden.replace(",", "."));
    if (
      garantieMaanden !== undefined &&
      (!Number.isInteger(garantieMaanden) || garantieMaanden < 0 || garantieMaanden > 600)
    ) {
      setFout("Vul de garantie in als een heel aantal maanden, bijvoorbeeld 60.");
      return;
    }

    setBezigMetOpslaan(true);
    setFout(null);
    setGelukt(null);
    try {
      const bestaand = bewerktId ? onderdelen.find((o) => o.id === bewerktId) : undefined;

      await zetOnderdeel(uid, project.id, bewerktId, {
        naam: formulier.naam.trim(),
        categorie: formulier.categorie,
        montage: formulier.montage,
        blijftBijWoning: formulier.blijftBijWoning,
        ...(formulier.merk.trim() ? { merk: formulier.merk.trim() } : {}),
        ...(formulier.type.trim() ? { type: formulier.type.trim() } : {}),
        ...(formulier.serienummer.trim() ? { serienummer: formulier.serienummer.trim() } : {}),
        ...(Object.keys(formulier.specs).length > 0 ? { specs: formulier.specs } : {}),
        ...(formulier.installatieDatum
          ? { installatieDatum: formulier.installatieDatum }
          : {}),
        ...(formulier.installateurBetrokkeneId
          ? { installateurBetrokkeneId: formulier.installateurBetrokkeneId }
          : {}),
        ...(garantieMaanden === undefined ? {} : { garantieMaanden }),
        ...(formulier.registratieInstantie.trim()
          ? {
              registratieplicht: {
                instantie: formulier.registratieInstantie.trim(),
                // De aanmelddatum blijft staan bij het bewerken: hij is een
                // feit over het verleden en mag niet stilzwijgend wissen omdat
                // het formulier hem niet toont.
                ...(bestaand?.registratieplicht?.aangemeldOp
                  ? { aangemeldOp: bestaand.registratieplicht.aangemeldOp }
                  : {}),
                ...(bestaand?.registratieplicht?.referentie
                  ? { referentie: bestaand.registratieplicht.referentie }
                  : {}),
                ...(formulier.registratieToelichting.trim()
                  ? { toelichting: formulier.registratieToelichting.trim() }
                  : {}),
              },
            }
          : {}),
        ...(formulier.documentUrl.trim() ? { documentUrl: formulier.documentUrl.trim() } : {}),
        ...(formulier.notitie.trim() ? { notitie: formulier.notitie.trim() } : {}),
      });

      setGelukt(bewerktId ? "Onderdeel bijgewerkt." : "Onderdeel toegevoegd.");
      setFormulier(null);
      setBewerktId(null);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetOpslaan(false);
    }
  }

  async function meldAan(onderdeel: OnderdeelMetId) {
    if (!uid || !project) return;

    setBezigMetId(onderdeel.id);
    setFout(null);
    try {
      await meldRegistratieAan(uid, project.id, onderdeel, opDag(new Date()));
      setGelukt(`${onderdeel.naam} staat nu als aangemeld.`);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetId(null);
    }
  }

  async function verwijder(onderdeelId: string) {
    if (!uid || !project) return;

    setBezigMetId(onderdeelId);
    setFout(null);
    try {
      await verwijderOnderdeel(uid, project.id, onderdeelId);
      setTeVerwijderen(null);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Verwijderen"));
    } finally {
      setBezigMetId(null);
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
  const gesorteerd = sorteerOnderdelen(onderdelen, vandaag);
  const openstaand = telOpenstaandeRegistraties(onderdelen);
  const overdracht = telOverdracht(onderdelen);

  const gekozenStandaard = formulier?.sleutel ? standaardOnderdeel(formulier.sleutel) : undefined;
  const specvelden = gekozenStandaard?.specs ?? [];

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Woning</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Onderdelen</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Wat er in het huis zit, met de gegevens die je bij een storing of een garantieclaim
        nodig hebt. Kies een onderdeel uit de lijst — dan staan de juiste velden er meteen bij.
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

      {openstaand > 0 && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="fout">
            {openstaand === 1
              ? "Eén onderdeel moet nog worden aangemeld"
              : `${openstaand} onderdelen moeten nog worden aangemeld`}{" "}
            bij een instantie. Zolang dat niet gebeurd is, kan de netbeheerder je teruglevering
            weigeren.
          </Melding>
        </div>
      )}

      {/* ── Toevoegen ───────────────────────────────────────────────────── */}
      {formulier === null ? (
        <section className="brink-card mt-s4 max-w-2xl p-s3">
          <h2 className="text-h3 text-ink">Onderdeel toevoegen</h2>
          <p className="mt-s2 text-body text-slate">
            Kies wat je wilt vastleggen. De lijst is alfabetisch per groep en bevat geen
            aanbevelingen — hij is er zodat je niet zelf hoeft te bedenken welke gegevens
            relevant zijn.
          </p>

          <div className="mt-s3 flex flex-wrap gap-2">
            {STANDAARD_ONDERDELEN.map((standaard) => (
              <button
                key={standaard.sleutel}
                type="button"
                onClick={() => {
                  beginNieuw(standaard);
                }}
                className="rounded-pill border border-bone bg-white px-4 py-2 text-sm text-ink transition-colors hover:border-olive"
              >
                {standaard.naam}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                beginNieuw(null);
              }}
              className="rounded-pill border border-dashed border-taupe px-4 py-2 text-sm text-slate transition-colors hover:border-olive"
            >
              Iets anders…
            </button>
          </div>
        </section>
      ) : (
        <section className="brink-card mt-s4 max-w-2xl p-s3">
          <h2 className="text-h3 text-ink">
            {bewerktId ? "Onderdeel bewerken" : "Nieuw onderdeel"}
          </h2>

          {gekozenStandaard && (
            <p className="mt-s2 text-body text-slate">{gekozenStandaard.waarom}</p>
          )}

          <div className="mt-s3 flex flex-col gap-s2">
            <Veld
              label="Naam"
              value={formulier.naam}
              onChange={(e) => {
                wijzig({ naam: e.target.value });
              }}
            />

            <Keuzeveld<OnderdeelCategorie>
              label="Categorie"
              waarde={formulier.categorie}
              opties={ONDERDEELCATEGORIEEN}
              onKies={(categorie) => {
                wijzig({ categorie });
              }}
            />

            <div className="grid gap-s2 sm:grid-cols-2">
              <Veld
                label="Merk"
                {...(gekozenStandaard?.merken
                  ? { list: `merken-${gekozenStandaard.sleutel}` }
                  : {})}
                value={formulier.merk}
                onChange={(e) => {
                  wijzig({ merk: e.target.value });
                }}
              />
              <Veld
                label="Type"
                {...(gekozenStandaard?.typereeksen
                  ? { list: `types-${gekozenStandaard.sleutel}` }
                  : {})}
                value={formulier.type}
                onChange={(e) => {
                  wijzig({ type: e.target.value });
                }}
              />
            </div>

            {/* Suggesties, geen keuzelijst: een merk dat er niet bij staat mag
                de gebruiker nooit blokkeren (ADR-0013 §6). */}
            {gekozenStandaard?.merken && (
              <datalist id={`merken-${gekozenStandaard.sleutel}`}>
                {gekozenStandaard.merken.map((merk) => (
                  <option key={merk} value={merk} />
                ))}
              </datalist>
            )}
            {gekozenStandaard?.typereeksen && (
              <datalist id={`types-${gekozenStandaard.sleutel}`}>
                {gekozenStandaard.typereeksen.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            )}

            <Veld
              label="Serienummer"
              hint="Staat op het typeplaatje. Dit is wat de servicedienst als eerste vraagt."
              value={formulier.serienummer}
              onChange={(e) => {
                wijzig({ serienummer: e.target.value });
              }}
            />

            {/* ── Specs uit de bibliotheek ──────────────────────────────── */}
            {specvelden.length > 0 && (
              <div className="mt-s2 rounded-consent border border-bone p-s3">
                <h3 className="text-body font-semibold text-ink">Technische gegevens</h3>
                <p className="mt-1 text-sm text-slate">
                  Alleen invullen wat je weet. Deze velden horen bij dit type onderdeel.
                </p>

                <div className="mt-s2 flex flex-col gap-s2">
                  {specvelden.map((veld) => (
                    <Veld
                      key={veld.sleutel}
                      label={veld.eenheid ? `${veld.label} (${veld.eenheid})` : veld.label}
                      {...(veld.hint ? { hint: veld.hint } : {})}
                      {...(veld.opties ? { list: `spec-${veld.sleutel}` } : {})}
                      value={formulier.specs[veld.sleutel] ?? ""}
                      onChange={(e) => {
                        zetSpec(veld.sleutel, e.target.value);
                      }}
                    />
                  ))}
                  {specvelden
                    .filter((veld) => veld.opties)
                    .map((veld) => (
                      <datalist key={`dl-${veld.sleutel}`} id={`spec-${veld.sleutel}`}>
                        {veld.opties?.map((optie) => (
                          <option key={optie} value={optie} />
                        ))}
                      </datalist>
                    ))}
                </div>
              </div>
            )}

            {/* Eigen specs blijven mogelijk, ook bij een vrij onderdeel. */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Veld
                  label="Eigen gegeven toevoegen"
                  hint="Bijvoorbeeld “kleurcode” of “filtermaat”."
                  value={nieuweSpec}
                  onChange={(e) => {
                    setNieuweSpec(e.target.value);
                  }}
                />
              </div>
              <Knop
                variant="secundair"
                disabled={nieuweSpec.trim() === ""}
                onClick={() => {
                  zetSpec(nieuweSpec.trim(), "");
                  setNieuweSpec("");
                }}
              >
                Toevoegen
              </Knop>
            </div>

            {/* Specs die niet uit de bibliotheek komen, blijven bewerkbaar. */}
            {Object.keys(formulier.specs)
              .filter((sleutel) => !specvelden.some((v) => v.sleutel === sleutel))
              .map((sleutel) => (
                <Veld
                  key={sleutel}
                  label={sleutel}
                  value={formulier.specs[sleutel] ?? ""}
                  onChange={(e) => {
                    zetSpec(sleutel, e.target.value);
                  }}
                />
              ))}

            {/* ── Montage en overdracht ─────────────────────────────────── */}
            <Keuzeveld<Montage>
              label="Hoe zit het in huis"
              waarde={formulier.montage}
              opties={MONTAGEOPTIES}
              onKies={(montage) => {
                wijzig({ montage });
              }}
            />

            <label className="flex items-start gap-2 text-body text-ink">
              <input
                type="checkbox"
                checked={formulier.blijftBijWoning}
                onChange={(e) => {
                  wijzig({ blijftBijWoning: e.target.checked });
                }}
                className="mt-1 size-4 rounded-xs border-bone text-olive"
              />
              <span>
                Blijft bij de woning achter
                <span className="mt-1 block text-sm text-slate">
                  Bepaalt wat er straks in het overdrachtsdossier komt, en of het onder de
                  opstal- of de inboedelverzekering valt. Staat los van hoe het gemonteerd is.
                </span>
              </span>
            </label>

            {/* ── Installatie en garantie ───────────────────────────────── */}
            <Datumveld
              label="Installatiedatum"
              hint="Hiervandaan telt de fabrieksgarantie."
              waarde={formulier.installatieDatum}
              onKies={(installatieDatum) => {
                wijzig({ installatieDatum });
              }}
            />

            <div className="grid gap-s2 sm:grid-cols-2">
              <Veld
                label="Garantie (maanden)"
                inputMode="numeric"
                hint="60 maanden is vijf jaar. De einddatum rekent de app zelf uit."
                value={formulier.garantieMaanden}
                onChange={(e) => {
                  wijzig({ garantieMaanden: e.target.value });
                }}
              />
              <Keuzeveld<string>
                label="Installateur"
                waarde={formulier.installateurBetrokkeneId}
                opties={[
                  { waarde: "", label: "Niet gekoppeld" },
                  ...betrokkenen.map((b) => ({ waarde: b.id, label: b.naam })),
                ]}
                onKies={(installateurBetrokkeneId) => {
                  wijzig({ installateurBetrokkeneId });
                }}
              />
            </div>

            {/* ── Registratieplicht ─────────────────────────────────────── */}
            {formulier.registratieInstantie && (
              <div className="rounded-consent border border-clay/30 bg-clay/5 p-s3">
                <h3 className="text-body font-semibold text-ink">Aanmelden verplicht</h3>
                <p className="mt-1 text-sm text-slate">{formulier.registratieToelichting}</p>
                <p className="mt-s2 text-sm text-granite">
                  Bij: {formulier.registratieInstantie}
                </p>
              </div>
            )}

            <Veld
              label="Link naar handleiding of factuur"
              hint="De app bewaart alleen de vindplaats, nooit het bestand zelf."
              placeholder="https://"
              value={formulier.documentUrl}
              onChange={(e) => {
                wijzig({ documentUrl: e.target.value });
              }}
            />

            <Tekstvlak
              label="Notitie"
              value={formulier.notitie}
              onChange={(e) => {
                wijzig({ notitie: e.target.value });
              }}
            />
          </div>

          <div className="mt-s3 flex flex-wrap gap-s2">
            <Knop bezig={bezigMetOpslaan} onClick={() => void bewaar()}>
              {bewerktId ? "Wijzigingen opslaan" : "Onderdeel toevoegen"}
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

      {/* ── Het register ────────────────────────────────────────────────── */}
      <section className="mt-s6 max-w-2xl">
        <h2 className="text-h3 text-ink">
          {onderdelen.length === 0
            ? "Nog niets vastgelegd"
            : `${onderdelen.length} ${onderdelen.length === 1 ? "onderdeel" : "onderdelen"}`}
        </h2>

        {onderdelen.length > 0 && (
          <p className="mt-s2 text-sm text-granite">
            {overdracht.blijftAchter} blijft bij de woning · {overdracht.verhuistMee} verhuist mee
          </p>
        )}

        {onderdelen.length === 0 ? (
          <div className="mt-s2">
            <Melding soort="info">
              Begin bij de installaties: de warmtepomp, de ventilatie-unit en de omvormer. Dat
              zijn de apparaten waarvan je de gegevens het eerst kwijt bent en het hardst nodig
              hebt.
            </Melding>
          </div>
        ) : (
          <div className="mt-s3 flex flex-col gap-s2">
            {gesorteerd.map((onderdeel) => {
              const klok = berekenGarantieklok(onderdeel, vandaag);
              const standaard = bijbehorendeStandaard(onderdeel);
              const specregels = ordenSpecs(
                onderdeel.specs,
                standaard?.specs.map((s) => s.sleutel) ?? [],
              );
              const installateur = betrokkenen.find(
                (b) => b.id === onderdeel.installateurBetrokkeneId,
              );

              return (
                <article key={onderdeel.id} className="brink-card p-s3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-body font-semibold text-ink">{onderdeel.naam}</h3>
                      <p className="mt-1 text-sm text-slate">
                        {CATEGORIELABEL[onderdeel.categorie] ?? onderdeel.categorie}
                        {onderdeel.merk && ` · ${onderdeel.merk}`}
                        {onderdeel.type && ` ${onderdeel.type}`}
                      </p>
                    </div>
                    <span className="rounded-pill bg-bone px-3 py-1 text-sm text-charcoal">
                      {onderdeel.blijftBijWoning ? "Blijft achter" : "Verhuist mee"}
                    </span>
                  </div>

                  {registratieOpenstaand(onderdeel) && (
                    <div className="mt-s2">
                      <Melding soort="fout">
                        Nog niet aangemeld bij {onderdeel.registratieplicht?.instantie}.
                        {onderdeel.registratieplicht?.toelichting && (
                          <span className="mt-1 block text-sm">
                            {onderdeel.registratieplicht.toelichting}
                          </span>
                        )}
                      </Melding>
                      <div className="mt-s2">
                        <Knop
                          variant="secundair"
                          bezig={bezigMetId === onderdeel.id}
                          onClick={() => void meldAan(onderdeel)}
                        >
                          Aangemeld
                        </Knop>
                      </div>
                    </div>
                  )}

                  {onderdeel.registratieplicht?.aangemeldOp && (
                    <p className="mt-s2 text-sm text-granite">
                      Aangemeld op {toonDatum(onderdeel.registratieplicht.aangemeldOp)}
                      {onderdeel.registratieplicht.referentie &&
                        ` · ${onderdeel.registratieplicht.referentie}`}
                    </p>
                  )}

                  {klok && (
                    <p
                      className={`mt-s2 text-sm ${klok.bijnaVoorbij ? "text-clay-deep" : "text-granite"}`}
                    >
                      {klok.voorbij
                        ? `Garantie verlopen op ${toonDatum(klok.verstrijktOp)}`
                        : `Garantie tot ${toonDatum(klok.verstrijktOp)} — nog ${klok.dagenResterend} dagen`}
                      {klok.bijnaVoorbij && " · laat het nu nakijken"}
                    </p>
                  )}

                  {onderdeel.serienummer && (
                    <p className="mt-s2 text-sm text-granite">
                      Serienummer: {onderdeel.serienummer}
                    </p>
                  )}

                  {specregels.length > 0 && (
                    <dl className="mt-s2 grid gap-x-s3 gap-y-1 sm:grid-cols-2">
                      {specregels.map((regel) => {
                        const veld = standaard?.specs.find((s) => s.sleutel === regel.sleutel);
                        return (
                          <div key={regel.sleutel} className="flex justify-between gap-2">
                            <dt className="text-sm text-slate">{veld?.label ?? regel.sleutel}</dt>
                            <dd className="text-sm text-ink">
                              {regel.waarde}
                              {veld?.eenheid && ` ${veld.eenheid}`}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}

                  {(installateur ?? onderdeel.installatieDatum) && (
                    <p className="mt-s2 text-sm text-granite">
                      {onderdeel.installatieDatum &&
                        `Geïnstalleerd op ${toonDatum(onderdeel.installatieDatum)}`}
                      {installateur && ` · ${installateur.naam}`}
                    </p>
                  )}

                  {onderdeel.notitie && (
                    <p className="mt-s2 text-sm text-slate">{onderdeel.notitie}</p>
                  )}

                  <div className="mt-s3 flex flex-wrap items-center gap-s2">
                    <Knop
                      variant="secundair"
                      onClick={() => {
                        beginBewerken(onderdeel);
                      }}
                    >
                      Bewerken
                    </Knop>

                    {onderdeel.documentUrl && (
                      <a
                        href={onderdeel.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-olive-deep underline"
                      >
                        Handleiding openen
                      </a>
                    )}

                    {teVerwijderen === onderdeel.id ? (
                      <>
                        <Knop
                          bezig={bezigMetId === onderdeel.id}
                          onClick={() => void verwijder(onderdeel.id)}
                        >
                          Definitief verwijderen
                        </Knop>
                        <Knop
                          variant="secundair"
                          onClick={() => {
                            setTeVerwijderen(null);
                          }}
                        >
                          Annuleren
                        </Knop>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setTeVerwijderen(onderdeel.id);
                        }}
                        className="text-sm text-slate underline"
                      >
                        Verwijderen
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
