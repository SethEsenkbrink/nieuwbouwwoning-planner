#!/usr/bin/env node
/**
 * verify-lockfile.mjs — de lockfile moet op élk platform installeerbaar zijn
 *
 * Op 18 augustus 2026 bleek de lockfile op Linux onbruikbaar:
 *
 *   npm error `npm ci` can only install packages when your package.json and
 *   npm error package-lock.json are in sync.
 *   npm error Missing: @emnapi/runtime@2.0.0-alpha.4 from lock file
 *
 * De oorzaak is een eigenaardigheid van npm: bij `npm install` prunet het de
 * optionele platformafhankelijkheden die op de huidige machine niet nodig zijn.
 * Een Windows-install gooit de wasm-pakketten eruit die Linux nodig heeft, en
 * omgekeerd. De lockfile is dan nog steeds geldig op de machine waar hij
 * gemaakt is — en stuk op de buildserver.
 *
 * Dat is geen theoretisch risico: Netlify bouwt op Linux. Een `npm install`
 * op Windows vlak voor een push zou de deploy laten falen, terwijl lokaal
 * alles groen is. Precies de klasse fouten waar deze verify-scripts voor zijn.
 *
 * Dit script controleert daarom dat de lockfile de binaries én de
 * wasm-runtime van alle relevante platformen bevat. Loopt hij rood, dan is de
 * oplossing: `npm install` opnieuw draaien in WSL of op een Linux-machine, en
 * die lockfile committen. Doe het daarna niet meer over op Windows.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WORTEL = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wat er in de lockfile moet zitten.
 *
 * De win32-binaries zijn er voor de machine van Seth, de linux-binaries voor
 * Netlify, en `@emnapi/*` voor de wasm-fallback die npm op Linux meeneemt.
 * Ontbreekt één van de drie groepen, dan werkt `npm ci` op minstens één
 * platform niet.
 */
const VERWACHT = [
  { naam: "Linux-binaries (Netlify bouwt hierop)", patroon: /linux/, minimaal: 20 },
  { naam: "Windows-binaries (lokale ontwikkeling)", patroon: /win32/, minimaal: 8 },
  { naam: "wasm-runtime (@emnapi, nodig op Linux)", patroon: /@emnapi\//, minimaal: 9 },
];

function run() {
  const lock = JSON.parse(readFileSync(join(WORTEL, "package-lock.json"), "utf8"));
  const paden = Object.keys(lock.packages ?? {});
  const fouten = [];

  for (const groep of VERWACHT) {
    const aantal = paden.filter((p) => groep.patroon.test(p)).length;
    if (aantal < groep.minimaal) {
      fouten.push(
        `${groep.naam}: ${String(aantal)} gevonden, minimaal ${String(groep.minimaal)} verwacht.`,
      );
    }
  }

  if (fouten.length > 0) {
    console.error(
      `\n✗ package-lock.json is niet platformonafhankelijk:\n\n` +
        fouten.map((f) => `  - ${f}`).join("\n") +
        `\n\n  Vermoedelijke oorzaak: er is \`npm install\` gedraaid op één platform,\n` +
        `  waardoor npm de optionele afhankelijkheden van het andere heeft gepruned.\n` +
        `  De build op Netlify (Linux) faalt hierdoor terwijl lokaal alles groen is.\n\n` +
        `  Herstel: draai \`npm install\` in WSL (Linux) en commit die lockfile.\n` +
        `  Draai daarna geen \`npm install\` meer op Windows — \`npm ci\` is veilig,\n` +
        `  want die laat de lockfile ongemoeid.\n`,
    );
    process.exit(1);
  }

  const totalen = VERWACHT.map(
    (g) => `${String(paden.filter((p) => g.patroon.test(p)).length)}× ${g.patroon.source}`,
  ).join(", ");
  console.log(`✓ Lockfile OK — platformonafhankelijk (${totalen}), ${String(paden.length)} pakketten.`);
}

run();
