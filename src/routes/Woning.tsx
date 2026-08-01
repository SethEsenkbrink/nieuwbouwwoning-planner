import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Keuzeveld } from "@/components/Keuzeveld";
import { Datumveld } from "@/components/Datumveld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useAuth } from "@/context/useAuth";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import { toonDatum } from "@/lib/datum";
import { opDag } from "@/lib/planning";
import {
  ENERGIELABEL_GELDIG_MAANDEN,
  adresregel,
  bepaalEnergielabelstand,
  paspoortstand,
  woningStatusVan,
} from "@/lib/woning";
import {
  ENERGIELABELOPTIES,
  PASPOORTVELDLABELS,
  WONINGSTATUSOPTIES,
  WONINGTYPEOPTIES,
} from "@/data/woning-opties";
import { haalActiefProject, werkWoningpaspoortBij, zetWoningStatus } from "@/lib/projecten";
import type { ProjectMetId, WoningpaspoortData } from "@/lib/converters";
import type { Energielabel, WoningStatus, Woningtype } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De woning — het begin van het woningdossier (ADR-0010, blok E1)
 *
 * Twee blokken die apart opslaan, om dezelfde reden als op
 * `Projectinstellingen`: de fase verandert één keer in het leven van een
 * project, het paspoort vul je in stukjes aan.
 *
 * DE FASE STAAT BOVENAAN, want dat is de omslag van de hele app: van "loods me
 * door de bouw" naar "beheer mijn woning". Hij wordt handmatig omgezet en niet
 * afgeleid uit de opleverdatum — een oplevering kan mislukken en een
 * sleuteloverdracht kan uitgesteld worden (ADR-0010 §1).
 *
 * Het energielabel krijgt een eigen aftelklok. Een label is tien jaar geldig en
 * verloopt stil: is het verlopen, dan is het ook uit EP-online en MijnOverheid
 * verdwenen, en bij verkoop heb je een geldig label nodig.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Formulierwaarden zijn strings; de omzetting naar het model gebeurt bij het opslaan. */
interface Paspoortwaarden {
  adres: string;
  postcode: string;
  plaats: string;
  /**
   * `""` betekent "nog niet gekozen", net als bij het energielabel. Zonder die
   * lege waarde zou de eerste optie uit de lijst bij elke opslag als feit
   * worden vastgelegd — ook als de gebruiker de keuzelijst nooit heeft
   * aangeraakt — en zou `paspoortstand()` het als ingevuld tellen.
   */
  woningtype: Woningtype | "";
  bouwjaar: string;
  woonoppervlakte: string;
  perceeloppervlakte: string;
  energielabel: Energielabel | "";
  energielabelRegistratie: string;
  energielabelOpnameDatum: Date | undefined;
  waarborgpolisnummer: string;
  notaris: string;
  hypotheekverstrekker: string;
}

const LEEG: Paspoortwaarden = {
  adres: "",
  postcode: "",
  plaats: "",
  woningtype: "",
  bouwjaar: "",
  woonoppervlakte: "",
  perceeloppervlakte: "",
  energielabel: "",
  energielabelRegistratie: "",
  energielabelOpnameDatum: undefined,
  waarborgpolisnummer: "",
  notaris: "",
  hypotheekverstrekker: "",
};

function uitPaspoort(paspoort: WoningpaspoortData | undefined): Paspoortwaarden {
  if (!paspoort) return LEEG;
  return {
    adres: paspoort.adres ?? "",
    postcode: paspoort.postcode ?? "",
    plaats: paspoort.plaats ?? "",
    woningtype: paspoort.woningtype ?? "",
    bouwjaar: paspoort.bouwjaar === undefined ? "" : String(paspoort.bouwjaar),
    woonoppervlakte:
      paspoort.woonoppervlakte === undefined ? "" : String(paspoort.woonoppervlakte),
    perceeloppervlakte:
      paspoort.perceeloppervlakte === undefined ? "" : String(paspoort.perceeloppervlakte),
    energielabel: paspoort.energielabel ?? "",
    energielabelRegistratie: paspoort.energielabelRegistratie ?? "",
    energielabelOpnameDatum: paspoort.energielabelOpnameDatum,
    waarborgpolisnummer: paspoort.waarborgpolisnummer ?? "",
    notaris: paspoort.notaris ?? "",
    hypotheekverstrekker: paspoort.hypotheekverstrekker ?? "",
  };
}

