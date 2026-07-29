#!/usr/bin/env node
/**
 * verify-tokens.mjs — pariteitscheck huisstijl
 *
 * `brink-ui/tokens.js` is de single source of truth voor de Brink-huisstijl.
 * `src/styles/brink-theme.css` is daarvan de Tailwind-v4-vertaling (ADR-0002).
 *
 * Dit script vergelijkt beide en faalt zodra ze uit elkaar lopen. Zonder deze
 * check drift de huisstijl van dit project stilletjes weg van de rest van de
 * werkruimte — je ziet het pas als twee sites naast elkaar staan.
 *
 * Draait als onderdeel van `npm run verify`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_PATH = join(ROOT, "src", "styles", "brink-theme.css");
const TOKENS_PATH = join(ROOT, "brink-ui", "tokens.js");

/** camelCase → kebab-case, zodat clayDeep → clay-deep. */
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** Normaliseert kleuren voor vergelijking: #C4633B en #c4633b zijn gelijk. */
const normColor = (v) => String(v).trim().toLowerCase();

/**
 * Normaliseert lengtes/schaduwen zodat de vergelijking semantisch is, niet
 * letterlijk. `rgba(50,40,25,.05)` en `rgba(50, 40, 25, 0.05)` zijn dezelfde
 * waarde — Prettier voegt die spaties toe in CSS, tokens.js heeft ze niet.
 */
const normValue = (v) =>
  String(v)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*([,()])\s*/g, "$1"); // spaties rond komma's en haakjes weg

const { color, radius, spacing, elevation, typography } = await import(
  `file://${TOKENS_PATH.replace(/\\/g, "/")}`
);

const css = readFileSync(CSS_PATH, "utf8");

/**
 * Leest een custom property uit het @theme-blok. Geeft de RUWE waarde terug —
 * normaliseren gebeurt pas in check(), zodat beide kanten exact dezelfde
 * behandeling krijgen en er geen dubbele normalisatie ontstaat.
 */
function readCssVar(name) {
  const re = new RegExp(`--${name}\\s*:\\s*([^;]+);`);
  const m = css.match(re);
  return m ? m[1].trim() : null;
}

const problems = [];

function check(cssVarName, expected, label, normalize = normValue) {
  const actual = readCssVar(cssVarName);
  if (actual === null) {
    problems.push(`ontbreekt in CSS:  --${cssVarName}  (${label})`);
    return;
  }
  if (normalize(actual) !== normalize(expected)) {
    problems.push(
      `wijkt af:          --${cssVarName}\n` +
        `                     tokens.js : ${expected}\n` +
        `                     CSS       : ${actual}`,
    );
  }
}

// ── Kleuren ────────────────────────────────────────────────────────────────
// `white` staat niet in @theme: Tailwind levert die zelf al.
for (const [key, value] of Object.entries(color)) {
  if (key === "white") continue;
  check(`color-${kebab(key)}`, value, "kleur", normColor);
}

// ── Radii ──────────────────────────────────────────────────────────────────
for (const [key, value] of Object.entries(radius)) {
  check(`radius-${kebab(key)}`, value, "radius");
}

// ── Spacing ────────────────────────────────────────────────────────────────
for (const [key, value] of Object.entries(spacing)) {
  check(`spacing-s${key}`, value, "spacing");
}

// ── Elevation ──────────────────────────────────────────────────────────────
for (const [key, value] of Object.entries(elevation)) {
  check(`shadow-e${key}`, value, "elevation");
}

// ── Typografie ─────────────────────────────────────────────────────────────
check("font-sans", typography.fontFamily, "font-family", (v) =>
  // tokens.js gebruikt enkele quotes, CSS dubbele — quotes en spatiëring
  // rond komma's zijn hier niet betekenisvol.
  String(v)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ")
    .trim(),
);

for (const [key, value] of Object.entries(typography.weight)) {
  check(`font-weight-${kebab(key)}`, String(value), "font-weight");
}

for (const [key, value] of Object.entries(typography.tracking)) {
  check(`tracking-${kebab(key)}`, value, "tracking");
}

// ── Uitkomst ───────────────────────────────────────────────────────────────
if (problems.length > 0) {
  console.error("\n✗ Huisstijl-pariteit MISLUKT\n");
  console.error("  brink-ui/tokens.js en src/styles/brink-theme.css lopen uiteen:\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\n  Herstel: pas src/styles/brink-theme.css aan zodat het tokens.js volgt.\n" +
      "  Wil je de huisstijl écht wijzigen, doe dat dan in\n" +
      "  ../Huisstijl/brink-ui/tokens.js, draai `node sync-huisstijl.mjs` vanuit de\n" +
      "  werkruimte-root, en werk daarna dit CSS-bestand bij.\n",
  );
  process.exit(1);
}

const total =
  Object.keys(color).length -
  1 +
  Object.keys(radius).length +
  Object.keys(spacing).length +
  Object.keys(elevation).length +
  Object.keys(typography.weight).length +
  Object.keys(typography.tracking).length +
  1;

console.log(`✓ Huisstijl-pariteit OK — ${total} tokens komen overeen met brink-ui/tokens.js`);
