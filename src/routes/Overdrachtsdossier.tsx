import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Datumveld } from "@/components/Datumveld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useVault as useAuth } from "@/context/useVault";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum, vandaag } from "@/lib/datum";
import { toonBedrag } from "@/lib/bedrag";

import { isOpgeleverd } from "@/lib/woning";
import { toonStand } from "@/lib/meterstanden";
import { stelDossierSamen, type Overdrachtsdossier } from "@/lib/overdracht";
import { ONDERDEELCATEGORIEEN } from "@/data/onderdelen-standaard";
import { WONINGTYPEOPTIES } from "@/data/woning-opties";
import { WAARBORGOPTIES } from "@/data/project-opties";
import {
  haalActiefProject,
  haalBetrokkenen,
  haalMeters,
  haalMeterstanden,
  haalOnderdelen,
  haalOnderhoudslogboek,
} from "@/lib/projecten";
import type {
  BetrokkeneMetId,
  MeterMetId,
  MeterstandMetId,
  OnderdeelMetId,
  OnderhoudLogregelMetId,
  ProjectMetId,
} from "@/lib/converters";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Het overdrachtsdossier (ADR-0016, blok E8)
 *
 * DIT SCHERM IS HET DOCUMENT. Wat je op het scherm ziet is exact wat er uit de
 * printer komt — er is geen aparte printsjabloon. Alles wat er niet in hoort
 * (uitleg, de datumkeuze, de knop, de aandachtspunten) draagt de class
 * `niet-printen` en verdwijnt bij het afdrukken.
 *
 * GEEN PDF-BIBLIOTHEEK. De browser maakt de PDF via "Opslaan als PDF". Dat
 * scheelt ~150 kB bundel en, belangrijker, het houdt de huisstijl op één plek:
 * dit dossier gebruikt `text-ink`, `border-bone` en `text-clay` net als de rest
 * van de app, en `verify:tokens` bewaakt die waarden. Zie ADR-0016 §1.
 *
 * HET ONTWERP HANGT NIET VAN ACHTERGRONDKLEUREN AF. Browsers printen die
 * standaard niet. De structuur komt daarom uit lijnen, kaders en accentkleur op
 * tekst — dat print altijd. Zie ADR-0016 §3 en `src/styles/print.css`.
 *
 * ALLE REKENWERK ZIT IN `lib/overdracht.ts` en weet niets van HTML. Blijkt de
 * printroute ooit te kort te schieten, dan komt er een andere weergavelaag
 * achter diezelfde structuur.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CATEGORIELABEL: Record<string, string> = Object.fromEntries(
  ONDERDEELCATEGORIEEN.map((c) => [c.waarde, c.label]),
);
const WONINGTYPELABEL: Record<string, string> = Object.fromEntries(
  WONINGTYPEOPTIES.map((t) => [t.waarde, t.label]),
);
const WAARBORGLABEL: Record<string, string> = Object.fromEntries(
  WAARBORGOPTIES.map((w) => [w.waarde, w.label]),
);

