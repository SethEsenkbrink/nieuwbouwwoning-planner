import type { Energielabel, WoningStatus, Woningtype } from "@/types/model";

/**
 * Keuzelijsten voor het woningdossier (ADR-0010, ADR-0013).
 *
 * Apart van `project-opties.ts` omdat ze bij de tweede fase van de app horen:
 * het bouwtraject kent ze niet, het dossier wel.
 */

export const WONINGSTATUSOPTIES = [
  {
    waarde: "in_aanbouw",
    label: "In aanbouw",
    toelichting:
      "Het huis is nog niet opgeleverd. Het dashboard toont wie er een verouderde datum heeft " +
      "en wat er nu geregeld moet worden.",
  },
  {
    waarde: "opgeleverd",
    label: "Opgeleverd — de sleutels zijn overgedragen",
    toelichting:
      "De app wordt het woningdossier: wat er in het huis zit, wanneer het onderhouden moet " +
      "worden en wat er al gedaan is. Je kunt dit altijd terugzetten.",
  },
] as const satisfies readonly { waarde: WoningStatus; label: string; toelichting: string }[];

export const WONINGTYPEOPTIES = [
  { waarde: "tussenwoning", label: "Tussenwoning" },
  { waarde: "hoekwoning", label: "Hoekwoning" },
  { waarde: "twee_onder_een_kap", label: "Twee-onder-een-kap" },
  { waarde: "vrijstaand", label: "Vrijstaand" },
  { waarde: "appartement", label: "Appartement" },
  { waarde: "benedenwoning", label: "Benedenwoning" },
  { waarde: "bovenwoning", label: "Bovenwoning" },
  { waarde: "overig", label: "Anders" },
] as const satisfies readonly { waarde: Woningtype; label: string }[];

/**
 * De labelschaal volgens NTA 8800, van zuinig naar onzuinig. Nieuwbouw die aan
 * de BENG-eisen voldoet komt doorgaans op A++++ of hoger uit; de rest van de
 * schaal staat erbij omdat het dossier ook op een bestaande woning moet passen.
 */
export const ENERGIELABELOPTIES = [
  { waarde: "A+++++", label: "A+++++" },
  { waarde: "A++++", label: "A++++" },
  { waarde: "A+++", label: "A+++" },
  { waarde: "A++", label: "A++" },
  { waarde: "A+", label: "A+" },
  { waarde: "A", label: "A" },
  { waarde: "B", label: "B" },
  { waarde: "C", label: "C" },
  { waarde: "D", label: "D" },
  { waarde: "E", label: "E" },
  { waarde: "F", label: "F" },
  { waarde: "G", label: "G" },
] as const satisfies readonly { waarde: Energielabel; label: string }[];

/** Labels voor de velden die `paspoortstand()` als ontbrekend kan teruggeven. */
export const PASPOORTVELDLABELS: Record<string, string> = {
  adres: "adres",
  postcode: "postcode",
  plaats: "plaats",
  woningtype: "woningtype",
  bouwjaar: "bouwjaar",
  woonoppervlakte: "woonoppervlakte",
  energielabel: "energielabel",
};
