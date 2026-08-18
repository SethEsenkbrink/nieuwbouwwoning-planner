import { evalueerEnergieRegels } from "./energie";
import { evalueerFinancieleRegels } from "./financieel";
import { evalueerGarantieRegels } from "./garanties";
import { evalueerOnderhoudRegels } from "./onderhoud";
import { evalueerTermijnRegels } from "./termijnen";
import {
  MAX_ZICHTBARE_SIGNALEN,
  type RegelCategorie,
  type RegelContext,
  type RegelResultaat,
  type SignaalNiveau,
  type SignaalStatus,
} from "./types";

const NIVEAU_PRIORITEIT: Record<SignaalNiveau, number> = {
  urgent: 4,
  waarschuwing: 3,
  attentie: 2,
  info: 1,
};

/**
 * Versie per regel.
 *
 * Verhoog het nummer zodra een regel inhoudelijk iets anders gaat zeggen. De
 * versie gaat mee in de invoerhash, dus een verhoging laat weggeklikte
 * signalen van die regel opnieuw verschijnen — precies wat je wilt als de
 * regel voortaan iets anders betekent.
 */
export const REGELVERSIES: Record<string, number> = {
  "T-001": 1,
  "T-002": 1,
  "T-003": 1,
  "T-004": 1,
  "F-001": 1,
  "F-002": 1,
  "F-003": 1,
  "G-001": 1,
  "G-002": 1,
  "O-001": 1,
  "O-002": 1,
  "E-001": 1,
  "E-002": 1,
};

/**
 * Stabiele hash over de invoerwaarden van een signaal.
 *
 * Bewust geen crypto: dit is geen geheim, het moet alleen deterministisch zijn
 * en goedkoop. De sleutels worden gesorteerd zodat de volgorde waarin een regel
 * zijn waarden opschrijft de hash niet verandert — anders zou een onschuldige
 * herordening elk weggeklikt signaal terugbrengen.
 */
export function berekenInvoerHash(resultaat: RegelResultaat): string {
  const versie = resultaat.versie ?? REGELVERSIES[resultaat.regelId] ?? 0;
  const waarden = resultaat.invoerwaarden ?? {};

  const genormaliseerd = Object.keys(waarden)
    .sort()
    .map((sleutel) => `${sleutel}=${String(waarden[sleutel])}`)
    .join("|");

  const basis = `${resultaat.regelId}@${String(versie)}#${resultaat.id}#${genormaliseerd}`;

  // FNV-1a, 32-bit. Kort, snel en genoeg om wijzigingen te onderscheiden.
  let hash = 0x811c9dc5;
  for (let i = 0; i < basis.length; i++) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Wat de motor over een eerder gezien signaal moet weten. */
export interface SignaalToestand {
  regelId: string;
  signaalId: string;
  status: SignaalStatus;
  /** De hash zoals die was toen de gebruiker het signaal wegklikte. */
  invoerHash: string;
  /** Tot wanneer gesnoozed, als ISO-datum. */
  snoozeTot?: string;
}

export interface EvaluatieOpties {
  /** Uitgeschakelde categorieën uit de instellingen (B6.9). */
  uitgeschakeldeCategorieen?: readonly RegelCategorie[];
  /** Eerder weggeklikte of gesnoozede signalen. */
  toestanden?: readonly SignaalToestand[];
  /** Peildatum voor snooze. Injecteerbaar zodat dit testbaar is. */
  nu?: Date;
  /** Maximum aantal zichtbare signalen. Standaard drie (B6.8). */
  maximum?: number;
}

/**
 * Evalueert alle regels deterministisch over de verstrekte context.
 *
 * Pure functie: geen netwerk, geen opslag, geen side effects. Alles wat de
 * motor over eerdere gebruikersacties moet weten komt via `opties.toestanden`
 * binnen, zodat hij zelf niets hoeft op te zoeken.
 */
export function evalueerRegels(
  context: RegelContext,
  opties: EvaluatieOpties = {},
): RegelResultaat[] {
  const uitgeschakeld = new Set(opties.uitgeschakeldeCategorieen ?? []);
  const nu = opties.nu ?? new Date();
  const maximum = opties.maximum ?? MAX_ZICHTBARE_SIGNALEN;

  const alleSignalen: RegelResultaat[] = [
    ...evalueerTermijnRegels(context),
    ...evalueerFinancieleRegels(context),
    ...evalueerGarantieRegels(context),
    ...evalueerOnderhoudRegels(context),
    ...evalueerEnergieRegels(context, context.meterstanden),
  ];

  // Stempel versie en hash. Dit gebeurt centraal zodat een regel het niet kan
  // vergeten, en zodat een versieverhoging op één plek doorwerkt.
  const gestempeld = alleSignalen.map((signaal) => {
    const metVersie: RegelResultaat = {
      ...signaal,
      versie: signaal.versie ?? REGELVERSIES[signaal.regelId] ?? 0,
    };
    return { ...metVersie, invoerHash: berekenInvoerHash(metVersie) };
  });

  const toestandPerSignaal = new Map(
    (opties.toestanden ?? []).map((t) => [t.signaalId, t] as const),
  );

  const zichtbaar = gestempeld.filter((signaal) => {
    if (uitgeschakeld.has(signaal.categorie)) return false;

    const toestand = toestandPerSignaal.get(signaal.id);
    if (!toestand) return true;

    // Wijzigde de onderliggende invoer, dan is dit feitelijk een nieuw signaal
    // en mag het terugkomen, ongeacht wat de gebruiker er eerder mee deed.
    if (toestand.invoerHash !== signaal.invoerHash) return true;

    if (toestand.status === "genegeerd" || toestand.status === "geaccepteerd") return false;

    if (toestand.status === "gesnoozed") {
      if (!toestand.snoozeTot) return false;
      return new Date(toestand.snoozeTot).getTime() <= nu.getTime();
    }

    return true;
  });

  zichtbaar.sort((a, b) => {
    const scoreA = NIVEAU_PRIORITEIT[a.niveau];
    const scoreB = NIVEAU_PRIORITEIT[b.niveau];
    if (scoreA !== scoreB) return scoreB - scoreA;

    if (a.deadlineDatum && b.deadlineDatum) {
      return a.deadlineDatum.localeCompare(b.deadlineDatum);
    }
    if (a.deadlineDatum) return -1;
    if (b.deadlineDatum) return 1;
    return a.titel.localeCompare(b.titel);
  });

  // Begrenzen gebeurt ná het sorteren, zodat de drie zwaarste overblijven en
  // niet de eerste drie die toevallig uit de regels rolden (B6.8).
  return zichtbaar.slice(0, maximum);
}

/**
 * Alle signalen zonder filtering of begrenzing.
 *
 * Voor overzichten waar je wél alles wilt zien, en voor de diagnostiek.
 */
export function evalueerAlleRegels(context: RegelContext): RegelResultaat[] {
  return evalueerRegels(context, { maximum: Number.MAX_SAFE_INTEGER });
}
