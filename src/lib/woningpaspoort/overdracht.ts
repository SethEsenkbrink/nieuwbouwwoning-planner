import type {
  GarantieDoc,
  MateriaalDoc,
  OnderdeelDoc,
  OnderhoudLogregelDoc,
  OnderhoudTaakDoc,
  ProjectDoc,
} from "@/types/model";

export interface WoningoverdrachtDossier {
  exportDatum: string;
  project: {
    naam: string;
    traject?: string | undefined;
    woningpaspoort?: ProjectDoc["woningpaspoort"] | undefined;
  };
  achterblijvendeOnderdelen: {
    naam: string;
    categorie: string;
    merk?: string | undefined;
    type?: string | undefined;
    serienummer?: string | undefined;
    installatieDatum?: string | undefined;
    garantieMaanden?: number | undefined;
    specs?: Record<string, string> | undefined;
  }[];
  garanties: {
    titel: string;
    type: string;
    partij?: string | undefined;
    looptijdJaren: number;
    ingangsdatum: string;
  }[];
  materialen: {
    naam: string;
    categorie: string;
    ruimte?: string | undefined;
    kleurcode?: string | undefined;
    merk?: string | undefined;
    glansgraad?: string | undefined;
    typeOfAfwerking?: string | undefined;
  }[];
  onderhoudsHistorie: {
    taakTitel: string;
    uitgevoerdOp: string;
    doorWie?: string | undefined;
    notitie?: string | undefined;
  }[];
}

/**
 * Samengesteld overdrachtsdossier filtert uitsluitend de overdraagbare data
 * (geen privégegevens, hypotheekbedragen of bankgegevens van de verkoper).
 */
export function stelOverdrachtsdossierSamen(
  project: ProjectDoc,
  onderdelen: OnderdeelDoc[] = [],
  garanties: GarantieDoc[] = [],
  materialen: MateriaalDoc[] = [],
  taken: OnderhoudTaakDoc[] = [],
  logregels: OnderhoudLogregelDoc[] = [],
): WoningoverdrachtDossier {
  const taakMap = new Map(taken.map((t) => [t.id, t.titel]));

  return {
    exportDatum: new Date().toISOString(),
    project: {
      naam: project.naam,
      traject: project.traject,
      woningpaspoort: project.woningpaspoort,
    },
    achterblijvendeOnderdelen: onderdelen
      .filter((o) => o.blijftBijWoning)
      .map((o) => ({
        naam: o.naam,
        categorie: o.categorie,
        merk: o.merk,
        type: o.type,
        serienummer: o.serienummer,
        installatieDatum: o.installatieDatum ? o.installatieDatum.toDate().toISOString().slice(0, 10) : undefined,
        garantieMaanden: o.garantieMaanden,
        specs: o.specs,
      })),
    garanties: garanties.map((g) => ({
      titel: g.titel,
      type: g.type,
      partij: g.partij,
      looptijdJaren: g.looptijdJaren,
      ingangsdatum: g.ingangsdatum.toDate().toISOString().slice(0, 10),
    })),
    materialen: materialen.map((m) => ({
      naam: m.naam,
      categorie: m.categorie,
      ruimte: m.ruimte,
      kleurcode: m.kleurcode,
      merk: m.merk,
      glansgraad: m.glansgraad,
      typeOfAfwerking: m.typeOfAfwerking,
    })),
    onderhoudsHistorie: logregels.map((l) => ({
      taakTitel: taakMap.get(l.taakId) ?? "Onderhoudsbeurt",
      uitgevoerdOp: l.uitgevoerdOp.toDate().toISOString().slice(0, 10),
      doorWie: l.doorWie,
      notitie: l.notitie,
    })),
  };
}

/**
 * Genereert een zelfstandig, printvriendelijk HTML-document voor overdracht aan de koper.
 * 100% offline, geen externe scripts, stylesheets of fonts vereist.
 */
