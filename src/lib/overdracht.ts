import type {
  BetrokkeneMetId,
  MeterMetId,
  MeterstandMetId,
  OnderdeelMetId,
  OnderhoudLogregelMetId,
  ProjectMetId,
} from "@/lib/converters";
import { berekenGarantieklok, ordenSpecs, registratieOpenstaand } from "@/lib/onderdelen";
import { bepaalEnergielabelstand, adresregel } from "@/lib/woning";
import { decimalenVan, meternaamVan, toonEenheid } from "@/lib/meterstanden";
import { METERBIBLIOTHEEK } from "@/data/meters-standaard";
import { standaardOnderdeelVoor } from "@/data/onderhoud-standaard";
import type { Energielabelstand } from "@/lib/woning";
import type { Garantieklok } from "@/lib/onderdelen";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Het overdrachtsdossier — samenstellen (ADR-0016, blok E8)
 *
 * Puur TypeScript: geen Firestore, geen React, geen `new Date()` die niet als
 * parameter binnenkomt. Dit bestand weet ook níéts van HTML.
 *
 * DAT IS BEWUST. De weergave is een printweergave en geen gegenereerde PDF
 * (ADR-0016), maar die keuze mag hier niet in doorwerken: blijkt de output per
 * browser te veel te verschillen, dan komt er een andere weergavelaag achter
 * exact deze structuur — zonder dat het samenstellen opnieuw moet.
 *
 * WAT HIER GEFILTERD WORDT, EN WAAROM DAT DE KERN IS
 * `blijftBijWoning` bepaalt wat er in het dossier komt — níét `montage`
 * (ADR-0013 §2). Zonder dat onderscheid levert het dossier een lijst apparatuur
 * op die de verkoper heeft meegenomen: de thuisbatterij die in het stopcontact
 * zat, de zonwering die in de onderhandeling meeging. Dat is het scenario waar
 * ADR-0013 voor geschreven is, en hier wordt het ingelost.
 *
 * VAN BETROKKENEN ALLEEN DE BEDRIJFSNAAM EN DE ROL (ADR-0016 §5). Geen
 * contactpersoon, geen e-mail, geen telefoonnummer — dat zijn persoonsgegevens
 * van een derde, en die geef je niet ongevraagd door aan een onbekende koper.
 * De typen hieronder maken dat structureel: er zít geen veld voor.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── De onderdelen van het dossier ──────────────────────────────────────────

export interface Dossierkop {
  /** Het adres in één regel, of de projectnaam zolang dat er niet is. */
  titel: string;
  adres: string | null;
  overdrachtOp: Date;
  opgeleverdOp?: Date;
  garantiewaarborg?: ProjectMetId["garantiewaarborg"];
  waarborgpolisnummer?: string;
}

export interface Dossieronderdeel {
  id: string;
  naam: string;
  categorie: OnderdeelMetId["categorie"];
  merk?: string;
  type?: string;
  serienummer?: string;
  installatieDatum?: Date;
  /** De bedrijfsnaam van de installateur. Nooit een contactpersoon. */
  installateur?: string;
  /** Afgeleid uit installatiedatum + garantiemaanden; nooit opgeslagen. */
  garantie: Garantieklok | null;
  specs: readonly { sleutel: string; waarde: string }[];
  /** Zolang `aangemeldOp` leeg is, moet de nieuwe eigenaar dit nog regelen. */
  meldplichtOpen?: string;
  notitie?: string;
  // GEEN `documentUrl`. Dat veld wijst naar waar het bestand bij de VERKOPER
  // staat — een Drive- of OneDrive-link, vaak met een deeltoken erin en vaak
  // naar een map waar ook de factuur en de hypotheekstukken liggen. Dat is
  // dezelfde categorie als het 06-nummer van een monteur (ADR-0016 §5) en het
  // hoort niet op een document dat naar een onbekende koper gaat.
}

/**
 * Alleen de paspoortvelden die de wóning beschrijven.
 *
 * DIT IS EEN PROJECTIE EN GEEN DOORGEEFLUIK, om dezelfde reden als bij
 * `Dossierbetrokkene`: `Woningpaspoort` bevat ook `notaris` en
 * `hypotheekverstrekker`, en dat zijn gegevens over de verkóper. `lib/woning.ts`
 * rekent ze om die reden al niet mee in de kernvelden.
 *
 * Zou de hele map doorgegeven worden, dan rendert een toekomstige weergavelaag
 * — die ADR-0016 expliciet openhoudt — vrolijk de naam van de notaris en de
 * bank van de verkoper mee. Er zít hier geen veld voor, en dat is het punt.
 */
