import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useAuth } from "@/context/useAuth";
import { haalActiefProject, haalBetrokkenen, werkBetrokkeneBij } from "@/lib/projecten";
import type { BetrokkeneMetId } from "@/lib/converters";
import type { BetrokkeneCategorie } from "@/types/model";

/**
 * Overzicht van de partijen die je zelf hebt ingeschakeld.
 *
 * Hier maak je de startwaarden van de standaardbibliotheek tot je eigen
 * cijfers: pas je een termijn aan, dan gaat `waardenBron` naar "eigen" en
 * verdwijnt het voorstel-label. Die omzetting gebeurt in `projecten.ts`, niet
 * in dit formulier — zie ADR-0009.
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

export default function Betrokkenen() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [projectId, setProjectId] = useState<string | null>(null);
  const [betrokkenen, setBetrokkenen] = useState<BetrokkeneMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const [bewerktId, setBewerktId] = useState<string | null>(null);
  const [aanlooptijd, setAanlooptijd] = useState("");
  const [annuleertermijn, setAnnuleertermijn] = useState("");
  const [bezig, setBezig] = useState(false);

  /**
   * Ophogen betekent "haal opnieuw op". Zo blijft het laden één effect, zonder
   * dat er synchroon state gezet wordt in de effect-body — dat veroorzaakt
   * cascaderende renders en wordt door de lint-regels (terecht) geweigerd.
   */
  const [herlaadTeller, setHerlaadTeller] = useState(0);
  const herlaad = useCallback(() => {
    setHerlaadTeller((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let actueel = true;

    void (async () => {
      try {
        const project = await haalActiefProject(uid);
        if (!actueel) return;

        if (!project) {
          setProjectId(null);
          setBetrokkenen([]);
          return;
        }

        const gevonden = await haalBetrokkenen(uid, project.id);
        if (!actueel) return;
        setProjectId(project.id);
        setBetrokkenen(gevonden);
      } catch {
        if (actueel) setFout("De betrokkenen konden niet worden geladen.");
      } finally {
        if (actueel) setBezigMetLaden(false);
      }
    })();

    return () => {
      actueel = false;
    };
  }, [uid, herlaadTeller]);

  function beginBewerken(betrokkene: BetrokkeneMetId) {
    setBewerktId(betrokkene.id);
    setAanlooptijd(String(betrokkene.aanlooptijdDagen));
    setAnnuleertermijn(String(betrokkene.annuleertermijnDagen));
    setFout(null);
  }

  async function bewaar(betrokkene: BetrokkeneMetId) {
    if (!uid || !projectId) return;

    const nieuweAanlooptijd = Number(aanlooptijd);
    const nieuweAnnuleertermijn = Number(annuleertermijn);
    if (
      !Number.isInteger(nieuweAanlooptijd) ||
      !Number.isInteger(nieuweAnnuleertermijn) ||
      nieuweAanlooptijd < 0 ||
      nieuweAnnuleertermijn < 0
    ) {
      setFout("Vul hele dagen in, vanaf 0.");
      return;
    }

    setBezig(true);
    setFout(null);
    try {
      await werkBetrokkeneBij(uid, projectId, betrokkene, {
        aanlooptijdDagen: nieuweAanlooptijd,
        annuleertermijnDagen: nieuweAnnuleertermijn,
      });
      setBewerktId(null);
      herlaad();
    } catch {
      setFout("Opslaan is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  if (!uid || bezigMetLaden) return <Laadscherm />;

  const groepen = Object.entries(
    betrokkenen.reduce<Partial<Record<BetrokkeneCategorie, BetrokkeneMetId[]>>>((acc, b) => {
      (acc[b.categorie] ??= []).push(b);
      return acc;
    }, {}),
  ) as [BetrokkeneCategorie, BetrokkeneMetId[]][];

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Betrokkenen</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Wie er bij je bouw betrokken is</h1>

      {fout && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}

      {!projectId && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="info">
            Je hebt nog geen project. <Link to="/project/nieuw">Maak er eerst een aan.</Link>
          </Melding>
        </div>
      )}

      {projectId && betrokkenen.length === 0 && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="info">
            Nog geen betrokkenen toegevoegd.{" "}
            <Link to="/project/nieuw">Vink ze alsnog aan in de wizard.</Link>
          </Melding>
        </div>
      )}

      <div className="mt-s4 flex flex-col gap-s4">
        {groepen.map(([categorie, partijen]) => (
          <section key={categorie}>
            <h2 className="text-h3 text-ink">{CATEGORIELABELS[categorie]}</h2>

            <div className="mt-s2 flex flex-col gap-s2">
              {partijen.map((betrokkene) => (
                <article key={betrokkene.id} className="brink-card max-w-2xl p-s3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-body font-semibold text-ink">{betrokkene.naam}</h3>
                    {betrokkene.waardenBron === "voorstel" && (
                      <span className="rounded-pill bg-bone px-3 py-1 text-sm text-granite">
                        voorstel — controleer bij je leverancier
                      </span>
                    )}
                  </div>

                  {bewerktId === betrokkene.id ? (
                    <div className="mt-s2 flex flex-col gap-s2">
                      <Veld
                        label="Aanlooptijd in dagen"
                        hint="Hoeveel tijd zit er tussen “ze weten het” en “ze staan er”?"
                        inputMode="numeric"
                        value={aanlooptijd}
                        onChange={(e) => {
                          setAanlooptijd(e.target.value);
                        }}
                      />
                      <Veld
                        label="Annuleertermijn in dagen"
                        hint="Tot hoeveel dagen van tevoren kun je kosteloos verzetten? 0 = niet van toepassing."
                        inputMode="numeric"
                        value={annuleertermijn}
                        onChange={(e) => {
                          setAnnuleertermijn(e.target.value);
                        }}
                      />
                      <div className="flex gap-s2">
                        <Knop bezig={bezig} onClick={() => void bewaar(betrokkene)}>
                          Opslaan
                        </Knop>
                        <Knop
                          variant="secundair"
                          onClick={() => {
                            setBewerktId(null);
                          }}
                        >
                          Annuleren
                        </Knop>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-s2 flex flex-wrap items-center justify-between gap-s2">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-s2 gap-y-1 text-body">
                        <dt className="text-slate">Aanlooptijd</dt>
                        <dd className="text-ink">{betrokkene.aanlooptijdDagen} dagen</dd>
                        <dt className="text-slate">Kosteloos verzetten</dt>
                        <dd className="text-ink">
                          {betrokkene.annuleertermijnDagen > 0
                            ? `tot ${betrokkene.annuleertermijnDagen} dagen van tevoren`
                            : "niet van toepassing"}
                        </dd>
                        <dt className="text-slate">Informeren</dt>
                        <dd className="text-ink">
                          {betrokkene.communicatieregel === "direct"
                            ? "bij elke wijziging"
                            : betrokkene.communicatieregel === "bij_aanzegging"
                              ? "pas als de datum vaststaat"
                              : "handmatig"}
                        </dd>
                      </dl>
                      <Knop
                        variant="secundair"
                        onClick={() => {
                          beginBewerken(betrokkene);
                        }}
                      >
                        Termijnen aanpassen
                      </Knop>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
