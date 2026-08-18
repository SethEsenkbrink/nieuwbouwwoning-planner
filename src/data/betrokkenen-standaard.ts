import type { AnkerType, Betrokkene, BetrokkeneCategorie, Communicatieregel } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Standaardbibliotheek betrokkenen
 *
 * Typed versie van docs/archief/2026-07-29-betrokkenen-standaardlijst.md. Bij het
 * aanmaken van een project vinkt de gebruiker hieruit aan wat van toepassing
 * is; de app maakt de betrokkenen aan met deze startwaarden.
 *
 * ─── DEZE GETALLEN ZIJN GEEN FEITEN ───────────────────────────────────────
 * Ze komen uit gangbare praktijk, niet uit een normdocument. Toon ze in de UI
 * altijd als voorstel, nooit als vaststaand (PROJECT.md §3, constraint C5: de
 * tool structureert, hij adviseert niet). Elke betrokkene die hieruit ontstaat
 * krijgt `waardenBron: "voorstel"`; zodra de gebruiker een waarde aanpast gaat
 * dat veld naar "eigen" en verdwijnt de disclaimer (ADR-0009).
 *
 * ─── TWEE CONVENTIES DIE HIER ZIJN VASTGELEGD ─────────────────────────────
 *
 * 1. ÉÉN PAAR WAARDEN PER PARTIJ, DE VOORZICHTIGE KANT.
 *    Aanlooptijd en annuleertermijn staan op de betrokkene, niet op de
 *    afspraak. Heeft een partij meerdere afspraken met verschillende termijnen
 *    (de keukenleverancier meet in met 14 dagen aanloop, maar levert met 70),
 *    dan staat hier de LANGSTE van de twee.
 *
 *    Gevolg dat je moet kennen: het inmeten wordt daardoor eerder als urgent
 *    gemarkeerd dan strikt nodig. Dat is de bewuste ruil — te vroeg
 *    waarschuwen kost aandacht, te laat waarschuwen kost een afspraak.
 *    Wil de gebruiker het scherper, dan past hij de waarde per partij aan.
 *
 * 2. BIJ EEN RANGE DE BOVENKANT.
 *    De bronlijst noemt bereiken ("56–70 dagen"). Hier staat steeds het
 *    hoogste getal. Zelfde redenering: je informeert liever te vroeg.
 *
 * `annuleertermijnDagen: 0` betekent "niet van toepassing" — bij een notaris
 * of een gemeente valt niets te annuleren. Nul is dan eerlijker dan een
 * verzonnen getal, en het model staat geen leeg veld toe omdat de
 * urgentiebepaling erop rekent.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Een afspraak zoals de bibliotheek hem voorstelt: anker + offset, nooit een datum. */
export interface StandaardAfspraak {
  omschrijving: string;
  ankerType: AnkerType;
  /** Negatief = vóór het anker. */
  offsetDagen: number;
  /**
   * Waarschuwing die zichtbaar moet worden zodra deze afspraak relevant wordt.
   * Waarschuwingen horen bij de data, niet in een handleiding die niemand
   * leest (uitgangspunt 3 van de standaardlijst).
   */
  waarschuwing?: string;
}

export interface StandaardBetrokkene {
  /** Stabiele sleutel voor de aanvinklijst. Verandert nooit; de naam mag dat wel. */
  sleutel: string;
  naam: string;
  categorie: BetrokkeneCategorie;
  aanlooptijdDagen: number;
  annuleertermijnDagen: number;
  communicatieregel: Communicatieregel;
  afspraken: StandaardAfspraak[];
  /** Achtergrond die de gebruiker helpt kiezen. Niet hetzelfde als een waarschuwing. */
  toelichting?: string;
}

// ── Waarschuwingsteksten ───────────────────────────────────────────────────
// Apart gehouden omdat sommige bij meerdere afspraken horen, en omdat ze zo in
// één oogopslag te reviewen zijn.

const WAARSCHUWING_DROOGTIJD =
  "Een cementdekvloer heeft ruwweg een week droogtijd per centimeter — bij 5 tot 7 cm " +
  "kom je op vijf tot zeven weken. Te vroeg leggen geeft vocht onder de afwerking. " +
  "Laat de vloerenlegger een vochtmeting doen; die meting is leidend, niet deze offset.";

const WAARSCHUWING_WEGWERKEN =
  "Alles wat achter wanden of vloeren wegwerkt, moet vóór het dichtmaken gebeuren. " +
  "Mis je dit moment, dan blijft alleen hakken of opbouw over.";

