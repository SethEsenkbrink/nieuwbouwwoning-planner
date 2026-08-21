import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "./Logo";
import { AANBIEDER } from "@/data/aanbieder";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Omhulsel voor de pagina's die je zonder ontgrendelde kluis kunt zien
 *
 * Dat zijn de landingspagina, de algemene voorwaarden en de privacyverklaring.
 * Ze delen bewust géén opmaak met `AppShell`: die heeft een hoofdnavigatie naar
 * routes die zonder kluis niet bestaan, en een "Vergrendelen"-knop die dan
 * nergens op slaat.
 *
 * De voettekst staat hier en niet per pagina. Naar de voorwaarden en de
 * privacyverklaring moet vanaf élke publieke pagina een link lopen, en dat is
 * precies het soort ding dat je bij de vierde pagina vergeet.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface PubliekeLayoutProps {
  children: ReactNode;
  /** Op de landingspagina staat de CTA in de hero; dan hoeft hij niet ook bovenin. */
  toonKopCta?: boolean;
}

export function PubliekeLayout({ children, toonKopCta = true }: PubliekeLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-bone bg-lifted">
        <div className="mx-auto flex max-w-content flex-wrap items-center gap-s2 px-s2 py-s2">
          <Link to="/" aria-label="Naar de startpagina" className="shrink-0">
            <Logo hoogte={36} />
          </Link>

          <nav aria-label="Publieke pagina's" className="ml-auto flex items-center gap-s2">
            <Link to="/voorwaarden" className="text-body text-slate underline-offset-4 hover:text-ink hover:underline">
              Voorwaarden
            </Link>
            <Link to="/privacy" className="text-body text-slate underline-offset-4 hover:text-ink hover:underline">
              Privacy
            </Link>
            {toonKopCta && (
              <Link
                to="/registreren"
                className="rounded-pill bg-clay px-5 py-2.5 text-button text-canvas transition-colors hover:bg-clay-deep"
              >
                Beginnen
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-content flex-1 px-s2 py-s6">{children}</main>

      <footer className="border-t border-bone bg-lifted">
        <div className="mx-auto max-w-content px-s2 py-s4">
          <div className="flex flex-wrap items-start justify-between gap-s3">
            <div className="max-w-md">
              <Logo hoogte={32} />
              <p className="mt-s2 text-sm text-granite">
                {AANBIEDER.product} structureert en herinnert; het is geen juridisch of
                financieel advies. Termijnen zijn indicatief — je eigen contract blijft
                leidend.
              </p>
            </div>

            <nav aria-label="Voettekst" className="flex flex-col gap-1.5">
              <Link to="/voorwaarden" className="text-body text-slate hover:text-ink">
                Algemene voorwaarden
              </Link>
              <Link to="/privacy" className="text-body text-slate hover:text-ink">
                Privacyverklaring
              </Link>
              <Link to="/inloggen" className="text-body text-slate hover:text-ink">
                Kluis ontgrendelen
              </Link>
            </nav>
          </div>

          <p className="mt-s4 border-t border-bone pt-s3 text-sm text-granite">
            {AANBIEDER.product} is een product van {AANBIEDER.naam}. De broncode is beschikbaar
            onder de {AANBIEDER.licentie}-licentie.
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Opmaak voor een juridische pagina: één kolom, ruime regelafstand, en een
 * zichtbare datum van laatste herziening.
 *
 * `max-w-prose` en niet de volle contentbreedte: 65 tekens per regel leest,
 * 140 niet. Bij voorwaarden waar iemand zich aan bindt, is dat geen smaak.
 */
export function JuridischePagina({
  titel,
  intro,
  bijgewerkt,
  versie,
  children,
}: {
  titel: string;
  intro: string;
  bijgewerkt: string;
  versie?: string;
  children: ReactNode;
}) {
  return (
    <PubliekeLayout>
      <article className="max-w-prose">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-pill bg-clay" aria-hidden="true" />
          <span className="text-eyebrow uppercase text-slate">Juridisch</span>
        </div>

        <h1 className="mt-s2 text-h2 text-ink">{titel}</h1>
        <p className="mt-s2 text-body text-slate">{intro}</p>

        <p className="mt-s2 text-sm text-granite">
          Laatst bijgewerkt op {bijgewerkt}
          {versie ? ` · versie ${versie}` : ""}
        </p>

        <div className="mt-s4 flex flex-col gap-s4">{children}</div>

        <div className="mt-s6 border-t border-bone pt-s3">
          <Link to="/" className="text-body text-link underline">
            Terug naar de startpagina
          </Link>
        </div>
      </article>
    </PubliekeLayout>
  );
}

/** Eén genummerde paragraaf binnen een juridische pagina. */
export function Artikel({
  nummer,
  titel,
  children,
}: {
  nummer: number;
  titel: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-h3 text-ink">
        {nummer}. {titel}
      </h2>
      <div className="mt-s2 flex flex-col gap-s2 text-body text-charcoal">{children}</div>
    </section>
  );
}
