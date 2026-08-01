import type { Montage, OnderdeelCategorie } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Standaardbibliotheek onderdelen — wat er in een nieuwbouwwoning zit
 *
 * Doel: invullen wordt KIEZEN in plaats van bedenken. Per onderdeeltype staat
 * hier welke specs ertoe doen, welke merken er in Nederland gangbaar zijn, hoe
 * het gemonteerd wordt en of er een registratieplicht bij hoort.
 *
 * DRIE REGELS DIE HIER GELDEN (ADR-0013 §6)
 *
 * 1. DIT IS GEEN ADVIES EN GEEN AANBEVELING (constraint C5).
 *    De merkenlijsten staan alfabetisch, zonder volgorde van voorkeur, zonder
 *    beoordelingen en zonder prijzen. Een merk in de lijst is een merk dat
 *    bestaat, niet een merk dat wij aanraden.
 *
 * 2. DE LIJST IS NOOIT GESLOTEN.
 *    Modelseries verschijnen en verdwijnen sneller dan dit bestand wordt
 *    bijgewerkt. `merk` en `type` zijn in het model vrije strings en géén
 *    enums, en er is bewust geen `verify:rules`-koppeling op merknamen — dat
 *    zou van een momentopname een harde regel maken. Een ontbrekend merk mag
 *    de gebruiker nooit blokkeren.
 *
 * 3. DE ONDERHOUDSINTERVALLEN ZIJN VOORSTELLEN (ADR-0009).
 *    Ze krijgen `waardenBron: "voorstel"` met dezelfde zichtbare disclaimer
 *    als de aanlooptijden van de betrokkenen. Het interval uit het
 *    onderhoudsvoorschrift van de fabrikant wint altijd van onze schatting.
 *
 * Bijgewerkt: 2026-08-01. Merken en typereeksen zijn op die datum tegen de
 * Nederlandse markt gecontroleerd.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Eén voorgesteld specveld. `eenheid` staat als suffix bij het invoerveld. */
export interface Specveld {
  sleutel: string;
  label: string;
  eenheid?: string;
  /** Keuzelijst waar de waarde uit een vaste verzameling komt. Blijft vrij invulbaar. */
  opties?: readonly string[];
  hint?: string;
}

export interface StandaardOnderdeel {
  sleutel: string;
  naam: string;
  categorie: OnderdeelCategorie;
  /** Waarom je dit vastlegt — één regel, zichtbaar bij het toevoegen. */
  waarom: string;
  montage: Montage;
  blijftBijWoning: boolean;
  /** Gangbare fabrieksgarantie in maanden. Een voorstel, geen belofte. */
  garantieMaanden?: number;
  merken?: readonly string[];
  /** Bekende typereeksen, als hulp bij het invullen van `type`. */
  typereeksen?: readonly string[];
  specs: readonly Specveld[];
  registratieplicht?: {
    instantie: string;
    toelichting: string;
  };
}

// ── Gedeelde specvelden ────────────────────────────────────────────────────

const BOUWJAAR: Specveld = {
  sleutel: "bouwjaar",
  label: "Bouwjaar toestel",
  hint: "Staat op het typeplaatje; kan afwijken van de installatiedatum.",
};