export interface Dossierpaspoort {
  woningtype?: NonNullable<ProjectMetId["woningpaspoort"]>["woningtype"];
  bouwjaar?: number;
  woonoppervlakte?: number;
  perceeloppervlakte?: number;
  energielabel?: NonNullable<ProjectMetId["woningpaspoort"]>["energielabel"];
  energielabelRegistratie?: string;
}

export interface Dossierlogregel {
  id: string;
  uitgevoerdOp: Date;
  wat: string;
  doorWie?: string;
  kosten?: number;
  notitie?: string;
}

export interface Dossiermeterstand {
  meterId: string;
  naam: string;
  eenheid: string;
  decimalen: number;
  /** `undefined` als er op of vóór de overdrachtsdatum geen opname is. */
  stand?: number;
  opgenomenOp?: Date;
  /**
   * Er staan twee of meer opnames op deze dag, en welke daarvan hier getoond
   * wordt hangt af van het Firestore-document-id — dat is willekeurig.
   *
   * Dit is dezelfde valkuil als in `lib/meterstanden.ts`, maar hij weegt hier
   * zwaarder: dit getal is de basis voor de eindafrekening met de
   * energieleverancier. De app kiest dus niet stil — hij zegt het.
   */
  meerdereOpDag: boolean;
}

export interface Dossierbetrokkene {
  id: string;
  /** Bedrijfsnaam. Bewust het enige naamveld in dit type. */
  naam: string;
  categorie: BetrokkeneMetId["categorie"];
  /** Waar dit bedrijf aan gewerkt heeft, afgeleid uit de onderdelen. */
  werk: readonly string[];
}

export interface Overdrachtsdossier {
  kop: Dossierkop;
  paspoort: Dossierpaspoort | undefined;
  energielabel: Energielabelstand | null;
  onderdelen: readonly Dossieronderdeel[];
  /** Hoeveel onderdelen NIET in het dossier staan omdat ze meeverhuizen. */
  verhuistMee: number;
  logboek: readonly Dossierlogregel[];
  /** Optelsom van de kosten in het logboek. Zegt wat dit huis kost aan onderhoud. */
  logboekKosten: number;
  meterstanden: readonly Dossiermeterstand[];
  betrokkenen: readonly Dossierbetrokkene[];
  /** Wat er ontbreekt en het dossier minder bruikbaar maakt voor een koper. */
  aandachtspunten: readonly string[];
}

// ── Samenstellen ───────────────────────────────────────────────────────────

export interface Dossierbronnen {
  project: ProjectMetId;
  onderdelen: readonly OnderdeelMetId[];
  logboek: readonly OnderhoudLogregelMetId[];
  meters: readonly MeterMetId[];
  meterstanden: readonly MeterstandMetId[];
  betrokkenen: readonly BetrokkeneMetId[];
}

/**
 * Bouwt het volledige dossier op.
 *
 * `overdrachtOp` is een parameter en géén opgeslagen veld (ADR-0016 §6): het
 * hoort bij dít document en niet bij het project. Hij bepaalt twee dingen — wat
 * er op het voorblad staat, en tot welk moment de meterstanden meetellen.
 *
 * `vandaag` staat er los naast omdat de garantieklokken en het energielabel
 * altijd vanaf nú aftellen, ook als je een dossier voor een datum in het
 * verleden of de toekomst samenstelt. Een garantie die vandaag nog loopt hoort
 * niet als verlopen in het dossier te staan omdat de overdracht over een half
 * jaar is.
 */
