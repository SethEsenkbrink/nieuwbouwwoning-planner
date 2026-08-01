import type { Metereenheid, Metersoort } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De meterbibliotheek (ADR-0015 §2)
 *
 * Per metersoort: het label, de eenheid, hoeveel decimalen erop staan, of hij
 * bij de teruglevering hoort, en waarom je hem zou bijhouden.
 *
 * DIT IS EEN VOORSTEL, GEEN KEUZELIJST. De enums `Metersoort` en
 * `Metereenheid` worden wél door de rules gevalideerd — die twee zijn eindig
 * en beheersbaar. De naam van een meter is vrij, en `overig` is er zodat een
 * tussenmeter op de warmtepomp, een laadpaal of een aparte batterijmeter niet
 * op een verouderde lijst stukloopt. Zelfde patroon als de merken in
 * `onderdelen-standaard.ts`.
 *
 * DE STROOMREGISTERS VOLGEN DE NEDERLANDSE PRAKTIJK.
 * Een aansluiting heeft ófwel één register (enkeltarief) ófwel twee
 * (normaal- en daltarief). Op de slimme meter staan ze als:
 *
 *   1.8.1 / 1.8.2   levering dal / normaal
 *   2.8.1 / 2.8.2   teruglevering dal / normaal
 *
 * Vandaar dat "enkel" en "normaal/dal" alle drie bestaan: welke je hebt, hangt
 * af van je contract en niet van je woning. Je kiest er één vorm van, niet
 * allebei — daar helpt `CONFLICTERENDE_SOORTEN` hieronder bij.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Meterdefinitie {
  soort: Metersoort;
  label: string;
  eenheid: Metereenheid;
  /**
   * Hoeveel cijfers achter de komma de meter toont. Stroom telt in hele kWh,
   * gas en water in duizendsten van een m³.
   */
  decimalen: number;
  /** Teruglevering telt op net als de rest, maar is een opbrengst geen kostenpost. */
  isTeruglevering: boolean;
  /** Waarom je deze meter zou bijhouden. Wordt als toelichting getoond. */
  waarom: string;
}

export const METERBIBLIOTHEEK = [
  {
    soort: "stroom_enkel",
    label: "Stroom (enkeltarief)",
    eenheid: "kWh",
    decimalen: 0,
    isTeruglevering: false,
    waarom:
      "Eén register voor al je stroomverbruik. Kies deze als je contract geen apart daltarief " +
      "kent — dat is bij nieuwe contracten steeds vaker het geval.",
  },
  {
    soort: "stroom_normaal",
    label: "Stroom normaaltarief (1.8.2)",
    eenheid: "kWh",
    decimalen: 0,
    isTeruglevering: false,
    waarom:
      "Het piek- of normaaltarief: doordeweeks overdag en 's avonds. Bij een dubbeltarief-" +
      "aansluiting hoort hier altijd een daltarief-register bij.",
  },
  {
    soort: "stroom_dal",
    label: "Stroom daltarief (1.8.1)",
    eenheid: "kWh",
    decimalen: 0,
    isTeruglevering: false,
    waarom:
      "'s Nachts en in het weekend. Interessant om te zien of je warmtepomp, wasmachine en " +
      "laadpaal daadwerkelijk in het goedkope venster draaien.",
  },
  {
    soort: "teruglevering_enkel",
    label: "Teruglevering (enkeltarief)",
    eenheid: "kWh",
    decimalen: 0,
    isTeruglevering: true,
    waarom:
      "Wat je zonnepanelen terugleveren aan het net, op één register. Vanaf 1 januari 2027 " +
      "vervalt de salderingsregeling en wordt teruglevering apart afgerekend — dan is dit " +
      "getal het verschil tussen wel en niet kunnen controleren wat je leverancier rekent.",
  },
  {
    soort: "teruglevering_normaal",
    label: "Teruglevering normaaltarief (2.8.2)",
    eenheid: "kWh",
    decimalen: 0,
    isTeruglevering: true,
    waarom:
      "Teruglevering overdag — bij zonnepanelen verreweg het grootste deel, want de zon " +
      "schijnt in het normaaltarief-venster.",
  },
  {
    soort: "teruglevering_dal",
    label: "Teruglevering daltarief (2.8.1)",
    eenheid: "kWh",
    decimalen: 0,
    isTeruglevering: true,
    waarom:
      "Teruglevering in het dalvenster: weekenden en zomeravonden. Staat er onverwacht veel " +
      "op, dan levert je thuisbatterij waarschijnlijk 's avonds terug.",
  },
  {
    soort: "gas",
    label: "Gas",
    eenheid: "m3",
    decimalen: 3,
    isTeruglevering: false,
    waarom:
      "Alleen als er een gasaansluiting is. Nieuwbouw is sinds 2018 standaard aardgasvrij, " +
      "dus bij een all-electric woning slaat deze meter over.",
  },
  {
    soort: "water",
    label: "Water",
    eenheid: "m3",
    decimalen: 3,
    isTeruglevering: false,
    waarom:
      "Aparte meter, aparte leverancier en een ander opnamemoment dan energie. Een " +
      "onverklaarbare stijging is vaak het eerste teken van een lekkage of een lopend toilet.",
  },
  {
    soort: "warmte",
    label: "Warmte (stadsverwarming)",
    eenheid: "GJ",
    decimalen: 3,
    isTeruglevering: false,
    waarom:
      "Bij een warmtenet in plaats van een eigen installatie. Rekent in gigajoule; het tarief " +
      "is gebonden aan het maximum dat de ACM jaarlijks vaststelt.",
  },
  {
    soort: "overig",
    label: "Eigen meter",
    eenheid: "kWh",
    decimalen: 0,
    isTeruglevering: false,
    waarom:
      "Een tussenmeter op de warmtepomp, de laadpaal of de thuisbatterij. Geef zelf een naam " +
      "en kies de eenheid — dit is precies waar je achter komt wat een apparaat écht kost.",
  },
] as const satisfies readonly Meterdefinitie[];

