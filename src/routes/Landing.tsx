import { Link } from "react-router";
import { PubliekeLayout } from "@/components/PubliekeLayout";
import { usePaginameta } from "@/lib/usePaginameta";
import { AANBIEDER } from "@/data/aanbieder";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * De landingspagina — wat dit is, voordat je een kluis aanmaakt
 *
 * Dit is het eerste scherm voor iemand met een vergrendelde of nog niet
 * bestaande kluis. Tot vandaag stuurde `/` zo'n bezoeker meteen door naar
 * /inloggen: een wachtwoordveld, zonder één zin over waarvoor.
 *
 * DE TOON IS BEWUST NUCHTER. Er staat een blok "wat dit níét doet" tussen,
 * en dat is geen bescheidenheid maar constraint C6: de app rekent en
 * herinnert, hij adviseert niet. Iemand die hier binnenkomt in de verwachting
 * hypotheekadvies te krijgen, moet dat op deze pagina al ontdekken en niet pas
 * na het invullen van zijn hele dossier.
 *
 * GEEN CIJFERS DIE WE NIET KUNNEN WAARMAKEN. Geen "duizenden gebruikers",
 * geen "bespaart u 4.000 euro". Alles op deze pagina is een eigenschap van de
 * software die in de code aanwijsbaar is.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface Pijler {
  titel: string;
  tekst: string;
}

const PIJLERS: readonly Pijler[] = [
  {
    titel: "Geen server, geen account",
    tekst:
      "Er is niets om in te loggen. De app draait volledig in je browser en doet tijdens gebruik nul netwerkverzoeken — de Content-Security-Policy blokkeert ze zelfs actief. Je dossier staat op jouw apparaat en nergens anders.",
  },
  {
    titel: "Versleuteld op schijf",
    tekst:
      "Alles wat je invult wordt versleuteld opgeslagen met AES-256-GCM. De sleutel wordt uit je wachtwoordzin afgeleid met Argon2id en bestaat alleen in het werkgeheugen. Sluit je de kluis, dan staat er op schijf niets leesbaars meer.",
  },
  {
    titel: "Je data blijft van jou",
    tekst:
      "Eén knop maakt een volledig backupbestand met je dossier én je bijlagen. Het formaat is gedocumenteerd en de app leest zijn eigen backup terug om te controleren dat hij klopt. Stop je morgen, dan houd je een bestand dat over vijf jaar nog te openen is.",
  },
];

interface Traject {
  eyebrow: string;
  titel: string;
  regels: readonly string[];
}

const TRAJECTEN: readonly Traject[] = [
  {
    eyebrow: "Nieuwbouw",
    titel: "Van aannemingsovereenkomst tot sleutel",
    regels: [
      "Termijnstaat, bouwdepot en de rente die daarover loopt",
      "Meerwerk met een sluitingsdatum per keuze",
      "De opleverdatum als bandbreedte, niet als één datum die toch verschuift",
      "Opleverpunten, hersteltermijnen en het 5%-opschortingsrecht",
      "Wie je moet informeren zodra de bouw schuift — en wie nog even kan wachten",
    ],
  },
  {
    eyebrow: "Bestaande bouw",
    titel: "Van bod tot notarieel transport",
    regels: [
      "Ontbindende voorwaarden met hun uiterste datum",
      "Bouwkundige keuring, taxatie en de bevindingen daaruit",
      "Overdrachtsbelasting, makelaarskosten en het verbouwbudget",
      "Lijst van zaken en wat er bij de sleuteloverdracht is afgesproken",
      "Meterstanden op de dag van overdracht",
    ],
  },
  {
    eyebrow: "Daarna — voor beide",
    titel: "Het beheer dat blijft",
    regels: [
      "Wat er in huis zit: merk, type, serienummer, installatiedatum",
      "Garantietermijnen die aflopen, met de klok erbij",
      "Onderhoud dat terugkomt, met een logboek van wat er gedaan is",
      "Meerjarenonderhoud en wat je er maandelijks voor opzij zet",
      "Energieverbruik, meterstanden en je energielabel",
    ],
  },
];

interface Stap {
  nummer: number;
  titel: string;
  tekst: string;
}

