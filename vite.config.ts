import { defineConfig } from "vitest/config";
import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin";
import path from "node:path";

/**
 * Vite-configuratie — Nieuwbouwplanner
 *
 * Plugins, in volgorde:
 *  - react       Fast Refresh + JSX-transform. React Compiler staat bewust uit (ADR-0006).
 *  - tailwindcss Tailwind v4 CSS-first. Er is géén tailwind.config.js; de tokens staan
 *                in src/styles/brink-theme.css (ADR-0002).
 *  - netlify     Emuleert Netlify Functions tijdens `npm run dev`, zodat je serverside
 *                code lokaal kunt aanroepen zonder aparte `netlify dev`.
 *  - stripCspInDev  Zie hieronder.
 */

/**
 * Verwijdert alléén de Content-Security-Policy tijdens `npm run dev`.
 *
 * HET PROBLEEM
 * @netlify/vite-plugin past de headers uit netlify.toml ook lokaal toe. Onze
 * productie-CSP staat bewust géén inline scripts toe — maar Vite heeft die in
 * dev nodig: @vitejs/plugin-react injecteert een inline "preamble" voor React
 * Fast Refresh, en de HMR-client verbindt over ws://localhost. Beide worden
 * geblokkeerd. Gevolg: élke component-module gooit bij het laden een fout en je
 * krijgt een lege pagina — zonder duidelijke melding, want ook het foutscherm
 * is een React-component.
 *
 * WAAROM ZO
 * De plugin-optie `headers: { enabled: false }` is aanwezig in de types maar
 * doet in versie 2.12.9 niets: de CSP blijft gewoon staan (geverifieerd met
 * curl). En `middleware: false` zou óók de emulatie van Netlify Functions
 * uitzetten, terwijl we die juist nodig hebben voor de documentparser.
 *
 * Deze middleware verwijdert dus precies één header en laat de rest
 * (X-Frame-Options, Referrer-Policy, HSTS, …) intact.
 *
 * `apply: "serve"` zorgt dat dit nooit in een productiebuild terechtkomt.
 *
 * DE CSP WORDT ELDERS BEWAAKT
 *  1. `npm run verify:headers` — syntaxis, volledigheid, geen 'unsafe-inline'
 *  2. de Netlify deploy preview — daar geldt de echte policy wél
 *
 * Test een CSP-wijziging dus altijd op een deploy preview, niet lokaal.
 */
function stripCspInDev(): Plugin {
  return {
    name: "strip-csp-in-dev",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      // De teruggegeven functie draait ná de interne middlewares, dus nadat de
      // Netlify-middleware de header heeft gezet.
      return () => {
        server.middlewares.use(
          (_req: IncomingMessage, res: ServerResponse, next: () => void) => {
            res.removeHeader("Content-Security-Policy");
            next();
          },
        );
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), netlify(), stripCspInDev()],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },

  server: {
    port: 5173,
    // Faal hard in plaats van stilletjes naar een andere poort te schuiven —
    // anders wijzen je Firebase authorized domains ineens naar de verkeerde poort.
    strictPort: true,
  },

  build: {
    // Sourcemaps aan: de bundle is toch publiek, en debuggen van een
    // productie-fout zonder maps kost onevenredig veel tijd.
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      output: {
        // Firebase is groot en verandert zelden — apart chunken houdt de
        // app-chunk klein en cachebaar over deploys heen.
        //
        // Let op: Vite 8 bundelt met Rolldown, dat manualChunks alléén als
        // functie accepteert. De object-vorm uit Vite ≤7 faalt hier met
        // "manualChunks is not a function".
        manualChunks(id: string) {
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
            return "firebase";
          }
          return undefined;
        },
      },
    },
  },

  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "firebase/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
