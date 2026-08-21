#!/usr/bin/env node
/**
 * verify-seo.mjs — houdt robots.txt, sitemap.xml en de app op één lijn
 *
 * AANLEIDING. Tot 21 augustus 2026 stond er `Disallow: /` in robots.txt en
 * `noindex, nofollow` in index.html, met als toelichting "de app zit volledig
 * achter een login — er is niets te indexeren". Dat klopte. Diezelfde dag
 * kwamen er een landingspagina, algemene voorwaarden en een privacyverklaring
 * bij, en klopte het niet meer — zonder dat iets rood liep.
 *
 * Dat is het patroon dat deze gate afvangt: drie bestanden die hetzelfde
 * moeten beweren, waarvan er twee statisch zijn en dus nooit meeveranderen
 * met de code. `src/data/publieke-paginas.ts` is de bron; robots.txt en
 * sitemap.xml moeten daarop aansluiten.
 *
 * WAT ER MISGAAT ALS DIT NIET GECONTROLEERD WORDT
 *   - een sitemap met het verkeerde domein wijst maandenlang naar 404's
 *   - een nieuwe publieke pagina staat niet in de sitemap en wordt niet gevonden
 *   - een `Disallow` die te breed is haalt de landingspagina uit de index
 *   - `noindex` dat terugsluipt bij het kopiëren van een index.html
 *
 * Draait als onderdeel van `npm run verify`, ná de build.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Leest de bron: het origin en de publieke paden uit de TypeScript-module.
 *
 * Met een regex en niet met een import, omdat dit script `.mjs` is en de bron
 * TypeScript. Zelfde procedé als `verify-bereikbaarheid.mjs` met navigatie.ts.
 *
 * @returns {{ origin: string | null, paden: string[], prioriteiten: string[] }}
 */
export function leesBron(bron) {
  const originMatch = /CANONIEKE_ORIGIN\s*=\s*"([^"]+)"/.exec(bron);
  const paden = [...bron.matchAll(/^\s*pad:\s*"([^"]+)",/gm)].map((m) => m[1]);
  const prioriteiten = [...bron.matchAll(/^\s*prioriteit:\s*"([^"]+)",/gm)].map((m) => m[1]);

  return { origin: originMatch?.[1] ?? null, paden, prioriteiten };
}

function urlVoor(origin, pad) {
  return pad === "/" ? `${origin}/` : `${origin}${pad}`;
}

/**
 * @param {{ paginasBron: string, sitemap: string, robots: string, indexHtml: string | null }} bestanden
 * @returns {{ problemen: string[], aantalUrls: number }}
 */
