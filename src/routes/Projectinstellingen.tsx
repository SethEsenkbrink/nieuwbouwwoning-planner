import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { Projectgegevensformulier } from "@/components/Projectgegevensformulier";
import {
  LEGE_PROJECTGEGEVENS,
  type Projectgegevenswaarden,
} from "@/lib/projectgegevens";
import { Opleverbandformulier } from "@/components/Opleverbandformulier";
import { Impactmelding } from "@/components/Impactmelding";
import { useVault as useAuth } from "@/context/useVault";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum, vandaag } from "@/lib/datum";
import { leesBedragInvoer } from "@/lib/bedrag";
import {
  controleerOpleverband,
  naarOpslag,
  uitProject,
  type Opleverbandwaarden,
} from "@/lib/opleverband";
import { naarAfspraakInvoer, naarBetrokkeneInvoer, naarPlanningContext } from "@/lib/actielijst";
import { db } from "@/db/db";
import { exporteerDossier, downloadDossierBestand } from "@/lib/backup/export";
import { importeerDossier } from "@/lib/backup/import";

import { berekenImpact } from "@/lib/watals";
import {
  haalActiefProject,
  haalAfspraken,
  haalAnkers,
  haalBetrokkenen,
  verwijderProject,
  werkProjectBij,
} from "@/lib/projecten";
import type {
  AfspraakMetId,
  AnkerMetId,
  BetrokkeneMetId,
  ProjectMetId,
} from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Projectinstellingen — waar de opleverdatum verschuift
 *
 * Dit scherm bestaat vooral om één reden: **de opleverdatum aanpassen is de
 * handeling die het vaakst voorkomt.** Tot nu toe moest dat via de aanmaakwizard,
 * en dat is een omweg door een scherm dat bedoeld is om iets te beginnen, niet
 * om iets bij te stellen.
 *
 * De twee blokken staan bewust apart en slaan apart op. Projectgegevens
 * veranderen bijna nooit; de opleverdatum verandert steeds. Ze in één formulier
 * zetten betekent dat je bij elke verschuiving de hele rest opnieuw langs de
 * validatie haalt.
 *
 * Onder de opleverdatum staat wat de wijziging gaat kosten: hoeveel afspraken
 * eraan hangen. Dat is nog niet de volledige wat-als uit A6, maar wel het
 * belangrijkste deel ervan — je ziet vóór het opslaan dat dit geen losse datum
 * is.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default function Projectinstellingen() {
  const { gebruiker, meta, dek, opslagIsPersistent } = useAuth();
  const navigeer = useNavigate();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [afspraken, setAfspraken] = useState<AfspraakMetId[]>([]);
  const [ankers, setAnkers] = useState<AnkerMetId[]>([]);
  const [betrokkenen, setBetrokkenen] = useState<BetrokkeneMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);

  const [gegevens, setGegevens] = useState<Projectgegevenswaarden>(LEGE_PROJECTGEGEVENS);
  const [band, setBand] = useState<Opleverbandwaarden>(uitProject({}));
  const [bezigMetGegevens, setBezigMetGegevens] = useState(false);
  const [bezigMetBand, setBezigMetBand] = useState(false);

  // Backup & Herstel state
  const [bezigMetBackup, setBezigMetBackup] = useState(false);
  const [bezigMetImport, setBezigMetImport] = useState(false);
  const [toonImportDialoog, setToonImportDialoog] = useState(false);
  const [importWachtwoord, setImportWachtwoord] = useState("");
  const [gekozenBestand, setGekozenBestand] = useState<File | null>(null);

  // Verwijderen vraagt om de projectnaam intikken. Een knop met "weet je het
  // zeker?" klikt iemand op de automatische piloot weg; iets overtypen niet.
  const [toonGevarenzone, setToonGevarenzone] = useState(false);
  const [bevestiging, setBevestiging] = useState("");
  const [bezigMetVerwijderen, setBezigMetVerwijderen] = useState(false);

  const [herlaadTeller, setHerlaadTeller] = useState(0);
  const herlaad = useCallback(() => {
    setHerlaadTeller((n) => n + 1);
  }, []);

  async function maakBackup() {
    if (!dek || !meta) return;
    setBezigMetBackup(true);
    setFout(null);
    setGelukt(null);
    try {
      const zipBytes = await exporteerDossier(db, dek, meta);
      downloadDossierBestand(zipBytes, project?.naam ?? "woningdossier");
      setGelukt("Backupbestand (.woningdossier) succesvol gedownload.");
    } catch (err) {
      setFout(err instanceof Error ? err.message : String(err));
    } finally {
      setBezigMetBackup(false);
    }
  }

  async function voerImportUit() {
    if (!gekozenBestand || !importWachtwoord.trim()) {
      setFout("Kies een backupbestand en voer de bijbehorende wachtwoordzin of herstelcode in.");
      return;
    }
    setBezigMetImport(true);
    setFout(null);
    setGelukt(null);
    try {
      const buffer = await gekozenBestand.arrayBuffer();
      const zipBytes = new Uint8Array(buffer);
      const res = await importeerDossier(zipBytes, importWachtwoord, db);
      setGelukt(`Dossier '${res.projectNaam}' succesvol hersteld (${res.aantalRecords} records).`);
      setToonImportDialoog(false);
      setGekozenBestand(null);
      setImportWachtwoord("");
      herlaad();
    } catch (err) {
      setFout(err instanceof Error ? err.message : String(err));
    } finally {
      setBezigMetImport(false);
    }
  }

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

        const [geladenAfspraken, geladenAnkers, geladenBetrokkenen] = await Promise.all([
          haalAfspraken(uid, gevonden.id),
          haalAnkers(uid, gevonden.id),
          haalBetrokkenen(uid, gevonden.id),
        ]);
        if (!actueel) return;

        setProject(gevonden);
        setAfspraken(geladenAfspraken);
        setAnkers(geladenAnkers);
        setBetrokkenen(geladenBetrokkenen);
        setGegevens({
          naam: gevonden.naam,
          bouwnummer: gevonden.bouwnummer ?? "",
          projectnaam: gevonden.projectnaam ?? "",
          aannemer: gevonden.aannemer ?? "",
          waarborg: gevonden.garantiewaarborg ?? "woningborg",
          koopsom: gevonden.koopsom === undefined ? "" : String(gevonden.koopsom),
          meerwerkbudget:
            gevonden.meerwerkbudget === undefined ? "" : String(gevonden.meerwerkbudget),
          bouwdepot:
            gevonden.bouwdepotBedrag === undefined ? "" : String(gevonden.bouwdepotBedrag),
        });
        setBand(uitProject(gevonden));
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

  /**
   * Drie uitkomsten, net als op `/na-oplevering`: leeg is geen fout — beide
   * bedragen zijn optioneel — maar onleesbare invoer moet wél tegengehouden
   * worden. `leesBedragInvoer()` geeft voor allebei `undefined`.
   */
  function leesBedrag(tekst: string): number | undefined | "fout" {
    if (tekst.trim() === "") return undefined;
    return leesBedragInvoer(tekst) ?? "fout";
  }

  async function bewaarGegevens() {
    if (!uid || !project) return;

    if (gegevens.naam.trim() === "") {
      setFout("Geef je project een naam.");
      return;
    }

    const koopsom = leesBedrag(gegevens.koopsom);
    const meerwerkbudget = leesBedrag(gegevens.meerwerkbudget);
    const bouwdepotBedrag = leesBedrag(gegevens.bouwdepot);
    if (koopsom === "fout" || meerwerkbudget === "fout" || bouwdepotBedrag === "fout") {
      setFout("Een van de bedragen kan ik niet lezen. Bijvoorbeeld: 1250 of 1.250,50.");
      return;
    }

    setBezigMetGegevens(true);
    setFout(null);
    setGelukt(null);
    try {
      await werkProjectBij(uid, project.id, {
        naam: gegevens.naam.trim(),
        bouwnummer: gegevens.bouwnummer.trim() || undefined,
        projectnaam: gegevens.projectnaam.trim() || undefined,
        aannemer: gegevens.aannemer.trim() || undefined,
        garantiewaarborg: gegevens.waarborg,
        koopsom,
        meerwerkbudget,
        bouwdepotBedrag,
      });
      setGelukt("Projectgegevens opgeslagen.");
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetGegevens(false);
    }
  }

  async function bewaarBand() {
    if (!uid || !project) return;

    const melding = controleerOpleverband(band);
    if (melding) {
      setFout(melding);
      return;
    }

    setBezigMetBand(true);
    setFout(null);
    setGelukt(null);
    try {
      await werkProjectBij(uid, project.id, naarOpslag(band));
      setGelukt(
        afspraken.length === 0
          ? "Opleverdatum opgeslagen."
          : `Opleverdatum opgeslagen. Controleer op het dashboard wie er nog een oude datum heeft.`,
      );
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetBand(false);
    }
  }

  async function verwijder() {
    if (!uid || !project) return;

    setBezigMetVerwijderen(true);
    setFout(null);
    try {
      await verwijderProject(uid, project.id);
      void navigeer("/project/nieuw", { replace: true });
    } catch (f) {
      setFout(opslagFoutmelding(f, "Verwijderen"));
      setBezigMetVerwijderen(false);
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

  /**
   * Wat er gebeurt als je deze band opslaat. Alleen te berekenen zodra er een
   * verwachte datum staat — zonder die datum valt er niets te vergelijken.
   */
  const impact =
    band.verwacht === undefined
      ? null
      : berekenImpact(
          afspraken.map(naarAfspraakInvoer),
          betrokkenen.map(naarBetrokkeneInvoer),
          naarPlanningContext(project, ankers),
          naarPlanningContext({ ...project, ...naarOpslag(band) }, ankers),
          vandaag(),
        );

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Project</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Projectinstellingen</h1>

      {fout && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}
      {gelukt && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="gelukt">{gelukt}</Melding>
        </div>
      )}

      {/* ── Opslagpersistentie ──────────────────────────────────────────────
          De browser mag IndexedDB en OPFS opruimen zodra de schijf vol raakt,
          tenzij hij de opslag als persistent heeft gemarkeerd. Dat aanvragen
          zonder de uitkomst te tonen is zinloos: juist als het níét gelukt is
          moet de gebruiker weten dat zijn backup zijn enige vangnet is. */}
      {opslagIsPersistent === false && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="fout">
            De browser heeft je opslag <strong>niet</strong> als permanent gemarkeerd. Bij
            schijfruimtegebrek kan hij je dossier zonder waarschuwing opruimen. Maak een backup
            en bewaar die buiten deze computer.
          </Melding>
        </div>
      )}
      {opslagIsPersistent === null && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="info">
            Deze browser kan niet vertellen of je opslag permanent is. Vertrouw op je backup.
          </Melding>
        </div>
      )}

      {/* ── De opleverdatum staat bovenaan: dit is wat er steeds verandert ── */}
      <section className="brink-card mt-s4 max-w-xl p-s3">
        <h2 className="text-h3 text-ink">Opleverdatum</h2>
        <p className="mt-s2 text-body text-slate">
          De datum schuift bijna altijd. Daarom slaat de app niet alleen een datum op, maar ook
          hoe zeker die is — dat bepaalt wie je nu al kunt inplannen en wie beter nog even kan
          wachten.
        </p>

        {project.opleverVerwacht && (
          <p className="mt-s2 text-sm text-granite">
            Nu opgeslagen: {toonDatum(project.opleverVerwacht)}
            {project.opleverBronDatum && ` · vastgelegd op ${toonDatum(project.opleverBronDatum)}`}
          </p>
        )}

        <div className="mt-s3">
          <Opleverbandformulier
            waarden={band}
            onWijzig={(patch) => {
              setBand((b) => ({ ...b, ...patch }));
            }}
          />
        </div>

        {impact && impact.aantalGeraakt > 0 && (
          <div className="mt-s3">
            <Impactmelding impact={impact} />
          </div>
        )}

        <div className="mt-s3">
          <Knop bezig={bezigMetBand} onClick={() => void bewaarBand()}>
            Opleverdatum opslaan
          </Knop>
        </div>
      </section>

      {/* ── De vaste gegevens ───────────────────────────────────────────── */}
      <section className="brink-card mt-s3 max-w-xl p-s3">
        <h2 className="text-h3 text-ink">Projectgegevens</h2>
        <p className="mt-s2 text-body text-slate">
          Deze veranderen zelden. Ze staan hier zodat je ze kunt aanvullen zodra je ze weet.
        </p>

        <div className="mt-s3">
          <Projectgegevensformulier
            waarden={gegevens}
            onWijzig={(patch) => {
              setGegevens((g) => ({ ...g, ...patch }));
            }}
            toonBedragen
          />
        </div>

        <div className="mt-s3">
          <Knop bezig={bezigMetGegevens} onClick={() => void bewaarGegevens()}>
            Projectgegevens opslaan
          </Knop>
        </div>
      </section>

      {/* ── Kluis & Beveiliging ────────────────────────────────────────── */}
      <section className="brink-card mt-s6 max-w-xl p-s3">
        <h2 className="text-h3 text-ink">Kluis &amp; Beveiliging</h2>
        <p className="mt-s2 text-body text-slate">
          Je dossier is 100% lokaal versleuteld met een non-extractable 256-bit DEK onder AES-256-GCM.
        </p>

        <div className="mt-s3 space-y-s2">
          <div className="flex items-center justify-between rounded-xs bg-bone p-s2 text-sm">
            <span className="font-semibold text-charcoal">Sleutelafleiding</span>
            <span className="font-mono text-slate">Argon2id (64 MiB, 3 it, 4 lanes)</span>
          </div>

          <div className="flex items-center justify-between rounded-xs bg-bone p-s2 text-sm">
            <span className="font-semibold text-charcoal">Herstelcode hint</span>
            <span className="font-mono text-slate">•••••-•••••-•••••-•••••-•••••-{meta?.recoveryCodeHint ? meta.recoveryCodeHint.slice(-1) : "•"}</span>
          </div>

          <div className="flex items-center justify-between rounded-xs bg-bone p-s2 text-sm">
            <span className="font-semibold text-charcoal">Automatische vergrendeling</span>
            <span className="text-slate">15 min inactiviteit of tabblad sluiten</span>
          </div>
        </div>
      </section>

      {/* ── Backup & Herstel (.woningdossier) ─────────────────────────── */}
      <section className="brink-card mt-s6 max-w-xl p-s3">
        <h2 className="text-h3 text-ink">Backup &amp; Herstel</h2>
        <p className="mt-s2 text-body text-slate">
          Download een versleutelde momentopname van je complete dossier of herstel een eerder backupbestand.
        </p>

        <div className="mt-s3 flex flex-wrap gap-s2">
          <Knop
            variant="primair"
            bezig={bezigMetBackup}
            onClick={() => void maakBackup()}
          >
            Download backup (.woningdossier)
          </Knop>

          <Knop
            variant="secundair"
            onClick={() => {
              setToonImportDialoog((open) => !open);
              setFout(null);
            }}
          >
            {toonImportDialoog ? "Sluit hersteldialoog" : "Dossier herstellen..."}
          </Knop>
        </div>

        {toonImportDialoog && (
          <div className="mt-s3 rounded-card border border-bone bg-bone/50 p-s3 flex flex-col gap-s2">
            <h3 className="text-body font-semibold text-ink">Dossier importeren uit backup</h3>
            <p className="text-sm text-slate">
              Let op: het herstellen van een backup overschrijft de huidige gegevens in de browser.
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-eyebrow uppercase text-slate">Backupbestand (.woningdossier)</label>
              <input
                type="file"
                accept=".woningdossier"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setGekozenBestand(file);
                }}
                className="text-sm text-charcoal file:mr-2 file:rounded file:border-0 file:bg-clay file:px-3 file:py-1 file:text-sm file:font-semibold file:text-lifted hover:file:bg-clay/90"
              />
            </div>

            <Veld
              label="Wachtwoordzin of Herstelcode van de backup"
              type="password"
              value={importWachtwoord}
              onChange={(e) => setImportWachtwoord(e.target.value)}
              placeholder="Voer het wachtwoord van het backupbestand in"
            />

            <div className="mt-s1 flex gap-s2">
              <Knop
                variant="primair"
                bezig={bezigMetImport}
                disabled={!gekozenBestand || !importWachtwoord.trim()}
                onClick={() => void voerImportUit()}
              >
                Start herstel
              </Knop>
              <Knop
                variant="secundair"
                onClick={() => setToonImportDialoog(false)}
              >
                Annuleren
              </Knop>
            </div>
          </div>
        )}
      </section>

      {/* ── Opnieuw beginnen ────────────────────────────────────────────── */}
      <section className="brink-card mt-s6 max-w-xl border border-clay/30 p-s3">
        <h2 className="text-h3 text-ink">Opnieuw beginnen</h2>
        <p className="mt-s2 text-body text-slate">
          Dit verwijdert het project met alles wat eronder hangt: bouwmomenten, betrokkenen,
          afspraken en de rest. Daarna kun je opnieuw beginnen met de wizard.
        </p>

        {!toonGevarenzone ? (
          <div className="mt-s3">
            <Knop
              variant="secundair"
              onClick={() => {
                setToonGevarenzone(true);
                setBevestiging("");
                setFout(null);
              }}
            >
              Project verwijderen
            </Knop>
          </div>
        ) : (
          <div className="mt-s3 flex flex-col gap-s2">
            <Melding soort="fout">
              Dit kan niet teruggedraaid worden. Er zijn {afspraken.length}{" "}
              {afspraken.length === 1 ? "afspraak" : "afspraken"} en {betrokkenen.length}{" "}
              {betrokkenen.length === 1 ? "partij" : "partijen"} die hiermee verdwijnen.
            </Melding>

            <Veld
              label={`Typ “${project.naam}” om te bevestigen`}
              value={bevestiging}
              onChange={(e) => {
                setBevestiging(e.target.value);
              }}
            />

            <div className="flex flex-wrap gap-s2">
              <Knop
                bezig={bezigMetVerwijderen}
                disabled={bevestiging.trim() !== project.naam}
                onClick={() => void verwijder()}
              >
                Definitief verwijderen
              </Knop>
              <Knop
                variant="secundair"
                onClick={() => {
                  setToonGevarenzone(false);
                }}
              >
                Annuleren
              </Knop>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
