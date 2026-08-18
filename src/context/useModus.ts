import { useEffect, useState } from "react";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Actieve modus — desktop of mobiel
 *
 * ADR-0026 verdeelt de app in twee rollen: de desktop is het werkblad waar je
 * het dossier beheert, de telefoon is de zaklamp waarmee je in het veld snel
 * iets vastlegt. Dat onderscheid moet onmiskenbaar zichtbaar zijn (B8.1), en
 * op mobiel mag er buiten quick-capture niets bewerkt worden (B8.2).
 *
 * De grens ligt op 768 px, gelijk aan de `md`-breakpoint van de huisstijl, en
 * wordt via `matchMedia` bijgehouden. Draaien van een tablet verandert de
 * modus dus meteen, zonder herladen — anders zou iemand na het kantelen in een
 * modus zitten waarvan de UI iets anders beweert.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type Modus = "desktop" | "mobiel";

/** Paden waarop bewerken óók op mobiel is toegestaan. */
export const QUICK_CAPTURE_PADEN = ["/snel"] as const;

const MOBIEL_QUERY = "(max-width: 767px)";

export function useModus(): Modus {
  const [modus, setModus] = useState<Modus>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return "desktop";
    return window.matchMedia(MOBIEL_QUERY).matches ? "mobiel" : "desktop";
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const query = window.matchMedia(MOBIEL_QUERY);
    const opWijziging = (e: MediaQueryListEvent) => {
      setModus(e.matches ? "mobiel" : "desktop");
    };

    query.addEventListener("change", opWijziging);
    return () => {
      query.removeEventListener("change", opWijziging);
    };
  }, []);

  return modus;
}

/**
 * Of er op dit pad in deze modus bewerkt mag worden.
 *
 * Puur, zodat het zonder DOM te testen is — de regel zelf is belangrijker dan
 * de plek waar hij toevallig wordt toegepast.
 */
export function magBewerken(modus: Modus, pad: string): boolean {
  if (modus === "desktop") return true;
  return QUICK_CAPTURE_PADEN.some((toegestaan) => pad === toegestaan || pad.startsWith(`${toegestaan}/`));
}
