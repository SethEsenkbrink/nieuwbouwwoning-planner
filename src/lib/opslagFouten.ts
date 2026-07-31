import { FirebaseError } from "firebase/app";

/**
 * Vertaalt Firestore-foutcodes naar begrijpelijk Nederlands.
 *
 * Tot nu toe gaf elke mislukte schrijfactie dezelfde zin: "Opslaan is niet
 * gelukt." Dat is onbruikbaar, want de drie meest voorkomende oorzaken vragen
 * om drie verschillende dingen van de gebruiker:
 *
 *   - **offline** → wachten en opnieuw proberen; er is niets stuk
 *   - **permission-denied** → de invoer voldoet niet aan de rules, opnieuw
 *     proberen helpt niet
 *   - **iets anders** → melden, met de code erbij zodat er iets te zoeken valt
 *
 * `permission-denied` verdient toelichting. In deze app betekent die code zelden
 * "je mag hier niet komen" — alles staat onder je eigen `users/{uid}`. Vrijwel
 * altijd betekent het dat een veld niet door de validatie in `firestore.rules`
 * kwam: een te lange tekst, een getal buiten het bereik, een enum-waarde die de
 * rules niet kennen. Firestore geeft daar geen detail over, dus de melding
 * stuurt de gebruiker naar wat hij zelf kan controleren.
 */
const MELDINGEN: Record<string, string> = {
  "permission-denied":
    "Deze gegevens zijn geweigerd. Controleer of alle velden binnen de toegestane " +
    "lengtes en waarden vallen — opnieuw proberen met dezelfde invoer helpt niet.",
  unavailable: "Geen verbinding met de database. Controleer je internet en probeer het opnieuw.",
  "deadline-exceeded": "Het duurde te lang. Probeer het zo nog eens.",
  "resource-exhausted": "De limiet van de gratis Firebase-laag is bereikt. Probeer het later.",
  unauthenticated: "Je sessie is verlopen. Log opnieuw in.",
  "not-found": "Dit item bestaat niet meer. Ververs de pagina.",
  "already-exists": "Dit item bestaat al.",
  cancelled: "De actie is afgebroken.",
  "invalid-argument": "Een van de waarden klopt niet. Controleer je invoer.",
};

/**
 * @param handeling Wat er mislukte, in de vorm "Opslaan" of "Verwijderen".
 *   Wordt gebruikt als het om een onbekende fout gaat.
 */
export function opslagFoutmelding(fout: unknown, handeling = "De actie"): string {
  if (fout instanceof FirebaseError) {
    const melding = MELDINGEN[fout.code];
    if (melding) return melding;
    return `${handeling} is niet gelukt (${fout.code}). Probeer het opnieuw.`;
  }
  return `${handeling} is niet gelukt. Probeer het opnieuw.`;
}

/** Of het zin heeft om het gewoon nog eens te proberen. */
export function isTijdelijk(fout: unknown): boolean {
  return (
    fout instanceof FirebaseError &&
    ["unavailable", "deadline-exceeded", "cancelled", "internal", "aborted"].includes(fout.code)
  );
}
