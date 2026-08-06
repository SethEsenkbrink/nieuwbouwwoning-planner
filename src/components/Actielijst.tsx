import { useState } from "react";
import { Link } from "react-router";
import { Knop } from "@/components/Knop";
import { toonDatum, toonDatumMetAfstand } from "@/lib/datum";
import { maakConceptbericht, mailtoLink, type Berichtopties } from "@/lib/bericht";
import { ANKER_TITELS } from "@/data/ankers";
import type { BetrokkeneMetId } from "@/lib/converters";
import type { ActieRegel, BerekendeBand, Urgentie } from "@/lib/planning";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De actielijst — het punt waarop deze app zich bewijst
 *
 * Elke regel is één afspraak waarvan de berekende datum afwijkt van wat die
 * partij als laatste van je hoorde. Dat verschil ís de lijst (ADR-0008,
 * principe 5): niets meer, niets minder.
 *
 * VIER DINGEN DIE ELKE REGEL MOET DOEN, EN WAAROM
 *
 * 1. WAAROM NU. Een actielijst zonder motivering wordt weggeklikt. `reden`
 *    komt uit `bepaalUrgentie()` en zegt wat er kapotgaat als je niets doet.
 *
 * 2. HOE ZEKER DE DATUM IS. Bij `teruggevallen` is er gerekend vanaf de
 *    oplevering omdat het gevraagde bouwmoment onbekend is. Die datum mag er
 *    nooit uitzien als een harde afspraak (ADR-0009).
 *
 * 3. EEN KANT-EN-KLAAR BERICHT. Zonder tekst blijft doorgeven handwerk in een
 *    ander programma — en dan wordt de doorgegeven-knop niet ingedrukt en
 *    verandert de lijst binnen twee verschuivingen in ruis. De tekst zelf wordt
 *    gemaakt in `src/lib/bericht.ts`, met tests op het voorbehoud.
 *
 * 4. DE DOORGEGEVEN-KNOP. Staat in de regel zelf, direct naast het bericht,
 *    want dat is het moment waarop je hem indrukt.
 *
 * ── Herzien op 2 augustus 2026 (ADR-0018) ─────────────────────────────────
 *
 * De vier punten hierboven staan nog overeind, maar ze stonden alle vier
 * tegelijk open. Veertien partijen × ruim tien regels tekst is drie schermen
 * scrollen voordat je weet of er iets te doen is, en dan lees je ook de twee
 * regels niet meer die er wél toe doen.
 *
 * Nu: dicht is wie, wat, wanneer, hoe dringend, en de knop. De rest komt op
 * één klik. Punt 3 en de motivering uit punt 1 zijn dus niet weg — ze zijn
 * niet meer verplicht om langs te scrollen.
 *
 * DE ZIN "Doorgegeven legt vast dat…" STOND VEERTIEN KEER ONDER VEERTIEN
 * KNOPPEN. Die staat nu één keer boven de lijst, in `Dashboard.tsx`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const URGENTIELABEL: Record<Urgentie, string> = {
  kritiek: "Kritiek",
  hoog: "Nu doorgeven",
  normaal: "Kan nog even",
  wacht: "Wacht op aanzegging",
  geen: "",
};

/** Alleen huisstijlkleuren; geen losse hex-waarden (AGENTS.md). */
const URGENTIESTIJL: Record<Urgentie, string> = {
  kritiek: "bg-clay text-canvas",
  hoog: "bg-clay/15 text-clay-deep",
  normaal: "bg-bone text-charcoal",
  wacht: "bg-lifted text-granite border border-bone",
  geen: "",
};

/** Eén datum als de band een punt is, anders het bereik. */
function toonBand(band: BerekendeBand): string {
  return band.isPunt
    ? toonDatum(band.verwacht)
    : `tussen ${toonDatum(band.vroegst)} en ${toonDatum(band.laatst)}`;
}

function Zekerheid({ band }: { band: BerekendeBand }) {
  if (band.zekerheid === "teruggevallen") {
    return (
      <p className="mt-1 text-sm text-clay-deep">
        Gerekend vanaf de oplevering — “{ANKER_TITELS[band.gevraagdAnker]}” is nog niet bekend.{" "}
        <Link to="/ankers" className="underline">
          Datum invullen
        </Link>
      </p>
    );
  }

  return (
    <p className="mt-1 text-sm text-slate">
      {band.zekerheid === "anker_bevestigd"
        ? `Op basis van een bevestigd bouwmoment (${ANKER_TITELS[band.gebruiktAnker]}).`
        : `Op basis van een verwachte datum (${ANKER_TITELS[band.gebruiktAnker]}) — die kan nog schuiven.`}
    </p>
  );
}