export const STANDAARD_ONDERDELEN: readonly StandaardOnderdeel[] = [
  // ── Verwarming ──────────────────────────────────────────────────────────
  {
    sleutel: "warmtepomp",
    naam: "Warmtepomp",
    categorie: "verwarming",
    waarom:
      "Het duurste toestel in huis. Bij een storing vraagt de monteur als eerste naar type en " +
      "serienummer, en het koudemiddel bepaalt wie eraan mag werken.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 60,
    merken: [
      "Alpha Innotec",
      "Atlantic",
      "Bosch",
      "Daikin",
      "Itho Daalderop",
      "LG",
      "Mitsubishi Electric",
      "NIBE",
      "Panasonic",
      "Remeha",
      "Samsung",
      "Stiebel Eltron",
      "Vaillant",
      "Viessmann",
      "Wolf",
    ],
    typereeksen: [
      "NIBE S1155 (bodem/water)",
      "NIBE S1255 (bodem/water, met boiler)",
      "NIBE S1256 (water/water combi)",
      "NIBE S2125 (lucht/water, hoge temperatuur)",
      "NIBE F2120 (lucht/water)",
      "NIBE F730 / S735 (ventilatiewarmtepomp)",
      "Daikin Altherma 3",
      "Mitsubishi Ecodan",
      "Remeha Elga Ace",
      "Vaillant aroTHERM plus",
    ],
    specs: [
      {
        sleutel: "bron",
        label: "Warmtebron",
        opties: ["Lucht/water", "Bodem/water", "Water/water", "Ventilatielucht", "Hybride"],
        hint: "Bepaalt of er een bodemlus is die zelf onderhoud vraagt.",
      },
      { sleutel: "vermogen", label: "Vermogen", eenheid: "kW" },
      {
        sleutel: "scop",
        label: "SCOP",
        hint: "Seizoensrendement. Staat op het energielabel van het toestel.",
      },
      {
        sleutel: "koudemiddel",
        label: "Koudemiddel",
        opties: ["R290 (propaan)", "R32", "R410A", "R454C", "CO₂ (R744)"],
        hint: "R290 is brandbaar; daar mag niet iedere monteur aan werken.",
      },
      { sleutel: "koudemiddelKg", label: "Vulling koudemiddel", eenheid: "kg" },
      { sleutel: "buitenunit", label: "Type buitenunit" },
      { sleutel: "geluidsvermogen", label: "Geluidsvermogen buitenunit", eenheid: "dB(A)" },
      BOUWJAAR,
    ],
  },
  {
    sleutel: "cv_ketel",
    naam: "Cv-ketel",
    categorie: "verwarming",
    waarom:
      "Jaarlijks onderhoud is meestal een voorwaarde voor de garantie én voor je " +
      "opstalverzekering bij schade.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 24,
    merken: [
      "ATAG",
      "Bosch",
      "Intergas",
      "Nefit",
      "Remeha",
      "Vaillant",
      "Viessmann",
    ],
    typereeksen: [
      "Intergas HRE / Xclusive",
      "Nefit ProLine / TrendLine",
      "Remeha Calenta Ace / Tzerra Ace",
      "Vaillant ecoTEC plus",
      "ATAG i-Serie",
    ],
    specs: [
      { sleutel: "vermogen", label: "Vermogen", eenheid: "kW" },
      { sleutel: "tapklasse", label: "Tapklasse", opties: ["CW3", "CW4", "CW5", "CW6"] },
      { sleutel: "gaskeur", label: "Gaskeur" },
      BOUWJAAR,
    ],
  },
  {
    sleutel: "vloerverwarmingsverdeler",
    naam: "Vloerverwarmingsverdeler",
    categorie: "verwarming",
    waarom:
      "Bij een koude kamer wil je weten welke groep waar ligt — en dat staat nergens anders " +
      "opgeschreven.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    specs: [
      { sleutel: "groepen", label: "Aantal groepen" },
      { sleutel: "locatie", label: "Locatie verdeler" },
      { sleutel: "groepindeling", label: "Welke groep is welke ruimte" },
      { sleutel: "waterdruk", label: "Werkdruk", eenheid: "bar" },
    ],
  },

  // ── Ventilatie ──────────────────────────────────────────────────────────
  {
    sleutel: "wtw_unit",
    naam: "WTW-unit (balansventilatie)",
    categorie: "ventilatie",
    waarom:
      "Filters vervangen is het meest vergeten onderhoud in een nieuwbouwwoning. Vuile filters " +
      "kosten rendement en luchtkwaliteit.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 24,
    merken: [
      "Brink Climate Systems",
      "Buva",
      "Duco",
      "Itho Daalderop",
      "Orcon",
      "Vasco",
      "Zehnder",
    ],
    typereeksen: [
      "Brink Flair 225 / 325 / 400 / 450 / 600",
      "Brink Renovent Excellent 300 / 400",
      "Brink Ease 200",
      "Itho Daalderop HRU ECO / DemandFlow",
      "Zehnder ComfoAir Q",
      "Orcon HRC",
    ],
    specs: [
      { sleutel: "debiet", label: "Maximaal debiet", eenheid: "m³/h" },
      {
        sleutel: "filterklasse",
        label: "Filterklasse",
        opties: ["ISO Coarse (G4)", "ePM10 (M5)", "ePM1 55% (F7)", "ePM1 80% (F9)"],
        hint: "F7 of hoger houdt pollen tegen — relevant bij hooikoorts.",
      },
      { sleutel: "filtermaat", label: "Filterafmeting", hint: "Zodat je de juiste bestelt." },
      { sleutel: "bypass", label: "Zomerbypass", opties: ["Ja, automatisch", "Ja, handmatig", "Nee"] },
      { sleutel: "regeling", label: "Regeling / bediening" },
      BOUWJAAR,
    ],
  },
  {
    sleutel: "mechanische_ventilatie",
    naam: "Mechanische afzuiging",
    categorie: "ventilatie",
    waarom: "De box zelf gaat lang mee, maar hij vraagt periodiek schoonmaak van de kanalen.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    merken: ["Itho Daalderop", "Orcon", "Vasco", "Zehnder"],
    specs: [
      { sleutel: "debiet", label: "Maximaal debiet", eenheid: "m³/h" },
      { sleutel: "regeling", label: "Regeling", opties: ["Vaste standen", "CO₂-gestuurd", "Vochtgestuurd"] },
    ],
  },

  // ── Opwekking en opslag ─────────────────────────────────────────────────
  {
    sleutel: "zonnepanelen",
    naam: "Zonnepanelen",
    categorie: "opwekking",
    waarom:
      "Panelen hebben twee garanties die uiteenlopen: op het product en op de opbrengst. Bij " +
      "tegenvallende opbrengst heb je het typenummer nodig om te claimen.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 300,
    merken: [
      "Aiko",
      "Canadian Solar",
      "DMEGC",
      "JA Solar",
      "Jinko Solar",
      "LONGi",
      "Meyer Burger",
      "Qcells",
      "REC",
      "SunPower / Maxeon",
      "Trina Solar",
    ],
    specs: [
      { sleutel: "aantal", label: "Aantal panelen" },
      { sleutel: "wattpiek", label: "Vermogen per paneel", eenheid: "Wp" },
      { sleutel: "totaal", label: "Totaalvermogen", eenheid: "kWp" },
      {
        sleutel: "productgarantie",
        label: "Productgarantie",
        eenheid: "jaar",
        hint: "Loopt uiteen van 15 tot 40 jaar — controleer het datablad.",
      },
      {
        sleutel: "opbrengstgarantie",
        label: "Opbrengstgarantie",
        hint: "Bijv. “88% na 25 jaar”. Staat los van de productgarantie.",
      },
      { sleutel: "orientatie", label: "Oriëntatie en hellingshoek" },
      { sleutel: "montagesysteem", label: "Montagesysteem" },
    ],
  },
  {
    sleutel: "omvormer",
    naam: "Omvormer",
    categorie: "opwekking",
    waarom:
      "Gaat korter mee dan de panelen en is het onderdeel dat je waarschijnlijk als eerste " +
      "vervangt. Of hij hybride is bepaalt of je later een batterij kunt bijzetten.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 120,
    merken: [
      "Enphase",
      "Fronius",
      "GoodWe",
      "Growatt",
      "Huawei",
      "Kostal",
      "SMA",
      "Solis",
      "SolarEdge",
      "Sungrow",
    ],
    typereeksen: [
      "Huawei SUN2000 (hybride)",
      "SolarEdge HD-Wave / Home Hub",
      "Enphase IQ8 (micro-omvormer)",
      "SMA Sunny Boy / Tripower",
      "Fronius Symo / Gen24",
      "GoodWe ET / EH",
    ],
    specs: [
      {
        sleutel: "soort",
        label: "Soort",
        opties: ["String-omvormer", "Hybride omvormer", "Micro-omvormers", "String + optimizers"],
        hint: "Alleen een hybride omvormer kan direct een batterij aansturen.",
      },
      { sleutel: "vermogen", label: "AC-vermogen", eenheid: "kW" },
      { sleutel: "mppt", label: "Aantal MPPT-ingangen" },
      { sleutel: "fasen", label: "Fasen", opties: ["1-fase", "3-fase"] },
      { sleutel: "garantie", label: "Garantie", eenheid: "jaar" },
      BOUWJAAR,
    ],
  },
  {
    sleutel: "thuisbatterij_vast",
    naam: "Thuisbatterij — vast geïnstalleerd",
    categorie: "opslag",
    waarom:
      "Nagelvast, dus onderdeel van de woning en van de opstalverzekering. De cyclusgarantie " +
      "is belangrijker dan de jaargarantie: die loopt meestal als eerste af.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 120,
    merken: [
      "AlphaESS",
      "BYD",
      "Enphase",
      "Growatt",
      "Huawei",
      "Pylontech",
      "Sessy",
      "Sigenergy",
      "Tesla",
      "Victron Energy",
    ],
    typereeksen: [
      "Huawei LUNA2000",
      "BYD Battery-Box Premium",
      "AlphaESS SMILE",
      "Enphase IQ Battery",
      "Sessy",
      "Tesla Powerwall",
    ],
    specs: [
      { sleutel: "capaciteit", label: "Capaciteit", eenheid: "kWh" },
      { sleutel: "bruikbaar", label: "Bruikbare capaciteit", eenheid: "kWh" },
      { sleutel: "laadvermogen", label: "Laad-/ontlaadvermogen", eenheid: "kW" },
      {
        sleutel: "koppeling",
        label: "Koppeling",
        opties: ["DC-gekoppeld (via hybride omvormer)", "AC-gekoppeld (eigen omvormer)"],
        hint:
          "DC is efficiënter maar bindt je aan de omvormer; AC werkt op elke bestaande " +
          "installatie.",
      },
      { sleutel: "chemie", label: "Celchemie", opties: ["LFP (LiFePO₄)", "NMC", "Anders"] },
      {
        sleutel: "cyclusgarantie",
        label: "Cyclus- of doorvoergarantie",
        hint: "Bijv. “6.000 cycli” of “een doorvoer van 30 MWh”. Loopt vaak eerder af dan de jaren.",
      },
      { sleutel: "noodstroom", label: "Noodstroomvoorziening", opties: ["Ja", "Nee"] },
      { sleutel: "uitbreidbaar", label: "Modulair uitbreidbaar", opties: ["Ja", "Nee"] },
      BOUWJAAR,
    ],
    registratieplicht: {
      instantie: "Netbeheerder via Energieleveren.nl",
      toelichting:
        "Verplicht vanaf 0,8 kW terugleververmogen. Aanmelden is gratis en duurt een kwartier; " +
        "zonder melding mag de netbeheerder je teruglevering weigeren of je aansluiting beperken.",
    },
  },
  {
    sleutel: "thuisbatterij_plugin",
    naam: "Thuisbatterij — plug-and-play",
    categorie: "opslag",
    waarom:
      "Roerende zaak: hij verhuist standaard mee en valt onder je inboedel, niet onder de " +
      "opstal. Let op de wettelijke grens van 800 W teruglevering via een gewoon stopcontact.",
    montage: "plug_and_play",
    blijftBijWoning: false,
    garantieMaanden: 60,
    merken: [
      "Anker SOLIX",
      "Bluetti",
      "EcoFlow",
      "Jackery",
      "Marstek",
      "Zendure",
    ],
    typereeksen: [
      "Marstek Venus E / Venus E Max",
      "Anker SOLIX Solarbank 3 / E2700 Pro",
      "Zendure SolarFlow 2400 AC / 3000 Mix",
      "EcoFlow Delta Pro",
    ],
    specs: [
      { sleutel: "capaciteit", label: "Capaciteit", eenheid: "kWh" },
      { sleutel: "laadvermogen", label: "Laadvermogen", eenheid: "W" },
      {
        sleutel: "terugleververmogen",
        label: "Terugleververmogen",
        eenheid: "W",
        hint: "Via een gewoon stopcontact geldt de RfG-grens van 800 W.",
      },
      { sleutel: "chemie", label: "Celchemie", opties: ["LFP (LiFePO₄)", "NMC", "Anders"] },
      { sleutel: "p1meter", label: "P1-meter meegeleverd", opties: ["Ja", "Nee"] },
      { sleutel: "dynamisch", label: "Werkt met dynamische tarieven", opties: ["Ja", "Nee"] },
      { sleutel: "uitbreidbaar", label: "Modulair uitbreidbaar", opties: ["Ja", "Nee"] },
      BOUWJAAR,
    ],
    registratieplicht: {
      instantie: "Netbeheerder via Energieleveren.nl",
      toelichting:
        "Óók voor een stekkerbatterij: de meldplicht geldt vanaf 0,8 kW, en vrijwel elk model " +
        "zit daarboven. Veel mensen denken dat plug-and-play hiervan is vrijgesteld.",
    },
  },

  // ── Water ───────────────────────────────────────────────────────────────
  {
    sleutel: "waterontharder",
    naam: "Waterontharder",
    categorie: "water",
    waarom:
      "Zout bijvullen is maandelijks werk en de hars gaat niet eeuwig mee. Zonder onderhoud " +
      "verhardt het water ongemerkt weer.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 24,
    merken: [
      "ATAG",
      "Aquagroup",
      "BWT",
      "Bayard",
      "Culligan",
      "Delta Water",
      "Durlem",
      "EcoWater",
      "JUDO",
      "Viessmann",
    ],
    typereeksen: ["BWT Perla / Perla Silk / Perla Seta", "EcoWater eVOLUTION", "JUDO i-soft"],
    specs: [
      {
        sleutel: "harsvolume",
        label: "Harsvolume",
        eenheid: "liter",
        hint: "Bepaalt de capaciteit; gangbaar is 10, 15, 25 of 30 liter.",
      },
      { sleutel: "systeem", label: "Systeem", opties: ["Enkele tank", "Duplex (twee tanks)", "Zoutvrij"] },
      { sleutel: "zoutsoort", label: "Zoutsoort" },
      {
        sleutel: "ingesteldeHardheid",
        label: "Ingestelde hardheid",
        eenheid: "°dH",
        hint: "Volledig onthard water is niet wenselijk; 6–8 °dH is gangbaar.",
      },
      { sleutel: "ingaandeHardheid", label: "Hardheid leidingwater", eenheid: "°dH" },
      BOUWJAAR,
    ],
  },
  {
    sleutel: "drinkwaterfilter",
    naam: "Drinkwaterfilter",
    categorie: "water",
    waarom:
      "Het onderdeel met het kortste onderhoudsinterval in huis. Een filter dat te lang zit " +
      "werkt niet alleen minder goed — bij actief kool kan het bacteriegroei bevorderen.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 24,
    merken: [
      "Aquaphor",
      "BWT",
      "Brita",
      "Culligan",
      "Grohe",
      "Osmio",
      "PureAqua",
      "Quooker",
      "Waterdrop",
    ],
    specs: [
      {
        sleutel: "techniek",
        label: "Techniek",
        opties: [
          "Actief kool",
          "Omgekeerde osmose (RO)",
          "Omgekeerde osmose + remineralisatie",
          "Sediment + kool",
          "UV-desinfectie",
          "Ionenwisselaar",
        ],
        hint: "Voor PFAS is alleen specifiek gecertificeerd kool of RO afdoende.",
      },
      { sleutel: "plaatsing", label: "Plaatsing", opties: ["Onder het aanrecht", "Centraal (hoofdleiding)", "Op de kraan", "Vrijstaand"] },
      { sleutel: "fases", label: "Aantal filterfases" },
      {
        sleutel: "voorfilter",
        label: "Voorfilter — interval",
        hint: "Sediment- en koolfilters gaan doorgaans 2 tot 6 maanden mee.",
      },
      {
        sleutel: "membraan",
        label: "RO-membraan — interval",
        hint: "Bij normaal gebruik 2 tot 5 jaar.",
      },
      { sleutel: "cartridgecode", label: "Cartridgecode", hint: "Zodat je de juiste navulling bestelt." },
      { sleutel: "capaciteit", label: "Capaciteit", eenheid: "l/min" },
    ],
  },
  {
    sleutel: "boiler",
    naam: "Boiler / warmtapwatervat",
    categorie: "warm_water",
    waarom:
      "De anode is een slijtdeel dat het vat beschermt tegen corrosie. Vervang je hem niet, dan " +
      "gaat het vat kapot in plaats van de anode.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 60,
    merken: ["ACV", "ATAG", "Daikin", "Itho Daalderop", "NIBE", "Remeha", "Vaillant"],
    specs: [
      { sleutel: "inhoud", label: "Inhoud", eenheid: "liter" },
      { sleutel: "soort", label: "Soort", opties: ["Indirect (via warmtepomp/ketel)", "Elektrisch", "Warmtepompboiler"] },
      { sleutel: "anode", label: "Type anode", opties: ["Magnesium (slijtdeel)", "Titanium (onderhoudsvrij)"] },
      { sleutel: "expansievat", label: "Voordruk expansievat", eenheid: "bar" },
      BOUWJAAR,
    ],
  },

  // ── Elektra en beveiliging ──────────────────────────────────────────────
  {
    sleutel: "groepenkast",
    naam: "Groepenkast",
    categorie: "elektra",
    waarom:
      "De aardlekschakelaar testen kost tien seconden en is het enige onderhoud dat je zelf " +
      "aan je elektra doet. Bij een storing wil je weten welke groep waar zit.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    merken: ["ABB", "Eaton", "Hager", "Schneider Electric", "Siemens"],
    specs: [
      { sleutel: "groepen", label: "Aantal groepen" },
      { sleutel: "aardlek", label: "Aantal aardlekschakelaars" },
      { sleutel: "hoofdzekering", label: "Hoofdzekering", eenheid: "A" },
      { sleutel: "fasen", label: "Aansluiting", opties: ["1-fase", "3-fase"] },
      { sleutel: "groepenoverzicht", label: "Groepenoverzicht", hint: "Welke groep hoort bij welke ruimte." },
      { sleutel: "overspanning", label: "Overspanningsbeveiliging", opties: ["Ja", "Nee"] },
    ],
  },
  {
    sleutel: "laadpaal",
    naam: "Laadpaal / laadpunt",
    categorie: "elektra",
    waarom:
      "Vaste laadpunten vragen periodieke keuring van de aansluiting, en het laadvermogen moet " +
      "passen bij je hoofdaansluiting.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 36,
    merken: ["Alfen", "Easee", "Wallbox", "Zaptec", "go-e"],
    specs: [
      { sleutel: "vermogen", label: "Laadvermogen", eenheid: "kW" },
      { sleutel: "fasen", label: "Fasen", opties: ["1-fase", "3-fase"] },
      { sleutel: "loadbalancing", label: "Load balancing", opties: ["Ja", "Nee"] },
      { sleutel: "kabel", label: "Kabel", opties: ["Vaste kabel", "Contactdoos type 2"] },
    ],
  },
  {
    sleutel: "rookmelders",
    naam: "Rookmelders",
    categorie: "beveiliging",
    waarom:
      "Wettelijk verplicht op elke verdieping. Ze gaan tien jaar mee en moeten daarna vervangen " +
      "worden — schoonmaken helpt dan niet meer.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 60,
    merken: ["Ei Electronics", "FireAngel", "Kidde", "Nest", "Smartwares"],
    specs: [
      { sleutel: "aantal", label: "Aantal melders" },
      { sleutel: "voeding", label: "Voeding", opties: ["230V met accuback-up", "Batterij 10 jaar", "Batterij vervangbaar"] },
      { sleutel: "gekoppeld", label: "Onderling gekoppeld", opties: ["Ja", "Nee"] },
      {
        sleutel: "vervangenVoor",
        label: "Vervangen vóór",
        hint: "Staat op de melder zelf: tien jaar na productiedatum.",
      },
    ],
  },

  // ── Bouwkundig ──────────────────────────────────────────────────────────
  {
    sleutel: "kozijnen",
    naam: "Kozijnen en beglazing",
    categorie: "gevel",
    waarom:
      "Bij een lekkende ruit of een klemmend raam heb je het merk en het bouwjaar nodig voor de " +
      "garantie op het isolatieglas.",
    montage: "nvt",
    blijftBijWoning: true,
    specs: [
      { sleutel: "materiaal", label: "Materiaal", opties: ["Kunststof", "Hout", "Aluminium", "Hout-aluminium"] },
      { sleutel: "beglazing", label: "Beglazing", opties: ["HR++", "Triple (HR+++)", "Dubbel"] },
      { sleutel: "uwaarde", label: "U-waarde", eenheid: "W/m²K" },
      { sleutel: "kleur", label: "Kleurcode (RAL)" },
    ],
  },
  {
    sleutel: "hang_en_sluitwerk",
    naam: "Hang- en sluitwerk",
    categorie: "beveiliging",
    waarom:
      "Het SKG-keurmerk bepaalt of je inboedelverzekering uitkeert na een inbraak. Cilinders " +
      "wil je bovendien kunnen bijbestellen op dezelfde sleutel.",
    montage: "nvt",
    blijftBijWoning: true,
    specs: [
      { sleutel: "skg", label: "SKG-keurmerk", opties: ["SKG★", "SKG★★", "SKG★★★", "Geen"] },
      { sleutel: "cilindertype", label: "Cilindertype" },
      { sleutel: "sleutelnummer", label: "Sleutel-/certificaatnummer", hint: "Nodig om bij te bestellen." },
      { sleutel: "gelijksluitend", label: "Gelijksluitend", opties: ["Ja", "Nee"] },
    ],
  },
  {
    sleutel: "dakbedekking",
    naam: "Dakbedekking",
    categorie: "dak",
    waarom:
      "Een plat dak heeft een beperkte levensduur en een garantie die je alleen kunt claimen " +
      "als je de inspecties hebt laten doen.",
    montage: "nvt",
    blijftBijWoning: true,
    garantieMaanden: 120,
    specs: [
      { sleutel: "soort", label: "Soort", opties: ["Dakpannen", "Bitumen", "EPDM", "PVC", "Zink"] },
      { sleutel: "isolatie", label: "Isolatiewaarde (Rc)", eenheid: "m²K/W" },
      { sleutel: "leverancier", label: "Leverancier / dakdekker" },
    ],
  },
  {
    sleutel: "zonwering",
    naam: "Zonwering",
    categorie: "zonwering",
    waarom:
      "Screens en markiezen hebben motoren en doeken die apart onder garantie vallen, met " +
      "verschillende termijnen.",
    montage: "vast_geinstalleerd",
    blijftBijWoning: true,
    garantieMaanden: 60,
    merken: ["Erhardt", "Luxaflex", "Renson", "Somfy", "Verano"],
    specs: [
      { sleutel: "soort", label: "Soort", opties: ["Screens", "Uitvalscherm", "Knikarmscherm", "Rolluiken", "Binnenzonwering"] },
      { sleutel: "bediening", label: "Bediening", opties: ["Handmatig", "Elektrisch", "Elektrisch met windsensor"] },
      { sleutel: "motor", label: "Merk en type motor" },
      { sleutel: "doekcode", label: "Doekcode", hint: "Nodig bij vervanging van het doek." },
    ],
  },
];

