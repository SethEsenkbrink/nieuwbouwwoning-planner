import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Stapindicator } from "@/components/Stapindicator";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { Projectgegevensformulier } from "@/components/Projectgegevensformulier";
import {
  LEGE_PROJECTGEGEVENS,
  type Projectgegevenswaarden,
} from "@/lib/projectgegevens";
import { Opleverbandformulier } from "@/components/Opleverbandformulier";
import { useVault as useAuth } from "@/context/useVault";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import {
  controleerOpleverband,
  naarOpslag,
  uitProject,
  type Opleverbandwaarden,
} from "@/lib/opleverband";
import {
  haalActiefProject,
  maakProject,
  voegStandaardBetrokkenenToe,
  werkProjectBij,
} from "@/lib/projecten";
import { STANDAARD_BETROKKENEN } from "@/data/betrokkenen-standaard";
import { ALLE_CATEGORIEEN } from "@/lib/converters";
import type { BetrokkeneCategorie } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Projectwizard — drie stappen
 *
 * 1. Projectgegevens
 * 2. Opleverdatum, als band met een staat (ADR-0008, principe 1)
 * 3. Betrokkenen aanvinken uit de standaardbibliotheek
 *
 * HET PROJECT WORDT NA STAP 1 AL AANGEMAAKT, niet aan het eind. Dat kost een
 * extra schrijfactie, maar je kunt de wizard sluiten en later verdergaan zonder
 * alles opnieuw in te tikken. Bij het openen springt hij naar de eerste stap
 * die nog niet af is.
 *
 * DE FORMULIEREN VAN STAP 1 EN 2 STAAN NIET HIER, MAAR IN `components/`.
 * Ze komen ook voor op `/project` (de projectinstellingen), en dat is precies
 * het soort duplicatie dat na drie wijzigingen uit elkaar loopt: een extra veld
 * op het ene scherm, een andere toelichting op het andere. De omzetting van de
 * opleverband naar de drie opgeslagen datums zit in `src/lib/opleverband.ts`,
 * met tests.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const STAPPEN = ["Project", "Opleverdatum", "Betrokkenen"] as const;

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