/**
 * Het concept-bericht, uitklapbaar per regel.
 *
 * De tekst staat in een bewerkbaar tekstvlak: het is een cóncept. De gebruiker
 * kent zijn leverancier en mag er alles aan veranderen voordat het de deur uit
 * gaat. Verstuurd wordt er niets vanuit de app — kopiëren of het eigen
 * mailprogramma openen, en dan zie je zelf nog wat je verstuurt.
 */
function Berichtblok({
  regel,
  betrokkene,
  opties,
}: {
  regel: ActieRegel;
  betrokkene: BetrokkeneMetId | undefined;
  opties: Berichtopties;
}) {
  const [open, setOpen] = useState(false);
  const [tekst, setTekst] = useState("");
  const [kopieerstatus, setKopieerstatus] = useState<"stil" | "gelukt" | "mislukt">("stil");

  const bericht = maakConceptbericht(regel, betrokkene?.contactpersoon, opties);
  const email = betrokkene?.email;

  function openen() {
    setTekst(bericht.tekst);
    setKopieerstatus("stil");
    setOpen(true);
  }

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(`${bericht.onderwerp}\n\n${tekst}`);
      setKopieerstatus("gelukt");
    } catch {
      // Kan mislukken zonder toestemming of buiten een beveiligde context.
      setKopieerstatus("mislukt");
    }
  }

  if (!open) {
    return (
      <Knop
        variant="secundair"
        onClick={() => {
          openen();
        }}
      >
        Bericht opstellen
      </Knop>
    );
  }

  return (
    <div className="mt-s2 w-full rounded-consent border border-bone bg-lifted p-s3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-body font-semibold text-ink">Concept-bericht</h4>
        <button
          type="button"
          className="text-sm text-slate underline hover:text-ink"
          onClick={() => {
            setOpen(false);
          }}
        >
          Sluiten
        </button>
      </div>

      <p className="mt-s2 text-sm text-slate">
        Onderwerp: <span className="text-ink">{bericht.onderwerp}</span>
      </p>

      <textarea
        className="mt-s2 w-full rounded-xs border border-bone bg-white px-4 py-3 text-body text-ink"
        rows={14}
        value={tekst}
        onChange={(e) => {
          setTekst(e.target.value);
          setKopieerstatus("stil");
        }}
      />

      <p className="mt-1 text-sm text-granite">
        Pas gerust aan — jij kent deze partij. Er wordt niets vanuit de app verstuurd.
      </p>

      <div className="mt-s2 flex flex-wrap items-center gap-s2">
        <Knop variant="secundair" onClick={() => void kopieer()}>
          Kopieer
        </Knop>

        {email ? (
          <a href={mailtoLink(email, { onderwerp: bericht.onderwerp, tekst })}>
            <Knop variant="secundair">Openen in mail</Knop>
          </a>
        ) : (
          <span className="text-sm text-granite">
            Geen e-mailadres bekend —{" "}
            <Link to="/betrokkenen" className="underline">
              vul het in bij deze partij
            </Link>
          </span>
        )}

        {kopieerstatus === "gelukt" && <span className="text-sm text-olive-deep">Gekopieerd.</span>}
        {kopieerstatus === "mislukt" && (
          <span className="text-sm text-clay-deep">
            Kopiëren lukte niet — selecteer de tekst hierboven.
          </span>
        )}
      </div>
    </div>
  );
}

interface ActielijstProps {
  regels: readonly ActieRegel[];
  betrokkenen: readonly BetrokkeneMetId[];
  berichtopties: Berichtopties;
  /** Het id van de afspraak waarvoor nu een schrijfactie loopt. */
  bezigMetId: string | null;
  onDoorgegeven: (regel: ActieRegel) => void;
  /** Vandaag, voor de relatieve datumweergave. */
  nu: Date;
}

