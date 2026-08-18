import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

/**
 * ESLint flat config — Nieuwbouwplanner
 *
 * De type-aware regels (recommendedTypeChecked) zijn hier het belangrijkst:
 * no-floating-promises en no-misused-promises vangen vergeten await's op de
 * opslag- en cryptolaag. Beide zijn volledig async, dus een vergeten await is
 * hier de meest voorkomende stille bug. Zet die niet uit.
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "brink-ui/**", "node_modules/**", "coverage/**"],
  },

  // ── Applicatiecode ────────────────────────────────────────────────────────
  // vite.config.ts hoort hier ook bij: het is TypeScript en heeft dus de
  // TS-parser nodig. Met de gewone JS-parser struikelt ESLint over de eerste
  // type-annotatie in dat bestand.
  {
    files: ["src/**/*.{ts,tsx}", "netlify/**/*.mts", "vite.config.ts"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Ongebruikte variabelen mogen met _ voorgevoegd worden bewust blijven staan.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // any is niet verboden, maar moet een bewuste keuze zijn met uitleg (ADR-0003).
      "@typescript-eslint/no-explicit-any": "error",

      // Async-fouten hard afdwingen — dit is de kern van type-aware linting hier.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",

      // Externe data (een geïmporteerde backup, een ontsleuteld record) mag niet
      // blind gecast worden.
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      // console.log vergeten in productie is slordig; warn/error mogen wel.
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Harde vangnetten tegen de projectconstraints (PROJECT.md §3, ADR-0020).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["firebase", "firebase/*", "@firebase/*"],
              message:
                "Firebase is uit dit project verwijderd (ADR-0020). De app is 100% lokaal en mag geen enkele netwerkafhankelijkheid terugkrijgen.",
            },
          ],
          paths: [
            {
              name: "react-router-dom",
              message:
                "react-router-dom is EOL op 7.18.2. Importeer uit 'react-router'. Zie docs/decisions/ADR-0004.",
            },
          ],
        },
      ],
    },
  },

  // ── Netlify Functions draaien in Node, niet in de browser ─────────────────
  {
    files: ["netlify/**/*.mts"],
    languageOptions: {
      globals: { ...globals.node, Netlify: "readonly" },
    },
    rules: {
      // Serverside logging is legitiem.
      "no-console": "off",
    },
  },

  // ── Buildscripts in plain JS ──────────────────────────────────────────────
  {
    files: ["eslint.config.js", "scripts/**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
    },
  },

  // Prettier als laatste: schakelt alle opmaakregels uit die met de formatter botsen.
  prettier,
);
