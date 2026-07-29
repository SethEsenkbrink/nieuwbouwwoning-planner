#!/usr/bin/env node
/**
 * verify-headers.mjs — valideert de HTTP-headers uit netlify.toml
 *
 * Aanleiding: de Content-Security-Policy stond als gewone TOML-multiline string
 * (`"""..."""`), waardoor er letterlijke newlines in de header-waarde terechtkwamen.
 * HTTP-headers mogen die niet bevatten. Resultaat: de lokale Netlify-emulator
 * crashte bij élke request met
 *
 *   TypeError: Headers.set: "..." is an invalid header value
 *
 * Dit script vangt dat af vóórdat je het in de browser merkt. Het gebruikt de
 * ingebouwde Headers-klasse van Node, dus exact dezelfde validatie (undici) als
 * de emulator gebruikt.
 *
 * Draait als onderdeel van `npm run verify`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "smol-toml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOML_PAD = join(ROOT, "netlify.toml");

/** Directives die er altijd moeten staan. Verdwijnt er één, dan valt er stil een muur weg. */
const VERPLICHTE_DIRECTIVES = [
  "default-src",
  "base-uri",
  "object-src",
  "frame-ancestors",
  "form-action",
  "script-src",
  "connect-src",
];

/** Firebase-endpoints die de app nodig heeft. Ontbreekt er één, dan faalt inloggen of Firestore. */
const VERPLICHTE_CONNECT_SRC = [
  "https://identitytoolkit.googleapis.com", // inloggen / registreren
  "https://securetoken.googleapis.com", // token-refresh
  "https://firestore.googleapis.com", // database
  "wss://*.firebaseio.com", // realtime listeners
];

const problemen = [];
let gecontroleerd = 0;

let config;
try {
  config = parse(readFileSync(TOML_PAD, "utf8"));
} catch (fout) {
  console.error(`\n✗ netlify.toml is geen geldige TOML:\n  ${fout.message}\n`);
  process.exit(1);
}

// ── 1. Elke header moet een geldige HTTP-header-waarde zijn ────────────────
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

// ── 2. De CSP moet compleet zijn ──────────────────────────────────────────
const csp = config.headers?.[0]?.values?.["Content-Security-Policy"];

if (!csp) {
  problemen.push("Content-Security-Policy ontbreekt volledig in netlify.toml.");
} else {
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
  for (const endpoint of VERPLICHTE_CONNECT_SRC) {
    if (!connectSrc.includes(endpoint)) {
      problemen.push(
        `CSP connect-src mist ${endpoint}.\n` +
          `      Zonder dit endpoint faalt Firebase stil in de browser.`,
      );
    }
  }

  // Het hele punt van deze CSP is dat inline scripts geblokkeerd blijven.
  const scriptSrc = directives.find((d) => d.startsWith("script-src")) ?? "";
  if (scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes("'unsafe-eval'")) {
    problemen.push(
      `CSP script-src bevat 'unsafe-inline' of 'unsafe-eval'.\n` +
        `      Dat haalt de belangrijkste bescherming tegen XSS weg. Los het op met een\n` +
        `      extern script, niet door de policy te verzwakken.`,
    );
  }
}

// ── Uitkomst ──────────────────────────────────────────────────────────────
if (problemen.length > 0) {
  console.error("\n✗ netlify.toml headers ONGELDIG\n");
  for (const p of problemen) console.error(`  - ${p}`);
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Headers OK — ${gecontroleerd} headers geldig, CSP compleet ` +
    `(${String(csp).split(";").filter((s) => s.trim()).length} directives)`,
);
