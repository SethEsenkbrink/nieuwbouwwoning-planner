#!/usr/bin/env node
/**
 * verify-offline.mjs — valideert dat de productiebundel 100% offline is
 *
 * Controleert:
 * 1. Geen externe CDNs, API endpoints, telemetry of remote dependencies in dist/
 * 2. Geen externe scripts/styles in index.html
 * 3. Geen uitgaande fetch/XHR calls naar externe origins
 *
 * Draait als onderdeel van `npm run verify`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_PAD = join(ROOT, "dist");

if (!existsSync(DIST_PAD)) {
  console.error("\n✗ dist/ map bestaat niet. Voer eerst 'npm run build' uit.\n");
  process.exit(1);
}

function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const EXTENSIES = [".js", ".css", ".html", ".json"];

// Het eigen canonieke origin.
//
// Sinds 21 augustus 2026 staan er absolute URL's van onszelf in index.html en
// sitemap.xml: og:url, og:image en de canonical. Dat zijn geen uitgaande
// verbindingen maar metadata voor zoekmachines — de browser haalt er tijdens
// gebruik niets van op. De gate gaat over EXTERNE endpoints, en het eigen
// adres is dat per definitie niet.
//
// Bewust hier hardgecodeerd en niet uit publieke-paginas.ts gelezen: dan zou
// een verkeerd origin daar automatisch ook hier toegestaan raken.
// `scripts/verify-seo.mjs` bewaakt dat de twee gelijk blijven lopen.
const EIGEN_ORIGIN = "https://nieuwbouwplanner.netlify.app";

// Toegestane statische documentatie-links of XML-namespaces van React/Tailwind/Workbox internals
const TOEGESTANE_PREFIXES = [
  EIGEN_ORIGIN,
  "http://www.w3.org/",
  "https://react.dev/errors/",
  "https://reactrouter.com/",
  "https://tailwindcss.com",
  "https://bit.ly/wb-precache",
  "https://tinyurl.com/y2uuvskb",
  "http://bit.ly/2kdckMn",
  "https://www.npmjs.com/package/",
  "http://localhost",
  "https://localhost",
];

// Expliciet verboden remote service en CDN domeinen
const VERBODEN_DOMEINEN = [
  "googleapis.com",
  "firebaseio.com",
  "firebaseapp.com",
  "unpkg.com",
  "jsdelivr.net",
  "cdnjs.cloudflare.com",
  "fonts.gstatic.com",
  "google-analytics.com",
  "doubleclick.net",
  "sentry.io",
  "clarity.ms",
  "hotjar.com",
];

const bestanden = getAllFiles(DIST_PAD).filter((f) =>
  EXTENSIES.some((ext) => f.endsWith(ext)),
);

const overtredingen = [];
const URL_REGEX = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g;

for (const bestand of bestanden) {
  const inhoud = readFileSync(bestand, "utf8");

  // Check 1: Externe URL's
  const matches = inhoud.match(URL_REGEX) || [];
  for (const match of matches) {
    const isToegestaan = TOEGESTANE_PREFIXES.some((prefix) => match.startsWith(prefix));
    if (isToegestaan) continue;

    overtredingen.push({
      bestand: bestand.replace(ROOT, ""),
      reden: `Niet-toegestane externe URL: ${match}`,
    });
  }

  // Check 2: Verboden CDNs en remote domains
  for (const domein of VERBODEN_DOMEINEN) {
    if (inhoud.includes(domein)) {
      overtredingen.push({
        bestand: bestand.replace(ROOT, ""),
        reden: `Verboden extern domein aangetroffen: ${domein}`,
      });
    }
  }
}

if (overtredingen.length > 0) {
  console.error("\n✗ Externe verbindingen/endpoints gevonden in productiebundle:\n");
  for (const o of overtredingen) {
    console.error(`  - In ${o.bestand}: ${o.reden}`);
  }
  console.error("\nWoningdossier moet 100% offline zijn en mag geen externe verbindingen bevatten.\n");
  process.exit(1);
}

console.log(`✓ Bundle offline OK — ${bestanden.length} bestanden gecontroleerd in dist/ (nul externe verbindingen)`);
