/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De navigatiestructuur
 *
 * Elf losse links naast elkaar werd onleesbaar zodra de app compleet was. Ze
 * staan nu in vijf groepen, gekozen naar wat de gebruiker aan het doen is en
 * niet naar hoe het datamodel in elkaar zit:
 *
 *   Dashboard    waar moet ik nú iets mee
 *   Planning     wanneer gebeurt wat, en wie moet dat weten
 *   Geld         wat kost het en wat is er betaald
 *   Oplevering   de sleutel en alles wat daarna komt
 *   Project      de gegevens eronder
 *
 * De volgorde volgt het traject: eerst plannen, dan betalen, dan opleveren.
 *
 * DE GROEP ZELF IS OOK EEN LINK. Klikken op "Geld" brengt je naar het eerste
 * item van die groep in plaats van een menu te openen dat je nog een tweede
 * klik kost. Een uitklapmenu voegt hier niets toe: er zijn hooguit vier
 * subitems en die passen gewoon op een tweede regel.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Navitem {
  pad: string;
  label: string;
}

export interface Navgroep {
  sleutel: string;
  label: string;
  /** Waar je heen gaat als je op de groep zelf klikt. */
  pad: string;
  /** Leeg bij een groep die uit één scherm bestaat; dan volgt er geen tweede regel. */
  items: readonly Navitem[];
}

export const NAVIGATIE: readonly Navgroep[] = [
  { sleutel: "dashboard", label: "Dashboard", pad: "/", items: [] },
  {
    sleutel: "planning",
    label: "Planning",
    pad: "/tijdlijn",
    items: [
      { pad: "/tijdlijn", label: "Tijdlijn" },
      { pad: "/ankers", label: "Bouwmomenten" },
      { pad: "/afspraken", label: "Afspraken" },
      { pad: "/betrokkenen", label: "Betrokkenen" },
    ],
  },
  {
    sleutel: "geld",
    label: "Geld",
    pad: "/meerwerk",
    items: [
      { pad: "/meerwerk", label: "Meerwerk" },
      { pad: "/bouwdepot", label: "Bouwdepot" },
      { pad: "/na-oplevering", label: "Na oplevering" },
    ],
  },
  {
    sleutel: "oplevering",
    label: "Oplevering",
    pad: "/oplevering",
    items: [
      { pad: "/oplevering", label: "Opleverpunten" },
      // De sleuteloverdracht is de omslag naar het woningdossier (ADR-0010).
      // Deze twee staan hier en niet onder Project, omdat het dossier bij het
      // einde van het bouwtraject begint en niet bij de projectgegevens.
      { pad: "/woning", label: "De woning" },
      { pad: "/onderdelen", label: "Onderdelen" },
    ],
  },
  { sleutel: "project", label: "Project", pad: "/project", items: [] },
];

/**
 * Bij welke groep hoort dit pad.
 *
 * De langste treffer wint, zodat `/project/nieuw` bij Project uitkomt en niet
 * bij Dashboard — `/` is immers een prefix van alles. Dat ene detail is de
 * reden dat deze functie bestaat en niet in het component staat: hij is stil
 * fout te krijgen en makkelijk te testen.
 */
export function actieveGroep(pad: string): string | null {
  if (pad === "/") return "dashboard";

  let beste: { sleutel: string; lengte: number } | null = null;

  for (const groep of NAVIGATIE) {
    const paden = groep.items.length > 0 ? groep.items.map((i) => i.pad) : [groep.pad];
    for (const kandidaat of paden) {
      if (kandidaat === "/") continue;
      if (pad === kandidaat || pad.startsWith(`${kandidaat}/`)) {
        if (!beste || kandidaat.length > beste.lengte) {
          beste = { sleutel: groep.sleutel, lengte: kandidaat.length };
        }
      }
    }
  }

  return beste?.sleutel ?? null;
}

/** Het exacte item binnen een groep, voor de tweede regel. `null` buiten de groepen. */
export function actiefItem(pad: string): string | null {
  let beste: string | null = null;

  for (const groep of NAVIGATIE) {
    for (const item of groep.items) {
      if (pad === item.pad || pad.startsWith(`${item.pad}/`)) {
        if (beste === null || item.pad.length > beste.length) beste = item.pad;
      }
    }
  }

  return beste;
}

/** De groep die bij een sleutel hoort — handig voor de tweede regel. */
export function groepVan(sleutel: string | null): Navgroep | undefined {
  return NAVIGATIE.find((g) => g.sleutel === sleutel);
}
