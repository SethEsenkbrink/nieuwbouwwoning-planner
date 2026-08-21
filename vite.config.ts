import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

/**
 * Vite-configuratie — Woningdossier
 *
 * Plugins:
 *  - react       Fast Refresh + JSX-transform.
 *  - tailwindcss Tailwind v4 CSS-first (geen tailwind.config.js; tokens in brink-theme.css).
 *  - VitePWA     Offline app-shell en web manifest. Nul runtime caching van externe bronnen.
 */

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Alleen bestanden die echt in public/ staan. Een naam die er niet is
      // levert geen foutmelding bij het bouwen, maar wel een 404 in de
      // service worker en een half werkende installatie.
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "robots.txt"],
      manifest: {
        name: "Woningdossier",
        short_name: "Woningdossier",
        description: "100% lokaal, end-to-end versleuteld dossier voor het complete leven van een woning.",
        // Huisstijlkleuren, gelijk aan --color-canvas in brink-theme.css en aan
        // de theme-color in index.html. Stonden hier op slate-grijs uit een
        // template, waardoor de app-balk bij installatie niet bij de app paste.
        theme_color: "#f5f1e8",
        background_color: "#f5f1e8",
        display: "standalone",
        lang: "nl",
        start_url: "/",
        scope: "/",
        // DE NAMEN HIERONDER MOETEN BESTAANDE BESTANDEN IN public/ ZIJN.
        // Ze stonden op pwa-192x192.png en pwa-512x512.png — bestanden die er
        // nooit zijn geweest. Chrome meldde bij elke start "Error while trying
        // to use the following icon from the Manifest" en installeren gaf een
        // app zonder icoon. `scripts/verify-pwa.mjs` vangt dit nu af.
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm}"],
        runtimeCaching: [],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },

  server: {
    port: 5173,
    strictPort: true,
  },

  build: {
    // GEEN sourcemaps in de productiebundel.
    //
    // DevTools haalt een .map-bestand op met fetch(), en `connect-src 'none'`
    // blokkeert dat. Resultaat: vijf CSP-fouten in de console bij elke keer dat
    // iemand DevTools opent, die niets met de app te maken hebben maar wel de
    // échte fouten wegdrukken. De broncode is bovendien gewoon publiek (AGPL),
    // dus de maps leveren niets op wat de repo niet al geeft.
    sourcemap: false,
    target: "es2022",
  },

  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
