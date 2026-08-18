import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Veld } from "@/components/Veld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useVault as useAuth } from "@/context/useVault";
import { toonDatum } from "@/lib/datum";
import { haalActiefProject } from "@/lib/projecten";
import {
  bepaalStandaardSalderingspercentage,
  berekenIndicatiefEnergielabel,
  berekenSaldering,
  ENERGIELABEL_DISCLAIMER,
} from "@/lib/energie";
import { parseP1Csv, type P1ImportResultaat } from "@/lib/p1";
import type { ProjectMetId } from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Energie — indicatief label, saldering en P1-import
 *
 * Deze drie horen bij elkaar omdat ze allemaal op hetzelfde verbruik rusten.
 * `src/lib/energie.ts` en `src/lib/p1.ts` hadden tot deze route geen enkele
 * importeur: gebouwd, getest, en voor een gebruiker onbereikbaar (A-06).
 *
 * De wettelijke waarschuwing staat bovenaan en is niet weg te klikken. Een
 * indicatief label dat je kunt wegdrukken wekt precies de schijn die het niet
 * mag wekken — zie ADR-0025 en bevinding A-12.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Tarieven zijn instelbaar; hardcoded bedragen horen hier niet (B7.2). */
interface Tarieven {
  stroomPerKwh: string;
  terugleverVergoedingPerKwh: string;
  vasteTerugleverKostenPerKwh: string;
}

const STANDAARD_TARIEVEN: Tarieven = {
  stroomPerKwh: "0,35",
  terugleverVergoedingPerKwh: "0,08",
  vasteTerugleverKostenPerKwh: "0,05",
};

function leesGetal(tekst: string): number | null {
  const genormaliseerd = tekst.trim().replace(",", ".");
  if (!genormaliseerd) return null;
  const waarde = Number(genormaliseerd);
  return Number.isFinite(waarde) ? waarde : null;
}

function euro(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(bedrag);
}

