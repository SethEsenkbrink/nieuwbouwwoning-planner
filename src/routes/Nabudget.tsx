import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Bedragveld } from "@/components/Bedragveld";
import { Tekstvlak } from "@/components/Tekstvlak";
import { Keuzeveld, type Keuze } from "@/components/Keuzeveld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { Voortgangsbalk } from "@/components/Voortgangsbalk";
import { useVault as useAuth } from "@/context/useVault";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { leesBedragInvoer, toonBedrag } from "@/lib/bedrag";
import {
  ontbrekendeStandaardposten,
  sorteerNabudget,
  telbaarBedrag,
  telNabudget,
} from "@/lib/nabudget";
import {
  haalActiefProject,
  haalNabudget,
  verwijderNabudget,
  voegStandaardNabudgetToe,
  zetNabudget,
} from "@/lib/projecten";
import type { NabudgetData, NabudgetMetId, ProjectMetId } from "@/lib/converters";
import type { NabudgetStatus } from "@/types/model";
import { STANDAARD_NABUDGET } from "@/data/nabudget-standaard";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Na de oplevering — wat er nog komt nadat de sleutel er ligt
 *
 * Een nieuwbouwwoning wordt kaal opgeleverd. Vloer, gordijnen, tuin, oprit en
 * verlichting zitten niet in de koopsom en niet in het bouwdepot, maar ze
 * bepalen wel wat het huis uiteindelijk kost. Het zijn precies de posten die
 * bij het rekenen worden vergeten, omdat ze pas opduiken als het te laat is om
 * er nog rekening mee te houden.
 *
 * TWEE BEDRAGEN PER POST: wat je dacht, en wat het werd. Eén bedrag zou het
 * interessantste getal wegpoetsen — je totale afwijking.
 *
 * GEEN RICHTBEDRAGEN IN DE STANDAARDLIJST. De spreiding is te groot (laminaat
 * of gietvloer, zelf leggen of laten leggen), en een verzonnen getal blijft als
 * anker in je hoofd hangen. De lijst is een geheugensteun, geen begroting.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const STATUSOPTIES: readonly Keuze<NabudgetStatus>[] = [
  { waarde: "geraamd", label: "Geraamd", toelichting: "Je hebt een bedrag in gedachten." },
  { waarde: "besteld", label: "Besteld", toelichting: "Opdracht gegeven." },
  { waarde: "betaald", label: "Betaald", toelichting: "Afgerekend." },
];

const LEEG = {
  omschrijving: "",
  geraamd: "",
  werkelijk: "",
  status: "geraamd" as NabudgetStatus,
  notitie: "",
};

/**
 * Hier zijn drie uitkomsten nodig en niet twee: een leeg veld is geen fout —
 * beide bedragen zijn optioneel — maar onleesbare invoer moet wél tegengehouden
 * worden. `leesBedragInvoer()` geeft voor allebei `undefined`, dus dat
 * onderscheid maken we hier op de lege string.
 */
function leesBedrag(tekst: string): number | undefined | "fout" {
  if (tekst.trim() === "") return undefined;
  return leesBedragInvoer(tekst) ?? "fout";
}

