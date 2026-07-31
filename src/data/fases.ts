import type { FaseType } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De zeven fases van het nieuwbouwtraject, met hun aandachtspunten
 *
 * `FaseType` in `src/types/model.ts` is de canonieke lijst; dit bestand geeft
 * er de inhoud bij: wat er in die fase speelt, en waar het meestal misgaat.
 *
 * DIT IS GEEN JURIDISCH OF FINANCIEEL ADVIES (constraint C5).
 * De termijnen hieronder zijn wat gangbaar is bij nieuwbouw met een
 * Woningborg- of SWK-garantie. Ze staan er als geheugensteun, niet als norm —
 * elk contract wijkt af, en dat van de gebruiker is leidend. Daarom staat bij
 * alles wat een termijn noemt "meestal" of "vaak", en nooit een kale bewering.
 *
 * De actiepunten worden bewust NIET automatisch als taken aangemaakt. Dat zou
 * een takenlijst van vijftig regels opleveren waarvan de helft niet van
 * toepassing is, en dan vinkt niemand meer iets af. Ze staan als suggestie bij
 * de fase, met één klik om er een eigen taak van te maken.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface Actiepunt {
  titel: string;
  toelichting: string;
  /** Iets wat onomkeerbaar is of geld kost als je het mist. */
  waarschuwing?: string;
}

export interface FaseBeschrijving {
  type: FaseType;
  titel: string;
  uitleg: string;
  actiepunten: readonly Actiepunt[];
}