const WAARSCHUWING_OPZEGGEN =
  "Opzeggen is onomkeerbaar en de termijn start meestal op de eerste van de maand: " +
  "zeg je 2 september op met een maand opzegtermijn, dan loop je vaak tot en met " +
  "31 oktober. Te vroeg opzeggen betekent dubbele woonlasten óf geen dak; te laat " +
  "betekent alleen dubbele woonlasten. Bij een indicatieve opleverdatum is te laat " +
  "het goedkopere risico.";

const WAARSCHUWING_OPSTAL =
  "De opstalverzekering moet ingaan op de dag van oplevering — vanaf dat moment draag " +
  "jij het risico. Te vroeg regelen kost niets, te laat kan alles kosten.";

const WAARSCHUWING_OFFERTE =
  "Een hypotheekofferte heeft een geldigheidsduur. Schuift de oplevering ver door, dan " +
  "kan de offerte verlopen en moet je verlengen — vaak tegen kosten, en bij gestegen " +
  "rente mogelijk tegen slechtere voorwaarden. Bij elke verschuiving is dit de eerste " +
  "vraag die je moet stellen.";

const WAARSCHUWING_KEURING =
  "Een bouwkundig keurder is meestal weken vooruit geboekt en loopt mee tijdens de " +
  "oplevering zelf. Te laat boeken betekent zonder deskundige de opleverpunten " +
  "vaststellen — terwijl juist die lijst bepaalt wat er hersteld moet worden en of je " +
  "het 5%-opschortingsrecht goed inzet.";

// ── De bibliotheek ─────────────────────────────────────────────────────────