const STAPPEN: readonly Stap[] = [
  {
    nummer: 1,
    titel: "Maak een kluis aan",
    tekst:
      "Je kiest een wachtwoordzin en krijgt een herstelcode. Die code is je enige achterdeur — er is geen server die hem voor je kan resetten. Bewaar hem zoals je een reservesleutel bewaart.",
  },
  {
    nummer: 2,
    titel: "Doorloop de startwizard",
    tekst:
      "De wizard vraagt eerst waar je staat: oriënteren, net gekocht, midden in de bouw, net opgeleverd, of al jaren in je huis. Daarna krijg je alleen de vragen die op dat moment iets betekenen.",
  },
  {
    nummer: 3,
    titel: "Gebruik hem zoals het uitkomt",
    tekst:
      "Daarna is het dossier ingericht. Verandert er iets aan de planning, dan rekent de app door wat dat betekent en wie je erover moet spreken. Verder blijft het stil.",
  },
];

interface NietDoen {
  titel: string;
  tekst: string;
}

const NIET_DOEN: readonly NietDoen[] = [
  {
    titel: "Geen juridisch of financieel advies",
    tekst:
      "Termijnen, rentes en garantieklokken worden berekend op algemene kaders en op wat jij invult. Ze zijn indicatief. Je koop-/aannemingsovereenkomst, je hypotheekakte en je garantiecertificaat zijn leidend — altijd.",
  },
  {
    titel: "Geen synchronisatie tussen apparaten",
    tekst:
      "Er is geen cloud, dus ook geen automatische sync. Je desktop is de bron van waarheid; op je telefoon leg je snel iets vast en dat neem je later over. Dat is de prijs van geen server hebben, en die is bewust betaald.",
  },
  {
    titel: "Geen wachtwoordherstel",
    tekst:
      "Kwijt is kwijt, op je herstelcode na. Niemand kan je kluis openen — wij ook niet. Dat is precies wat de belofte hierboven waard maakt, maar het betekent wel dat die code er echt toe doet.",
  },
  {
    titel: "Geen koppeling met instanties",
    tekst:
      "De app haalt niets op bij het Kadaster, EP-Online, je bank of je aannemer. Alles wat erin staat, heb jij erin gezet of uit een bestand geïmporteerd.",
  },
];