export default function ProjectWizard() {
  const { gebruiker } = useAuth();
  const navigeer = useNavigate();

  const [stap, setStap] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const [gegevens, setGegevens] = useState<Projectgegevenswaarden>(LEGE_PROJECTGEGEVENS);
  const [band, setBand] = useState<Opleverbandwaarden>(uitProject({}));
  const [gekozen, setGekozen] = useState<readonly string[]>([]);

  const uid = gebruiker?.uid;

  /**
   * Bestaat er al een project, dan verdergaan waar je gebleven was in plaats
   * van een tweede project aanmaken.
   */
  useEffect(() => {
    if (!uid) return;
    let actueel = true;

    void (async () => {
      try {
        const bestaand = await haalActiefProject(uid);
        if (!actueel) return;
        if (bestaand) {
          setProjectId(bestaand.id);
          setGegevens({
            naam: bestaand.naam,
            bouwnummer: bestaand.bouwnummer ?? "",
            projectnaam: bestaand.projectnaam ?? "",
            aannemer: bestaand.aannemer ?? "",
            waarborg: bestaand.garantiewaarborg ?? "woningborg",
            koopsom: bestaand.koopsom === undefined ? "" : String(bestaand.koopsom),
            meerwerkbudget:
              bestaand.meerwerkbudget === undefined ? "" : String(bestaand.meerwerkbudget),
            bouwdepot:
              bestaand.bouwdepotBedrag === undefined ? "" : String(bestaand.bouwdepotBedrag),
          });
          setBand(uitProject(bestaand));
          setStap(bestaand.opleverStatus ? 2 : 1);
        }
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

  const perCategorie = useMemo(
    () =>
      ALLE_CATEGORIEEN.map((categorie) => ({
        categorie,
        partijen: STANDAARD_BETROKKENEN.filter((b) => b.categorie === categorie),
      })).filter((groep) => groep.partijen.length > 0),
    [],
  );

  if (!uid) return <Laadscherm />;
  if (bezigMetLaden) return <Laadscherm />;

  async function bewaarStap1() {
    if (!uid) return;
    if (gegevens.naam.trim() === "") {
      setFout("Geef je project een naam.");
      return;
    }
    setBezig(true);
    setFout(null);
    try {
      const teBewaren = {
        naam: gegevens.naam.trim(),
        bouwnummer: gegevens.bouwnummer.trim() || undefined,
        projectnaam: gegevens.projectnaam.trim() || undefined,
        aannemer: gegevens.aannemer.trim() || undefined,
        garantiewaarborg: gegevens.waarborg,
      };
      if (projectId) {
        await werkProjectBij(uid, projectId, teBewaren);
      } else {
        setProjectId(await maakProject(uid, teBewaren));
      }
      setStap(1);
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function bewaarStap2() {
    if (!uid || !projectId) return;

    const melding = controleerOpleverband(band);
    if (melding) {
      setFout(melding);
      return;
    }

    setBezig(true);
    setFout(null);
    try {
      await werkProjectBij(uid, projectId, naarOpslag(band));
      setStap(2);
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function bewaarStap3() {
    if (!uid || !projectId) return;
    setBezig(true);
    setFout(null);
    try {
      await voegStandaardBetrokkenenToe(uid, projectId, gekozen);
      void navigeer("/", { replace: true });
    } catch (f) {
      setFout(opslagFoutmelding(f, "De betrokkenen opslaan"));
    } finally {
      setBezig(false);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Nieuw project</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">{STAPPEN[stap]}</h1>

      <div className="mt-s3">
        <Stapindicator stappen={STAPPEN} huidige={stap} />
      </div>

      {fout && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}

      {stap === 0 && (
        <div className="brink-card mt-s4 max-w-xl p-s3">
          <Projectgegevensformulier
            waarden={gegevens}
            onWijzig={(patch) => {
              setGegevens((g) => ({ ...g, ...patch }));
            }}
            autoFocusNaam
          />

          <div className="mt-s3 flex justify-end">
            <Knop bezig={bezig} onClick={() => void bewaarStap1()}>
              Verder
            </Knop>
          </div>
        </div>
      )}

      {stap === 1 && (
        <div className="brink-card mt-s4 max-w-xl p-s3">
          <p className="text-body text-slate">
            De opleverdatum schuift bijna altijd. Daarom slaat de app niet alleen een datum op, maar
            ook hoe zeker die is — dat bepaalt wie je nu al kunt inplannen en wie beter nog even kan
            wachten.
          </p>

          <div className="mt-s3">
            <Opleverbandformulier
              waarden={band}
              onWijzig={(patch) => {
                setBand((b) => ({ ...b, ...patch }));
              }}
            />
          </div>

          <div className="mt-s3 flex justify-between">
            <Knop
              variant="secundair"
              onClick={() => {
                setStap(0);
              }}
            >
              Terug
            </Knop>
            <Knop bezig={bezig} onClick={() => void bewaarStap2()}>
              Verder
            </Knop>
          </div>
        </div>
      )}

      {stap === 2 && (
        <div className="mt-s4">
          <p className="max-w-xl text-body text-slate">
            Vink aan wie je zelf inschakelt. De app zet er meteen de bijbehorende afspraken bij,
            gekoppeld aan het juiste bouwmoment. Je kunt dit later altijd aanvullen.
          </p>

          <div className="mt-s3 max-w-xl">
            <Melding soort="info">
              De aanlooptijden en annuleertermijnen hieronder zijn <strong>voorstellen</strong> op
              basis van gangbare praktijk — geen normen. Controleer ze bij je eigen leverancier en
              pas ze aan; dat kan straks per partij.
            </Melding>
          </div>

          <div className="mt-s4 flex flex-col gap-s4">
            {perCategorie.map(({ categorie, partijen }) => (
              <section key={categorie}>
                <h2 className="text-h3 text-ink">{CATEGORIELABELS[categorie]}</h2>
                <div className="mt-s2 grid gap-s2 sm:grid-cols-2">
                  {partijen.map((partij) => {
                    const aan = gekozen.includes(partij.sleutel);
                    return (
                      <label
                        key={partij.sleutel}
                        className={[
                          "brink-card flex cursor-pointer gap-3 p-s2 transition-colors",
                          aan ? "ring-2 ring-clay" : "",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 accent-clay"
                          checked={aan}
                          onChange={() => {
                            setGekozen((huidig) =>
                              huidig.includes(partij.sleutel)
                                ? huidig.filter((s) => s !== partij.sleutel)
                                : [...huidig, partij.sleutel],
                            );
                          }}
                        />
                        <span className="flex flex-col gap-1">
                          <span className="text-body font-semibold text-ink">{partij.naam}</span>
                          <span className="text-sm text-slate">
                            {partij.aanlooptijdDagen} dagen aanloop ·{" "}
                            {partij.annuleertermijnDagen > 0
                              ? `tot ${partij.annuleertermijnDagen} dagen gratis verzetten`
                              : "niet te annuleren"}
                          </span>
                          {partij.toelichting && (
                            <span className="text-sm text-granite">{partij.toelichting}</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-s4 flex max-w-xl justify-between">
            <Knop
              variant="secundair"
              onClick={() => {
                setStap(1);
              }}
            >
              Terug
            </Knop>
            <Knop bezig={bezig} onClick={() => void bewaarStap3()}>
              {gekozen.length === 0
                ? "Overslaan"
                : `${gekozen.length} ${gekozen.length === 1 ? "partij" : "partijen"} toevoegen`}
            </Knop>
          </div>
        </div>
      )}
    </AppShell>
  );
}
