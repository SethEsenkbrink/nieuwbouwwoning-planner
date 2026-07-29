/**
 * Brink Multimedia — Tailwind Preset (v2.0 · Warm/D3)
 * Importeer dit in elk project: `presets: [require('@brink/ui/preset')]`.
 * Zo delen alle projecten exact dezelfde huisstijl. Wijzig tokens in tokens.js.
 */
import { color, radius, spacing, elevation, typography } from "./tokens.js";

/** @type {import('tailwindcss').Config} */
const preset = {
  theme: {
    extend: {
      colors: {
        // surfaces
        canvas: color.canvas,
        lifted: color.lifted,
        bone: color.bone,
        whisper: color.whisper,
        // ink / tekst
        ink: color.ink,
        charcoal: color.charcoal,
        slate: color.slate,
        granite: color.granite,
        taupe: color.taupe,
        // primair accent — klei
        clay: {
          DEFAULT: color.clay,
          light: color.clayLight,
          deep: color.clayDeep,
        },
        // secundair accent — olijf
        olive: {
          DEFAULT: color.olive,
          light: color.oliveLight,
          deep: color.oliveDeep,
        },
        // semantic
        link: color.link,
        focus: color.focus,
        consent: color.consent,
        // backward-compat aliassen (verwijzen naar warme waarden)
        cobalt: {
          DEFAULT: color.cobalt,
          light: color.cobaltLight,
          deep: color.cobaltDeep,
        },
        coral: {
          DEFAULT: color.coral,
          soft: color.coralSoft,
        },
        violet: color.violet,
      },
      fontFamily: {
        sans: [typography.fontFamily],
      },
      fontWeight: {
        body: "450",
      },
      fontSize: {
        h1: ["64px", { lineHeight: "1.02", fontWeight: "800", letterSpacing: "-0.02em" }],
        h2: ["36px", { lineHeight: "1.15", fontWeight: "700", letterSpacing: "-0.02em" }],
        h3: ["22px", { lineHeight: "1.25", fontWeight: "700", letterSpacing: "-0.01em" }],
        eyebrow: ["13px", { lineHeight: "1", fontWeight: "700", letterSpacing: "0.1em" }],
        body: ["16px", { lineHeight: "1.55", fontWeight: "450" }],
        button: ["15px", { lineHeight: "1", fontWeight: "700", letterSpacing: "-0.01em" }],
      },
      letterSpacing: {
        heading: typography.tracking.heading,
        eyebrow: typography.tracking.eyebrow,
        button: typography.tracking.button,
      },
      borderRadius: {
        xs: radius.xs,
        button: radius.button,
        consent: radius.consent,
        card: radius.card,
        stadium: radius.stadium,
        pill: radius.pill,
      },
      spacing: {
        s1: spacing[1],
        s2: spacing[2],
        s3: spacing[3],
        s4: spacing[4],
        s6: spacing[6],
        s8: spacing[8],
        s12: spacing[12],
        s16: spacing[16],
      },
      boxShadow: {
        e1: elevation[1],
        e2: elevation[2],
        e3: elevation[3],
      },
      maxWidth: {
        content: "1200px",
      },
    },
  },
};

export default preset;
