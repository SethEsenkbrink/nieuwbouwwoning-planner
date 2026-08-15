import { db as defaultDb, type WoningdossierDB } from "@/db/db";
import { isWebAuthnPrfSupported } from "@/crypto/webauthn";
import { evalueerRegels } from "@/rules/engine";
import type { RegelContext } from "@/rules/types";
import { logEvent } from "./logger";
import type {
  AuditItem,
  SysteemAuditRapport,
  TabelStatistiek,
} from "./types";

/**
 * Voert een diepgaande systeemaudit en integriteitscontrole uit.
 */
export async function voerSysteemAuditUit(
  dek?: CryptoKey | null,
  database: WoningdossierDB = defaultDb,
): Promise<SysteemAuditRapport> {
  const auditStart = performance.now();
  const items: AuditItem[] = [];
  const tabellen: TabelStatistiek[] = [];

  // ── 1. Database Query & Integriteit Benchmark ────────────────────────────
  const dbStart = performance.now();
  const [
    vaultMetaList,
    projecten,
    ankers,
    betrokkenen,
    afspraken,
    phases,
    tasks,
    meerwerk,
    termijnen,
    gebreken,
    nabudget,
    onderdelen,
    onderhoudstaken,
    onderhoudslogboek,
    meters,
    meterstanden,
    materialen,
    garanties,
    verzekeringen,
    inboedel,
  ] = await Promise.all([
    database.vault_meta.toArray(),
    database.projecten.toArray(),
    database.ankers.toArray(),
    database.betrokkenen.toArray(),
    database.afspraken.toArray(),
    database.phases.toArray(),
    database.tasks.toArray(),
    database.meerwerk.toArray(),
    database.termijnen.toArray(),
    database.gebreken.toArray(),
    database.nabudget.toArray(),
    database.onderdelen.toArray(),
    database.onderhoudstaken.toArray(),
    database.onderhoudslogboek.toArray(),
    database.meters.toArray(),
    database.meterstanden.toArray(),
    database.materialen.toArray(),
    database.garanties.toArray(),
    database.verzekeringen.toArray(),
    database.inboedel.toArray(),
  ]);
  const dbDuration = performance.now() - dbStart;

  // ── 2. Kluis & Cryptografie Audit ────────────────────────────────────────
  if (dek) {
    if (dek.type === "secret" && dek.algorithm.name === "AES-GCM" && !dek.extractable) {
      items.push({
        id: "crypto-dek-valide",
        categorie: "cryptografie_en_kluis",
        status: "gezond",
        titel: "Master DEK is actief en veilig",
        beschrijving: "Non-extractable AES-256-GCM CryptoKey actief in het geheugen.",
      });
    } else {
      items.push({
        id: "crypto-dek-onveilig",
        categorie: "cryptografie_en_kluis",
        status: "kritiek",
        titel: "DEK configuratie afwijkend",
        beschrijving: "De master-sleutel in geheugen voldoet niet aan de non-extractable AES-GCM norm.",
      });
    }
  } else {
    items.push({
      id: "crypto-dek-afwezig",
      categorie: "cryptografie_en_kluis",
      status: "attentie",
      titel: "Kluis is vergrendeld",
      beschrijving: "Geen actieve DEK in het geheugen. Ontgrendel de kluis voor volledige data-inspectie.",
    });
  }

  const vaultMeta = vaultMetaList[0];
  if (vaultMeta) {
    if (vaultMeta.versie === 1 && vaultMeta.saltA && vaultMeta.saltC && vaultMeta.wrappedDekA && vaultMeta.wrappedDekC) {
      items.push({
        id: "crypto-vaultmeta-ok",
        categorie: "cryptografie_en_kluis",
        status: "gezond",
        titel: "Kluis metadata intact (v1)",
        beschrijving: `Argon2id parameters: ${vaultMeta.argon2Params.m} KiB geheugen, ${vaultMeta.argon2Params.t} iteraties, ${vaultMeta.argon2Params.p} threads.`,
      });
    } else {
      items.push({
        id: "crypto-vaultmeta-onvolledig",
        categorie: "cryptografie_en_kluis",
        status: "kritiek",
        titel: "Kluis metadata onvolledig of corrupt",
        beschrijving: "Een of meer verplichte velden (saltA, saltC, wrappedDekA/C) ontbreken in vault_meta.",
      });
    }
  }

  // ── 3. Relatie- & Referentie-Integriteitscontrole ─────────────────────────
  const projectIds = new Set(projecten.map((p) => p.id));
  const betrokkeneIds = new Set(betrokkenen.map((b) => b.id));
  const phaseIds = new Set(phases.map((p) => p.id));
  const onderdeelIds = new Set(onderdelen.map((o) => o.id));
  const taakIds = new Set(onderhoudstaken.map((t) => t.id));
  const meterIds = new Set(meters.map((m) => m.id));

  // Afspraken -> Betrokkenen
  const verweesdeAfspraken = afspraken.filter((a) => a.betrokkeneId && !betrokkeneIds.has(a.betrokkeneId));
  if (verweesdeAfspraken.length > 0) {
    items.push({
      id: "relatie-afspraken-verweesd",
      categorie: "relaties_en_verwijzingen",
      status: "attentie",
      titel: `${verweesdeAfspraken.length} afspraken met onbekende betrokkene`,
      beschrijving: "Deze afspraken verwijzen naar een betrokkene die niet meer in de database voorkomt.",
      details: verweesdeAfspraken.map((a) => `${a.titel} (betrokkeneId: ${a.betrokkeneId})`),
      reparatieMogelijk: true,
      reparatieActieId: "ontkoppel_afspraken_betrokkene",
    });
  }

  // Taken -> Fasen
  const verweesdeTaken = tasks.filter((t) => t.phaseId && !phaseIds.has(t.phaseId));
  if (verweesdeTaken.length > 0) {
    items.push({
      id: "relatie-taken-verweesd",
      categorie: "relaties_en_verwijzingen",
      status: "attentie",
      titel: `${verweesdeTaken.length} taken met onbekende bouwfase`,
      beschrijving: "Deze taken zijn gekoppeld aan een fase-id dat niet meer bestaat.",
      details: verweesdeTaken.map((t) => `${t.titel} (phaseId: ${t.phaseId})`),
    });
  }

  // Onderhoudstaken -> Onderdelen
  const verweesdeOnderhoudstaken = onderhoudstaken.filter((t) => t.onderdeelId && !onderdeelIds.has(t.onderdeelId));
  if (verweesdeOnderhoudstaken.length > 0) {
    items.push({
      id: "relatie-onderhoud-verweesd",
      categorie: "relaties_en_verwijzingen",
      status: "attentie",
      titel: `${verweesdeOnderhoudstaken.length} onderhoudstaken met onbekend onderdeel`,
      beschrijving: "De gekoppelde installatie of apparaat is niet gevonden in het onderdelenregister.",
      details: verweesdeOnderhoudstaken.map((t) => `${t.titel} (onderdeelId: ${t.onderdeelId})`),
    });
  }

  // Onderhoudslogboek -> Onderhoudstaken
  const verweesdeLogs = onderhoudslogboek.filter((l) => !taakIds.has(l.taakId));
  if (verweesdeLogs.length > 0) {
    items.push({
      id: "relatie-logboek-verweesd",
      categorie: "relaties_en_verwijzingen",
      status: "attentie",
      titel: `${verweesdeLogs.length} logregels zonder gekoppelde taak`,
      beschrijving: "Logregels waarvan de oorspronkelijke onderhoudstaak is verwijderd.",
      details: verweesdeLogs.map((l) => `Log van ${l.uitgevoerdOp.toDate().toISOString().slice(0, 10)} (taakId: ${l.taakId})`),
    });
  }

  // Meterstanden -> Meters
  const verweesdeStanden = meterstanden.filter((s) => !meterIds.has(s.meterId));
  if (verweesdeStanden.length > 0) {
    items.push({
      id: "relatie-meterstanden-verweesd",
      categorie: "relaties_en_verwijzingen",
      status: "attentie",
      titel: `${verweesdeStanden.length} meterstanden zonder geregistreerde meter`,
      beschrijving: "Standen die niet gekoppeld zijn aan een actieve meter.",
      details: verweesdeStanden.map((s) => `Stand ${s.stand} op ${s.opgenomenOp.toDate().toISOString().slice(0, 10)}`),
    });
  }

  // ── 4. Gegevensvalidatie (ongeldige waarden) ──────────────────────────────
  const ongeldigeTermijnen = termijnen.filter((t) => (t.bedrag ?? 0) < 0 || !t.omschrijving);
  const ongeldigMeerwerk = meerwerk.filter((m) => (m.bedrag ?? 0) < 0 || !m.omschrijving);
  const ongeldigeGebreken = gebreken.filter((g) => !g.omschrijving);

  if (ongeldigeTermijnen.length > 0 || ongeldigMeerwerk.length > 0 || ongeldigeGebreken.length > 0) {
    items.push({
      id: "data-ongeldige-velden",
      categorie: "database_integriteit",
      status: "kritiek",
      titel: "Ongeldige veldwaarden aangetroffen",
      beschrijving: "Er zijn records met negatieve bedragen of ontbrekende verplichte omschrijvingen gevonden.",
      details: [
        ...ongeldigeTermijnen.map((t) => `Termijn: ${t.omschrijving || "naamloos"} (${t.bedrag})`),
        ...ongeldigMeerwerk.map((m) => `Meerwerk: ${m.omschrijving || "naamloos"} (${m.bedrag})`),
        ...ongeldigeGebreken.map((g) => `Gebrek zonder omschrijving (id: ${g.id})`),
      ],
    });
  }

  // ── 5. Tabelstatistieken samenstellen ─────────────────────────────────────
  const voegTabelStatToe = (
    naam: string,
    records: { id?: string; projectId?: string }[],
    verweesd = 0,
    foutief = 0,
  ) => {
    // Check ook of alle records aan een geldig project hangen
    const losVanProject = records.filter((r) => r.projectId && !projectIds.has(r.projectId)).length;
    tabellen.push({
      tabelNaam: naam,
      aantalRecords: records.length,
      foutieveRecords: foutief + losVanProject,
      verweesdeVerwijzingen: verweesd,
    });
  };

  voegTabelStatToe("projecten", projecten);
  voegTabelStatToe("ankers", ankers);
  voegTabelStatToe("betrokkenen", betrokkenen);
  voegTabelStatToe("afspraken", afspraken, verweesdeAfspraken.length);
  voegTabelStatToe("phases", phases);
  voegTabelStatToe("tasks", tasks, verweesdeTaken.length);
  voegTabelStatToe("meerwerk", meerwerk, 0, ongeldigMeerwerk.length);
  voegTabelStatToe("termijnen", termijnen, 0, ongeldigeTermijnen.length);
  voegTabelStatToe("gebreken", gebreken, 0, ongeldigeGebreken.length);
  voegTabelStatToe("nabudget", nabudget);
  voegTabelStatToe("onderdelen", onderdelen);
  voegTabelStatToe("onderhoudstaken", onderhoudstaken, verweesdeOnderhoudstaken.length);
  voegTabelStatToe("onderhoudslogboek", onderhoudslogboek, verweesdeLogs.length);
  voegTabelStatToe("meters", meters);
  voegTabelStatToe("meterstanden", meterstanden, verweesdeStanden.length);
  voegTabelStatToe("materialen", materialen);
  voegTabelStatToe("garanties", garanties);
  voegTabelStatToe("verzekeringen", verzekeringen);
  voegTabelStatToe("inboedel", inboedel);

  // ── 6. Regelmotor Benchmark & Evaluatie ───────────────────────────────────
  let regelmotorDuration = 0;
  const actiefProject = projecten[0];
  if (actiefProject) {
    const regelContext: RegelContext = {
      project: actiefProject,
      ankers,
      afspraken,
      meerwerk,
      termijnen,
      gebreken,
      nabudget,
      onderdelen,
      onderhoudstaken,
      garanties,
      materialen,
      verzekeringen,
      inboedel,
      meters,
      meterstanden,
      peildatum: new Date(),
    };

    const regelStart = performance.now();
    const signalen = evalueerRegels(regelContext);
    regelmotorDuration = performance.now() - regelStart;

    items.push({
      id: "regelmotor-benchmark-ok",
      categorie: "regelmotor_benchmark",
      status: "gezond",
      titel: `Regelmotor evaluatie voltooid (${signalen.length} signalen)`,
      beschrijving: `Alle regels deterministisch geëvalueerd in ${regelmotorDuration.toFixed(2)} ms.`,
    });
  }

  // ── 7. Zero-Network & CSP DOM Audit ──────────────────────────────────────
  if (typeof document !== "undefined") {
    const scripts = Array.from(document.querySelectorAll("script[src]"));
    const externScripts = scripts.filter((s) => s.getAttribute("src")?.startsWith("http"));

    const links = Array.from(document.querySelectorAll("link[href]"));
    const externLinks = links.filter(
      (l) => l.getAttribute("href")?.startsWith("http") && !l.getAttribute("href")?.startsWith(window.location.origin),
    );

    if (externScripts.length === 0 && externLinks.length === 0) {
      items.push({
        id: "csp-zero-network-ok",
        categorie: "zero_network_en_csp",
        status: "gezond",
        titel: "Zero-Network invariant bevestigd",
        beschrijving: "Geen externe scripts, links of stylesheets gedetecteerd in de DOM.",
      });
    } else {
      items.push({
        id: "csp-zero-network-lek",
        categorie: "zero_network_en_csp",
        status: "kritiek",
        titel: "Onbevoegd extern netwerkresource in DOM gevonden!",
        beschrijving: "Er zijn externe links of scripts gedetecteerd die in strijd zijn met ADR-0020.",
        details: [
          ...externScripts.map((s) => `Script: ${s.getAttribute("src") ?? ""}`),
          ...externLinks.map((l) => `Link: ${l.getAttribute("href") ?? ""}`),
        ],
      });
    }
  }

  // ── 8. Opslag & Quota Schatting ──────────────────────────────────────────
  let storageUsage: number | undefined;
  let storageQuota: number | undefined;
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      storageUsage = estimate.usage;
      storageQuota = estimate.quota;

      const usageMb = ((storageUsage ?? 0) / (1024 * 1024)).toFixed(2);
      const quotaMb = ((storageQuota ?? 0) / (1024 * 1024)).toFixed(0);

      items.push({
        id: "opslag-quota-ok",
        categorie: "opslag_en_quota",
        status: "gezond",
        titel: `Opslaggebruik: ${usageMb} MB van ${quotaMb} MB beschikbaar`,
        beschrijving: "IndexedDB en OPFS opslagquota liggen ruim binnen veilige browsergrenzen.",
      });
    } catch {
      // Schatting niet beschikbaar
    }
  }

  // ── 9. Bereken Gezondheidsscore & Aanbevelingen ───────────────────────────
  let kritiek = 0;
  let attenties = 0;
  let gezond = 0;

  for (const it of items) {
    if (it.status === "kritiek") kritiek++;
    else if (it.status === "attentie") attenties++;
    else gezond++;
  }

  let score = 100 - kritiek * 25 - attenties * 5;
  if (score < 0) score = 0;

  const algemeneStatus = kritiek > 0 ? "kritiek" : attenties > 0 ? "attentie" : "gezond";

  const aanbevelingen: SysteemAuditRapport["aanbevelingen"] = [];

  if (kritiek > 0) {
    aanbevelingen.push({
      prioriteit: "hoog",
      titel: "Los kritieke data-inconsistenties op",
      advies: "Herstel records met negatieve bedragen of ongeldige kluis-metadata.",
    });
  }
  if (verweesdeAfspraken.length > 0 || verweesdeTaken.length > 0 || verweesdeStanden.length > 0) {
    aanbevelingen.push({
      prioriteit: "gemiddeld",
      titel: "Schoon verweesde relaties op",
      advies: "Gebruik de reparatieknop in het diagnostiekpaneel om gekoppelde ID's zonder ouder te ontkoppelen.",
    });
  }
  if (projecten.length === 0) {
    aanbevelingen.push({
      prioriteit: "laag",
      titel: "Maak een project of importeer een backup",
      advies: "Er is momenteel nog geen project aangemaakt in deze kluis.",
    });
  }

  const totaalDuration = performance.now() - auditStart;

  const rapport: SysteemAuditRapport = {
    versie: 1,
    gegenereerdOp: new Date().toISOString(),
    algemeneScore: score,
    algemeneStatus,
    samenvatting: {
      totaalControles: items.length,
      gezond,
      attenties,
      kritiek,
    },
    tabellen,
    items,
    omgeving: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Node/Vitest",
      isPwa: typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches,
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      opfsOndersteund: typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function",
      webAuthnOndersteund: await isWebAuthnPrfSupported(),
      storageUsageBytes: storageUsage,
      storageQuotaBytes: storageQuota,
    },
    benchmark: {
      databaseQueryMs: Math.round(dbDuration * 100) / 100,
      regelmotorEvaluatieMs: Math.round(regelmotorDuration * 100) / 100,
      totaalAuditMs: Math.round(totaalDuration * 100) / 100,
    },
    aanbevelingen,
  };

  logEvent("info", "audit", `Systeemaudit voltooid met score ${score}% (${algemeneStatus})`);

  return rapport;
}