/** Snelle opzoeking op soort. */
export function meterdefinitieVoor(soort: Metersoort): Meterdefinitie | undefined {
  return METERBIBLIOTHEEK.find((m) => m.soort === soort);
}

/**
 * Soorten die elkaar uitsluiten. Een aansluiting is enkeltarief óf
 * dubbeltarief, nooit allebei — dan zou je hetzelfde verbruik dubbel tellen.
 *
 * Dit is een WAARSCHUWING in de UI en geen blokkade: iemand kan halverwege het
 * jaar van contract wisselen en dan tijdelijk beide reeksen hebben. De app mag
 * dat niet onmogelijk maken, wel opmerken.
 */
export const CONFLICTERENDE_SOORTEN = [
  {
    soorten: ["stroom_enkel", "stroom_normaal"],
    melding:
      "Je hebt zowel een enkeltarief- als een normaaltarief-stroommeter. Meestal is er maar " +
      "één van de twee; controleer of je niet hetzelfde verbruik dubbel telt.",
  },
  {
    soorten: ["stroom_enkel", "stroom_dal"],
    melding:
      "Een daltarief-meter naast een enkeltarief-meter komt zelden voor. Heb je dubbeltarief, " +
      "gebruik dan normaal én dal en niet de enkeltarief-meter.",
  },
  {
    soorten: ["teruglevering_enkel", "teruglevering_normaal"],
    melding:
      "Teruglevering staat zowel op enkel- als op normaaltarief. Controleer welke van de twee " +
      "registers je meter daadwerkelijk toont.",
  },
  {
    soorten: ["teruglevering_enkel", "teruglevering_dal"],
    melding:
      "Teruglevering staat zowel op enkel- als op daltarief. Bij dubbeltarief gebruik je " +
      "normaal én dal, niet het enkeltarief-register.",
  },
] as const satisfies readonly { soorten: readonly Metersoort[]; melding: string }[];

/**
 * De eenheden als keuzelijst, met wat erin telt. Alleen zichtbaar bij
 * `soort: "overig"` — bij de andere soorten staat de eenheid vast en zou een
 * keuze alleen maar fouten uitnodigen.
 */
export const METEREENHEIDOPTIES = [
  { waarde: "kWh", label: "kWh — elektriciteit" },
  { waarde: "m3", label: "m³ — gas of water" },
  { waarde: "GJ", label: "GJ — warmte" },
] as const satisfies readonly { waarde: Metereenheid; label: string }[];

/**
 * Hoe lang een opname "vers" is. Na deze termijn zet het dashboard de meter op
 * de lijst.
 *
 * 35 dagen en niet 30: wie maandelijks noteert doet dat niet op de dag af, en
 * een herinnering die drie dagen na je vaste opnamemoment al aanslaat, leert
 * mensen hem te negeren. Dezelfde afweging als bij de aanlooptijden — liever
 * iets te laat dan structureel vals alarm.
 */
export const OPNAME_VERS_DAGEN = 35;