export default function OverdrachtsdossierScherm() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [onderdelen, setOnderdelen] = useState<OnderdeelMetId[]>([]);
  const [logboek, setLogboek] = useState<OnderhoudLogregelMetId[]>([]);
  const [meters, setMeters] = useState<MeterMetId[]>([]);
  const [meterstanden, setMeterstanden] = useState<MeterstandMetId[]>([]);
  const [betrokkenen, setBetrokkenen] = useState<BetrokkeneMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [bezigMetVerversen, setBezigMetVerversen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  // De overdrachtsdatum is een parameter van dít document en gaat NIET naar
  // Firestore (ADR-0016 §6). Een woning kan meerdere keren overgedragen worden,
  // en een concept-dossier hoort de projectgegevens niet te veranderen.
  const [overdrachtOp, setOverdrachtOp] = useState<Date | undefined>(undefined);

  const [herlaadTeller, setHerlaadTeller] = useState(0);
  const herlaad = useCallback(() => {
    setHerlaadTeller((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let actueel = true;

    void (async () => {
      try {
        const gevonden = await haalActiefProject(uid);
        if (!actueel) return;

        if (!gevonden) {
          setProject(null);
          return;
        }

        const [
          geladenOnderdelen,
          geladenLogboek,
          geladenMeters,
          geladenStanden,
          geladenBetrokkenen,
        ] = await Promise.all([
          haalOnderdelen(uid, gevonden.id),
          haalOnderhoudslogboek(uid, gevonden.id),
          haalMeters(uid, gevonden.id),
          haalMeterstanden(uid, gevonden.id),
          haalBetrokkenen(uid, gevonden.id),
        ]);
        if (!actueel) return;

        setProject(gevonden);
        setOnderdelen(geladenOnderdelen);
        setLogboek(geladenLogboek);
        setMeters(geladenMeters);
        setMeterstanden(geladenStanden);
        setBetrokkenen(geladenBetrokkenen);
      } catch (f) {
        if (actueel) setFout(opslagFoutmelding(f, "Laden"));
      } finally {
        if (actueel) {
          setBezigMetLaden(false);
          setBezigMetVerversen(false);
        }
      }
    })();

    return () => {
      actueel = false;
    };
  }, [uid, herlaadTeller]);

  if (bezigMetLaden) return <Laadscherm />;

  if (!project) {
    return (
      <AppShell>
        <h1 className="text-h2 text-ink">Overdrachtsdossier</h1>
        <p className="mt-s3 max-w-2xl text-body text-slate">
          Er is nog geen project. Maak er eerst één aan.
        </p>
        <div className="mt-s3">
          <Link to="/project/nieuw" className="underline">
            Project aanmaken
          </Link>
        </div>
      </AppShell>
    );
  }

  const nu = vandaag();
  const datum = overdrachtOp ?? nu;
  const dossier = stelDossierSamen(
    { project, onderdelen, logboek, meters, meterstanden, betrokkenen },
    datum,
    nu,
  );

  return (
    <AppShell>
      {/* ── Alles hierboven de streep is bediening en gaat niet mee ────── */}
      <div className="niet-printen">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
          <span className="text-eyebrow uppercase text-slate">Woning</span>
        </div>

        {/* Een `h2`, niet een `h1`: de `h1` van deze pagina is de adrestitel op
            het voorblad van het document zelf. Twee `h1`'s naast elkaar is een
            kapotte kopstructuur voor een schermlezer. */}
        <h2 className="mt-s2 text-h2 text-ink">Overdrachtsdossier</h2>
        <p className="mt-s2 max-w-2xl text-body text-slate">
          Alles wat bij de woning hoort in één document: het paspoort, wat erin zit, wat eraan
          gedaan is en de meterstanden. Wat je hieronder ziet is precies wat er uit de printer
          komt.
        </p>

        {!isOpgeleverd(project) && (
          <div className="mt-s3 max-w-2xl">
            <Melding soort="info">
              De woning staat nog op “in aanbouw”. Je kunt het dossier alvast bekijken, maar het
              is bedoeld voor het moment dat je de woning overdraagt.{" "}
              <Link to="/woning" className="underline">
                Fase aanpassen
              </Link>
            </Melding>
          </div>
        )}

        {fout && (
          <div className="mt-s3 max-w-2xl">
            <Melding soort="fout">{fout}</Melding>
          </div>
        )}

        <div className="mt-s4 max-w-2xl">
          <Datumveld
            label="Datum van overdracht"
            hint="Bepaalt het voorblad en tot welk moment de meterstanden meetellen. Deze datum wordt niet opgeslagen."
            waarde={overdrachtOp}
            onKies={setOverdrachtOp}
          />
        </div>

        {dossier.aandachtspunten.length > 0 && (
          <section className="mt-s4 max-w-2xl">
            <h2 className="text-h3 text-ink">Voordat je dit afdrukt</h2>
            <p className="mt-s2 text-body text-slate">
              Het dossier werkt ook zonder deze punten, maar ze maken hem minder bruikbaar voor
              een koper.
            </p>
            <ul className="mt-s3 flex flex-col gap-2">
              {dossier.aandachtspunten.map((punt) => (
                <li key={punt} className="text-body text-slate">
                  • {punt}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-s4 flex flex-wrap items-center gap-s2">
          <Knop
            onClick={() => {
              window.print();
            }}
          >
            Afdrukken of opslaan als PDF
          </Knop>
          <Knop
            variant="secundair"
            bezig={bezigMetVerversen}
            onClick={() => {
              // Zichtbaar terugkoppelen én een oude foutmelding wissen: zonder
              // dit lijkt de knop niets te doen, en bleef een fout van een
              // vorige poging staan na een geslaagde herlaadactie.
              setFout(null);
              setBezigMetVerversen(true);
              herlaad();
            }}
          >
            Gegevens verversen
          </Knop>
        </div>

        <p className="mt-s2 max-w-2xl text-sm text-granite">
          Kies in het printvenster <span className="text-ink">Opslaan als PDF</span> bij
          bestemming. Het dossier is zo ontworpen dat het ook zonder achtergrondkleuren goed
          leesbaar blijft — je hoeft dus niets aan te zetten.
        </p>

        <p className="mt-s2 max-w-2xl text-sm text-granite">
          Let op: de notities die je bij onderdelen en bij het logboek hebt geschreven staan mee
          in het dossier. Contactgegevens van medewerkers en links naar je eigen documenten
          staan er bewust níét in — controleer of je notities die niet alsnog bevatten.
        </p>

        <hr className="mt-s4 border-bone" />
      </div>

      {/* ── Vanaf hier is het het document ─────────────────────────────── */}
      <article className="dossier mt-s4">
        <Voorblad dossier={dossier} />
        <Paspoortsectie dossier={dossier} />
        <Onderdelensectie dossier={dossier} />
        <Logboeksectie dossier={dossier} />
        <Metersectie dossier={dossier} />
        <Betrokkenensectie dossier={dossier} />

        {/* Alleen `dossier-blok` en géén `dossier-sectie`: die laatste dwingt
            een paginabreuk af, en dan staat deze ene alinea op een verder lege
            laatste pagina. */}
        <section className="dossier-blok mt-s6 border-t border-bone pt-s3">
          <p className="text-sm text-granite">
            Dit dossier is samengesteld met Nieuwbouwplanner op {toonDatum(nu)}. Het
            structureert en herinnert; het is geen juridisch of financieel advies. Garantie- en
            geldigheidstermijnen zijn afgeleid uit de ingevulde gegevens — controleer ze tegen de
            oorspronkelijke documenten.
          </p>
        </section>
      </article>
    </AppShell>
  );
}

// ── Voorblad ───────────────────────────────────────────────────────────────

function Voorblad({ dossier }: { dossier: Overdrachtsdossier }) {
  const { kop } = dossier;

  return (
    <section className="dossier-voorblad dossier-blok border-b-2 border-ink pb-s3">
      <p className="text-eyebrow uppercase text-clay">Overdrachtsdossier woning</p>
      {/* `text-h2` en niet `text-h1`: 64px over een kolom van 170mm laat een
          volledig adres over twee bijna-rakende regels lopen. De rest van de
          app gebruikt om dezelfde reden nergens `text-h1`. */}
      <h1 className="mt-s2 text-h2 text-ink">{kop.titel}</h1>

      <dl className="mt-s3 flex flex-col gap-1">
        <Regel label="Datum van overdracht" waarde={toonDatum(kop.overdrachtOp)} />
        {kop.opgeleverdOp && (
          <Regel label="Opgeleverd op" waarde={toonDatum(kop.opgeleverdOp)} />
        )}
        {kop.garantiewaarborg && (
          <Regel
            label="Garantiewaarborg"
            waarde={WAARBORGLABEL[kop.garantiewaarborg] ?? kop.garantiewaarborg}
          />
        )}
        {/* Los van de waarborg: die staat op het project, het polisnummer in
            het paspoort. Wie alleen het polisnummer invulde zou het anders
            nergens terugzien. */}
        {kop.waarborgpolisnummer && (
          <Regel label="Polisnummer" waarde={kop.waarborgpolisnummer} />
        )}
      </dl>
    </section>
  );
}

/** Eén label-waarderegel. Overal hetzelfde, zodat de kolom netjes uitlijnt. */
function Regel({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <dt className="min-w-52 text-body text-slate">{label}</dt>
      <dd className="text-body text-ink">{waarde}</dd>
    </div>
  );
}

function Sectiekop({ titel, uitleg }: { titel: string; uitleg?: string }) {
  return (
    <>
      <h2 className="border-b border-ink pb-1 text-h3 text-ink">{titel}</h2>
      {uitleg && <p className="mt-s2 text-sm text-granite">{uitleg}</p>}
    </>
  );
}

// ── Woningpaspoort ─────────────────────────────────────────────────────────

function Paspoortsectie({ dossier }: { dossier: Overdrachtsdossier }) {
  const p = dossier.paspoort;
  const label = dossier.energielabel;

  return (
    <section className="dossier-sectie mt-s4">
      <Sectiekop titel="Woningpaspoort" />

      {p === undefined && dossier.kop.adres === null ? (
        <p className="mt-s3 text-body text-slate">Nog niet ingevuld.</p>
      ) : (
        <dl className="mt-s3 flex flex-col gap-1">
          {dossier.kop.adres && <Regel label="Adres" waarde={dossier.kop.adres} />}
          {p?.woningtype && (
            <Regel label="Woningtype" waarde={WONINGTYPELABEL[p.woningtype] ?? p.woningtype} />
          )}
          {p?.bouwjaar !== undefined && <Regel label="Bouwjaar" waarde={String(p.bouwjaar)} />}
          {p?.woonoppervlakte !== undefined && (
            <Regel label="Woonoppervlakte" waarde={`${p.woonoppervlakte} m²`} />
          )}
          {p?.perceeloppervlakte !== undefined && (
            <Regel label="Perceeloppervlakte" waarde={`${p.perceeloppervlakte} m²`} />
          )}
          {p?.energielabel && <Regel label="Energielabel" waarde={p.energielabel} />}
          {p?.energielabelRegistratie && (
            <Regel label="Registratie EP-online" waarde={p.energielabelRegistratie} />
          )}
          {/* De vervaldatum is afgeleid uit de opnamedatum plus tien jaar en
              staat nergens opgeslagen (ADR-0013 §4). */}
          {label && (
            <Regel
              label="Energielabel geldig tot"
              waarde={
                toonDatum(label.verlooptOp) + (label.verlopen ? " — verlopen" : "")
              }
            />
          )}
        </dl>
      )}
    </section>
  );
}

// ── Onderdelen ─────────────────────────────────────────────────────────────

function Onderdelensectie({ dossier }: { dossier: Overdrachtsdossier }) {
  return (
    <section className="dossier-sectie mt-s4">
      <Sectiekop
        titel="Wat er in de woning zit"
        uitleg={
          dossier.verhuistMee === 0
            ? "Alles wat hier staat blijft bij de woning."
            : `Alles wat hier staat blijft bij de woning. ${
                dossier.verhuistMee === 1
                  ? "Eén onderdeel verhuist mee en staat er daarom niet bij."
                  : `${dossier.verhuistMee} onderdelen verhuizen mee en staan er daarom niet bij.`
              }`
        }
      />

      {dossier.onderdelen.length === 0 ? (
        <p className="mt-s3 text-body text-slate">
          Er zijn nog geen onderdelen vastgelegd die bij de woning blijven.
        </p>
      ) : (
        <div className="mt-s3 flex flex-col gap-s3">
          {dossier.onderdelen.map((o) => (
            <div key={o.id} className="dossier-blok border-l-2 border-bone pl-s2">
              <h3 className="text-body font-semibold text-ink">
                {o.naam}
                {o.merk && ` — ${o.merk}`}
                {o.type && ` ${o.type}`}
              </h3>
              <p className="text-sm text-granite">
                {CATEGORIELABEL[o.categorie] ?? o.categorie}
              </p>

              <dl className="mt-s2 flex flex-col gap-1">
                {o.serienummer && <Regel label="Serienummer" waarde={o.serienummer} />}
                {o.installatieDatum && (
                  <Regel label="Geïnstalleerd op" waarde={toonDatum(o.installatieDatum)} />
                )}
                {/* Alleen de bedrijfsnaam, nooit een contactpersoon of
                    telefoonnummer (ADR-0016 §5). */}
                {o.installateur && <Regel label="Geïnstalleerd door" waarde={o.installateur} />}
                {o.garantie && (
                  <Regel
                    label="Fabrieksgarantie tot"
                    waarde={
                      toonDatum(o.garantie.verstrijktOp) +
                      (o.garantie.voorbij ? " — verlopen" : "")
                    }
                  />
                )}
                {o.specs.map((s) => (
                  <Regel key={s.sleutel} label={s.sleutel} waarde={s.waarde} />
                ))}
              </dl>

              {o.meldplichtOpen && (
                <p className="mt-s2 text-sm text-clay-deep">
                  Let op: dit onderdeel is nog niet aangemeld bij {o.meldplichtOpen}. Die
                  verplichting gaat mee naar de nieuwe eigenaar.
                </p>
              )}

              {o.notitie && <p className="mt-s2 text-sm text-slate">{o.notitie}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Onderhoudslogboek ──────────────────────────────────────────────────────

function Logboeksectie({ dossier }: { dossier: Overdrachtsdossier }) {
  return (
    <section className="dossier-sectie mt-s4">
      <Sectiekop
        titel="Onderhoudslogboek"
        uitleg="Wat er aan de woning gedaan is, nieuwste eerst."
      />

      {dossier.logboek.length === 0 ? (
        <p className="mt-s3 text-body text-slate">Er is nog geen onderhoud vastgelegd.</p>
      ) : (
        <>
          {/* Een echte tabel, zodat `thead` zich bij het printen bovenaan elke
              pagina herhaalt. Een flex- of grid-lay-out breekt dat. */}
          <table className="mt-s3 w-full text-body">
            <thead>
              <tr>
                <th className="text-left text-sm text-slate">Datum</th>
                <th className="text-left text-sm text-slate">Wat</th>
                <th className="text-left text-sm text-slate">Door</th>
                <th className="text-left text-sm text-slate">Kosten</th>
              </tr>
            </thead>
            <tbody>
              {dossier.logboek.map((r) => (
                <tr key={r.id} className="border-b border-bone align-top">
                  <td className="py-1 pr-2 text-ink">{toonDatum(r.uitgevoerdOp)}</td>
                  <td className="py-1 pr-2 text-ink">
                    {r.wat}
                    {r.notitie && <span className="block text-sm text-slate">{r.notitie}</span>}
                  </td>
                  <td className="py-1 pr-2 text-ink">{r.doorWie ?? "—"}</td>
                  <td className="py-1 text-ink">
                    {r.kosten === undefined ? "—" : toonBedrag(r.kosten)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {dossier.logboekKosten > 0 && (
            <p className="mt-s2 text-sm text-granite">
              Totaal aan vastgelegde onderhoudskosten: {toonBedrag(dossier.logboekKosten)}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ── Meterstanden ───────────────────────────────────────────────────────────

function Metersectie({ dossier }: { dossier: Overdrachtsdossier }) {
  return (
    <section className="dossier-sectie mt-s4">
      <Sectiekop
        titel="Meterstanden bij overdracht"
        uitleg={`De laatste stand per meter op of vóór ${toonDatum(dossier.kop.overdrachtOp)}.`}
      />

      {dossier.meterstanden.length === 0 ? (
        <p className="mt-s3 text-body text-slate">Er zijn geen meters vastgelegd.</p>
      ) : (
        <table className="mt-s3 w-full text-body">
          <thead>
            <tr>
              <th className="text-left text-sm text-slate">Meter</th>
              <th className="text-left text-sm text-slate">Stand</th>
              <th className="text-left text-sm text-slate">Opgenomen op</th>
            </tr>
          </thead>
          <tbody>
            {dossier.meterstanden.map((m) => (
              <tr key={m.meterId} className="border-b border-bone">
                <td className="py-1 pr-2 text-ink">{m.naam}</td>
                <td className="py-1 pr-2 text-ink">
                  {m.stand === undefined
                    ? "—"
                    : `${toonStand(m.stand, m.decimalen)} ${m.eenheid}`}
                </td>
                <td className="py-1 text-ink">
                  {m.opgenomenOp === undefined ? "geen opname" : toonDatum(m.opgenomenOp)}
                  {m.meerdereOpDag && (
                    <span className="block text-sm text-clay-deep">
                      Er staan meerdere opnames op deze dag — controleer welke klopt.
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ── Betrokkenen ────────────────────────────────────────────────────────────

function Betrokkenensectie({ dossier }: { dossier: Overdrachtsdossier }) {
  if (dossier.betrokkenen.length === 0) return null;

  return (
    <section className="dossier-sectie mt-s4">
      <Sectiekop
        titel="Wie wat heeft geïnstalleerd"
        uitleg="Alleen de bedrijfsnaam. Contactgegevens van medewerkers staan hier bewust niet in."
      />

      <div className="mt-s3 flex flex-col gap-s2">
        {dossier.betrokkenen.map((b) => (
          <div key={b.id} className="dossier-blok">
            <p className="text-body font-semibold text-ink">{b.naam}</p>
            <p className="text-sm text-slate">{b.werk.join(" · ")}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