export function stelDossierSamen(
  bronnen: Dossierbronnen,
  overdrachtOp: Date,
  vandaag: Date,
): Overdrachtsdossier {
  const { project, onderdelen, logboek, meters, meterstanden, betrokkenen } = bronnen;

  const blijvend = onderdelen.filter((o) => o.blijftBijWoning);
  const betrokkeneOp = new Map(betrokkenen.map((b) => [b.id, b]));

  const dossieronderdelen = blijvend
    .map((o) => maakDossieronderdeel(o, betrokkeneOp, vandaag))
    .sort((a, b) => {
      const opCategorie = a.categorie.localeCompare(b.categorie, "nl");
      return opCategorie !== 0 ? opCategorie : a.naam.localeCompare(b.naam, "nl");
    });

  const adres = adresregel(project.woningpaspoort);
  const dossierlogboek = maakLogboek(logboek, onderdelen, blijvend);
  const dossiermeterstanden = maakMeterstanden(meters, meterstanden, overdrachtOp);

  return {
    kop: {
      titel: adres ?? project.naam,
      adres,
      overdrachtOp,
      // ALLEEN BIJ EEN AANGEZEGDE OPLEVERING. `opleverVerwacht` is de middelste
      // waarde van een band met een staat ernaast (ADR-0008): bij `indicatief`
      // is dat een schatting, en een schatting hoort niet als feit op een
      // overdrachtsdocument. Het model kent geen veld voor de wérkelijke
      // opleverdatum; dat zou een modelwijziging zijn en dus een eigen ADR.
      ...(project.opleverStatus === "aangezegd" && project.opleverVerwacht
        ? { opgeleverdOp: project.opleverVerwacht }
        : {}),
      ...(project.garantiewaarborg ? { garantiewaarborg: project.garantiewaarborg } : {}),
      ...(project.woningpaspoort?.waarborgpolisnummer
        ? { waarborgpolisnummer: project.woningpaspoort.waarborgpolisnummer }
        : {}),
    },
    paspoort: maakPaspoort(project.woningpaspoort),
    energielabel: bepaalEnergielabelstand(project.woningpaspoort, vandaag),
    onderdelen: dossieronderdelen,
    verhuistMee: onderdelen.length - blijvend.length,
    logboek: dossierlogboek,
    logboekKosten: dossierlogboek.reduce((som, r) => som + (r.kosten ?? 0), 0),
    meterstanden: dossiermeterstanden,
    betrokkenen: maakBetrokkenen(betrokkenen, blijvend),
    aandachtspunten: bepaalAandachtspunten(
      project,
      blijvend,
      dossierlogboek,
      dossiermeterstanden,
      vandaag,
    ),
  };
}

/**
 * `undefined` zodra er geen enkel woningveld is ingevuld — dat is méér dan een
 * `undefined`-check op de map zelf. Iemand die alleen `notaris` invult heeft
 * een gevulde map maar een leeg paspoort, en dan hoort er "Nog niet ingevuld"
 * te staan in plaats van een kop met een lege lijst eronder.
 */
function maakPaspoort(
  paspoort: ProjectMetId["woningpaspoort"],
): Dossierpaspoort | undefined {
  if (paspoort === undefined) return undefined;

  const geprojecteerd: Dossierpaspoort = {
    ...(paspoort.woningtype ? { woningtype: paspoort.woningtype } : {}),
    ...(paspoort.bouwjaar === undefined ? {} : { bouwjaar: paspoort.bouwjaar }),
    ...(paspoort.woonoppervlakte === undefined
      ? {}
      : { woonoppervlakte: paspoort.woonoppervlakte }),
    ...(paspoort.perceeloppervlakte === undefined
      ? {}
      : { perceeloppervlakte: paspoort.perceeloppervlakte }),
    ...(paspoort.energielabel ? { energielabel: paspoort.energielabel } : {}),
    ...(paspoort.energielabelRegistratie
      ? { energielabelRegistratie: paspoort.energielabelRegistratie }
      : {}),
  };

  return Object.keys(geprojecteerd).length === 0 ? undefined : geprojecteerd;
}

