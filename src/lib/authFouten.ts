import { FirebaseError } from "firebase/app";

/**
 * Vertaalt Firebase Auth-foutcodes naar begrijpelijk Nederlands.
 *
 * Firebase geeft standaard dingen als "Firebase: Error (auth/invalid-credential)".
 * Dat is voor een eindgebruiker onbruikbaar.
 *
 * Let op de bewuste vaagheid bij inlogfouten: we onderscheiden niet tussen
 * "e-mailadres bestaat niet" en "wachtwoord klopt niet". Dat verschil verklappen
 * aan een aanvaller wélke accounts bestaan (user enumeration).
 */
const MELDINGEN: Record<string, string> = {
  "auth/invalid-email": "Dit e-mailadres klopt niet.",
  "auth/missing-password": "Vul een wachtwoord in.",
  "auth/weak-password": "Kies een wachtwoord van minimaal 8 tekens.",
  "auth/email-already-in-use": "Er bestaat al een account met dit e-mailadres.",

  // Bewust identiek — zie toelichting hierboven.
  "auth/invalid-credential": "E-mailadres of wachtwoord klopt niet.",
  "auth/wrong-password": "E-mailadres of wachtwoord klopt niet.",
  "auth/user-not-found": "E-mailadres of wachtwoord klopt niet.",

  "auth/user-disabled": "Dit account is geblokkeerd.",
  "auth/too-many-requests": "Te veel pogingen. Probeer het over een paar minuten opnieuw.",
  "auth/network-request-failed": "Geen verbinding. Controleer je internetverbinding.",
  "auth/requires-recent-login": "Log opnieuw in om deze wijziging door te voeren.",
  "auth/operation-not-allowed":
    "Deze inlogmethode staat uit in Firebase. Zet e-mail/wachtwoord aan onder Authentication → Sign-in method.",
};

export function authFoutmelding(fout: unknown): string {
  if (fout instanceof FirebaseError) {
    return MELDINGEN[fout.code] ?? `Er ging iets mis (${fout.code}).`;
  }
  if (fout instanceof Error) {
    return fout.message;
  }
  return "Er ging iets onverwachts mis. Probeer het opnieuw.";
}
