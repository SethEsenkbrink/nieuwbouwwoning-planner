import { defineConfig } from "vitest/config";
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
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), netlify()],

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