function maakDossieronderdeel(
  onderdeel: OnderdeelMetId,
  betrokkeneOp: ReadonlyMap<string, BetrokkeneMetId>,
  vandaag: Date,
): Dossieronderdeel {
  // De specvolgorde volgt de bibliotheek, zodat "Vermogen" boven "Bouwjaar"
  // staat en niet alfabetisch ertussenuit valt. Eigen sleutels komen erachter.
  const standaard = standaardOnderdeelVoor(onderdeel.naam);
  const volgorde = standaard?.specs.map((s) => s.sleutel) ?? [];

  const installateur = onderdeel.installateurBetrokkeneId
    ? betrokkeneOp.get(onderdeel.installateurBetrokkeneId)
    : undefined;

  return {
    id: onderdeel.id,
    naam: onderdeel.naam,
    categorie: onderdeel.categorie,
    garantie: berekenGarantieklok(onderdeel, vandaag),
    specs: ordenSpecs(onderdeel.specs, volgorde),
    ...(onderdeel.merk ? { merk: onderdeel.merk } : {}),
    ...(onderdeel.type ? { type: onderdeel.type } : {}),
    ...(onderdeel.serienummer ? { serienummer: onderdeel.serienummer } : {}),
    ...(onderdeel.installatieDatum ? { installatieDatum: onderdeel.installatieDatum } : {}),
    // Alleen de bedrijfsnaam. `installateur.contactpersoon`, `.email` en
    // `.telefoon` bestaan wél op het model maar horen niet in een document dat
    // naar een onbekende koper gaat (ADR-0016 §5).
    ...(installateur ? { installateur: installateur.naam } : {}),
    ...(registratieOpenstaand(onderdeel) && onderdeel.registratieplicht
      ? { meldplichtOpen: onderdeel.registratieplicht.instantie }
      : {}),
    ...(onderdeel.notitie ? { notitie: onderdeel.notitie } : {}),
  };
}

/**
 * Het logboek, nieuwste eerst — maar alleen wat over de wóning gaat.
 *
 * DRIE GEVALLEN, EN HET VERSCHIL TUSSEN DE LAATSTE TWEE IS DE HELE FUNCTIE:
 *
 * | `onderdeelId` wijst naar | Wat er gebeurt |
 * | --- | --- |
 * | een onderdeel dat bij de woning blijft | naam erbij, kosten tellen mee |
 * | een onderdeel dat MEEVERHUIST | de regel valt weg |
 * | niets (leeg, of een verwijderd onderdeel) | blijft staan als "Onderhoud" |
 *
 * Het middelste geval is waarom deze functie bestaat. Kreeg hij alleen de hele
 * onderdelenlijst mee, dan stond de thuisbatterij die de verkoper meeneemt
 * alsnog met naam en al in het gedrukte logboek — en telden de kosten ervan mee
 * in "wat dit huis kost aan onderhoud". Precies de belofte die ADR-0013 §2 en
 * ADR-0016 §4 aan de koper doen, gebroken via de achterdeur.
 *
 * Het laatste geval is bewust ánders behandeld. Een verwijderd onderdeel is
 * geen belofte aan de koper maar een gat in de administratie: het apparaat kan
 * er nog gewoon hangen. Die regel weggooien zou de historie stil laten
 * uitdunnen, en die is bij verkoop het waardevolste deel van het dossier
 * (ADR-0010). Onder een neutrale noemer blijft hij staan.
 */
function maakLogboek(
  logboek: readonly OnderhoudLogregelMetId[],
  alleOnderdelen: readonly OnderdeelMetId[],
  blijvend: readonly OnderdeelMetId[],
): Dossierlogregel[] {
  const naamVan = new Map(blijvend.map((o) => [o.id, o.naam]));
  const vertrekt = new Set(
    alleOnderdelen.filter((o) => !o.blijftBijWoning).map((o) => o.id),
  );

  return [...logboek]
    .filter((regel) => regel.onderdeelId === undefined || !vertrekt.has(regel.onderdeelId))
    .sort((a, b) => b.uitgevoerdOp.getTime() - a.uitgevoerdOp.getTime())
    .map((regel) => ({
      id: regel.id,
      uitgevoerdOp: regel.uitgevoerdOp,
      wat:
        (regel.onderdeelId === undefined ? undefined : naamVan.get(regel.onderdeelId)) ??
        "Onderhoud",
      ...(regel.doorWie ? { doorWie: regel.doorWie } : {}),
      ...(regel.kosten === undefined ? {} : { kosten: regel.kosten }),
      ...(regel.notitie ? { notitie: regel.notitie } : {}),
    }));
}

/**
 * De laatste stand per meter op of vóór de overdrachtsdatum.
 *
 * Op óf vóór, en niet gewoon "de laatste": stel je een dossier samen voor een
 * overdracht die vorige maand plaatsvond, dan hoort de stand van vorige week er
 * niet in. De nieuwe eigenaar rekent af tot de overdrachtsdatum.
 *
 * Een meter zonder opname blijft in de lijst staan, met een lege stand. Dat is
 * zichtbaar onvolledig, en dat is beter dan een meter die stilzwijgend
 * ontbreekt in een document dat de eindafrekening moet onderbouwen.
 */
