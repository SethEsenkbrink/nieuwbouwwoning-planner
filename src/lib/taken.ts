import { verschilInDagen } from "@/lib/planning";
import type { TaakMetId } from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Taken sorteren en op urgentie zetten
 *
 * Puur, net als `planning.ts`: geen opslaglaag, geen React, en `vandaag` komt
 * als parameter binnen zodat de tests niet van de klok afhangen.
 *
 * De sorteervolgorde is een keuze, geen toeval. Een takenlijst die op
 * aanmaakdatum staat, laat de dingen die verlopen zijn onderaan verdwijnen —
 * en precies die wil je zien. Daarom: verlopen bovenaan, daarna op deadline,
 * daarna wat geen deadline heeft, en afgevinkte taken onderaan.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type TaakUrgentie = "verlopen" | "vandaag" | "binnenkort" | "later" | "geendatum" | "klaar";

/**
 * `binnenkort` is zeven dagen. Kort genoeg om te betekenen "deze week regelen",
 * lang genoeg om niet elke dag hetzelfde te roepen.
 */
const BINNENKORT_DAGEN = 7;

export function taakUrgentie(taak: TaakMetId, vandaag: Date): TaakUrgentie {
  if (taak.status === "klaar") return "klaar";
  if (!taak.deadline) return "geendatum";

  const dagen = verschilInDagen(taak.deadline, vandaag);
  if (dagen < 0) return "verlopen";
  if (dagen === 0) return "vandaag";
  if (dagen <= BINNENKORT_DAGEN) return "binnenkort";
  return "later";
}

const VOLGORDE: Record<TaakUrgentie, number> = {
  verlopen: 0,
  vandaag: 1,
  binnenkort: 2,
  later: 3,
  geendatum: 4,
  klaar: 5,
};

/** Verlopen bovenaan, afgevinkt onderaan; binnen een groep op deadline. */
export function sorteerTaken(taken: readonly TaakMetId[], vandaag: Date): TaakMetId[] {
  return [...taken].sort((a, b) => {
    const opUrgentie = VOLGORDE[taakUrgentie(a, vandaag)] - VOLGORDE[taakUrgentie(b, vandaag)];
    if (opUrgentie !== 0) return opUrgentie;

    const datumA = a.deadline?.getTime();
    const datumB = b.deadline?.getTime();
    if (datumA !== undefined && datumB !== undefined) return datumA - datumB;
    if (datumA !== undefined) return -1;
    if (datumB !== undefined) return 1;

    return a.titel.localeCompare(b.titel, "nl");
  });
}

export interface Takenstand {
  open: number;
  verlopen: number;
  dezeWeek: number;
  klaar: number;
}

export function telTaken(taken: readonly TaakMetId[], vandaag: Date): Takenstand {
  const stand: Takenstand = { open: 0, verlopen: 0, dezeWeek: 0, klaar: 0 };

  for (const taak of taken) {
    const urgentie = taakUrgentie(taak, vandaag);
    if (urgentie === "klaar") {
      stand.klaar += 1;
      continue;
    }
    stand.open += 1;
    if (urgentie === "verlopen") stand.verlopen += 1;
    if (urgentie === "vandaag" || urgentie === "binnenkort") stand.dezeWeek += 1;
  }

  return stand;
}

/** Korte tekst bij een deadline: "over 3 dagen", "vandaag", "5 dagen te laat". */
export function toonTermijn(taak: TaakMetId, vandaag: Date): string | null {
  if (!taak.deadline || taak.status === "klaar") return null;

  const dagen = verschilInDagen(taak.deadline, vandaag);
  if (dagen === 0) return "vandaag";
  if (dagen < 0) {
    const laat = Math.abs(dagen);
    return `${laat} ${laat === 1 ? "dag" : "dagen"} te laat`;
  }
  return `over ${dagen} ${dagen === 1 ? "dag" : "dagen"}`;
}
