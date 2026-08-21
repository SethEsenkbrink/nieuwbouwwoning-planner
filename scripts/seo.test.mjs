import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { controleerSeo, leesBron } from "./verify-seo.mjs";

/**
 * De gate bestaat omdat robots.txt en sitemap.xml statische bestanden zijn:
 * ze veranderen niet mee met de code, en niemand merkt het als ze uit elkaar
 * lopen. Deze tests bewijzen dat hij dat merkt.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const BRON = `
export const CANONIEKE_ORIGIN = "https://voorbeeld.nl";
export const PUBLIEKE_PAGINAS = [
  {
    pad: "/",
    titel: "Home",
    beschrijving: "x",
    prioriteit: "1.0",
  },
  {
    pad: "/privacy",
    titel: "Privacy",
    beschrijving: "y",
    prioriteit: "0.3",
  },
];
`;

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://voorbeeld.nl/</loc><priority>1.0</priority></url>
  <url><loc>https://voorbeeld.nl/privacy</loc><priority>0.3</priority></url>
</urlset>`;

const ROBOTS = `User-agent: *
Allow: /$
Allow: /privacy
Disallow: /

Sitemap: https://voorbeeld.nl/sitemap.xml
`;

function bestanden(patch = {}) {
  return {
    paginasBron: BRON,
    sitemap: SITEMAP,
    robots: ROBOTS,
    indexHtml: null,
    ...patch,
  };
}

describe("leesBron", () => {
  it("haalt het origin en de paden uit de TypeScript-module", () => {
    const { origin, paden, prioriteiten } = leesBron(BRON);
    expect(origin).toBe("https://voorbeeld.nl");
    expect(paden).toEqual(["/", "/privacy"]);
    expect(prioriteiten).toEqual(["1.0", "0.3"]);
  });

  it("leest de echte publieke-paginas.ts", () => {
    const bron = readFileSync(join(ROOT, "src", "data", "publieke-paginas.ts"), "utf8");
    const { origin, paden } = leesBron(bron);
    expect(origin).toMatch(/^https:\/\//);
    expect(paden).toContain("/");
    expect(paden).toContain("/voorwaarden");
    expect(paden).toContain("/privacy");
  });
});

describe("controleerSeo — de echte bestanden", () => {
  it("keurt de repository goed", () => {
    const uitkomst = controleerSeo({
      paginasBron: readFileSync(join(ROOT, "src", "data", "publieke-paginas.ts"), "utf8"),
      sitemap: readFileSync(join(ROOT, "public", "sitemap.xml"), "utf8"),
      robots: readFileSync(join(ROOT, "public", "robots.txt"), "utf8"),
      indexHtml: readFileSync(join(ROOT, "index.html"), "utf8"),
    });
    expect(uitkomst.problemen).toEqual([]);
  });
});

describe("controleerSeo — wat hij moet vangen", () => {
  it("een publieke pagina die niet in de sitemap staat", () => {
    const zonderPrivacy = SITEMAP.replace(
      "  <url><loc>https://voorbeeld.nl/privacy</loc><priority>0.3</priority></url>\n",
      "",
    );
    const tekst = controleerSeo(bestanden({ sitemap: zonderPrivacy })).problemen.join("\n");
    expect(tekst).toContain("/privacy");
  });

  it("een sitemap-URL die niet bestaat", () => {
    const extra = SITEMAP.replace(
      "</urlset>",
      "  <url><loc>https://voorbeeld.nl/verzonnen</loc></url>\n</urlset>",
    );
    const tekst = controleerSeo(bestanden({ sitemap: extra })).problemen.join("\n");
    expect(tekst).toContain("verzonnen");
  });

  it("een sitemap met het verkeerde domein", () => {
    // Dit is de fout die maanden blijft staan zonder dat iets klaagt.
    const anderDomein = SITEMAP.replaceAll("voorbeeld.nl", "oud-domein.nl");
    const tekst = controleerSeo(bestanden({ sitemap: anderDomein })).problemen.join("\n");
    expect(tekst).toContain("oud-domein.nl");
  });

  it("een origin met een afsluitende slash", () => {
    const bron = BRON.replace("https://voorbeeld.nl", "https://voorbeeld.nl/");
    const tekst = controleerSeo(bestanden({ paginasBron: bron })).problemen.join("\n");
    expect(tekst).toContain("slash");
  });

  it("robots.txt die een publieke pagina blokkeert", () => {
    const zonderPrivacy = ROBOTS.replace("Allow: /privacy\n", "");
    const tekst = controleerSeo(bestanden({ robots: zonderPrivacy })).problemen.join("\n");
    expect(tekst).toContain("/privacy");
  });

  it("robots.txt die iets toestaat dat niet publiek is", () => {
    const teRuim = ROBOTS.replace("Allow: /privacy", "Allow: /privacy\nAllow: /bouwdepot");
    const tekst = controleerSeo(bestanden({ robots: teRuim })).problemen.join("\n");
    expect(tekst).toContain("/bouwdepot");
  });

  it("robots.txt zonder sluitende Disallow", () => {
    const open = ROBOTS.replace("Disallow: /\n", "");
    const tekst = controleerSeo(bestanden({ robots: open })).problemen.join("\n");
    expect(tekst).toContain("Disallow");
  });

  it("een Allow op de wortel zonder anker", () => {
    // "Allow: /" zet de hele site open, inclusief elke app-route.
    const zonderAnker = ROBOTS.replace("Allow: /$", "Allow: /");
    const tekst = controleerSeo(bestanden({ robots: zonderAnker })).problemen.join("\n");
    expect(tekst.length).toBeGreaterThan(0);
  });

  it("een sitemapverwijzing naar het verkeerde domein", () => {
    const fout = ROBOTS.replace(
      "Sitemap: https://voorbeeld.nl/sitemap.xml",
      "Sitemap: https://oud-domein.nl/sitemap.xml",
    );
    const tekst = controleerSeo(bestanden({ robots: fout })).problemen.join("\n");
    expect(tekst).toContain("andere sitemap");
  });

  it("noindex dat terugsluipt in index.html", () => {
    const tekst = controleerSeo(
      bestanden({ indexHtml: '<meta name="robots" content="noindex, nofollow" />' }),
    ).problemen.join("\n");
    expect(tekst).toContain("noindex");
  });

  it("een vaste canonical in index.html", () => {
    // Die zou op /privacy beweren dat de homepage het origineel is.
    const tekst = controleerSeo(
      bestanden({ indexHtml: '<link rel="canonical" href="https://voorbeeld.nl/" />' }),
    ).problemen.join("\n");
    expect(tekst).toContain("canonical");
  });

  it("een og:url op een ander domein", () => {
    const tekst = controleerSeo(
      bestanden({ indexHtml: '<meta property="og:url" content="https://oud-domein.nl/" />' }),
    ).problemen.join("\n");
    expect(tekst).toContain("og:url");
  });

  it("een prioriteit die niet klopt met de bron", () => {
    const anders = SITEMAP.replace("<priority>0.3</priority>", "<priority>0.9</priority>");
    const tekst = controleerSeo(bestanden({ sitemap: anders })).problemen.join("\n");
    expect(tekst).toContain("prioriteit");
  });

  it("een bron zonder origin", () => {
    const tekst = controleerSeo(bestanden({ paginasBron: "export const X = 1;" })).problemen.join(
      "\n",
    );
    expect(tekst).toContain("CANONIEKE_ORIGIN");
  });
});
