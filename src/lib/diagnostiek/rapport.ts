import type { SysteemAuditRapport } from "./types";

/**
 * Genereert een overzichtelijk, gestructureerd Markdown-ontwikkelrapport.
 */
export function genereerMarkdownRapport(rapport: SysteemAuditRapport): string {
  const regels: string[] = [];

  regels.push("# Systeemdiagnose & Ontwikkelrapport — Woningdossier");
  regels.push("");
  regels.push(`> **Gegenereerd op:** ${rapport.gegenereerdOp}`);
  regels.push(`> **Algemene Gezondheidsscore:** **${rapport.algemeneScore}%** (${rapport.algemeneStatus.toUpperCase()})`);
  regels.push("");
  regels.push("---");
  regels.push("");
  regels.push("## 1. Samenvatting van de Controles");
  regels.push("");
  regels.push("| Categorie | Waarde |");
  regels.push("| --- | --- |");
  regels.push(`| **Totaal controles** | ${rapport.samenvatting.totaalControles} |`);
  regels.push(`| **Gezond (OK)** | ${rapport.samenvatting.gezond} |`);
  regels.push(`| **Attentiepunten** | ${rapport.samenvatting.attenties} |`);
  regels.push(`| **Kritieke fouten** | ${rapport.samenvatting.kritiek} |`);
  regels.push(`| **Database Query Tijd** | ${rapport.benchmark.databaseQueryMs} ms |`);
  regels.push(`| **Regelmotor Benchmark** | ${rapport.benchmark.regelmotorEvaluatieMs} ms |`);
  regels.push(`| **Totale Audit Duur** | ${rapport.benchmark.totaalAuditMs} ms |`);
  regels.push("");

  regels.push("## 2. Aanbevelingen voor Ontwikkeling");
  regels.push("");
  if (rapport.aanbevelingen.length === 0) {
    regels.push("Geen actie vereist: het systeem draait optimaal en integer.");
  } else {
    for (const a of rapport.aanbevelingen) {
      const badge = a.prioriteit === "hoog" ? "[!CAUTION]" : a.prioriteit === "gemiddeld" ? "[!WARNING]" : "[!NOTE]";
      regels.push(`> ${badge}`);
      regels.push(`> **${a.titel}** (Prioriteit: ${a.prioriteit})`);
      regels.push(`> ${a.advies}`);
      regels.push("");
    }
  }

  regels.push("## 3. Database Tabelstatistieken & Integriteit");
  regels.push("");
  regels.push("| Tabel | Aantal Records | Foutieve Records | Verweesde Verwijzingen |");
  regels.push("| --- | --- | --- | --- |");
  for (const t of rapport.tabellen) {
    regels.push(`| \`${t.tabelNaam}\` | ${t.aantalRecords} | ${t.foutieveRecords} | ${t.verweesdeVerwijzingen} |`);
  }
  regels.push("");

  regels.push("## 4. Gedetailleerde Audit Bevindingen");
  regels.push("");
  for (const it of rapport.items) {
    const icoon = it.status === "gezond" ? "✓" : it.status === "attentie" ? "⚠️" : "❌";
    regels.push(`### ${icoon} ${it.titel} (\`${it.categorie}\`)`);
    regels.push(it.beschrijving);
    if (it.details) {
      regels.push("");
      regels.push("```json");
      regels.push(JSON.stringify(it.details, null, 2));
      regels.push("```");
    }
    regels.push("");
  }

  regels.push("## 5. Runtime & Omgeving");
  regels.push("");
  regels.push(`- **User Agent:** \`${rapport.omgeving.userAgent}\``);
  regels.push(`- **PWA Modus:** ${rapport.omgeving.isPwa ? "Ja (Standalone)" : "Nee (Browser tab)"}`);
  regels.push(`- **OPFS Ondersteund:** ${rapport.omgeving.opfsOndersteund ? "Ja" : "Nee"}`);
  regels.push(`- **WebAuthn PRF:** ${rapport.omgeving.webAuthnOndersteund ? "Ja" : "Nee"}`);
  if (rapport.omgeving.storageUsageBytes !== undefined) {
    const mb = (rapport.omgeving.storageUsageBytes / (1024 * 1024)).toFixed(2);
    regels.push(`- **Opslag in gebruik:** ${mb} MB`);
  }
  regels.push("");
  regels.push("---");
  regels.push("*Gegenereerd door Woningdossier Diagnostiek & Systeemaudit Tool · 100% Lokaal & Privacy-First*");

  return regels.join("\n");
}

/**
 * Genereert een JSON export van het audit rapport.
 */
export function genereerJsonRapport(rapport: SysteemAuditRapport): string {
  return JSON.stringify(rapport, null, 2);
}
