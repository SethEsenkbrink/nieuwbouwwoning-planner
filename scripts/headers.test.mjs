import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "smol-toml";
import { controleerHeaders } from "./verify-headers.mjs";

/**
 * Deze tests bewijzen dat de gate de fout vángt, niet alleen dat hij groen is.
 *
 * De aanleiding: `script-src 'self'` liet Chrome `WebAssembly.compile()`
 * weigeren, waardoor Argon2id niet draaide en een kluis aanmaken op de
 * productie-URL onmogelijk was. `npm run verify` stond ondertussen groen —
 * de headercontrole keek daar niet naar.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function csp(directives) {
  return {
    headers: [{ for: "/*", values: { "Content-Security-Policy": directives.join("; ") } }],
  };
}

const GOEDE_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'none'",
  "frame-src 'none'",
];

describe("controleerHeaders", () => {
  it("keurt de echte netlify.toml goed", () => {
    const config = parse(readFileSync(join(ROOT, "netlify.toml"), "utf8"));
    expect(controleerHeaders(config).problemen).toEqual([]);
  });

  it("vangt de WASM-blokkade: script-src zonder 'wasm-unsafe-eval'", () => {
    const kapot = GOEDE_DIRECTIVES.map((d) =>
      d.startsWith("script-src") ? "script-src 'self'" : d,
    );
    const { problemen } = controleerHeaders(csp(kapot));
    expect(problemen.join("\n")).toContain("'wasm-unsafe-eval'");
  });

  it("weigert 'unsafe-eval' ook naast 'wasm-unsafe-eval'", () => {
    const kapot = GOEDE_DIRECTIVES.map((d) =>
      d.startsWith("script-src") ? "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'" : d,
    );
    const { problemen } = controleerHeaders(csp(kapot));
    expect(problemen.join("\n")).toContain("bevat 'unsafe-eval'");
  });

  it("ziet 'wasm-unsafe-eval' niet aan voor 'unsafe-eval'", () => {
    // De oude controle deed `includes("'unsafe-eval'")`. Dat ging hier goed
    // door de apostrof vóór het woord — puur toeval. Deze test pint vast dat
    // de nette variant niet alsnog wordt afgekeurd.
    const { problemen } = controleerHeaders(csp(GOEDE_DIRECTIVES));
    expect(problemen).toEqual([]);
  });

  it("vangt een connect-src die niet 'none' is", () => {
    const kapot = GOEDE_DIRECTIVES.map((d) =>
      d.startsWith("connect-src") ? "connect-src 'self'" : d,
    );
    const { problemen } = controleerHeaders(csp(kapot));
    expect(problemen.join("\n")).toContain("connect-src");
  });

  it("vangt 'unsafe-inline' in welke directive dan ook", () => {
    const { problemen } = controleerHeaders(csp([...GOEDE_DIRECTIVES, "style-src 'unsafe-inline'"]));
    expect(problemen.join("\n")).toContain("'unsafe-inline'");
  });

  it("vangt een ontbrekende directive", () => {
    const kapot = GOEDE_DIRECTIVES.filter((d) => !d.startsWith("frame-ancestors"));
    const { problemen } = controleerHeaders(csp(kapot));
    expect(problemen.join("\n")).toContain("frame-ancestors");
  });

  it("vangt een header met een losse newline", () => {
    const config = {
      headers: [
        {
          for: "/*",
          values: {
            "Content-Security-Policy": GOEDE_DIRECTIVES.join("; "),
            "X-Kapot": "regel een\nregel twee",
          },
        },
      ],
    };
    expect(controleerHeaders(config).problemen.join("\n")).toContain("newline");
  });
});
