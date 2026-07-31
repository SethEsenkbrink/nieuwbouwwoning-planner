import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/context/useAuth";
import { Logo } from "./Logo";
import { Knop } from "./Knop";
import { Hoofdnavigatie, Menuknop, Mobielmenu, Subnavigatie } from "./Hoofdnavigatie";

/**
 * Header + container voor alle ingelogde pagina's.
 *
 * De header bestaat uit drie rijen, en dat is de reden dat de open/dicht-stand
 * van het mobiele menu hier woont en niet in de navigatie zelf:
 *
 *   1. logo · groepen (of de menuknop op mobiel) · account
 *   2. het uitgeklapte mobiele menu
 *   3. de subnavigatie van de groep waar je in zit
 *
 * Zaten die in één component, dan zou rij 2 het accountblok met `flex-wrap`
 * naar een derde regel duwen.
 *
 * Het menu sluit vanzelf bij navigatie: `useLocation` verandert, en de
 * `onKies`-callback zet hem dicht.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { gebruiker, uitloggen } = useAuth();
  const navigeer = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function afmelden() {
    await uitloggen();
    void navigeer("/inloggen", { replace: true });
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-bone bg-lifted">
        <div className="mx-auto max-w-content px-s2 py-s2">
          <div className="flex flex-wrap items-center gap-s2">
            <Link to="/" aria-label="Naar het dashboard" className="mr-s2 shrink-0">
              <Logo hoogte={36} />
            </Link>

            <Hoofdnavigatie />
            <Menuknop
              open={menuOpen}
              onKlik={() => {
                setMenuOpen((aan) => !aan);
              }}
            />

            <div className="ml-auto flex items-center gap-s2">
              {gebruiker?.email && (
                <span className="hidden text-body text-slate lg:inline">{gebruiker.email}</span>
              )}
              <Knop variant="secundair" onClick={() => void afmelden()}>
                Uitloggen
              </Knop>
            </div>
          </div>

          {menuOpen && (
            <Mobielmenu
              onKies={() => {
                setMenuOpen(false);
              }}
            />
          )}

          <Subnavigatie />
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