export default function Nabudget() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [posten, setPosten] = useState<NabudgetMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const [bewerktId, setBewerktId] = useState<string | null>(null);
  const [nieuw, setNieuw] = useState(false);
  const [verwijderId, setVerwijderId] = useState<string | null>(null);
  const [formulier, setFormulier] = useState(LEEG);
  const [gekozen, setGekozen] = useState<readonly string[]>([]);

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

        const geladen = await haalNabudget(uid, gevonden.id);
        if (!actueel) return;

        setProject(gevonden);
        setPosten(geladen);
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

  function bouwPost(): NabudgetData | null {
    const geraamd = leesBedrag(formulier.geraamd);
    const werkelijk = leesBedrag(formulier.werkelijk);
    if (geraamd === "fout" || werkelijk === "fout") {
      setFout("Een van de bedragen kan ik niet lezen. Bijvoorbeeld: 1250 of 1.250,50.");
      return null;
    }
    const notitie = formulier.notitie.trim();

    return {
      omschrijving: formulier.omschrijving.trim(),
      status: formulier.status,
      ...(geraamd === undefined ? {} : { geraamd }),
      ...(werkelijk === undefined ? {} : { werkelijk }),
      ...(notitie === "" ? {} : { notitie }),
    };
  }

  async function bewaar(bestaandId: string | null) {
    if (!uid || !project) return;

    if (formulier.omschrijving.trim() === "") {
      setFout("Geef de post een omschrijving.");
      return;
    }

    const post = bouwPost();
    if (!post) return;

    setBezig(true);
    setFout(null);
    try {
      await zetNabudget(uid, project.id, bestaandId, post);
      setGelukt(bestaandId ? "Post bijgewerkt." : "Post toegevoegd.");
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

  async function voegStandaardToe() {
    if (!uid || !project || gekozen.length === 0) return;

    setBezig(true);
    setFout(null);
    try {
      const aantal = await voegStandaardNabudgetToe(uid, project.id, gekozen);
      setGelukt(`${aantal} ${aantal === 1 ? "post" : "posten"} toegevoegd.`);
      setGekozen([]);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(post: NabudgetMetId) {
    if (!uid || !project) return;

    setBezig(true);
    setFout(null);
    try {
      await verwijderNabudget(uid, project.id, post.id);
      setGelukt(`“${post.omschrijving}” is verwijderd.`);
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

  const stand = telNabudget(posten);
  const gesorteerd = sorteerNabudget(posten);
  const ontbrekend = ontbrekendeStandaardposten(posten, STANDAARD_NABUDGET);

  const formulierVelden = (bestaandId: string | null) => (
    <div className="mt-s2 flex flex-col gap-s2 border-t border-bone pt-s3">
      <Veld
        label="Waar gaat het om?"
        value={formulier.omschrijving}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, omschrijving: e.target.value }));
        }}
      />
      <div className="grid gap-s2 sm:grid-cols-2">
        <Bedragveld
          label="Geraamd (optioneel)"
          hint="Wat je denkt dat het wordt."
          waarde={formulier.geraamd}
          onWijzig={(tekst) => {
            setFormulier((f) => ({ ...f, geraamd: tekst }));
          }}
        />
        <Bedragveld
          label="Werkelijk (optioneel)"
          hint="Zodra de rekening er ligt. Dit telt dan in plaats van de raming."
          waarde={formulier.werkelijk}
          onWijzig={(tekst) => {
            setFormulier((f) => ({ ...f, werkelijk: tekst }));
          }}
        />
      </div>
      <Keuzeveld
        label="Status"
        waarde={formulier.status}
        opties={STATUSOPTIES}
        onKies={(status) => {
          setFormulier((f) => ({ ...f, status }));
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
        <Knop bezig={bezig} onClick={() => void bewaar(bestaandId)}>
          {bestaandId ? "Opslaan" : "Post toevoegen"}
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
        <span className="text-eyebrow uppercase text-slate">Na de oplevering</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Wat er nog komt na de sleutel</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Een nieuwbouwwoning wordt kaal opgeleverd. Vloer, gordijnen, tuin en oprit zitten niet
        in de koopsom en niet in het bouwdepot — en ze worden bij het rekenen het vaakst
        vergeten.
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

      {/* ── Het totaal ──────────────────────────────────────────────────── */}
      {posten.length > 0 && (
        <section className="brink-card mt-s4 max-w-2xl p-s3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h3 text-ink">Totaal</h2>
            <span className="text-body text-ink">{toonBedrag(stand.totaal)}</span>

          {/* ── Begroot / werkelijk / nog verplicht ──────────────────────
              Drie getallen die elk een andere vraag beantwoorden (B5.4).
              Nog verplicht staat apart van wat nog te begroten valt: het
              ligt al vast, daar kun je niets meer aan veranderen. */}
          <dl className="mt-s3 grid gap-s2 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-slate">Begroot</dt>
              <dd className="text-body text-ink">{toonBedrag(stand.begroot)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate">Werkelijk</dt>
              <dd className="text-body text-ink">{toonBedrag(stand.werkelijk)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate">Nog verplicht</dt>
              <dd className="text-body text-ink">{toonBedrag(stand.nogVerplicht)}</dd>
            </div>
          </dl>
          </div>

          <div className="mt-s3">
            <Voortgangsbalk
              toon={toonBedrag}
              segmenten={[
                { label: "Betaald", waarde: stand.betaald, kleur: "bg-olive" },
                { label: "Besteld", waarde: stand.besteld, kleur: "bg-olive-light" },
                { label: "Nog te doen", waarde: stand.geraamd, kleur: "bg-taupe" },
              ]}
            />
          </div>

          {stand.afwijking !== 0 && (
            <p
              className={`mt-s3 text-body ${
                stand.afwijking > 0 ? "text-clay-deep" : "text-olive-deep"
              }`}
            >
              {stand.afwijking > 0
                ? `${toonBedrag(stand.afwijking)} duurder uitgevallen dan geraamd.`
                : `${toonBedrag(Math.abs(stand.afwijking))} meegevallen ten opzichte van de raming.`}{" "}
              <span className="text-granite">
                Gerekend over de posten waar zowel een raming als een rekening bekend is.
              </span>
            </p>
          )}

          {stand.zonderBedrag > 0 && (
            <p className="mt-s2 text-sm text-granite">
              {stand.zonderBedrag} {stand.zonderBedrag === 1 ? "post heeft" : "posten hebben"} nog
              geen bedrag — het totaal is dus een ondergrens.
            </p>
          )}
        </section>
      )}

      {/* ── Standaardposten aanvinken ───────────────────────────────────── */}
      {ontbrekend.length > 0 && (
        <section className="brink-card mt-s3 max-w-2xl p-s3">
          <h2 className="text-h3 text-ink">Vergeet je niets?</h2>
          <p className="mt-s2 text-body text-slate">
            Vink aan wat voor jou van toepassing is. Er staan bewust geen richtbedragen bij: de
            spreiding is te groot, en een verzonnen getal blijft in je hoofd hangen.
          </p>

          <div className="mt-s3 grid gap-s2 sm:grid-cols-2">
            {ontbrekend.map((omschrijving) => {
              const standaard = STANDAARD_NABUDGET.find((s) => s.omschrijving === omschrijving);
              const aan = gekozen.includes(omschrijving);

              return (
                <label
                  key={omschrijving}
                  className={[
                    "flex cursor-pointer gap-3 rounded-consent border p-s2 transition-colors",
                    aan ? "border-clay bg-clay/5" : "border-bone bg-lifted",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-clay"
                    checked={aan}
                    onChange={() => {
                      setGekozen((huidig) =>
                        huidig.includes(omschrijving)
                          ? huidig.filter((o) => o !== omschrijving)
                          : [...huidig, omschrijving],
                      );
                    }}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-body text-ink">{omschrijving}</span>
                    {standaard?.toelichting && (
                      <span className="text-sm text-granite">{standaard.toelichting}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {gekozen.length > 0 && (
            <div className="mt-s3">
              <Knop bezig={bezig} onClick={() => void voegStandaardToe()}>
                {gekozen.length} {gekozen.length === 1 ? "post" : "posten"} toevoegen
              </Knop>
            </div>
          )}
        </section>
      )}

      {/* ── Eigen post toevoegen ────────────────────────────────────────── */}
      <div className="mt-s3 max-w-2xl">
        {nieuw ? (
          <section className="brink-card p-s3">
            <h2 className="text-h3 text-ink">Nieuwe post</h2>
            {formulierVelden(null)}
          </section>
        ) : (
          <Knop
            variant="secundair"
            onClick={() => {
              setNieuw(true);
              setBewerktId(null);
              setVerwijderId(null);
              setFout(null);
              setGelukt(null);
              setFormulier(LEEG);
            }}
          >
            Eigen post toevoegen
          </Knop>
        )}
      </div>

      {/* ── De posten ───────────────────────────────────────────────────── */}
      <div className="mt-s4 flex max-w-2xl flex-col gap-s2">
        {gesorteerd.map((post) => {
          const wordtBewerkt = bewerktId === post.id;

          return (
            <article key={post.id} className="brink-card p-s3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-body font-semibold text-ink">{post.omschrijving}</h3>
                <span className="text-body text-ink">{toonBedrag(telbaarBedrag(post))}</span>
              </div>

              <div className="mt-s2 flex flex-wrap items-center gap-s2">
                <span className="rounded-pill bg-bone px-3 py-1 text-sm text-granite">
                  {post.status}
                </span>
                {post.geraamd !== undefined && post.werkelijk !== undefined && (
                  <span
                    className={`text-sm ${
                      post.werkelijk > post.geraamd ? "text-clay-deep" : "text-olive-deep"
                    }`}
                  >
                    geraamd {toonBedrag(post.geraamd)} → werd {toonBedrag(post.werkelijk)}
                  </span>
                )}
              </div>

              {post.notitie && <p className="mt-s2 text-sm text-granite">{post.notitie}</p>}

              {verwijderId === post.id ? (
                <div className="mt-s2 flex flex-col gap-s2">
                  <Melding soort="fout">
                    “{post.omschrijving}” verwijderen? Dit kan niet teruggedraaid worden.
                  </Melding>
                  <div className="flex flex-wrap gap-s2">
                    <Knop bezig={bezig} onClick={() => void verwijder(post)}>
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
                        setBewerktId(post.id);
                        setNieuw(false);
                        setVerwijderId(null);
                        setFout(null);
                        setGelukt(null);
                        setFormulier({
                          omschrijving: post.omschrijving,
                          geraamd: post.geraamd === undefined ? "" : String(post.geraamd),
                          werkelijk: post.werkelijk === undefined ? "" : String(post.werkelijk),
                          status: post.status,
                          notitie: post.notitie ?? "",
                        });
                      }}
                    >
                      Aanpassen
                    </Knop>
                    <Knop
                      variant="secundair"
                      onClick={() => {
                        setVerwijderId(post.id);
                        setBewerktId(null);
                      }}
                    >
                      Verwijderen
                    </Knop>
                  </div>
                )
              )}

              {wordtBewerkt && formulierVelden(post.id)}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
