import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Knop } from "@/components/Knop";
import { Veld } from "@/components/Veld";
import { Tekstvlak } from "@/components/Tekstvlak";
import { Keuzeveld, type Keuze } from "@/components/Keuzeveld";
import { Melding } from "@/components/Melding";
import { Laadscherm } from "@/components/Laadscherm";
import { useVault as useAuth } from "@/context/useVault";
import { opslagFoutmelding } from "@/lib/opslagFouten";
import {
  haalActiefProject,
  haalAfspraken,
  haalBetrokkenen,
  verwijderBetrokkene,
  zetBetrokkene,
} from "@/lib/projecten";
import type { AfspraakMetId, BetrokkeneMetId } from "@/lib/converters";
import type { BetrokkeneCategorie, Communicatieregel } from "@/types/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Betrokkenen — de partijen die jij zelf hebt ingeschakeld
 *
 * Twee getallen per partij bepalen wanneer je moet handelen: de **aanlooptijd**
 * (hoeveel tijd zit er tussen "ze weten het" en "ze staan er") en de
 * **annuleertermijn** (tot wanneer kan het kosteloos verzet worden). Het
 * snijpunt daarvan levert de laatste dag waarop je nog gratis kunt schuiven —
 * het getal dat er werkelijk toe doet (ADR-0008, principe 3).
 *
 * DRIE DINGEN DIE HIER BEWUST ZO ZIJN
 *
 * 1. `waardenBron` KOMT NIET UIT DIT FORMULIER. De regel — termijn aangepast,
 *    dus het is nu een eigen cijfer — zit in `projecten.ts`. Zou het formulier
 *    het veld meesturen, dan blijft de disclaimer bij één vergeten regel hangen
 *    op getallen die de gebruiker zelf heeft opgezocht (ADR-0009).
 *
 * 2. EEN NIEUWE PARTIJ KRIJGT METEEN `"eigen"`. Wie zelf een partij toevoegt,
 *    tikt zijn eigen termijnen in; die als voorstel van de app labelen zou
 *    onzin zijn.
 *
 * 3. EEN PARTIJ VERWIJDEREN NEEMT ZIJN AFSPRAKEN MEE. Een afspraak zonder
 *    partij is onzichtbaar — de actielijst slaat hem over en `/afspraken`
 *    groepeert per partij. Hij zou blijven bestaan zonder dat je erbij kunt.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CATEGORIELABELS: Record<BetrokkeneCategorie, string> = {
  installatie: "Installatie en techniek",
  afbouw: "Afbouw",
  tuin: "Tuin en buiten",
  verhuizing: "Verhuizing",
  huidige_woning: "Huidige woning",
  nuts: "Nutsvoorzieningen en diensten",
  financieel: "Financieel en juridisch",
  overig: "Overig",
};

const CATEGORIEVOLGORDE: readonly BetrokkeneCategorie[] = [
  "installatie",
  "afbouw",
  "tuin",
  "verhuizing",
  "huidige_woning",
  "nuts",
  "financieel",
  "overig",
];

const CATEGORIEOPTIES: readonly Keuze<BetrokkeneCategorie>[] = CATEGORIEVOLGORDE.map((c) => ({
  waarde: c,
  label: CATEGORIELABELS[c],
}));

const REGELOPTIES: readonly Keuze<Communicatieregel>[] = [
  {
    waarde: "direct",
    label: "Bij elke wijziging",
    toelichting: "Voor partijen met een lange aanlooptijd, zoals de keukenleverancier.",
  },
  {
    waarde: "bij_aanzegging",
    label: "Pas als de datum vaststaat",
    toelichting:
      "Deze partij hoort pas iets als de aannemer de opleverdatum formeel heeft aangezegd. Zo mail je niet drie keer met een datum die steeds verandert.",
  },
  {
    waarde: "handmatig",
    label: "Nooit automatisch",
    toelichting: "Deze partij verschijnt nooit op de actielijst; je benadert hem zelf.",
  },
];

const REGELKORT: Record<Communicatieregel, string> = {
  direct: "bij elke wijziging",
  bij_aanzegging: "pas als de datum vaststaat",
  handmatig: "handmatig",
};

const LEEG = {
  naam: "",
  contactpersoon: "",
  email: "",
  telefoon: "",
  categorie: "overig" as BetrokkeneCategorie,
  aanlooptijd: "14",
  annuleertermijn: "0",
  communicatieregel: "direct" as Communicatieregel,
  notitie: "",
};

