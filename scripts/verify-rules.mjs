#!/usr/bin/env node
/**
 * verify-rules.mjs — pariteitscheck datamodel ↔ security rules
 *
 * `src/types/model.ts` is de canonieke bron van het datamodel. De Firestore-
 * rules valideren dezelfde enum-waarden nóg een keer, in een taal die de
 * compiler niet kent. Die twee kunnen stil uit elkaar lopen:
 *
 *   - Voeg je een ankertype toe aan `model.ts`, dan compileert alles, draaien
 *     alle tests groen, en werkt de app lokaal tegen de emulator. In productie
 *     weigert de rule de write met "Missing or insufficient permissions" — een
 *     melding die niets zegt over de oorzaak.
 *   - Haal je een waarde wég uit `model.ts` en laat je hem in de rules staan,
 *     dan is de rule ruimer dan het model. Dat merkt niemand ooit, en precies
 *     zo verwatert een validatie.
 *
 * De ankertypes staan bovendien op een dérde plek: `src/data/betrokkenen-
 * standaard.ts`. Ook die wordt hier gecontroleerd, als subset.
 *
 * AANPAK: per `match`-blok in de rules alle `isOneOf(...)`-aanroepen uitlezen
 * en op veldnaam koppelen aan het bijbehorende type. Bewust niet op vaste
 * tekstankers — die breken bij de eerste keer dat iemand de rules anders
 * uitlijnt, en een check die om de verkeerde reden faalt wordt uitgezet.
 *
 * Draait als onderdeel van `npm run verify`. Kost geen emulator en geen Java:
 * dit is tekstvergelijking. De inhoudelijke rules-tests staan in
 * `firebase/rules.test.ts` en draaien apart met `npm run rules:test`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_PATH = join(ROOT, "src", "types", "model.ts");
const RULES_PATH = join(ROOT, "firebase", "firestore.rules");
const STANDAARD_PATH = join(ROOT, "src", "data", "betrokkenen-standaard.ts");

const model = readFileSync(MODEL_PATH, "utf8");
const rules = readFileSync(RULES_PATH, "utf8");
const standaard = readFileSync(STANDAARD_PATH, "utf8");

const problems = [];

// ── Het model uitlezen ─────────────────────────────────────────────────────

/**
 * Leest een string-union uit het model:
 *
 *   export type AnkerStatus = "verwacht" | "bevestigd" | "gepasseerd";
 *
 * Werkt ook als de union over meerdere regels staat.
 */
function leesUnie(naam) {
  const m = model.match(new RegExp(`export type ${naam}\\s*=\\s*([^;]+);`, "m"));
  if (!m) return null;
  const leden = m[1].match(/"([^"]+)"/g);
  return leden ? leden.map((l) => l.slice(1, -1)) : null;
}

// ── De rules uitlezen ──────────────────────────────────────────────────────

/** De ankertypes staan in een eigen hulpfunctie en worden twee keer gebruikt. */
function leesAnkerTypes() {
  const m = rules.match(/function ankerTypes\(\)\s*\{\s*return\s*\[([\s\S]*?)\]/);
  if (!m) return null;
  const leden = m[1].match(/'([^']+)'/g);
  return leden ? leden.map((l) => l.slice(1, -1)) : null;
}

const ANKERTYPES_UIT_RULES = leesAnkerTypes();

/**
 * Knipt het stuk rules dat bij één `match`- of `function`-blok hoort: vanaf de
 * kop tot aan de volgende kop. Genest of niet — de blokken staan in de volgorde
 * waarin ze voorkomen, dus dit levert precies de regels van dat blok op.
 */
function blok(kop) {
  const i = rules.indexOf(kop);
  if (i === -1) return null;
  const rest = rules.slice(i + kop.length);
  const eind = rest.search(/\n\s*(match \/|function )/);
  return eind === -1 ? rest : rest.slice(0, eind);
}

/**
 * Alle `isOneOf(veld, [...])` in een blok, gekoppeld aan de laatste segmentnaam
 * van het veld. `request.resource.data.status` wordt dus `status`.
 *
 * `isOneOf(..., ankerTypes())` wordt opgelost naar de lijst uit die functie.
 */
function enumsIn(tekst) {
  const gevonden = new Map();
  const re = /isOneOf\(\s*([\w.]+)\s*,\s*(\[[\s\S]*?\]|ankerTypes\(\))\s*\)/g;

  for (const m of tekst.matchAll(re)) {
    const veld = m[1].split(".").pop();
    if (gevonden.has(veld)) continue; // create en update herhalen dezelfde regel

    if (m[2].startsWith("ankerTypes")) {
      if (ANKERTYPES_UIT_RULES) gevonden.set(veld, ANKERTYPES_UIT_RULES);
      continue;
    }
    const leden = m[2].match(/'([^']+)'/g);
    if (leden) gevonden.set(veld, leden.map((l) => l.slice(1, -1)));
  }

  return gevonden;
}