export default function Energie() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const [stroomKwh, setStroomKwh] = useState("");
  const [gasM3, setGasM3] = useState("");
  const [woonoppervlakte, setWoonoppervlakte] = useState("");
  const [periodeDagen, setPeriodeDagen] = useState("365");

  const [teruglevering, setTeruglevering] = useState("");
  const [tarieven, setTarieven] = useState<Tarieven>(STANDAARD_TARIEVEN);
  const [salderingsjaar, setSalderingsjaar] = useState(String(new Date().getFullYear()));

  const [p1Resultaat, setP1Resultaat] = useState<P1ImportResultaat | null>(null);

  useEffect(() => {
    if (!uid) return;
    let actueel = true;

    void (async () => {
      try {
        const gevonden = await haalActiefProject(uid);
        if (!actueel) return;
        setProject(gevonden);

        const opp = (gevonden as unknown as { woonoppervlakteM2?: number } | null)
          ?.woonoppervlakteM2;
        if (typeof opp === "number" && opp > 0) setWoonoppervlakte(String(opp));
      } catch (err) {
        if (actueel) setFout(err instanceof Error ? err.message : String(err));
      } finally {
        if (actueel) setBezigMetLaden(false);
      }
    })();

    return () => {
      actueel = false;
    };
  }, [uid]);

  const label = useMemo(() => {
    const stroom = leesGetal(stroomKwh);
    const gas = leesGetal(gasM3);
    const opp = leesGetal(woonoppervlakte);
    const dagen = leesGetal(periodeDagen);
    if (stroom === null || gas === null || opp === null || opp <= 0) return null;
    return berekenIndicatiefEnergielabel(stroom, gas, opp, dagen ?? 365);
  }, [stroomKwh, gasM3, woonoppervlakte, periodeDagen]);

  const saldering = useMemo(() => {
    const levering = leesGetal(stroomKwh);
    const terug = leesGetal(teruglevering);
    if (levering === null || terug === null) return null;

    const jaar = leesGetal(salderingsjaar) ?? new Date().getFullYear();
    const stroomTariefPerKwh = leesGetal(tarieven.stroomPerKwh);
    const terugleverVergoedingPerKwh = leesGetal(tarieven.terugleverVergoedingPerKwh);
    const vasteTerugleverKostenPerKwh = leesGetal(tarieven.vasteTerugleverKostenPerKwh);

    return berekenSaldering(levering, terug, {
      jaar,
      ...(stroomTariefPerKwh !== null ? { stroomTariefPerKwh } : {}),
      ...(terugleverVergoedingPerKwh !== null ? { terugleverVergoedingPerKwh } : {}),
      ...(vasteTerugleverKostenPerKwh !== null ? { vasteTerugleverKostenPerKwh } : {}),
    });
  }, [stroomKwh, teruglevering, salderingsjaar, tarieven]);

  function leesP1Bestand(bestand: File | null) {
    setFout(null);
    setP1Resultaat(null);
    if (!bestand) return;

    void bestand
      .text()
      .then((inhoud) => {
        const resultaat = parseP1Csv(inhoud);
        setP1Resultaat(resultaat);

        // Vul het stroomverbruik als de import bruikbare standen opleverde:
        // eindstand min beginstand is het verbruik over de periode.
        const eerste = resultaat.rijen[0];
        const laatste = resultaat.rijen[resultaat.rijen.length - 1];
        const beginStand = eerste?.standen.stroom_enkel ??
          eerste?.standen.stroom_normaal ??
          eerste?.standen.stroom_dal;
        const eindStand = laatste?.standen.stroom_enkel ??
          laatste?.standen.stroom_normaal ??
          laatste?.standen.stroom_dal;
        if (typeof beginStand === "number" && typeof eindStand === "number") {
          setStroomKwh(String(Math.max(0, Math.round(eindStand - beginStand))));
        }
      })
      .catch((err: unknown) => {
        setFout(err instanceof Error ? err.message : String(err));
      });
  }

  if (bezigMetLaden) return <Laadscherm />;

  if (!project) {
    return (
      <AppShell>
        <div className="max-w-xl">
          <Melding soort="info">Je hebt nog geen project.</Melding>
        </div>
      </AppShell>
    );
  }

  const standaardPercentage = bepaalStandaardSalderingspercentage(
    leesGetal(salderingsjaar) ?? new Date().getFullYear(),
  );

  return (
    <AppShell>
      <h1 className="mt-s2 text-h2 text-ink">Energie</h1>

      {/* Permanent en niet weg te klikken. Zie ADR-0025 en bevinding A-12. */}
      <div className="mt-s3 max-w-2xl">
        <Melding soort="fout">{ENERGIELABEL_DISCLAIMER}</Melding>
      </div>

      {fout && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}

      <section className="brink-card mt-s4 max-w-2xl p-s3">
        <h2 className="text-h3 text-ink">Indicatie op basis van je verbruik</h2>
        <p className="mt-s2 text-body text-slate">
          Vul je jaarverbruik in. Deze berekening blijft op dit apparaat en wordt nergens
          opgeslagen.
        </p>

        <div className="mt-s3 grid gap-s2 sm:grid-cols-2">
          <Veld
            label="Stroom (kWh)"
            value={stroomKwh}
            onChange={(e) => {
              setStroomKwh(e.target.value);
            }}
          />
          <Veld
            label="Gas (m3)"
            value={gasM3}
            onChange={(e) => {
              setGasM3(e.target.value);
            }}
          />
          <Veld
            label="Woonoppervlakte (m2)"
            value={woonoppervlakte}
            onChange={(e) => {
              setWoonoppervlakte(e.target.value);
            }}
          />
          <Veld
            label="Periode (dagen)"
            value={periodeDagen}
            onChange={(e) => {
              setPeriodeDagen(e.target.value);
            }}
          />
        </div>

        {label ? (
          <div className="mt-s3 rounded-md bg-bone p-s3">
            <p className="text-h1 text-ink">{label.label}</p>
            <p className="mt-s1 text-body text-slate">
              {Math.round(label.fossielEnergieKwhPerM2)} kWh fossiel per m2 per jaar, omgerekend
              vanaf {label.periodeDagen} dagen.
            </p>
          </div>
        ) : (
          <p className="mt-s3 text-body text-slate">
            Vul stroom, gas en woonoppervlakte in om een indicatie te zien.
          </p>
        )}
      </section>

      <section className="brink-card mt-s4 max-w-2xl p-s3">
        <h2 className="text-h3 text-ink">Saldering</h2>
        <p className="mt-s2 text-body text-slate">
          Het salderingspercentage bouwt af vanaf 2027; voor {salderingsjaar} staat het standaard
          op {standaardPercentage}%. De tarieven hieronder zijn van jou — vul in wat je
          energiebedrijf rekent.
        </p>

        <div className="mt-s3 grid gap-s2 sm:grid-cols-2">
          <Veld
            label="Teruglevering (kWh)"
            value={teruglevering}
            onChange={(e) => {
              setTeruglevering(e.target.value);
            }}
          />
          <Veld
            label="Jaar"
            value={salderingsjaar}
            onChange={(e) => {
              setSalderingsjaar(e.target.value);
            }}
          />
          <Veld
            label="Stroomtarief (euro/kWh)"
            value={tarieven.stroomPerKwh}
            onChange={(e) => {
              setTarieven((t) => ({ ...t, stroomPerKwh: e.target.value }));
            }}
          />
          <Veld
            label="Terugleververgoeding (euro/kWh)"
            value={tarieven.terugleverVergoedingPerKwh}
            onChange={(e) => {
              setTarieven((t) => ({ ...t, terugleverVergoedingPerKwh: e.target.value }));
            }}
          />
          <Veld
            label="Terugleverkosten (euro/kWh)"
            value={tarieven.vasteTerugleverKostenPerKwh}
            onChange={(e) => {
              setTarieven((t) => ({ ...t, vasteTerugleverKostenPerKwh: e.target.value }));
            }}
          />
        </div>

        {saldering && (
          <dl className="mt-s3 flex flex-col gap-1">
            <div className="flex justify-between">
              <dt className="text-body text-slate">Gesaldeerd</dt>
              <dd className="text-body text-ink">{Math.round(saldering.gesaldeerdeKwh)} kWh</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-body text-slate">Besparing door saldering</dt>
              <dd className="text-body text-ink">{euro(saldering.besparingSaldering)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-body text-slate">Opbrengst teruglevering</dt>
              <dd className="text-body text-ink">{euro(saldering.opbrengstTeruglevering)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-body text-slate">Terugleverkosten</dt>
              <dd className="text-body text-ink">{euro(saldering.terugleverKosten)}</dd>
            </div>
            <div className="mt-s1 flex justify-between border-t border-mist pt-s1">
              <dt className="text-body text-ink">Netto kosten</dt>
              <dd className="text-body text-ink">{euro(saldering.nettoKosten)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="brink-card mt-s4 max-w-2xl p-s3">
        <h2 className="text-h3 text-ink">Meterstanden importeren (P1)</h2>
        <p className="mt-s2 text-body text-slate">
          Een CSV-export van je slimme meter. Het bestand wordt in de browser gelezen en gaat
          nergens heen.
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-s3 block text-body text-slate"
          onChange={(e) => {
            leesP1Bestand(e.target.files?.[0] ?? null);
          }}
        />

        {p1Resultaat && (
          <div className="mt-s3">
            <Melding soort={p1Resultaat.succesvolleRijen > 0 ? "gelukt" : "fout"}>
              {p1Resultaat.succesvolleRijen} van {p1Resultaat.totaalRijen} regels gelezen
              {p1Resultaat.eersteDatum && p1Resultaat.laatsteDatum
                ? `, van ${toonDatum(p1Resultaat.eersteDatum)} tot ${toonDatum(
                    p1Resultaat.laatsteDatum,
                  )}`
                : ""}
              .
            </Melding>
            {p1Resultaat.gevondenMeters.length > 0 && (
              <p className="mt-s2 text-body text-slate">
                Gevonden meters: {p1Resultaat.gevondenMeters.join(", ")}.
              </p>
            )}
            {p1Resultaat.foutmeldingen.length > 0 && (
              <ul className="mt-s2 list-disc pl-5 text-body text-slate">
                {p1Resultaat.foutmeldingen.slice(0, 5).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