/** De categorieën met een leesbaar label, in de volgorde van de bibliotheek. */
export const ONDERDEELCATEGORIEEN = [
  { waarde: "verwarming", label: "Verwarming" },
  { waarde: "ventilatie", label: "Ventilatie" },
  { waarde: "warm_water", label: "Warm water" },
  { waarde: "opwekking", label: "Opwekking" },
  { waarde: "opslag", label: "Opslag" },
  { waarde: "elektra", label: "Elektra" },
  { waarde: "water", label: "Water" },
  { waarde: "zonwering", label: "Zonwering" },
  { waarde: "dak", label: "Dak" },
  { waarde: "gevel", label: "Gevel" },
  { waarde: "sanitair", label: "Sanitair" },
  { waarde: "beveiliging", label: "Beveiliging" },
  { waarde: "overig", label: "Overig" },
] as const satisfies readonly { waarde: OnderdeelCategorie; label: string }[];

export const MONTAGEOPTIES = [
  {
    waarde: "vast_geinstalleerd",
    label: "Vast geïnstalleerd",
    toelichting:
      "Nagelvast aangesloten door een installateur. Onderdeel van de woning, valt onder de " +
      "opstalverzekering en blijft bij verkoop achter.",
  },
  {
    waarde: "plug_and_play",
    label: "Plug-and-play",
    toelichting:
      "In het stopcontact. Roerende zaak: valt onder je inboedel en verhuist standaard mee, " +
      "tenzij je hem op de lijst van achterblijvende zaken zet.",
  },
  {
    waarde: "nvt",
    label: "Bouwkundig — niet geïnstalleerd",
    toelichting: "Kozijnen, dakbedekking, sloten. Hoort bij het huis zonder dat er een stekker aan zit.",
  },
] as const satisfies readonly { waarde: Montage; label: string; toelichting: string }[];

/** Zoekt een standaardonderdeel op sleutel. */
export function standaardOnderdeel(sleutel: string): StandaardOnderdeel | undefined {
  return STANDAARD_ONDERDELEN.find((o) => o.sleutel === sleutel);
}