// ── Vergelijken ────────────────────────────────────────────────────────────

function vergelijk(label, uitModel, uitRules) {
  if (uitModel === null) {
    problems.push(`${label}: type niet gevonden in model.ts`);
    return;
  }
  if (uitRules === undefined || uitRules === null) {
    problems.push(`${label}: geen isOneOf-validatie gevonden in firestore.rules`);
    return;
  }

  const alleenInModel = uitModel.filter((w) => !uitRules.includes(w));
  const alleenInRules = uitRules.filter((w) => !uitModel.includes(w));

  if (alleenInModel.length > 0) {
    problems.push(
      `${label}: staat in model.ts maar NIET in de rules → ${alleenInModel.join(", ")}\n` +
        `    Gevolg: de app schrijft een waarde die de rules weigeren.`,
    );
  }
  if (alleenInRules.length > 0) {
    problems.push(
      `${label}: staat in de rules maar NIET in model.ts → ${alleenInRules.join(", ")}\n` +
        `    Gevolg: de rules laten meer toe dan het model kent.`,
    );
  }
}

/**
 * Per blok: welk type in `model.ts` hoort bij welk veld in de rules.
 * Uitbreiden zodra er een collectie bij komt — vergeet je dat, dan controleert
 * dit script hem simpelweg niet, en dan is de check zijn bestaansrecht kwijt.
 */
const BLOKKEN = [
  ["geldigeOpleverband", "function geldigeOpleverband(", { opleverStatus: "OpleverStatus" }],
  [
    "geldigeOpschorting",
    "function geldigeOpschorting(",
    { opschortingStatus: "OpschortingStatus" },
  ],
  ["projects", "match /projects/{", { garantiewaarborg: "Garantiewaarborg" }],
  ["ankers", "match /ankers/{", { type: "AnkerType", status: "AnkerStatus" }],
  [
    "betrokkenen",
    "match /betrokkenen/{",
    {
      categorie: "BetrokkeneCategorie",
      communicatieregel: "Communicatieregel",
      waardenBron: "WaardenBron",
    },
  ],
  ["afspraken", "match /afspraken/{", { ankerType: "AnkerType", status: "AfspraakStatus" }],
  ["phases", "match /phases/{", { type: "FaseType", status: "FaseStatus" }],
  ["tasks", "match /tasks/{", { status: "TaakStatus", bron: "TaakBron" }],
  [
    "meerwerk",
    "match /meerwerk/{",
    {
      status: "MeerwerkStatus",
      sluiting: "MeerwerkSluiting",
      sluitingAnkerType: "AnkerType",
    },
  ],
  ["gebreken", "match /gebreken/{", { status: "GebrekStatus" }],
  ["nabudget", "match /nabudget/{", { status: "NabudgetStatus" }],
];

let aantalEnums = 0;
let aantalWaarden = 0;

for (const [naam, kop, velden] of BLOKKEN) {
  const tekst = blok(kop);
  if (tekst === null) {
    problems.push(`blok "${naam}" niet gevonden in firestore.rules (gezocht op: ${kop})`);
    continue;
  }

  const gevonden = enumsIn(tekst);
  for (const [veld, typenaam] of Object.entries(velden)) {
    const uitModel = leesUnie(typenaam);
    vergelijk(`${naam}.${veld} (${typenaam})`, uitModel, gevonden.get(veld));
    aantalEnums += 1;
    aantalWaarden += uitModel?.length ?? 0;
  }
}

// ── De derde plek: de standaardbibliotheek ─────────────────────────────────
// Die hoeft niet élk ankertype te gebruiken, maar mag er geen verzinnen.

const ankerTypes = leesUnie("AnkerType");
if (ankerTypes) {
  const gebruikt = [...standaard.matchAll(/ankerType:\s*"([^"]+)"/g)].map((m) => m[1]);
  const onbekend = [...new Set(gebruikt)].filter((t) => !ankerTypes.includes(t));
  if (onbekend.length > 0) {
    problems.push(
      `betrokkenen-standaard.ts gebruikt onbekende ankertypes → ${onbekend.join(", ")}`,
    );
  }
}

// ── Uitkomst ───────────────────────────────────────────────────────────────

if (problems.length > 0) {
  console.error("\n✗ Model-/rules-pariteit MISLUKT\n");
  console.error("  src/types/model.ts en firebase/firestore.rules lopen uiteen:\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\n  Herstel: werk beide bij, plus docs/PROJECT.md §5. Vergeet daarna\n" +
      "  `npm run rules:test` niet — een aangepaste rule die niet gedraaid is,\n" +
      "  is een rule waarvan je hoopt dat hij werkt.\n",
  );
  process.exit(1);
}

console.log(
  `✓ Model-/rules-pariteit OK — ${aantalEnums} enums, ${aantalWaarden} waarden komen overeen`,
);
