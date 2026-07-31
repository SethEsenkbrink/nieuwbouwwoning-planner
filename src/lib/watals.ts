import {
  berekenDatum,
  laatsteGratisSchuifdatum,
  verschilInDagen,
  type AfspraakInvoer,
  type BerekendeBand,
  type BetrokkeneInvoer,
  type PlanningContext,
} from "@/lib/planning";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Wat-als — de gevolgen zien vóórdat je opslaat
 *
 * Een bouwmoment verschuiven is één klik, maar het raakt alles wat eraan hangt.
 * Tot nu toe zag je dat pas achteraf, op het dashboard. Dat is te laat voor de
 * enige vraag die er op dat moment toe doet: **kost dit geld?**
 *
 * Twee dingen worden apart geteld, want ze betekenen iets anders:
 *
 * - **Buiten de kosteloze annuleertermijn.** De partij is geboekt rond de
 *   huidige datum en de termijn om die kosteloos te verzetten is verstreken.
 *   Verschuiven kan nog steeds, maar er hangt een prijskaartje aan. Dit rekent
 *   op de OUDE datum, want dat is wat er nu bij die partij in de agenda staat.
 *
 * - **Binnen de aanlooptijd.** De nieuwe datum ligt zo dichtbij dat deze partij
 *   het meteen moet weten om het nog te halen. Geen geld, wel haast.
 *
 * Deze module is puur en kent geen Firestore: hij krijgt twee contexten — hoe
 * het nu staat en hoe het zou worden — en vergelijkt ze. Dat maakt hem
 * bruikbaar op elk scherm waar iets verschuift, en testbaar zonder emulator.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Impactregel {
  afspraakId: string;
  betrokkeneNaam: string;
  omschrijving: string;
  /** Wat er nu uit de planning volgt. `null` als er niets te rekenen valt. */
  oud: BerekendeBand | null;
  nieuw: BerekendeBand | null;
  /** Positief: de afspraak schuift naar later. */
  verschovenDagen: number;
  /**
   * De kosteloze annuleertermijn op de huidige datum is verstreken; deze
   * verschuiving kost dus geld.
   */
  kostGeld: boolean;
  /** De nieuwe datum valt binnen de aanlooptijd — ze moeten het nu weten. */
  heeftHaast: boolean;
  /** De laatste dag waarop het nog kosteloos kon of kan. */
  gratisTot?: Date;
}

export interface Impact {
  regels: Impactregel[];
  aantalGeraakt: number;
  aantalKostGeld: number;
  aantalHaast: number;
}

const LEEG: Impact = { regels: [], aantalGeraakt: 0, aantalKostGeld: 0, aantalHaast: 0 };

/**
 * Vergelijkt twee planningen en levert op wat er verandert.
 *
 * Alleen afspraken die daadwerkelijk verschuiven komen in de lijst. Een afspraak
 * die aan een ander bouwmoment hangt dan het gewijzigde blijft staan waar hij
 * stond, en hoeft de gebruiker dus niet af te leiden.
 */
export function berekenImpact(
  afspraken: readonly AfspraakInvoer[],
  betrokkenen: readonly BetrokkeneInvoer[],
  huidig: PlanningContext,
  nieuw: PlanningContext,
  vandaag: Date,
): Impact {
  const perId = new Map(betrokkenen.map((b) => [b.id, b]));
  const regels: Impactregel[] = [];

  for (const afspraak of afspraken) {
    if (afspraak.status === "afgerond" || afspraak.status === "vervallen") continue;

    const betrokkene = perId.get(afspraak.betrokkeneId);
    if (!betrokkene) continue;

    const oud = berekenDatum(afspraak.ankerType, afspraak.offsetDagen, huidig);
    const nieuwe = berekenDatum(afspraak.ankerType, afspraak.offsetDagen, nieuw);

    // Niets bekend, of er verandert niets voor deze afspraak.
    if (!nieuwe) continue;
    if (oud?.verwacht.getTime() === nieuwe.verwacht.getTime()) continue;

    const verschoven = oud ? verschilInDagen(nieuwe.verwacht, oud.verwacht) : 0;

    // De annuleertermijn rekent op de OUDE datum: dat is de afspraak die er nu
    // staat en die je zou moeten verzetten.
    const gratisTot =
      oud && betrokkene.annuleertermijnDagen > 0
        ? laatsteGratisSchuifdatum(oud, betrokkene.annuleertermijnDagen)
        : undefined;

    const kostGeld = gratisTot !== undefined && verschilInDagen(gratisTot, vandaag) < 0;
    const heeftHaast = verschilInDagen(nieuwe.verwacht, vandaag) <= betrokkene.aanlooptijdDagen;

    regels.push({
      afspraakId: afspraak.id,
      betrokkeneNaam: betrokkene.naam,
      omschrijving: afspraak.omschrijving,
      oud,
      nieuw: nieuwe,
      verschovenDagen: verschoven,
      kostGeld,
      heeftHaast,
      ...(gratisTot === undefined ? {} : { gratisTot }),
    });
  }

  // Wat geld kost bovenaan, daarna wat haast heeft, daarna de rest.
  regels.sort((a, b) => {
    const gewicht = (r: Impactregel) => (r.kostGeld ? 0 : r.heeftHaast ? 1 : 2);
    const verschil = gewicht(a) - gewicht(b);
    if (verschil !== 0) return verschil;
    return (a.nieuw?.verwacht.getTime() ?? 0) - (b.nieuw?.verwacht.getTime() ?? 0);
  });

  return {
    regels,
    aantalGeraakt: regels.length,
    aantalKostGeld: regels.filter((r) => r.kostGeld).length,
    aantalHaast: regels.filter((r) => r.heeftHaast).length,
  };
}

export const LEGE_IMPACT = LEEG;
