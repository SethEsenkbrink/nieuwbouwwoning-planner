#!/usr/bin/env node
/**
 * verify-bereikbaarheid.mjs — dode modules en dode navigatie-ingangen afvangen
 *
 * De audit van 15 augustus 2026 vond vijf modules die gebouwd én getest waren,
 * maar door geen enkele route werden geïmporteerd (bevinding A-06). De
 * testsuite was groen en wekte daarmee de indruk dat die functionaliteit
 * bestond, terwijl een gebruiker er nooit bij kon.
 *
 * Dit script sluit dat gat op twee manieren:
 *   1. elke module hieronder moet vanuit de app geïmporteerd worden;
 *   2. elk pad in de navigatie moet een geregistreerde Route hebben, en
 *      andersom moet elke Route bereikbaar zijn of expliciet zijn uitgezonderd.
 *
 * Draait als onderdeel van `npm run verify`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WORTEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(WORTEL, "src");

/** Modules die een aantoonbare importeur in de app moeten hebben. */
const MOETEN_BEREIKBAAR_ZIJN = [
  "lib/energie",
  "lib/p1",
  "lib/mjop",
  "lib/inbox/delta",
  "lib/woningpaspoort/overdracht",
  "lib/paniek",
  "lib/backup/roulerend",
  "rules/engine",
  "db/kluisopslag",
  "migrations",
];

/**
 * Routes die bewust niet in de hoofdnavigatie staan.
 *
 * Inloggen en registreren horen daar niet; /diagnostiek is een hulpmiddel voor
 * ontwikkelaars en niet iets waar een bewoner langs moet lopen.
 *
 * /voorwaarden en /privacy staan in de voettekst van PubliekeLayout en niet in
 * de hoofdnavigatie: dat is navigatie voor een ontgrendelde kluis, en deze
 * pagina's zijn juist zichtbaar zonder. /start is de startwizard, die je via de
 * registratie of het dashboard binnenkomt.
 */
const NIET_IN_NAVIGATIE = [
  "/",
  "/inloggen",
  "/registreren",
  "/wachtwoord-vergeten",
  "/voorwaarden",
  "/privacy",
  "/project/nieuw",
  "/start",
  "/diagnostiek",
  "*",
];

function alleBronbestanden(map = SRC) {
  const gevonden = [];
  for (const item of readdirSync(map, { withFileTypes: true })) {
    const pad = join(map, item.name);
    if (item.isDirectory()) {
      gevonden.push(...alleBronbestanden(pad));
    } else if (/\.tsx?$/.test(item.name) && !item.name.includes(".test.")) {
      gevonden.push(pad);
    }
  }
  return gevonden;
}

function run() {
  const bestanden = alleBronbestanden();
  const inhoud = new Map(bestanden.map((b) => [b, readFileSync(b, "utf8")]));
  const fouten = [];

  // 1. Zijn alle modules bereikbaar?
  for (const modulepad of MOETEN_BEREIKBAAR_ZIJN) {
    const alsPad = modulepad.replaceAll("/", "\\");
    const importeurs = bestanden.filter((bestand) => {
      if (bestand.includes(alsPad)) return false; // zichzelf niet meetellen
      return (inhoud.get(bestand) ?? "").includes(`@/${modulepad}`);
    });

    if (importeurs.length === 0) {
      fouten.push(
        `Module '${modulepad}' wordt door geen enkel bestand in src/ geïmporteerd.\n` +
          `  Gebouwd en getest, maar onbereikbaar voor een gebruiker — precies bevinding A-06.`,
      );
    }
  }

  // 2. Wijst elke navigatie-ingang naar een bestaande Route?
  const appTsx = readFileSync(join(SRC, "App.tsx"), "utf8");
  const navigatie = readFileSync(join(SRC, "data", "navigatie.ts"), "utf8");

  const navPaden = [...navigatie.matchAll(/pad:\s*"([^"]+)"/g)].map((m) => m[1]);
  for (const pad of new Set(navPaden)) {
    if (!appTsx.includes(`path="${pad}"`)) {
      fouten.push(`Navigatie wijst naar '${pad}', maar die Route bestaat niet in App.tsx.`);
    }
  }

  // 3. Is elke Route ergens bereikbaar?
  const routePaden = [...appTsx.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
  for (const pad of new Set(routePaden)) {
    if (NIET_IN_NAVIGATIE.includes(pad)) continue;
    if (!navPaden.includes(pad)) {
      fouten.push(
        `Route '${pad}' staat niet in de navigatie en niet op de uitzonderingslijst.\n` +
          `  Voeg hem toe aan src/data/navigatie.ts of aan NIET_IN_NAVIGATIE in dit script.`,
      );
    }
  }

  if (fouten.length > 0) {
    console.error(`\n✗ Bereikbaarheid gefaald:\n\n${fouten.map((f) => `  - ${f}`).join("\n\n")}\n`);
    process.exit(1);
  }

  console.log(
    `✓ Bereikbaarheid OK — ${String(MOETEN_BEREIKBAAR_ZIJN.length)} modules geïmporteerd, ` +
      `${String(new Set(navPaden).size)} navigatiepaden en ${String(new Set(routePaden).size)} routes sluiten op elkaar aan.`,
  );
}

run();