export default function Betrokkenen() {
  const { gebruiker } = useAuth();
  const uid = gebruiker?.uid;

  const [projectId, setProjectId] = useState<string | null>(null);
  const [betrokkenen, setBetrokkenen] = useState<BetrokkeneMetId[]>([]);
  const [afspraken, setAfspraken] = useState<AfspraakMetId[]>([]);
  const [bezigMetLaden, setBezigMetLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState<string | null>(null);

  const [bewerktId, setBewerktId] = useState<string | null>(null);
  const [nieuw, setNieuw] = useState(false);
  const [verwijderId, setVerwijderId] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [formulier, setFormulier] = useState(LEEG);

  const [herlaadTeller, setHerlaadTeller] = useState(0);
  const herlaad = useCallback(() => {
    setHerlaadTeller((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let actueel = true;

    void (async () => {
      try {
        const project = await haalActiefProject(uid);
        if (!actueel) return;

        if (!project) {
          setProjectId(null);
          setBetrokkenen([]);
          setAfspraken([]);
          return;
        }

        const [geladenBetrokkenen, geladenAfspraken] = await Promise.all([
          haalBetrokkenen(uid, project.id),
          haalAfspraken(uid, project.id),
        ]);
        if (!actueel) return;

        setProjectId(project.id);
        setBetrokkenen(geladenBetrokkenen);
        setAfspraken(geladenAfspraken);
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

  function sluitFormulier() {
    setBewerktId(null);
    setNieuw(false);
    setFormulier(LEEG);
  }

  function beginBewerken(betrokkene: BetrokkeneMetId) {
    setBewerktId(betrokkene.id);
    setNieuw(false);
    setVerwijderId(null);
    setFout(null);
    setGelukt(null);
    setFormulier({
      naam: betrokkene.naam,
      contactpersoon: betrokkene.contactpersoon ?? "",
      email: betrokkene.email ?? "",
      telefoon: betrokkene.telefoon ?? "",
      categorie: betrokkene.categorie,
      aanlooptijd: String(betrokkene.aanlooptijdDagen),
      annuleertermijn: String(betrokkene.annuleertermijnDagen),
      communicatieregel: betrokkene.communicatieregel,
      notitie: betrokkene.notitie ?? "",
    });
  }

  function controleer(): string | null {
    if (formulier.naam.trim() === "") return "Vul een naam in.";
    if (formulier.naam.trim().length > 120) return "De naam mag hooguit 120 tekens zijn.";

    const aanlooptijd = Number(formulier.aanlooptijd);
    const annuleertermijn = Number(formulier.annuleertermijn);
    if (!Number.isInteger(aanlooptijd) || aanlooptijd < 0 || aanlooptijd > 3650)
      return "De aanlooptijd moet een heel getal zijn tussen 0 en 3650 dagen.";
    if (!Number.isInteger(annuleertermijn) || annuleertermijn < 0 || annuleertermijn > 3650)
      return "De annuleertermijn moet een heel getal zijn tussen 0 en 3650 dagen.";

    if (formulier.email.trim().length > 200) return "Het e-mailadres is te lang.";
    if (formulier.telefoon.trim().length > 40) return "Het telefoonnummer is te lang.";
    if (formulier.contactpersoon.trim().length > 120) return "De contactpersoon is te lang.";
    if (formulier.notitie.trim().length > 2000)
      return "De notitie mag hooguit 2000 tekens zijn.";

    return null;
  }

  async function bewaar(bestaand: BetrokkeneMetId | null) {
    if (!uid || !projectId) return;

    const melding = controleer();
    if (melding) {
      setFout(melding);
      return;
    }

    const contactpersoon = formulier.contactpersoon.trim();
    const email = formulier.email.trim();
    const telefoon = formulier.telefoon.trim();
    const notitie = formulier.notitie.trim();

    setBezig(true);
    setFout(null);
    try {
      await zetBetrokkene(uid, projectId, bestaand, {
        naam: formulier.naam.trim(),
        categorie: formulier.categorie,
        aanlooptijdDagen: Number(formulier.aanlooptijd),
        annuleertermijnDagen: Number(formulier.annuleertermijn),
        communicatieregel: formulier.communicatieregel,
        ...(contactpersoon === "" ? {} : { contactpersoon }),
        ...(email === "" ? {} : { email }),
        ...(telefoon === "" ? {} : { telefoon }),
        ...(notitie === "" ? {} : { notitie }),
      });
      setGelukt(bestaand ? "Partij bijgewerkt." : "Partij toegevoegd.");
      sluitFormulier();
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Opslaan"));
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(betrokkene: BetrokkeneMetId) {
    if (!uid || !projectId) return;

    setBezig(true);
    setFout(null);
    try {
      const aantal = await verwijderBetrokkene(uid, projectId, betrokkene.id);
      setGelukt(
        aantal === 0
          ? `${betrokkene.naam} is verwijderd.`
          : `${betrokkene.naam} is verwijderd, samen met ${aantal} ${
              aantal === 1 ? "afspraak" : "afspraken"
            }.`,
      );
      setVerwijderId(null);
      herlaad();
    } catch (f) {
      setFout(opslagFoutmelding(f, "Verwijderen"));
    } finally {
      setBezig(false);
    }
  }

  if (!uid || bezigMetLaden) return <Laadscherm />;

  const groepen = CATEGORIEVOLGORDE.map(
    (categorie) =>
      [categorie, betrokkenen.filter((b) => b.categorie === categorie)] as const,
  ).filter(([, partijen]) => partijen.length > 0);

  const formulierVelden = (bestaand: BetrokkeneMetId | null) => (
    <div className="mt-s2 flex flex-col gap-s2 border-t border-bone pt-s3">
      <Veld
        label="Bedrijfsnaam"
        value={formulier.naam}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, naam: e.target.value }));
        }}
      />

      <Keuzeveld
        label="Categorie"
        waarde={formulier.categorie}
        opties={CATEGORIEOPTIES}
        onKies={(categorie) => {
          setFormulier((f) => ({ ...f, categorie }));
        }}
      />

      <div className="grid gap-s2 sm:grid-cols-2">
        <Veld
          label="Aanlooptijd in dagen"
          hint="Tussen “ze weten het” en “ze staan er”."
          inputMode="numeric"
          value={formulier.aanlooptijd}
          onChange={(e) => {
            setFormulier((f) => ({ ...f, aanlooptijd: e.target.value }));
          }}
        />
        <Veld
          label="Annuleertermijn in dagen"
          hint="Tot hoeveel dagen vooraf kosteloos verzetten? 0 = niet van toepassing."
          inputMode="numeric"
          value={formulier.annuleertermijn}
          onChange={(e) => {
            setFormulier((f) => ({ ...f, annuleertermijn: e.target.value }));
          }}
        />
      </div>

      <Keuzeveld
        label="Wanneer informeren?"
        waarde={formulier.communicatieregel}
        opties={REGELOPTIES}
        onKies={(communicatieregel) => {
          setFormulier((f) => ({ ...f, communicatieregel }));
        }}
      />

      <div className="grid gap-s2 sm:grid-cols-2">
        <Veld
          label="Contactpersoon (optioneel)"
          value={formulier.contactpersoon}
          onChange={(e) => {
            setFormulier((f) => ({ ...f, contactpersoon: e.target.value }));
          }}
        />
        <Veld
          label="Telefoon (optioneel)"
          type="tel"
          value={formulier.telefoon}
          onChange={(e) => {
            setFormulier((f) => ({ ...f, telefoon: e.target.value }));
          }}
        />
      </div>

      <Veld
        label="E-mailadres (optioneel)"
        hint="Straks het adres waar het concept-bericht naartoe gaat."
        type="email"
        value={formulier.email}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, email: e.target.value }));
        }}
      />

      <Tekstvlak
        label="Notitie (optioneel)"
        value={formulier.notitie}
        onChange={(e) => {
          setFormulier((f) => ({ ...f, notitie: e.target.value }));
        }}
      />

      <div className="flex flex-wrap gap-s2">
        <Knop bezig={bezig} onClick={() => void bewaar(bestaand)}>
          {bestaand ? "Opslaan" : "Partij toevoegen"}
        </Knop>
        <Knop variant="secundair" onClick={sluitFormulier}>
          Annuleren
        </Knop>
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
        <span className="text-eyebrow uppercase text-slate">Betrokkenen</span>
      </div>

      <h1 className="mt-s2 text-h2 text-ink">Wie er bij je bouw betrokken is</h1>

      {fout && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="fout">{fout}</Melding>
        </div>
      )}
      {gelukt && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="gelukt">{gelukt}</Melding>
        </div>
      )}

      {!projectId && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="info">
            Je hebt nog geen project. <Link to="/project/nieuw">Maak er eerst een aan.</Link>
          </Melding>
        </div>
      )}

      {projectId && (
        <div className="mt-s3 max-w-2xl">
          {nieuw ? (
            <section className="brink-card p-s3">
              <h2 className="text-h3 text-ink">Nieuwe partij</h2>
              {formulierVelden(null)}
            </section>
          ) : (
            <Knop
              onClick={() => {
                setNieuw(true);
                setBewerktId(null);
                setVerwijderId(null);
                setFout(null);
                setGelukt(null);
                setFormulier(LEEG);
              }}
            >
              Partij toevoegen
            </Knop>
          )}
        </div>
      )}

      {projectId && betrokkenen.length === 0 && !nieuw && (
        <div className="mt-s3 max-w-2xl">
          <Melding soort="info">
            Nog geen betrokkenen. Voeg ze hierboven toe, of{" "}
            <Link to="/project/nieuw">vink ze alsnog aan in de wizard</Link>.
          </Melding>
        </div>
      )}

      <div className="mt-s4 flex max-w-2xl flex-col gap-s4">
        {groepen.map(([categorie, partijen]) => (
          <section key={categorie}>
            <h2 className="text-h3 text-ink">{CATEGORIELABELS[categorie]}</h2>

            <div className="mt-s2 flex flex-col gap-s2">
              {partijen.map((betrokkene) => {
                const aantalAfspraken = afspraken.filter(
                  (a) => a.betrokkeneId === betrokkene.id,
                ).length;
                const wordtBewerkt = bewerktId === betrokkene.id;
                const contact = [
                  betrokkene.contactpersoon,
                  betrokkene.email,
                  betrokkene.telefoon,
                ].filter((v): v is string => v !== undefined && v !== "");

                return (
                  <article key={betrokkene.id} className="brink-card p-s3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-body font-semibold text-ink">{betrokkene.naam}</h3>
                      {betrokkene.waardenBron === "voorstel" && (
                        <span className="rounded-pill bg-bone px-3 py-1 text-sm text-granite">
                          voorstel — controleer bij je leverancier
                        </span>
                      )}
                    </div>

                    {!wordtBewerkt && (
                      <>
                        <dl className="mt-s2 grid grid-cols-[auto_1fr] gap-x-s2 gap-y-1 text-body">
                          <dt className="text-slate">Aanlooptijd</dt>
                          <dd className="text-ink">{betrokkene.aanlooptijdDagen} dagen</dd>
                          <dt className="text-slate">Kosteloos verzetten</dt>
                          <dd className="text-ink">
                            {betrokkene.annuleertermijnDagen > 0
                              ? `tot ${betrokkene.annuleertermijnDagen} dagen van tevoren`
                              : "niet van toepassing"}
                          </dd>
                          <dt className="text-slate">Informeren</dt>
                          <dd className="text-ink">
                            {REGELKORT[betrokkene.communicatieregel]}
                          </dd>
                          {contact.length > 0 && (
                            <>
                              <dt className="text-slate">Contact</dt>
                              <dd className="text-ink">{contact.join(" · ")}</dd>
                            </>
                          )}
                          <dt className="text-slate">Afspraken</dt>
                          <dd className="text-ink">
                            {aantalAfspraken}{" "}
                            <Link to="/afspraken" className="underline">
                              bekijken
                            </Link>
                          </dd>
                        </dl>

                        {betrokkene.notitie && (
                          <p className="mt-s2 text-sm text-granite">{betrokkene.notitie}</p>
                        )}
                      </>
                    )}

                    {verwijderId === betrokkene.id ? (
                      <div className="mt-s2 flex flex-col gap-s2">
                        <Melding soort="fout">
                          {betrokkene.naam} verwijderen?
                          {aantalAfspraken > 0 &&
                            ` Dit verwijdert ook ${aantalAfspraken} ${
                              aantalAfspraken === 1 ? "afspraak" : "afspraken"
                            }.`}{" "}
                          Dit kan niet teruggedraaid worden.
                        </Melding>
                        <div className="flex flex-wrap gap-s2">
                          <Knop bezig={bezig} onClick={() => void verwijder(betrokkene)}>
                            Ja, verwijderen
                          </Knop>
                          <Knop
                            variant="secundair"
                            onClick={() => {
                              setVerwijderId(null);
                            }}
                          >
                            Annuleren
                          </Knop>
                        </div>
                      </div>
                    ) : (
                      !wordtBewerkt && (
                        <div className="mt-s3 flex flex-wrap gap-s2">
                          <Knop
                            variant="secundair"
                            onClick={() => {
                              beginBewerken(betrokkene);
                            }}
                          >
                            Aanpassen
                          </Knop>
                          <Knop
                            variant="secundair"
                            onClick={() => {
                              setVerwijderId(betrokkene.id);
                              setBewerktId(null);
                            }}
                          >
                            Verwijderen
                          </Knop>
                        </div>
                      )
                    )}

                    {wordtBewerkt && formulierVelden(betrokkene)}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