export const FASE_VOLGORDE: readonly FaseBeschrijving[] = [
  {
    type: "koop",
    titel: "Koop",
    uitleg:
      "De koop-/aannemingsovereenkomst tekenen. Bij nieuwbouw zijn dit er meestal twee: één " +
      "voor de grond en één voor de bouw.",
    actiepunten: [
      {
        titel: "Bedenktijd in de gaten houden",
        toelichting:
          "Bij de koop van een woning door een particulier geldt meestal een wettelijke " +
          "bedenktijd van een week na ontvangst van het getekende contract.",
        waarschuwing: "Deze termijn is kort en loopt door in het weekend. Controleer je contract.",
      },
      {
        titel: "Ontbindende voorwaarde financiering noteren",
        toelichting:
          "In het contract staat tot welke datum je nog onder de koop uit kunt als de hypotheek " +
          "niet rondkomt. Zet die datum in je planning.",
        waarschuwing:
          "Te laat inroepen betekent meestal dat je vastzit aan de koop, of een boete betaalt.",
      },
      {
        titel: "Waarborgcertificaat controleren",
        toelichting:
          "Woningborg of SWK geeft een certificaat af. Controleer of je het hebt ontvangen en " +
          "of het bouwnummer klopt.",
      },
      {
        titel: "Meerwerklijst opvragen",
        toelichting:
          "Vraag vroeg om de meerwerkopties en de bijbehorende sluitingsdata. Die data hangen " +
          "aan bouwmomenten en komen sneller dan je denkt.",
      },
    ],
  },
  {
    type: "notaris",
    titel: "Notaris",
    uitleg: "Passeren van de leveringsakte voor de grond en de hypotheekakte.",
    actiepunten: [
      {
        titel: "Conceptakte nalezen",
        toelichting:
          "Je krijgt de akte vooraf. Controleer naam, bouwnummer, kadastrale gegevens en de " +
          "bedragen.",
      },
      {
        titel: "Eigen geld op tijd overmaken",
        toelichting:
          "De notaris wil het bedrag meestal een paar dagen vóór het passeren op de derdenrekening.",
        waarschuwing: "Te laat overmaken betekent uitstel van de afspraak.",
      },
      {
        titel: "Legitimatie meenemen",
        toelichting: "Een geldig paspoort of ID-kaart, voor iedereen die tekent.",
      },
    ],
  },
  {
    type: "financiering",
    titel: "Financiering",
    uitleg: "Hypotheek rond krijgen en het bouwdepot inrichten.",
    actiepunten: [
      {
        titel: "Geldigheidsduur van de offerte noteren",
        toelichting:
          "Een hypotheekofferte is meestal een aantal maanden geldig, met een mogelijkheid tot " +
          "verlenging tegen kosten. Bij nieuwbouw die uitloopt is dat een reëel risico.",
        waarschuwing: "Verlengen kost geld en de rente kan intussen veranderd zijn.",
      },
      {
        titel: "Bouwdepot laten openen",
        toelichting:
          "Uit het bouwdepot worden de termijnfacturen van de aannemer betaald. Vraag na hoe je " +
          "declareert en hoe lang dat duurt.",
      },
      {
        titel: "Depot voor meerwerk apart houden",
        toelichting:
          "Meerwerk gaat vaak niet vanzelf uit het bouwdepot. Controleer wat er wel en niet " +
          "uit betaald mag worden.",
      },
    ],
  },
  {
    type: "bouw",
    titel: "Bouw",
    uitleg:
      "Van eerste paal tot wind- en waterdicht. Dit is de fase waarin de planning het meest " +
      "schuift — en waarin je zelf partijen moet inschakelen.",
    actiepunten: [
      {
        titel: "Meerwerk vastleggen vóór de sluitingsdatum",
        toelichting:
          "Elektra, leidingwerk en indeling moeten vastliggen voordat de betreffende fase " +
          "gebouwd wordt.",
        waarschuwing:
          "Na het storten van een vloer is het niet meer te wijzigen, of alleen tegen hoge kosten.",
      },
      {
        titel: "Termijnfacturen declareren",
        toelichting:
          "De aannemer factureert per bouwtermijn. Declareer die bij de bank en houd bij wat er " +
          "betaald is.",
      },
      {
        titel: "Bouwmomenten bijhouden",
        toelichting:
          "Noteer op /ankers wanneer de dekvloer is gestort of de ruwbouw gereed is. Je eigen " +
          "leveranciers hangen daaraan, niet aan de opleverdatum.",
      },
      {
        titel: "Kijkdagen benutten",
        toelichting:
          "Maak foto's van leidingwerk vóórdat het wordt dichtgezet. Over vijf jaar wil je weten " +
          "waar wat zit.",
      },
    ],
  },
  {
    type: "oplevering",
    titel: "Oplevering",
    uitleg: "Het moment van de sleutels, de opleverpunten en het 5%-depot.",
    actiepunten: [
      {
        titel: "Vooropname inplannen",
        toelichting:
          "Veel aannemers doen een voorschouw enkele weken vóór de oplevering. Dan kun je punten " +
          "melden die er op de dag zelf al af zijn.",
      },
      {
        titel: "Opleverpunten schriftelijk vastleggen",
        toelichting:
          "Alles wat niet klopt hoort in het proces-verbaal van oplevering, met een " +
          "hersteltermijn erbij.",
        waarschuwing: "Wat er niet in staat, is later lastiger hard te maken.",
      },
      {
        titel: "5%-opschorting overwegen",
        toelichting:
          "Bij nieuwbouw mag je meestal 5% van de aanneemsom in depot houden bij de notaris " +
          "totdat de punten hersteld zijn. Dit gaat niet vanzelf — je moet het zelf aangeven.",
        waarschuwing:
          "Er zit een termijn aan. Doe je niets, dan gaat het bedrag alsnog naar de aannemer.",
      },
      {
        titel: "Meterstanden noteren",
        toelichting: "Water, elektra en gas op de dag van oplevering. Ook voor je eigen dossier.",
      },
    ],
  },
  {
    type: "onderhoud",
    titel: "Onderhoudstermijn",
    uitleg:
      "De periode direct na oplevering waarin de aannemer verplicht is opgekomen gebreken te " +
      "herstellen. Meestal drie maanden.",
    actiepunten: [
      {
        titel: "Rondje door het huis vóór het einde",
        toelichting:
          "Krimpscheuren, klemmende deuren en afwerkfouten komen pas boven als het huis in " +
          "gebruik is. Loop kort vóór het einde van de termijn alles na.",
        waarschuwing: "Na de termijn val je terug op de garantieregeling, met strengere criteria.",
      },
      {
        titel: "Gebreken schriftelijk melden",
        toelichting: "Per mail, met foto's en datum. Bewaar de bevestiging.",
      },
      {
        titel: "5%-depot afhandelen",
        toelichting:
          "Zijn de punten hersteld, dan geef je de notaris opdracht het depot vrij te geven.",
      },
    ],
  },
  {
    type: "garantie",
    titel: "Garantie",
    uitleg:
      "De jaren daarna. Woningborg en SWK kennen verschillende termijnen per onderdeel; " +
      "constructieve gebreken hebben de langste.",
    actiepunten: [
      {
        titel: "Garantietermijnen vastleggen",
        toelichting:
          "Noteer per onderdeel wanneer de garantie afloopt — van de aannemer én van de " +
          "fabrikant. Vlak vóór het aflopen is het moment om iets te laten nakijken.",
      },
      {
        titel: "Installaties laten onderhouden",
        toelichting:
          "Bij veel fabrieksgaranties vervalt de dekking als het voorgeschreven onderhoud niet " +
          "is uitgevoerd.",
        waarschuwing: "Bewaar de onderhoudsbonnen; zonder bewijs is de garantie weinig waard.",
      },
      {
        titel: "Geschillenregeling opzoeken",
        toelichting:
          "Kom je er met de aannemer niet uit, dan kent de garantieregeling een eigen procedure. " +
          "Zoek vooraf op hoe die werkt.",
      },
    ],
  },
];

export const FASE_TITELS: Record<FaseType, string> = Object.fromEntries(
  FASE_VOLGORDE.map((f) => [f.type, f.titel]),
) as Record<FaseType, string>;

/** Volgorde-index, zodat een fase zonder `volgorde`-veld toch goed sorteert. */
export const FASE_INDEX: Record<FaseType, number> = Object.fromEntries(
  FASE_VOLGORDE.map((f, i) => [f.type, i]),
) as Record<FaseType, number>;
