import { defineConfig } from "vitest/config";

/**
 * Eigen configuratie voor de security-rules tests.
 *
 * Waarom apart: deze tests praten met een draaiende Firestore-emulator, die
 * JDK 21+ vereist. Zaten ze in de gewone testrun, dan zou `npm run verify`
 * falen op elke machine zonder Java — inclusief CI.
 *
 * Draaien:  npm run rules:test
 * Dat start de emulator, draait deze config, en sluit de emulator weer af.
 *
 * Bewust minimaal: geen Vite-plugins en geen alias, want de rules-tests
 * importeren niets uit `src/`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["firebase/**/*.test.ts"],
  },
});
