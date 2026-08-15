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
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "Woningdossier",
        short_name: "Woningdossier",
        description: "100% lokaal, end-to-end versleuteld dossier voor het complete leven van een woning.",
        theme_color: "#1e293b",
        background_color: "#f8fafc",
        display: "standalone",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
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
    sourcemap: true,
    target: "es2022",
  },

  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