function maakMeterstanden(
  meters: readonly MeterMetId[],
  standen: readonly MeterstandMetId[],
  overdrachtOp: Date,
): Dossiermeterstand[] {
  return [...meters]
    .sort((a, b) => {
      // Dezelfde volgorde als op `/meterstanden`: stroom vóór gas vóór water,
      // eigen meters achteraan. Zonder deze sortering staat het dossier in
      // Firestore-document-id-volgorde, en dat is willekeurig.
      const opSoort = soortVolgorde(a.soort) - soortVolgorde(b.soort);
      if (opSoort !== 0) return opSoort;
      return meternaamVan(a).localeCompare(meternaamVan(b), "nl");
    })
    .map((meter) => {
      const bruikbaar = standen
        .filter(
          (s) => s.meterId === meter.id && s.opgenomenOp.getTime() <= overdrachtOp.getTime(),
        )
        .sort((a, b) => {
          const opDatum = a.opgenomenOp.getTime() - b.opgenomenOp.getTime();
          return opDatum !== 0 ? opDatum : a.id.localeCompare(b.id);
        });

      const laatste = bruikbaar.at(-1);
      const voorlaatste = bruikbaar.at(-2);

      return {
        meterId: meter.id,
        naam: meternaamVan(meter),
        eenheid: toonEenheid(meter.eenheid),
        decimalen: decimalenVan(meter),
        // Twee opnames op dezelfde dag: welke hier getoond wordt hangt af van
        // het document-id, en dat is willekeurig. Dat wordt gemeld en niet
        // stilzwijgend gekozen — hier hangt de eindafrekening aan.
        meerdereOpDag: opDezelfdeDag(laatste, voorlaatste),
        ...(laatste === undefined
          ? {}
          : { stand: laatste.stand, opgenomenOp: laatste.opgenomenOp }),
      };
    });
}

/**
 * Vallen deze twee opnames op dezelfde dag?
 *
 * MET EEN VROEGE RETURN EN NIET MET EEN `&&`-KETEN, en dat is geen stijlkwestie.
 * `prefer-optional-chain` stelt bij zo'n keten voor om er
 * `a?.opgenomenOp.getTime() === b?.opgenomenOp.getTime()` van te maken — en dan
 * levert een meter zónder opnames `undefined === undefined` op, dus `true`.
 * Een meter waar nog nooit iets bij genoteerd is zou dan melden dat er twee
 * opnames op dezelfde dag staan.
 *
 * Dat is dezelfde fout als de koppelingsbug uit sessie 06, en hij zou hier via
 * een lintfix binnenkomen. Vandaar deze vorm: er valt niets te ketenen.
 */
function opDezelfdeDag(
  a: MeterstandMetId | undefined,
  b: MeterstandMetId | undefined,
): boolean {
  if (a === undefined || b === undefined) return false;
  return a.opgenomenOp.getTime() === b.opgenomenOp.getTime();
}

/** De positie van een metersoort in de bibliotheek; onbekend gaat achteraan. */
function soortVolgorde(soort: MeterMetId["soort"]): number {
  const i = METERBIBLIOTHEEK.findIndex((m) => m.soort === soort);
  return i === -1 ? METERBIBLIOTHEEK.length : i;
}

/**
 * De bedrijven die aan de blijvende onderdelen hebben gewerkt.
 *
 * Alleen partijen die daadwerkelijk aan iets gekoppeld zijn: de volledige
 * betrokkenenlijst uit het bouwtraject bevat ook de notaris, de bank en het
 * verhuisbedrijf, en die hebben niets met de wóning te maken.
 */
