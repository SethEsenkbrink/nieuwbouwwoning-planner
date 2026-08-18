import type { ProjectMetId, WoningpaspoortData } from "@/lib/converters";
import { overMaanden } from "@/lib/oplevering";
import { verschilInDagen } from "@/lib/planning";
import type { WoningStatus } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Woning — de tweede fase van de app (ADR-0010, ADR-0013)
 *
 * Puur TypeScript, net als `planning.ts`: geen opslaglaag, geen React, geen
 * `new Date()` die niet als parameter binnenkomt. Daardoor zonder emulator te
 * testen.
 *
 * Wat hier NIET in hoort: het omzetten van `woningStatus`. Dat is een
 * schrijfactie en hoort in `lib/projecten.ts`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Een project zonder `woningStatus` is `in_aanbouw`.
 *
 * Dat is bewust de standaard en niet andersom: elk project dat vóór blok E is
 * aangemaakt mist het veld, en die zitten allemaal nog in de bouw. Zou de
 * standaard `opgeleverd` zijn, dan zou de app bij bestaande projecten ineens
 * de onderhoudslijst tonen op een woning die nog niet bestaat.
 */
export function woningStatusVan(project: Pick<ProjectMetId, "woningStatus">): WoningStatus {
  return project.woningStatus ?? "in_aanbouw";
}

export function isOpgeleverd(project: Pick<ProjectMetId, "woningStatus">): boolean {
  return woningStatusVan(project) === "opgeleverd";
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Het energielabel als aftelklok (ADR-0013 §4)
 *
 * Een energielabel is TIEN JAAR geldig vanaf de opnamedatum. Het verloopt
 * stil: zodra het verlopen is verdwijnt het uit EP-online en MijnOverheid, en
 * bij verkoop heb je een geldig label nodig.
 *
 * De einddatum wordt niet opgeslagen — die volgt uit de opnamedatum (ADR-0008).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** De wettelijke geldigheidsduur van een energielabel, in maanden. */
export const ENERGIELABEL_GELDIG_MAANDEN = 120;

/**
 * Binnen hoeveel dagen een aflopend label de aandacht verdient. Gelijkgetrokken
 * met de garantieklokken uit blok D, zodat de UI één drempel kent.
 */
const BIJNA_VERLOPEN_DAGEN = 90;

export interface Energielabelstand {
  verlooptOp: Date;
  /** Negatief betekent: het label is verlopen. */
  dagenResterend: number;
  verlopen: boolean;
  /** Verloopt binnen drie maanden. */
  bijnaVerlopen: boolean;
}

/**
 * `null` zolang de opnamedatum niet bekend is. Zonder die datum valt er niets
 * af te tellen, en een verzonnen startpunt is erger dan geen klok: het label
 * zou dan jarenlang geldig lijken terwijl niemand weet of dat klopt.
 *
 * Let op: alleen de opnamedatum telt, niet of er een label is ingevuld. Een
 * ingevuld label zonder datum is een label waarvan de houdbaarheid onbekend is.
 */
export function bepaalEnergielabelstand(
  paspoort: WoningpaspoortData | undefined,
  vandaag: Date,
): Energielabelstand | null {
  const opname = paspoort?.energielabelOpnameDatum;
  if (!opname) return null;

  const verlooptOp = overMaanden(opname, ENERGIELABEL_GELDIG_MAANDEN);
  const dagenResterend = verschilInDagen(verlooptOp, vandaag);

  return {
    verlooptOp,
    dagenResterend,
    verlopen: dagenResterend < 0,
    bijnaVerlopen: dagenResterend >= 0 && dagenResterend <= BIJNA_VERLOPEN_DAGEN,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Volledigheid van het paspoort
 *
 * Niet om de gebruiker aan te sporen alles in te vullen — een half paspoort is
 * prima. Het is er om te bepalen of het scherm een lege staat toont of een
 * ingevuld dossier, en om te laten zien wat er nog ontbreekt op het moment dat
 * iemand het dossier wil overdragen (E8).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * De velden die het dossier bruikbaar maken voor een derde: een makelaar, een
 * koper of een monteur. Notaris en hypotheekverstrekker staan er bewust niet
 * bij — die zijn nuttig voor jezelf maar niet nodig om de wóning te kennen.
 */
const KERNVELDEN = [
  "adres",
  "postcode",
  "plaats",
  "woningtype",
  "bouwjaar",
  "woonoppervlakte",
  "energielabel",
] as const satisfies readonly (keyof WoningpaspoortData)[];

export interface Paspoortstand {
  ingevuld: number;
  totaal: number;
  /** Welke kernvelden nog leeg zijn, in de volgorde van het formulier. */
  ontbreekt: readonly (keyof WoningpaspoortData)[];
  leeg: boolean;
}

export function paspoortstand(paspoort: WoningpaspoortData | undefined): Paspoortstand {
  const ontbreekt = KERNVELDEN.filter((veld) => paspoort?.[veld] === undefined);

  return {
    ingevuld: KERNVELDEN.length - ontbreekt.length,
    totaal: KERNVELDEN.length,
    ontbreekt,
    leeg: paspoort === undefined || Object.keys(paspoort).length === 0,
  };
}

/**
 * Het adres in één regel, zoals je het op een envelop schrijft. Leeg zolang er
 * geen straat is: "1234 AB Almere" zonder straatnaam oogt als een fout.
 */
export function adresregel(paspoort: WoningpaspoortData | undefined): string | null {
  if (!paspoort?.adres) return null;

  const plaatsregel = [paspoort.postcode, paspoort.plaats].filter(Boolean).join(" ");
  return plaatsregel ? `${paspoort.adres}, ${plaatsregel}` : paspoort.adres;
}