/** `"fout"` betekent: wel ingevuld, maar geen bruikbaar getal. */
function leesGetal(tekst: string, min: number, max: number): number | undefined | "fout" {
  const schoon = tekst.trim().replace(/\s/g, "");
  if (schoon === "") return undefined;
  const getal = Number(schoon.replace(",", "."));
  if (!Number.isFinite(getal) || getal < min || getal > max) return "fout";
  return Math.round(getal);
}

export default function Woning() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [project, setProject] = useState<ProjectMetId | null>(null);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);

  const [waarden, setWaarden] = useState<Paspoortwaarden>(LEEG);
  const [bezigMetPaspoort, setBezigMetPaspoort] = useState(false);
  const [bezigMetStatus, setBezigMetStatus] = useState(false);

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

        setProject(gevonden);
        if (gevonden) setWaarden(uitPaspoort(gevonden.woningpaspoort));
      } catch (f) {
        if (actueel) setFout(opslagFoutmelding(f, "Laden"));
      } finally {
        if (actueel) setBezigMetLaden(false);
      }
    })();

    return () => {
      actueel = false;
    };
  }, [uid, herlaadTeller]);

  function wijzig(patch: Partial<Paspoortwaarden>) {
    setWaarden((w) => ({ ...w, ...patch }));
  }

  async function bewaarStatus(status: WoningStatus) {
    if (!uid || !project) return;

    setBezigMetStatus(true);
    setFout(null);
    setGelukt(null);
    try {
      await zetWoningStatus(uid, project.id, status);
      setGelukt(
        status === "opgeleverd"
          ? "De woning staat op opgeleverd. Het dashboard toont nu het dossier."
          : "De woning staat weer op in aanbouw.",
      );
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetStatus(false);
    }
  }

  async function bewaarPaspoort() {
    if (!uid || !project) return;

    const bouwjaar = leesGetal(waarden.bouwjaar, 1800, 2200);
    const woonoppervlakte = leesGetal(waarden.woonoppervlakte, 1, 10000);
    const perceeloppervlakte = leesGetal(waarden.perceeloppervlakte, 1, 100000);

    if (bouwjaar === "fout") {
      setFout("Vul het bouwjaar in als vier cijfers, bijvoorbeeld 2026.");
      return;
    }
    if (woonoppervlakte === "fout" || perceeloppervlakte === "fout") {
      setFout("Vul de oppervlakte in als een getal in vierkante meters.");
      return;
    }

    setBezigMetPaspoort(true);
    setFout(null);
    setGelukt(null);
    try {
      // Het hele paspoort gaat mee: `werkWoningpaspoortBij` vervangt de map
      // integraal, zodat een leeggemaakt veld ook echt verdwijnt.
      await werkWoningpaspoortBij(uid, project.id, {
        ...(waarden.adres.trim() ? { adres: waarden.adres.trim() } : {}),
        ...(waarden.postcode.trim() ? { postcode: waarden.postcode.trim() } : {}),
        ...(waarden.plaats.trim() ? { plaats: waarden.plaats.trim() } : {}),
        ...(waarden.woningtype ? { woningtype: waarden.woningtype } : {}),
        ...(bouwjaar === undefined ? {} : { bouwjaar }),
        ...(woonoppervlakte === undefined ? {} : { woonoppervlakte }),
        ...(perceeloppervlakte === undefined ? {} : { perceeloppervlakte }),
        ...(waarden.energielabel ? { energielabel: waarden.energielabel } : {}),
        ...(waarden.energielabelRegistratie.trim()
          ? { energielabelRegistratie: waarden.energielabelRegistratie.trim() }
          : {}),
        ...(waarden.energielabelOpnameDatum
          ? { energielabelOpnameDatum: waarden.energielabelOpnameDatum }
          : {}),
        ...(waarden.waarborgpolisnummer.trim()
          ? { waarborgpolisnummer: waarden.waarborgpolisnummer.trim() }
          : {}),
        ...(waarden.notaris.trim() ? { notaris: waarden.notaris.trim() } : {}),
        ...(waarden.hypotheekverstrekker.trim()
          ? { hypotheekverstrekker: waarden.hypotheekverstrekker.trim() }
          : {}),
      });
      setGelukt("Woningpaspoort opgeslagen.");
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezigMetPaspoort(false);
    }
  }

  if (!uid || bezigMetLaden) return <Laadscherm />;

  if (!project) {
    return (
      <AppShell>
        <div className="max-w-xl">
          <Melding soort="info">
            Je hebt nog geen project. <Link to="/project/nieuw">Maak er eerst een aan.</Link>
          </Melding>
        </div>
      </AppShell>
    );
  }

  const status = woningStatusVan(project);
  const stand = paspoortstand(project.woningpaspoort);
  const label = bepaalEnergielabelstand(project.woningpaspoort, opDag(new Date()));
  const adres = adresregel(project.woningpaspoort);

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Woning</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">{adres ?? "De woning"}</h1>

      {fout && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}
      {gelukt && (
        <div className="mt-s3 max-w-xl">
          <Melding soort="gelukt">{gelukt}</Melding>
        </div>
      )}

      {/* ── De fase: de omslag van de app ───────────────────────────────── */}
      <section className="brink-card mt-s4 max-w-xl p-s3">
        <h2 className="text-h3 text-ink">Fase</h2>
        <p className="mt-s2 text-body text-slate">
          Zodra de sleutels zijn overgedragen verandert de app van inhoud: van het bouwtraject
          naar het dossier van je woning. Je zet dat zelf om — een oplevering kan uitgesteld
          worden, en dan moet de app niet alvast van vorm veranderen.
        </p>

        <div className="mt-s3">
          <Keuzeveld<WoningStatus>
            label="Waar staat de woning nu"
            waarde={status}
            opties={WONINGSTATUSOPTIES}
            onKies={(gekozen) => {
              if (gekozen !== status) void bewaarStatus(gekozen);
            }}
            disabled={bezigMetStatus}
          />
        </div>
      </section>

      {/* ── Het energielabel als klok ───────────────────────────────────── */}
      {label && (
        <section className="brink-card mt-s3 max-w-xl p-s3">
          <h2 className="text-h3 text-ink">Energielabel</h2>
          <p className="mt-s2 text-body text-slate">
            Een energielabel is tien jaar geldig vanaf de opnamedatum. Verloopt het, dan verdwijnt
            het uit EP-online — en bij verkoop heb je een geldig label nodig.
          </p>

          <div className="mt-s3">
            {label.verlopen ? (
              <Melding soort="fout">
                Het label is verlopen op {toonDatum(label.verlooptOp)}, {Math.abs(label.dagenResterend)}{" "}
                dagen geleden. Laat een nieuw label opnemen door een gecertificeerd adviseur.
              </Melding>
            ) : label.bijnaVerlopen ? (
              <Melding soort="fout">
                Nog {label.dagenResterend} dagen geldig, tot {toonDatum(label.verlooptOp)}.
              </Melding>
            ) : (
              <Melding soort="info">
                Geldig tot {toonDatum(label.verlooptOp)} — nog {label.dagenResterend} dagen.
              </Melding>
            )}
          </div>

          <p className="mt-s2 text-sm text-granite">
            Berekend als opnamedatum plus {ENERGIELABEL_GELDIG_MAANDEN / 12} jaar. De einddatum
            wordt niet opgeslagen: hij volgt uit de opnamedatum hieronder.
          </p>
        </section>
      )}

      {/* ── Het paspoort ────────────────────────────────────────────────── */}
      <section className="brink-card mt-s3 max-w-xl p-s3">
        <h2 className="text-h3 text-ink">Woningpaspoort</h2>
        <p className="mt-s2 text-body text-slate">
          Wat er over de woning zelf vastligt. Je hoeft dit niet in één keer compleet te maken —
          vul aan wat je weet.
        </p>

        {stand.ontbreekt.length > 0 && (
          <p className="mt-s2 text-sm text-granite">
            {stand.ingevuld} van de {stand.totaal} kerngegevens ingevuld. Nog leeg:{" "}
            {stand.ontbreekt.map((veld) => PASPOORTVELDLABELS[veld] ?? veld).join(", ")}.
          </p>
        )}

        <div className="mt-s3 flex flex-col gap-s2">
          <Veld
            label="Adres"
            hint="Straat en huisnummer, zoals het op de post komt te staan."
            value={waarden.adres}
            onChange={(e) => {
              wijzig({ adres: e.target.value });
            }}
          />

          <div className="grid gap-s2 sm:grid-cols-2">
            <Veld
              label="Postcode"
              value={waarden.postcode}
              onChange={(e) => {
                wijzig({ postcode: e.target.value });
              }}
            />
            <Veld
              label="Plaats"
              value={waarden.plaats}
              onChange={(e) => {
                wijzig({ plaats: e.target.value });
              }}
            />
          </div>

          <Keuzeveld<Woningtype | "">
            label="Woningtype"
            waarde={waarden.woningtype}
            opties={[{ waarde: "", label: "Nog niet gekozen" }, ...WONINGTYPEOPTIES]}
            onKies={(woningtype) => {
              wijzig({ woningtype });
            }}
          />

          <div className="grid gap-s2 sm:grid-cols-3">
            <Veld
              label="Bouwjaar"
              inputMode="numeric"
              value={waarden.bouwjaar}
              onChange={(e) => {
                wijzig({ bouwjaar: e.target.value });
              }}
            />
            <Veld
              label="Woonoppervlak (m²)"
              inputMode="numeric"
              value={waarden.woonoppervlakte}
              onChange={(e) => {
                wijzig({ woonoppervlakte: e.target.value });
              }}
            />
            <Veld
              label="Perceel (m²)"
              inputMode="numeric"
              value={waarden.perceeloppervlakte}
              onChange={(e) => {
                wijzig({ perceeloppervlakte: e.target.value });
              }}
            />
          </div>

          <div className="grid gap-s2 sm:grid-cols-2">
            <Keuzeveld<Energielabel | "">
              label="Energielabel"
              waarde={waarden.energielabel}
              opties={[{ waarde: "", label: "Nog niet bekend" }, ...ENERGIELABELOPTIES]}
              onKies={(energielabel) => {
                wijzig({ energielabel });
              }}
            />
            <Veld
              label="Registratienummer"
              hint="Het nummer waarmee het label in EP-online staat."
              value={waarden.energielabelRegistratie}
              onChange={(e) => {
                wijzig({ energielabelRegistratie: e.target.value });
              }}
            />
          </div>

          <Datumveld
            label="Opnamedatum energielabel"
            hint="Hiervandaan telt de geldigheid van tien jaar. Zonder deze datum is er geen aftelklok."
            waarde={waarden.energielabelOpnameDatum}
            onKies={(energielabelOpnameDatum) => {
              wijzig({ energielabelOpnameDatum });
            }}
          />

          <Veld
            label="Polisnummer garantiewaarborg"
            hint="Het nummer bij Woningborg of SWK. Het waarborgtype staat bij de projectgegevens."
            value={waarden.waarborgpolisnummer}
            onChange={(e) => {
              wijzig({ waarborgpolisnummer: e.target.value });
            }}
          />

          <div className="grid gap-s2 sm:grid-cols-2">
            <Veld
              label="Notaris"
              value={waarden.notaris}
              onChange={(e) => {
                wijzig({ notaris: e.target.value });
              }}
            />
            <Veld
              label="Hypotheekverstrekker"
              value={waarden.hypotheekverstrekker}
              onChange={(e) => {
                wijzig({ hypotheekverstrekker: e.target.value });
              }}
            />
          </div>
        </div>

        <div className="mt-s3">
          <Knop bezig={bezigMetPaspoort} onClick={() => void bewaarPaspoort()}>
            Woningpaspoort opslaan
          </Knop>
        </div>
      </section>
    </AppShell>
  );
}