function maakBetrokkenen(
  betrokkenen: readonly BetrokkeneMetId[],
  blijvend: readonly OnderdeelMetId[],
): Dossierbetrokkene[] {
  const werkPer = new Map<string, string[]>();

  for (const onderdeel of blijvend) {
    const id = onderdeel.installateurBetrokkeneId;
    if (id === undefined) continue;
    const bestaand = werkPer.get(id);
    if (bestaand) bestaand.push(onderdeel.naam);
    else werkPer.set(id, [onderdeel.naam]);
  }

  return betrokkenen
    .filter((b) => werkPer.has(b.id))
    .map((b) => ({
      id: b.id,
      naam: b.naam,
      categorie: b.categorie,
      werk: (werkPer.get(b.id) ?? []).sort((a, c) => a.localeCompare(c, "nl")),
    }))
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

/**
 * Wat het dossier minder bruikbaar maakt voor een koper.
 *
 * Bewust géén blokkade: een half dossier is beter dan geen dossier, en de
 * gebruiker beslist zelf wanneer hij hem afdrukt. Maar het is wél het moment
 * waarop een ontbrekend energielabel of een niet-aangemelde thuisbatterij een
 * consequentie krijgt, en dan hoort het op het scherm te staan — vóór het
 * printen, niet erna.
 */
function bepaalAandachtspunten(
  project: ProjectMetId,
  blijvend: readonly OnderdeelMetId[],
  logboek: readonly Dossierlogregel[],
  meterstanden: readonly Dossiermeterstand[],
  vandaag: Date,
): string[] {
  const punten: string[] = [];
  const paspoort = project.woningpaspoort;

  if (!adresregel(paspoort)) {
    punten.push("Er staat nog geen adres in het woningpaspoort — het voorblad blijft dan leeg.");
  }

  const label = bepaalEnergielabelstand(paspoort, vandaag);
  if (label === null) {
    punten.push(
      "Er is geen opnamedatum van het energielabel ingevuld, dus de geldigheid is onbekend. " +
        "Bij verkoop heb je een geldig label nodig.",
    );
  } else if (label.verlopen) {
    punten.push(
      "Het energielabel is verlopen. Het is dan ook uit EP-online verdwenen, en bij verkoop " +
        "heb je een geldig label nodig.",
    );
  }

  const meldplicht = blijvend.filter(registratieOpenstaand);
  if (meldplicht.length > 0) {
    punten.push(
      meldplicht.length === 1
        ? `Voor ${meldplicht[0]?.naam ?? "een onderdeel"} staat de meldplicht nog open. ` +
            "Die verplichting gaat mee naar de nieuwe eigenaar."
        : `Bij ${meldplicht.length} onderdelen staat de meldplicht nog open. Die ` +
            "verplichtingen gaan mee naar de nieuwe eigenaar.",
    );
  }

  const zonderSerienummer = blijvend.filter((o) => !o.serienummer).length;
  if (zonderSerienummer > 0) {
    punten.push(
      zonderSerienummer === 1
        ? "Van één onderdeel ontbreekt het serienummer — dat is wat een monteur als eerste vraagt."
        : `Van ${zonderSerienummer} onderdelen ontbreekt het serienummer — dat is wat een ` +
            "monteur als eerste vraagt.",
    );
  }

  if (blijvend.length === 0) {
    punten.push(
      "Er staan nog geen onderdelen in het register die bij de woning blijven. Het dossier " +
        "is dan vrijwel leeg.",
    );
  }

  if (logboek.length === 0) {
    punten.push(
      "Het onderhoudslogboek is nog leeg. Dat is bij verkoop het waardevolste deel van het " +
        "dossier, en het is niet achteraf te reconstrueren.",
    );
  }

  if (meterstanden.length === 0) {
    punten.push(
      "Er zijn geen meters vastgelegd, dus er staan geen standen op het dossier voor de " +
        "eindafrekening.",
    );
  } else {
    // Een meter zonder bruikbare stand weegt op dit document zwaarder dan een
    // ontbrekend serienummer: hierop wordt afgerekend met de leverancier.
    const zonderStand = meterstanden.filter((m) => m.stand === undefined);
    if (zonderStand.length > 0) {
      punten.push(
        zonderStand.length === 1
          ? `Van ${zonderStand[0]?.naam ?? "één meter"} is er geen stand op of vóór de ` +
              "overdrachtsdatum. Die regel blijft leeg."
          : `Van ${zonderStand.length} meters is er geen stand op of vóór de ` +
              "overdrachtsdatum. Die regels blijven leeg.",
      );
    }

    const dubbel = meterstanden.filter((m) => m.meerdereOpDag);
    if (dubbel.length > 0) {
      punten.push(
        `Er staan meerdere opnames op dezelfde dag bij ${dubbel
          .map((m) => m.naam)
          .join(", ")}. Welke daarvan in het dossier komt ligt niet vast — verwijder de ` +
          "overbodige opname.",
      );
    }
  }

  return punten;
}
