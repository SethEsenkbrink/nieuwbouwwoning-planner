#!/usr/bin/env node
/**
 * verify-pwa.mjs — controleert of de gebouwde PWA naar bestaande bestanden wijst
 *
 * AANLEIDING. Het manifest verwees maandenlang naar `pwa-192x192.png` en
 * `pwa-512x512.png` — twee bestanden die nooit in `public/` hebben gestaan; de
 * echte heten `icon-192.png` en `icon-512.png`. Vite bouwt daar gewoon
 * doorheen, de service worker precachet ze niet, en de browser meldt bij elke
 * start:
 *
 *     Error while trying to use the following icon from the Manifest:
 *     https://.../pwa-192x192.png (Download error or resource isn't a valid image)
 *
 * De app werkt dan wel, maar installeren levert een lege tegel op. `npm run
 * verify` stond ondertussen groen: geen enkele gate keek naar het manifest.
 *
 * Draait ná `npm run build`, want hij toetst `dist/` en niet de configuratie.
 * De configuratie kun je namelijk correct opschrijven en toch iets anders
 * krijgen — vite-plugin-pwa overschrijft een handgeschreven
 * `public/manifest.webmanifest` zonder waarschuwing.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

/** Verplichte velden in het manifest, met de reden dat ze verplicht zijn. */
const VERPLICHTE_VELDEN = {
  name: "zonder naam toont de installatiedialoog de URL",
  short_name: "de naam onder het icoon op het startscherm",
  start_url: "zonder start_url opent de geïnstalleerde app een willekeurige route",
  display: "bepaalt of de app een eigen venster krijgt",
  theme_color: "de kleur van de systeembalk in de geïnstalleerde app",
  background_color: "wat je ziet tijdens het opstarten, vóór de eerste render",
  icons: "zonder iconen is de app niet installeerbaar",
};

/**
 * @returns {{ problemen: string[], opmerkingen: string[], gecontroleerd: number }}
 */
export function controleerPwa(dist = DIST, root = ROOT) {
  const problemen = [];
  const opmerkingen = [];
  let gecontroleerd = 0;

  const manifestPad = join(dist, "manifest.webmanifest");
  if (!existsSync(manifestPad)) {
    problemen.push(
      "dist/manifest.webmanifest ontbreekt. Draai eerst `npm run build`.",
    );
    return { problemen, opmerkingen, gecontroleerd };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPad, "utf8"));
  } catch (fout) {
    problemen.push(`dist/manifest.webmanifest is geen geldige JSON: ${fout.message}`);
    return { problemen, opmerkingen, gecontroleerd };
  }

  for (const [veld, waarom] of Object.entries(VERPLICHTE_VELDEN)) {
    if (manifest[veld] === undefined || manifest[veld] === "") {
      problemen.push(`Manifest mist "${veld}" — ${waarom}.`);
    }
  }

  // ── Elk icoon moet een bestand zijn dat er ook echt is ──────────────────
  const iconen = Array.isArray(manifest.icons) ? manifest.icons : [];
  if (iconen.length === 0) {
    problemen.push("Manifest heeft geen enkel icoon.");
  }
  for (const icoon of iconen) {
    gecontroleerd++;
    const src = String(icoon.src ?? "");
    if (src === "") {
      problemen.push("Een icoon in het manifest heeft geen src.");
      continue;
    }
    if (/^https?:/i.test(src)) {
      problemen.push(
        `Icoon "${src}" is een externe URL. De app is 100% lokaal; alle assets zijn self-hosted.`,
      );
      continue;
    }
    const bestand = join(dist, src.replace(/^\//, ""));
    if (!existsSync(bestand)) {
      problemen.push(
        `Icoon "${src}" staat in het manifest maar niet in dist/.\n` +
          `      De browser meldt dit als "Download error or resource isn't a valid image".\n` +
          `      Controleer de namen in vite.config.ts tegen de bestanden in public/.`,
      );
    }
  }

  // ── Verplicht Nederlands ────────────────────────────────────────────────
  // De app is volledig Nederlandstalig; `lang` stond op de standaard "en",
  // waardoor schermlezers de app-naam in het Engels uitspraken.
  if (manifest.lang !== "nl") {
    problemen.push(`Manifest lang is "${String(manifest.lang)}" en moet "nl" zijn.`);
  }

  // ── De themakleur moet overeenkomen met index.html ──────────────────────
  // Twee bronnen voor dezelfde kleur lopen altijd uit elkaar. Stonden ze uit
  // elkaar, dan flitst de systeembalk van kleur zodra de app opstart.
  const indexPad = join(dist, "index.html");
  if (existsSync(indexPad)) {
    const html = readFileSync(indexPad, "utf8");
    const match = /<meta\s+name="theme-color"\s+content="([^"]+)"/i.exec(html);
    if (match?.[1]) {
      gecontroleerd++;
      const uitHtml = match[1].toLowerCase();
      const uitManifest = String(manifest.theme_color).toLowerCase();
      if (uitHtml !== uitManifest) {
        problemen.push(
          `theme-color loopt uit elkaar: index.html zegt "${match[1]}", ` +
            `het manifest zegt "${String(manifest.theme_color)}".`,
        );
      }
    }

    // Elke lokale verwijzing in index.html moet bestaan.
    for (const [, href] of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
      if (href.startsWith("//")) continue;
      gecontroleerd++;
      if (!existsSync(join(dist, href.replace(/^\//, "")))) {
        problemen.push(`index.html verwijst naar "${href}", dat niet in dist/ staat.`);
      }
    }
  }

  // ── Een handgeschreven manifest in public/ wint niet, en dat verrast ────
  const publiekManifest = join(root, "public", "manifest.webmanifest");
  if (existsSync(publiekManifest)) {
    opmerkingen.push(
      "public/manifest.webmanifest bestaat, maar vite-plugin-pwa overschrijft hem\n" +
        "    zonder melding. Wat je daar wijzigt komt nooit in dist/ terecht — pas het\n" +
        "    manifest aan in vite.config.ts en verwijder dit bestand.",
    );
  }

  return { problemen, opmerkingen, gecontroleerd };
}

export function draai() {
  const { problemen, opmerkingen, gecontroleerd } = controleerPwa();

  for (const o of opmerkingen) console.warn(`  ! ${o}`);

  if (problemen.length > 0) {
    console.error("\n✗ PWA-manifest ONGELDIG\n");
    for (const p of problemen) console.error(`  - ${p}`);
    console.error("");
    return 1;
  }

  console.log(`✓ PWA OK — manifest compleet, ${gecontroleerd} verwijzingen bestaan in dist/`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(draai());
}
