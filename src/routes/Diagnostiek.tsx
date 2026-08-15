import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { useVault } from "@/context/useVault";
import { db } from "@/db/db";
import { voerSysteemAuditUit } from "@/lib/diagnostiek/audit";
import { haalLogGebeurtenissen, wisLogGebeurtenissen } from "@/lib/diagnostiek/logger";
import { genereerJsonRapport, genereerMarkdownRapport } from "@/lib/diagnostiek/rapport";
import type { LogGebeurtenis, SysteemAuditRapport } from "@/lib/diagnostiek/types";

export default function Diagnostiek() {
  const { dek } = useVault();
  const [rapport, setRapport] = useState<SysteemAuditRapport | null>(null);
  const [laden, setLaden] = useState(true);
  const [actieveTab, setActieveTab] = useState<
    "overzicht" | "integriteit" | "beveiliging" | "benchmark" | "logboek"
  >("overzicht");
  const [gekopieerd, setGekopieerd] = useState(false);
  const [logs, setLogs] = useState<LogGebeurtenis[]>([]);
  const [logFilter, setLogFilter] = useState<string>("");
  const [actieMelding, setActieMelding] = useState<string | null>(null);

  async function voerAuditUit() {
    setLaden(true);
    setActieMelding(null);
    try {
      const res = await voerSysteemAuditUit(dek, db);
      setRapport(res);
      setLogs(haalLogGebeurtenissen());
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => {
    let geannuleerd = false;

    async function laad() {
      const res = await voerSysteemAuditUit(dek, db);
      if (!geannuleerd) {
        setRapport(res);
        setLogs(haalLogGebeurtenissen());
        setLaden(false);
      }
    }

    void laad();

    return () => {
      geannuleerd = true;
    };
  }, [dek]);

  async function kopieerMarkdown() {
    if (!rapport) return;
    const md = genereerMarkdownRapport(rapport);
    await navigator.clipboard.writeText(md);
    setGekopieerd(true);
    setTimeout(() => {
      setGekopieerd(false);
    }, 2500);
  }

  function downloadBestand(inhoud: string, bestandsnaam: string, mimeType: string) {
    const blob = new Blob([inhoud], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = bestandsnaam;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function repareerVerweesdeAfspraken() {
    const betrokkenen = await db.betrokkenen.toArray();
    const geldigeIds = new Set(betrokkenen.map((b) => b.id));
    const afspraken = await db.afspraken.toArray();
    let gerepareerd = 0;

    for (const a of afspraken) {
      if (a.betrokkeneId && !geldigeIds.has(a.betrokkeneId)) {
        await db.afspraken.update(a.id, { betrokkeneId: undefined });
        gerepareerd++;
      }
    }

    setActieMelding(`${gerepareerd} afspraken succesvol ontkoppeld van ontbrekende contactpersonen.`);
    await voerAuditUit();
  }

  const gefilterdeLogs = logs.filter((l) => {
    if (!logFilter) return true;
    const q = logFilter.toLowerCase();
    return (
      l.bericht.toLowerCase().includes(q) ||
      l.categorie.toLowerCase().includes(q) ||
      l.niveau.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-content space-y-s4 px-s2 py-s3">
        {/* Header met Score en Exporteer Knoppen */}
        <div className="flex flex-col gap-s3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-h1 text-ink">Systeemaudit &amp; Diagnostiek</h1>
            <p className="mt-1 text-sm text-slate">
              Diepgaande lokale inspectie van database-integriteit, cryptografie, regelmotor en zero-network status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Knop variant="secundair" onClick={() => void voerAuditUit()} disabled={laden}>
              {laden ? "Controleren..." : "Opnieuw controleren"}
            </Knop>
            <Knop variant="secundair" onClick={() => void kopieerMarkdown()} disabled={!rapport}>
              {gekopieerd ? "✓ Gekopieerd!" : "Kopieer rapport"}
            </Knop>
            <Knop
              variant="secundair"
              onClick={() => {
                if (rapport) {
                  const md = genereerMarkdownRapport(rapport);
                  downloadBestand(md, `woningdossier-audit-${new Date().toISOString().slice(0, 10)}.md`, "text/markdown");
                }
              }}
              disabled={!rapport}
            >
              Download .md
            </Knop>
            <Knop
              variant="primair"
              onClick={() => {
                if (rapport) {
                  const json = genereerJsonRapport(rapport);
                  downloadBestand(json, `woningdossier-diagnose-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
                }
              }}
              disabled={!rapport}
            >
              Export JSON
            </Knop>
          </div>
        </div>

        {actieMelding && (
          <div className="rounded-card border border-sand bg-clay/60 p-s2 text-sm font-medium text-ink">
            ✓ {actieMelding}
          </div>
        )}

        {/* Samenvattingskaarten */}
        {rapport && (
          <div className="grid grid-cols-2 gap-s2 sm:grid-cols-4 lg:grid-cols-5">
            <div className="rounded-card border border-bone bg-lifted p-s2 text-center shadow-e1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate">Gezondheid</div>
              <div
                className={`mt-1 font-serif text-h2 ${
                  rapport.algemeneScore >= 90
                    ? "text-emerald-700"
                    : rapport.algemeneScore >= 70
                      ? "text-amber-700"
                      : "text-rose-700"
                }`}
              >
                {rapport.algemeneScore}%
              </div>
              <div className="text-xs text-slate capitalize">{rapport.algemeneStatus}</div>
            </div>

            <div className="rounded-card border border-bone bg-lifted p-s2 text-center shadow-e1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate">Controles</div>
              <div className="mt-1 font-serif text-h2 text-ink">{rapport.samenvatting.totaalControles}</div>
              <div className="text-xs text-emerald-700">{rapport.samenvatting.gezond} OK</div>
            </div>

            <div className="rounded-card border border-bone bg-lifted p-s2 text-center shadow-e1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate">Attenties</div>
              <div className="mt-1 font-serif text-h2 text-amber-700">{rapport.samenvatting.attenties}</div>
              <div className="text-xs text-slate">Waarschuwingen</div>
            </div>

            <div className="rounded-card border border-bone bg-lifted p-s2 text-center shadow-e1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate">Kritiek</div>
              <div className="mt-1 font-serif text-h2 text-rose-700">{rapport.samenvatting.kritiek}</div>
              <div className="text-xs text-slate">Datafouten</div>
            </div>

            <div className="rounded-card border border-bone bg-lifted p-s2 text-center shadow-e1 col-span-2 sm:col-span-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate">Audit Tijd</div>
              <div className="mt-1 font-serif text-h2 text-ink">{rapport.benchmark.totaalAuditMs} ms</div>
              <div className="text-xs text-slate">DB: {rapport.benchmark.databaseQueryMs} ms</div>
            </div>
          </div>
        )}

        {/* Tabbladen Navigatie */}
        <div className="flex flex-wrap gap-1 border-b border-bone pb-2">
          {(
            [
              ["overzicht", "Overzicht & Advies"],
              ["integriteit", "Database Integriteit"],
              ["beveiliging", "Kluis & Beveiliging"],
              ["benchmark", "Regelmotor & Opslag"],
              ["logboek", `Logboek (${logs.length})`],
            ] as const
          ).map(([sleutel, label]) => (
            <button
              key={sleutel}
              type="button"
              onClick={() => setActieveTab(sleutel)}
              className={`rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
                actieveTab === sleutel
                  ? "bg-clay text-canvas"
                  : "text-slate hover:bg-bone hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overzicht & Aanbevelingen */}
        {actieveTab === "overzicht" && rapport && (
          <div className="space-y-s3">
            <div className="rounded-card border border-bone bg-lifted p-s3 shadow-e1">
              <h2 className="font-serif text-h2 text-ink">Aanbevelingen voor Ontwikkeling &amp; Onderhoud</h2>
              <div className="mt-s2 space-y-s2">
                {rapport.aanbevelingen.length === 0 ? (
                  <p className="text-sm text-slate">Geen acties vereist. Alle datastructuren en beveiligingsmechanismen zijn in optimale staat.</p>
                ) : (
                  rapport.aanbevelingen.map((a, i) => (
                    <div
                      key={i}
                      className={`rounded-card border p-s2 ${
                        a.prioriteit === "hoog"
                          ? "border-rose-300 bg-rose-50/50 text-rose-950"
                          : a.prioriteit === "gemiddeld"
                            ? "border-amber-300 bg-amber-50/50 text-amber-950"
                            : "border-sand bg-clay/40 text-ink"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{a.titel}</span>
                        <span className="text-xs uppercase tracking-wider font-bold">Prioriteit: {a.prioriteit}</span>
                      </div>
                      <p className="mt-1 text-xs opacity-90">{a.advies}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-card border border-bone bg-lifted p-s3 shadow-e1">
              <h2 className="font-serif text-h2 text-ink">Omgevings- &amp; Platformdiagnostiek</h2>
              <div className="mt-s2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-s2 text-xs">
                <div className="p-2 rounded bg-bone/40">
                  <div className="text-slate">User Agent</div>
                  <div className="font-mono mt-0.5 truncate">{rapport.omgeving.userAgent}</div>
                </div>
                <div className="p-2 rounded bg-bone/40">
                  <div className="text-slate">PWA Standalone Modus</div>
                  <div className="font-semibold mt-0.5">{rapport.omgeving.isPwa ? "Actief (App venster)" : "Browser Tab"}</div>
                </div>
                <div className="p-2 rounded bg-bone/40">
                  <div className="text-slate">OPFS Bestandopslag</div>
                  <div className="font-semibold mt-0.5">{rapport.omgeving.opfsOndersteund ? "Ondersteund" : "In-memory Fallback"}</div>
                </div>
                <div className="p-2 rounded bg-bone/40">
                  <div className="text-slate">WebAuthn PRF Kluisslot</div>
                  <div className="font-semibold mt-0.5">{rapport.omgeving.webAuthnOndersteund ? "Beschikbaar" : "Niet beschikbaar"}</div>
                </div>
                <div className="p-2 rounded bg-bone/40">
                  <div className="text-slate">Netwerkstatus</div>
                  <div className="font-semibold mt-0.5">{rapport.omgeving.isOnline ? "Online (Zero-Network CSP actief)" : "Offline (PWA Precached)"}</div>
                </div>
                <div className="p-2 rounded bg-bone/40">
                  <div className="text-slate">Audit Tijdstip</div>
                  <div className="font-mono mt-0.5">{rapport.gegenereerdOp}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Database Integriteit & Relaties */}
        {actieveTab === "integriteit" && rapport && (
          <div className="space-y-s3">
            <div className="rounded-card border border-bone bg-lifted p-s3 shadow-e1">
              <h2 className="font-serif text-h2 text-ink">Tabeloverzicht &amp; Consistentie</h2>
              <div className="mt-s2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-bone text-xs uppercase text-slate">
                      <th className="py-2">Tabel</th>
                      <th className="py-2">Records</th>
                      <th className="py-2">Foutieve velden</th>
                      <th className="py-2">Verweesde relaties</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bone/50">
                    {rapport.tabellen.map((t) => {
                      const isProbleem = t.foutieveRecords > 0 || t.verweesdeVerwijzingen > 0;
                      return (
                        <tr key={t.tabelNaam}>
                          <td className="py-2 font-mono text-xs font-semibold">{t.tabelNaam}</td>
                          <td className="py-2">{t.aantalRecords}</td>
                          <td className="py-2">
                            {t.foutieveRecords > 0 ? (
                              <span className="text-rose-700 font-medium">{t.foutieveRecords}</span>
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="py-2">
                            {t.verweesdeVerwijzingen > 0 ? (
                              <span className="text-amber-700 font-medium">{t.verweesdeVerwijzingen}</span>
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="py-2">
                            {isProbleem ? (
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 font-medium">Attentie</span>
                            ) : (
                              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 font-medium">Gezond</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lijst van specifieke relatie-items */}
            <div className="space-y-s2">
              {rapport.items
                .filter((it) => it.categorie === "relaties_en_verwijzingen" || it.categorie === "database_integriteit")
                .map((it) => (
                  <div key={it.id} className="rounded-card border border-bone bg-lifted p-s2 shadow-e1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {it.status === "gezond" ? "✓" : it.status === "attentie" ? "⚠️" : "❌"}
                        </span>
                        <span className="font-semibold text-sm text-ink">{it.titel}</span>
                      </div>
                      {it.reparatieMogelijk && it.reparatieActieId === "ontkoppel_afspraken_betrokkene" && (
                        <Knop variant="secundair" onClick={() => void repareerVerweesdeAfspraken()}>
                          Repareer relaties
                        </Knop>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate">{it.beschrijving}</p>
                    {it.details && (
                      <pre className="mt-2 overflow-x-auto rounded bg-bone/30 p-2 font-mono text-xs">
                        {JSON.stringify(it.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Tab 3: Kluis & Beveiliging */}
        {actieveTab === "beveiliging" && rapport && (
          <div className="space-y-s2">
            {rapport.items
              .filter(
                (it) =>
                  it.categorie === "cryptografie_en_kluis" ||
                  it.categorie === "zero_network_en_csp" ||
                  it.categorie === "opfs_bestandsopslag",
              )
              .map((it) => (
                <div key={it.id} className="rounded-card border border-bone bg-lifted p-s3 shadow-e1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {it.status === "gezond" ? "✓" : it.status === "attentie" ? "⚠️" : "❌"}
                    </span>
                    <h3 className="font-semibold text-ink text-sm">{it.titel}</h3>
                    <span className="ml-auto text-xs font-mono bg-bone px-2 py-0.5 rounded text-slate">
                      {it.categorie}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate">{it.beschrijving}</p>
                  {it.details && (
                    <pre className="mt-2 overflow-x-auto rounded bg-bone/30 p-2 font-mono text-xs">
                      {JSON.stringify(it.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Tab 4: Regelmotor & Benchmark */}
        {actieveTab === "benchmark" && rapport && (
          <div className="space-y-s3">
            <div className="rounded-card border border-bone bg-lifted p-s3 shadow-e1">
              <h2 className="font-serif text-h2 text-ink">Prestaties &amp; Regelmotor Timing</h2>
              <div className="mt-s2 grid grid-cols-1 sm:grid-cols-3 gap-s2">
                <div className="p-3 rounded bg-clay/50 border border-sand">
                  <div className="text-xs text-slate">Database Query Latency</div>
                  <div className="font-serif text-h3 text-ink mt-1">{rapport.benchmark.databaseQueryMs} ms</div>
                  <div className="text-xs text-slate">Alle 18 Dexie tabellen</div>
                </div>
                <div className="p-3 rounded bg-clay/50 border border-sand">
                  <div className="text-xs text-slate">Regelmotor Evaluatie</div>
                  <div className="font-serif text-h3 text-ink mt-1">{rapport.benchmark.regelmotorEvaluatieMs} ms</div>
                  <div className="text-xs text-slate">Termijnen, Financiën, Energie, Onderhoud</div>
                </div>
                <div className="p-3 rounded bg-clay/50 border border-sand">
                  <div className="text-xs text-slate">Totale Audit Latency</div>
                  <div className="font-serif text-h3 text-ink mt-1">{rapport.benchmark.totaalAuditMs} ms</div>
                  <div className="text-xs text-slate">Inclusief DOM &amp; Quota inspectie</div>
                </div>
              </div>
            </div>

            {rapport.items
              .filter((it) => it.categorie === "regelmotor_benchmark" || it.categorie === "opslag_en_quota")
              .map((it) => (
                <div key={it.id} className="rounded-card border border-bone bg-lifted p-s2 shadow-e1">
                  <div className="flex items-center gap-2">
                    <span>{it.status === "gezond" ? "✓" : "⚠️"}</span>
                    <span className="font-semibold text-sm">{it.titel}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate">{it.beschrijving}</p>
                </div>
              ))}
          </div>
        )}

        {/* Tab 5: Live Logboek */}
        {actieveTab === "logboek" && (
          <div className="rounded-card border border-bone bg-lifted p-s3 shadow-e1 space-y-s2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h2 className="font-serif text-h2 text-ink">Diagnostisch Event Logboek</h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Zoek in logs..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="rounded border border-sand px-2 py-1 text-xs bg-canvas text-ink w-full sm:w-48"
                />
                <Knop
                  variant="secundair"
                  onClick={() => {
                    wisLogGebeurtenissen();
                    setLogs([]);
                  }}
                >
                  Wissen
                </Knop>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-1 font-mono text-xs">
              {gefilterdeLogs.length === 0 ? (
                <div className="text-slate py-4 text-center">Geen loggebeurtenissen geregistreerd.</div>
              ) : (
                gefilterdeLogs.map((l) => (
                  <div
                    key={l.id}
                    className={`p-2 rounded flex flex-col gap-0.5 border ${
                      l.niveau === "fout"
                        ? "bg-rose-50/60 border-rose-200 text-rose-950"
                        : l.niveau === "waarschuwing"
                          ? "bg-amber-50/60 border-amber-200 text-amber-950"
                          : "bg-bone/20 border-bone/60 text-ink"
                    }`}
                  >
                    <div className="flex items-center justify-between text-slate text-[10px]">
                      <span>{l.tijdstip.slice(11, 19)} · [{l.categorie.toUpperCase()}]</span>
                      <span className="uppercase font-bold">{l.niveau}</span>
                    </div>
                    <div className="font-medium text-xs">{l.bericht}</div>
                    {l.context && (
                      <pre className="text-[10px] opacity-80 overflow-x-auto">
                        {JSON.stringify(l.context)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
