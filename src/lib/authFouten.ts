/**
 * Vertaalt kluis- en authenticatiefoutcodes naar begrijpelijk Nederlands.
 */
export function authFoutmelding(fout: unknown): string {
  if (fout instanceof Error) {
    return fout.message;
  }
  return "Er ging iets onverwachts mis bij het ontgrendelen van de kluis.";
}