export const STANDAARD_BETROKKENEN: readonly StandaardBetrokkene[] = [
  // ── Installatie en techniek ──────────────────────────────────────────────
  {
    sleutel: "keukenleverancier",
    naam: "Keukenleverancier",
    categorie: "installatie",
    aanlooptijdDagen: 70, // levering; inmeten zou 14 zijn
    annuleertermijnDagen: 21,
    communicatieregel: "direct",
    afspraken: [
      { omschrijving: "Inmeten", ankerType: "ruwbouw_gereed", offsetDagen: 0 },
      { omschrijving: "Levering en montage", ankerType: "oplevering", offsetDagen: 7 },
    ],
    toelichting:
      "Inmeten kan pas als de wanden staan — daarom aan de ruwbouw, niet aan de oplevering.",
  },
  {
    sleutel: "sanitair-tegelzetter",
    naam: "Sanitair / tegelzetter",
    categorie: "installatie",
    aanlooptijdDagen: 28,
    annuleertermijnDagen: 14,
    communicatieregel: "direct",
    afspraken: [
      { omschrijving: "Inmeten", ankerType: "wind_waterdicht", offsetDagen: 0 },
      { omschrijving: "Plaatsen", ankerType: "oplevering", offsetDagen: 7 },
    ],
  },
  {
    sleutel: "waterontharder",
    naam: "Waterontharder",
    categorie: "installatie",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 7,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Plaatsing", ankerType: "oplevering", offsetDagen: 3 }],
  },
  {
    sleutel: "waterzuivering",
    naam: "Waterzuivering / osmose",
    categorie: "installatie",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 7,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Plaatsing", ankerType: "oplevering", offsetDagen: 3 }],
  },
  {
    sleutel: "zonnepanelen",
    naam: "Zonnepanelen",
    categorie: "installatie",
    aanlooptijdDagen: 42,
    annuleertermijnDagen: 14,
    communicatieregel: "direct",
    afspraken: [{ omschrijving: "Montage", ankerType: "oplevering", offsetDagen: 14 }],
  },
  {
    sleutel: "laadpaal",
    naam: "Laadpaal",
    categorie: "installatie",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 7,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Plaatsing", ankerType: "oplevering", offsetDagen: 14 }],
  },
  {
    sleutel: "airco-warmtepomp",
    naam: "Airco / warmtepomp-extra",
    categorie: "installatie",
    aanlooptijdDagen: 28,
    annuleertermijnDagen: 14,
    communicatieregel: "direct",
    afspraken: [{ omschrijving: "Plaatsing", ankerType: "oplevering", offsetDagen: 14 }],
  },
  {
    sleutel: "domotica-bekabeling",
    naam: "Domotica / netwerkbekabeling",
    categorie: "installatie",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 7,
    communicatieregel: "direct",
    afspraken: [
      {
        omschrijving: "Bekabeling trekken",
        ankerType: "ruwbouw_gereed",
        offsetDagen: 0,
        waarschuwing: WAARSCHUWING_WEGWERKEN,
      },
    ],
    toelichting: "Dit is een van de duurste afspraken om te laat te plannen.",
  },
  {
    sleutel: "alarm-camera",
    naam: "Alarm / camerasysteem",
    categorie: "installatie",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 7,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Plaatsing", ankerType: "oplevering", offsetDagen: 21 }],
  },

  // ── Afbouw ───────────────────────────────────────────────────────────────
  {
    sleutel: "stukadoor",
    naam: "Stukadoor",
    categorie: "afbouw",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 14,
    communicatieregel: "direct",
    afspraken: [{ omschrijving: "Wanden en plafonds", ankerType: "oplevering", offsetDagen: 7 }],
  },
  {
    sleutel: "vloerenlegger",
    naam: "Vloerenlegger",
    categorie: "afbouw",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 14,
    communicatieregel: "direct",
    afspraken: [
      {
        omschrijving: "Vloer leggen",
        ankerType: "dekvloer_gestort",
        offsetDagen: 42,
        waarschuwing: WAARSCHUWING_DROOGTIJD,
      },
    ],
    toelichting:
      "Hangt bewust aan de dekvloer en niet aan de oplevering: die twee lopen uiteen " +
      "zodra de bouw ongelijkmatig schuift, en dan zit je zomaar drie weken naast de waarheid.",
  },
  {
    sleutel: "schilder",
    naam: "Schilder",
    categorie: "afbouw",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 14,
    communicatieregel: "direct",
    afspraken: [{ omschrijving: "Binnenschilderwerk", ankerType: "oplevering", offsetDagen: 21 }],
  },
  {
    sleutel: "timmerman",
    naam: "Timmerman",
    categorie: "afbouw",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 14,
    communicatieregel: "direct",
    afspraken: [
      {
        omschrijving: "Binnendeuren, plinten en kasten",
        ankerType: "oplevering",
        offsetDagen: 14,
      },
    ],
  },
  {
    sleutel: "interieurbouwer",
    naam: "Interieurbouwer",
    categorie: "afbouw",
    aanlooptijdDagen: 56,
    annuleertermijnDagen: 21,
    communicatieregel: "direct",
    afspraken: [{ omschrijving: "Maatwerk", ankerType: "oplevering", offsetDagen: 28 }],
  },
  {
    sleutel: "raamdecoratie",
    naam: "Raamdecoratie",
    categorie: "afbouw",
    aanlooptijdDagen: 28,
    annuleertermijnDagen: 14,
    communicatieregel: "direct",
    afspraken: [
      { omschrijving: "Inmeten", ankerType: "oplevering", offsetDagen: 3 },
      { omschrijving: "Plaatsen", ankerType: "oplevering", offsetDagen: 21 },
    ],
  },

  // ── Tuin en buiten ───────────────────────────────────────────────────────
  {
    sleutel: "hovenier",
    naam: "Hovenier",
    categorie: "tuin",
    aanlooptijdDagen: 42,
    annuleertermijnDagen: 21,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Tuin aanleggen", ankerType: "oplevering", offsetDagen: 60 }],
    toelichting: "Tuinwerk is weersafhankelijk en heeft doorgaans ruime marge.",
  },
  {
    sleutel: "bestrating",
    naam: "Bestrating / oprit",
    categorie: "tuin",
    aanlooptijdDagen: 28,
    annuleertermijnDagen: 14,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Aanleg", ankerType: "oplevering", offsetDagen: 45 }],
  },
  {
    sleutel: "schutting",
    naam: "Schutting / erfafscheiding",
    categorie: "tuin",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 14,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Plaatsing", ankerType: "oplevering", offsetDagen: 45 }],
  },
  {
    sleutel: "berging-overkapping",
    naam: "Berging / overkapping",
    categorie: "tuin",
    aanlooptijdDagen: 42,
    annuleertermijnDagen: 21,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Plaatsing", ankerType: "oplevering", offsetDagen: 60 }],
  },

  // ── Verhuizing ───────────────────────────────────────────────────────────
  {
    sleutel: "verhuisbedrijf",
    naam: "Verhuisbedrijf",
    categorie: "verhuizing",
    aanlooptijdDagen: 28,
    annuleertermijnDagen: 14,
    communicatieregel: "direct",
    afspraken: [{ omschrijving: "Verhuisdag", ankerType: "sleuteloverdracht", offsetDagen: 7 }],
  },
  {
    sleutel: "busverhuur",
    naam: "Busverhuur",
    categorie: "verhuizing",
    aanlooptijdDagen: 7,
    annuleertermijnDagen: 2,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Bus ophalen", ankerType: "sleuteloverdracht", offsetDagen: 7 }],
    toelichting:
      "Kort van tevoren te regelen en gratis te annuleren — hoeft niets te weten zolang " +
      "de opleverdatum indicatief is.",
  },
  {
    sleutel: "verhuislift",
    naam: "Verhuisliftverhuur",
    categorie: "verhuizing",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 7,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Liftdag", ankerType: "sleuteloverdracht", offsetDagen: 7 }],
  },
  {
    sleutel: "opslagruimte",
    naam: "Opslagruimte",
    categorie: "verhuizing",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 14,
    communicatieregel: "direct",
    afspraken: [
      { omschrijving: "Huurperiode start", ankerType: "sleuteloverdracht", offsetDagen: -14 },
    ],
  },
  {
    sleutel: "helpende-handen",
    naam: "Helpende handen",
    categorie: "verhuizing",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 3,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Verhuisdag", ankerType: "sleuteloverdracht", offsetDagen: 7 }],
    toelichting: "Vrienden en familie plannen vrije dagen — vandaar de lange aanlooptijd.",
  },
  {
    sleutel: "schoonmaak-oude-woning",
    naam: "Schoonmaak oude woning",
    categorie: "verhuizing",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 3,
    communicatieregel: "bij_aanzegging",
    afspraken: [
      { omschrijving: "Eindschoonmaak", ankerType: "sleuteloverdracht", offsetDagen: 10 },
    ],
  },

  // ── Huidige woning ───────────────────────────────────────────────────────
  {
    sleutel: "verhuurder",
    naam: "Verhuurder",
    categorie: "huidige_woning",
    aanlooptijdDagen: 30,
    annuleertermijnDagen: 0, // een opzegging trek je niet terug
    communicatieregel: "direct",
    afspraken: [
      {
        omschrijving: "Huur opzeggen",
        ankerType: "sleuteloverdracht",
        offsetDagen: -45,
        waarschuwing: WAARSCHUWING_OPZEGGEN,
      },
    ],
    toelichting:
      "Dit is de belangrijkste beslissing in het hele traject. De app waarschuwt hier " +
      "expliciet voor en doet nooit automatisch een aanbeveling.",
  },
  {
    sleutel: "makelaar-verkoop",
    naam: "Makelaar (bij verkoop)",
    categorie: "huidige_woning",
    aanlooptijdDagen: 60,
    annuleertermijnDagen: 0,
    communicatieregel: "direct",
    afspraken: [
      { omschrijving: "Overdracht oude woning", ankerType: "sleuteloverdracht", offsetDagen: 0 },
    ],
  },
  {
    sleutel: "woningcorporatie",
    naam: "Woningcorporatie",
    categorie: "huidige_woning",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 7,
    communicatieregel: "direct",
    afspraken: [{ omschrijving: "Eindinspectie", ankerType: "sleuteloverdracht", offsetDagen: 10 }],
  },

  // ── Nutsvoorzieningen en diensten ────────────────────────────────────────
  {
    sleutel: "energieleverancier",
    naam: "Energieleverancier",
    categorie: "nuts",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 0,
    communicatieregel: "bij_aanzegging",
    afspraken: [
      { omschrijving: "Contract nieuwe woning", ankerType: "oplevering", offsetDagen: -14 },
    ],
  },
  {
    sleutel: "netbeheerder",
    naam: "Netbeheerder",
    categorie: "nuts",
    aanlooptijdDagen: 7,
    annuleertermijnDagen: 0,
    communicatieregel: "bij_aanzegging",
    afspraken: [
      { omschrijving: "Meterstanden doorgeven", ankerType: "oplevering", offsetDagen: 0 },
    ],
  },
  {
    sleutel: "waterbedrijf",
    naam: "Waterbedrijf",
    categorie: "nuts",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 0,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Aansluiting op naam", ankerType: "oplevering", offsetDagen: 0 }],
  },
  {
    sleutel: "internet-tv",
    naam: "Internet / TV",
    categorie: "nuts",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 7,
    communicatieregel: "direct",
    afspraken: [{ omschrijving: "Aansluiting activeren", ankerType: "oplevering", offsetDagen: 3 }],
  },
  {
    sleutel: "gemeente",
    naam: "Gemeente",
    categorie: "nuts",
    aanlooptijdDagen: 5,
    annuleertermijnDagen: 0,
    communicatieregel: "bij_aanzegging",
    afspraken: [{ omschrijving: "Adreswijziging", ankerType: "sleuteloverdracht", offsetDagen: 0 }],
  },
  {
    sleutel: "verzekeraar",
    naam: "Verzekeraar",
    categorie: "nuts",
    aanlooptijdDagen: 7,
    annuleertermijnDagen: 0,
    communicatieregel: "direct",
    afspraken: [
      {
        omschrijving: "Opstal- en inboedelverzekering laten ingaan",
        ankerType: "oplevering",
        offsetDagen: -7,
        waarschuwing: WAARSCHUWING_OPSTAL,
      },
    ],
  },

  // ── Financieel en juridisch ──────────────────────────────────────────────
  {
    sleutel: "hypotheekadviseur",
    naam: "Hypotheekadviseur",
    categorie: "financieel",
    aanlooptijdDagen: 30,
    annuleertermijnDagen: 0,
    communicatieregel: "direct",
    afspraken: [
      {
        omschrijving: "Geldigheid offerte bewaken",
        ankerType: "oplevering",
        offsetDagen: -30,
        waarschuwing: WAARSCHUWING_OFFERTE,
      },
    ],
  },
  {
    sleutel: "bank-bouwdepot",
    naam: "Bank (bouwdepot)",
    categorie: "financieel",
    aanlooptijdDagen: 14,
    annuleertermijnDagen: 0,
    communicatieregel: "direct",
    // Bewust geen standaardafspraak: declaraties lopen per bouwtermijn en niet
    // per anker. Die krijgen hun eigen module (PROJECT.md §6, fase 2).
    afspraken: [],
    toelichting:
      "Termijnen worden per bouwfase gedeclareerd, niet op één moment. Voeg ze toe zodra " +
      "het bouwdepot-overzicht bestaat.",
  },
  {
    sleutel: "notaris",
    naam: "Notaris",
    categorie: "financieel",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 7,
    communicatieregel: "direct",
    afspraken: [{ omschrijving: "Transportakte grond", ankerType: "start_bouw", offsetDagen: -14 }],
  },
  {
    sleutel: "bouwkundig-keurder",
    naam: "Bouwkundig keurder",
    categorie: "financieel",
    aanlooptijdDagen: 21,
    annuleertermijnDagen: 7,
    communicatieregel: "direct",
    afspraken: [
      { omschrijving: "Vooropname", ankerType: "oplevering", offsetDagen: -7 },
      {
        omschrijving: "Opleveringskeuring",
        ankerType: "oplevering",
        offsetDagen: 0,
        waarschuwing: WAARSCHUWING_KEURING,
      },
    ],
  },
] as const;

