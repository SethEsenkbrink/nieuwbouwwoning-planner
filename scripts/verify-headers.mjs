#!/usr/bin/env node
/**
 * verify-headers.mjs — valideert de HTTP-headers uit netlify.toml
 *
 * Controleert:
 * 1. Elke header is een geldige HTTP-header (geen syntaxfouten of losse newlines).
 * 2. CSP is compleet, zero-network en dwingt connect-src 'none' af.
 * 3. script-src staat WebAssembly toe en JavaScript-eval níét.
 *
 * De controle zit in `controleerHeaders()` zodat `scripts/headers.test.mjs`
 * hem met opzettelijk kapotte configuraties kan voeden. Een gate die alleen
 * zichzelf kan draaien bewijst niet dat hij een fout vángt — dat was precies
 * bevinding A-14 bij verify-crypto.
 *
 * Draait als onderdeel van `npm run verify`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "smol-toml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOML_PAD = join(ROOT, "netlify.toml");

/** Directives die er altijd moeten staan. */
export const VERPLICHTE_DIRECTIVES = [
  "default-src",
  "base-uri",
  "object-src",
  "frame-ancestors",
  "form-action",
  "script-src",
  "connect-src",
  "frame-src",
];

/**
 * Bronnen die script-src moet noemen.
 *
 * `'wasm-unsafe-eval'` staat hier omdat de Argon2id-sleutelafleiding een
 * WebAssembly-module compileert (hash-wasm, in `src/crypto/argon2.worker.ts`).
 * Zonder die bron weigert Chrome `WebAssembly.compile()` en kan er geen kluis
 * aangemaakt of ontgrendeld worden. Het is de smalle variant: JavaScript-eval
 * blijft geblokkeerd, en de regel hieronder houdt dat zo.
 */
const VERPLICHTE_SCRIPT_BRONNEN = ["'self'", "'wasm-unsafe-eval'"];

/** Bronnen die nergens mogen staan, hoe verleidelijk een snelle fix ook is. */
const VERBODEN_BRONNEN = ["'unsafe-eval'", "'unsafe-inline'"];

/**
 * Toetst een geparste netlify-configuratie.
 *
 * @param {unknown} config geparste TOML
 * @returns {{ problemen: string[], gecontroleerd: number, aantalDirectives: number }}
 */
export function controleerHeaders(config) {
  const problemen = [];
  let gecontroleerd = 0;

  // ── 1. Elke header moet een geldige HTTP-header-waarde zijn ──────────────
  for (const blok of config.headers ?? []) {
    for (const [naam, waarde] of Object.entries(blok.values ?? {})) {
      const v = String(waarde);
      gecontroleerd++;

      if (/[\r\n]/.test(v)) {
        problemen.push(
          `${naam} (for="${blok.for}") bevat een newline.\n` +
            `      Oorzaak: TOML-multiline string zonder backslash aan het regeleinde.\n` +
            `      Fix: zet " \\" achter elke regel binnen de """...""".`,
        );
        continue;
      }

      try {
        new Headers().set(naam, v);
      } catch (fout) {
        problemen.push(`${naam} (for="${blok.for}") is ongeldig: ${fout.message}`);
      }
    }
  }

  // ── 2. De CSP moet compleet en zero-network zijn ─────────────────────────
  const csp = config.headers?.[0]?.values?.["Content-Security-Policy"];

  if (!csp) {
    problemen.push("Content-Security-Policy ontbreekt volledig in netlify.toml.");
    return { problemen, gecontroleerd, aantalDirectives: 0 };
  }

  const directives = String(csp)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const namen = directives.map((d) => d.split(/\s+/)[0]);

  for (const vereist of VERPLICHTE_DIRECTIVES) {
    if (!namen.includes(vereist)) {
      problemen.push(`CSP mist de directive "${vereist}".`);
    }
  }

  const connectSrc = directives.find((d) => d.startsWith("connect-src")) ?? "";
  if (connectSrc !== "connect-src 'none'") {
    problemen.push(
      `CSP connect-src moet exact "connect-src 'none'" zijn (gevonden: "${connectSrc}").\n` +
        `      Woningdossier is 100% lokaal en mag geen uitgaande netwerkverbindingen toestaan.`,
    );
  }

  // ── 3. script-src: WebAssembly ja, eval nee ──────────────────────────────
  //
  // Op tokens vergelijken en niet met `includes()`. Een substringcontrole op
  // "'unsafe-eval'" ziet het verschil met "'wasm-unsafe-eval'" alleen bij
  // toeval — de apostrof ervoor — en dat is te dun fundament voor de directive
  // die XSS tegenhoudt.
  const scriptSrc = directives.find((d) => d.startsWith("script-src")) ?? "";
  const scriptBronnen = scriptSrc.split(/\s+/).slice(1);

  for (const vereist of VERPLICHTE_SCRIPT_BRONNEN) {
    if (!scriptBronnen.includes(vereist)) {
      problemen.push(
        `CSP script-src mist ${vereist}.\n` +
          `      Zonder 'wasm-unsafe-eval' weigert de browser de Argon2id-WASM en\n` +
          `      kan er geen kluis aangemaakt of ontgrendeld worden.`,
      );
    }
  }
  for (const verboden of VERBODEN_BRONNEN) {
    if (scriptBronnen.includes(verboden)) {
      problemen.push(
        `CSP script-src bevat ${verboden}.\n` +
          `      Dat haalt de belangrijkste bescherming tegen XSS weg.`,
      );
    }
  }
  if (scriptSrc.includes("http:") || scriptSrc.includes("https:")) {
    problemen.push(`CSP script-src bevat externe bronnen. Alle scripts moeten 'self' zijn.`);
  }

  // Géén enkele directive mag 'unsafe-inline' bevatten (bevinding A-04).
  //
  // Dit stond er eerder alleen voor script-src, waardoor style-src jarenlang
  // 'unsafe-inline' kon houden zonder dat de gate iets zei. De voortgangsbalken
  // gebruiken nu SVG-presentatieattributen in plaats van inline styles, dus er
  // is geen reden meer om ergens een uitzondering te maken.
  const metUnsafeInline = directives.filter((d) => d.split(/\s+/).includes("'unsafe-inline'"));
  if (metUnsafeInline.length > 0) {
    problemen.push(
      `CSP bevat 'unsafe-inline' in: ${metUnsafeInline.join(", ")}.\n` +
        `  Inline styles en scripts horen in een bestand. Zie bevinding A-04.`,
    );
  }

  const frameSrc = directives.find((d) => d.startsWith("frame-src")) ?? "";
  if (frameSrc !== "frame-src 'none'") {
    problemen.push(`CSP frame-src moet 'none' zijn.`);
  }

  return { problemen, gecontroleerd, aantalDirectives: directives.length };
}

/** Leest en toetst netlify.toml. Geeft de exitcode terug. */
export function draai() {
  let config;
  try {
    config = parse(readFileSync(TOML_PAD, "utf8"));
  } catch (fout) {
    console.error(`\n✗ netlify.toml is geen geldige TOML:\n  ${fout.message}\n`);
    return 1;
  }

  const { problemen, gecontroleerd, aantalDirectives } = controleerHeaders(config);

  if (problemen.length > 0) {
    console.error("\n✗ netlify.toml headers ONGELDIG\n");
    for (const p of problemen) console.error(`  - ${p}`);
    console.error("");
    return 1;
  }

  console.log(
    `✓ Headers OK — ${gecontroleerd} headers geldig, CSP zero-network bevestigd ` +
      `(${aantalDirectives} directives)`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(draai());
}
