import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Keuzeveld } from "@/components/Keuzeveld";
import { Tekstvlak } from "@/components/Tekstvlak";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useVault as useAuth } from "@/context/useVault";
import { haalActiefProject } from "@/lib/projecten";
import {
  exporteerInboxDelta,
  importeerInboxDelta,
  maakInboxDelta,
  verwerkInboxDeltaItem,
} from "@/lib/inbox/delta";
import type { InboxDeltaItem, InboxItemType } from "@/lib/inbox/types";
import type { ProjectMetId } from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Snel vastleggen — quick-capture voor onderweg
 *
 * De enige plek waar op mobiel wél bewerkt mag worden (ADR-0026, B8.2). Je legt
 * hier iets vast zonder het hele dossier te openen, exporteert dat als
 * versleuteld deltabestand, en de desktop leest het in.
 *
 * Bewust géén live sync: er is geen server en die komt er niet. Overdracht gaat
 * via een bestand dat je zelf verplaatst — zichtbaar, controleerbaar, en zonder
 * netwerkverbinding.
 *
 * `src/lib/inbox/delta.ts` had tot deze route geen enkele importeur (A-06).
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ITEMSOORTEN: { waarde: InboxItemType; label: string }[] = [
  { waarde: "gebrek", label: "Gebrek" },
  { waarde: "meterstand", label: "Meterstand" },
  { waarde: "materiaal", label: "Materiaal" },
  { waarde: "onderhoud_log", label: "Onderhoud uitgevoerd" },
  { waarde: "notitie", label: "Notitie" },
];

export default function SnelVastleggen() {
  const { gebruiker, dek } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);

  const [soort, setSoort] = useState<InboxItemType>("gebrek");
  const [titel, setTitel] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [items, setItems] = useState<InboxDeltaItem[]>([]);

  const [bezigMetVerwerken, setBezigMetVerwerken] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let actueel = true;

    void (async () => {
      try {
        const gevonden = await haalActiefProject(uid);
        if (actueel) setProject(gevonden);
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

  function voegToe() {
    if (!titel.trim()) {
      setFout("Geef kort aan wat je vastlegt.");
      return;
    }
    setFout(null);
    setItems((huidig) => [
      ...huidig,
      {
        id: crypto.randomUUID(),
        type: soort,
        titel: titel.trim(),
        aangemaaktOp: new Date().toISOString(),
        data: toelichting.trim() ? { toelichting: toelichting.trim() } : {},
      },
    ]);
    setTitel("");
    setToelichting("");
    setGelukt("Toegevoegd aan deze reeks.");
  }

  async function exporteer() {
    if (!project || !dek || items.length === 0) return;
    setFout(null);
    try {
      const payload = maakInboxDelta(project.id, items);
      const bytes = await exporteerInboxDelta(payload, dek);

      const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `inbox-delta-${new Date().toISOString().slice(0, 10)}.wdelta`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      setGelukt(`${items.length} ${items.length === 1 ? "item" : "items"} geëxporteerd.`);
      setItems([]);
    } catch (err) {
      setFout(err instanceof Error ? err.message : String(err));
    }
  }

  /** De desktopkant: een deltabestand inlezen en verwerken. */
  async function leesDeltaIn(bestand: File | null) {
    if (!bestand || !dek || !project) return;
    setFout(null);
    setGelukt(null);
    setBezigMetVerwerken(true);

    try {
      const bytes = new Uint8Array(await bestand.arrayBuffer());
      const payload = await importeerInboxDelta(bytes, dek);

      if (payload.manifest.projectId !== project.id) {
        throw new Error(
          "Dit deltabestand hoort bij een ander project. Verwerken zou gegevens door elkaar halen.",
        );
      }

      let verwerkt = 0;
      for (const item of payload.items) {
        await verwerkInboxDeltaItem(item, project.id);
        verwerkt++;
      }
      setGelukt(`${verwerkt} ${verwerkt === 1 ? "item" : "items"} verwerkt in het dossier.`);
    } catch (err) {
      setFout(err instanceof Error ? err.message : String(err));
    } finally {
      setBezigMetVerwerken(false);
    }
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

  return (
    <AppShell>
      <h1 className="mt-s2 text-h2 text-ink">Snel vastleggen</h1>
      <p className="mt-s2 max-w-2xl text-body text-slate">
        Leg vast wat je nu ziet. Je verzamelt hier een reeks en exporteert die als één
        versleuteld bestand; op de desktop lees je het weer in. Er is geen live verbinding —
        het bestand verplaats je zelf.
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

      <section className="brink-card mt-s4 max-w-2xl p-s3">
        <h2 className="text-h3 text-ink">Nieuw item</h2>

        <div className="mt-s3 flex flex-col gap-s2">
          <Keuzeveld
            label="Wat leg je vast?"
            waarde={soort}
            onKies={setSoort}
            opties={ITEMSOORTEN}
          />
          <Veld
            label="Korte omschrijving"
            value={titel}
            onChange={(e) => {
              setTitel(e.target.value);
            }}
          />
          <Tekstvlak
            label="Toelichting (optioneel)"
            value={toelichting}
            onChange={(e) => {
              setToelichting(e.target.value);
            }}
          />
          <div>
            <Knop onClick={voegToe}>Toevoegen aan reeks</Knop>
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <section className="brink-card mt-s4 max-w-2xl p-s3">
          <h2 className="text-h3 text-ink">
            Klaar om te exporteren ({items.length})
          </h2>
          <ul className="mt-s2 flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-body text-ink">{item.titel}</span>
                <span className="text-sm text-slate">{item.type}</span>
              </li>
            ))}
          </ul>
          <div className="mt-s3">
            <Knop onClick={() => void exporteer()}>Exporteren als versleuteld bestand</Knop>
          </div>
        </section>
      )}

      <section className="brink-card mt-s4 max-w-2xl p-s3">
        <h2 className="text-h3 text-ink">Deltabestand inlezen</h2>
        <p className="mt-s2 text-body text-slate">
          Op de desktop: kies het bestand dat je op je telefoon hebt gemaakt. Een gewone
          bestandskiezer, dus dit werkt ook op iOS.
        </p>
        <input
          type="file"
          accept=".wdelta,application/octet-stream"
          disabled={bezigMetVerwerken}
          className="mt-s3 block text-body text-slate"
          onChange={(e) => {
            void leesDeltaIn(e.target.files?.[0] ?? null);
          }}
        />
      </section>
    </AppShell>
  );
}
