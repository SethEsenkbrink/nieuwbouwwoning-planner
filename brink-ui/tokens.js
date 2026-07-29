/**
 * Brink Multimedia — Design Tokens (v2.0 · "Warm/D3")
 * Single source of truth. Warme, aardse en betrouwbare huisstijl.
 * Wijzig kleuren/afmetingen ALLEEN hier; de Tailwind-preset leest deze waarden.
 *
 * Kernkleuren: klei (primair/CTA), olijf (secundair/diep), warm zand (canvas),
 * warm ink (tekst). Eén lettertype: Manrope.
 */

export const color = {
  // Surfaces — nooit puur wit als paginacanvas
  canvas: "#F5F1E8", // warm zand
  lifted: "#FBF8F1", // lichter warm (raised)
  white: "#FFFFFF",
  bone: "#ECE6D8",
  whisper: "#E7E0CF", // ghost-watermark cream-op-cream

  // Ink / tekst (warm)
  ink: "#26251F",
  charcoal: "#3A382F",
  slate: "#5C584D",
  granite: "#6E6A5D",
  taupe: "#B7AE9B",

  // Primair accent — Klei / terracotta (CTA, brand, links, dot)
  clay: "#C4633B",
  clayLight: "#D77E4F",
  clayDeep: "#A34E29",

  // Secundair accent — Olijf / bosgroen (diepe blokken, focus)
  olive: "#4E5B3C",
  oliveLight: "#67744F",
  oliveDeep: "#3C4632",

  // Semantic
  link: "#A34E29",
  focus: "#4E5B3C",
  consent: "#C4633B",

  /* Backward-compat aliassen — zodat bestaande classes blijven renderen.
     Nieuwe code gebruikt clay/olive. */
  cobalt: "#C4633B",
  cobaltLight: "#D77E4F",
  cobaltDeep: "#A34E29",
  coral: "#C4633B",
  coralSoft: "#D77E4F",
  violet: "#4E5B3C",
};

export const radius = {
  xs: "8px",
  button: "999px", // D3: knoppen zijn pill
  consent: "16px",
  card: "24px", // D3: kaarten met zachte ronding
  stadium: "32px",
  pill: "999px",
};

export const spacing = {
  1: "8px",
  2: "16px",
  3: "24px",
  4: "32px",
  6: "48px",
  8: "64px",
  12: "96px",
  16: "128px",
};

export const elevation = {
  1: "0px 4px 20px 0px rgba(50,40,25,0.05)",
  2: "0px 16px 40px 0px rgba(50,40,25,0.08)",
  3: "0px 40px 80px 0px rgba(50,40,25,0.16)",
};

export const typography = {
  fontFamily: "'Manrope Variable', Manrope, system-ui, Arial, sans-serif",
  weight: { body: 450, medium: 500, semibold: 600, bold: 700, heavy: 800 },
  tracking: { heading: "-0.02em", eyebrow: "0.1em", button: "-0.01em" },
};

export default { color, radius, spacing, elevation, typography };
