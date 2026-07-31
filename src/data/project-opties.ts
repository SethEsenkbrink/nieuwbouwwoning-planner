import type { Garantiewaarborg, OpleverStatus } from "@/types/model";

/**
 * Keuzelijsten die op meer dan één scherm voorkomen: in de wizard bij het
 * aanmaken, en op de projectinstellingen bij het bijstellen. Eén bron, zodat de
 * toelichting bij "aangezegd" op beide plekken hetzelfde zegt.
 */

export const WAARBORGOPTIES = [
  { waarde: "woningborg", label: "Woningborg" },
  { waarde: "swk", label: "SWK" },
  { waarde: "geen", label: "Geen garantiewaarborg" },
  { waarde: "anders", label: "Anders" },
] as const satisfies readonly { waarde: Garantiewaarborg; label: string }[];

export const OPLEVERSTATUSOPTIES = [
  {
    waarde: "indicatief",
    label: "Indicatief — een schatting",
    toelichting:
      "Zoiets als “ergens in week 45”. Boek nog niemand definitief; partijen met een lange " +
      "aanlooptijd wil je wel alvast op de hoogte houden.",
  },
  {
    waarde: "bandbreedte",
    label: "Bandbreedte — tussen twee datums",
    toelichting:
      "Je weet de vroegste en de laatste datum. De app rekent met alle drie de datums, zodat " +
      "je ziet hoe breed het nog is.",
  },
  {
    waarde: "aangezegd",
    label: "Aangezegd — formeel vastgelegd",
    toelichting:
      "De aannemer heeft de datum officieel aangezegd. Nu pas kun je iedereen definitief " +
      "inplannen.",
  },
] as const satisfies readonly { waarde: OpleverStatus; label: string; toelichting: string }[];