export default function Landing() {
  usePaginameta("/");

  return (
    <PubliekeLayout>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="max-w-3xl">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
          <span className="text-eyebrow uppercase text-slate">
            100% lokaal · end-to-end versleuteld
          </span>
        </div>

        <h1 className="mt-s3 text-h2 text-ink sm:text-h1">
          Het complete dossier van je woning, op je eigen apparaat
        </h1>

        <p className="mt-s3 text-body text-slate">
          Van koop tot oplevering en het onderhoud daarna. {AANBIEDER.product} houdt de
          termijnen, de kosten en de afspraken bij elkaar, en rekent door wat een verschuiving
          betekent. Zonder account, zonder server, zonder dat er ook maar iets van jou het
          apparaat verlaat.
        </p>

        <div className="mt-s4 flex flex-wrap items-center gap-s2">
          <Link
            to="/registreren"
            className="rounded-pill bg-clay px-6 py-3 text-button text-canvas transition-colors hover:bg-clay-deep"
          >
            Kluis aanmaken
          </Link>
          <Link
            to="/inloggen"
            className="rounded-pill border border-bone bg-white px-6 py-3 text-button text-ink transition-colors hover:bg-lifted"
          >
            Ik heb al een kluis
          </Link>
        </div>

        <p className="mt-s3 text-sm text-granite">
          Werkt in elke moderne browser. Voor de automatische backup naar een eigen map heb je
          een Chromium-browser op desktop nodig (Chrome of Edge).
        </p>
      </section>

      {/* ── De drie pijlers ────────────────────────────────────────────── */}
      <section className="mt-s12">
        <h2 className="text-h3 text-ink">Waarom lokaal het uitgangspunt is</h2>
        <p className="mt-s2 max-w-prose text-body text-slate">
          Een woningdossier bevat je koopsom, je hypotheek, je adres en foto&apos;s van de
          binnenkant van je huis. Dat is precies het pakket dat je niet op de server van iemand
          anders wilt hebben staan.
        </p>

        <div className="mt-s4 grid gap-s3 md:grid-cols-3">
          {PIJLERS.map((pijler) => (
            <div key={pijler.titel} className="brink-card p-s3">
              <h3 className="text-h3 text-ink">{pijler.titel}</h3>
              <p className="mt-s2 text-body text-slate">{pijler.tekst}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Wat er in zit ──────────────────────────────────────────────── */}
      <section className="mt-s12">
        <h2 className="text-h3 text-ink">Twee trajecten, één dossier</h2>
        <p className="mt-s2 max-w-prose text-body text-slate">
          Koop je nieuwbouw of bestaande bouw, dan loopt de eerste periode heel anders. Daarna
          komt het op hetzelfde neer: een huis dat onderhoud vraagt en garanties heeft die
          aflopen.
        </p>

        <div className="mt-s4 grid gap-s3 md:grid-cols-3">
          {TRAJECTEN.map((traject) => (
            <div key={traject.eyebrow} className="brink-card p-s3">
              <span className="text-eyebrow uppercase text-clay">{traject.eyebrow}</span>
              <h3 className="mt-s2 text-h3 text-ink">{traject.titel}</h3>
              <ul className="mt-s2 flex flex-col gap-1.5">
                {traject.regels.map((regel) => (
                  <li key={regel} className="flex gap-2 text-body text-slate">
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-pill bg-olive"
                      aria-hidden="true"
                    />
                    <span>{regel}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hoe je begint ──────────────────────────────────────────────── */}
      <section className="mt-s12">
        <h2 className="text-h3 text-ink">Zo begin je</h2>
        <p className="mt-s2 max-w-prose text-body text-slate">
          Je hoeft niet aan het begin van een bouwtraject te staan om iets aan de app te hebben.
          Woon je er al vier jaar, dan begin je gewoon bij het onderhoud.
        </p>

        <ol className="mt-s4 grid gap-s3 md:grid-cols-3">
          {STAPPEN.map((stap) => (
            <li key={stap.nummer} className="brink-card p-s3">
              <span className="flex size-8 items-center justify-center rounded-pill bg-clay text-button text-canvas">
                {stap.nummer}
              </span>
              <h3 className="mt-s2 text-h3 text-ink">{stap.titel}</h3>
              <p className="mt-s2 text-body text-slate">{stap.tekst}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Wat het niet doet ──────────────────────────────────────────── */}
      <section className="mt-s12">
        <h2 className="text-h3 text-ink">Wat {AANBIEDER.product} niet doet</h2>
        <p className="mt-s2 max-w-prose text-body text-slate">
          Beter hier dan halverwege je dossier.
        </p>

        <div className="mt-s4 grid gap-s3 md:grid-cols-2">
          {NIET_DOEN.map((item) => (
            <div key={item.titel} className="rounded-consent border border-taupe/40 bg-bone p-s3">
              <h3 className="text-body font-semibold text-ink">{item.titel}</h3>
              <p className="mt-s1 text-body text-slate">{item.tekst}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Openheid ───────────────────────────────────────────────────── */}
      <section className="mt-s12">
        <div className="brink-card p-s4">
          <h2 className="text-h3 text-ink">Te controleren, niet te geloven</h2>
          <p className="mt-s2 max-w-prose text-body text-slate">
            Een privacybelofte is niet meer waard dan het vertrouwen dat je in de aanbieder hebt.
            Daarom is de broncode van {AANBIEDER.product} openbaar onder de{" "}
            {AANBIEDER.licentie}-licentie: je kunt zelf nakijken dat er geen netwerkverkeer in
            zit, in plaats van ons op ons woord te geloven. De build wordt bovendien
            gecontroleerd op externe verbindingen voordat hij gepubliceerd wordt.
          </p>
          <p className="mt-s2 max-w-prose text-body text-slate">
            Vind je een kwetsbaarheid, meld hem dan op{" "}
            <a href={`mailto:${AANBIEDER.beveiligingEmail}`} className="text-link underline">
              {AANBIEDER.beveiligingEmail}
            </a>{" "}
            voordat je hem openbaar maakt.
          </p>

          <div className="mt-s3 flex flex-wrap gap-s3">
            <Link to="/voorwaarden" className="text-body text-link underline">
              Algemene voorwaarden
            </Link>
            <Link to="/privacy" className="text-body text-link underline">
              Privacyverklaring
            </Link>
          </div>
        </div>
      </section>

      {/* ── Afsluitende CTA ────────────────────────────────────────────── */}
      <section className="mt-s12 max-w-prose">
        <h2 className="text-h3 text-ink">Beginnen kost één wachtwoordzin</h2>
        <p className="mt-s2 text-body text-slate">
          Geen e-mailadres, geen bevestigingsmail, geen proefperiode. Je maakt een kluis aan op
          dit apparaat en de startwizard doet de rest.
        </p>
        <div className="mt-s3">
          <Link
            to="/registreren"
            className="inline-block rounded-pill bg-clay px-6 py-3 text-button text-canvas transition-colors hover:bg-clay-deep"
          >
            Kluis aanmaken
          </Link>
        </div>
      </section>
    </PubliekeLayout>
  );
}
