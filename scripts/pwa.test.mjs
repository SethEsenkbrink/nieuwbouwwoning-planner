import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { controleerPwa } from "./verify-pwa.mjs";

/**
 * Bewijst dat de gate de fout vángt die er maanden in zat: een manifest dat
 * naar `pwa-192x192.png` wijst terwijl het bestand `icon-192.png` heet.
 */

const mappen = [];

function bouwDist({ manifest, bestanden = [], html }) {
  const root = mkdtempSync(join(tmpdir(), "wd-pwa-"));
  mappen.push(root);
  const dist = join(root, "dist");
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, "manifest.webmanifest"), JSON.stringify(manifest));
  for (const naam of bestanden) writeFileSync(join(dist, naam), "x");
  if (html !== undefined) writeFileSync(join(dist, "index.html"), html);
  return { dist, root };
}

const GOED_MANIFEST = {
  name: "Woningdossier",
  short_name: "Woningdossier",
  start_url: "/",
  scope: "/",
  display: "standalone",
  lang: "nl",
  theme_color: "#f5f1e8",
  background_color: "#f5f1e8",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png" },
  ],
};

const ICONEN = ["icon-192.png", "icon-512.png"];

afterEach(() => {
  for (const m of mappen.splice(0)) rmSync(m, { recursive: true, force: true });
});

describe("controleerPwa", () => {
  it("keurt een compleet manifest met bestaande iconen goed", () => {
    const { dist, root } = bouwDist({ manifest: GOED_MANIFEST, bestanden: ICONEN });
    expect(controleerPwa(dist, root).problemen).toEqual([]);
  });

  it("vangt iconen die niet bestaan — de fout uit de productie-console", () => {
    const { dist, root } = bouwDist({
      manifest: {
        ...GOED_MANIFEST,
        icons: [{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      bestanden: ICONEN,
    });
    const tekst = controleerPwa(dist, root).problemen.join("\n");
    expect(tekst).toContain("pwa-192x192.png");
    expect(tekst).toContain("niet in dist/");
  });

  it("vangt een manifest zonder iconen", () => {
    const { dist, root } = bouwDist({ manifest: { ...GOED_MANIFEST, icons: [] } });
    expect(controleerPwa(dist, root).problemen.join("\n")).toContain("geen enkel icoon");
  });

  it("weigert een extern icoon — de app is 100% lokaal", () => {
    const { dist, root } = bouwDist({
      manifest: {
        ...GOED_MANIFEST,
        icons: [{ src: "https://cdn.example.com/icon.png", sizes: "192x192" }],
      },
      bestanden: ICONEN,
    });
    expect(controleerPwa(dist, root).problemen.join("\n")).toContain("externe URL");
  });

  it("vangt lang die niet nl is", () => {
    const { dist, root } = bouwDist({
      manifest: { ...GOED_MANIFEST, lang: "en" },
      bestanden: ICONEN,
    });
    expect(controleerPwa(dist, root).problemen.join("\n")).toContain('lang is "en"');
  });

  it("vangt een verplicht veld dat ontbreekt", () => {
    const zonderNaam = { ...GOED_MANIFEST };
    delete zonderNaam.short_name;
    const { dist, root } = bouwDist({ manifest: zonderNaam, bestanden: ICONEN });
    expect(controleerPwa(dist, root).problemen.join("\n")).toContain("short_name");
  });

  it("vangt een theme-color die uit elkaar loopt met index.html", () => {
    const { dist, root } = bouwDist({
      manifest: GOED_MANIFEST,
      bestanden: ICONEN,
      html: '<meta name="theme-color" content="#1e293b" />',
    });
    expect(controleerPwa(dist, root).problemen.join("\n")).toContain("theme-color loopt uit elkaar");
  });

  it("vangt een verwijzing in index.html naar een bestand dat niet bestaat", () => {
    const { dist, root } = bouwDist({
      manifest: GOED_MANIFEST,
      bestanden: ICONEN,
      html: '<link rel="icon" href="/favicon.svg" />',
    });
    expect(controleerPwa(dist, root).problemen.join("\n")).toContain("/favicon.svg");
  });

  it("meldt een ontbrekende dist in plaats van te crashen", () => {
    const root = mkdtempSync(join(tmpdir(), "wd-pwa-leeg-"));
    mappen.push(root);
    expect(controleerPwa(join(root, "dist"), root).problemen.join("\n")).toContain("npm run build");
  });
});
