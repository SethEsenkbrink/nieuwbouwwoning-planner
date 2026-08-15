/**
 * Vertaalt lokale IndexedDB/OPFS opslagfoutcodes naar begrijpelijk Nederlands.
 */
export function opslagFoutmelding(fout: unknown, handeling = "De actie"): string {
  if (fout instanceof Error) {
    if (fout.name === "QuotaExceededError") {
      return "Onvoldoende schijfruimte op dit apparaat om de gegevens op te slaan.";
    }
    if (fout.name === "NotFoundError") {
      return "Het bestand of record is niet meer gevonden.";
    }
    return `${handeling} is niet gelukt: ${fout.message}`;
  }
  return `${handeling} is niet gelukt. Probeer het opnieuw.`;
}

/** Of het zin heeft om het gewoon nog eens te proberen. */
export function isTijdelijk(_fout: unknown): boolean {
  return false;
}