// ── Afgeleide hulpmiddelen ─────────────────────────────────────────────────

/** Opzoeken op sleutel. Retourneert `undefined` bij een onbekende sleutel. */
export function vindStandaardBetrokkene(sleutel: string): StandaardBetrokkene | undefined {
  return STANDAARD_BETROKKENEN.find((b) => b.sleutel === sleutel);
}

/** Alle standaardpartijen binnen één categorie, voor de aanvinklijst. */
export function standaardenInCategorie(
  categorie: BetrokkeneCategorie,
): readonly StandaardBetrokkene[] {
  return STANDAARD_BETROKKENEN.filter((b) => b.categorie === categorie);
}

/**
 * Zet een bibliotheek-entry om naar een `Betrokkene` die klaar is om op te
 * slaan. `waardenBron` staat op "voorstel" — dat is het hele punt: tot de
 * gebruiker de cijfers bevestigt of aanpast, zijn het schattingen van de app.
 */
export function alsBetrokkene(
  standaard: StandaardBetrokkene,
): Omit<Betrokkene, "contactpersoon" | "email" | "telefoon" | "notitie"> {
  return {
    naam: standaard.naam,
    categorie: standaard.categorie,
    aanlooptijdDagen: standaard.aanlooptijdDagen,
    annuleertermijnDagen: standaard.annuleertermijnDagen,
    communicatieregel: standaard.communicatieregel,
    waardenBron: "voorstel",
  };
}
