import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Keuzeveld } from "@/components/Keuzeveld";
import { Datumveld } from "@/components/Datumveld";
import { Stapindicator } from "@/components/Stapindicator";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useAuth } from "@/context/useAuth";
import {
  haalActiefProject,
  maakProject,
  voegStandaardBetrokkenenToe,
  werkProjectBij,
} from "@/lib/projecten";
import { STANDAARD_BETROKKENEN } from "@/data/betrokkenen-standaard";
import { ALLE_CATEGORIEEN } from "@/lib/converters";
import type { BetrokkeneCategorie, Garantiewaarborg, OpleverStatus } from "@/types/model";

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
 * ═══════════════════════════════════════════════════════════════════════════
 */

const STAPPEN = ["Project", "Opleverdatum", "Betrokkenen"] as const;

const WAARBORGEN = [
  { waarde: "woningborg", label: "Woningborg" },
  { waarde: "swk", label: "SWK" },
  { waarde: "geen", label: "Geen garantiewaarborg" },
  { waarde: "anders", label: "Anders" },
] as const satisfies readonly { waarde: Garantiewaarborg; label: string }[];

const OPLEVERSTATUSSEN = [
  {
    waarde: "indicatief",
    label: "Indicatief — een schatting",
    toelichting:
      "Zoiets als “ergens in week 45”. Boek nog niemand definitief; partijen met een lange " +
      "aanlooptijd wil je wel alvast op de hoogte houden.",
  },
  {
    waarde: "bandbreedte",
    label: "Bandbreedte — tussen twee datums",
    toelichting:
      "Je weet de vroegste en de laatste datum. De app rekent met alle drie de datums, zodat " +
      "je ziet hoe breed het nog is.",
  },
  {
    waarde: "aangezegd",
    label: "Aangezegd — formeel vastgelegd",
    toelichting:
      "De aannemer heeft de datum officieel aangezegd. Nu pas kun je iedereen definitief " +
      "inplannen.",
  },
] as const satisfies readonly { waarde: OpleverStatus; label: string; toelichting: string }[];

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

  // Stap 1
  const [naam, setNaam] = useState("");
  const [bouwnummer, setBouwnummer] = useState("");
  const [projectnaam, setProjectnaam] = useState("");
  const [aannemer, setAannemer] = useState("");
  const [waarborg, setWaarborg] = useState<Garantiewaarborg>("woningborg");

  // Stap 2
  const [opleverStatus, setOpleverStatus] = useState<OpleverStatus>("indicatief");
  const [vroegst, setVroegst] = useState<Date | undefined>(undefined);
  const [verwacht, setVerwacht] = useState<Date | undefined>(undefined);
  const [laatst, setLaatst] = useState<Date | undefined>(undefined);
  const [bron, setBron] = useState("");

  // Stap 3
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
          setNaam(bestaand.naam);
          setBouwnummer(bestaand.bouwnummer ?? "");
          setProjectnaam(bestaand.projectnaam ?? "");
          setAannemer(bestaand.aannemer ?? "");
          setWaarborg(bestaand.garantiewaarborg ?? "woningborg");
          setOpleverStatus(bestaand.opleverStatus ?? "indicatief");
          setVroegst(bestaand.opleverVroegst);
          setVerwacht(bestaand.opleverVerwacht);
          setLaatst(bestaand.opleverLaatst);
          setBron(bestaand.opleverBron ?? "");
          setStap(bestaand.opleverStatus ? 2 : 1);
        }
      } catch {
        if (actueel) setFout("Je project kon niet worden geladen. Probeer het opnieuw.");
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
    if (naam.trim() === "") {
      setFout("Geef je project een naam.");
      return;
    }
    setBezig(true);
    setFout(null);
    try {
      const gegevens = {
        naam: naam.trim(),
        bouwnummer: bouwnummer.trim() || undefined,
        projectnaam: projectnaam.trim() || undefined,
        aannemer: aannemer.trim() || undefined,
        garantiewaarborg: waarborg,
      };
      if (projectId) {
        await werkProjectBij(uid, projectId, gegevens);
      } else {
        setProjectId(await maakProject(uid, gegevens));
      }
      setStap(1);
    } catch {
      setFout("Opslaan is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  async function bewaarStap2() {
    if (!uid || !projectId) return;
    if (!verwacht) {
      setFout("Vul in ieder geval de verwachte opleverdatum in.");
      return;
    }
    setBezig(true);
    setFout(null);
    try {
      // Bij één datum vallen de drie samen; de rekenmotor gaat daar goed mee om
      // en toont dan één datum in plaats van een bereik.
      await werkProjectBij(uid, projectId, {
        opleverStatus,
        opleverVerwacht: verwacht,
        opleverVroegst: opleverStatus === "bandbreedte" ? (vroegst ?? verwacht) : verwacht,
        opleverLaatst: opleverStatus === "bandbreedte" ? (laatst ?? verwacht) : verwacht,
        opleverBron: bron.trim() || undefined,
        opleverBronDatum: bron.trim() ? new Date() : undefined,
      });
      setStap(2);
    } catch {
      setFout("Opslaan is niet gelukt. Controleer je verbinding en probeer het opnieuw.");
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
    } catch {
      setFout("De betrokkenen konden niet worden opgeslagen. Probeer het opnieuw.");
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
          <div className="flex flex-col gap-s2">
            <Veld
              label="Naam van je project"
              hint="Voor jezelf, bijvoorbeeld “Ons huis in Almere”."
              value={naam}
              onChange={(e) => {
                setNaam(e.target.value);
              }}
              autoFocus
            />
            <Veld
              label="Bouwnummer"
              hint="Optioneel. Zoals het in de stukken van de aannemer staat."
              value={bouwnummer}
              onChange={(e) => {
                setBouwnummer(e.target.value);
              }}
            />
            <Veld
              label="Projectnaam van de ontwikkelaar"
              value={projectnaam}
              onChange={(e) => {
                setProjectnaam(e.target.value);
              }}
            />
            <Veld
              label="Aannemer"
              value={aannemer}
              onChange={(e) => {
                setAannemer(e.target.value);
              }}
            />
            <Keuzeveld
              label="Garantiewaarborg"
              waarde={waarborg}
              opties={WAARBORGEN}
              onKies={setWaarborg}
            />
          </div>

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

          <div className="mt-s3 flex flex-col gap-s2">
            <Keuzeveld
              label="Hoe zeker is de datum?"
              waarde={opleverStatus}
              opties={OPLEVERSTATUSSEN}
              onKies={setOpleverStatus}
            />

            <Datumveld
              label={opleverStatus === "bandbreedte" ? "Verwachte datum" : "Opleverdatum"}
              waarde={verwacht}
              onKies={setVerwacht}
            />

            {opleverStatus === "bandbreedte" && (
              <>
                <Datumveld
                  label="Vroegst mogelijke datum"
                  hint="Leeg laten? Dan gebruikt de app de verwachte datum."
                  waarde={vroegst}
                  onKies={setVroegst}
                />
                <Datumveld label="Laatst mogelijke datum" waarde={laatst} onKies={setLaatst} />
              </>
            )}

            <Veld
              label="Waar komt deze datum vandaan?"
              hint="Bijvoorbeeld “mail aannemer 12-07”. Bij de derde verschuiving wil je dit terug kunnen zien."
              value={bron}
              onChange={(e) => {
                setBron(e.target.value);
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