export function genereerWoningpaspoortHtml(dossier: WoningoverdrachtDossier): string {
  const p = dossier.project;
  const wp = p.woningpaspoort;

  const onderdelenRows = dossier.achterblijvendeOnderdelen
    .map(
      (o) => `<tr>
      <td><strong>${escapeHtml(o.naam)}</strong></td>
      <td>${escapeHtml(o.categorie)}</td>
      <td>${escapeHtml(o.merk ?? "-")} ${escapeHtml(o.type ?? "")}</td>
      <td><code>${escapeHtml(o.serienummer ?? "-")}</code></td>
      <td>${escapeHtml(o.installatieDatum ?? "-")}</td>
    </tr>`,
    )
    .join("\n");

  const garantieRows = dossier.garanties
    .map(
      (g) => `<tr>
      <td><strong>${escapeHtml(g.titel)}</strong></td>
      <td>${escapeHtml(g.type)}</td>
      <td>${escapeHtml(g.partij ?? "-")}</td>
      <td>${g.looptijdJaren} jaar (vanaf ${escapeHtml(g.ingangsdatum)})</td>
    </tr>`,
    )
    .join("\n");

  const materiaalRows = dossier.materialen
    .map(
      (m) => `<tr>
      <td><strong>${escapeHtml(m.naam)}</strong></td>
      <td>${escapeHtml(m.ruimte ?? "-")}</td>
      <td>${escapeHtml(m.categorie)}</td>
      <td><strong>${escapeHtml(m.kleurcode ?? "-")}</strong> (${escapeHtml(m.glansgraad ?? "-")})</td>
      <td>${escapeHtml(m.merk ?? "-")}</td>
    </tr>`,
    )
    .join("\n");

  const onderhoudRows = dossier.onderhoudsHistorie
    .map(
      (h) => `<tr>
      <td>${escapeHtml(h.uitgevoerdOp)}</td>
      <td><strong>${escapeHtml(h.taakTitel)}</strong></td>
      <td>${escapeHtml(h.doorWie ?? "-")}</td>
      <td>${escapeHtml(h.notitie ?? "-")}</td>
    </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Woningpaspoort — ${escapeHtml(p.naam)}</title>
  <style>
    :root {
      --color-ink: #1f2421;
      --color-clay: #f4f1ea;
      --color-primary: #194a47;
      --color-sand: #e6dfd3;
      --color-forest: #215c58;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--color-ink);
      background-color: #ffffff;
      line-height: 1.5;
      margin: 0;
      padding: 2rem;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    header {
      border-bottom: 2px solid var(--color-primary);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    h1 {
      color: var(--color-primary);
      margin: 0 0 0.5rem 0;
      font-size: 2rem;
    }
    .meta {
      color: #666;
      font-size: 0.9rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
      background: var(--color-clay);
      padding: 1.5rem;
      border-radius: 8px;
    }
    .grid-item label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #666;
    }
    .grid-item span {
      font-size: 1.1rem;
      font-weight: 600;
    }
    section {
      margin-bottom: 2.5rem;
    }
    h2 {
      font-size: 1.3rem;
      color: var(--color-primary);
      border-bottom: 1px solid var(--color-sand);
      padding-bottom: 0.4rem;
      margin-bottom: 1rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.5rem;
      font-size: 0.9rem;
    }
    th, td {
      text-align: left;
      padding: 0.6rem;
      border-bottom: 1px solid var(--color-sand);
    }
    th {
      background-color: var(--color-clay);
      font-weight: 600;
    }
    code {
      font-family: monospace;
      background: var(--color-clay);
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
    }
    footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-sand);
      font-size: 0.8rem;
      color: #888;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .container { max-width: 100%; }
      header { border-bottom-width: 1px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Woningpaspoort</h1>
      <div class="meta">${escapeHtml(p.naam)} · Opgesteld op ${escapeHtml(dossier.exportDatum.slice(0, 10))}</div>
    </header>

    <div class="grid">
      <div class="grid-item">
        <label>Bouwjaar</label>
        <span>${wp?.bouwjaar ?? "Onbekend"}</span>
      </div>
      <div class="grid-item">
        <label>Woonoppervlakte</label>
        <span>${(wp?.woonoppervlakte ?? wp?.woonoppervlakteM2) ? (wp?.woonoppervlakte ?? wp?.woonoppervlakteM2) + " m²" : "Onbekend"}</span>
      </div>
      <div class="grid-item">
        <label>Energielabel</label>
        <span>${escapeHtml(wp?.energielabel ?? "Onbekend")}</span>
      </div>
      <div class="grid-item">
        <label>Kadastrale aanduiding</label>
        <span>${escapeHtml(wp?.kadaster?.gemeente ?? "-")} ${escapeHtml(wp?.kadaster?.sectie ?? "")} ${escapeHtml(wp?.kadaster?.perceelnummer ?? "")}</span>
      </div>
    </div>

    <section>
      <h2>Achterblijvende Installaties & Onderdelen</h2>
      <table>
        <thead>
          <tr>
            <th>Onderdeel</th>
            <th>Categorie</th>
            <th>Merk / Type</th>
            <th>Serienummer</th>
            <th>Installatie</th>
          </tr>
        </thead>
        <tbody>
          ${onderdelenRows || "<tr><td colspan='5'>Geen achterblijvende onderdelen geregistreerd.</td></tr>"}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Garanties & Waarborgen</h2>
      <table>
        <thead>
          <tr>
            <th>Garantie</th>
            <th>Soort</th>
            <th>Garantieverstrekker</th>
            <th>Geldigheid</th>
          </tr>
        </thead>
        <tbody>
          ${garantieRows || "<tr><td colspan='4'>Geen actieve garanties geregistreerd.</td></tr>"}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Materialen & Kleurcodes</h2>
      <table>
        <thead>
          <tr>
            <th>Materiaal</th>
            <th>Ruimte</th>
            <th>Soort</th>
            <th>Kleurcode / Glans</th>
            <th>Merk</th>
          </tr>
        </thead>
        <tbody>
          ${materiaalRows || "<tr><td colspan='5'>Geen materialen geregistreerd.</td></tr>"}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Onderhoudshistorie</h2>
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Taak</th>
            <th>Uitgevoerd door</th>
            <th>Notitie</th>
          </tr>
        </thead>
        <tbody>
          ${onderhoudRows || "<tr><td colspan='4'>Geen onderhoudshistorie beschikbaar.</td></tr>"}
        </tbody>
      </table>
    </section>

    <footer>
      Gegenereerd door Woningdossier · 100% lokaal en privacy-first woningbeheer
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