export function controleerSeo(bestanden) {
  const problemen = [];
  const { origin, paden, prioriteiten } = leesBron(bestanden.paginasBron);

  if (origin === null) {
    problemen.push("CANONIEKE_ORIGIN staat niet in src/data/publieke-paginas.ts.");
    return { problemen, aantalUrls: 0 };
  }
  if (origin.endsWith("/")) {
    problemen.push(
      `CANONIEKE_ORIGIN eindigt op een slash ("${origin}").\n` +
        `      Dat levert dubbele slashes op in elke sitemap-URL.`,
    );
  }
  if (paden.length === 0) {
    problemen.push("PUBLIEKE_PAGINAS bevat geen enkel pad.");
    return { problemen, aantalUrls: 0 };
  }

  // ── 1. De sitemap moet exact deze URL's bevatten ─────────────────────────
  const locs = [...bestanden.sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const verwacht = paden.map((pad) => urlVoor(origin, pad));

  for (const url of verwacht) {
    if (!locs.includes(url)) {
      problemen.push(
        `sitemap.xml mist ${url}.\n` +
          `      Elke pagina in PUBLIEKE_PAGINAS hoort erin te staan, anders wordt hij niet gevonden.`,
      );
    }
  }
  for (const url of locs) {
    if (!verwacht.includes(url)) {
      problemen.push(
        `sitemap.xml noemt ${url}, maar die staat niet in PUBLIEKE_PAGINAS.\n` +
          `      Een URL die niet bestaat levert een 404 op in de Search Console.`,
      );
    }
  }

  for (const [index, prioriteit] of prioriteiten.entries()) {
    const pad = paden[index];
    if (pad === undefined) continue;
    const blok = new RegExp(
      `<loc>${urlVoor(origin, pad).replaceAll("/", "\\/")}<\\/loc>[\\s\\S]*?<priority>([^<]+)<\\/priority>`,
    ).exec(bestanden.sitemap);
    if (blok && blok[1] !== prioriteit) {
      problemen.push(
        `sitemap.xml geeft ${pad} prioriteit ${blok[1]}, PUBLIEKE_PAGINAS zegt ${prioriteit}.`,
      );
    }
  }

  // ── 2. robots.txt moet precies deze paden toestaan ───────────────────────
  const robotsRegels = bestanden.robots
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r !== "" && !r.startsWith("#"));

  const toegestaan = robotsRegels
    .filter((r) => /^Allow:/i.test(r))
    .map((r) => r.replace(/^Allow:\s*/i, ""));

  for (const pad of paden) {
    // De wortel heeft een anker nodig, anders zet "Allow: /" alles open.
    const verwachteRegel = pad === "/" ? "/$" : pad;
    if (!toegestaan.includes(verwachteRegel)) {
      problemen.push(
        `robots.txt staat "${verwachteRegel}" niet toe, terwijl die pagina publiek is.`,
      );
    }
  }
  for (const regel of toegestaan) {
    const alsPad = regel === "/$" ? "/" : regel;
    if (!paden.includes(alsPad)) {
      problemen.push(
        `robots.txt staat "${regel}" toe, maar dat pad is niet publiek.\n` +
          `      Alles buiten PUBLIEKE_PAGINAS hoort achter de kluis te blijven.`,
      );
    }
  }

  if (!robotsRegels.some((r) => /^Disallow:\s*\/$/i.test(r))) {
    problemen.push(
      "robots.txt mist een sluitende \"Disallow: /\".\n" +
        "      Zonder die regel is elke app-route crawlbaar, en die serveren allemaal\n" +
        "      dezelfde index.html achter een kluis.",
    );
  }

  const sitemapRegel = robotsRegels.find((r) => /^Sitemap:/i.test(r));
  const verwachteSitemap = `${origin}/sitemap.xml`;
  if (!sitemapRegel) {
    problemen.push("robots.txt verwijst niet naar de sitemap.");
  } else if (!sitemapRegel.includes(verwachteSitemap)) {
    problemen.push(
      `robots.txt verwijst naar een andere sitemap dan verwacht.\n` +
        `      Gevonden: ${sitemapRegel}\n      Verwacht:  Sitemap: ${verwachteSitemap}`,
    );
  }

  // ── 3. index.html mag niet stiekem op noindex staan ──────────────────────
  if (bestanden.indexHtml !== null) {
    const robotsMeta = /<meta[^>]+name="robots"[^>]+content="([^"]+)"/i.exec(bestanden.indexHtml);
    if (robotsMeta && /noindex/i.test(robotsMeta[1])) {
      problemen.push(
        `index.html zet <meta name="robots" content="${robotsMeta[1]}">.\n` +
          `      Dat overrulet robots.txt en haalt óók de publieke pagina's uit de index.`,
      );
    }

    const ogUrl = /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i.exec(bestanden.indexHtml);
    if (ogUrl && !ogUrl[1].startsWith(origin)) {
      problemen.push(
        `index.html heeft og:url "${ogUrl[1]}" terwijl het canonieke origin ${origin} is.`,
      );
    }

    if (/<link[^>]+rel="canonical"/i.test(bestanden.indexHtml)) {
      problemen.push(
        "index.html bevat een vaste canonical.\n" +
          "      Dit bestand wordt voor élke route geserveerd, dus die zou zeggen dat\n" +
          "      /voorwaarden een duplicaat van de homepage is. Zet hem per route via\n" +
          "      src/lib/usePaginameta.ts.",
      );
    }
  }

  return { problemen, aantalUrls: verwacht.length };
}

export function draai() {
  const paginasPad = join(ROOT, "src", "data", "publieke-paginas.ts");
  const sitemapPad = join(ROOT, "public", "sitemap.xml");
  const robotsPad = join(ROOT, "public", "robots.txt");
  const indexPad = join(ROOT, "dist", "index.html");

  for (const [naam, pad] of [
    ["src/data/publieke-paginas.ts", paginasPad],
    ["public/sitemap.xml", sitemapPad],
    ["public/robots.txt", robotsPad],
  ]) {
    if (!existsSync(pad)) {
      console.error(`\n✗ ${naam} ontbreekt.\n`);
      return 1;
    }
  }

  const { problemen, aantalUrls } = controleerSeo({
    paginasBron: readFileSync(paginasPad, "utf8"),
    sitemap: readFileSync(sitemapPad, "utf8"),
    robots: readFileSync(robotsPad, "utf8"),
    indexHtml: existsSync(indexPad) ? readFileSync(indexPad, "utf8") : null,
  });

  if (problemen.length > 0) {
    console.error("\n✗ Sitemap en robots.txt sluiten niet aan op de app\n");
    for (const p of problemen) console.error(`  - ${p}`);
    console.error("");
    return 1;
  }

  console.log(
    `✓ SEO OK — ${aantalUrls} publieke URL's in sitemap.xml, robots.txt sluit de rest af`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(draai());
}
