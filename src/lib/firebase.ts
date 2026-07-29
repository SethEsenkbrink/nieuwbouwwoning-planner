import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

/**
 * Firebase-initialisatie — Nieuwbouwplanner
 *
 * ⚠  Hier wordt BEWUST alleen Auth en Firestore geïnitialiseerd.
 *    Firebase Storage wordt in dit project nooit gebruikt: documenten worden
 *    client-side gelezen en nooit opgeslagen (docs/decisions/ADR-0005).
 *    ESLint blokkeert het importeren van 'firebase/storage'.
 *
 * De config hieronder is publiek — hij staat in de JS-bundle en dat is bij
 * Firebase correct. De beveiliging zit volledig in firebase/firestore.rules.
 */

const REQUIRED = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

/**
 * Faalt hard bij ontbrekende configuratie in plaats van pas bij de eerste
 * Firebase-call met een onbegrijpelijke foutmelding. Scheelt bij elke nieuwe
 * omgeving een half uur zoeken.
 */
function readConfig() {
  const env = import.meta.env;
  const ontbreekt = REQUIRED.filter((key) => {
    const value = env[key];
    return typeof value !== "string" || value.trim() === "";
  });

  if (ontbreekt.length > 0) {
    throw new Error(
      `Firebase-configuratie onvolledig. Ontbrekende variabelen:\n` +
        ontbreekt.map((k) => `  - ${k}`).join("\n") +
        `\n\nKopieer .env.example naar .env.local en vul de waarden in.\n` +
        `Zie docs/2026-07-29-setup-checklist.md.`,
    );
  }

  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    ...(env.VITE_FIREBASE_MESSAGING_SENDER_ID
      ? { messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID }
      : {}),
    // storageBucket ontbreekt hier met opzet — zie ADR-0005.
  };
}

export const app: FirebaseApp = initializeApp(readConfig());
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

/**
 * Lokale emulator. Handig bij het testen van security rules zonder het echte
 * project te raken. Aanzetten met VITE_USE_FIREBASE_EMULATOR=true in .env.local
 * en `firebase emulators:start` in een tweede terminal.
 */
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  console.warn("Firebase draait tegen de LOKALE EMULATOR — dit is niet je echte data.");
}

/**
 * ── Plek voor Firebase App Check (nog niet aan) ──────────────────────────
 *
 * App Check verifieert dat requests van deze app komen en niet van een script
 * dat de publieke config uit de bundle heeft geplukt. Bewust uitgesteld tot
 * vlak vóór de eerste publieke launch — zie docs/decisions/ADR-0006.
 *
 * Zodra het zover is, hier invoegen (vóór het eerste Firestore-gebruik):
 *
 *   import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
 *   initializeAppCheck(app, {
 *     provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
 *     isTokenAutoRefreshEnabled: true,
 *   });
 *
 * Vergeet niet App Check ook in de Firebase-console te activeren en te
 * handhaven, anders doet de clientcode niets.
 */