/**
 * Eén regel — dicht, tot je hem opent.
 *
 * Wat er dicht staat is precies genoeg om te beslissen óf je hier iets mee
 * moet: wie, wat, wanneer, hoe dringend, en de knop die het afhandelt. Al het
 * andere — herkomst van de datum, wat die partij nu weet, tot wanneer je
 * kosteloos kunt schuiven, de inhoudelijke waarschuwing en het concept-bericht
 * — verschijnt zodra je hem opent.
 *
 * DE KNOP STAAT BUITEN DE UITKLAP. "Doorgegeven" is de handeling die de hele
 * module draaiende houdt (ADR-0008, principe 5); die achter een extra klik
 * zetten is precies de manier om hem niet ingedrukt te krijgen.
 */
function Actieregel({
  regel,
  betrokkene,
  berichtopties,
  bezig,
  onDoorgegeven,
  nu,
}: {
  regel: ActieRegel;
  betrokkene: BetrokkeneMetId | undefined;
  berichtopties: Berichtopties;
  bezig: boolean;
  onDoorgegeven: (regel: ActieRegel) => void;
  nu: Date;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article className="brink-card p-s3">
      <div className="flex flex-wrap items-baseline gap-x-s2 gap-y-1">
        <h3 className="text-body font-semibold text-ink">
          {regel.betrokkeneNaam} — {regel.omschrijving}
        </h3>
        {URGENTIELABEL[regel.urgentie] !== "" && (
          <span className={`rounded-pill px-3 py-1 text-sm ${URGENTIESTIJL[regel.urgentie]}`}>
            {URGENTIELABEL[regel.urgentie]}
          </span>
        )}
        <span className="ml-auto text-body text-ink">
          {regel.berekend.isPunt
            ? toonDatumMetAfstand(regel.berekend.verwacht, nu)
            : toonBand(regel.berekend)}
        </span>
      </div>

      <div className="mt-s2 flex flex-wrap items-center gap-s2">
        <Knop
          bezig={bezig}
          onClick={() => {
            onDoorgegeven(regel);
          }}
        >
          Doorgegeven
        </Knop>
        <button
          type="button"
          className="text-sm text-slate underline hover:text-ink"
          aria-expanded={open}
          onClick={() => {
            setOpen((b) => !b);
          }}
        >
          {open ? "Minder" : "Details en bericht"}
        </button>
      </div>

      {open && (
        <div className="mt-s3 border-t border-bone pt-s3">
          <Zekerheid band={regel.berekend} />
          <p className="mt-s2 text-body text-charcoal">{regel.reden}</p>

          <dl className="mt-s2 grid grid-cols-[auto_1fr] gap-x-s2 gap-y-1 text-sm">
            <dt className="text-slate">Zij weten nu</dt>
            <dd className="text-ink">
              {regel.gecommuniceerdeDatum
                ? `${toonDatum(regel.gecommuniceerdeDatum)} (${
                    regel.verschilDagen === undefined || regel.verschilDagen === 0
                      ? "gelijk"
                      : `${Math.abs(regel.verschilDagen)} dagen ${
                          regel.verschilDagen > 0 ? "later" : "eerder"
                        }`
                  })`
                : "nog niets — deze afspraak is nooit doorgegeven"}
            </dd>

            {regel.laatsteGratisSchuifdatum && (
              <>
                <dt className="text-slate">Kosteloos verzetten</dt>
                <dd className="text-ink">tot {toonDatum(regel.laatsteGratisSchuifdatum)}</dd>
              </>
            )}
          </dl>

          {regel.waarschuwing && (
            <p className="mt-s2 rounded-consent border border-taupe/40 bg-bone px-4 py-3 text-sm text-charcoal">
              {regel.waarschuwing}
            </p>
          )}

          <div className="mt-s3">
            <Berichtblok regel={regel} betrokkene={betrokkene} opties={berichtopties} />
          </div>
        </div>
      )}
    </article>
  );
}

export function Actielijst({
  regels,
  betrokkenen,
  berichtopties,
  bezigMetId,
  onDoorgegeven,
  nu,
}: ActielijstProps) {
  const perId = new Map(betrokkenen.map((b) => [b.id, b]));

  return (
    <div className="flex flex-col gap-s2">
      {regels.map((regel) => (
        <Actieregel
          key={regel.afspraakId}
          regel={regel}
          betrokkene={perId.get(regel.betrokkeneId)}
          berichtopties={berichtopties}
          bezig={bezigMetId === regel.afspraakId}
          onDoorgegeven={onDoorgegeven}
          nu={nu}
        />
      ))}
    </div>
  );
}
