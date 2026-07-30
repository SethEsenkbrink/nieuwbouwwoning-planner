import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/context/useAuth";
import { Logo } from "./Logo";
import { Knop } from "./Knop";

/** Header + container voor alle ingelogde pagina's. */
export function AppShell({ children }: { children: ReactNode }) {
  const { gebruiker, uitloggen } = useAuth();
  const navigeer = useNavigate();

  async function afmelden() {
    await uitloggen();
    void navigeer("/inloggen", { replace: true });
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-bone bg-lifted">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-s2 px-s2 py-s2">
          <div className="flex items-center gap-s4">
            <Link to="/" aria-label="Naar het dashboard">
              <Logo hoogte={36} />
            </Link>
            <nav className="flex items-center gap-s3" aria-label="Hoofdmenu">
              <Link to="/" className="text-body text-slate hover:text-ink">
                Dashboard
              </Link>
              <Link to="/betrokkenen" className="text-body text-slate hover:text-ink">
                Betrokkenen
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-s2">
            {gebruiker?.email && (
              <span className="hidden text-body text-slate sm:inline">{gebruiker.email}</span>
            )}
            <Knop variant="secundair" onClick={() => void afmelden()}>
              Uitloggen
            </Knop>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-content px-s2 py-s4">{children}</main>

      <footer className="mx-auto max-w-content px-s2 pb-s4">
        <p className="text-sm text-granite">
          Nieuwbouwplanner structureert en herinnert; het is geen juridisch of financieel advies.
          Termijnen zijn indicatief — controleer ze altijd tegen je eigen contract.
        </p>
      </footer>
    </div>
  );
}
